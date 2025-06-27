const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS arrivals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        arrival_number TEXT UNIQUE NOT NULL,
        arrival_date DATE NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS arrivals_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        arrival_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    console.log('Таблиці arrivals та arrivals_items створено (або вже існують)');
    db.close();
}); 