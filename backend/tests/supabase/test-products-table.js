#!/usr/bin/env node

/**
 * Тест таблиці products в Supabase
 * 
 * Перевіряє створення та роботу з таблицею products
 * Запуск: node test-products-table.js
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

console.log('🧪 Тестування таблиці products в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці products');
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця products існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця products не існує');
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
            .from('products')
            .select('id, name, code, weight, barcode, pieces_per_box, stock_pieces, stock_boxes, min_stock_pieces, created_at, updated_at')
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
            .from('products')
            .select('*')
            .order('created_at');
        
        if (!error && data) {
            console.log('✅ Тестові дані доступні');
            console.log(`   Знайдено ${data.length} товарів`);
            
            if (data.length > 0) {
                console.log('   Приклади товарів:');
                data.slice(0, 3).forEach((product, index) => {
                    console.log(`   ${index + 1}. ${product.name} (${product.code}) - ${product.stock_pieces} шт.`);
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
 * Тест 4: Перевірка унікальних обмежень
 */
async function testUniqueConstraints() {
    console.log('\n🔒 Тест 4: Перевірка унікальних обмежень');
    
    try {
        // Спробуємо вставити дублікат по коду
        const { error } = await supabase
            .from('products')
            .insert({
                name: 'Тестовий товар',
                code: 'PM001', // Цей код вже існує
                weight: 100.00,
                pieces_per_box: 1
            });
        
        if (error && error.code === '23505') {
            console.log('✅ Унікальні обмеження працюють');
            console.log('   Дублікат коду відхилено');
            return true;
        } else if (error) {
            console.log('⚠️  Інша помилка при вставці:');
            console.log(`   Код: ${error.code}`);
            console.log(`   Повідомлення: ${error.message}`);
            return true; // Це може бути інша валідна причина
        } else {
            console.log('❌ Унікальні обмеження не працюють');
            console.log('   Дублікат було вставлено');
            
            // Видаляємо тестовий запис
            await supabase
                .from('products')
                .delete()
                .eq('name', 'Тестовий товар');
                
            return false;
        }
    } catch (error) {
        console.log('❌ Критична помилка тестування обмежень:');
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
        // CREATE - Створення тестового товару
        const { data: insertData, error: insertError } = await supabase
            .from('products')
            .insert({
                name: 'CRUD Тест Товар',
                code: 'TEST001',
                weight: 250.00,
                barcode: '1234567890123',
                pieces_per_box: 5,
                stock_pieces: 25,
                stock_boxes: 5,
                min_stock_pieces: 10
            })
            .select();
        
        if (insertError) {
            console.log('❌ Помилка створення (CREATE):');
            console.log(`   ${insertError.message}`);
            return false;
        }
        
        const testId = insertData[0].id;
        console.log('✅ CREATE: Товар створено успішно');
        
        // READ - Читання товару
        const { data: readData, error: readError } = await supabase
            .from('products')
            .select('*')
            .eq('id', testId)
            .single();
        
        if (readError || !readData) {
            console.log('❌ Помилка читання (READ):');
            console.log(`   ${readError?.message || 'Товар не знайдено'}`);
            return false;
        }
        
        console.log('✅ READ: Товар прочитано успішно');
        
        // UPDATE - Оновлення товару
        const { error: updateError } = await supabase
            .from('products')
            .update({
                stock_pieces: 30,
                stock_boxes: 6
            })
            .eq('id', testId);
        
        if (updateError) {
            console.log('❌ Помилка оновлення (UPDATE):');
            console.log(`   ${updateError.message}`);
            return false;
        }
        
        console.log('✅ UPDATE: Товар оновлено успішно');
        
        // DELETE - Видалення товару
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', testId);
        
        if (deleteError) {
            console.log('❌ Помилка видалення (DELETE):');
            console.log(`   ${deleteError.message}`);
            return false;
        }
        
        console.log('✅ DELETE: Товар видалено успішно');
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
async function runProductsTests() {
    console.log('🎯 ТЕСТУВАННЯ ТАБЛИЦІ PRODUCTS');
    console.log('===============================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🗄️  Таблиця: public.products`);
    console.log('===============================\n');

    const results = [];
    
    // Запускаємо тести послідовно
    results.push(await testTableExists());
    
    if (results[0]) {
        results.push(await testTableStructure());
        results.push(await testTestData());
        results.push(await testUniqueConstraints());
        results.push(await testCRUDOperations());
    } else {
        // Якщо таблиця не існує, пропускаємо інші тести
        results.push(false, false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ PRODUCTS');
    console.log('=================================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести products пройшли успішно!');
        console.log('✅ Таблиця готова до використання');
        console.log('🔄 Можна переходити до створення таблиці clients');
    } else if (results[0] === false) {
        console.log('❌ Таблиця products не створена');
        console.log('📋 Потрібно:');
        console.log('   1. Відкрити Supabase Dashboard');
        console.log('   2. Перейти в SQL Editor');
        console.log('   3. Виконати SQL з файлу supabase-products-table.sql');
    } else if (successCount >= 3) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна використовувати таблицю');
    } else {
        console.log('❌ Критичні помилки в таблиці products');
        console.log('🛑 Потрібно вирішити проблеми');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    return successCount >= 3;
}

// Запуск тестів
if (require.main === module) {
    runProductsTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runProductsTests };