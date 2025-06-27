// add-allocated-batches-column.js - Міграція для додавання колонки allocated_batches

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Починаємо міграцію для додавання колонки allocated_batches...');

db.serialize(() => {
    // Додаємо колонку allocated_batches до таблиці order_items
    db.run(`ALTER TABLE order_items ADD COLUMN allocated_batches TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Помилка додавання колонки allocated_batches:', err.message);
        } else {
            console.log('✅ Колонка allocated_batches додана до order_items');
        }
        
        // Закриваємо з'єднання
        db.close((err) => {
            if (err) {
                console.error('Помилка закриття БД:', err.message);
            } else {
                console.log('🎉 Міграція завершена успішно!');
                console.log('📋 Тепер можна запускати npm start');
            }
        });
    });
});