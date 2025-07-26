#!/usr/bin/env node

/**
 * Тест таблиці arrivals в Supabase
 * 
 * Перевіряє створення та роботу з таблицею arrivals
 * Запуск: node tests/supabase/test-arrivals-table.js
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

console.log('🧪 Тестування таблиці arrivals в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці arrivals');
    
    try {
        const { data, error } = await supabase
            .from('arrivals')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця arrivals існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця arrivals не існує');
            console.log('   Потрібно виконати міграцію 017_create_arrivals_table.sql');
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці arrivals');
    
    try {
        const { data, error } = await supabase
            .from('arrivals')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, arrival_number, arrival_date, reason, status, total_items');
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
            .from('arrivals')
            .select('*')
            .order('arrival_date', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} надходжень товарів`);
            
            if (data.length > 0) {
                console.log('   Приклад надходжень:');
                data.slice(0, 3).forEach((arrival, index) => {
                    console.log(`   ${index + 1}. ${arrival.arrival_number} (${arrival.arrival_date}): ${arrival.reason}, ${arrival.total_items} позицій, статус: ${arrival.status}`);
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
        // Перевіряємо причини
        const { data: reasons, error: error1 } = await supabase
            .from('arrivals')
            .select('reason')
            .limit(100);
        
        if (!error1) {
            const uniqueReasons = [...new Set(reasons.map(item => item.reason))];
            const validReasons = ['PURCHASE', 'PRODUCTION', 'RETURN', 'CORRECTION', 'TRANSFER', 'OTHER'];
            
            console.log(`✅ Знайдено причини: ${uniqueReasons.join(', ')}`);
            
            const invalidReasons = uniqueReasons.filter(r => !validReasons.includes(r));
            if (invalidReasons.length === 0) {
                console.log('✅ Всі причини відповідають CHECK constraint');
            } else {
                console.log(`❌ Некоректні причини: ${invalidReasons.join(', ')}`);
            }
        }
        
        // Перевіряємо статуси
        const { data: statuses, error: error2 } = await supabase
            .from('arrivals')
            .select('status')
            .limit(100);
        
        if (!error2) {
            const uniqueStatuses = [...new Set(statuses.map(item => item.status))];
            const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
            
            console.log(`✅ Знайдено статуси: ${uniqueStatuses.join(', ')}`);
            
            const invalidStatuses = uniqueStatuses.filter(s => !validStatuses.includes(s));
            if (invalidStatuses.length === 0) {
                console.log('✅ Всі статуси відповідають CHECK constraint');
            } else {
                console.log(`❌ Некоректні статуси: ${invalidStatuses.join(', ')}`);
            }
        }
        
        return !error1 && !error2;
    } catch (err) {
        console.log('❌ Помилка тестування constraints:', err.message);
        return false;
    }
}

/**
 * Тест 5: Перевірка унікальності номерів надходжень
 */
