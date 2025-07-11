// Hybrid database - combines Supabase queries with SQLite for production_batches
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Import existing Supabase queries
const supabaseDb = require('./supabase-database');

// SQLite connection for production_batches
const dbPath = path.join(__dirname, '..', 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('[HYBRID DB] Ініціалізація hybrid database...');

// Override batchQueries to use SQLite
const batchQueries = {
    getAll: async () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pb.*, p.name as product_name, p.code as product_code, p.pieces_per_box
                FROM production_batches pb
                LEFT JOIN products p ON pb.product_id = p.id
                ORDER BY pb.batch_date DESC
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('[HYBRID DB] Error in batchQueries.getAll:', err);
                    reject(err);
                } else {
                    console.log(`[HYBRID DB] ✅ Отримано ${rows.length} партій з SQLite`);
                    resolve(rows || []);
                }
            });
        });
    },

    getAllGroupedByProduct: async () => {
        return new Promise((resolve, reject) => {
            // Спочатку отримуємо товари (можна з mock Supabase)
            const getProducts = () => {
                return new Promise((resolve) => {
                    const sql = `SELECT id, name, code, pieces_per_box, min_stock_pieces FROM products ORDER BY name`;
                    db.all(sql, [], (err, rows) => {
                        if (err) {
                            console.warn('[HYBRID DB] Products from SQLite failed, using mock');
                            resolve([
                                { id: 1, name: 'Піца Маргарита', code: 'MARG', pieces_per_box: 8, min_stock_pieces: 10 },
                                { id: 2, name: 'Піца Пепероні', code: 'PEPR', pieces_per_box: 8, min_stock_pieces: 10 },
                                { id: 3, name: 'Піца Гавайська', code: 'HAWA', pieces_per_box: 8, min_stock_pieces: 10 }
                            ]);
                        } else {
                            resolve(rows);
                        }
                    });
                });
            };

            // Потім отримуємо партії
            const getBatches = () => {
                return new Promise((resolve) => {
                    const sql = `
                        SELECT * FROM production_batches 
                        WHERE status = 'ACTIVE' 
                        ORDER BY batch_date
                    `;
                    db.all(sql, [], (err, rows) => {
                        if (err) {
                            console.error('[HYBRID DB] Error getting batches:', err);
                            resolve([]);
                        } else {
                            resolve(rows || []);
                        }
                    });
                });
            };

            Promise.all([getProducts(), getBatches()])
                .then(([products, batches]) => {
                    // Групуємо партії по товарах
                    const result = products.map(product => {
                        const productBatches = batches.filter(batch => batch.product_id === product.id);
                        
                        // Розраховуємо кількості
                        const total_quantity = productBatches.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0);
                        const available_quantity = productBatches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
                        const reserved_quantity = productBatches.reduce((sum, batch) => sum + (batch.reserved_quantity || 0), 0);
                        
                        return {
                            product_id: product.id,
                            product_name: product.name,
                            product_code: product.code,
                            pieces_per_box: product.pieces_per_box,
                            total_quantity,
                            available_quantity,
                            reserved_quantity,
                            batches_count: productBatches.length,
                            batches: productBatches.map(batch => ({
                                id: batch.id,
                                production_id: batch.production_id,
                                batch_date: batch.batch_date,
                                production_date: batch.production_date,
                                expiry_date: batch.expiry_date,
                                total_quantity: batch.total_quantity,
                                available_quantity: batch.available_quantity,
                                reserved_quantity: batch.reserved_quantity || 0,
                                status: batch.status,
                                created_at: batch.created_at
                            }))
                        };
                    });
                    
                    console.log(`[HYBRID DB] ✅ Згруповано ${result.length} товарів з партіями`);
                    resolve(result);
                })
                .catch(reject);
        });
    },

    getByProductId: async (productId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pb.*, p.name as product_name, p.code as product_code, p.pieces_per_box
                FROM production_batches pb
                LEFT JOIN products p ON pb.product_id = p.id
                WHERE pb.product_id = ?
                ORDER BY pb.batch_date DESC
            `;
            
            db.all(sql, [productId], (err, rows) => {
                if (err) {
                    console.error('[HYBRID DB] Error in batchQueries.getByProductId:', err);
                    reject(err);
                } else {
                    console.log(`[HYBRID DB] ✅ Отримано ${rows.length} партій для товару ${productId}`);
                    resolve(rows || []);
                }
            });
        });
    },

    getExpiring: async (days = 7) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pb.*, p.name as product_name, p.code as product_code, p.pieces_per_box
                FROM production_batches pb
                LEFT JOIN products p ON pb.product_id = p.id
                WHERE pb.status = 'ACTIVE' 
                  AND pb.available_quantity > 0
                  AND pb.expiry_date <= date('now', '+' || ? || ' days')
                ORDER BY pb.expiry_date
            `;
            
            db.all(sql, [days], (err, rows) => {
                if (err) {
                    console.error('[HYBRID DB] Error in batchQueries.getExpiring:', err);
                    reject(err);
                } else {
                    console.log(`[HYBRID DB] ✅ Отримано ${rows.length} партій що закінчуються`);
                    resolve(rows || []);
                }
            });
        });
    },

    // Додатковий метод для створення партії з SQLite
    createBatch: async (batchData) => {
        return new Promise((resolve, reject) => {
            const { product_id, batch_date, production_date, total_quantity, expiry_date, production_id } = batchData;
            
            const sql = `
                INSERT INTO production_batches 
                (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, production_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            
            db.run(sql, [product_id, batch_date, production_date, total_quantity, total_quantity, expiry_date, production_id], function(err) {
                if (err) {
                    console.error('[HYBRID DB] Error creating batch:', err);
                    reject(err);
                } else {
                    console.log(`[HYBRID DB] ✅ Створено партію ID ${this.lastID} для товару ${product_id}`);
                    resolve({ id: this.lastID });
                }
            });
        });
    }
};

// Override productionQueries.create to also create batch
const originalProductionQueries = supabaseDb.productionQueries;
const productionQueries = {
    ...originalProductionQueries,
    
    create: async (record) => {
        try {
            // Викликаємо оригінальний create
            const result = await originalProductionQueries.create(record);
            
            // Додатково створюємо партію в SQLite
            await batchQueries.createBatch({
                product_id: record.product_id,
                batch_date: record.production_date,
                production_date: record.production_date,
                total_quantity: record.total_quantity,
                expiry_date: record.expiry_date,
                production_id: result.id
            });
            
            console.log('[HYBRID DB] ✅ Production + Batch створено успішно');
            return { ...result, batch_created: true };
        } catch (err) {
            console.error('[HYBRID DB] Error in hybrid production create:', err);
            throw err;
        }
    }
};

// Export hybrid database
module.exports = {
    ...supabaseDb,
    batchQueries,
    productionQueries
};

console.log('[HYBRID DB] ✅ Hybrid database ініціалізовано'); 