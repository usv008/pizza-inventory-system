// queries/sqlite/arrivalQueries.js - SQLite запити для роботи з приходами товарів (legacy)

const { db } = require('../../database');

/**
 * Клас для роботи з приходами товарів в SQLite (legacy)
 */
class ArrivalQueries {
    
    /**
     * Створити документ приходу з позиціями (SQLite транзакція)
     */
    async createArrival(arrivalData, items) {
        const { arrival_date, reason, created_by } = arrivalData;
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // 1. Генеруємо arrival_number
                db.get('SELECT COUNT(*) as count FROM arrivals WHERE arrival_date = ?', [arrival_date], (err, row) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(new Error(`Помилка підрахунку приходів: ${err.message}`));
                    }
                    
                    const count = row.count + 1;
                    const arrival_number = `${arrival_date.replace(/-/g, '')}-${String(count).padStart(3, '0')}`;
                    
                    // 2. Створюємо arrival
                    db.run(`INSERT INTO arrivals (arrival_number, arrival_date, reason, created_by, created_at, updated_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [arrival_number, arrival_date, reason, created_by || 'system'],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(new Error(`Помилка створення приходу: ${err.message}`));
                            }
                            
                            const arrival_id = this.lastID;
                            let completed = 0;
                            let hasError = false;
                            const createdItems = [];
                            
                            // 3. Створюємо позиції приходу
                            items.forEach(item => {
                                if (hasError) return;
                                
                                const { product_id, quantity, batch_date, notes } = item;
                                
                                if (!product_id || !quantity || !batch_date) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    return reject(new Error('Некоректна позиція приходу'));
                                }
                                
                                // Додаємо позицію в arrivals_items
                                db.run(`INSERT INTO arrivals_items (arrival_id, product_id, quantity, batch_date, notes, created_at)
                                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                    [arrival_id, product_id, quantity, batch_date, notes || ''],
                                    function(err) {
                                        if (err) {
                                            hasError = true;
                                            db.run('ROLLBACK');
                                            return reject(new Error(`Помилка створення позиції: ${err.message}`));
                                        }
                                        
                                        const item_id = this.lastID;
                                        createdItems.push({
                                            id: item_id,
                                            arrival_id,
                                            product_id,
                                            quantity,
                                            batch_date,
                                            notes: notes || ''
                                        });
                                        
                                        // Створюємо партію товару
                                        this.createProductionBatch(product_id, quantity, batch_date, arrival_id, notes, (batchErr) => {
                                            if (batchErr) {
                                                hasError = true;
                                                db.run('ROLLBACK');
                                                return reject(new Error(`Помилка створення партії: ${batchErr.message}`));
                                            }
                                            
                                            // Оновлюємо залишки товару
                                            this.updateProductStock(product_id, quantity, (stockErr) => {
                                                if (stockErr) {
                                                    hasError = true;
                                                    db.run('ROLLBACK');
                                                    return reject(new Error(`Помилка оновлення залишків: ${stockErr.message}`));
                                                }
                                                
                                                completed++;
                                                if (completed === items.length && !hasError) {
                                                    db.run('COMMIT');
                                                    
                                                    const result = {
                                                        arrival: {
                                                            id: arrival_id,
                                                            arrival_number,
                                                            arrival_date,
                                                            reason,
                                                            created_by: created_by || 'system',
                                                            items: createdItems
                                                        },
                                                        arrival_number,
                                                        total_items: createdItems.length,
                                                        total_quantity: createdItems.reduce((sum, item) => sum + item.quantity, 0)
                                                    };
                                                    
                                                    resolve(result);
                                                }
                                            });
                                        });
                                    }
                                );
                            });
                        }
                    );
                });
            });
        });
    }

    /**
     * Створити партію товару з приходу
     */
    createProductionBatch(productId, quantity, batchDate, arrivalId, notes, callback) {
        const expiryDate = this.calculateExpiryDate(batchDate);
        
        db.run(`INSERT INTO production_batches 
               (product_id, batch_date, production_date, total_quantity, available_quantity, 
                reserved_quantity, used_quantity, expiry_date, status, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [productId, batchDate, batchDate, quantity, quantity, expiryDate, 
             `Партія з приходу ${arrivalId}: ${notes || ''}`],
            callback
        );
    }

    /**
     * Оновити залишки товару
     */
    updateProductStock(productId, quantity, callback) {
        // Отримуємо інформацію про товар
        db.get('SELECT pieces_per_box, stock_pieces, stock_boxes FROM products WHERE id = ?', [productId], (err, product) => {
            if (err) return callback(err);
            
            const pieces_per_box = product.pieces_per_box || 1;
            const boxes_to_add = Math.floor(quantity / pieces_per_box);
            
            // Оновлюємо залишки
            db.run(`UPDATE products 
                   SET stock_pieces = stock_pieces + ?, 
                       stock_boxes = stock_boxes + ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                [quantity, boxes_to_add, productId], (err) => {
                    if (err) return callback(err);
                    
                    // Додаємо запис руху запасів
                    db.run(`INSERT INTO stock_movements 
                           (product_id, movement_type, pieces, boxes, reason, user, created_at, updated_at)
                           VALUES (?, 'ARRIVAL', ?, ?, 'Приход товару', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [productId, quantity, boxes_to_add], callback);
                });
        });
    }

    /**
     * Розрахувати дату закінчення терміну придатності
     */
    calculateExpiryDate(batchDate) {
        const date = new Date(batchDate);
        date.setFullYear(date.getFullYear() + 1); // +1 рік за замовчуванням
        return date.toISOString().split('T')[0];
    }

    /**
     * Отримати всі приходи з фільтрацією
     */
    async getAllArrivals(filters = {}) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT a.*, 
                       COUNT(ai.id) as total_items,
                       SUM(ai.quantity) as total_quantity
                FROM arrivals a
                LEFT JOIN arrivals_items ai ON a.id = ai.arrival_id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (filters.start_date) {
                sql += ' AND a.arrival_date >= ?';
                params.push(filters.start_date);
            }
            
            if (filters.end_date) {
                sql += ' AND a.arrival_date <= ?';
                params.push(filters.end_date);
            }
            
            if (filters.created_by) {
                sql += ' AND a.created_by = ?';
                params.push(filters.created_by);
            }
            
            sql += ` GROUP BY a.id
                    ORDER BY a.arrival_date DESC, a.created_at DESC`;
            
            db.all(sql, params, (err, arrivals) => {
                if (err) {
                    return reject(new Error(`Помилка отримання приходів: ${err.message}`));
                }
                
                resolve(arrivals || []);
            });
        });
    }

    /**
     * Отримати прихід за ID з позиціями
     */
    async getArrivalById(arrivalId) {
        return new Promise((resolve, reject) => {
            // Отримуємо основну інформацію про прихід
            db.get('SELECT * FROM arrivals WHERE id = ?', [arrivalId], (err, arrival) => {
                if (err) {
                    return reject(new Error(`Помилка отримання приходу: ${err.message}`));
                }
                
                if (!arrival) {
                    return reject(new Error('Прихід не знайдено'));
                }
                
                // Отримуємо позиції приходу
                db.all(`SELECT ai.*, p.name as product_name, p.code as product_code, p.pieces_per_box
                        FROM arrivals_items ai
                        JOIN products p ON ai.product_id = p.id
                        WHERE ai.arrival_id = ?
                        ORDER BY ai.created_at`, [arrivalId], (err, items) => {
                    if (err) {
                        return reject(new Error(`Помилка отримання позицій: ${err.message}`));
                    }
                    
                    const result = {
                        ...arrival,
                        total_items: items.length,
                        total_quantity: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
                        items: items || []
                    };
                    
                    resolve(result);
                });
            });
        });
    }

    /**
     * Видалити прихід (помічає як видалений)
     */
    async deleteArrival(arrivalId) {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE arrivals 
                   SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`, [arrivalId], function(err) {
                if (err) {
                    return reject(new Error(`Помилка видалення приходу: ${err.message}`));
                }
                
                if (this.changes === 0) {
                    return reject(new Error('Прихід не знайдено'));
                }
                
                resolve({ message: 'Прихід успішно видалено' });
            });
        });
    }

    /**
     * Отримати статистику приходів
     */
    async getArrivalStatistics(startDate, endDate) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    COUNT(a.id) as total_arrivals,
                    COALESCE(SUM(ai.quantity), 0) as total_quantity
                FROM arrivals a
                LEFT JOIN arrivals_items ai ON a.id = ai.arrival_id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (startDate) {
                sql += ' AND a.arrival_date >= ?';
                params.push(startDate);
            }
            
            if (endDate) {
                sql += ' AND a.arrival_date <= ?';
                params.push(endDate);
            }
            
            db.get(sql, params, (err, stats) => {
                if (err) {
                    return reject(new Error(`Помилка отримання статистики: ${err.message}`));
                }
                
                const result = {
                    total_arrivals: stats.total_arrivals || 0,
                    total_quantity: stats.total_quantity || 0,
                    average_quantity_per_arrival: stats.total_arrivals > 0 
                        ? Math.round(stats.total_quantity / stats.total_arrivals) 
                        : 0,
                    period: {
                        start_date: startDate,
                        end_date: endDate
                    }
                };
                
                resolve(result);
            });
        });
    }
}

module.exports = new ArrivalQueries();