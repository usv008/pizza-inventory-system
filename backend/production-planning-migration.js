const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Починаємо міграцію для планування виробництва...');

db.serialize(() => {
    // Таблиця виробничих планів
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
    )`, (err) => {
        if (err) {
            console.error('Помилка створення таблиці production_plans:', err.message);
        } else {
            console.log('✅ Таблиця production_plans створена');
        }
    });

    // Таблиця позицій планів
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
    )`, (err) => {
        if (err) {
            console.error('Помилка створення таблиці production_plan_items:', err.message);
        } else {
            console.log('✅ Таблиця production_plan_items створена');
        }
    });

    // Таблиця налаштувань виробництва
    db.run(`CREATE TABLE IF NOT EXISTS production_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_capacity INTEGER DEFAULT 500,
        working_hours INTEGER DEFAULT 8,
        min_batch_size INTEGER DEFAULT 10,
        cost_per_unit REAL DEFAULT 0,
        settings_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Помилка створення таблиці production_settings:', err.message);
        } else {
            console.log('✅ Таблиця production_settings створена');
        }
    });

    // Додаємо початкові налаштування
    db.run(`INSERT OR IGNORE INTO production_settings 
        (id, daily_capacity, working_hours, min_batch_size, cost_per_unit) 
        VALUES (1, 500, 8, 10, 15.50)`, (err) => {
        if (err) {
            console.error('Помилка додавання початкових налаштувань:', err.message);
        } else {
            console.log('✅ Початкові налаштування виробництва додані');
        }
    });

    // Створюємо індекси для оптимізації
    db.run(`CREATE INDEX IF NOT EXISTS idx_production_plans_date ON production_plans (plan_date)`, (err) => {
        if (err) {
            console.error('Помилка створення індексу:', err.message);
        } else {
            console.log('✅ Індекс для дат планів створено');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_plan_items_plan_id ON production_plan_items (plan_id)`, (err) => {
        if (err) {
            console.error('Помилка створення індексу:', err.message);
        } else {
            console.log('✅ Індекс для позицій планів створено');
        }
    });

    // Додаємо тестовий план на сьогодні
    const today = new Date().toISOString().split('T')[0];
    
    db.run(`INSERT OR IGNORE INTO production_plans 
        (plan_date, status, total_planned, notes, created_by) 
        VALUES (?, 'ACTIVE', 276, 'Тестовий план на сьогодні', 'system')`, [today], function(err) {
        if (err) {
            console.error('Помилка створення тестового плану:', err.message);
        } else if (this.changes > 0) {
            console.log('✅ Тестовий план створено');
            
            const planId = this.lastID;
            
            // Додаємо тестові позиції плану
            const testItems = [
                [planId, 1, 180, 180, 'CRITICAL', 'ORDER', 'Термінове замовлення'],
                [planId, 2, 96, 96, 'HIGH', 'MIN_STOCK', 'Низькі залишки']
            ];
            
            testItems.forEach(item => {
                db.run(`INSERT INTO production_plan_items 
                    (plan_id, product_id, quantity_needed, quantity_planned, priority, reason, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`, item, (err) => {
                    if (err) {
                        console.error('Помилка додавання тестової позиції:', err.message);
                    }
                });
            });
        } else {
            console.log('ℹ️ Тестовий план вже існує');
        }
        
        db.close((err) => {
            if (err) {
                console.error('Помилка закриття БД:', err.message);
            } else {
                console.log('🎉 Міграція планування виробництва завершена успішно!');
            }
        });
    });
});