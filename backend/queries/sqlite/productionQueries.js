/**
 * Production Queries для SQLite
 * Адаптер для роботи з виробництвом в SQLite БД
 */

const { db } = require('../../database');

const ProductionQueries = {
    /**
     * Отримати всі записи виробництва
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT p.*, pr.name as product_name, pr.code as product_code, 
                       pr.pieces_per_box,
                       p.production_date as batch_date, 
                       p.total_quantity as batch_available
                FROM production p 
                JOIN products pr ON p.product_id = pr.id 
                ORDER BY p.production_date DESC, p.production_time DESC
            `;
            
            db.all(sql, (err, rows) => {
                if (err) {
                    console.error('Помилка отримання виробництва:', err);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
    },

    /**
     * Отримати виробництво за ID товару
     */
    async getByProductId(productId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT p.*, pr.name as product_name, pr.code as product_code,
                       pr.pieces_per_box,
                       p.production_date as batch_date, 
                       p.total_quantity as batch_available
                FROM production p 
                JOIN products pr ON p.product_id = pr.id 
                WHERE p.product_id = ?
                ORDER BY p.production_date DESC, p.production_time DESC
            `;
            
            db.all(sql, [productId], (err, rows) => {
                if (err) {
                    console.error('Помилка отримання виробництва за товаром:', err);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
    },

    /**
     * Створити запис виробництва з партією (адаптовано з database.js)
     */
    async create(productionData) {
        return new Promise((resolve, reject) => {
            const {
                product_id,
                production_date,
                total_quantity,
                expiry_date,
                responsible = 'system',
                notes,
                production_time
            } = productionData;

            // Автоматично встановлюємо expiry_date якщо не передано (+ 365 днів)
            let finalExpiryDate = expiry_date;
            if (!finalExpiryDate && production_date) {
                const date = new Date(production_date);
                date.setDate(date.getDate() + 365);
                finalExpiryDate = date.toISOString().split('T')[0];
            }

            // Автоматично встановлюємо production_time якщо не передано
            let finalProductionTime = production_time;
            if (!finalProductionTime) {
                const now = new Date();
                const kyivTime = now.toLocaleTimeString('uk-UA', { 
                    hour12: false, 
                    timeZone: 'Europe/Kyiv' 
                });
                finalProductionTime = kyivTime;
            }

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // 1. Отримуємо інформацію про товар
                db.get('SELECT pieces_per_box FROM products WHERE id = ?', [product_id], (err, product) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    
                    if (!product) {
                        db.run('ROLLBACK');
                        return reject(new Error('Товар не знайдено'));
                    }

                    const boxes_quantity = Math.floor(total_quantity / product.pieces_per_box);
                    const pieces_quantity = total_quantity % product.pieces_per_box;

                    // 2. Створюємо запис виробництва
                    db.run(`INSERT INTO production 
                           (product_id, production_date, production_time, total_quantity, boxes_quantity, pieces_quantity, expiry_date, responsible, notes) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [product_id, production_date, finalProductionTime, total_quantity, boxes_quantity, pieces_quantity, finalExpiryDate, responsible, notes],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            
                            const productionId = this.lastID;

                            // 3. Створюємо запис руху запасів (без партій для SQLite)
                            db.run(`INSERT INTO stock_movements 
                                   (product_id, movement_type, pieces, boxes, reason, user)
                                   VALUES (?, 'PRODUCTION', ?, ?, ?, ?)`,
                                [product_id, total_quantity, boxes_quantity, 
                                 `Виробництво ${production_date}`, responsible || 'system'], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                // 4. Оновлюємо залишки товару
                                db.run(`UPDATE products 
                                       SET stock_pieces = stock_pieces + ?,
                                           stock_boxes = stock_boxes + ?
                                       WHERE id = ?`,
                                    [total_quantity, boxes_quantity, product_id], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    db.run('COMMIT');
                                    console.log(`🎉 Виробництво ${productionId} створено (SQLite mode)`);
                                    resolve({ 
                                        id: productionId,
                                        boxes_quantity,
                                        pieces_quantity,
                                        batch_date: production_date,
                                        batch_id: null // SQLite doesn't use batch system
                                    });
                                });
                            });
                        });
                });
            });
        });
    },

    /**
     * Отримати статистики виробництва за період
     */
    async getStats(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const params = [];

            if (startDate) {
                conditions.push('p.production_date >= ?');
                params.push(startDate);
            }

            if (endDate) {
                conditions.push('p.production_date <= ?');
                params.push(endDate);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const sql = `
                SELECT 
                    p.id,
                    p.product_id,
                    p.production_date,
                    p.total_quantity,
                    pr.name as product_name
                FROM production p
                JOIN products pr ON p.product_id = pr.id
                ${whereClause}
            `;

            db.all(sql, params, (err, data) => {
                if (err) {
                    console.error('Помилка отримання статистик виробництва:', err);
                    return reject(err);
                }

                // Обчислюємо статистики
                const stats = {
                    total_records: data.length,
                    total_quantity: data.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
                    unique_products: new Set(data.map(item => item.product_id)).size,
                    date_range: null
                };

                if (data.length > 0) {
                    const dates = data.map(item => new Date(item.production_date)).sort();
                    stats.date_range = {
                        start: dates[0].toISOString().split('T')[0],
                        end: dates[dates.length - 1].toISOString().split('T')[0]
                    };
                }

                // Статистики по товарах
                const productStats = {};
                data.forEach(item => {
                    if (!productStats[item.product_id]) {
                        productStats[item.product_id] = {
                            product_id: item.product_id,
                            product_name: item.product_name,
                            total_quantity: 0,
                            records_count: 0
                        };
                    }
                    productStats[item.product_id].total_quantity += item.total_quantity;
                    productStats[item.product_id].records_count += 1;
                });

                resolve({
                    overview: stats,
                    by_products: Object.values(productStats),
                    period: { start: startDate, end: endDate }
                });
            });
        });
    },

    /**
     * Отримати доступні партії для товару (SQLite не використовує партії)
     */
    async getAvailableBatches(productId) {
        return new Promise((resolve, reject) => {
            // SQLite не має системи партій, повертаємо mock дані на основі production
            const sql = `
                SELECT 
                    p.id as batch_id,
                    p.production_date as batch_date,
                    p.total_quantity as total_quantity,
                    p.total_quantity as available_quantity,
                    0 as reserved_quantity,
                    pr.name as product_name,
                    pr.pieces_per_box
                FROM production p
                JOIN products pr ON p.product_id = pr.id
                WHERE p.product_id = ?
                ORDER BY p.production_date ASC
            `;
            
            db.all(sql, [productId], (err, rows) => {
                if (err) {
                    console.error('Помилка отримання "партій" (SQLite):', err);
                    return resolve([]); // Повертаємо порожній масив замість помилки
                }
                
                // Адаптуємо структуру для сумісності з Supabase
                const adaptedRows = (rows || []).map(row => ({
                    id: row.batch_id,
                    batch_date: row.batch_date,
                    total_quantity: row.total_quantity,
                    available_quantity: row.available_quantity,
                    reserved_quantity: row.reserved_quantity,
                    products: {
                        name: row.product_name,
                        pieces_per_box: row.pieces_per_box
                    }
                }));

                resolve(adaptedRows);
            });
        });
    },

    /**
     * Резервувати кількість (SQLite - спрощена версія без партій)
     */
    async reserveBatches(productId, quantityNeeded) {
        return new Promise((resolve, reject) => {
            // SQLite не має повноцінної системи резервування партій
            // Повертаємо успішний результат з mock даними
            const today = new Date().toISOString().split('T')[0];
            
            console.log(`⚠️ SQLite: mock резервування ${quantityNeeded} шт товару ${productId}`);
            
            resolve({
                success: true,
                allocations: [{
                    batch_id: null,
                    batch_date: today,
                    allocated_quantity: quantityNeeded,
                    remaining_after: 0
                }],
                total_reserved: quantityNeeded
            });
        });
    }
};

module.exports = ProductionQueries;