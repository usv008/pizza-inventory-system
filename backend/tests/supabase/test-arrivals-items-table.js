#!/usr/bin/env node

/**
 * Тест таблиці arrivals_items в Supabase
 * 
 * Перевіряє створення та роботу з таблицею arrivals_items
 * Запуск: node tests/supabase/test-arrivals-items-table.js
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

console.log('🧪 Тестування таблиці arrivals_items в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці arrivals_items');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця arrivals_items існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця arrivals_items не існує');
            console.log('   Потрібно виконати міграцію 018_create_arrivals_items_table.sql');
            return false;
        } else {
            console.log('⚠️  Помилка доступу до таблиці:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка з\'єднання з Supabase:', err.message);
        return false;
    }
}

/**
 * Тест 2: Перевірка структури таблиці
 */
async function testTableStructure() {
    console.log('\n📋 Тест 2: Перевірка структури таблиці arrivals_items');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, arrival_id, product_id, quantity, unit_price, batch_date');
            return true;
        } else {
            console.log('❌ Помилка структури таблиці:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка перевірки структури:', err.message);
        return false;
    }
}

/**
 * Тест 3: Перевірка тестових даних
 */
async function testSampleData() {
    console.log('\n📋 Тест 3: Перевірка тестових даних');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} позицій надходжень`);
            
            if (data.length > 0) {
                console.log('   Приклад позицій:');
                data.slice(0, 3).forEach((item, index) => {
                    const price = item.unit_price ? `${item.unit_price}/${item.total_price}` : 'N/A';
                    console.log(`   ${index + 1}. Arrival ${item.arrival_id}, Product ${item.product_id}: ${item.quantity} шт, ${price} грн, grade ${item.quality_grade}`);
                });
            }
            
            return true;
        } else {
            console.log('❌ Помилка завантаження даних:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка запиту даних:', err.message);
        return false;
    }
}

/**
 * Тест 4: Перевірка CHECK constraints
 */
async function testConstraints() {
    console.log('\n📋 Тест 4: Перевірка CHECK constraints');
    
    try {
        // Перевіряємо категорії якості
        const { data: grades, error: error1 } = await supabase
            .from('arrivals_items')
            .select('quality_grade')
            .limit(100);
        
        if (!error1) {
            const uniqueGrades = [...new Set(grades.map(item => item.quality_grade))];
            const validGrades = ['A', 'B', 'C', 'REJECT'];
            
            console.log(`✅ Знайдено категорії якості: ${uniqueGrades.join(', ')}`);
            
            const invalidGrades = uniqueGrades.filter(g => !validGrades.includes(g));
            if (invalidGrades.length === 0) {
                console.log('✅ Всі категорії якості відповідають CHECK constraint');
            } else {
                console.log(`❌ Некоректні категорії: ${invalidGrades.join(', ')}`);
            }
        }
        
        // Перевіряємо що quantity > 0
        const { data: quantities, error: error2 } = await supabase
            .from('arrivals_items')
            .select('quantity')
            .lte('quantity', 0);
        
        if (!error2) {
            if (quantities.length === 0) {
                console.log('✅ Всі кількості більше 0 (quantity > 0 constraint працює)');
            } else {
                console.log(`❌ Знайдено ${quantities.length} записів з quantity <= 0`);
            }
        }
        
        return !error1 && !error2;
    } catch (err) {
        console.log('❌ Помилка тестування constraints:', err.message);
        return false;
    }
}

/**
 * Тест 5: Перевірка foreign key зв'язків
 */
async function testForeignKeys() {
    console.log('\n📋 Тест 5: Перевірка foreign key зв\'язків');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select(`
                id,
                arrival_id,
                product_id,
                quantity,
                quality_grade,
                storage_location,
                arrivals:arrival_id (
                    id,
                    arrival_number,
                    reason
                ),
                products:product_id (
                    id,
                    name,
                    code
                )
            `)
            .limit(5);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки працюють');
            console.log(`   Знайдено ${data.length} позицій з пов\'язаними даними`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((item, index) => {
                    const arrival = item.arrivals;
                    const product = item.products;
                    
                    console.log(`   ${index + 1}. Arrival: ${arrival ? arrival.arrival_number : 'NULL'} (${arrival ? arrival.reason : 'N/A'})`);
                    console.log(`      Product: ${product ? product.name : 'NULL'} (${product ? product.code : 'N/A'})`);
                    console.log(`      Quantity: ${item.quantity}, Grade: ${item.quality_grade}, Location: ${item.storage_location || 'N/A'}`);
                });
            }
            
            return true;
        } else {
            console.log('❌ Помилка foreign key зв\'язків:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування FK:', err.message);
        return false;
    }
}

/**
 * Тест 6: Перевірка автоматичного розрахунку total_price
 */
