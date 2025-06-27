const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                weight REAL NOT NULL,
                barcode TEXT UNIQUE,
                pieces_per_box INTEGER NOT NULL DEFAULT 1,
                stock_pieces INTEGER DEFAULT 0,
                stock_boxes INTEGER DEFAULT 0,
                min_stock_pieces INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                movement_type TEXT NOT NULL,
                pieces INTEGER NOT NULL,
                boxes INTEGER NOT NULL,
                reason TEXT,
                user TEXT DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                client_id INTEGER,
                client_name TEXT NOT NULL,
                client_contact TEXT,
                order_date DATE NOT NULL,
                delivery_date DATE,
                status TEXT DEFAULT 'NEW',
                total_quantity INTEGER DEFAULT 0,
                total_boxes INTEGER DEFAULT 0,
                notes TEXT,
                created_by TEXT DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                boxes INTEGER NOT NULL,
                pieces INTEGER NOT NULL,
                reserved_quantity INTEGER DEFAULT 0,
                produced_quantity INTEGER DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS writeoffs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                writeoff_date DATE NOT NULL,
                total_quantity INTEGER NOT NULL,
                boxes_quantity INTEGER NOT NULL,
                pieces_quantity INTEGER NOT NULL,
                reason TEXT NOT NULL,
                responsible TEXT NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS production (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                production_date DATE NOT NULL,
                production_time TEXT,
                total_quantity INTEGER NOT NULL,
                boxes_quantity INTEGER NOT NULL,
                pieces_quantity INTEGER NOT NULL,
                expiry_date DATE NOT NULL,
                responsible TEXT DEFAULT 'system',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )`);

            db.run(`INSERT OR IGNORE INTO products 
                (name, code, weight, barcode, pieces_per_box, stock_pieces, stock_boxes, min_stock_pieces) 
                VALUES 
                ('Піца Маргарита', 'PM001', 350, '4820000001234', 12, 144, 12, 24),
                ('Піца Пепероні', 'PP002', 380, '4820000001241', 12, 96, 8, 36),
                ('Піца Гавайська', 'PH003', 400, '4820000001258', 10, 50, 5, 20),
                ('Піца Чотири Сири', 'PC004', 420, '4820000001265', 8, 32, 4, 16)`);

            db.run(`CREATE TABLE IF NOT EXISTS production_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_date DATE NOT NULL,
                status TEXT DEFAULT 'DRAFT',
                total_planned INTEGER DEFAULT 0,
                total_produced INTEGER DEFAULT 0,
                created_by TEXT DEFAULT 'system',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS production_plan_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity_needed INTEGER NOT NULL,
                quantity_planned INTEGER NOT NULL,
                quantity_produced INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'MEDIUM',
                reason TEXT DEFAULT 'OTHER',
                order_id INTEGER,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES production_plans (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS production_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                daily_capacity INTEGER DEFAULT 500,
                working_hours INTEGER DEFAULT 8,
                min_batch_size INTEGER DEFAULT 10,
                cost_per_unit REAL DEFAULT 0,
                settings_json TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`INSERT OR IGNORE INTO production_settings 
                (id, daily_capacity, working_hours, min_batch_size) 
                VALUES (1, 500, 8, 10)`);

            console.log('📦 База даних ініціалізована успішно');
            resolve();
        });
    });
}

