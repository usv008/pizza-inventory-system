/**
 * Production Service v2 - Універсальний сервіс для роботи з виробництвом
 * Підтримує SQLite та Supabase PostgreSQL через DatabaseAdapter
 */

const { AppError } = require('../middleware/errors/AppError');

// Глобальні змінні для query адаптерів
let productionQueries = null;
let OperationsLogController = null;

// Ініціалізація query адаптера на основі USE_SUPABASE
const initializeQueries = (dependencies = {}) => {
    const useSupabase = process.env.USE_SUPABASE === 'true';
    
    if (useSupabase) {
        productionQueries = require('../queries/supabase/productionQueries');
        console.log('🔧 ProductionService v2: використовується Supabase PostgreSQL');
    } else {
        productionQueries = require('../queries/sqlite/productionQueries');
        console.log('🔧 ProductionService v2: використовується SQLite');
    }
    
    // Зберігаємо залежності
    OperationsLogController = dependencies.OperationsLogController;
};

/**
 * Сервіс для роботи з виробництвом (v2)
 * Підтримує обидві бази даних через universal query layer
 */
class ProductionServiceV2 {
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
            console.log('✅ ProductionService v2 ініціалізовано успішно');
        } catch (error) {
            console.error('❌ Помилка ініціалізації ProductionService v2:', error);
            throw new AppError('Не вдалося ініціалізувати ProductionService v2', 500, 'SERVICE_INIT_ERROR');
        }
    }

    /**
     * Перевірка ініціалізації
     */
    _ensureInitialized() {
        if (!this.initialized || !productionQueries) {
            throw new AppError('ProductionService v2 не ініціалізовано', 500, 'SERVICE_NOT_INITIALIZED');
        }
    }

    /**
     * Отримати всі записи виробництва з фільтрацією
     */
    async getAllProduction(filters = {}) {
        this._ensureInitialized();
        
        try {
            const production = await productionQueries.getAll();
            
            // Застосовуємо фільтри
            let filteredProduction = production;
            
            if (filters.start_date) {
                filteredProduction = filteredProduction.filter(p => 
                    p.production_date >= filters.start_date
                );
            }
            
            if (filters.end_date) {
                filteredProduction = filteredProduction.filter(p => 
                    p.production_date <= filters.end_date
                );
            }
            
            if (filters.product_id) {
                filteredProduction = filteredProduction.filter(p => 
                    p.product_id === parseInt(filters.product_id)
                );
            }
            
            // Додаємо статистики
            const stats = this._calculateProductionStats(filteredProduction);
            
            return {
                production: filteredProduction,
                stats,
                count: filteredProduction.length
            };
        } catch (error) {
            console.error('Помилка отримання виробництва:', error);
            throw new AppError(
                'Не вдалося отримати дані виробництва', 
                500, 
                'PRODUCTION_FETCH_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Отримати виробництво по ID товару
     */
    async getProductionByProductId(productId) {
        this._ensureInitialized();
        
        if (!productId || isNaN(productId)) {
            throw new AppError('Некоректний ID товару', 400, 'INVALID_PRODUCT_ID');
        }
        
        try {
            const production = await productionQueries.getByProductId(productId);
            
            // Додаємо статистики для цього товару
            const stats = this._calculateProductionStats(production);
            
            return {
                production,
                stats,
                count: production.length,
                product_id: parseInt(productId)
            };
        } catch (error) {
            console.error('Помилка отримання виробництва по товару:', error);
            throw new AppError(
                'Не вдалося отримати дані виробництва для товару', 
                500, 
                'PRODUCTION_BY_PRODUCT_ERROR',
                { originalError: error.message, product_id: productId }
            );
        }
    }

    /**
     * Створити новий запис виробництва
     */
    async createProduction(productionData, auditInfo = {}) {
        this._ensureInitialized();
        
        try {
            // Валідуємо обов'язкові поля
            if (!productionData.product_id || !productionData.production_date || !productionData.total_quantity) {
                throw new AppError('Відсутні обов\'язкові поля', 400, 'MISSING_REQUIRED_FIELDS');
            }

            // Створюємо запис виробництва з партією
            const result = await productionQueries.create(productionData);
            
            // Логуємо операцію
            if (OperationsLogController) {
                await this._logProductionOperation(productionData, result, 'CREATE', auditInfo);
            }
            
            console.log(`✅ Виробництво створено: ID ${result.id}, товар ${productionData.product_id}, кількість ${productionData.total_quantity}`);
            
            return {
                success: true,
                production: result,
                message: 'Виробництво успішно створено'
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Помилка створення виробництва:', error);
            throw new AppError(
                'Не вдалося створити запис виробництва', 
                500, 
                'PRODUCTION_CREATE_ERROR',
                { originalError: error.message, productionData }
            );
        }
    }

    /**
     * Отримати статистики виробництва за період
     */
    async getProductionStatistics(startDate, endDate) {
        this._ensureInitialized();
        
        try {
            return await productionQueries.getStats(startDate, endDate);
        } catch (error) {
            console.error('Помилка отримання статистик виробництва:', error);
            throw new AppError(
                'Не вдалося отримати статистики виробництва', 
                500, 
                'PRODUCTION_STATS_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Отримати доступні партії для товару
     */
    async getAvailableBatches(productId) {
        this._ensureInitialized();
        
        if (!productId || isNaN(productId)) {
            throw new AppError('Некоректний ID товару', 400, 'INVALID_PRODUCT_ID');
        }
        
        try {
            return await productionQueries.getAvailableBatches(productId);
        } catch (error) {
            console.error('Помилка отримання партій:', error);
            throw new AppError(
                'Не вдалося отримати доступні партії', 
                500, 
                'BATCHES_FETCH_ERROR',
                { originalError: error.message, product_id: productId }
            );
        }
    }

    /**
     * Резервувати партії для товару (FIFO логіка)
     */
    async reserveBatchesForProduct(productId, quantityNeeded, auditInfo = {}) {
        this._ensureInitialized();
        
        if (!productId || isNaN(productId)) {
            throw new AppError('Некоректний ID товару', 400, 'INVALID_PRODUCT_ID');
        }

        if (!quantityNeeded || quantityNeeded <= 0) {
            throw new AppError('Некоректна кількість для резервування', 400, 'INVALID_QUANTITY');
        }
        
        try {
            const result = await productionQueries.reserveBatches(
                productId, 
                quantityNeeded, 
                auditInfo.user || 'system'
            );
            
            // Логуємо резервування
            if (OperationsLogController) {
                await this._logBatchReservation(productId, quantityNeeded, result, auditInfo);
            }
            
            return result;
        } catch (error) {
            console.error('Помилка резервування партій:', error);
            throw new AppError(
                'Не вдалося зарезервувати партії', 
                500, 
                'BATCH_RESERVATION_ERROR',
                { originalError: error.message, product_id: productId, quantity: quantityNeeded }
            );
        }
    }

    /**
     * Обчислити статистики виробництва
     */
    _calculateProductionStats(production) {
        if (!production || production.length === 0) {
            return {
                total_records: 0,
                total_quantity: 0,
                total_batches: 0,
                avg_quantity_per_record: 0,
                date_range: null
            };
        }
        
        const totalQuantity = production.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
        const totalRecords = production.length;
        
        // Підрахунок унікальних партій
        const uniqueBatches = new Set(production.map(p => `${p.product_id}-${p.production_date}`));
        
        // Діапазон дат
        const dates = production.map(p => new Date(p.production_date)).sort();
        const dateRange = dates.length > 0 ? {
            start: dates[0].toISOString().split('T')[0],
            end: dates[dates.length - 1].toISOString().split('T')[0]
        } : null;
        
        return {
            total_records: totalRecords,
            total_quantity: totalQuantity,
            total_batches: uniqueBatches.size,
            avg_quantity_per_record: Math.round(totalQuantity / totalRecords),
            date_range: dateRange
        };
    }

    /**
     * Логування операції виробництва
     */
    async _logProductionOperation(productionData, result, operation, auditInfo = {}) {
        try {
            if (!OperationsLogController) return;
            
            const description = `${operation === 'CREATE' ? 'Створення виробництва' : 'Оновлення виробництва'}: товар ID ${productionData.product_id} - ${productionData.total_quantity} шт (дата виробництва: ${productionData.production_date})`;
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.PRODUCTION || 'PRODUCTION',
                entity_type: 'production',
                entity_id: result.id,
                old_data: null,
                new_data: {
                    product_id: productionData.product_id,
                    production_date: productionData.production_date,
                    total_quantity: productionData.total_quantity,
                    responsible: productionData.responsible || 'Система'
                },
                description: description,
                user_name: productionData.responsible || auditInfo.user || 'Система',
                ip_address: auditInfo.ip_address || null,
                user_agent: auditInfo.user_agent || null
            });
            
            console.log(`📋 Операція виробництва залогована: ${description}`);
        } catch (error) {
            console.error('Помилка логування операції виробництва:', error);
            // Не викидаємо помилку, щоб не блокувати основну операцію
        }
    }

    /**
     * Логування резервування партій
     */
    async _logBatchReservation(productId, quantity, result, auditInfo = {}) {
        try {
            if (!OperationsLogController) return;
            
            const description = `Резервування партій: товар ID ${productId} - ${quantity} шт в ${result.allocations?.length || 0} партіях`;
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.BATCH_RESERVATION || 'BATCH_RESERVATION',
                entity_type: 'production_batch',
                entity_id: productId,
                old_data: null,
                new_data: {
                    product_id: productId,
                    quantity_reserved: quantity,
                    batches_count: result.allocations?.length || 0,
                    allocations: result.allocations
                },
                description: description,
                user_name: auditInfo.user || 'Система',
                ip_address: auditInfo.ip_address || null,
                user_agent: auditInfo.user_agent || null
            });
            
            console.log(`📋 Резервування партій залоговано: ${description}`);
        } catch (error) {
            console.error('Помилка логування резервування партій:', error);
            // Не викидаємо помилку, щоб не блокувати основну операцію
        }
    }
}

// Експортуємо singleton instance
const productionServiceV2 = new ProductionServiceV2();
module.exports = productionServiceV2;