// queries/sqlite/batchQueries.js - SQLite запити для роботи з партіями товарів (legacy підтримка)

const { db } = require('../../database');

/**
 * Клас для роботи з партіями товарів в SQLite (legacy)
 */
class BatchQueries {
    
    /**
     * Отримати всі партії для конкретного товару
     */
    async getBatchesByProduct(productId, includeExpired = false) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    pb.*,
                    p.name as product_name,
                    p.code as product_code,
                    p.pieces_per_box,
                    CASE 
                        WHEN pb.expiry_date < date('now') THEN 'EXPIRED'
                        WHEN pb.expiry_date <= date('now', '+7 days') THEN 'EXPIRING'
                        WHEN pb.available_quantity <= 0 THEN 'DEPLETED'
                        ELSE 'ACTIVE'
                    END as batch_status,
                    julianday(pb.expiry_date) - julianday('now') as days_to_expiry
                FROM production_batches pb
                JOIN products p ON pb.product_id = p.id
                WHERE pb.product_id = ?
            `;
            
            const params = [productId];
            
            if (!includeExpired) {
                sql += ` AND pb.status = 'ACTIVE' AND pb.expiry_date >= date('now')`;
            }
            
            sql += ` ORDER BY pb.batch_date ASC`;
            
            db.all(sql, params, (err, batches) => {
                if (err) {
                    return reject(new Error(`Помилка отримання партій: ${err.message}`));
                }
                
                // Додаємо розрахункові поля
                const processedBatches = batches.map(batch => ({
                    ...batch,
                    boxes_quantity: Math.floor(batch.available_quantity / batch.pieces_per_box),
                    pieces_remainder: batch.available_quantity % batch.pieces_per_box,
                    total_boxes: Math.floor(batch.total_quantity / batch.pieces_per_box),
                    is_expiring: batch.days_to_expiry <= 7 && batch.days_to_expiry > 0,
                    is_expired: batch.days_to_expiry <= 0
                }));
                
                resolve(processedBatches);
            });
        });
    }

    /**
     * Отримати всі партії згруповані по товарах
     */
    async getAllBatchesGrouped() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.code as product_code,
                    p.pieces_per_box,
                    p.min_stock_pieces,
                    COUNT(pb.id) as batches_count,
                    SUM(pb.available_quantity) as total_available,
                    SUM(pb.reserved_quantity) as total_reserved,
                    MIN(pb.batch_date) as oldest_batch,
                    MAX(pb.batch_date) as newest_batch,
                    SUM(CASE WHEN pb.expiry_date <= date('now', '+7 days') THEN pb.available_quantity ELSE 0 END) as expiring_quantity,
                    GROUP_CONCAT(
                        json_object(
                            'id', pb.id,
                            'batch_date', pb.batch_date,
                            'available_quantity', pb.available_quantity,
                            'reserved_quantity', pb.reserved_quantity,
                            'expiry_date', pb.expiry_date,
                            'days_to_expiry', cast(julianday(pb.expiry_date) - julianday('now') as integer),
                            'status', CASE 
                                WHEN pb.expiry_date < date('now') THEN 'EXPIRED'
                                WHEN pb.expiry_date <= date('now', '+7 days') THEN 'EXPIRING'
                                WHEN pb.available_quantity <= 0 THEN 'DEPLETED'
                                ELSE 'ACTIVE'
                            END
                        )
                    ) as batches_json
                FROM products p
                LEFT JOIN production_batches pb ON p.id = pb.product_id 
                    AND pb.status = 'ACTIVE' 
                    AND pb.available_quantity > 0
                WHERE p.id IN (SELECT DISTINCT product_id FROM production_batches)
                GROUP BY p.id, p.name, p.code, p.pieces_per_box, p.min_stock_pieces
                ORDER BY p.name
            `;
            
