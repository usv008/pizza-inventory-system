#!/usr/bin/env node

/**
 * Тест таблиці stock_movements в Supabase
 * 
 * Перевіряє створення та роботу з таблицею stock_movements
 * Запуск: node tests/supabase/test-stock-movements-table.js
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

console.log('🧪 Тестування таблиці stock_movements в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці stock_movements');
    
    try {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця stock_movements існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця stock_movements не існує');
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
            .from('stock_movements')
            .select('id, product_id, movement_type, pieces, boxes, reason, user_name, batch_id, batch_date, created_by_user_id, created_at')
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
 * Тест 3: Перевірка foreign key до products
 */
async function testForeignKeyConstraints() {
    console.log('\n🔗 Тест 3: Перевірка foreign key constraints');
    
    try {
        // Перевіряємо, чи є зв'язок з products через JOIN
        const { data, error } = await supabase
            .from('stock_movements')
            .select(`
                id,
                product_id,
                movement_type,
                pieces,
                products:product_id (
                    id,
                    name,
                    code
                )
            `)
            .limit(3);
        
        if (!error && data) {
            console.log('✅ Foreign key до products працює');
            console.log(`   Знайдено ${data.length} рухів з інформацією про товари`);
            
            if (data.length > 0 && data[0].products) {
                console.log(`   Приклад: ${data[0].products.name} (${data[0].movement_type}: ${data[0].pieces} шт.)`);
            }
            
            return true;
        } else {
            console.log('⚠️  Помилка foreign key або дані відсутні:');
            if (error) {
                console.log(`   Код: ${error.code}`);
                console.log(`   Повідомлення: ${error.message}`);
            }
            return data ? data.length === 0 : false;
        }
    } catch (error) {
        console.log('❌ Критична помилка перевірки FK:');
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Тест 4: Перевірка тестових даних
 */
async function testTestData() {
    console.log('\n📊 Тест 4: Перевірка тестових даних');
    
    try {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .order('created_at');
        
        if (!error && data) {
            console.log('✅ Тестові дані доступні');
            console.log(`   Знайдено ${data.length} рухів запасів`);
            
            // Аналіз типів рухів
            const movementTypes = {};
            data.forEach(movement => {
                movementTypes[movement.movement_type] = (movementTypes[movement.movement_type] || 0) + 1;
            });
            
            console.log('   Типи рухів:');
            Object.entries(movementTypes).forEach(([type, count]) => {
                console.log(`     ${type}: ${count} записів`);
            });
            
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
 * Тест 5: Перевірка операцій CRUD
 */
async function testCRUDOperations() {
    console.log('\n⚙️  Тест 5: Перевірка операцій CRUD');
    
    try {
        // CREATE - Створення тестового руху
        const { data: insertData, error: insertError } = await supabase
            .from('stock_movements')
            .insert({
                product_id: 1, // Припускаємо, що товар з ID=1 існує
                movement_type: 'ADJUSTMENT',
                pieces: 10,
                boxes: 1,
                reason: 'CRUD тест - коригування залишків',
                user_name: 'test_user'
            })
            .select();
        
        if (insertError) {
            console.log('❌ Помилка створення (CREATE):');
            console.log(`   ${insertError.message}`);
            return false;
        }
        
        const testId = insertData[0].id;
        console.log('✅ CREATE: Рух створено успішно');
        
        // READ - Читання руху
        const { data: readData, error: readError } = await supabase
            .from('stock_movements')
            .select('*')
            .eq('id', testId)
            .single();
        
        if (readError || !readData) {
            console.log('❌ Помилка читання (READ):');
            console.log(`   ${readError?.message || 'Рух не знайдено'}`);
            return false;
        }
        
        console.log('✅ READ: Рух прочитано успішно');
        
        // UPDATE - Оновлення руху (зазвичай рухи не оновлюються, але для тесту)
        const { error: updateError } = await supabase
            .from('stock_movements')
            .update({
                reason: 'CRUD тест - оновлено причину'
            })
            .eq('id', testId);
        
        if (updateError) {
            console.log('❌ Помилка оновлення (UPDATE):');
            console.log(`   ${updateError.message}`);
            return false;
        }
        
        console.log('✅ UPDATE: Рух оновлено успішно');
        
        // DELETE - Видалення тестового руху
        const { error: deleteError } = await supabase
            .from('stock_movements')
            .delete()
            .eq('id', testId);
        
        if (deleteError) {
            console.log('❌ Помилка видалення (DELETE):');
            console.log(`   ${deleteError.message}`);
            return false;
        }
        
        console.log('✅ DELETE: Рух видалено успішно');
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
async function runStockMovementsTests() {
    console.log('🎯 ТЕСТУВАННЯ ТАБЛИЦІ STOCK_MOVEMENTS');
    console.log('=====================================');
    console.log(`📍 Проект: wncukuajzygzyasofyoe`);
    console.log(`🗄️  Таблиця: public.stock_movements`);
    console.log('=====================================\n');

    const results = [];
    
    // Запускаємо тести послідовно
    results.push(await testTableExists());
    
    if (results[0]) {
        results.push(await testTableStructure());
        results.push(await testForeignKeyConstraints());
        results.push(await testTestData());
        results.push(await testCRUDOperations());
    } else {
        // Якщо таблиця не існує, пропускаємо інші тести
        results.push(false, false, false, false);
    }
    
    // Підсумки
    console.log('\n📊 ПІДСУМКИ ТЕСТУВАННЯ STOCK_MOVEMENTS');
    console.log('========================================');
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести stock_movements пройшли успішно!');
        console.log('✅ Таблиця готова до використання');
        console.log('🔄 Журнал рухів запасів функціонує');
    } else if (results[0] === false) {
        console.log('❌ Таблиця stock_movements не створена');
        console.log('📋 Потрібно:');
        console.log('   1. Створити спочатку таблиці products');
        console.log('   2. Відкрити Supabase Dashboard');
        console.log('   3. Перейти в SQL Editor');
        console.log('   4. Виконати SQL з файлу migrations/supabase/003_create_stock_movements_table.sql');
    } else if (successCount >= 3) {
        console.log('⚠️  Частково успішно - основні функції працюють');
        console.log('✅ Можна використовувати таблицю');
    } else {
        console.log('❌ Критичні помилки в таблиці stock_movements');
        console.log('🛑 Потрібно вирішити проблеми');
    }
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    return successCount >= 3;
}

// Запуск тестів
if (require.main === module) {
    runStockMovementsTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runStockMovementsTests };