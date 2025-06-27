// Створити файл create-production-batches.js в корені проекту

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
console.log('🔄 Створення таблиці партій...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Помилка підключення до БД:', err.message);
        process.exit(1);
    }
    console.log('✅ Підключено до БД');
});

db.serialize(() => {
    // Створюємо таблицю партій
    db.run(`CREATE TABLE IF NOT EXISTS production_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        production_date DATE NOT NULL,
        total_quantity INTEGER NOT NULL,
        available_quantity INTEGER NOT NULL DEFAULT 0,
        reserved_quantity INTEGER NOT NULL DEFAULT 0,
        used_quantity INTEGER NOT NULL DEFAULT 0,
        expiry_date DATE NOT NULL,
        production_id INTEGER,
        status TEXT DEFAULT 'ACTIVE',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (production_id) REFERENCES production (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці production_batches:', err.message);
        } else {
            console.log('✅ Таблиця production_batches створена успішно');
        }
    });

    // Створюємо індекси
    db.run(`CREATE INDEX IF NOT EXISTS idx_production_batches_product_date 
            ON production_batches (product_id, batch_date)`, (err) => {
        if (err) {
            console.error('❌ Помилка створення індексу product_date:', err.message);
        } else {
            console.log('✅ Індекс product_date створено');
        }
    });
        
    db.run(`CREATE INDEX IF NOT EXISTS idx_production_batches_expiry 
            ON production_batches (expiry_date, status)`, (err) => {
        if (err) {
            console.error('❌ Помилка створення індексу expiry:', err.message);
        } else {
            console.log('✅ Індекс expiry створено');
        }
    });
        
    db.run(`CREATE INDEX IF NOT EXISTS idx_production_batches_available 
            ON production_batches (product_id, available_quantity, status)`, (err) => {
        if (err) {
            console.error('❌ Помилка створення індексу available:', err.message);
        } else {
            console.log('✅ Індекс available створено');
        }
    });

    // Додаємо поле allocated_batches до order_items якщо його немає
    db.run(`ALTER TABLE order_items ADD COLUMN allocated_batches TEXT DEFAULT '[]'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля allocated_batches:', err.message);
        } else {
            console.log('✅ Поле allocated_batches додано до order_items');
        }
    });

    // Додаємо поля для відстеження партій в stock_movements
    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля batch_id:', err.message);
        } else {
            console.log('✅ Поле batch_id додано до stock_movements');
        }
    });

    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_date DATE`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля batch_date:', err.message);
        } else {
            console.log('✅ Поле batch_date додано до stock_movements');
        }
    });

    // Створюємо тестові партії для існуючих товарів зі stock_pieces > 0
    db.run(`INSERT INTO production_batches 
            (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, status, notes)
            SELECT 
                id as product_id,
                date('now', '-30 days') as batch_date,
                date('now', '-30 days') as production_date,
                stock_pieces as total_quantity,
                stock_pieces as available_quantity,
                date('now', '+300 days') as expiry_date,
                'ACTIVE' as status,
                'Початковий залишок (автоматично створено)' as notes
            FROM products 
            WHERE stock_pieces > 0
            AND id NOT IN (SELECT DISTINCT product_id FROM production_batches WHERE batch_date = date('now', '-30 days'))`, 
            function(err) {
                if (err) {
                    console.error('❌ Помилка створення тестових партій:', err.message);
                } else {
                    console.log(`✅ Створено ${this.changes} тестових партій для існуючих товарів`);
                }
            });

    console.log('🎉 Міграція завершена успішно!');
    console.log('');
    console.log('📝 Наступні кроки:');
    console.log('1. Перезапустіть сервер: npm start');
    console.log('2. Перейдіть в розділ "Партії" для перевірки');
    console.log('3. Створіть тестове виробництво');
    
    db.close((err) => {
        if (err) {
            console.error('❌ Помилка закриття БД:', err.message);
        } else {
            console.log('✅ БД закрита');
        }
    });
});