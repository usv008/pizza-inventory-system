// controllers/operations-log-controller.js - Контролер для логування операцій

const { db } = require('../supabase-database');

class OperationsLogController {

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

    // Логування операції
    static async logOperation({
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

            // Перетворюємо об'єкти в JSON
            const oldDataJson = old_data ? JSON.stringify(old_data) : null;
            const newDataJson = new_data ? JSON.stringify(new_data) : null;

            return new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO operations_log 
                    (operation_type, operation_id, entity_type, entity_id, old_data, new_data, 
                     description, user_name, ip_address, user_agent, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    operation_type,
                    operation_id,
                    entity_type,
                    entity_id,
                    oldDataJson,
                    newDataJson,
                    description,
                    user_name,
                    ip_address,
                    user_agent
                ], function(err) {
                    if (err) {
                        console.error('Помилка логування операції:', err);
                        reject(err);
                    } else {
                        console.log(`✅ Операція ${operation_type} залогована (ID: ${this.lastID})`);
                        resolve(this.lastID);
                    }
                });
            });
        } catch (error) {
            console.error('Помилка в logOperation:', error);
            throw error;
        }
    }

    // Отримання логів з фільтрами
    static async getLogs(req, res) {
        try {
            const {
                operation_type,
                entity_type,
                entity_id,
                user_name,
                date_from,
                date_to,
                limit = 200,
                offset = 0
            } = req.query;

            let sql = `
                SELECT 
                    ol.*,
                    CASE 
                        WHEN ol.entity_type = 'order' AND o.order_number IS NOT NULL 
                        THEN o.order_number
                        WHEN ol.entity_type = 'product' AND p.name IS NOT NULL 
                        THEN p.name || ' (' || p.code || ')'
                        WHEN ol.entity_type = 'client' AND c.name IS NOT NULL 
                        THEN c.name
                        ELSE CAST(ol.entity_id AS TEXT)
                    END as entity_display_name,
                    CASE 
                        WHEN ol.entity_type = 'order' THEN o.client_name
                        WHEN ol.entity_type = 'product' THEN p.code
                        WHEN ol.entity_type = 'client' THEN c.contact_person
                        ELSE NULL
                    END as additional_info
                FROM operations_log ol
                LEFT JOIN orders o ON ol.entity_type = 'order' AND ol.entity_id = o.id
                LEFT JOIN products p ON ol.entity_type = 'product' AND ol.entity_id = p.id
                LEFT JOIN clients c ON ol.entity_type = 'client' AND ol.entity_id = c.id
                WHERE 1=1
            `;

            const params = [];

            // Додаємо фільтри
            if (operation_type) {
                sql += ' AND ol.operation_type = ?';
                params.push(operation_type);
            }

            if (entity_type) {
                sql += ' AND ol.entity_type = ?';
                params.push(entity_type);
            }

            if (entity_id) {
                sql += ' AND ol.entity_id = ?';
                params.push(parseInt(entity_id));
            }

            if (user_name) {
                sql += ' AND ol.user_name LIKE ?';
                params.push(`%${user_name}%`);
            }

            if (date_from) {
                sql += ' AND date(ol.created_at) >= date(?)';
                params.push(date_from);
            }

            if (date_to) {
                sql += ' AND date(ol.created_at) <= date(?)';
                params.push(date_to);
            }

            sql += ' ORDER BY ol.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Помилка отримання логів:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }

                // Парсимо JSON дані
                const processedRows = rows.map(row => ({
                    ...row,
                    old_data: row.old_data ? JSON.parse(row.old_data) : null,
                    new_data: row.new_data ? JSON.parse(row.new_data) : null
                }));

                res.json(processedRows);
            });

        } catch (error) {
            console.error('Помилка в getLogs:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }

    // Отримання статистики операцій
    static async getOperationsStats(req, res) {
        try {
            const { period = 30 } = req.query; // дні

            const statsQuery = `
                SELECT 
                    operation_type,
                    COUNT(*) as count,
                    DATE(created_at) as operation_date
                FROM operations_log 
                WHERE created_at >= datetime('now', '-${parseInt(period)} days')
                GROUP BY operation_type, DATE(created_at)
                ORDER BY operation_date DESC, count DESC
            `;

            const summaryQuery = `
                SELECT 
                    operation_type,
                    COUNT(*) as total_count,
                    COUNT(DISTINCT user_name) as unique_users,
                    MAX(created_at) as last_operation
                FROM operations_log 
                WHERE created_at >= datetime('now', '-${parseInt(period)} days')
                GROUP BY operation_type
                ORDER BY total_count DESC
            `;

            db.all(statsQuery, [], (err, statsRows) => {
                if (err) {
                    console.error('Помилка отримання статистики:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }

                db.all(summaryQuery, [], (err, summaryRows) => {
                    if (err) {
                        console.error('Помилка отримання підсумку:', err);
                        return res.status(500).json({ error: 'Помилка сервера' });
                    }

                    res.json({
                        period_days: period,
                        daily_stats: statsRows,
                        summary: summaryRows,
                        total_operations: summaryRows.reduce((sum, row) => sum + row.total_count, 0)
                    });
                });
            });

        } catch (error) {
            console.error('Помилка в getOperationsStats:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }

    // Отримання операцій по конкретній сутності
    static async getEntityOperations(req, res) {
        try {
            const { entity_type, entity_id } = req.params;

            if (!entity_type || !entity_id) {
                return res.status(400).json({ error: 'Обов\'язкові параметри: entity_type, entity_id' });
            }

            const sql = `
                SELECT * FROM operations_log 
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `;

            db.all(sql, [entity_type, parseInt(entity_id)], (err, rows) => {
                if (err) {
                    console.error('Помилка отримання операцій сутності:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }

                // Парсимо JSON дані
                const processedRows = rows.map(row => ({
                    ...row,
                    old_data: row.old_data ? JSON.parse(row.old_data) : null,
                    new_data: row.new_data ? JSON.parse(row.new_data) : null
                }));

                res.json(processedRows);
            });

        } catch (error) {
            console.error('Помилка в getEntityOperations:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }

    // Helpers для зручного логування специфічних операцій

    // Логування операції з замовленням
    static async logOrderOperation(operation_type, order, user_name, old_order = null, req = null) {
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

    // Логування операції з товаром
    static async logProductOperation(operation_type, product, user_name, old_product = null, req = null) {
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

    // Генерація описів операцій
    static generateOrderDescription(operation_type, order, old_order = null) {
        switch (operation_type) {
            case this.OPERATION_TYPES.CREATE_ORDER:
                return `Створено замовлення №${order.order_number} для клієнта "${order.client_name}" на суму ${order.total_quantity} шт`;
            
            case this.OPERATION_TYPES.UPDATE_ORDER:
                const changes = [];
                if (old_order && old_order.client_name !== order.client_name) {
                    changes.push(`клієнт: "${old_order.client_name}" → "${order.client_name}"`);
                }
                if (old_order && old_order.delivery_date !== order.delivery_date) {
                    changes.push(`дата доставки: ${old_order.delivery_date || 'не вказана'} → ${order.delivery_date || 'не вказана'}`);
                }
                return `Оновлено замовлення №${order.order_number}: ${changes.join(', ') || 'загальні зміни'}`;
            
            case this.OPERATION_TYPES.UPDATE_ORDER_STATUS:
                return `Змінено статус замовлення №${order.order_number}: ${old_order?.status || 'невідомий'} → ${order.status}`;
            
            default:
                return `Операція ${operation_type} з замовленням №${order.order_number}`;
        }
    }

    static generateProductDescription(operation_type, product, old_product = null) {
        switch (operation_type) {
            case this.OPERATION_TYPES.CREATE_PRODUCT:
                return `Створено товар "${product.name}" (${product.code})`;
            
            case this.OPERATION_TYPES.UPDATE_PRODUCT:
                return `Оновлено товар "${product.name}" (${product.code})`;
            
            case this.OPERATION_TYPES.DELETE_PRODUCT:
                return `Видалено товар "${product.name}" (${product.code})`;
            
            case this.OPERATION_TYPES.UPDATE_STOCK:
                const diff = product.stock_pieces - (old_product?.stock_pieces || 0);
                const action = diff > 0 ? 'додано' : 'вилучено';
                return `Залишки товару "${product.name}": ${action} ${Math.abs(diff)} шт`;
            
            default:
                return `Операція ${operation_type} з товаром "${product.name}" (${product.code})`;
        }
    }
}

module.exports = OperationsLogController;