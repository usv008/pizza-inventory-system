const AppError = require('../middleware/errors/AppError');

/**
 * Сервіс для роботи з виробництвом
 * Реалізує hybrid functional approach з централізованими helpers
 */
class ProductionService {
    constructor() {
        this.productionQueries = null;
        this.productQueries = null;
        this.OperationsLogController = null;
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        const { productionQueries, productQueries, OperationsLogController } = dependencies;
        
        if (!productionQueries) {
            throw new Error('productionQueries є обов\'язковою залежністю');
        }
        
        this.productionQueries = productionQueries;
        this.productQueries = productQueries;
        this.OperationsLogController = OperationsLogController;
        this.initialized = true;
        
        console.log('✅ ProductionService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _ensureInitialized() {
        if (!this.initialized) {
            throw new AppError('ProductionService не ініціалізовано', 500, 'SERVICE_NOT_INITIALIZED');
        }
    }

    /**
     * Отримати всі записи виробництва
     */
    async getAllProduction(filters = {}) {
        this._ensureInitialized();
        
        try {
            const production = await this.productionQueries.getAll();
            
            // Можемо додати фільтрацію якщо потрібно
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
            // Перевіряємо чи існує товар
            if (this.productQueries) {
                const product = await this.productQueries.getById(productId);
                if (!product) {
                    throw new AppError('Товар не знайдено', 404, 'PRODUCT_NOT_FOUND');
                }
            }
            
            const production = await this.productionQueries.getByProductId(productId);
            
            // Додаємо статистики для цього товару
            const stats = this._calculateProductionStats(production);
            
            return {
                production,
                stats,
                count: production.length,
                product_id: parseInt(productId)
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
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
    async createProduction(productionData, req = null) {
        this._ensureInitialized();
        
        try {
            // Валідуємо чи існує товар
            if (this.productQueries) {
                const product = await this.productQueries.getById(productionData.product_id);
                if (!product) {
                    throw new AppError('Товар не знайдено', 404, 'PRODUCT_NOT_FOUND');
                }
            }
            
            // Перевіряємо чи не дублюється виробництво в той же день
            const existingProduction = await this.productionQueries.getByProductId(productionData.product_id);
            const duplicateCheck = existingProduction.find(p => 
                p.production_date === productionData.production_date &&
                p.product_id === productionData.product_id
            );
            
            if (duplicateCheck) {
                console.warn(`⚠️ Виявлено дублікат виробництва для товару ${productionData.product_id} на дату ${productionData.production_date}`);
                // Не блокуємо, але логуємо попередження
            }
            
            // Створюємо запис виробництва
            const result = await this.productionQueries.create(productionData);
            
            // Логуємо операцію з user context
            if (req && req.logOperation) {
                await req.logOperation(
                    'PRODUCTION_CREATE',
                    {
                        product_id: productionData.product_id,
                        total_quantity: productionData.total_quantity,
                        production_date: productionData.production_date,
                        batch_created: result.batch_created || false
                    },
                    'PRODUCTION',
                    result.id
                );
            } else if (this.OperationsLogController) {
                // Fallback для прямих викликів без req
                await this.OperationsLogController.logProductOperation(
                    productionData.product_id,
                    'PRODUCTION_CREATE',
                    productionData.total_quantity,
                    { production_date: productionData.production_date }
                );
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
    async _logProductionOperation(productionData, result, operation, req = null) {
        try {
            if (!this.OperationsLogController) return;
            
            const product = this.productQueries ? 
                await this.productQueries.getById(productionData.product_id) : 
                { name: 'Невідомий товар', id: productionData.product_id };
            
            const description = `${operation === 'CREATE' ? 'Створення виробництва' : 'Оновлення виробництва'}: ${product.name || 'Товар'} - ${productionData.total_quantity} шт (дата виробництва: ${productionData.production_date})`;
            
            await this.OperationsLogController.logOperation({
                operation_type: this.OperationsLogController.OPERATION_TYPES.PRODUCTION,
                entity_type: 'production',
                entity_id: result.id,
                old_data: null,
                new_data: {
                    product_id: productionData.product_id,
                    product_name: product.name,
                    production_date: productionData.production_date,
                    total_quantity: productionData.total_quantity,
                    responsible: productionData.responsible || 'Система'
                },
                description: description,
                user_name: productionData.responsible || 'Система',
                ip_address: req ? req.ip : null,
                user_agent: req ? req.get('User-Agent') : null
            });
            
            console.log(`📋 Операція виробництва залогована: ${description}`);
        } catch (error) {
            console.error('Помилка логування операції виробництва:', error);
            // Не викидаємо помилку, щоб не блокувати основну операцію
        }
    }

    /**
     * Отримати статистики виробництва за період
     */
    async getProductionStatistics(startDate, endDate) {
        this._ensureInitialized();
        
        try {
            const filters = {};
            if (startDate) filters.start_date = startDate;
            if (endDate) filters.end_date = endDate;
            
            const { production } = await this.getAllProduction(filters);
            
            // Розширені статистики
            const stats = this._calculateProductionStats(production);
            
            // Статистики по товарах
            const productStats = {};
            production.forEach(p => {
                if (!productStats[p.product_id]) {
                    productStats[p.product_id] = {
                        product_id: p.product_id,
                        product_name: p.product_name,
                        total_quantity: 0,
                        records_count: 0,
                        batches: new Set()
                    };
                }
                
                productStats[p.product_id].total_quantity += p.total_quantity;
                productStats[p.product_id].records_count += 1;
                productStats[p.product_id].batches.add(p.production_date);
            });
            
            // Конвертуємо Set в count
            Object.values(productStats).forEach(stat => {
                stat.batches_count = stat.batches.size;
                delete stat.batches;
            });
            
            return {
                overview: stats,
                by_products: Object.values(productStats),
                period: { start: startDate, end: endDate }
            };
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
}

// Експортуємо singleton instance
const productionService = new ProductionService();
module.exports = productionService; 