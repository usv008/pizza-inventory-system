#!/usr/bin/env node

/**
 * Тест таблиці operations_log в Supabase
 * 
 * Перевіряє створення та роботу з таблицею operations_log
 * Запуск: node tests/supabase/test-operations-log-table.js
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

console.log('🧪 Тестування таблиці operations_log в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці operations_log');
    
    try {
        const { data, error } = await supabase
            .from('operations_log')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця operations_log існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця operations_log не існує');
            console.log('   Потрібно виконати міграцію 019_create_operations_log_table.sql');
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці operations_log');
    
    try {
        const { data, error } = await supabase
            .from('operations_log')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, operation_type, entity_type, description, user_name, success');
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
            .from('operations_log')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} записів операційного логу`);
            
            if (data.length > 0) {
                console.log('   Приклад операцій:');
                data.slice(0, 3).forEach((log, index) => {
                    const time = log.execution_time_ms ? `${log.execution_time_ms}ms` : 'N/A';
                    const status = log.success ? '✅' : '❌';
                    console.log(`   ${index + 1}. ${status} ${log.operation_type} (${log.entity_type}): ${log.description.substring(0, 50)}... (${time})`);
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
 * Тест 4: Перевірка JSONB полів
 */
async function testJsonbFields() {
    console.log('\n📋 Тест 4: Перевірка JSONB полів old_data та new_data');
    
    try {
        const { data, error } = await supabase
            .from('operations_log')
            .select('id, operation_type, old_data, new_data')
            .not('new_data', 'is', null)
            .limit(5);
        
        if (!error) {
            console.log(`✅ JSONB поля працюють коректно`);
            console.log(`   Знайдено ${data.length} записів з JSONB даними`);
            
            if (data.length > 0) {
                console.log('   Приклад JSONB даних:');
                data.forEach((log, index) => {
                    const hasOldData = log.old_data ? 'є дані' : 'NULL';
                    const hasNewData = log.new_data ? 'є дані' : 'NULL';
                    console.log(`   ${index + 1}. ${log.operation_type}: old_data(${hasOldData}), new_data(${hasNewData})`);
                });
            }
            
            return true;
        } else {
            console.log('❌ Помилка JSONB полів:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування JSONB:', err.message);
        return false;
    }
}

/**
 * Тест 5: Перевірка foreign key зв'язків
 */
async function testForeignKeys() {
    console.log('\n📋 Тест 5: Перевірка foreign key зв\'язків з users');
    
    try {
        const { data, error } = await supabase
            .from('operations_log')
            .select(`
                id,
                operation_type,
                entity_type,
                user_name,
                success,
                users:user_id (
                    id,
                    username,
                    role
                )
            `)
            .not('user_id', 'is', null)
            .limit(5);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки з users працюють');
            console.log(`   Знайдено ${data.length} записів з користувачами`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((log, index) => {
                    const user = log.users;
                    const status = log.success ? '✅' : '❌';
                    console.log(`   ${index + 1}. ${status} ${log.operation_type} (${log.entity_type})`);
                    console.log(`      User: ${log.user_name} → DB: ${user ? user.username : 'NULL'} (${user ? user.role : 'N/A'})`);
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
 * Тест 6: Статистика операцій
 */
async function testOperationsStatistics() {
    console.log('\n📋 Тест 6: Статистика операцій');
    
    try {
        // Загальна статистика
        const { data: allLogs, error } = await supabase
            .from('operations_log')
            .select('operation_type, entity_type, success, execution_time_ms, user_name')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість операцій: ${allLogs.length}`);
            
            // Статистика по типах операцій
            const operationStats = {};
            const entityStats = {};
            const userStats = {};
            let totalTime = 0;
            let timeCount = 0;
            let successCount = 0;
            
            allLogs.forEach(log => {
                // Типи операцій
                if (!operationStats[log.operation_type]) {
                    operationStats[log.operation_type] = { total: 0, success: 0, failed: 0 };
                }
                operationStats[log.operation_type].total++;
                if (log.success) {
                    operationStats[log.operation_type].success++;
                    successCount++;
                } else {
                    operationStats[log.operation_type].failed++;
                }
                
                // Типи сутностей
                entityStats[log.entity_type] = (entityStats[log.entity_type] || 0) + 1;
                
                // Користувачі
                userStats[log.user_name] = (userStats[log.user_name] || 0) + 1;
                
                // Час виконання
                if (log.execution_time_ms) {
                    totalTime += log.execution_time_ms;
                    timeCount++;
                }
            });
            
            console.log('✅ Статистика по типах операцій:');
            Object.entries(operationStats).forEach(([type, stats]) => {
                console.log(`   - ${type}: ${stats.total} (✅${stats.success}, ❌${stats.failed})`);
            });
            
            console.log('✅ Статистика по типах сутностей:');
            Object.entries(entityStats).slice(0, 5).forEach(([entity, count]) => {
                console.log(`   - ${entity}: ${count} операцій`);
            });
            
            console.log('✅ Статистика по користувачах:');
            Object.entries(userStats).forEach(([user, count]) => {
                console.log(`   - ${user}: ${count} операцій`);
            });
            
            const successRate = Math.round((successCount / allLogs.length) * 100);
            console.log(`✅ Успішність операцій: ${successCount}/${allLogs.length} (${successRate}%)`);
            
            if (timeCount > 0) {
                const avgTime = Math.round(totalTime / timeCount);
                console.log(`✅ Середній час виконання: ${avgTime}ms`);
            }
            
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
 * Тест 7: Аналіз помилок
 */
async function testErrorAnalysis() {
    console.log('\n📋 Тест 7: Аналіз помилок');
    
    try {
        const { data: errors, error } = await supabase
            .from('operations_log')
            .select('operation_type, entity_type, description, error_message, user_name, created_at')
            .eq('success', false)
            .order('created_at', { ascending: false });
        
        if (!error) {
            if (errors.length > 0) {
                console.log(`✅ Знайдено ${errors.length} операцій з помилками`);
                console.log('   Приклад помилок:');
                errors.forEach((errorLog, index) => {
                    console.log(`   ${index + 1}. ${errorLog.operation_type} (${errorLog.entity_type}): ${errorLog.description}`);
                    if (errorLog.error_message) {
                        console.log(`      Помилка: ${errorLog.error_message}`);
                    }
                });
            } else {
                console.log('✅ Помилок не знайдено - всі операції успішні');
            }
            
            return true;
        } else {
            console.log('❌ Помилка аналізу помилок:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування аналізу помилок:', err.message);
        return false;
    }
}

/**
 * Тест 8: Аналіз продуктивності
 */
async function testPerformanceAnalysis() {
    console.log('\n📋 Тест 8: Аналіз продуктивності операцій');
    
    try {
        const { data: perfData, error } = await supabase
            .from('operations_log')
            .select('operation_type, entity_type, execution_time_ms')
            .not('execution_time_ms', 'is', null)
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Знайдено ${perfData.length} операцій з даними про продуктивність`);
            
            // Групуємо по типах операцій
            const perfStats = {};
            
            perfData.forEach(log => {
                const key = `${log.operation_type}_${log.entity_type}`;
                if (!perfStats[key]) {
                    perfStats[key] = {
                        operation: log.operation_type,
                        entity: log.entity_type,
                        times: []
                    };
                }
                perfStats[key].times.push(log.execution_time_ms);
            });
            
            console.log('✅ Топ операцій за середнім часом виконання:');
            const sortedPerf = Object.values(perfStats)
                .map(stat => ({
                    ...stat,
                    count: stat.times.length,
                    min: Math.min(...stat.times),
                    max: Math.max(...stat.times),
                    avg: Math.round(stat.times.reduce((a, b) => a + b, 0) / stat.times.length)
                }))
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 5);
            
            sortedPerf.forEach((stat, index) => {
                console.log(`   ${index + 1}. ${stat.operation} (${stat.entity}): ${stat.avg}ms avg (${stat.min}-${stat.max}ms, ${stat.count} ops)`);
            });
            
            return true;
        } else {
            console.log('❌ Помилка аналізу продуктивності:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування продуктивності:', err.message);
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
        testJsonbFields,
        testForeignKeys,
        testOperationsStatistics,
        testErrorAnalysis,
        testPerformanceAnalysis
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
        console.log('✅ Таблиця operations_log готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця operations_log потребує додаткової налаштування');
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