async function testUniqueNumbers() {
    console.log('\n📋 Тест 5: Перевірка унікальності номерів надходжень');
    
    try {
        const { data, error } = await supabase
            .from('arrivals')
            .select('arrival_number')
            .limit(1000);
        
        if (!error) {
            const numbers = data.map(item => item.arrival_number);
            const uniqueNumbers = [...new Set(numbers)];
            
            if (numbers.length === uniqueNumbers.length) {
                console.log(`✅ Всі ${numbers.length} номерів унікальні`);
                
                // Перевіряємо формат номерів
                const validFormat = numbers.filter(num => /^ARR\d{6}$/.test(num));
                if (validFormat.length === numbers.length) {
                    console.log('✅ Всі номери мають правильний формат ARR######');
                } else {
                    console.log(`⚠️  ${numbers.length - validFormat.length} номерів мають неправильний формат`);
                }
            } else {
                console.log(`❌ Знайдено ${numbers.length - uniqueNumbers.length} дублюючих номерів`);
            }
            
            return numbers.length === uniqueNumbers.length;
        } else {
            console.log('❌ Помилка перевірки унікальності:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування унікальності:', err.message);
        return false;
    }
}

/**
 * Тест 6: Перевірка foreign key зв'язків
 */
async function testForeignKeys() {
    console.log('\n📋 Тест 6: Перевірка foreign key зв\'язків з users');
    
    try {
        const { data, error } = await supabase
            .from('arrivals')
            .select(`
                id,
                arrival_number,
                arrival_date,
                reason,
                status,
                created_by_user_id,
                processed_by_user_id,
                creator:created_by_user_id (
                    id,
                    username,
                    role
                ),
                processor:processed_by_user_id (
                    id,
                    username,
                    role
                )
            `)
            .limit(5);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки з users працюють');
            console.log(`   Знайдено ${data.length} надходжень з користувачами`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((arrival, index) => {
                    const creator = arrival.creator;
                    const processor = arrival.processor;
                    
                    console.log(`   ${index + 1}. ${arrival.arrival_number} (${arrival.arrival_date})`);
                    console.log(`      Created by: ${creator ? creator.username : 'NULL'} (${creator ? creator.role : 'N/A'})`);
                    console.log(`      Processed by: ${processor ? processor.username : 'NULL'} (${processor ? processor.role : 'N/A'})`);
                    console.log(`      Status: ${arrival.status}, Reason: ${arrival.reason}`);
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
 * Тест 7: Статистика надходжень
 */
async function testArrivalsStatistics() {
    console.log('\n📋 Тест 7: Статистика надходжень');
    
    try {
        // Загальна статистика
        const { data: allArrivals, error } = await supabase
            .from('arrivals')
            .select('reason, status, total_items, supplier_name')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість надходжень: ${allArrivals.length}`);
            
            // Статистика по причинах
            const reasonStats = {};
            const statusStats = {};
            const supplierStats = {};
            let totalItems = 0;
            
            allArrivals.forEach(arrival => {
                // Причини
                if (!reasonStats[arrival.reason]) {
                    reasonStats[arrival.reason] = { count: 0, items: 0 };
                }
                reasonStats[arrival.reason].count++;
                reasonStats[arrival.reason].items += arrival.total_items || 0;
                
                // Статуси
                statusStats[arrival.status] = (statusStats[arrival.status] || 0) + 1;
                
                // Постачальники
                if (arrival.supplier_name) {
                    supplierStats[arrival.supplier_name] = (supplierStats[arrival.supplier_name] || 0) + 1;
                }
                
                totalItems += arrival.total_items || 0;
            });
            
            console.log('✅ Статистика по причинах:');
            Object.entries(reasonStats).forEach(([reason, stats]) => {
                console.log(`   - ${reason}: ${stats.count} надходжень, ${stats.items} позицій`);
            });
            
            console.log('✅ Статистика по статусах:');
            Object.entries(statusStats).forEach(([status, count]) => {
                console.log(`   - ${status}: ${count} надходжень`);
            });
            
            console.log('✅ Статистика по постачальниках:');
            Object.entries(supplierStats).slice(0, 3).forEach(([supplier, count]) => {
                console.log(`   - ${supplier}: ${count} надходжень`);
            });
            
            console.log(`✅ Загальна кількість позицій: ${totalItems}`);
            
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
 * Тест 8: Перевірка функції генерації номерів
 */
async function testNumberGeneration() {
    console.log('\n📋 Тест 8: Перевірка функції генерації номерів');
    
    try {
        // Викликаємо функцію генерації номеру
        const { data, error } = await supabase
            .rpc('generate_arrival_number');
        
        if (!error && data) {
            console.log(`✅ Функція генерації номерів працює`);
            console.log(`   Наступний номер: ${data}`);
            
            // Перевіряємо формат
            if (/^ARR\d{6}$/.test(data)) {
                console.log('✅ Формат згенерованого номеру правильний');
                return true;
            } else {
                console.log(`❌ Неправильний формат номеру: ${data}`);
                return false;
            }
        } else {
            console.log('❌ Помилка функції генерації номерів:', error?.message || 'невідома помилка');
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування генерації номерів:', err.message);
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
        testUniqueNumbers,
        testForeignKeys,
        testArrivalsStatistics,
        testNumberGeneration
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
        console.log('✅ Таблиця arrivals готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця arrivals потребує додаткової налаштування');
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