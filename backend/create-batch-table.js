const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Створюємо базу в корені проекту
const dbPath = path.join(__dirname, '..', 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Створюємо таблицю production_batches...');

db.serialize(() => {
    // Спочатку створюємо базові таблиці якщо їх немає
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        weight REAL,
        barcode TEXT,
        pieces_per_box INTEGER DEFAULT 1,
        stock_pieces INTEGER DEFAULT 0,
        stock_boxes INTEGER DEFAULT 0,
        min_stock_pieces INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці products:', err.message);
        } else {
            console.log('✅ Таблиця products готова');
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS production (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        production_date DATE NOT NULL,
        production_time TIME,
        total_quantity INTEGER NOT NULL,
        boxes_quantity INTEGER DEFAULT 0,
        pieces_quantity INTEGER DEFAULT 0,
        expiry_date DATE,
        responsible TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці production:', err.message);
        } else {
            console.log('✅ Таблиця production готова');
        }
    });

    // Створюємо таблицю партій
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

    // Додаємо тестові дані
    db.run(`INSERT OR IGNORE INTO products (id, name, code, pieces_per_box) VALUES 
        (1, 'Піца Маргарита', 'MARG', 8),
        (2, 'Піца Пепероні', 'PEPR', 8),
        (3, 'Піца Гавайська', 'HAWA', 8)`, (err) => {
        if (err) {
            console.error('❌ Помилка додавання тестових товарів:', err.message);
        } else {
            console.log('✅ Тестові товари додані');
        }
    });

    // Додаємо тестове виробництво
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryDate = expiry.toISOString().split('T')[0];

    db.run(`INSERT OR IGNORE INTO production (id, product_id, production_date, total_quantity, expiry_date, responsible) VALUES 
        (1, 1, ?, 50, ?, 'system'),
        (2, 2, ?, 30, ?, 'system')`, [today, expiryDate, today, expiryDate], (err) => {
        if (err) {
            console.error('❌ Помилка додавання тестового виробництва:', err.message);
        } else {
            console.log('✅ Тестове виробництво додано');
        }
    });

    // Створюємо індекси для оптимізації
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

    // Закриваємо базу після всіх операцій
    setTimeout(() => {
        db.close((err) => {
            if (err) {
                console.error('❌ Помилка закриття БД:', err.message);
            } else {
                console.log('🎉 База даних готова до роботи!');
                console.log(`📂 Файл бази: ${dbPath}`);
            }
        });
    }, 1000);
}); 