            db.all(sql, [], (err, results) => {
                if (err) {
                    return reject(new Error(`Помилка отримання згрупованих партій: ${err.message}`));
                }
                
                // Обробляємо JSON партій
                const processedResults = results.map(product => {
                    let batches = [];
                    if (product.batches_json) {
                        try {
                            // Розбираємо GROUP_CONCAT з JSON об'єктами
                            const batchesStr = product.batches_json;
                            const batchObjects = batchesStr.split('},{').map((str, index, arr) => {
                                if (index === 0 && arr.length > 1) str += '}';
                                else if (index === arr.length - 1 && arr.length > 1) str = '{' + str;
                                else if (arr.length > 1) str = '{' + str + '}';
                                return JSON.parse(str);
                            });
                            
                            batches = batchObjects.sort((a, b) => 
                                new Date(a.batch_date) - new Date(b.batch_date)
                            );
                        } catch (e) {
                            console.error('Помилка парсингу партій для товару', product.product_id, e);
                            batches = [];
                        }
                    }
                    
                    return {
                        ...product,
                        batches_json: undefined, // Видаляємо сирий JSON
                        batches: batches,
                        total_boxes: Math.floor(product.total_available / product.pieces_per_box),
                        stock_status: product.total_available < product.min_stock_pieces ? 'low' : 
                                     product.total_available < product.min_stock_pieces * 2 ? 'warning' : 'good'
                    };
                });
                
                resolve(processedResults);
            });
        });
    }

    /**
     * Отримати партії що закінчуються
     */
    async getExpiringBatches(days = 7) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    pb.*,
                    p.name as product_name,
                    p.code as product_code,
                    p.pieces_per_box,
                    cast(julianday(pb.expiry_date) - julianday('now') as integer) as days_to_expiry
                FROM production_batches pb
                JOIN products p ON pb.product_id = p.id
                WHERE pb.status = 'ACTIVE' 
                    AND pb.available_quantity > 0
                    AND pb.expiry_date <= date('now', '+' || ? || ' days')
                    AND pb.expiry_date >= date('now')
                ORDER BY pb.expiry_date ASC, p.name
            `;
            
            db.all(sql, [days], (err, batches) => {
                if (err) {
                    return reject(new Error(`Помилка отримання партій що закінчуються: ${err.message}`));
                }
                
                const processedBatches = batches.map(batch => ({
                    ...batch,
                    boxes_quantity: Math.floor(batch.available_quantity / batch.pieces_per_box),
                    pieces_remainder: batch.available_quantity % batch.pieces_per_box,
                    urgency: batch.days_to_expiry <= 1 ? 'critical' : 
                            batch.days_to_expiry <= 3 ? 'high' : 'medium'
                }));
                
                resolve(processedBatches);
            });
        });
    }

    /**
     * Зарезервувати партії для замовлення (SQLite transaction)
     */
    async reserveBatches(allocations) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                let hasError = false;
                const results = [];
                
                allocations.forEach(({ batch_id, quantity }) => {
                    // Перевіряємо доступність
                    db.get(`SELECT available_quantity FROM production_batches WHERE id = ?`, [batch_id], (err, batch) => {
                        if (err || !batch) {
                            hasError = true;
                            db.run('ROLLBACK');
                            return reject(new Error(`Партія ${batch_id} не знайдена`));
                        }
                        
                        if (batch.available_quantity < quantity) {
                            hasError = true;
                            db.run('ROLLBACK');
                            return reject(new Error(`Недостатньо товару в партії ${batch_id}. Доступно: ${batch.available_quantity}`));
                        }
                        
                        // Резервуємо
                        db.run(`UPDATE production_batches 
                               SET reserved_quantity = reserved_quantity + ?,
                                   available_quantity = available_quantity - ?,
                                   updated_at = CURRENT_TIMESTAMP
                               WHERE id = ?`, [quantity, quantity, batch_id], (err) => {
                            if (err) {
                                hasError = true;
                                db.run('ROLLBACK');
                                return reject(new Error(`Помилка резервування партії ${batch_id}: ${err.message}`));
                            }
                            
                            results.push({ batch_id, quantity, success: true });
                            completed++;
                            
                            if (completed === allocations.length && !hasError) {
                                db.run('COMMIT');
                                resolve(results);
                            }
                        });
                    });
                });
            });
        });
    }

    /**
     * Звільнити резерви партій 
     */
    async unreserveBatches(allocations) {
        return new Promise((resolve, reject) => {
            const results = [];
            let completed = 0;
            
            if (allocations.length === 0) {
                return resolve(results);
            }
            
            allocations.forEach(({ batch_id, quantity }) => {
                // Отримуємо поточний стан партії
                db.get(`SELECT reserved_quantity, available_quantity FROM production_batches WHERE id = ?`, [batch_id], (err, batch) => {
                    if (err || !batch) {
                        console.warn(`Партія ${batch_id} не знайдена при звільненні резерву`);
                        completed++;
                        if (completed === allocations.length) resolve(results);
                        return;
                    }

                    const releaseQuantity = Math.min(quantity, batch.reserved_quantity);
                    
                    // Звільняємо резерв
                    db.run(`UPDATE production_batches 
                           SET reserved_quantity = CASE WHEN reserved_quantity >= ? THEN reserved_quantity - ? ELSE 0 END,
                               available_quantity = available_quantity + ?,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?`, [releaseQuantity, releaseQuantity, releaseQuantity, batch_id], (err) => {
                        if (err) {
                            console.error(`Помилка звільнення резерву партії ${batch_id}:`, err);
                        } else {
                            results.push({ batch_id, quantity: releaseQuantity, success: true });
                        }
                        
                        completed++;
                        if (completed === allocations.length) {
                            resolve(results);
                        }
                    });
                });
            });
        });
    }

    /**
     * Отримати доступні партії для товару (FIFO)
     */
    async getAvailableBatchesForProduct(productId, quantityNeeded) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT pb.*, p.pieces_per_box, p.name as product_name
                FROM production_batches pb
                JOIN products p ON pb.product_id = p.id
                WHERE pb.product_id = ? 
                  AND pb.status = 'ACTIVE' 
                  AND pb.available_quantity > 0
                  AND pb.expiry_date >= date('now')
                ORDER BY pb.batch_date ASC, pb.created_at ASC
            `, [productId], (err, availableBatches) => {
                if (err) {
                    return reject(new Error(`Помилка отримання доступних партій: ${err.message}`));
                }
                
                const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.available_quantity, 0);
                
                if (totalAvailable === 0) {
                    return resolve({
                        quantity_reserved: 0,
                        shortage: quantityNeeded,
                        allocated_batches: [],
                        product_name: availableBatches[0]?.product_name || 'Невідомий товар'
                    });
                }
                
                // Розподіляємо кількість по партіях (FIFO)
                const allocatedBatches = [];
                let remainingQuantity = quantityNeeded;
                let quantityReserved = 0;
                
                for (const batch of availableBatches) {
                    if (remainingQuantity <= 0) break;
                    
                    const allocateFromBatch = Math.min(remainingQuantity, batch.available_quantity);
                    
                    allocatedBatches.push({
                        batch_id: batch.id,
                        batch_date: batch.batch_date,
                        quantity: allocateFromBatch,
                        expiry_date: batch.expiry_date
                    });
                    
                    remainingQuantity -= allocateFromBatch;
                    quantityReserved += allocateFromBatch;
                }
                
                resolve({
                    quantity_reserved: quantityReserved,
                    shortage: Math.max(0, remainingQuantity),
                    allocated_batches: allocatedBatches,
                    product_name: availableBatches[0]?.product_name
                });
            });
        });
    }

    /**
     * Списати партію
     */
    async writeoffBatch(batchId, quantity, reason, responsible, notes = '') {
        return new Promise((resolve, reject) => {
            db.get(`SELECT pb.*, p.pieces_per_box FROM production_batches pb 
                    JOIN products p ON pb.product_id = p.id 
                    WHERE pb.id = ?`, [batchId], (err, batch) => {
                if (err || !batch) {
                    return reject(new Error('Партію не знайдено'));
                }
                
                if (batch.available_quantity < quantity) {
                    return reject(new Error(`Недостатньо товару в партії. Доступно: ${batch.available_quantity}`));
                }
                
                const boxes_quantity = Math.floor(quantity / batch.pieces_per_box);
                const pieces_quantity = quantity % batch.pieces_per_box;
                
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    
                    // 1. Оновлюємо партію
                    db.run(`UPDATE production_batches 
                           SET available_quantity = available_quantity - ?,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?`, [quantity, batchId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(new Error(`Помилка оновлення партії: ${err.message}`));
                        }
                        
                        // 2. Створюємо запис в таблиці списання
                        db.run(`INSERT INTO writeoffs 
                               (product_id, writeoff_date, total_quantity, boxes_quantity, pieces_quantity, reason, responsible, notes)
                               VALUES (?, date('now'), ?, ?, ?, ?, ?, ?)`,
                               [batch.product_id, quantity, boxes_quantity, pieces_quantity, reason, responsible, notes || ''],
                               function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(new Error(`Помилка створення запису списання: ${err.message}`));
                            }
                            
                            // 3. Додаємо запис в історію рухів з інформацією про партію
                            db.run(`INSERT INTO stock_movements 
                                   (product_id, movement_type, pieces, boxes, reason, user, batch_id, batch_date)
                                   VALUES (?, 'WRITEOFF', ?, ?, ?, ?, ?, ?)`, 
                                   [batch.product_id, -quantity, -boxes_quantity, 
                                    `Списання партії ${batch.batch_date}: ${reason}`, responsible, 
                                    batchId, batch.batch_date], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(new Error(`Помилка запису руху: ${err.message}`));
                                }
                                
                                // 4. Оновлюємо загальні залишки товару
                                db.run(`UPDATE products 
                                       SET stock_pieces = stock_pieces - ?, 
                                           stock_boxes = stock_boxes - ?,
                                           updated_at = CURRENT_TIMESTAMP
                                       WHERE id = ?`, 
                                       [quantity, boxes_quantity, batch.product_id], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(new Error(`Помилка оновлення загальних залишків: ${err.message}`));
                                    }
                                    
                                    db.run('COMMIT');
                                    resolve({
                                        message: 'Партію успішно списано',
                                        batch_date: batch.batch_date,
                                        quantity_writeoff: quantity
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Отримати доступність товару з урахуванням партій
     */
    async getProductAvailability(productId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.name,
                    p.code,
                    p.pieces_per_box,
                    p.stock_pieces,
                    p.min_stock_pieces,
                    COALESCE(SUM(pb.available_quantity), 0) as total_available_in_batches,
                    COUNT(pb.id) as active_batches_count,
                    SUM(CASE WHEN pb.expiry_date <= date('now', '+7 days') THEN pb.available_quantity ELSE 0 END) as expiring_quantity,
                    SUM(CASE WHEN pb.expiry_date < date('now') THEN pb.available_quantity ELSE 0 END) as expired_quantity
                FROM products p
                LEFT JOIN production_batches pb ON p.id = pb.product_id 
                    AND pb.status = 'ACTIVE' 
                    AND pb.available_quantity > 0
                WHERE p.id = ?
                GROUP BY p.id
            `;
            
            db.get(sql, [productId], (err, result) => {
                if (err) {
                    return reject(new Error(`Помилка отримання доступності товару: ${err.message}`));
                }
                
                if (!result) {
                    return reject(new Error('Товар не знайдено'));
                }
                
                const totalAvailable = result.total_available_in_batches;
                const stockStatus = totalAvailable < result.min_stock_pieces ? 'low' : 
                                   totalAvailable < result.min_stock_pieces * 2 ? 'warning' : 'good';
                
                resolve({
                    product_id: productId,
                    product_name: result.name,
                    product_code: result.code,
                    pieces_per_box: result.pieces_per_box,
                    stock_pieces: result.stock_pieces,
                    min_stock_pieces: result.min_stock_pieces,
                    total_available: totalAvailable,
                    active_batches: result.active_batches_count || 0,
                    expiring_quantity: result.expiring_quantity || 0,
                    expired_quantity: result.expired_quantity || 0,
                    stock_status: stockStatus,
                    has_sufficient_stock: totalAvailable > 0,
                    is_low_stock: totalAvailable < result.min_stock_pieces
                });
            });
        });
    }
}

module.exports = new BatchQueries();