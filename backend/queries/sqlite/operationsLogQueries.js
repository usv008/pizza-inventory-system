// queries/sqlite/operationsLogQueries.js - SQLite запити для логування операцій (legacy)

const { db } = require('../../database');

/**
 * Клас для роботи з логами операцій в SQLite (legacy)
 */
class OperationsLogQueries {

    /**
     * Логувати операцію в систему
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
                    reject(new Error(`Помилка логування операції: ${err.message}`));
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Отримати логи з фільтрацією
     */
    async getLogs(filters = {}) {
        const {
            operation_type,
            entity_type,
            entity_id,
            user_name,
            date_from,
            date_to,
            limit = 200,
            offset = 0
        } = filters;

        return new Promise((resolve, reject) => {
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
                    reject(new Error(`Помилка отримання логів: ${err.message}`));
                    return;
                }

                // Парсимо JSON дані
                const processedRows = rows.map(row => ({
                    ...row,
                    old_data: row.old_data ? JSON.parse(row.old_data) : null,
                    new_data: row.new_data ? JSON.parse(row.new_data) : null
                }));

                resolve(processedRows);
            });
        });
    }

    /**
     * Отримати статистику операцій
     */
    async getOperationsStats(periodDays = 30) {
        return new Promise((resolve, reject) => {
            const statsQuery = `
                SELECT 
                    operation_type,
                    COUNT(*) as count,
                    DATE(created_at) as operation_date
                FROM operations_log 
                WHERE created_at >= datetime('now', '-${parseInt(periodDays)} days')
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
                WHERE created_at >= datetime('now', '-${parseInt(periodDays)} days')
                GROUP BY operation_type
                ORDER BY total_count DESC
            `;

            db.all(statsQuery, [], (err, statsRows) => {
                if (err) {
                    reject(new Error(`Помилка отримання статистики: ${err.message}`));
                    return;
                }

                db.all(summaryQuery, [], (err, summaryRows) => {
                    if (err) {
                        reject(new Error(`Помилка отримання підсумку: ${err.message}`));
                        return;
                    }

                    resolve({
                        period_days: periodDays,
                        daily_stats: statsRows,
                        summary: summaryRows,
                        total_operations: summaryRows.reduce((sum, row) => sum + row.total_count, 0)
                    });
                });
            });
        });
    }

    /**
     * Отримати операції по конкретній сутності
     */
    async getEntityOperations(entity_type, entity_id, limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM operations_log 
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            db.all(sql, [entity_type, parseInt(entity_id), limit], (err, rows) => {
                if (err) {
                    reject(new Error(`Помилка отримання операцій сутності: ${err.message}`));
                    return;
                }

                // Парсимо JSON дані
                const processedRows = rows.map(row => ({
                    ...row,
                    old_data: row.old_data ? JSON.parse(row.old_data) : null,
                    new_data: row.new_data ? JSON.parse(row.new_data) : null
                }));

                resolve(processedRows);
            });
        });
    }
}

module.exports = new OperationsLogQueries();