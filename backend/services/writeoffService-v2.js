/**
 * Writeoff Service v2 - Універсальний сервіс для роботи зі списаннями
 * Підтримує SQLite та Supabase PostgreSQL через DatabaseAdapter
 */

const { AppError } = require('../middleware/errors/AppError');

// Глобальні змінні для query адаптерів
let writeoffQueries = null;
let OperationsLogController = null;

// Ініціалізація query адаптера на основі USE_SUPABASE
const initializeQueries = (dependencies = {}) => {
    const useSupabase = process.env.USE_SUPABASE === 'true';
    
    if (useSupabase) {
        writeoffQueries = require('../queries/supabase/writeoffQueries');
        console.log('🔧 WriteoffService v2: використовується Supabase PostgreSQL');
    } else {
        writeoffQueries = require('../queries/sqlite/writeoffQueries');
        console.log('🔧 WriteoffService v2: використовується SQLite');
    }
    
    // Зберігаємо залежності
    OperationsLogController = dependencies.OperationsLogController;
};

/**
 * Сервіс для роботи зі списаннями (v2)
 * Підтримує обидві бази даних через universal query layer
 */
class WriteoffServiceV2 {
    constructor() {
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies = {}) {
        try {
            initializeQueries(dependencies);
            this.initialized = true;
            console.log('✅ WriteoffService v2 ініціалізовано успішно');
        } catch (error) {
            console.error('❌ Помилка ініціалізації WriteoffService v2:', error);
            throw new AppError('Не вдалося ініціалізувати WriteoffService v2', 500, 'SERVICE_INIT_ERROR');
        }
    }

    /**
     * Перевірка ініціалізації
     */
    _ensureInitialized() {
        if (!this.initialized || !writeoffQueries) {
            throw new AppError('WriteoffService v2 не ініціалізовано', 500, 'SERVICE_NOT_INITIALIZED');
        }
    }