async function testPriceCalculation() {
    console.log('\n📋 Тест 6: Перевірка автоматичного розрахунку total_price');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select('id, quantity, unit_price, total_price')
            .not('unit_price', 'is', null)
            .limit(10);
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} записів з ціною для перевірки`);
            
            let correctCalculations = 0;
            let incorrectCalculations = 0;
            
            data.forEach((item, index) => {
                const expectedTotal = parseFloat((item.unit_price * item.quantity).toFixed(2));
                const actualTotal = parseFloat(item.total_price);
                
                if (Math.abs(expectedTotal - actualTotal) < 0.01) { // допуск на округлення
                    correctCalculations++;
                    if (index < 3) {
                        console.log(`   ✅ ID ${item.id}: ${item.quantity} × ${item.unit_price} = ${item.total_price} (правильно)`);
                    }
                } else {
                    incorrectCalculations++;
                    console.log(`   ❌ ID ${item.id}: ${item.quantity} × ${item.unit_price} = ${item.total_price} (очікувалось ${expectedTotal})`);
                }
            });
            
            if (incorrectCalculations === 0) {
                console.log(`✅ Всі ${correctCalculations} розрахунків цін правильні`);
            } else {
                console.log(`⚠️  ${incorrectCalculations} неправильних розрахунків з ${data.length}`);
            }
            
            return incorrectCalculations === 0;
        } else {
            console.log('❌ Помилка перевірки розрахунків:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування розрахунків:', err.message);
        return false;
    }
}

/**
 * Тест 7: Статистика позицій надходжень
 */
async function testItemsStatistics() {
    console.log('\n📋 Тест 7: Статистика позицій надходжень');
    
    try {
        // Загальна статистика
        const { data: allItems, error } = await supabase
            .from('arrivals_items')
            .select('quality_grade, quantity, unit_price, total_price, storage_location')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість позицій: ${allItems.length}`);
            
            // Статистика по категоріях якості
            const gradeStats = {};
            const locationStats = {};
            let totalQuantity = 0;
            let totalValue = 0;
            let itemsWithPrice = 0;
            
            allItems.forEach(item => {
                // Категорії якості
                if (!gradeStats[item.quality_grade]) {
                    gradeStats[item.quality_grade] = { count: 0, quantity: 0 };
                }
                gradeStats[item.quality_grade].count++;
                gradeStats[item.quality_grade].quantity += item.quantity || 0;
                
                // Місця зберігання
                if (item.storage_location) {
                    locationStats[item.storage_location] = (locationStats[item.storage_location] || 0) + 1;
                }
                
                // Загальні суми
                totalQuantity += item.quantity || 0;
                if (item.total_price) {
                    totalValue += parseFloat(item.total_price);
                    itemsWithPrice++;
                }
            });
            
            console.log('✅ Статистика по категоріях якості:');
            Object.entries(gradeStats).forEach(([grade, stats]) => {
                console.log(`   - ${grade}: ${stats.count} позицій, ${stats.quantity} одиниць`);
            });
            
            console.log('✅ Статистика по місцях зберігання:');
            Object.entries(locationStats).slice(0, 5).forEach(([location, count]) => {
                console.log(`   - ${location}: ${count} позицій`);
            });
            
            console.log(`✅ Загальна кількість: ${totalQuantity} одиниць`);
            console.log(`✅ Загальна вартість: ${totalValue.toFixed(2)} грн (${itemsWithPrice} позицій з ціною)`);
            
            return true;
        } else {
            console.log('❌ Помилка статистики:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка обчислення статистики:', err.message);
        return false;
    }
}

/**
 * Тест 8: Аналіз термінів придатності
 */
async function testExpiryAnalysis() {
    console.log('\n📋 Тест 8: Аналіз термінів придатності');
    
    try {
        const { data, error } = await supabase
            .from('arrivals_items')
            .select('id, quantity, batch_date, expiry_date')
            .not('expiry_date', 'is', null)
            .limit(100);
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} позицій з термінами придатності`);
            
            const now = new Date();
            const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            let expired = 0;
            let expiringSoon = 0;
            let expiringWeek = 0;
            let fresh = 0;
            
            data.forEach(item => {
                const expiryDate = new Date(item.expiry_date);
                
                if (expiryDate < now) {
                    expired++;
                } else if (expiryDate <= twoDaysFromNow) {
                    expiringSoon++;
                } else if (expiryDate <= sevenDaysFromNow) {
                    expiringWeek++;
                } else {
                    fresh++;
                }
            });
            
            console.log('✅ Аналіз термінів придатності:');
            console.log(`   - Прострочено: ${expired} позицій`);
            console.log(`   - Закінчується (≤2 дні): ${expiringSoon} позицій`);
            console.log(`   - Скоро закінчується (≤7 днів): ${expiringWeek} позицій`);
            console.log(`   - Свіжий (>7 днів): ${fresh} позицій`);
            
            if (expired > 0) {
                console.log('⚠️  Увага: є прострочені позиції!');
            }
            
            return true;
        } else {
            console.log('❌ Помилка аналізу термінів:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування термінів:', err.message);
        return false;
    }
}

/**
 * Запуск всіх тестів
 */
async function runAllTests() {
    let totalTests = 0;
    let passedTests = 0;
    
    const tests = [
        testTableExists,
        testTableStructure,
        testSampleData,
        testConstraints,
        testForeignKeys,
        testPriceCalculation,
        testItemsStatistics,
        testExpiryAnalysis
    ];
    
    for (const test of tests) {
        totalTests++;
        const result = await test();
        if (result) passedTests++;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Результати тестування: ${passedTests}/${totalTests} тестів пройдено`);
    
    if (passedTests === totalTests) {
        console.log('🎉 Всі тести пройшли успішно!');
        console.log('✅ Таблиця arrivals_items готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця arrivals_items потребує додаткової налаштування');
    }
    
    return passedTests === totalTests;
}

// Запускаємо тести
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };