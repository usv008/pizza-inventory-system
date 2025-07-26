/**
 * Supabase Database Client Configuration
 * Використовується для з'єднання з Supabase PostgreSQL
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Валідація конфігурації
if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required in environment variables');
}

if (!process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY is required in environment variables');
}

// Створення Supabase клієнта з service role ключем для повного доступу
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: {
            schema: 'public'
        }
    }
);

// Створення публічного клієнта для frontend операцій (з обмеженими правами)
const supabaseAnon = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true
        }
    }
);

/**
 * Тест з'єднання з Supabase
 */
async function testConnection() {
    try {
        console.log('🔄 Тестування з\'єднання з Supabase...');
        
        // Тест service role підключення
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
            
        if (error) {
            throw error;
        }
        
        console.log('✅ Supabase з\'єднання успішне');
        console.log(`📊 Знайдено ${data} користувачів в базі`);
        return true;
        
    } catch (error) {
        console.error('❌ Помилка з\'єднання з Supabase:', error.message);
        return false;
    }
}

/**
 * Отримати метадані про таблиці
 */
async function getTableInfo() {
    try {
        const { data, error } = await supabase
            .rpc('get_table_info');
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Помилка отримання інформації про таблиці:', error);
        return null;
    }
}

/**
 * Виконати SQL запит напряму (тільки для міграційних скриптів)
 */
async function executeRawSQL(sql, params = []) {
    try {
        const { data, error } = await supabase.rpc('execute_sql', {
            query: sql,
            params: params
        });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Помилка виконання SQL запиту:', error);
        throw error;
    }
}

module.exports = {
    supabase,
    supabaseAnon,
    testConnection,
    getTableInfo,
    executeRawSQL
};