    /**
     * Отримати всі списання з опціональною фільтрацією
     */
    async getAllWriteoffs(filters = {}) {
        this._ensureInitialized();
        
        try {
            const writeoffs = await writeoffQueries.getAll();

            // Застосовуємо фільтри на рівні сервісу
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
            const stats = this._calculateStats(filteredWriteoffs);

            return {
                writeoffs: filteredWriteoffs,
                stats,
                count: filteredWriteoffs.length,
                meta: {
                    total: filteredWriteoffs.length,
                    totalQuantity: stats.total_quantity,
                    uniqueProducts: stats.unique_products,
                    dateRange: stats.date_range,
                    filters: Object.keys(filters).length > 0 ? filters : null
                }
            };
        } catch (error) {
            console.error('Помилка отримання списань:', error);
            throw new AppError(
                'Не вдалося отримати дані списань', 
                500, 
                'WRITEOFFS_FETCH_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Отримати списання за ID товару
     */
    async getWriteoffsByProductId(productId) {
        this._ensureInitialized();
        
        if (!productId || isNaN(productId)) {
            throw new AppError('Некоректний ID товару', 400, 'INVALID_PRODUCT_ID');
        }
        
        try {
            const writeoffs = await writeoffQueries.getByProductId(productId);
            
            // Додаємо статистики для цього товару
            const stats = this._calculateStats(writeoffs);
            
            // Беремо інформацію про товар з першого запису (якщо є)
            const productInfo = writeoffs.length > 0 ? {
                id: writeoffs[0].product_id,
                name: writeoffs[0].product_name,
                code: writeoffs[0].product_code,
                currentStock: writeoffs[0].product_stock_pieces || 0
            } : null;

            return {
                writeoffs,
                product: productInfo,
                stats,
                count: writeoffs.length,
                product_id: parseInt(productId),
                meta: {
                    total: writeoffs.length,
                    totalQuantity: stats.total_quantity,
                    productName: productInfo?.name,
                    productCode: productInfo?.code
                }
            };
        } catch (error) {
            console.error('Помилка отримання списань по товару:', error);
            throw new AppError(
                'Не вдалося отримати дані списань для товару', 
                500, 
                'WRITEOFFS_BY_PRODUCT_ERROR',
                { originalError: error.message, product_id: productId }
            );
        }
    }

    /**
     * Створити новий запис списання
     */
    async createWriteoff(writeoffData, auditInfo = {}) {
        this._ensureInitialized();
        
        try {
            // Валідуємо обов'язкові поля
            if (!writeoffData.product_id || !writeoffData.writeoff_date || !writeoffData.total_quantity) {
                throw new AppError('Відсутні обов\'язкові поля', 400, 'MISSING_REQUIRED_FIELDS');
            }

            if (!writeoffData.reason || !writeoffData.responsible) {
                throw new AppError('Причина та відповідальна особа обов\'язкові', 400, 'MISSING_REQUIRED_FIELDS');
            }

            // Створюємо запис списання
            const result = await writeoffQueries.create(writeoffData);
            
            // Логуємо операцію
            if (OperationsLogController) {
                await this._logWriteoffOperation(writeoffData, result, 'CREATE', auditInfo);
            }
            
            console.log(`✅ Списання створено: ID ${result.id}, товар ${writeoffData.product_id}, кількість ${writeoffData.total_quantity}`);
            
            return {
                success: true,
                writeoff: {
                    id: result.id,
                    product_id: writeoffData.product_id,
                    writeoff_date: writeoffData.writeoff_date,
                    total_quantity: writeoffData.total_quantity,
                    boxes_quantity: result.boxes_quantity,
                    pieces_quantity: result.pieces_quantity,
                    reason: writeoffData.reason,
                    responsible: writeoffData.responsible,
                    notes: writeoffData.notes || '',
                    stock_movement_id: result.stock_movement_id
                },
                message: 'Списання успішно створено'
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Помилка створення списання:', error);
            throw new AppError(
                'Не вдалося створити запис списання', 
                500, 
                'WRITEOFF_CREATE_ERROR',
                { originalError: error.message, writeoffData }
            );
        }
    }

    /**
     * Отримати статистики списань
     */
    async getWriteoffStatistics(startDate, endDate) {
        this._ensureInitialized();
        
        try {
            return await writeoffQueries.getStats(startDate, endDate);
        } catch (error) {
            console.error('Помилка отримання статистик списань:', error);
            throw new AppError(
                'Не вдалося отримати статистики списань', 
                500, 
                'WRITEOFF_STATS_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Отримати статистики списань за період (legacy method для сумісності)
     */
    async getWriteoffStatisticsByPeriod(period = 'month') {
        this._ensureInitialized();
        
        try {
            // Обчислюємо період для статистики
            const now = new Date();
            let periodStart;
            
            switch (period) {
                case 'week':
                    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'quarter':
                    periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    periodStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            const startDate = periodStart.toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            const stats = await this.getWriteoffStatistics(startDate, endDate);

            // Адаптуємо формат для legacy API
            return {
                period: {
                    name: period,
                    start: startDate,
                    end: endDate
                },
                summary: {
                    totalWriteoffs: stats.overview.total_records,
                    totalQuantity: stats.overview.total_quantity,
                    uniqueProducts: stats.overview.unique_products,
                    uniqueReasons: stats.by_reasons.length
                },
                reasonStats: stats.by_reasons.map(r => [r.reason, { count: r.records_count, quantity: r.total_quantity }]).slice(0, 10),
                responsibleStats: stats.by_responsible.map(r => [r.responsible, { count: r.records_count, quantity: r.total_quantity }]).slice(0, 10),
                productStats: stats.by_products.map(p => [`${p.product_name} (${p.product_code})`, { count: p.records_count, quantity: p.total_quantity, product_id: p.product_id }]).slice(0, 10)
            };
        } catch (error) {
            console.error('Помилка отримання статистик списань за періодом:', error);
            throw new AppError(
                'Не вдалося отримати статистики списань за періодом', 
                500, 
                'WRITEOFF_PERIOD_STATS_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Обчислити статистики списань
     */
    _calculateStats(writeoffs) {
        if (!writeoffs || writeoffs.length === 0) {
            return {
                total_records: 0,
                total_quantity: 0,
                unique_products: 0,
                date_range: null
            };
        }
        
        const totalQuantity = writeoffs.reduce((sum, w) => sum + (w.total_quantity || 0), 0);
        const uniqueProducts = new Set(writeoffs.map(w => w.product_id)).size;
        
        // Діапазон дат
        const dates = writeoffs.map(w => new Date(w.writeoff_date)).sort();
        const dateRange = dates.length > 0 ? {
            from: dates[0].toISOString().split('T')[0],
            to: dates[dates.length - 1].toISOString().split('T')[0]
        } : null;
        
        return {
            total_records: writeoffs.length,
            total_quantity: totalQuantity,
            unique_products: uniqueProducts,
            date_range: dateRange
        };
    }

    /**
     * Логування операції списання
     */
    async _logWriteoffOperation(writeoffData, result, operation, auditInfo = {}) {
        try {
            if (!OperationsLogController) return;
            
            const description = `${operation === 'CREATE' ? 'Створення списання' : 'Оновлення списання'}: товар ID ${writeoffData.product_id} - ${writeoffData.total_quantity} шт (причина: ${writeoffData.reason})`;
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.WRITEOFF || 'WRITEOFF',
                entity_type: 'writeoff',
                entity_id: result.id,
                old_data: null,
                new_data: {
                    product_id: writeoffData.product_id,
                    writeoff_date: writeoffData.writeoff_date,
                    total_quantity: writeoffData.total_quantity,
                    reason: writeoffData.reason,
                    responsible: writeoffData.responsible,
                    notes: writeoffData.notes || ''
                },
                description: description,
                user_name: writeoffData.responsible || auditInfo.user || 'Система',
                ip_address: auditInfo.ip_address || null,
                user_agent: auditInfo.user_agent || null
            });
            
            console.log(`📋 Операція списання залогована: ${description}`);
        } catch (error) {
            console.error('Помилка логування операції списання:', error);
            // Не викидаємо помилку, щоб не блокувати основну операцію
        }
    }
}

// Експортуємо singleton instance
const writeoffServiceV2 = new WriteoffServiceV2();
module.exports = writeoffServiceV2;