const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');

console.log(`[TEST] Намагаюся підключитися до бази даних: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('--- [TEST] ПОМИЛКА ПІДКЛЮЧЕННЯ ---');
        console.error(err.message);
        return;
    }
    console.log('--- [TEST] УСПІХ! ---');
    console.log('Підключення до бази даних SQLite пройшло успішно.');
    
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('З\'єднання з базою даних закрито.');
    });
});
