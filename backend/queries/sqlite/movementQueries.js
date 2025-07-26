/**
 * Movement Queries для SQLite
 * Простий адаптер для роботи з SQLite
 */

const { db } = require('../../database');

const MovementQueries = {
    // Отримання всіх рухів з фільтрацією та пагінацією
    async getAll(filters = {}) {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const params = [];
            
            if (filters.product_id) {
                conditions.push('sm.product_id = ?');
                params.push(filters.product_id);
            }
            
            if (filters.movement_type) {
                conditions.push('sm.movement_type = ?');
                params.push(filters.movement_type);
            }
            
            if (filters.date_from) {
                conditions.push('DATE(sm.created_at) >= ?');
                params.push(filters.date_from);
            }
            
            if (filters.date_to) {
                conditions.push('DATE(sm.created_at) <= ?');
                params.push(filters.date_to);
            }
            
            if (filters.user) {
                conditions.push('sm.user = ?');
                params.push(filters.user);
            }
            
            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            
            const sql = `
                SELECT 
                    sm.id,
                    sm.product_id,
                    sm.movement_type,
                    sm.pieces,
                    sm.boxes,
                    sm.reason,
                    sm.user,
                    '' as batch_id,
                    '' as batch_date,
                    sm.created_at,
                    p.name as product_name,
                    p.code as product_code
                FROM stock_movements sm
                JOIN products p ON sm.product_id = p.id
                ${whereClause}
                ORDER BY sm.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            params.push(filters.limit || 200);
            params.push(filters.offset || 0);
            
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    // Створення нового руху
    async create(data) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO stock_movements 
                (product_id, movement_type, pieces, boxes, reason, user, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            db.run(sql, [
                data.product_id,
                data.movement_type,
                data.pieces,
                data.boxes,
                data.reason,
                data.user
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    },

    // Отримання руху за ID
    async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    sm.id,
                    sm.product_id,
                    sm.movement_type,
                    sm.pieces,
                    sm.boxes,
                    sm.reason,
                    sm.user,
                    '' as batch_id,
                    '' as batch_date,
                    sm.created_at,
                    p.name as product_name,
                    p.code as product_code
                FROM stock_movements sm
                JOIN products p ON sm.product_id = p.id
                WHERE sm.id = ?
            `;
            
            db.get(sql, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    // Оновлення руху
    async update(id, data) {
        return new Promise((resolve, reject) => {
            const updates = [];
            const params = [];
            
            if (data.reason !== undefined) {
                updates.push('reason = ?');
                params.push(data.reason);
            }
            
            if (data.user !== undefined) {
                updates.push('user = ?');
                params.push(data.user);
            }
            
            if (updates.length === 0) {
                return reject(new Error('Немає полів для оновлення'));
            }
            
            const sql = `UPDATE stock_movements SET ${updates.join(', ')} WHERE id = ?`;
            params.push(id);
            
            db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    // Видалення руху
    async delete(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM stock_movements WHERE id = ?', [id], function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    },

    // Статистика рухів
    async getStatistics(options = {}) {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const params = [];
            
            if (options.product_id) {
                conditions.push('sm.product_id = ?');
                params.push(options.product_id);
            }
            
            if (options.start_date) {
                conditions.push('DATE(sm.created_at) >= ?');
                params.push(options.start_date);
            }
            
            if (options.end_date) {
                conditions.push('DATE(sm.created_at) <= ?');
                params.push(options.end_date);
            }
            
            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            
            const sql = `
                SELECT 
                    sm.movement_type,
                    COUNT(*) as count,
                    SUM(sm.pieces) as total_pieces,
                    SUM(sm.boxes) as total_boxes,
                    DATE(sm.created_at) as movement_date
                FROM stock_movements sm
                JOIN products p ON sm.product_id = p.id
                ${whereClause}
                GROUP BY sm.movement_type, DATE(sm.created_at)
                ORDER BY sm.created_at DESC
            `;
            
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    // Оновлення залишків товару
    async updateProductStock(productId, movementType, pieces) {
        return new Promise((resolve, reject) => {
            const operator = ['IN', 'PRODUCTION', 'CORRECTION'].includes(movementType) ? '+' : '-';
            
            const sql = `
                UPDATE products 
                SET stock_pieces = stock_pieces ${operator} ?, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(sql, [pieces, productId], function(err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }
};

module.exports = MovementQueries;