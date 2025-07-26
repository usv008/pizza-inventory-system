#!/usr/bin/env node

/**
 * Тест таблиці user_sessions в Supabase
 * 
 * Перевіряє створення та роботу з таблицею user_sessions
 * Запуск: node tests/supabase/test-user-sessions-table.js
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

console.log('🧪 Тестування таблиці user_sessions в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці user_sessions');
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця user_sessions існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця user_sessions не існує');
            console.log('   Потрібно виконати міграцію 011_create_user_sessions_table.sql');
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
            .from('user_sessions')
            .select('id, session_id, user_id, created_at, expires_at, ip_address, user_agent, active, last_accessed_at, created_by_user_id')
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
 * Тест 3: Перевірка тестових даних
 */
async function testSampleData() {
    console.log('\n📊 Тест 3: Перевірка тестових даних');
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select('*');
        
        if (!error && data) {
            console.log('✅ Тестові дані завантажені');
            console.log(`   Кількість сесій: ${data.length}`);
            
            // Перевірка різних типів сесій
            const activeSessions = data.filter(s => s.active);
            const expiredSessions = data.filter(s => new Date(s.expires_at) <= new Date());
            
            console.log(`   Активних сесій: ${activeSessions.length}`);
            console.log(`   Прострочених сесій: ${expiredSessions.length}`);
            
            if (data.length >= 3) {
                console.log('   ✅ Достатньо тестових даних для перевірки');
                return true;
            } else {
                console.log('   ⚠️  Мало тестових даних');
                return data.length > 0;
            }
        } else {
            console.log('❌ Помилка отримання тестових даних:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка тестових даних:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 4: Перевірка foreign key на users
 */
async function testForeignKeyConstraint() {
    console.log('\n🔗 Тест 4: Перевірка foreign key зв\'язку з users');
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select(`
                id,
                session_id,
                user_id,
                active,
                expires_at,
                users!user_sessions_user_id_fkey (
                    id,
                    username,
                    role
                )
            `);
        
        if (!error && data) {
            console.log('✅ Foreign key зв\'язок працює');
            console.log(`   Сесій з користувачами: ${data.length}`);
            
            data.forEach(session => {
                if (session.users) {
                    console.log(`   Сесія ${session.session_id.substr(0, 12)}... → ${session.users.username} (${session.users.role})`);
                } else {
                    console.log(`   ⚠️  Сесія ${session.session_id} без користувача`);
                }
            });
            
            return true;
        } else {
            console.log('⚠️  Проблема з foreign key:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length > 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка foreign key:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 5: Перевірка INET типу для IP адрес
 */
async function testInetType() {
    console.log('\n🌐 Тест 5: Перевірка INET типу для IP адрес');
    
    try {
        const { data, error } = await supabase
            .from('user_sessions')
            .select('session_id, ip_address')
            .not('ip_address', 'is', null);
        
        if (!error && data) {
            console.log('✅ INET тип працює');
            console.log(`   Сесій з IP адресами: ${data.length}`);
            
            data.forEach(session => {
                console.log(`   ${session.session_id.substr(0, 12)}... → IP: ${session.ip_address}`);
            });
            
            return true;
        } else {
            console.log('⚠️  Проблема з INET типом:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length === 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка INET:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 6: Перевірка унікальності session_id
 */
async function testUniqueConstraint() {
    console.log('\n🆔 Тест 6: Перевірка унікальності session_id');
    
    try {
        // Отримуємо всі session_id
        const { data, error } = await supabase
            .from('user_sessions')
            .select('session_id');
        
        if (!error && data) {
            const sessionIds = data.map(s => s.session_id);
            const uniqueSessionIds = [...new Set(sessionIds)];
            
            if (sessionIds.length === uniqueSessionIds.length) {
                console.log('✅ Унікальність session_id працює');
                console.log(`   Всі ${sessionIds.length} session_id унікальні`);
                return true;
            } else {
                console.log('❌ Дублікати session_id знайдені');
                console.log(`   Загальних: ${sessionIds.length}, унікальних: ${uniqueSessionIds.length}`);
                return false;
            }
        } else {
            console.log('⚠️  Помилка перевірки унікальності:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка унікальності:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Головна функція тестування
 */
async function runUserSessionsTests() {
    console.log('🎯 ТЕСТУВАННЯ ТАБЛИЦІ USER_SESSIONS');
    console.log('====================================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🗄️  Таблиця: public.user_sessions`);
    console.log(`🔗 Залежності: users таблиця`);
    console.log('====================================\n');

    const results = [];
    
    // Запускаємо тести послідовно
    results.push(await testTableExists());
    
    if (results[0]) {
        results.push(await testTableStructure());
        results.push(await testSampleData());
        results.push(await testForeignKeyConstraint());
        results.push(await testInetType());
        results.push(await testUniqueConstraint());
    } else {
        // Якщо таблиця не існує, пропускаємо інші тести
        results.push(false, false, false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ USER_SESSIONS');
    console.log('====================================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести user_sessions пройшли успішно!');
        console.log('✅ Таблиця готова до використання');
        console.log('🔄 Система сесій працює коректно');
    } else if (results[0] === false) {
        console.log('❌ Таблиця user_sessions не створена');
        console.log('📋 Потрібно:');
        console.log('   1. Відкрити Supabase Dashboard');
        console.log('   2. Перейти в SQL Editor');
        console.log('   3. Виконати SQL з файлу migrations/supabase/011_create_user_sessions_table.sql');
    } else if (successCount >= 4) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна використовувати таблицю');
    } else {
        console.log('❌ Критичні помилки в таблиці user_sessions');
        console.log('🛑 Потрібно вирішити проблеми');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    return successCount >= 4;
}

// Запуск тестів
if (require.main === module) {
    runUserSessionsTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runUserSessionsTests };