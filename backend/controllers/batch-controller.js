// controllers/batch-controller.js - Розширений контролер з логікою резервування для редагування замовлень

const { db } = require('../database');
const OperationsLogController = require('./operations-log-controller');

class BatchController {
    
    // НОВИЙ: Звільнення всіх резервів замовлення
    static async unreserveBatchesForOrder(req, res) {
        try {
            const { orderId } = req.params;
            
            console.log(`🔄 Звільняю резерви для замовлення ${orderId}`);
            
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    
                    // Отримуємо всі позиції замовлення з allocated_batches
                    db.all(`
                        SELECT oi.*, p.name as product_name
                        FROM order_items oi
                        JOIN products p ON oi.product_id = p.id
                        WHERE oi.order_id = ?
                    `, [orderId], (err, orderItems) => {
                        if (err) {
                            db.run('ROLLBACK');
                            const error = { error: 'Помилка отримання позицій замовлення' };
                            return res ? res.status(500).json(error) : reject(new Error(error.error));
                        }
                        
                        if (orderItems.length === 0) {
                            db.run('COMMIT');
                            const result = { 
                                message: 'Немає позицій для звільнення резервів',
                                released_quantity: 0
                            };
                            return res ? res.json(result) : resolve(result);
                        }
                        
                        let processedItems = 0;
                        let totalReleased = 0;
                        let hasError = false;
                        
                        orderItems.forEach(item => {
                            if (hasError) return;
                            
                            let allocatedBatches = [];
                            
                            // Парсимо allocated_batches JSON
                            if (item.allocated_batches) {
                                try {
                                    allocatedBatches = JSON.parse(item.allocated_batches);
                                } catch (parseError) {
                                    console.warn(`Помилка парсингу allocated_batches для позиції ${item.id}:`, parseError);
                                }
                            }
                            
                            // Звільняємо кожну зарезервовану партію
                            if (allocatedBatches.length > 0) {
                                let processedBatches = 0;
                                
                                allocatedBatches.forEach(batchAllocation => {
                                    if (!batchAllocation.batch_id || !batchAllocation.quantity) {
                                        processedBatches++;
                                        checkItemCompleted();
                                        return;
                                    }
                                    
                                    const quantity = batchAllocation.quantity || batchAllocation.allocated_quantity || 0;
                                    
                                    // Звільняємо резерв у партії
                                    db.run(`
                                        UPDATE production_batches 
                                        SET reserved_quantity = CASE WHEN reserved_quantity >= ? THEN reserved_quantity - ? ELSE 0 END,
                                            available_quantity = available_quantity + ?,
                                            updated_at = CURRENT_TIMESTAMP
                                        WHERE id = ?
                                    `, [quantity, quantity, quantity, batchAllocation.batch_id], function(err) {
                                        if (err) {
                                            console.warn(`Не вдалося звільнити резерв партії ${batchAllocation.batch_id}: ${err.message}`);
                                        } else if (this.changes > 0) {
                                            totalReleased += quantity;
                                            console.log(`✅ Звільнено ${quantity} шт з партії ${batchAllocation.batch_id}`);
                                        }
                                        
                                        processedBatches++;
                                        checkItemCompleted();
                                    });
                                });
                                
                                function checkItemCompleted() {
                                    if (processedBatches === allocatedBatches.length) {
                                        processedItems++;
                                        if (processedItems === orderItems.length) {
                                            finishUnreservation();
                                        }
                                    }
                                }
                            } else {
                                processedItems++;
                                if (processedItems === orderItems.length) {
                                    finishUnreservation();
                                }
                            }
                        });
                        
                        function finishUnreservation() {
                            if (hasError) return;
                            
                            db.run('COMMIT');
                            console.log(`🎉 Звільнено резервів: ${totalReleased} шт для замовлення ${orderId}`);
                            
                            const result = {
                                message: 'Резерви успішно звільнено',
                                order_id: parseInt(orderId),
                                released_quantity: totalReleased,
                                items_processed: orderItems.length
                            };
                            
                            res ? res.json(result) : resolve(result);
                        }
                    });
                });
            });
            
        } catch (error) {
            console.error('Помилка звільнення резервів:', error);
            if (res) {
                res.status(500).json({ error: 'Помилка сервера при звільненні резервів' });
            } else {
                throw error;
            }
        }
    }
    
    // НОВИЙ: Резервування партій для позицій замовлення
    static async reserveBatchesForOrderItems(req, res) {
        try {
            const { orderId } = req.params;
            const { items } = req.body; // [{ product_id, quantity, notes }]
            
            if (!items || !Array.isArray(items)) {
                const error = { error: 'Некоректні дані позицій замовлення' };
                return res ? res.status(400).json(error) : Promise.reject(new Error(error.error));
            }
            
            console.log(`🔄 Резервую партії для замовлення ${orderId}, позицій: ${items.length}`);
            
            return new Promise(async (resolve, reject) => {
                const reservationResults = [];
                let totalReserved = 0;
                
                // Резервуємо партії для кожної позиції
                for (const item of items) {
                    const { product_id, quantity } = item;
                    
                    if (!product_id || !quantity || quantity <= 0) {
                        continue;
                    }
                    
                    try {
                        const reservationResult = await BatchController.reserveBatchesForProduct(product_id, quantity);
                        reservationResults.push({
                            product_id: product_id,
                            quantity_requested: quantity,
                            ...reservationResult
                        });
                        
                        totalReserved += reservationResult.quantity_reserved || 0;
                    } catch (error) {
                        console.error(`Помилка резервування для товару ${product_id}:`, error);
                        reservationResults.push({
                            product_id: product_id,
                            quantity_requested: quantity,
                            quantity_reserved: 0,
                            shortage: quantity,
                            error: error.message
                        });
                    }
                }
                
                const result = {
                    message: 'Резервування завершено',
                    order_id: parseInt(orderId),
                    total_reserved: totalReserved,
                    reservations: reservationResults
                };
                
                res ? res.json(result) : resolve(result);
            });
            
        } catch (error) {
            console.error('Помилка резервування партій для замовлення:', error);
            if (res) {
                res.status(500).json({ error: 'Помилка сервера при резервуванні партій' });
            } else {
                throw error;
            }
        }
    }
    
    // ДОПОМІЖНИЙ: Резервування партій для одного товару
    static async reserveBatchesForProduct(productId, quantityNeeded) {
        return new Promise((resolve, reject) => {
            // Отримуємо доступні партії (FIFO)
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
                    return reject(new Error(`Помилка отримання партій: ${err.message}`));
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
                
                // Резервуємо партії в базі даних
                if (allocatedBatches.length > 0) {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        
                        let processedBatches = 0;
                        let hasError = false;
                        
                        allocatedBatches.forEach(allocation => {
                            if (hasError) return;
                            
                            db.run(`
                                UPDATE production_batches 
                                SET reserved_quantity = reserved_quantity + ?,
                                    available_quantity = available_quantity - ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ? AND available_quantity >= ?
                            `, [allocation.quantity, allocation.quantity, allocation.batch_id, allocation.quantity], function(err) {
                                if (err || this.changes === 0) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    return reject(new Error(`Не вдалося зарезервувати партію ${allocation.batch_id}`));
                                }
                                
                                processedBatches++;
                                if (processedBatches === allocatedBatches.length) {
                                    db.run('COMMIT');
                                    
                                    console.log(`✅ Зарезервовано ${quantityReserved} шт товару ${productId}`);
                                    
                                    resolve({
                                        quantity_reserved: quantityReserved,
                                        shortage: Math.max(0, remainingQuantity),
                                        allocated_batches: allocatedBatches,
                                        product_name: availableBatches[0]?.product_name
                                    });
                                }
                            });
                        });
                    });
                } else {
                    resolve({
                        quantity_reserved: 0,
                        shortage: quantityNeeded,
                        allocated_batches: [],
                        product_name: availableBatches[0]?.product_name
                    });
                }
            });
        });
    }
    
    // Існуючі методи залишаються без змін
    static async getBatchesByProduct(req, res) {
        try {
            const { productId } = req.params;
            const { includeExpired = false } = req.query;
            
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
                    console.error('Помилка отримання партій:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
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
                
                res.json(processedBatches);
            });
        } catch (error) {
            console.error('Помилка в getBatchesByProduct:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
    
    static async getAllBatchesGrouped(req, res) {
        try {
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
                    console.error('Помилка отримання згрупованих партій:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
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
                
                res.json(processedResults);
            });
        } catch (error) {
            console.error('Помилка в getAllBatchesGrouped:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
    
    static async getExpiringBatches(req, res) {
        try {
            const { days = 7 } = req.query;
            
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
                    console.error('Помилка отримання партій що закінчуються:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }
                
                const processedBatches = batches.map(batch => ({
                    ...batch,
                    boxes_quantity: Math.floor(batch.available_quantity / batch.pieces_per_box),
                    pieces_remainder: batch.available_quantity % batch.pieces_per_box,
                    urgency: batch.days_to_expiry <= 1 ? 'critical' : 
                            batch.days_to_expiry <= 3 ? 'high' : 'medium'
                }));
                
                res.json(processedBatches);
            });
        } catch (error) {
            console.error('Помилка в getExpiringBatches:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
    
    static async reserveBatches(req, res) {
        try {
            const { orderId } = req.params;
            const { allocations } = req.body; // [{ batch_id, quantity }]
            
            if (!allocations || !Array.isArray(allocations)) {
                return res.status(400).json({ error: 'Некоректні дані резервування' });
            }
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                let completed = 0;
                let hasError = false;
                
                allocations.forEach(({ batch_id, quantity }) => {
                    // Перевіряємо доступність
                    db.get(`SELECT available_quantity FROM production_batches WHERE id = ?`, [batch_id], (err, batch) => {
                        if (err || !batch) {
                            hasError = true;
                            db.run('ROLLBACK');
                            return res.status(400).json({ error: `Партія ${batch_id} не знайдена` });
                        }
                        
                        if (batch.available_quantity < quantity) {
                            hasError = true;
                            db.run('ROLLBACK');
                            return res.status(400).json({ 
                                error: `Недостатньо товару в партії ${batch_id}. Доступно: ${batch.available_quantity}` 
                            });
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
                                return res.status(500).json({ error: 'Помилка резервування' });
                            }
                            
                            completed++;
                            if (completed === allocations.length && !hasError) {
                                db.run('COMMIT');
                                res.json({ 
                                    message: 'Партії успішно зарезервовано',
                                    reservations: allocations.length
                                });
                            }
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Помилка в reserveBatches:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
    
    static writeoffBatch(req, res) {
        try {
            const { batchId } = req.params;
            const { quantity, reason, responsible, notes } = req.body;
            
            if (!quantity || !reason || !responsible) {
                return res.status(400).json({ 
                    error: 'Обов\'язкові поля: quantity, reason, responsible' 
                });
            }
            
            db.get(`SELECT pb.*, p.pieces_per_box FROM production_batches pb 
                    JOIN products p ON pb.product_id = p.id 
                    WHERE pb.id = ?`, [batchId], (err, batch) => {
                if (err || !batch) {
                    return res.status(404).json({ error: 'Партію не знайдено' });
                }
                
                if (batch.available_quantity < quantity) {
                    return res.status(400).json({ 
                        error: `Недостатньо товару в партії. Доступно: ${batch.available_quantity}` 
                    });
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
                            return res.status(500).json({ error: 'Помилка оновлення партії' });
                        }
                        
                        // 2. Створюємо запис в таблиці списання
                        db.run(`INSERT INTO writeoffs 
                               (product_id, writeoff_date, total_quantity, boxes_quantity, pieces_quantity, reason, responsible, notes)
                               VALUES (?, date('now'), ?, ?, ?, ?, ?, ?)`,
                               [batch.product_id, quantity, boxes_quantity, pieces_quantity, reason, responsible, notes || ''],
                               function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Помилка створення запису списання' });
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
                                    return res.status(500).json({ error: 'Помилка запису руху' });
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
                                        return res.status(500).json({ error: 'Помилка оновлення загальних залишків' });
                                    }
                                    
                                    // 5. Логуємо операцію списання
                                    OperationsLogController.logOperation({
                                        operation_type: 'WRITEOFF',
                                        entity_type: 'batch',
                                        entity_id: batchId,
                                        old_data: {
                                            batch_id: batchId,
                                            batch_date: batch.batch_date,
                                            available_quantity_before: batch.available_quantity
                                        },
                                        new_data: {
                                            batch_id: batchId,
                                            batch_date: batch.batch_date,
                                            quantity_written_off: quantity,
                                            available_quantity_after: batch.available_quantity - quantity,
                                            reason: reason,
                                            responsible: responsible
                                        },
                                        description: `Списання партії ${batch.batch_date}: ${quantity} шт (${reason})`,
                                        user_name: responsible,
                                        ip_address: req?.ip || 'unknown',
                                        user_agent: req?.get('User-Agent') || 'unknown'
                                    });
                                    
                                    db.run('COMMIT');
                                    res.json({ 
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
        } catch (error) {
            console.error('Помилка в writeoffBatch:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
    
    static async getProductAvailability(req, res) {
        try {
            const productId = parseInt(req.params.productId);
            
            if (isNaN(productId)) {
                return res.status(400).json({ error: 'Некоректний ID товару' });
            }
            
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
                    console.error('Помилка отримання доступності товару:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }
                
                if (!result) {
                    return res.status(404).json({ error: 'Товар не знайдено' });
                }
                
                const totalAvailable = result.total_available_in_batches;
                const stockStatus = totalAvailable < result.min_stock_pieces ? 'low' : 
                                   totalAvailable < result.min_stock_pieces * 2 ? 'warning' : 'good';
                
                res.json({
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
            
        } catch (error) {
            console.error('Помилка в getProductAvailability:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
}

module.exports = BatchController;