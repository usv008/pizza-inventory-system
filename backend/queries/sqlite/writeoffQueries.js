/**
 * Writeoff Queries для SQLite
 * Адаптер для роботи зі списаннями в SQLite БД
 */

const { db } = require('../../database');

const WriteoffQueries = {
    /**
     * Отримати всі записи списань з join до products
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT w.*, 
                       p.name as product_name, 
                       p.code as product_code, 
                       p.pieces_per_box,
                       p.stock_pieces as product_stock_pieces,
                       p.stock_boxes as product_stock_boxes
                FROM writeoffs w 
                JOIN products p ON w.product_id = p.id 
                ORDER BY w.writeoff_date DESC, w.created_at DESC
            `;
            
            db.all(sql, (err, rows) => {
                if (err) {
                    console.error('Помилка отримання списань (SQLite):', err);
                    return reject(err);
                }
                
                // Адаптуємо структуру для сумісності
                const adaptedRows = (rows || []).map(row => ({
                    id: row.id,
                    product_id: row.product_id,
                    writeoff_date: row.writeoff_date,
                    total_quantity: row.total_quantity,
                    boxes_quantity: row.boxes_quantity || 0,
                    pieces_quantity: row.pieces_quantity || 0,
                    reason: row.reason,
                    responsible: row.responsible,
                    notes: row.notes || '',
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    // Дані з products table
                    product_name: row.product_name,
                    product_code: row.product_code,
                    pieces_per_box: row.pieces_per_box,
                    product_stock_pieces: row.product_stock_pieces,
                    product_stock_boxes: row.product_stock_boxes
                }));

                console.log(`✅ SQLite: отримано ${adaptedRows.length} записів списань`);
                resolve(adaptedRows);
            });
        });
    },

    /**
     * Отримати списання за ID товару
     */
    async getByProductId(productId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT w.*, 
                       p.name as product_name, 
                       p.code as product_code, 
                       p.pieces_per_box,
                       p.stock_pieces as product_stock_pieces,
                       p.stock_boxes as product_stock_boxes
                FROM writeoffs w 
                JOIN products p ON w.product_id = p.id 
                WHERE w.product_id = ?
                ORDER BY w.writeoff_date DESC, w.created_at DESC
            `;
            
            db.all(sql, [productId], (err, rows) => {
                if (err) {
                    console.error('Помилка отримання списань за товаром (SQLite):', err);
                    return reject(err);
                }
                
                // Адаптуємо структуру для сумісності
                const adaptedRows = (rows || []).map(row => ({
                    id: row.id,
                    product_id: row.product_id,
                    writeoff_date: row.writeoff_date,
                    total_quantity: row.total_quantity,
                    boxes_quantity: row.boxes_quantity || 0,
                    pieces_quantity: row.pieces_quantity || 0,
                    reason: row.reason,
                    responsible: row.responsible,
                    notes: row.notes || '',
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    // Дані з products table
                    product_name: row.product_name,
                    product_code: row.product_code,
                    pieces_per_box: row.pieces_per_box,
                    product_stock_pieces: row.product_stock_pieces,
                    product_stock_boxes: row.product_stock_boxes
                }));

                console.log(`✅ SQLite: отримано ${adaptedRows.length} записів списань для товару ${productId}`);
                resolve(adaptedRows);
            });
        });
    },

    /**
     * Створити новий запис списання з оновленням залишків
     */
    async create(writeoffData) {
        return new Promise((resolve, reject) => {
            const {
                product_id,
                writeoff_date,
                total_quantity,
                reason,
                responsible,
                notes = ''
            } = writeoffData;

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

                    const pieces_per_box = product.pieces_per_box || 1;
                    const boxes_quantity = Math.floor(total_quantity / pieces_per_box);
                    const pieces_quantity = total_quantity % pieces_per_box;

                    // 2. Створюємо запис списання
                    const writeoffSql = `
                        INSERT INTO writeoffs 
                        (product_id, writeoff_date, total_quantity, boxes_quantity, pieces_quantity, reason, responsible, notes, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `;
                    
                    db.run(writeoffSql, 
                        [product_id, writeoff_date, total_quantity, boxes_quantity, pieces_quantity, reason, responsible, notes],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            
                            const writeoffId = this.lastID;

                            // 3. Створюємо запис руху запасів
                            const movementSql = `
                                INSERT INTO stock_movements 
                                (product_id, movement_type, pieces, boxes, reason, user, created_at)
                                VALUES (?, 'WRITEOFF', ?, ?, ?, ?, datetime('now'))
                            `;
                            
                            db.run(movementSql, 
                                [product_id, -total_quantity, -boxes_quantity, `Списання: ${reason}`, responsible],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    
                                    const movementId = this.lastID;

                                    // 4. Оновлюємо залишки товару
                                    const updateStockSql = `
                                        UPDATE products 
                                        SET stock_pieces = stock_pieces - ?,
                                            stock_boxes = stock_boxes - ?,
                                            updated_at = datetime('now')
                                        WHERE id = ?
                                    `;
                                    
                                    db.run(updateStockSql, [total_quantity, boxes_quantity, product_id], (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        db.run('COMMIT');
                                        console.log(`✅ SQLite: створено списання ID ${writeoffId} для товару ${product_id}`);
                                        resolve({
                                            id: writeoffId,
                                            boxes_quantity,
                                            pieces_quantity,
                                            stock_movement_id: movementId
                                        });
                                    });
                                });
                        });
                });
            });
        });
    },

    /**
     * Отримати статистики списань за період
     */
    async getStats(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const params = [];

            if (startDate) {
                conditions.push('w.writeoff_date >= ?');
                params.push(startDate);
            }

            if (endDate) {
                conditions.push('w.writeoff_date <= ?');
                params.push(endDate);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const sql = `
                SELECT 
                    w.id,
                    w.product_id,
                    w.writeoff_date,
                    w.total_quantity,
                    w.reason,
                    w.responsible,
                    p.name as product_name,
                    p.code as product_code
                FROM writeoffs w
                JOIN products p ON w.product_id = p.id
                ${whereClause}
                ORDER BY w.writeoff_date DESC
            `;

            db.all(sql, params, (err, data) => {
                if (err) {
                    console.error('Помилка отримання статистик списань (SQLite):', err);
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
                    const dates = data.map(item => new Date(item.writeoff_date)).sort();
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
                            product_code: item.product_code,
                            total_quantity: 0,
                            records_count: 0
                        };
                    }
                    productStats[item.product_id].total_quantity += item.total_quantity;
                    productStats[item.product_id].records_count += 1;
                });

                // Статистики по причинах
                const reasonStats = {};
                data.forEach(item => {
                    if (!reasonStats[item.reason]) {
                        reasonStats[item.reason] = {
                            reason: item.reason,
                            total_quantity: 0,
                            records_count: 0
                        };
                    }
                    reasonStats[item.reason].total_quantity += item.total_quantity;
                    reasonStats[item.reason].records_count += 1;
                });

                // Статистики по відповідальних
                const responsibleStats = {};
                data.forEach(item => {
                    if (!responsibleStats[item.responsible]) {
                        responsibleStats[item.responsible] = {
                            responsible: item.responsible,
                            total_quantity: 0,
                            records_count: 0
                        };
                    }
                    responsibleStats[item.responsible].total_quantity += item.total_quantity;
                    responsibleStats[item.responsible].records_count += 1;
                });

                console.log(`✅ SQLite: обчислено статистики для ${data.length} списань`);
                resolve({
                    overview: stats,
                    by_products: Object.values(productStats),
                    by_reasons: Object.values(reasonStats),
                    by_responsible: Object.values(responsibleStats),
                    period: { start: startDate, end: endDate }
                });
            });
        });
    }
};

module.exports = WriteoffQueries;