const productQueries = {
    getAll: () => new Promise((resolve, reject) => {
        db.all(`
            SELECT *,
            CAST(stock_pieces / pieces_per_box AS INTEGER) as stock_boxes,
            ROUND(stock_pieces * 1.0 / pieces_per_box, 2) as calculated_boxes,
            CASE 
                WHEN stock_pieces < min_stock_pieces THEN 'low'
                WHEN stock_pieces < min_stock_pieces * 2 THEN 'warning'
                ELSE 'good'
            END as stock_status
            FROM products 
            ORDER BY name
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    }),
    getById: (id) => new Promise((resolve, reject) => {
        db.get(`
            SELECT *,
            CAST(stock_pieces / pieces_per_box AS INTEGER) as stock_boxes,
            ROUND(stock_pieces * 1.0 / pieces_per_box, 2) as calculated_boxes
            FROM products 
            WHERE id = ?
        `, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    }),
    create: (product) => new Promise((resolve, reject) => {
        const { name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces } = product;
        db.run(`
            INSERT INTO products 
            (name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces], 
        function(err) {
            if (err) return reject(err);
            if (stock_pieces > 0) {
                db.run(`
                    INSERT INTO stock_movements 
                    (product_id, movement_type, pieces, boxes, reason)
                    VALUES (?, 'IN', ?, CAST(? / ? AS INTEGER), 'Початковий залишок')
                `, [this.lastID, stock_pieces, stock_pieces, pieces_per_box]);
            }
            resolve({ id: this.lastID });
        });
    }),
    update: (id, product) => new Promise((resolve, reject) => {
        const { name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces } = product;
        db.run(`
            UPDATE products 
            SET name = ?, code = ?, weight = ?, barcode = ?, pieces_per_box = ?, stock_pieces = ?, min_stock_pieces = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces, id], 
        function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    }),
    delete: (id) => new Promise((resolve, reject) => {
        db.run(`DELETE FROM products WHERE id = ?`, [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    }),
    updateStock: (productId, pieceChange, reason, movementType = 'ADJUSTMENT') => new Promise((resolve, reject) => {
        db.get("SELECT pieces_per_box, stock_pieces FROM products WHERE id = ?", [productId], (err, product) => {
            if (err) return reject(err);
            if (!product) return reject(new Error('Товар не знайдено'));
            let newStock = product.stock_pieces + pieceChange;
            if (newStock < 0) newStock = 0;
            const boxesChange = pieceChange / product.pieces_per_box;
            db.run(`UPDATE products SET stock_pieces = ? WHERE id = ?`, [newStock, productId], function(err) {
                if (err) return reject(err);
                db.run(`INSERT INTO stock_movements (product_id, movement_type, pieces, boxes, reason) VALUES (?, ?, ?, ?, ?)`,
                    [productId, movementType, pieceChange, boxesChange, reason], (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                });
            });
        });
    })
};

// Оновлені productionQueries для роботи з партіями
// Цей код замінює існуючий productionQueries в database.js

const productionQueries = {
    create: (record) => new Promise((resolve, reject) => {
        let { product_id, production_date, total_quantity, expiry_date, responsible, notes, production_time } = record;
        
        // Якщо expiry_date не передано — додаємо 365 днів до production_date
        if (!expiry_date && production_date) {
            const date = new Date(production_date);
            date.setDate(date.getDate() + 365);
            expiry_date = date.toISOString().split('T')[0];
        }
        
        // Додаємо production_time (HH:MM:SS, Europe/Kyiv)
        if (!production_time) {
            const now = new Date();
            const kyivTime = now.toLocaleTimeString('uk-UA', { hour12: false, timeZone: 'Europe/Kyiv' });
            production_time = kyivTime;
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Отримуємо інформацію про товар
            db.get("SELECT pieces_per_box FROM products WHERE id = ?", [product_id], (err, product) => {
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

                // 1. Створюємо запис виробництва
                db.run(`INSERT INTO production 
                       (product_id, production_date, production_time, total_quantity, boxes_quantity, pieces_quantity, expiry_date, responsible, notes) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [product_id, production_date, production_time, total_quantity, boxes_quantity, pieces_quantity, expiry_date, responsible, notes],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const productionId = this.lastID;

                        // 2. Створюємо або оновлюємо партію
                        db.get(`SELECT * FROM production_batches WHERE product_id = ? AND batch_date = ?`, 
                               [product_id, production_date], (err, existingBatch) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            if (existingBatch) {
                                // Оновлюємо існуючу партію
                                db.run(`UPDATE production_batches 
                                       SET total_quantity = total_quantity + ?,
                                           available_quantity = available_quantity + ?,
                                           updated_at = CURRENT_TIMESTAMP
                                       WHERE id = ?`, 
                                       [total_quantity, total_quantity, existingBatch.id], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    
                                    console.log(`✅ Оновлено існуючу партію ${existingBatch.id}: +${total_quantity} шт`);
                                    
                                    // 3. Створюємо запис руху з прив'язкою до партії
                                    createStockMovement(existingBatch.id);
                                });
                            } else {
                                // Створюємо нову партію
                                db.run(`INSERT INTO production_batches 
                                       (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, production_id, status, notes)
                                       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'Створено автоматично')`,
                                       [product_id, production_date, production_date, total_quantity, total_quantity, expiry_date, productionId], 
                                       function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    
                                    console.log(`✅ Створено нову партію ${this.lastID}: ${total_quantity} шт`);
                                    
                                    // 3. Створюємо запис руху з прив'язкою до партії
                                    createStockMovement(this.lastID);
                                });
                            }

                            function createStockMovement(batchId) {
                                db.run(`INSERT INTO stock_movements 
                                       (product_id, movement_type, pieces, boxes, reason, user, batch_id, batch_date)
                                       VALUES (?, 'PRODUCTION', ?, ?, ?, ?, ?, ?)`,
                                    [product_id, total_quantity, Math.floor(total_quantity / product.pieces_per_box), 
                                     `Виробництво партії ${production_date}`, responsible || 'system', batchId, production_date], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    // 4. Оновлюємо загальні залишки товару
                                    db.run(`UPDATE products 
                                           SET stock_pieces = stock_pieces + ?, 
                                               updated_at = CURRENT_TIMESTAMP
                                           WHERE id = ?`, 
                                           [total_quantity, product_id], (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        db.run('COMMIT');
                                        console.log(`🎉 Виробництво ${productionId} створено з партією ${production_date}`);
                                        resolve({ 
                                            id: productionId,
                                            boxes_quantity,
                                            pieces_quantity,
                                            batch_date: production_date
                                        });
                                    });
                                });
                            }
                        });
                    }
                );
            });
        });
    }),

    // Решта методів залишаються без змін...
    getAll: () => new Promise((resolve, reject) => {
        const sql = `
            SELECT p.*, pr.name as product_name, pr.code as product_code, 
                   pb.batch_date, pb.available_quantity as batch_available
            FROM production p 
            JOIN products pr ON p.product_id = pr.id 
            LEFT JOIN production_batches pb ON p.id = pb.production_id
            ORDER BY p.production_date DESC, p.production_time DESC
        `;
        
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    }),

    getByProductId: (productId) => new Promise((resolve, reject) => {
        const sql = `
            SELECT p.*, pr.name as product_name, pr.code as product_code,
                   pb.batch_date, pb.available_quantity as batch_available
            FROM production p 
            JOIN products pr ON p.product_id = pr.id 
            LEFT JOIN production_batches pb ON p.id = pb.production_id
            WHERE p.product_id = ?
            ORDER BY p.production_date DESC, p.production_time DESC
        `;
        
        db.all(sql, [productId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    })
};

// Оновлені writeoffQueries для роботи з партіями
// Цей код замінює існуючий writeoffQueries в database.js

const writeoffQueries = {
    create: (record) => new Promise((resolve, reject) => {
        const { product_id, writeoff_date, total_quantity, reason, responsible, notes } = record;
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Отримуємо інформацію про товар
            db.get("SELECT stock_pieces FROM products WHERE id = ?", [product_id], (err, prod) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                let newStock = prod ? prod.stock_pieces - total_quantity : 0;
                if (newStock < 0) newStock = 0;
                db.run(`UPDATE products 
                    SET stock_pieces = ?, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`, 
                    [newStock, product_id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    // 3. Створюємо запис руху (загальне списання без партії)
                    db.run(`INSERT INTO stock_movements 
                        (product_id, movement_type, pieces, boxes, reason, user, batch_id, batch_date)
                        VALUES (?, 'WRITEOFF', ?, ?, ?, ?, NULL, NULL)`,
                        [product_id, -total_quantity, -boxes_quantity, 
                        `Списання: ${reason}`, responsible], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        db.run('COMMIT');
                        resolve({ 
                            id: writeoffId,
                            boxes_quantity,
                            pieces_quantity
                        });
                    });
                });
            });
        });
    }),

    getAll: () => new Promise((resolve, reject) => {
        const sql = `
            SELECT w.*, p.name as product_name, p.code as product_code,
                   sm.batch_date, sm.batch_id
            FROM writeoffs w 
            JOIN products p ON w.product_id = p.id 
            LEFT JOIN stock_movements sm ON w.product_id = sm.product_id 
                AND sm.movement_type = 'WRITEOFF' 
                AND date(sm.created_at) = w.writeoff_date
                AND sm.reason LIKE 'Списання%'
            ORDER BY w.writeoff_date DESC, w.created_at DESC
        `;
        
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    }),

    getByProductId: (productId) => new Promise((resolve, reject) => {
        const sql = `
            SELECT w.*, p.name as product_name, p.code as product_code,
                   sm.batch_date, sm.batch_id
            FROM writeoffs w 
            JOIN products p ON w.product_id = p.id 
            LEFT JOIN stock_movements sm ON w.product_id = sm.product_id 
                AND sm.movement_type = 'WRITEOFF' 
                AND date(sm.created_at) = w.writeoff_date
            WHERE w.product_id = ?
            ORDER BY w.writeoff_date DESC, w.created_at DESC
        `;
        
        db.all(sql, [productId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    })
};

const clientQueries = {
    getAll: () => new Promise((resolve, reject) => {
        db.all("SELECT * FROM clients WHERE is_active = 1 ORDER BY name", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    }),
    create: (client) => new Promise((resolve, reject) => {
        const { name, contact_person, phone, email, address, notes } = client;
        db.run(`INSERT INTO clients (name, contact_person, phone, email, address, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [name, contact_person, phone, email, address, notes],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    }),
    deactivate: (id) => new Promise((resolve, reject) => {
        db.run("UPDATE clients SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    })
};

// Оновлені orderQueries в database.js - додано резервування партій

const orderQueries = {
    getAll: () => new Promise((resolve, reject) => {
        const sql = `
            SELECT o.id, o.order_number, o.client_name, o.client_contact, o.order_date, o.delivery_date, o.status, o.total_quantity, o.total_boxes, o.created_by, o.notes,
                   COUNT(oi.id) as items_count,
                   SUM(oi.quantity) as items_total_quantity
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            GROUP BY o.id
            ORDER BY o.order_date DESC
        `;
        db.all(sql, (err, rows) => {
            if (err) {
                console.error('[orderQueries.getAll] DB ERROR:', err);
                return reject(err);
            }
            resolve(rows);
        });
    }),

    getById: (id) => new Promise((resolve, reject) => {
        const sql = `
            SELECT o.*, 
                   COUNT(oi.id) as items_count,
                   SUM(oi.quantity) as items_total_quantity
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ?
            GROUP BY o.id
            LIMIT 1
        `;
        db.get(sql, [id], (err, order) => {
            if (err) {
                console.error('[orderQueries.getById] DB ERROR:', err);
                return reject(err);
            }
            if (!order) return resolve(null);

            // Отримуємо позиції з інформацією про зарезервовані партії
            db.all(
                `SELECT oi.*, p.name as product_name, p.code as product_code,
                        p.pieces_per_box
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [id],
                (err, items) => {
                    if (err) {
                        console.error('[orderQueries.getById] DB ERROR (items):', err);
                        return reject(err);
                    }
                    
                    // Парсимо allocated_batches JSON для кожної позиції
                    const itemsWithBatches = items.map(item => ({
                        ...item,
                        allocated_batches: item.allocated_batches ? 
                            (typeof item.allocated_batches === 'string' ? JSON.parse(item.allocated_batches) : item.allocated_batches) : []
                    }));
                    
                    order.items = itemsWithBatches || [];
                    resolve(order);
                }
            );
        });
    }),

    updateStatus: (id, status, updated_by) => new Promise((resolve, reject) => {
        db.run(
            `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP, created_by = ? WHERE id = ?`,
            [status, updated_by || 'system', id],
            function(err) {
                if (err) {
                    console.error('[orderQueries.updateStatus] DB ERROR:', err);
                    return reject(err);
                }
                resolve({ changes: this.changes });
            }
        );
    }),

    create: (order) => new Promise((resolve, reject) => {
        const { client_id, client_name, client_contact, order_date, delivery_date, notes, created_by, items } = order;
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Генеруємо order_number
            const datePart = order_date.replace(/-/g, '');
            db.get('SELECT COUNT(*) as count FROM orders WHERE order_date = ?', [order_date], (err, row) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                
                const count = row.count + 1;
                const order_number = `${datePart}-${count.toString().padStart(3, '0')}`;
                
                // Створюємо замовлення
                db.run(`INSERT INTO orders (order_number, client_id, client_name, client_contact, order_date, delivery_date, notes, created_by, created_at, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [order_number, client_id, client_name, client_contact, order_date, delivery_date, notes, created_by],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        const orderId = this.lastID;
                        
                        if (!items || !Array.isArray(items) || items.length === 0) {
                            db.run('COMMIT');
                            return resolve({ id: orderId, order_number });
                        }
                        
                        // Розраховуємо загальну кількість
                        const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);

                        // Обробляємо кожну позицію з резервуванням партій
                        processOrderItems(orderId, items, order_number, totalQuantity, resolve, reject);
                    }
                );
            });
        });

        // Функція обробки позицій замовлення з резервуванням
        function processOrderItems(orderId, items, order_number, totalQuantity, resolve, reject) {
            let completed = 0;
            let hasError = false;
            const getPiecesPerBox = (item, allocatedBatches, cb) => {
                // Пробуємо взяти з batch, якщо є
                if (allocatedBatches.length > 0 && allocatedBatches[0].pieces_per_box) {
                    return cb(allocatedBatches[0].pieces_per_box);
                }
                // Пробуємо взяти з products
                db.get('SELECT pieces_per_box FROM products WHERE id = ?', [item.product_id], (err, row) => {
                    if (err || !row) return cb(1);
                    cb(row.pieces_per_box);
                });
            };
            items.forEach((item, index) => {
                if (hasError) return;
                reserveBatchesForItem(item.product_id, item.quantity, (err, allocatedBatches) => {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        return reject(new Error(`Помилка резервування партій для товару ${item.product_id}: ${err.message}`));
                    }
                    getPiecesPerBox(item, allocatedBatches, (piecesPerBox) => {
                        piecesPerBox = piecesPerBox || 1;
                        const boxes = Math.floor(item.quantity / piecesPerBox);
                        const pieces = item.quantity % piecesPerBox;
                        db.run(`INSERT INTO order_items (order_id, product_id, quantity, boxes, pieces, notes, allocated_batches, created_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [orderId, item.product_id, item.quantity, boxes, pieces, item.notes || '', 
                             JSON.stringify(allocatedBatches.map(b => ({ 
                                 batch_id: b.batch_id, 
                                 batch_date: b.batch_date,
                                 quantity: b.allocated_quantity 
                             })))],
                            function(err) {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                completed++;
                                if (completed === items.length) {
                                    db.run(`UPDATE orders SET total_quantity = ?, total_boxes = ? WHERE id = ?`, 
                                        [totalQuantity, Math.floor(totalQuantity / 10), orderId], (err) => {
                                        if (err) {
                                            console.error('Помилка оновлення загальної кількості:', err);
                                        }
                                        db.run('COMMIT');
                                        resolve({ id: orderId, order_number });
                                    });
                                }
                            }
                        );
                    });
                });
            });
        }

        // Функція резервування партій для позиції (FIFO логіка)
        function reserveBatchesForItem(productId, quantityNeeded, callback) {
            // Отримуємо доступні партії для товару (FIFO - найстаріші спочатку)
            db.all(`SELECT pb.*, p.pieces_per_box, p.name as product_name
                    FROM production_batches pb
                    JOIN products p ON pb.product_id = p.id
                    WHERE pb.product_id = ? 
                      AND pb.status = 'ACTIVE' 
                      AND pb.available_quantity > 0
                    ORDER BY pb.batch_date ASC, pb.created_at ASC`,
                [productId], (err, availableBatches) => {
                    if (err) {
                        return callback(err);
                    }
                    // Дозволяємо додавання навіть якщо партій немає або їх недостатньо
                    let totalAvailable = 0;
                    if (availableBatches && availableBatches.length > 0) {
                        totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.available_quantity, 0);
                    }
                    // Розподіляємо кількість по партіях (FIFO)
                    const allocatedBatches = [];
                    let remainingQuantity = quantityNeeded;
                    for (const batch of availableBatches) {
                        if (remainingQuantity <= 0) break;
                        const allocateFromBatch = Math.min(remainingQuantity, batch.available_quantity);
                        allocatedBatches.push({
                            batch_id: batch.id,
                            batch_date: batch.batch_date,
                            allocated_quantity: allocateFromBatch,
                            product_name: batch.product_name,
                            pieces_per_box: batch.pieces_per_box
                        });
                        remainingQuantity -= allocateFromBatch;
                    }
                    // Якщо залишилась недостача — додаємо "batch" з null
                    if (remainingQuantity > 0) {
                        allocatedBatches.push({
                            batch_id: null,
                            batch_date: null,
                            allocated_quantity: remainingQuantity,
                            product_name: null,
                            pieces_per_box: null,
                            shortage: true
                        });
                    }
                    // Резервуємо тільки ті, що мають batch_id
                    reserveBatchesInDatabase(allocatedBatches.filter(b => b.batch_id), (err) => {
                        if (err) return callback(err);
                        callback(null, allocatedBatches);
                    });
                }
            );
        }

        // Функція резервування партій в базі даних
        function reserveBatchesInDatabase(allocatedBatches, callback) {
            let processedBatches = 0;
            let hasError = false;
            
            if (allocatedBatches.length === 0) {
                return callback(null, []);
            }
            
            allocatedBatches.forEach(allocation => {
                if (hasError) return;
                
                db.run(`UPDATE production_batches 
                        SET reserved_quantity = reserved_quantity + ?,
                            available_quantity = available_quantity - ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                    [allocation.allocated_quantity, allocation.allocated_quantity, allocation.batch_id],
                    function(err) {
                        if (err) {
                            hasError = true;
                            return callback(err);
                        }
                        
                        processedBatches++;
                        if (processedBatches === allocatedBatches.length) {
                            callback(null, allocatedBatches);
                        }
                    }
                );
            });
        }
    })
};

const movementsQueries = {
    getAll: (filters = {}) => new Promise((resolve, reject) => {
        let sql = `
            SELECT 
                sm.id,
                sm.movement_type,
                sm.pieces,
                sm.boxes,
                sm.reason,
                sm.user,
                sm.created_at,
                p.name as product_name,
                p.code as product_code
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.product_id) {
            sql += ' AND sm.product_id = ?';
            params.push(filters.product_id);
        }
        if (filters.movement_type) {
            sql += ' AND sm.movement_type = ?';
            params.push(filters.movement_type);
        }
        if (filters.date_from) {
            sql += ' AND date(sm.created_at) >= date(?)';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            sql += ' AND date(sm.created_at) <= date(?)';
            params.push(filters.date_to);
        }
        sql += '\nORDER BY sm.created_at DESC\nLIMIT 200';
        console.log('[movementsQueries.getAll] SQL:', sql);
        console.log('[movementsQueries.getAll] params:', params);
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[movementsQueries.getAll] DB ERROR:', err);
                return reject(err);
            }
            resolve(rows);
        });
    })
};

const planningQueries = {
    // Placeholder for planning queries
};

module.exports = {
    initDatabase,
    productQueries,
    productionQueries,
    writeoffQueries,
    clientQueries,
    orderQueries,
    movementsQueries,
    planningQueries,
    db
};
