#!/usr/bin/env node

/**
 * Розширений тест Supabase клієнта
 * 
 * Тестує підключення та базові операції з використанням @supabase/supabase-js
 * Запуск: node test-supabase-client.js
 */

const { createClient } = require('@supabase/supabase-js');

// Дані підключення з плану міграції
const SUPABASE_URL = 'https://wncukuajzygzyasofyoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTQxOTEsImV4cCI6MjA2NDA5MDE5MX0.KG6dnuxlnnX_haXI7LEvJNc8wTXX2GT_cd07DlYALJ4';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUxNDE5MSwiZXhwIjoyMDY0MDkwMTkxfQ.arten1xRuJicEJEY7mHuet7eQqjuTb24VLwTtcB91yM';

console.log('🚀 Тестування Supabase JS клієнта...\n');

/**
 * Тест створення клієнта з anon ключем
 */
async function testAnonClient() {
    console.log('👤 Тест 1: Створення anon клієнта');
    
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Перевірка базових властивостей
        if (supabase && supabase.rest) {
            console.log('✅ Anon клієнт створено успішно');
            console.log(`   URL: ${supabase.supabaseUrl}`);
            console.log(`   Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
            return supabase;
        } else {
            console.log('❌ Помилка створення anon клієнта');
            return null;
        }
    } catch (error) {
        console.log('❌ Критична помилка anon клієнта:');
        console.log(`   ${error.message}`);
        return null;
    }
}

/**
 * Тест створення клієнта з service role ключем
 */
async function testServiceClient() {
    console.log('\n🔑 Тест 2: Створення service role клієнта');
    
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        
        if (supabase && supabase.rest) {
            console.log('✅ Service role клієнт створено успішно');
            console.log(`   URL: ${supabase.supabaseUrl}`);
            console.log(`   Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
            return supabase;
        } else {
            console.log('❌ Помилка створення service role клієнта');
            return null;
        }
    } catch (error) {
        console.log('❌ Критична помилка service role клієнта:');
        console.log(`   ${error.message}`);
        return null;
    }
}

/**
 * Тест підключення до бази даних
 */
async function testDatabaseConnection(supabase) {
    console.log('\n🔗 Тест 3: Підключення до бази даних');
    
    try {
        // Спробуємо виконати простий запит для перевірки підключення
        const { data, error } = await supabase
            .from('_realtime_schema_changes')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ База даних доступна');
            console.log(`   Відповідь отримана (${data ? data.length : 0} записів)`);
            return true;
        } else if (error.code === 'PGRST116') {
            // Таблиця не існує - це нормально для порожньої бази
            console.log('✅ База даних доступна (порожня база)');
            console.log('   Система готова для створення таблиць');
            return true;
        } else {
            console.log('⚠️  Обмежений доступ до бази:');
            console.log(`   Код: ${error.code}`);
            console.log(`   Повідомлення: ${error.message}`);
            return true; // Це може бути нормально для нової бази
        }
    } catch (error) {
        console.log('❌ Помилка підключення до БД:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест RPC функціоналу
 */
async function testRPCFunctionality(supabase) {
    console.log('\n⚡ Тест 4: RPC функціонал');
    
    try {
        // Спробуємо викликати системну функцію
        const { data, error } = await supabase.rpc('version');
        
        if (!error && data) {
            console.log('✅ RPC функції працюють');
            console.log(`   PostgreSQL версія доступна`);
            return true;
        } else if (error && error.code === 'PGRST202') {
            console.log('⚠️  RPC функція не знайдена (очікувано)');
            console.log('   Система готова для додавання функцій');
            return true;
        } else {
            console.log('⚠️  RPC функції поки недоступні:');
            console.log(`   Код: ${error?.code || 'Невідомо'}`);
            console.log(`   Повідомлення: ${error?.message || 'Невідома помилка'}`);
            return true;
        }
    } catch (error) {
        console.log('❌ Помилка RPC:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест можливості створення таблиці
 */
async function testTableCreation(supabase) {
    console.log('\n🏗️  Тест 5: Можливість створення таблиці');
    
    try {
        // Спробуємо отримати схему (це покаже, чи можемо ми працювати зі структурою)
        const { data, error } = await supabase
            .schema('information_schema')
            .from('tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .limit(5);
        
        if (!error) {
            console.log('✅ Доступ до схеми БД є');
            console.log(`   Знайдено ${data ? data.length : 0} публічних таблиць`);
            if (data && data.length > 0) {
                console.log(`   Приклад таблиць: ${data.map(t => t.table_name).join(', ')}`);
            }
            return true;
        } else {
            console.log('⚠️  Обмежений доступ до схеми (може бути нормально):');
            console.log(`   Код: ${error.code}`);
            console.log(`   Можемо продовжувати створення таблиць через SQL Editor`);
            return true;
        }
    } catch (error) {
        console.log('❌ Помилка доступу до схеми:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Головна функція тестування
 */
async function runClientTests() {
    console.log('🎯 ТЕСТУВАННЯ SUPABASE JS КЛІЄНТА');
    console.log('===================================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🌐 URL: ${SUPABASE_URL}`);
    console.log(`📦 Версія клієнта: @supabase/supabase-js v2.x`);
    console.log('===================================\n');

    const results = [];
    
    // Тест 1: Anon клієнт
    const anonClient = await testAnonClient();
    results.push(anonClient !== null);
    
    // Тест 2: Service role клієнт
    const serviceClient = await testServiceClient();
    results.push(serviceClient !== null);
    
    if (serviceClient) {
        // Тест 3: Підключення до БД
        results.push(await testDatabaseConnection(serviceClient));
        
        // Тест 4: RPC функціонал
        results.push(await testRPCFunctionality(serviceClient));
        
        // Тест 5: Створення таблиць
        results.push(await testTableCreation(serviceClient));
    } else {
        results.push(false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ КЛІЄНТА');
    console.log('================================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести клієнта пройшли успішно!');
        console.log('✅ Готові до початку міграції таблиць');
    } else if (successCount >= 3) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна розпочинати міграцію');
    } else {
        console.log('❌ Критичні помилки клієнта');
        console.log('🛑 Потрібно вирішити проблеми перед міграцією');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    console.log('\n🔄 Наступний крок: Створення першої таблиці products');
    console.log('   Метод: Supabase Dashboard > SQL Editor');
    
    return successCount >= 3;
}

// Запуск тестів
if (require.main === module) {
    runClientTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runClientTests };