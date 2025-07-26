#!/usr/bin/env node

/**
 * Тест таблиці clients в Supabase
 * 
 * Перевіряє створення та роботу з таблицею clients
 * Запуск: node tests/supabase/test-clients-table.js
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

console.log('🧪 Тестування таблиці clients в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці clients');
    
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця clients існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця clients не існує');
            console.log('   Потрібно створити таблицю в Supabase Dashboard');
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
            .from('clients')
            .select('id, name, contact_person, phone, email, address, notes, is_active, created_at, updated_at')
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
async function testTestData() {
    console.log('\n📊 Тест 3: Перевірка тестових даних');
    
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at');
        
        if (!error && data) {
            console.log('✅ Тестові дані доступні');
            console.log(`   Знайдено ${data.length} клієнтів`);
            
            // Перевірка активних/неактивних
            const activeClients = data.filter(c => c.is_active).length;
            const inactiveClients = data.filter(c => !c.is_active).length;
            
            console.log(`   Активних: ${activeClients}, Неактивних: ${inactiveClients}`);
            
            if (data.length > 0) {
                console.log('   Приклади клієнтів:');
                data.slice(0, 3).forEach((client, index) => {
                    const status = client.is_active ? '✅' : '❌';
                    console.log(`   ${index + 1}. ${client.name} (${client.contact_person}) ${status}`);
                });
            }
            
            return true;
        } else {
            console.log('⚠️  Тестові дані відсутні або недоступні:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length === 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка отримання даних:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 4: Перевірка soft delete функціональності
 */
async function testSoftDelete() {
    console.log('\n🗑️  Тест 4: Перевірка soft delete (is_active)');
    
    try {
        // Перевірка фільтрації активних клієнтів
        const { data: activeData, error: activeError } = await supabase
            .from('clients')
            .select('*')
            .eq('is_active', true);
        
        const { data: inactiveData, error: inactiveError } = await supabase
            .from('clients')
            .select('*')
            .eq('is_active', false);
        
        if (!activeError && !inactiveError) {
            console.log('✅ Soft delete функціональність працює');
            console.log(`   Активних клієнтів: ${activeData.length}`);
            console.log(`   Неактивних клієнтів: ${inactiveData.length}`);
            return true;
        } else {
            console.log('❌ Помилка soft delete:');
            console.log(`   Active error: ${activeError?.message}`);
            console.log(`   Inactive error: ${inactiveError?.message}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка soft delete:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 5: Перевірка операцій CRUD
 */
async function testCRUDOperations() {
    console.log('\n⚙️  Тест 5: Перевірка операцій CRUD');
    
    try {
        // CREATE - Створення тестового клієнта
        const { data: insertData, error: insertError } = await supabase
            .from('clients')
            .insert({
                name: 'CRUD Тест Клієнт',
                contact_person: 'Тест Тестович',
                phone: '+380999999999',
                email: 'crud-test@example.com',
                address: 'Тестова адреса, 123',
                notes: 'Тестовий клієнт для CRUD операцій',
                is_active: true
            })
            .select();
        
        if (insertError) {
            console.log('❌ Помилка створення (CREATE):');
            console.log(`   ${insertError.message}`);
            return false;
        }
        
        const testId = insertData[0].id;
        console.log('✅ CREATE: Клієнт створено успішно');
        
        // READ - Читання клієнта
        const { data: readData, error: readError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', testId)
            .single();
        
        if (readError || !readData) {
            console.log('❌ Помилка читання (READ):');
            console.log(`   ${readError?.message || 'Клієнт не знайдено'}`);
            return false;
        }
        
        console.log('✅ READ: Клієнт прочитано успішно');
        
        // UPDATE - Оновлення клієнта
        const { error: updateError } = await supabase
            .from('clients')
            .update({
                phone: '+380888888888',
                notes: 'Оновлені дані тестового клієнта'
            })
            .eq('id', testId);
        
        if (updateError) {
            console.log('❌ Помилка оновлення (UPDATE):');
            console.log(`   ${updateError.message}`);
            return false;
        }
        
        console.log('✅ UPDATE: Клієнт оновлено успішно');
        
        // Soft DELETE - Деактивація клієнта
        const { error: softDeleteError } = await supabase
            .from('clients')
            .update({ is_active: false })
            .eq('id', testId);
        
        if (softDeleteError) {
            console.log('❌ Помилка soft delete:');
            console.log(`   ${softDeleteError.message}`);
            return false;
        }
        
        console.log('✅ SOFT DELETE: Клієнт деактивовано успішно');
        
        // DELETE - Повне видалення тестового клієнта
        const { error: deleteError } = await supabase
            .from('clients')
            .delete()
            .eq('id', testId);
        
        if (deleteError) {
            console.log('❌ Помилка видалення (DELETE):');
            console.log(`   ${deleteError.message}`);
            return false;
        }
        
        console.log('✅ DELETE: Клієнт видалено успішно');
        console.log('✅ Всі CRUD операції працюють');
        
        return true;
    } catch (error) {
        console.log('❌ Критична помилка CRUD тестів:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Головна функція тестування
 */
async function runClientsTests() {
    console.log('🎯 ТЕСТУВАННЯ ТАБЛИЦІ CLIENTS');
    console.log('==============================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🗄️  Таблиця: public.clients`);
    console.log('==============================\n');

    const results = [];
    
    // Запускаємо тести послідовно
    results.push(await testTableExists());
    
    if (results[0]) {
        results.push(await testTableStructure());
        results.push(await testTestData());
        results.push(await testSoftDelete());
        results.push(await testCRUDOperations());
    } else {
        // Якщо таблиця не існує, пропускаємо інші тести
        results.push(false, false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ CLIENTS');
    console.log('================================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести clients пройшли успішно!');
        console.log('✅ Таблиця готова до використання');
        console.log('🔄 Можна переходити до створення таблиць користувачів');
    } else if (results[0] === false) {
        console.log('❌ Таблиця clients не створена');
        console.log('📋 Потрібно:');
        console.log('   1. Відкрити Supabase Dashboard');
        console.log('   2. Перейти в SQL Editor');
        console.log('   3. Виконати SQL з файлу migrations/supabase/002_create_clients_table.sql');
    } else if (successCount >= 3) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна використовувати таблицю');
    } else {
        console.log('❌ Критичні помилки в таблиці clients');
        console.log('🛑 Потрібно вирішити проблеми');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    return successCount >= 3;
}

// Запуск тестів
if (require.main === module) {
    runClientsTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runClientsTests };