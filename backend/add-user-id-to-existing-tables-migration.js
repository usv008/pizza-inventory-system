const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('👤 Додавання user_id колонок до існуючих таблиць...');

    // Додавання user_id до таблиці orders
    db.run(`ALTER TABLE orders ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до orders:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до orders');
        }
    });

    // Додавання user_id до таблиці production
    db.run(`ALTER TABLE production ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до production:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до production');
        }
    });

    // Додавання user_id до таблиці writeoffs
    db.run(`ALTER TABLE writeoffs ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до writeoffs:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до writeoffs');
        }
    });

    // Додавання user_id до таблиці arrivals
    db.run(`ALTER TABLE arrivals ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до arrivals:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до arrivals');
        }
    });

    // Додавання user_id до таблиці operations_log
    db.run(`ALTER TABLE operations_log ADD COLUMN user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до operations_log:', err);
        } else {
            console.log('✅ Колонка user_id додана до operations_log');
        }
    });

    // Додавання user_id до таблиці stock_movements
    db.run(`ALTER TABLE stock_movements ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до stock_movements:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до stock_movements');
        }
    });

    // Додавання user_id до таблиці production_plans
    db.run(`ALTER TABLE production_plans ADD COLUMN created_by_user_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання user_id до production_plans:', err);
        } else {
            console.log('✅ Колонка created_by_user_id додана до production_plans');
        }
    });

    // Створення індексів для нових колонок
    setTimeout(() => {
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id ON orders(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_orders_created_by_user_id:', err);
            else console.log('✅ Індекс idx_orders_created_by_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_production_created_by_user_id ON production(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_production_created_by_user_id:', err);
            else console.log('✅ Індекс idx_production_created_by_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_writeoffs_created_by_user_id ON writeoffs(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_writeoffs_created_by_user_id:', err);
            else console.log('✅ Індекс idx_writeoffs_created_by_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_arrivals_created_by_user_id ON arrivals(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_arrivals_created_by_user_id:', err);
            else console.log('✅ Індекс idx_arrivals_created_by_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_operations_log_user_id ON operations_log(user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_operations_log_user_id:', err);
            else console.log('✅ Індекс idx_operations_log_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by_user_id ON stock_movements(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_stock_movements_created_by_user_id:', err);
            else console.log('✅ Індекс idx_stock_movements_created_by_user_id створено');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_production_plans_created_by_user_id ON production_plans(created_by_user_id)`, (err) => {
            if (err) console.error('❌ Помилка створення індексу idx_production_plans_created_by_user_id:', err);
            else console.log('✅ Індекс idx_production_plans_created_by_user_id створено');
        });

        console.log('🎉 Міграція user_id колонок завершена!');
        db.close();
    }, 1000); // Невелика затримка для завершення ALTER TABLE операцій
}); 