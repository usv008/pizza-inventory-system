// services/operationsLogService-v2.js - Універсальний сервіс для логування операцій

const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const config = require('../config/database');

/**
 * Сервіс для логування операцій в системі
 * Підтримує як SQLite так і Supabase
 */
class OperationsLogService {
    constructor() {
        this.useSupabase = config.USE_SUPABASE;
        this.adapter = new DatabaseAdapter(this.useSupabase);
        
        console.log(`📊 OperationsLogService: використовується ${this.useSupabase ? 'Supabase' : 'SQLite'}`);
        
        // Завантажуємо відповідні queries
        if (this.useSupabase) {
            this.queries = require('../queries/supabase/operationsLogQueries');
        } else {
            this.queries = require('../queries/sqlite/operationsLogQueries');
        }
    }

    // Типи операцій для логування
    static OPERATION_TYPES = {
        // Замовлення
        CREATE_ORDER: 'CREATE_ORDER',
        UPDATE_ORDER: 'UPDATE_ORDER',
        UPDATE_ORDER_STATUS: 'UPDATE_ORDER_STATUS',
        DELETE_ORDER: 'DELETE_ORDER',
        
        // Товари
        CREATE_PRODUCT: 'CREATE_PRODUCT',
        UPDATE_PRODUCT: 'UPDATE_PRODUCT',
        DELETE_PRODUCT: 'DELETE_PRODUCT',
        UPDATE_STOCK: 'UPDATE_STOCK',
        
        // Виробництво
        PRODUCTION: 'PRODUCTION',
        
        // Списання
        WRITEOFF: 'WRITEOFF',
        WRITEOFF_BATCH: 'WRITEOFF_BATCH',
        
        // Приход
        ARRIVAL: 'ARRIVAL',
        
        // Рухи товарів
        MOVEMENT_CREATE: 'MOVEMENT_CREATE',
        MOVEMENT_UPDATE: 'MOVEMENT_UPDATE',
        MOVEMENT_DELETE: 'MOVEMENT_DELETE',
        
        // Клієнти
        CREATE_CLIENT: 'CREATE_CLIENT',
        UPDATE_CLIENT: 'UPDATE_CLIENT',
        DELETE_CLIENT: 'DELETE_CLIENT',
        
        // Планування
        CREATE_PRODUCTION_PLAN: 'CREATE_PRODUCTION_PLAN',
        UPDATE_PRODUCTION_PLAN: 'UPDATE_PRODUCTION_PLAN',
        
        // Партії
        CREATE_BATCH: 'CREATE_BATCH',
        UPDATE_BATCH: 'UPDATE_BATCH',
        RESERVE_BATCH: 'RESERVE_BATCH'
    };

    /**
     * Основний метод логування операції
     */
    async logOperation({
        operation_type,
        operation_id = null,
        entity_type,
        entity_id,
        old_data = null,
        new_data = null,
        description,
        user_name,
        ip_address = null,
        user_agent = null
    }) {
        try {
            // Валідація обов'язкових полів
            if (!operation_type || !entity_type || !description || !user_name) {
                throw new Error('Обов\'язкові поля для логування: operation_type, entity_type, description, user_name');
            }

            const logId = await this.queries.logOperation({
                operation_type,
                operation_id,
                entity_type,
                entity_id,
                old_data,
                new_data,
                description,
                user_name,
                ip_address,
                user_agent
            });

            console.log(`✅ Операція ${operation_type} залогована (ID: ${logId})`);
            return logId;

        } catch (error) {
            console.error('Помилка в logOperation:', error);
            throw new Error(`Помилка логування операції: ${error.message}`);
        }
    }

    /**
     * Отримати логи з фільтрацією
     */
    async getLogs(filters = {}) {
        try {
            const logs = await this.queries.getLogs(filters);
            
            return {
                success: true,
                logs: logs,
                count: logs.length,
                filters: filters
            };
        } catch (error) {
            console.error('Помилка отримання логів:', error);
            throw new Error(`Помилка отримання логів: ${error.message}`);
        }
    }

    /**
     * Отримати статистику операцій
     */
    async getOperationsStats(periodDays = 30) {
        try {
            const stats = await this.queries.getOperationsStats(periodDays);
            
            return {
                success: true,
                statistics: stats
            };
        } catch (error) {
            console.error('Помилка отримання статистики операцій:', error);
            throw new Error(`Помилка отримання статистики: ${error.message}`);
        }
    }

    /**
     * Отримати операції по конкретній сутності
     */
    async getEntityOperations(entity_type, entity_id, limit = 50) {
        try {
            if (!entity_type || !entity_id) {
                throw new Error('Обов\'язкові параметри: entity_type, entity_id');
            }

            const operations = await this.queries.getEntityOperations(entity_type, entity_id, limit);
            
            return {
                success: true,
                operations: operations,
                entity_type: entity_type,
                entity_id: parseInt(entity_id),
                count: operations.length
            };
        } catch (error) {
            console.error('Помилка отримання операцій сутності:', error);
            throw new Error(`Помилка отримання операцій сутності: ${error.message}`);
        }
    }

    // Helpers для зручного логування специфічних операцій

    /**
     * Логування операції з замовленням
     */
    async logOrderOperation(operation_type, order, user_name, old_order = null, req = null) {
        const description = this.generateOrderDescription(operation_type, order, old_order);
        
        return this.logOperation({
            operation_type,
            operation_id: order.id,
            entity_type: 'order',
            entity_id: order.id,
            old_data: old_order,
            new_data: order,
            description,
            user_name,
            ip_address: req?.ip,
            user_agent: req?.get('User-Agent')
        });
    }

