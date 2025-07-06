const { AppError, ValidationError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * WRITEOFFS SERVICE
 * 
 * Сервіс для управління операціями списання товарів.
 * Функціональність:
 * - Отримання всіх списань з фільтрацією
 * - Отримання списань за продуктом
 * - Створення нового списання з логуванням операцій
 * - Статистика списань
 * 
 * Hybrid функціональний підхід з централізованою ініціалізацією.
 */

// Внутрішні залежності (ініціалізуються при старті)
let writeoffQueries = null;
let productQueries = null;
let OperationsLogController = null;

/**
 * Ініціалізація сервісу з залежностями
 */
const initialize = (dependencies) => {
    const { writeoffQueries: wq, productQueries: pq, OperationsLogController: olc } = dependencies;
    
    if (!wq || !pq || !olc) {
        throw new Error('WriteoffService: missing dependencies (writeoffQueries, productQueries, OperationsLogController)');
    }
    
    writeoffQueries = wq;
    productQueries = pq;
    OperationsLogController = olc;
    
    console.log('✅ WriteoffService ініціалізовано успішно');
};

/**
 * Отримати всі списання з опціональною фільтрацією
 */
const getAllWriteoffs = async (filters = {}) => {
    try {
        if (!writeoffQueries) {
            throw new DatabaseError('WriteoffService не ініціалізовано');
        }

        const writeoffs = await writeoffQueries.getAll();

        // Застосовуємо фільтри на рівні сервісу (якщо потрібно)
        let filteredWriteoffs = writeoffs;

        if (filters.date_from) {
            filteredWriteoffs = filteredWriteoffs.filter(w => 
                new Date(w.writeoff_date) >= new Date(filters.date_from)
            );
        }

        if (filters.date_to) {
            filteredWriteoffs = filteredWriteoffs.filter(w => 
                new Date(w.writeoff_date) <= new Date(filters.date_to)
            );
        }

        if (filters.product_id) {
            filteredWriteoffs = filteredWriteoffs.filter(w => 
                w.product_id === parseInt(filters.product_id)
            );
        }

        if (filters.reason) {
            filteredWriteoffs = filteredWriteoffs.filter(w => 
                w.reason.toLowerCase().includes(filters.reason.toLowerCase())
            );
        }

        if (filters.responsible) {
            filteredWriteoffs = filteredWriteoffs.filter(w => 
                w.responsible.toLowerCase().includes(filters.responsible.toLowerCase())
            );
        }

        // Обчислюємо додаткову статистику
        const totalQuantity = filteredWriteoffs.reduce((sum, w) => sum + (w.total_quantity || 0), 0);
        const uniqueProducts = new Set(filteredWriteoffs.map(w => w.product_id)).size;
        const dateRange = filteredWriteoffs.length > 0 ? {
            from: Math.min(...filteredWriteoffs.map(w => new Date(w.writeoff_date).getTime())),
            to: Math.max(...filteredWriteoffs.map(w => new Date(w.writeoff_date).getTime()))
        } : null;

        return {
            writeoffs: filteredWriteoffs,
            meta: {
                total: filteredWriteoffs.length,
                totalQuantity,
                uniqueProducts,
                dateRange: dateRange ? {
                    from: new Date(dateRange.from).toISOString().split('T')[0],
                    to: new Date(dateRange.to).toISOString().split('T')[0]
                } : null,
                filters: Object.keys(filters).length > 0 ? filters : null
            }
        };
    } catch (error) {
        console.error('WriteoffService.getAllWriteoffs ERROR:', error);
        
        if (error instanceof AppError) {
            throw error;
        }
        
        throw new DatabaseError('Помилка отримання списку списань', error.message);
    }
};

/**
 * Отримати списання за ID продукту
 */
const getWriteoffsByProductId = async (productId) => {
    try {
        if (!writeoffQueries || !productQueries) {
            throw new DatabaseError('WriteoffService не ініціалізовано');
        }

        if (!productId || isNaN(productId) || productId <= 0) {
            throw new ValidationError('Невірний productId', [{
                field: 'productId',
                message: 'ID продукту повинен бути додатним числом',
                value: productId
            }]);
        }

        // Перевіряємо чи існує продукт
        const product = await productQueries.getById(productId);
        if (!product) {
            throw new ValidationError('Продукт не знайдено', [{
                field: 'productId',
                message: `Продукт з ID ${productId} не існує`,
                value: productId
            }]);
        }

        const writeoffs = await writeoffQueries.getByProductId(productId);

        // Статистика по цьому продукту
        const totalQuantity = writeoffs.reduce((sum, w) => sum + (w.total_quantity || 0), 0);
        const totalWriteoffs = writeoffs.length;

        return {
            writeoffs,
            product: {
                id: product.id,
                name: product.name,
                code: product.code,
                currentStock: product.stock_pieces || 0
            },
            meta: {
                total: totalWriteoffs,
                totalQuantity,
                productName: product.name,
                productCode: product.code
            }
        };
    } catch (error) {
        console.error('WriteoffService.getWriteoffsByProductId ERROR:', error);
        
        if (error instanceof AppError) {
            throw error;
        }
        
        throw new DatabaseError('Помилка отримання списань по продукту', error.message);
    }
};

/**
 * Створити новий запис списання
 */
const createWriteoff = async (writeoffData, requestInfo = {}) => {
    try {
        if (!writeoffQueries || !productQueries || !OperationsLogController) {
            throw new DatabaseError('WriteoffService не ініціалізовано');
        }

        const { product_id, writeoff_date, total_quantity, reason, responsible, notes } = writeoffData;

        // Перевіряємо чи існує продукт
        const product = await productQueries.getById(product_id);
        if (!product) {
            throw new ValidationError('Продукт не знайдено', [{
                field: 'product_id',
                message: `Продукт з ID ${product_id} не існує`,
                value: product_id
            }]);
        }

        // Перевіряємо достатність запасів
        if (product.stock_pieces < total_quantity) {
            throw new ValidationError('Недостатньо запасів для списання', [{
                field: 'total_quantity',
                message: `Доступно лише ${product.stock_pieces} шт., запитано ${total_quantity} шт.`,
                value: total_quantity
            }]);
        }

        // Створюємо запис списання
        const result = await writeoffQueries.create({
            product_id,
            writeoff_date,
            total_quantity,
            reason,
            responsible,
            notes: notes || ''
        });

        // Логуємо операцію списання
        try {
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.WRITEOFF,
                operation_id: result.id,
                entity_type: 'writeoff',
                entity_id: result.id,
                old_data: {
                    stock_before: product.stock_pieces
                },
                new_data: {
                    product_name: product.name,
                    product_code: product.code,
                    quantity: total_quantity,
                    reason: reason,
                    responsible: responsible,
                    stock_after: product.stock_pieces - total_quantity
                },
                description: `Списання: ${product.name} (${product.code}) - ${total_quantity} шт. Причина: ${reason}`,
                user_name: responsible,
                ip_address: requestInfo.ip || 'unknown',
                user_agent: requestInfo.userAgent || 'unknown'
            });
        } catch (logError) {
            console.error('WriteoffService.createWriteoff LOG ERROR:', logError);
            // Логування не критично, операція списання вже виконана
        }

        return {
            id: result.id,
            product: {
                id: product.id,
                name: product.name,
                code: product.code,
                stock_before: product.stock_pieces,
                stock_after: product.stock_pieces - total_quantity
            },
            writeoff: {
                writeoff_date,
                quantity: total_quantity,
                reason,
                responsible,
                notes: notes || ''
            },
            meta: {
                created_at: new Date().toISOString(),
                operation_logged: true
            }
        };
    } catch (error) {
        console.error('WriteoffService.createWriteoff ERROR:', error);
        
        if (error instanceof AppError) {
            throw error;
        }
        
        throw new DatabaseError('Помилка створення списання', error.message);
    }
};

