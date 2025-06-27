// Створити файл fix-production-batches.js в корені проекту

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
console.log('🔄 Виправлення структури таблиці production_batches...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Помилка підключення до БД:', err.message);
        process.exit(1);
    }
    console.log('✅ Підключено до БД');
});

db.serialize(() => {
    // Спочатку перевіримо структуру таблиці
    db.all("PRAGMA table_info(production_batches)", (err, columns) => {
        if (err) {
            console.error('❌ Помилка отримання структури таблиці:', err.message);
            return;
        }
        
        console.log('📋 Поточна структура таблиці production_batches:');
        columns.forEach(col => {
            console.log(`   ${col.name}: ${col.type}`);
        });
        
        const columnNames = columns.map(col => col.name);
        
        // Додаємо відсутні колонки
        const columnsToAdd = [
            { name: 'notes', sql: 'ALTER TABLE production_batches ADD COLUMN notes TEXT' },
            { name: 'production_id', sql: 'ALTER TABLE production_batches ADD COLUMN production_id INTEGER' },
            { name: 'used_quantity', sql: 'ALTER TABLE production_batches ADD COLUMN used_quantity INTEGER NOT NULL DEFAULT 0' }
        ];
        
        let addedColumns = 0;
        
        columnsToAdd.forEach(column => {
            if (!columnNames.includes(column.name)) {
                db.run(column.sql, (err) => {
                    if (err) {
                        console.error(`❌ Помилка додавання колонки ${column.name}:`, err.message);
                    } else {
                        console.log(`✅ Колонка ${column.name} додана успішно`);
                        addedColumns++;
                    }
                });
            } else {
                console.log(`ℹ️  Колонка ${column.name} вже існує`);
            }
        });
    });

    // Додаємо поле allocated_batches до order_items якщо його немає
    db.run(`ALTER TABLE order_items ADD COLUMN allocated_batches TEXT DEFAULT '[]'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля allocated_batches:', err.message);
        } else {
            console.log('✅ Поле allocated_batches перевірено в order_items');
        }
    });

    // Додаємо поля для відстеження партій в stock_movements
    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля batch_id:', err.message);
        } else {
            console.log('✅ Поле batch_id перевірено в stock_movements');
        }
    });

    db.run(`ALTER TABLE stock_movements ADD COLUMN batch_date DATE`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Помилка додавання поля batch_date:', err.message);
        } else {
            console.log('✅ Поле batch_date перевірено в stock_movements');
        }
    });

    // Перевіримо чи є дані в production_batches
    db.get("SELECT COUNT(*) as count FROM production_batches", (err, result) => {
        if (err) {
            console.error('❌ Помилка підрахунку записів:', err.message);
        } else {
            console.log(`📊 В таблиці production_batches: ${result.count} записів`);
            
            if (result.count === 0) {
                // Створюємо тестові партії для існуючих товарів
                db.run(`INSERT INTO production_batches 
                        (product_id, batch_date, production_date, total_quantity, available_quantity, expiry_date, status)
                        SELECT 
                            id as product_id,
                            date('now', '-30 days') as batch_date,
                            date('now', '-30 days') as production_date,
                            stock_pieces as total_quantity,
                            stock_pieces as available_quantity,
                            date('now', '+300 days') as expiry_date,
                            'ACTIVE' as status
                        FROM products 
                        WHERE stock_pieces > 0`, 
                        function(err) {
                            if (err) {
                                console.error('❌ Помилка створення тестових партій:', err.message);
                            } else {
                                console.log(`✅ Створено ${this.changes} тестових партій`);
                            }
                        });
            }
        }
    });

    // Створюємо індекси
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_production_batches_product_date ON production_batches (product_id, batch_date)',
        'CREATE INDEX IF NOT EXISTS idx_production_batches_expiry ON production_batches (expiry_date, status)',
        'CREATE INDEX IF NOT EXISTS idx_production_batches_available ON production_batches (product_id, available_quantity, status)'
    ];

    indexes.forEach((indexSql, i) => {
        db.run(indexSql, (err) => {
            if (err) {
                console.error(`❌ Помилка створення індексу ${i + 1}:`, err.message);
            } else {
                console.log(`✅ Індекс ${i + 1} створено/перевірено`);
            }
        });
    });

    setTimeout(() => {
        console.log('');
        console.log('🎉 Виправлення структури завершено!');
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
            process.exit(0);
        });
    }, 2000); // Даємо час на виконання всіх запитів
});