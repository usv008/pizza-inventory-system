// run-operations-log-migration.js - Запуск міграції для системи логування

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Починаємо міграцію для системи логування операцій...');

db.serialize(() => {
    // Створюємо таблицю для логування всіх операцій
    db.run(`CREATE TABLE IF NOT EXISTS operations_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,  -- 'CREATE_ORDER', 'UPDATE_ORDER', 'PRODUCTION', 'WRITEOFF', 'ARRIVAL', etc.
        operation_id INTEGER,          -- ID відповідної операції (order_id, production_id, etc.)
        entity_type TEXT NOT NULL,     -- 'order', 'product', 'production', 'writeoff', 'arrival'
        entity_id INTEGER,             -- ID сутності на яку впливає операція
        old_data TEXT,                 -- JSON з старими даними (для UPDATE операцій)
        new_data TEXT,                 -- JSON з новими даними
        description TEXT NOT NULL,     -- Опис операції для відображення
        user_name TEXT NOT NULL,       -- Хто виконав операцію
        ip_address TEXT,               -- IP адреса користувача
        user_agent TEXT,               -- Browser info
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці operations_log:', err.message);
        } else {
            console.log('✅ Таблиця operations_log створена');
        }
    });

    // Створюємо індекси для оптимізації пошуку
    const indexes = [
        { name: 'idx_operations_log_type', sql: 'CREATE INDEX IF NOT EXISTS idx_operations_log_type ON operations_log(operation_type)' },
        { name: 'idx_operations_log_entity', sql: 'CREATE INDEX IF NOT EXISTS idx_operations_log_entity ON operations_log(entity_type, entity_id)' },
        { name: 'idx_operations_log_date', sql: 'CREATE INDEX IF NOT EXISTS idx_operations_log_date ON operations_log(created_at)' },
        { name: 'idx_operations_log_user', sql: 'CREATE INDEX IF NOT EXISTS idx_operations_log_user ON operations_log(user_name)' }
    ];

    let indexesCreated = 0;
    indexes.forEach(({ name, sql }) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`❌ Помилка створення індексу ${name}:`, err.message);
            } else {
                console.log(`✅ Індекс ${name} створено`);
            }
            
            indexesCreated++;
            if (indexesCreated === indexes.length) {
                // Додаємо тестові записи
                addTestOperations();
            }
        });
    });

    function addTestOperations() {
        const testOperations = [
            {
                operation_type: 'CREATE_ORDER',
                operation_id: 1,
                entity_type: 'order',
                entity_id: 1,
                new_data: JSON.stringify({order_number: '20250626-001', client_name: 'Тестовий клієнт', total_quantity: 100}),
                description: 'Створено замовлення №20250626-001 для клієнта "Тестовий клієнт"',
                user_name: 'Комерційний директор'
            },
            {
                operation_type: 'PRODUCTION',
                operation_id: 1,
                entity_type: 'production',
                entity_id: 1,
                new_data: JSON.stringify({product_name: 'Піца Маргарита', quantity: 144, batch_date: '2025-06-26'}),
                description: 'Виробництво: Піца Маргарита - 144 шт (партія 2025-06-26)',
                user_name: 'Начальник виробництва'
            }
        ];

        let completed = 0;
        testOperations.forEach((op, index) => {
            db.run(`INSERT INTO operations_log 
                   (operation_type, operation_id, entity_type, entity_id, new_data, description, user_name, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${index} minutes'))`,
                   [op.operation_type, op.operation_id, op.entity_type, op.entity_id, 
                    op.new_data, op.description, op.user_name],
                   function(err) {
                if (err) {
                    console.error(`❌ Помилка створення тестового запису ${index + 1}:`, err.message);
                } else {
                    console.log(`✅ Тестовий запис ${index + 1} створено`);
                }
                
                completed++;
                if (completed === testOperations.length) {
                    console.log('🎉 Міграція системи логування завершена успішно!');
                    console.log('📋 Створено таблицю operations_log з індексами та тестовими даними');
                    db.close();
                }
            });
        });
    }
});