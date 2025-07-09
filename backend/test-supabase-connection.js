const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Тестуємо підключення до Supabase...');
console.log('URL:', process.env.SUPABASE_URL);
console.log('Anon Key:', process.env.SUPABASE_ANON_KEY ? '✅ Є' : '❌ Немає');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
    try {
        console.log('\n🔗 Тестуємо підключення...');
        
        // Спробуємо отримати версію PostgreSQL
        const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .limit(1);
        
        if (error) {
            console.log('❌ Помилка підключення:', error.message);
            
            // Спробуємо простий запит
            const { data: simpleData, error: simpleError } = await supabase
                .from('pg_tables')
                .select('tablename')
                .limit(1);
                
            if (simpleError) {
                console.log('❌ Простий запит також не вдався:', simpleError.message);
            } else {
                console.log('✅ Підключення працює! Знайдено таблиці:', simpleData);
            }
        } else {
            console.log('✅ Підключення працює!');
            console.log('Дані:', data);
        }
        
    } catch (err) {
        console.error('❌ Критична помилка:', err.message);
    }
}

testConnection();
