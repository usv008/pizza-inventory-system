const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Починаємо міграцію партійної системи...');

db.serialize(() => {
    // 1. Створюємо таблицю партій
    db.run(`CREATE TABLE IF NOT EXISTS production_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        production_date DATE NOT NULL,
        total_quantity INTEGER NOT NULL,
        available_quantity INTEGER NOT NULL,
        reserved_quantity INTEGER DEFAULT 0,
        expiry_date DATE NOT NULL,
        production_id INTEGER,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (production_id) REFERENCES production (id),
        UNIQUE(product_id, batch_date)
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці production_batches:', err.message);
        } else {
            console.log('✅ Таблиця production_batches створена');
        }
    });

    // 2. Додаємо колонки до існуючих таблиць
    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання batch_id:', err.message);
        } else {
            console.log('✅ Колонка batch_id додана до stock_movements');
        }
    });

    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_date DATE`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання batch_date:', err.message);
        } else {
            console.log('✅ Колонка batch_date додана до stock_movements');
        }
    });

    db.run(`ALTER TABLE order_items ADD COLUMN allocated_batches TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання allocated_batches:', err.message);
        } else {
            console.log('✅ Колонка allocated_batches додана до order_items');
        }
    });

    // 3. Створюємо партії з існуючих записів виробництва
    db.all(`SELECT * FROM production ORDER BY production_date, id`, (err, productions) => {
        if (err) {
            console.error('❌ Помилка читання виробництва:', err.message);
            return;
        }

        console.log(`📦 Створюємо партії з ${productions.length} записів виробництва...`);
        
        let processedCount = 0;
        
        if (productions.length === 0) {
            console.log('ℹ️ Немає записів виробництва для міграції');
            db.close();
            return;
        }
        
        productions.forEach(prod => {
            const batchData = {
                product_id: prod.product_id,
                batch_date: prod.production_date,
                production_date: prod.production_date,
                total_quantity: prod.total_quantity,
                available_quantity: prod.total_quantity, // Початково вся кількість доступна
                expiry_date: prod.expiry_date,
                production_id: prod.id
            };

            db.run(`INSERT OR IGNORE INTO production_batches 
                (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, production_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [batchData.product_id, batchData.batch_date, batchData.production_date, 
                 batchData.total_quantity, batchData.available_quantity, batchData.expiry_date, batchData.production_id],
                function(err) {
                    if (err) {
                        console.error(`❌ Помилка створення партії для виробництва ${prod.id}:`, err.message);
                    } else {
                        console.log(`✅ Партія створена: ${batchData.batch_date} (${batchData.total_quantity} шт)`);
                    }
                    
                    processedCount++;
                    if (processedCount === productions.length) {
                        console.log('🎉 Міграція завершена успішно!');
                        console.log('📋 Рекомендується запустити npm start для перевірки роботи системи');
                        db.close();
                    }
                }
            );
        });
    });

    // 4. Створюємо індекси для оптимізації
    db.run(`CREATE INDEX IF NOT EXISTS idx_batches_product_date ON production_batches(product_id, batch_date)`, (err) => {
        if (err) {
            console.error('❌ Помилка створення індексу:', err.message);
        } else {
            console.log('✅ Індекс для партій створено');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_batches_expiry ON production_batches(expiry_date, status)`, (err) => {
        if (err) {
            console.error('❌ Помилка створення індексу термінів:', err.message);
        } else {
            console.log('✅ Індекс термінів придатності створено');
        }
    });
});

module.exports = { 
    runMigration: () => {
        console.log('Міграція партійної системи запущена...');
        // Логіка міграції вже виконується при require цього файлу
    }
};