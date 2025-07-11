const { createClient } = require('@supabase/supabase-js');

console.log('[SUPABASE] Ініціалізація Supabase клієнта...');

// Створюємо Supabase клієнт
const supabaseUrl = process.env.SUPABASE_URL || 'https://wncukuajzygzyasofyoe.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUxNDE5MSwiZXhwIjoyMDY0MDkwMTkxfQ.arten1xRuJicEJEY7mHuet7eQqjuTb24VLwTtcB91yM';

console.log('🔧 Використовую Supabase URL:', supabaseUrl);
console.log('🔧 Використовую Supabase KEY:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'ВІДСУТНІЙ');

const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

console.log('[SUPABASE] ✅ Supabase клієнт ініціалізовано успішно');

// Експортуємо клієнт та допоміжні функції
module.exports = {
    supabase,
    
    // Допоміжні функції для роботи з Supabase
    async testConnection() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id')
                .limit(1);
                
            if (error) throw error;
            
            console.log('[SUPABASE] ✅ Підключення працює');
            return true;
        } catch (err) {
            console.error('[SUPABASE] ❌ Помилка підключення:', err.message);
            return false;
        }
    },
    
    // Універсальна функція для SELECT запитів
    async select(tableName, columns = '*', filters = {}) {
        try {
            let query = supabase.from(tableName).select(columns);
            
            // Додаємо фільтри
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    query = query.eq(key, value);
                }
            });
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data;
        } catch (err) {
            console.error(`[SUPABASE] Помилка SELECT з ${tableName}:`, err.message);
            throw err;
        }
    },
    
    // Універсальна функція для INSERT
    async insert(tableName, data) {
        try {
            const { data: result, error } = await supabase
                .from(tableName)
                .insert(data)
                .select();
                
            if (error) throw error;
            return result;
        } catch (err) {
            console.error(`[SUPABASE] Помилка INSERT в ${tableName}:`, err.message);
            throw err;
        }
    },
    
    // Універсальна функція для UPDATE
    async update(tableName, id, data) {
        try {
            const { data: result, error } = await supabase
                .from(tableName)
                .update(data)
                .eq('id', id)
                .select();
                
            if (error) throw error;
            return result[0];
        } catch (err) {
            console.error(`[SUPABASE] Помилка UPDATE в ${tableName}:`, err.message);
            throw err;
        }
    },
    
    // Універсальна функція для DELETE
    async delete(tableName, id) {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error(`[SUPABASE] Помилка DELETE з ${tableName}:`, err.message);
            throw err;
        }
    }
};
