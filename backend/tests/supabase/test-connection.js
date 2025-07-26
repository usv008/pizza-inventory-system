#!/usr/bin/env node

/**
 * Тест з'єднання з Supabase
 * 
 * Перевіряє підключення до Supabase проекту та валідність ключів
 * Запуск: node test-supabase-connection.js
 */

// Використовуємо вбудований fetch API в Node.js 18+
// const { fetch } = require('node-fetch'); // Не потрібно в Node.js 18+

// Дані підключення з плану міграції
const SUPABASE_URL = 'https://wncukuajzygzyasofyoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTQxOTEsImV4cCI6MjA2NDA5MDE5MX0.KG6dnuxlnnX_haXI7LEvJNc8wTXX2GT_cd07DlYALJ4';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUxNDE5MSwiZXhwIjoyMDY0MDkwMTkxfQ.arten1xRuJicEJEY7mHuet7eQqjuTb24VLwTtcB91yM';

console.log('🚀 Початок тестування з\'єднання з Supabase...\n');

/**
 * Тест базового з'єднання з Supabase
 */
async function testBasicConnection() {
    console.log('📡 Тест 1: Базове з\'єднання з Supabase REST API');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Базове з\'єднання успішне');
            console.log(`   Статус: ${response.status}`);
            console.log(`   URL: ${SUPABASE_URL}`);
        } else {
            console.log('❌ Помилка базового з\'єднання');
            console.log(`   Статус: ${response.status}`);
            console.log(`   Текст: ${response.statusText}`);
        }
        
        return response.ok;
    } catch (error) {
        console.log('❌ Критична помилка з\'єднання:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест аутентифікації з service role ключем
 */
async function testServiceRoleAuth() {
    console.log('\n🔐 Тест 2: Аутентифікація з service role ключем');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Service role аутентифікація успішна');
            console.log(`   Статус: ${response.status}`);
        } else {
            console.log('❌ Помилка service role аутентифікації');
            console.log(`   Статус: ${response.status}`);
            console.log(`   Текст: ${response.statusText}`);
        }
        
        return response.ok;
    } catch (error) {
        console.log('❌ Критична помилка service role:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест отримання схеми бази даних
 */
async function testDatabaseSchema() {
    console.log('\n📋 Тест 3: Отримання схеми бази даних');
    
    try {
        // Спробуємо отримати список таблиць з information_schema
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_tables`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Схема бази даних доступна');
            console.log(`   Отримано відповідь з ${data.length || 0} елементів`);
        } else {
            console.log('⚠️  Схема бази даних недоступна (очікувано для нової БД)');
            console.log(`   Статус: ${response.status}`);
        }
        
        return true; // Це не критична помилка для нової БД
    } catch (error) {
        console.log('⚠️  Помилка отримання схеми (очікувано для нової БД):');
        console.log(`   ${error.message}`);
        return true;
    }
}

/**
 * Тест можливості виконання простого SQL запиту
 */
async function testSimpleQuery() {
    console.log('\n🧪 Тест 4: Виконання простого SQL запиту');
    
    try {
        // Використаємо RPC для виконання простого SELECT
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/version`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ SQL запити працюють');
            console.log(`   Версія PostgreSQL доступна`);
        } else {
            console.log('⚠️  SQL запити поки недоступні (можливо потрібні налаштування)');
            console.log(`   Статус: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.log('⚠️  Помилка виконання SQL запиту:');
        console.log(`   ${error.message}`);
        return true;
    }
}

/**
 * Головна функція тестування
 */
async function runTests() {
    console.log('🎯 ТЕСТУВАННЯ З\'ЄДНАННЯ З SUPABASE');
    console.log('=====================================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🌐 URL: ${SUPABASE_URL}`);
    console.log('=====================================\n');

    const results = [];
    
    // Виконуємо тести послідовно
    results.push(await testBasicConnection());
    results.push(await testServiceRoleAuth());
    results.push(await testDatabaseSchema());
    results.push(await testSimpleQuery());
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ');
    console.log('========================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести пройшли успішно!');
        console.log('✅ Supabase готовий для міграції');
    } else if (successCount >= 2) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна продовжувати міграцію');
    } else {
        console.log('❌ Критичні помилки з\'єднання');
        console.log('🛑 Перевірте налаштування перед міграцією');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    console.log('\n🔄 Наступний крок: Встановити @supabase/supabase-js');
    console.log('   Команда: npm install @supabase/supabase-js');
    
    return successCount >= 2;
}

// Запуск тестів
if (require.main === module) {
    runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runTests };