/**
 * Отримати статистику списань
 */
const getWriteoffStatistics = async (period = 'month') => {
    try {
        if (!writeoffQueries) {
            throw new DatabaseError('WriteoffService не ініціалізовано');
        }

        const writeoffs = await writeoffQueries.getAll();

        // Обчислюємо період для статистики
        const now = new Date();
        let periodStart;
        
        switch (period) {
            case 'week':
                periodStart = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                periodStart = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'quarter':
                periodStart = new Date(now.setMonth(now.getMonth() - 3));
                break;
            case 'year':
                periodStart = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                periodStart = new Date(now.setMonth(now.getMonth() - 1));
        }

        // Фільтруємо за періодом
        const periodWriteoffs = writeoffs.filter(w => 
            new Date(w.writeoff_date) >= periodStart
        );

        // Статистика по причинах
        const reasonStats = {};
        periodWriteoffs.forEach(w => {
            if (!reasonStats[w.reason]) {
                reasonStats[w.reason] = { count: 0, quantity: 0 };
            }
            reasonStats[w.reason].count++;
            reasonStats[w.reason].quantity += w.total_quantity;
        });

        // Статистика по відповідальних
        const responsibleStats = {};
        periodWriteoffs.forEach(w => {
            if (!responsibleStats[w.responsible]) {
                responsibleStats[w.responsible] = { count: 0, quantity: 0 };
            }
            responsibleStats[w.responsible].count++;
            responsibleStats[w.responsible].quantity += w.total_quantity;
        });

        // Топ продуктів за списаннями
        const productStats = {};
        periodWriteoffs.forEach(w => {
            const key = `${w.product_name} (${w.product_code})`;
            if (!productStats[key]) {
                productStats[key] = { count: 0, quantity: 0, product_id: w.product_id };
            }
            productStats[key].count++;
            productStats[key].quantity += w.total_quantity;
        });

        return {
            period: {
                name: period,
                start: periodStart.toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
            },
            summary: {
                totalWriteoffs: periodWriteoffs.length,
                totalQuantity: periodWriteoffs.reduce((sum, w) => sum + w.total_quantity, 0),
                uniqueProducts: new Set(periodWriteoffs.map(w => w.product_id)).size,
                uniqueReasons: Object.keys(reasonStats).length
            },
            reasonStats: Object.entries(reasonStats)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 10),
            responsibleStats: Object.entries(responsibleStats)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 10),
            productStats: Object.entries(productStats)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 10)
        };
    } catch (error) {
        console.error('WriteoffService.getWriteoffStatistics ERROR:', error);
        
        if (error instanceof AppError) {
            throw error;
        }
        
        throw new DatabaseError('Помилка отримання статистики списань', error.message);
    }
};

module.exports = {
    initialize,
    getAllWriteoffs,
    getWriteoffsByProductId,
    createWriteoff,
    getWriteoffStatistics
}; 