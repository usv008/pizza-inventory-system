const db = require('../database').db;
const OperationsLogController = require('./operations-log-controller');

// Створити документ приходу
exports.createArrival = (req, res) => {
    const { arrival_date, reason, created_by, items } = req.body;
    
    if (!arrival_date || !reason || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Некоректні дані для оприходування' });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Генеруємо arrival_number (YYYYMMDD-XXX)
        db.get('SELECT COUNT(*) as count FROM arrivals WHERE arrival_date = ?', [arrival_date], (err, row) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'DB error' });
            }
            
            const count = row.count + 1;
            const arrival_number = `${arrival_date.replace(/-/g, '')}-${String(count).padStart(3, '0')}`;
            
            db.run(`INSERT INTO arrivals (arrival_number, arrival_date, reason, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [arrival_number, arrival_date, reason, created_by || 'system'],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'DB error' });
                    }
                    
                    const arrival_id = this.lastID;
                    let completed = 0;
                    let hasError = false;
                    
                    items.forEach(item => {
                        if (hasError) return;
                        
                        const { product_id, quantity, batch_date, notes } = item;
                        
                        if (!product_id || !quantity || !batch_date) {
                            hasError = true;
                            db.run('ROLLBACK');
                            return res.status(400).json({ error: 'Некоректна позиція' });
                        }
                        
                        // Додаємо позицію в arrivals_items
                        db.run(`INSERT INTO arrivals_items (arrival_id, product_id, quantity, batch_date, notes, created_at)
                                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [arrival_id, product_id, quantity, batch_date, notes || ''],
                            function(err) {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'DB error' });
                                }
                                
                                // Оновлюємо партію (або створюємо)
                                db.get(`SELECT * FROM production_batches WHERE product_id = ? AND batch_date = ?`,
                                    [product_id, batch_date], (err, batch) => {
                                    if (err) {
                                        hasError = true;
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'DB error' });
                                    }
                                    
                                    if (batch) {
                                        // Якщо партія існує (навіть якщо закінчилась) — реактивуємо і додаємо кількість
                                        db.run(`UPDATE production_batches 
                                               SET available_quantity = available_quantity + ?, 
                                                   total_quantity = total_quantity + ?, 
                                                   status = 'ACTIVE', 
                                                   updated_at = CURRENT_TIMESTAMP 
                                               WHERE id = ?`,
                                            [quantity, quantity, batch.id], (err) => {
                                            if (err) {
                                                hasError = true;
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'DB error' });
                                            }
                                            updateProductAndFinish();
                                        });
                                    } else {
                                        // Якщо партії не було — створюємо нову
                                        db.run(`INSERT INTO production_batches 
                                               (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, status, created_at, updated_at)
                                               VALUES (?, ?, ?, ?, ?, DATE(?, '+365 day'), 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                                            [product_id, batch_date, batch_date, quantity, quantity, batch_date], (err) => {
                                            if (err) {
                                                hasError = true;
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'DB error' });
                                            }
                                            updateProductAndFinish();
                                        });
                                    }
                                    
                                    // Оновлюємо залишки товару
                                    function updateProductAndFinish() {
                                        db.get('SELECT stock_pieces FROM products WHERE id = ?', [product_id], (err, prod) => {
                                            if (err) {
                                                hasError = true;
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'DB error' });
                                            }
                                            
                                            let newStock = (prod ? prod.stock_pieces : 0) + quantity;
                                            
                                            db.run('UPDATE products SET stock_pieces = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                                                   [newStock, product_id], (err) => {
                                                if (err) {
                                                    hasError = true;
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: 'DB error' });
                                                }
                                                
                                                // Додаємо рух IN
                                                db.run(`INSERT INTO stock_movements 
                                                       (product_id, movement_type, pieces, boxes, reason, user, batch_id, batch_date, created_at)
                                                       VALUES (?, 'IN', ?, 0, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`,
                                                    [product_id, quantity, reason, created_by || 'system', batch_date], (err) => {
                                                    if (err) {
                                                        hasError = true;
                                                        db.run('ROLLBACK');
                                                        return res.status(500).json({ error: 'DB error' });
                                                    }
                                                    
                                                    completed++;
                                                    if (completed === items.length && !hasError) {
                                                        // Успішно завершили всі операції - логуємо та відповідаємо
                                                        finalizeArrival();
                                                    }
                                                });
                                            });
                                        });
                                    }
                                });
                            });
                    });
                    
                    // Функція для фіналізації приходу з логуванням
                    async function finalizeArrival() {
                        try {
                            // Розраховуємо загальну кількість для логування
                            const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
                            
                            // Логуємо операцію приходу
                            await OperationsLogController.logOperation({
                                operation_type: OperationsLogController.OPERATION_TYPES.ARRIVAL,
                                operation_id: arrival_id,
                                entity_type: 'arrival',
                                entity_id: arrival_id,
                                new_data: {
                                    arrival_number: arrival_number,
                                    arrival_date: arrival_date,
                                    reason: reason,
                                    items_count: items.length,
                                    total_quantity: totalQuantity,
                                    created_by: created_by || 'system'
                                },
                                description: `Оприходування №${arrival_number}: ${totalQuantity} шт (${items.length} позицій) - ${reason}`,
                                user_name: created_by || 'system',
                                ip_address: req.ip || null,
                                user_agent: req.get('User-Agent') || null
                            });
                            
                            console.log(`✅ Логування приходу ${arrival_number} успішне`);
                        } catch (logError) {
                            console.error('❌ Помилка логування приходу:', logError);
                            // Не блокуємо операцію через помилку логування
                        }
                        
                        // Завершуємо транзакцію та відповідаємо
                        db.run('COMMIT');
                        res.json({ success: true, arrival_number });
                    }
                }
            );
        });
    });
};