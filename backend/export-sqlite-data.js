const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

// Список всіх таблиць для експорту
const tables = [
    'products',
    'stock_movements', 
    'clients',
    'orders',
    'order_items',
    'writeoffs',
    'production',
    'production_plans',
    'production_plan_items', 
    'production_settings',
    'users',
    'user_sessions',
    'user_audit'
];

async function exportTable(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) {
                console.error(`❌ Помилка експорту таблиці ${tableName}:`, err);
                reject(err);
            } else {
                console.log(`✅ Експортовано ${rows.length} записів з таблиці ${tableName}`);
                resolve(rows);
            }
        });
    });
}

async function exportAllData() {
    console.log('🚀 Розпочинаємо експорт даних з SQLite...\n');
    
    const exportData = {};
    
    for (const table of tables) {
        try {
            exportData[table] = await exportTable(table);
        } catch (error) {
            console.error(`❌ Не вдалося експортувати таблицю ${table}`);
            exportData[table] = [];
        }
    }
    
    // Зберігаємо дані у JSON файл
    const exportPath = path.join(__dirname, 'sqlite-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`\n📦 Експорт завершено! Дані збережено у: ${exportPath}`);
    
    // Виводимо статистику
    console.log('\n📊 Статистика експорту:');
    for (const [table, data] of Object.entries(exportData)) {
        console.log(`   ${table}: ${data.length} записів`);
    }
    
    db.close();
}

exportAllData().catch(console.error);
