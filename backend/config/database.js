/**
 * Database Configuration - централізована конфігурація БД
 * Керує переключенням між SQLite та Supabase
 */

require('dotenv').config();
const DatabaseAdapter = require('../adapters/DatabaseAdapter');

// Читаємо конфігурацію з .env (динамічно)
function getUseSupabase() {
    return process.env.USE_SUPABASE === 'true';
}

function getMigrateSessionsToSupabase() {
    return process.env.MIGRATE_SESSIONS_TO_SUPABASE === 'true';
}

const USE_SUPABASE = getUseSupabase();
const MIGRATE_SESSIONS_TO_SUPABASE = getMigrateSessionsToSupabase();

console.log(`🔧 Database Config: USE_SUPABASE=${USE_SUPABASE}, MIGRATE_SESSIONS=${MIGRATE_SESSIONS_TO_SUPABASE}`);

/**
 * Створити адаптер бази даних
 */
function createDatabaseAdapter() {
    const useSupabase = getUseSupabase(); // Динамічно читаємо поточне значення
    return new DatabaseAdapter(useSupabase);
}

/**
 * Отримати legacy SQLite з'єднання (для поступової міграції)
 */
function getLegacySQLiteConnection() {
    if (USE_SUPABASE) {
        console.warn('⚠️  Увага: запит legacy SQLite з\'єднання в Supabase режимі');
    }
    
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const dbPath = path.join(__dirname, '..', process.env.SQLITE_DB_PATH || 'pizza_inventory.db');
    
    return new sqlite3.Database(dbPath);
}

/**
 * Отримати Supabase клієнт (для специфічних операцій)
 */
function getSupabaseClient() {
    if (!getUseSupabase()) {
        throw new Error('Supabase клієнт недоступний в SQLite режимі');
    }
    
    const { supabase } = require('../database-supabase');
    return supabase;
}

/**
 * Конфігурація для legacy сервісів (поки не мігровані)
 * Буде поступово видалятися після міграції кожного сервісу
 */
function getLegacyQueries() {
    if (getUseSupabase()) {
        // В Supabase режимі повертаємо Supabase-сумісні запити
        return {
            productQueries: require('../queries/supabase/productQueries'),
            clientQueries: require('../queries/supabase/clientQueries'),
            userQueries: require('../queries/supabase/userQueries'),
            orderQueries: require('../queries/supabase/orderQueries'),
            movementQueries: require('../queries/supabase/movementQueries'),
            productionQueries: require('../queries/supabase/productionQueries'),
            writeoffQueries: require('../queries/supabase/writeoffQueries')
        };
    } else {
        // В SQLite режимі повертаємо оригінальні запити
        return {
            productQueries: require('../queries/sqlite/productQueries'),
            clientQueries: require('../queries/sqlite/clientQueries'),
            userQueries: require('../queries/sqlite/userQueries'),
            orderQueries: require('../queries/sqlite/orderQueries'),
            movementQueries: require('../queries/sqlite/movementQueries'),
            productionQueries: require('../queries/sqlite/productionQueries'),
            writeoffQueries: require('../queries/sqlite/writeoffQueries')
        };
    }
}

/**
 * Перевірити доступність обраної БД
 */
async function checkDatabaseConnection() {
    try {
        const adapter = createDatabaseAdapter();
        const connected = await adapter.testConnection();
        
        if (connected) {
            console.log(`✅ ${USE_SUPABASE ? 'Supabase' : 'SQLite'} з'єднання успішне`);
            return true;
        } else {
            console.error(`❌ ${USE_SUPABASE ? 'Supabase' : 'SQLite'} з'єднання не вдалося`);
            return false;
        }
    } catch (error) {
        console.error('❌ Помилка з\'єднання з БД:', error.message);
        return false;
    }
}

/**
 * Отримати статистику БД
 */
async function getDatabaseStats() {
    const adapter = createDatabaseAdapter();
    const tables = ['users', 'products', 'clients', 'orders', 'stock_movements'];
    const stats = {};
    
    for (const tableName of tables) {
        try {
            const records = await adapter.table(tableName).select('*');
            stats[tableName] = records.length;
        } catch (error) {
            stats[tableName] = `error: ${error.message}`;
        }
    }
    
    adapter.close(); // Закрити SQLite з'єднання
    return stats;
}

/**
 * Переключити режим БД (тільки для тестування)
 */
function switchDatabaseMode(useSupabase) {
    process.env.USE_SUPABASE = useSupabase.toString();
    console.log(`🔄 Переключено на ${useSupabase ? 'Supabase' : 'SQLite'} режим`);
}

module.exports = {
    // Основні
    USE_SUPABASE,
    MIGRATE_SESSIONS_TO_SUPABASE,
    createDatabaseAdapter,
    
    // Legacy (для поступової міграції)
    getLegacySQLiteConnection,
    getSupabaseClient,
    getLegacyQueries,
    
    // Утиліти
    checkDatabaseConnection,
    getDatabaseStats,
    switchDatabaseMode
};