    /**
     * Логування операції з товаром
     */
    async logProductOperation(operation_type, product, user_name, old_product = null, req = null) {
        // Для операції видалення product може бути null, використовуємо old_product
        const targetProduct = product || old_product;
        if (!targetProduct) {
            throw new Error('Немає даних товару для логування');
        }
        
        const description = this.generateProductDescription(operation_type, targetProduct, old_product);
        
        return this.logOperation({
            operation_type,
            operation_id: targetProduct.id,
            entity_type: 'product',
            entity_id: targetProduct.id,
            old_data: old_product,
            new_data: product,
            description,
            user_name,
            ip_address: req?.ip,
            user_agent: req?.get('User-Agent')
        });
    }

    /**
     * Логування операції з клієнтом
     */
    async logClientOperation(operation_type, client, user_name, old_client = null, req = null) {
        const targetClient = client || old_client;
        if (!targetClient) {
            throw new Error('Немає даних клієнта для логування');
        }
        
        const description = this.generateClientDescription(operation_type, targetClient, old_client);
        
        return this.logOperation({
            operation_type,
            operation_id: targetClient.id,
            entity_type: 'client',
            entity_id: targetClient.id,
            old_data: old_client,
            new_data: client,
            description,
            user_name,
            ip_address: req?.ip,
            user_agent: req?.get('User-Agent')
        });
    }

    /**
     * Логування операції з партією
     */
    async logBatchOperation(operation_type, batch, user_name, old_batch = null, req = null) {
        const targetBatch = batch || old_batch;
        if (!targetBatch) {
            throw new Error('Немає даних партії для логування');
        }
        
        const description = this.generateBatchDescription(operation_type, targetBatch, old_batch);
        
        return this.logOperation({
            operation_type,
            operation_id: targetBatch.id,
            entity_type: 'batch',
            entity_id: targetBatch.id,
            old_data: old_batch,
            new_data: batch,
            description,
            user_name,
            ip_address: req?.ip,
            user_agent: req?.get('User-Agent')
        });
    }

    // Генератори описів операцій

    /**
     * Генерація описів для операцій з замовленнями
     */
    generateOrderDescription(operation_type, order, old_order = null) {
        switch (operation_type) {
            case OperationsLogService.OPERATION_TYPES.CREATE_ORDER:
                return `Створено замовлення №${order.order_number} для клієнта "${order.client_name}" на суму ${order.total_quantity} шт`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_ORDER:
                const changes = [];
                if (old_order && old_order.client_name !== order.client_name) {
                    changes.push(`клієнт: "${old_order.client_name}" → "${order.client_name}"`);
                }
                if (old_order && old_order.delivery_date !== order.delivery_date) {
                    changes.push(`дата доставки: ${old_order.delivery_date || 'не вказана'} → ${order.delivery_date || 'не вказана'}`);
                }
                return `Оновлено замовлення №${order.order_number}: ${changes.join(', ') || 'загальні зміни'}`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_ORDER_STATUS:
                return `Змінено статус замовлення №${order.order_number}: ${old_order?.status || 'невідомий'} → ${order.status}`;
            
            case OperationsLogService.OPERATION_TYPES.DELETE_ORDER:
                return `Видалено замовлення №${order.order_number}`;
            
            default:
                return `Операція ${operation_type} з замовленням №${order.order_number}`;
        }
    }

    /**
     * Генерація описів для операцій з товарами
     */
    generateProductDescription(operation_type, product, old_product = null) {
        switch (operation_type) {
            case OperationsLogService.OPERATION_TYPES.CREATE_PRODUCT:
                return `Створено товар "${product.name}" (${product.code})`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_PRODUCT:
                return `Оновлено товар "${product.name}" (${product.code})`;
            
            case OperationsLogService.OPERATION_TYPES.DELETE_PRODUCT:
                return `Видалено товар "${product.name}" (${product.code})`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_STOCK:
                const diff = product.stock_pieces - (old_product?.stock_pieces || 0);
                const action = diff > 0 ? 'додано' : 'вилучено';
                return `Залишки товару "${product.name}": ${action} ${Math.abs(diff)} шт`;
            
            default:
                return `Операція ${operation_type} з товаром "${product.name}" (${product.code})`;
        }
    }

    /**
     * Генерація описів для операцій з клієнтами
     */
    generateClientDescription(operation_type, client, old_client = null) {
        switch (operation_type) {
            case OperationsLogService.OPERATION_TYPES.CREATE_CLIENT:
                return `Створено клієнта "${client.name}"`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_CLIENT:
                return `Оновлено інформацію клієнта "${client.name}"`;
            
            case OperationsLogService.OPERATION_TYPES.DELETE_CLIENT:
                return `Видалено клієнта "${client.name}"`;
            
            default:
                return `Операція ${operation_type} з клієнтом "${client.name}"`;
        }
    }

    /**
     * Генерація описів для операцій з партіями
     */
    generateBatchDescription(operation_type, batch, old_batch = null) {
        switch (operation_type) {
            case OperationsLogService.OPERATION_TYPES.CREATE_BATCH:
                return `Створено партію товару: ${batch.total_quantity} шт (дата: ${batch.batch_date})`;
            
            case OperationsLogService.OPERATION_TYPES.UPDATE_BATCH:
                return `Оновлено партію товару (ID: ${batch.id})`;
            
            case OperationsLogService.OPERATION_TYPES.RESERVE_BATCH:
                const reserved = batch.reserved_quantity - (old_batch?.reserved_quantity || 0);
                return `Зарезервовано ${reserved} шт з партії (ID: ${batch.id})`;
            
            default:
                return `Операція ${operation_type} з партією (ID: ${batch.id})`;
        }
    }
}

module.exports = new OperationsLogService();