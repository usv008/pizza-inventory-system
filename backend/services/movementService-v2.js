/**
 * Movement Service v2
 * Універсальний сервіс для роботи з рухами товарів (stock_movements)
 * Підтримує як SQLite, так і Supabase PostgreSQL
 */

const DatabaseAdapter = require('../adapters/DatabaseAdapter');

// Завантажуємо queries в залежності від типу БД
let movementQueries, productQueries;

const initializeQueries = (dependencies = {}) => {
    const useSupabase = process.env.USE_SUPABASE === 'true';
    
    if (useSupabase) {
        movementQueries = require('../queries/supabase/movementQueries');
        productQueries = require('../queries/supabase/productQueries');
    } else {
        // Для SQLite використовуємо спеціальні SQLite queries
        console.log('⚠️ SQLite mode: використовується SQLite queries');
        movementQueries = require('../queries/sqlite/movementQueries');
        productQueries = require('../queries/supabase/productQueries'); // адаптований для SQLite
    }
};

let OperationsLogController;

const MovementServiceV2 = {
    // Ініціалізація сервісу з залежностями
    initialize(dependencies) {
        initializeQueries(dependencies);
        
        OperationsLogController = dependencies.OperationsLogController;
        console.log('✅ MovementService v2 ініціалізовано з підтримкою', 
            process.env.USE_SUPABASE === 'true' ? 'Supabase' : 'SQLite');
    },

    // Отримання всіх рухів з фільтрацією
    async getAllMovements(filters = {}) {
        try {
            if (!movementQueries) {
                initializeQueries({});
            }

            // Підготовка фільтрів для запиту
            const queryFilters = {};
            
            if (filters.product_id) {
                queryFilters.product_id = parseInt(filters.product_id);
            }
            
            if (filters.movement_type && filters.movement_type !== 'ALL') {
                queryFilters.movement_type = filters.movement_type;
            }
            
            if (filters.date_from) {
                queryFilters.date_from = filters.date_from;
            }
            
            if (filters.date_to) {
                queryFilters.date_to = filters.date_to;
            }
            
            if (filters.user) {
                queryFilters.user = filters.user;
            }

            // Встановлюємо ліміт та offset
            const limit = filters.limit ? parseInt(filters.limit) : 200;
            const offset = filters.offset ? parseInt(filters.offset) : 0;
            
            queryFilters.limit = limit;
            queryFilters.offset = offset;

            // Використовуємо універсальні queries для обох БД
            const movements = await movementQueries.getAll(queryFilters);
            
            return {
                success: true,
                data: movements,
                pagination: {
                    limit,
                    offset,
                    count: movements.length
                },
                filters: filters
            };
        } catch (error) {
            console.error('[MovementServiceV2.getAllMovements] Помилка:', error);
            throw error;
        }
    },

    // Створення нового руху товару
    async createMovement(movementData, requestInfo = {}) {
        try {
            if (!movementQueries || !productQueries) {
                initializeQueries();
            }

            const { product_id, movement_type, pieces, boxes, reason, user = 'system', batch_id, batch_date } = movementData;

            // Перевіряємо чи існує товар
            const product = await productQueries.getById(product_id);
            
            if (!product) {
                throw new Error(`Товар з ID ${product_id} не знайдено`);
            }

            // Для OUT рухів перевіряємо наявність товару
            if (movement_type === 'OUT' || movement_type === 'WRITEOFF') {
                if (product.stock_pieces < pieces) {
                    throw new Error(`Недостатньо товару на складі. Наявно: ${product.stock_pieces}, потрібно: ${pieces}`);
                }
            }

            // Створюємо рух в базі
            const movementId = await movementQueries.create({
                product_id,
                movement_type,
                pieces,
                boxes,
                reason,
                user,
                batch_id,
                batch_date
            });

            // Оновлюємо залишки товару
            await movementQueries.updateProductStock(product_id, movement_type, pieces);

            // Отримуємо створений рух для відповіді
            const newMovement = await this._getMovementById(movementId);

            // Логуємо операцію
            await this._logMovementOperation('CREATE', newMovement, requestInfo);

            return {
                success: true,
                data: newMovement,
                message: `Рух товару створено успішно`
            };
        } catch (error) {
            console.error('[MovementServiceV2.createMovement] Помилка:', error);
            throw error;
        }
    },

    // Оновлення руху (обмежене - тільки reason та user)
    async updateMovement(id, updateData, requestInfo = {}) {
        try {
            if (!movementQueries) {
                initializeQueries({});
            }

            // Отримуємо поточний рух
            const currentMovement = await this._getMovementById(id);
            if (!currentMovement) {
                throw new Error(`Рух з ID ${id} не знайдено`);
            }

            // Оновлюємо рух
            await movementQueries.update(id, updateData);

            // Отримуємо оновлений рух
            const updatedMovement = await this._getMovementById(id);

            // Логуємо операцію
            await this._logMovementOperation('UPDATE', updatedMovement, requestInfo, currentMovement);

            return {
                success: true,
                data: updatedMovement,
                message: 'Рух товару оновлено успішно'
            };
        } catch (error) {
            console.error('[MovementServiceV2.updateMovement] Помилка:', error);
            throw error;
        }
    },

    // Отримання рухів для конкретного товару
    async getMovementsByProduct(productId, filters = {}) {
        try {
            if (!productQueries) {
                initializeQueries();
            }

            // Перевіряємо чи існує товар
            const product = await productQueries.getById(productId);
            if (!product) {
                throw new Error(`Товар з ID ${productId} не знайдено`);
            }

            // Додаємо product_id до фільтрів
            const productFilters = { ...filters, product_id: productId };
            
            return await this.getAllMovements(productFilters);
        } catch (error) {
            console.error('[MovementServiceV2.getMovementsByProduct] Помилка:', error);
            throw error;
        }
    },

    // Статистика рухів товарів
    async getMovementStatistics(options = {}) {
        try {
            if (!movementQueries) {
                initializeQueries({});
            }

            // Отримуємо статистику
            const stats = await movementQueries.getStatistics(options);

            return {
                success: true,
                data: stats,
                options: options
            };
        } catch (error) {
            console.error('[MovementServiceV2.getMovementStatistics] Помилка:', error);
            throw error;
        }
    },

    // Видалення руху (обережно - змінює залишки!)
    async deleteMovement(id, requestInfo = {}) {
        try {
            if (!movementQueries) {
                initializeQueries({});
            }

            // Отримуємо рух для логування та перерахунку залишків
            const movement = await this._getMovementById(id);
            if (!movement) {
                throw new Error(`Рух з ID ${id} не знайдено`);
            }

            // Видаляємо рух
            await movementQueries.delete(id);

            // Відновлюємо залишки (обернена операція)
            const reverseType = movement.movement_type === 'IN' ? 'OUT' : 'IN';
            await movementQueries.updateProductStock(movement.product_id, reverseType, movement.pieces);

            // Логуємо операцію
            await this._logMovementOperation('DELETE', movement, requestInfo);

            return {
                success: true,
                message: 'Рух товару видалено успішно'
            };
        } catch (error) {
            console.error('[MovementServiceV2.deleteMovement] Помилка:', error);
            throw error;
        }
    },

    // Допоміжні приватні методи
    async _getMovementById(id) {
        return await movementQueries.getById(id);
    },

    async _logMovementOperation(operation, movementData, requestInfo, oldData = null) {
        try {
            if (!OperationsLogController) {
                console.warn('OperationsLogController недоступний для логування');
                return;
            }

            const description = this._getOperationDescription(operation, movementData);
            
            await OperationsLogController.logOperation({
                operation_type: operation === 'CREATE' 
                    ? OperationsLogController.OPERATION_TYPES.MOVEMENT_CREATE
                    : operation === 'UPDATE' 
                    ? OperationsLogController.OPERATION_TYPES.MOVEMENT_UPDATE
                    : OperationsLogController.OPERATION_TYPES.MOVEMENT_DELETE,
                operation_id: movementData.id,
                entity_type: 'movement',
                entity_id: movementData.id,
                old_data: oldData,
                new_data: movementData,
                description: description,
                user_name: requestInfo.user || movementData.user || 'system',
                ip_address: requestInfo.ip || null,
                user_agent: requestInfo.userAgent || null
            });
            
            console.log(`✅ Логування руху ${movementData.id} (${operation}) успішне`);
        } catch (error) {
            console.error('❌ Помилка логування руху:', error);
            // Не блокуємо основну операцію через помилку логування
        }
    },

    _getOperationDescription(operation, movementData) {
        const typeNames = {
            'IN': 'Прихід',
            'OUT': 'Видача',
            'TRANSFER': 'Переміщення',
            'CORRECTION': 'Корекція',
            'WRITEOFF': 'Списання',
            'PRODUCTION': 'Виробництво'
        };
        
        const typeName = typeNames[movementData.movement_type] || movementData.movement_type;
        
        switch (operation) {
            case 'CREATE':
                return `Створено рух: ${typeName} ${movementData.pieces} шт товару "${movementData.product_name}" - ${movementData.reason}`;
            case 'UPDATE':
                return `Оновлено рух: ${typeName} товару "${movementData.product_name}"`;
            case 'DELETE':
                return `Видалено рух: ${typeName} ${movementData.pieces} шт товару "${movementData.product_name}"`;
            default:
                return `Операція з рухом товару "${movementData.product_name}"`;
        }
    }
};

module.exports = MovementServiceV2;