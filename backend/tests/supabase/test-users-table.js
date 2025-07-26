#!/usr/bin/env node

/**
 * Тест таблиці users в Supabase
 * 
 * Перевіряє створення та роботу з таблицею users (ПЕРША таблиця!)
 * Запуск: node tests/supabase/test-users-table.js
 */

const { createClient } = require('@supabase/supabase-js');

// Дані підключення
const SUPABASE_URL = 'https://wncukuajzygzyasofyoe.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUxNDE5MSwiZXhwIjoyMDY0MDkwMTkxfQ.arten1xRuJicEJEY7mHuet7eQqjuTb24VLwTtcB91yM';

// Створюємо клієнт
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('🧪 Тестування таблиці users в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці users');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця users існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця users не існує');
            console.log('   🚨 КРИТИЧНО! users має бути ПЕРШОЮ таблицею!');
            return false;
        } else {
            console.log('⚠️  Помилка доступу до таблиці:');
            console.log(`   Код: ${error.code}`);
            console.log(`   Повідомлення: ${error.message}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 2: Перевірка структури таблиці
 */
async function testTableStructure() {
    console.log('\n🏗️  Тест 2: Перевірка структури таблиці');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, phone, role, permissions, first_login, active, created_by, created_at, updated_at')
            .limit(1);
        
        if (!error) {
            console.log('✅ Структура таблиці правильна');
            console.log('   Всі необхідні колонки присутні');
            return true;
        } else {
            console.log('❌ Помилка структури таблиці:');
            console.log(`   Код: ${error.code}`);
            console.log(`   Повідомлення: ${error.message}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка перевірки структури:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 3: Перевірка адміністратора
 */
async function testAdminUser() {
    console.log('\n👑 Тест 3: Перевірка адміністратора');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', 'admin')
            .single();
        
        if (!error && data) {
            console.log('✅ Адміністратор існує');
            console.log(`   ID: ${data.id}`);
            console.log(`   Username: ${data.username}`);
            console.log(`   Role: ${data.role}`);
            console.log(`   Active: ${data.active}`);
            console.log(`   Created_by: ${data.created_by || 'NULL (правильно для першого користувача)'}`);
            
            // Перевірка permissions JSONB
            if (data.permissions && typeof data.permissions === 'object') {
                console.log(`   Permissions: ${JSON.stringify(data.permissions)}`);
            }
            
            return true;
        } else {
            console.log('❌ Адміністратор не знайдений або помилка:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка перевірки адміністратора:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 4: Перевірка self-referencing FK
 */
async function testSelfReferencingFK() {
    console.log('\n🔗 Тест 4: Перевірка self-referencing foreign key');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                role,
                created_by,
                creator:created_by (
                    id,
                    username,
                    role
                )
            `);
        
        if (!error && data) {
            console.log('✅ Self-referencing FK працює');
            console.log(`   Знайдено ${data.length} користувачів`);
            
            data.forEach(user => {
                if (user.creator) {
                    console.log(`   ${user.username} створений користувачем ${user.creator.username}`);
                } else {
                    console.log(`   ${user.username} створений без створювача (${user.created_by === null ? 'NULL' : user.created_by})`);
                }
            });
            
            return true;
        } else {
            console.log('⚠️  Проблема з self-referencing FK:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length > 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка self-referencing FK:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 5: Перевірка JSONB permissions
 */
async function testJSONBPermissions() {
    console.log('\n📋 Тест 5: Перевірка JSONB permissions');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, role, permissions')
            .neq('permissions', '{}');
        
        if (!error && data) {
            console.log('✅ JSONB permissions працює');
            console.log(`   Користувачів з permissions: ${data.length}`);
            
            data.forEach(user => {
                console.log(`   ${user.username} (${user.role}): ${JSON.stringify(user.permissions)}`);
            });
            
            return true;
        } else {
            console.log('⚠️  Проблема з JSONB permissions:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length === 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка JSONB permissions:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Головна функція тестування
 */
async function runUsersTests() {
    console.log('🎯 ТЕСТУВАННЯ ТАБЛИЦІ USERS');
    console.log('============================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🗄️  Таблиця: public.users`);
    console.log(`🚨 ВАЖЛИВО: users має бути ПЕРШОЮ таблицею!`);
    console.log('============================\n');

    const results = [];
    
    // Запускаємо тести послідовно
    results.push(await testTableExists());
    
    if (results[0]) {
        results.push(await testTableStructure());
        results.push(await testAdminUser());
        results.push(await testSelfReferencingFK());
        results.push(await testJSONBPermissions());
    } else {
        // Якщо таблиця не існує, пропускаємо інші тести
        results.push(false, false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ USERS');
    console.log('==============================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести users пройшли успішно!');
        console.log('✅ Таблиця готова до використання');
        console.log('🔄 Можна створювати інші таблиці з FK на users');
    } else if (results[0] === false) {
        console.log('❌ Таблиця users не створена');
        console.log('📋 Потрібно:');
        console.log('   1. Відкрити Supabase Dashboard');
        console.log('   2. Перейти в SQL Editor');
        console.log('   3. Виконати SQL з файлу migrations/supabase/001_create_users_table.sql');
        console.log('   🚨 users ОБОВ\'ЯЗКОВО має бути ПЕРШОЮ таблицею!');
    } else if (successCount >= 3) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна використовувати таблицю');
    } else {
        console.log('❌ Критичні помилки в таблиці users');
        console.log('🛑 Потрібно вирішити проблеми');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    return successCount >= 3;
}

// Запуск тестів
if (require.main === module) {
    runUsersTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runUsersTests };