const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Починаємо міграцію бази даних...');

db.serialize(() => {
    // Додаємо стовпець client_id до існуючої таблиці orders
    db.run(`ALTER TABLE orders ADD COLUMN client_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Помилка додавання client_id:', err.message);
        } else {
            console.log('✅ Стовпець client_id додано');
        }
    });
    
    // Створюємо таблицю клієнтів якщо не існує
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
    )`, (err) => {
        if (err) {
            console.error('Помилка створення таблиці clients:', err.message);
        } else {
            console.log('✅ Таблиця clients створена');
        }
    });
    
    // Додаємо тестових клієнтів
    db.run(`INSERT OR IGNORE INTO clients (id, name, contact_person, phone, email, address) VALUES 
        (1, 'ТОВ Піца Експрес', 'Іван Петренко', '+380 67 123 45 67', 'ivan@pizza.com', 'м. Київ, вул. Хрещатик, 1'),
        (2, 'Ресторан Мамма Міа', 'Марія Іваненко', '+380 50 987 65 43', 'maria@mamma.com', 'м. Львів, пл. Ринок, 5'),
        (3, 'Кафе Чао Белла', 'Олександр Сидоренко', '+380 93 456 78 90', 'alex@ciao.com', 'м. Одеса, вул. Дерибасівська, 10')
    `, (err) => {
        if (err) {
            console.error('Помилка додавання тестових клієнтів:', err.message);
        } else {
            console.log('✅ Тестові клієнти додані');
        }
        
        db.close((err) => {
            if (err) {
                console.error('Помилка закриття БД:', err.message);
            } else {
                console.log('🎉 Міграція завершена успішно!');
            }
        });
    });
});
