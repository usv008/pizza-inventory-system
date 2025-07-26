/**
 * Order Queries для SQLite
 * Адаптер для роботи з замовленнями в SQLite
 */

const { db } = require('../../database');

const OrderQueries = {
    /**
     * Отримати всі замовлення з фільтрацією
     */
    async getAll(filters = {}) {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const params = [];

            if (filters.status && filters.status !== 'ALL') {
                conditions.push('o.status = ?');
                params.push(filters.status);
            }

            if (filters.client_id) {
                conditions.push('o.client_id = ?');
                params.push(filters.client_id);
            }

            if (filters.date_from) {
                conditions.push('o.order_date >= ?');
                params.push(filters.date_from);
            }

            if (filters.date_to) {
                conditions.push('o.order_date <= ?');
                params.push(filters.date_to);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const sql = `
                SELECT o.*
                FROM orders o
                ${whereClause}
                ORDER BY o.order_date DESC, o.created_at DESC
                LIMIT ? OFFSET ?
            `;

            params.push(filters.limit || 50);
            params.push(filters.offset || 0);

            db.all(sql, params, async (err, orders) => {
                if (err) return reject(err);

                try {
                    // Додаємо позиції для кожного замовлення
                    const ordersWithItems = await Promise.all(
                        orders.map(async (order) => {
                            const items = await OrderQueries._getOrderItems(order.id);
                            return { ...order, order_items: items };
                        })
                    );

                    resolve(ordersWithItems);
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    /**
     * Отримати замовлення за ID
     */
    async getById(orderId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM orders WHERE id = ?
            `;

            db.get(sql, [orderId], async (err, order) => {
                if (err) return reject(err);
                if (!order) return resolve(null);

                try {
                    // Додаємо позиції замовлення
                    const items = await OrderQueries._getOrderItems(orderId);
                    order.order_items = items;
                    resolve(order);
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    /**
     * Створити замовлення
     */
    async create(orderData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO orders (
                    order_number, client_id, client_name, client_contact,
                    order_date, delivery_date, status, notes, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            db.run(sql, [
                orderData.order_number,
                orderData.client_id,
                orderData.client_name,
                orderData.client_contact,
                orderData.order_date,
                orderData.delivery_date,
                orderData.status || 'NEW',
                orderData.notes,
                orderData.created_by || 'system'
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    },

    /**
     * Оновити замовлення
     */
    async update(orderId, orderData) {
        return new Promise((resolve, reject) => {
            const updates = [];
            const params = [];

            const allowedFields = [
                'client_id', 'client_name', 'client_contact', 
                'order_date', 'delivery_date', 'status', 'notes'
            ];

            for (const field of allowedFields) {
                if (orderData[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(orderData[field]);
                }
            }

            if (updates.length === 0) {
                return reject(new Error('Немає полів для оновлення'));
            }

            params.push(orderId);

            const sql = `UPDATE orders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

            db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    /**
     * Видалити замовлення
     */
    async delete(orderId) {
        return new Promise((resolve, reject) => {
            // Спочатку видаляємо позиції
            db.run('DELETE FROM order_items WHERE order_id = ?', [orderId], (err) => {
                if (err) return reject(err);

                // Потім видаляємо замовлення
                db.run('DELETE FROM orders WHERE id = ?', [orderId], function(err) {
                    if (err) return reject(err);
                    resolve(true);
                });
            });
        });
    },

    /**
     * Створити позицію замовлення
     */
    async createItem(itemData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO order_items (
                    order_id, product_id, quantity, boxes, pieces,
                    reserved_quantity, produced_quantity, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            db.run(sql, [
                itemData.order_id,
                itemData.product_id,
                itemData.quantity,
                itemData.boxes,
                itemData.pieces,
                itemData.reserved_quantity || 0,
                itemData.produced_quantity || 0,
                itemData.notes
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    },

    /**
     * Оновити позицію замовлення
     */
    async updateItem(itemId, itemData) {
        return new Promise((resolve, reject) => {
            const updates = [];
            const params = [];

            const allowedFields = [
                'quantity', 'boxes', 'pieces', 'reserved_quantity', 
                'produced_quantity', 'notes'
            ];

            for (const field of allowedFields) {
                if (itemData[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(itemData[field]);
                }
            }

            if (updates.length === 0) {
                return reject(new Error('Немає полів для оновлення позиції'));
            }

            params.push(itemId);

            const sql = `UPDATE order_items SET ${updates.join(', ')} WHERE id = ?`;

            db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    /**
     * Видалити позицію замовлення
     */
    async deleteItem(itemId) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM order_items WHERE id = ?', [itemId], function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    /**
     * Видалити всі позиції замовлення
     */
    async deleteAllItems(orderId) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM order_items WHERE order_id = ?', [orderId], function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    /**
     * Оновити загальні підсумки замовлення
     */
    async updateTotals(orderId) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE orders 
                SET total_quantity = (
                    SELECT COALESCE(SUM(quantity), 0) 
                    FROM order_items WHERE order_id = ?
                ),
                total_boxes = (
                    SELECT COALESCE(SUM(boxes), 0) 
                    FROM order_items WHERE order_id = ?
                ),
                updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(sql, [orderId, orderId, orderId], function(err) {
                if (err) return reject(err);

                // Повертаємо нові значення
                db.get('SELECT total_quantity, total_boxes FROM orders WHERE id = ?', [orderId], (err, row) => {
                    if (err) return reject(err);
                    resolve({
                        totalQuantity: row?.total_quantity || 0,
                        totalBoxes: row?.total_boxes || 0
                    });
                });
            });
        });
    },

    /**
     * Статистика замовлень
     */
    async getStats(period = 'month') {
        return new Promise((resolve, reject) => {
            let dateCondition = '';
            const params = [];

            if (period === 'month') {
                dateCondition = `WHERE order_date >= date('now', 'start of month')`;
            } else if (period === 'week') {
                dateCondition = `WHERE order_date >= date('now', 'weekday 0', '-7 days')`;
            } else if (period === 'year') {
                dateCondition = `WHERE order_date >= date('now', 'start of year')`;
            }

            const sql = `
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'NEW' THEN 1 END) as new_orders,
                    COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_orders,
                    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
                    COALESCE(SUM(total_quantity), 0) as total_quantity,
                    COALESCE(SUM(total_boxes), 0) as total_boxes
                FROM orders
                ${dateCondition}
            `;

            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || {
                    total_orders: 0,
                    new_orders: 0,
                    in_progress_orders: 0,
                    completed_orders: 0,
                    total_quantity: 0,
                    total_boxes: 0
                });
            });
        });
    },

    /**
     * Отримати позиції замовлення (приватний метод)
     */
    async _getOrderItems(orderId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    oi.*,
                    p.name as product_name,
                    p.code as product_code,
                    p.weight,
                    p.pieces_per_box
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
                ORDER BY oi.id
            `;

            db.all(sql, [orderId], (err, items) => {
                if (err) return reject(err);
                
                // Адаптуємо структуру для сумісності з Supabase
                const adaptedItems = items.map(item => ({
                    ...item,
                    products: {
                        name: item.product_name,
                        code: item.product_code,
                        weight: item.weight,
                        pieces_per_box: item.pieces_per_box
                    }
                }));

                resolve(adaptedItems);
            });
        });
    }
};

module.exports = OrderQueries;