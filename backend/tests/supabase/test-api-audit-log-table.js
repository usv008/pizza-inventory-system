#!/usr/bin/env node

/**
 * Тест таблиці api_audit_log в Supabase
 * 
 * Перевіряє створення та роботу з таблицею api_audit_log
 * Запуск: node tests/supabase/test-api-audit-log-table.js
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

console.log('🧪 Тестування таблиці api_audit_log в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці api_audit_log');
    
    try {
        const { data, error } = await supabase
            .from('api_audit_log')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця api_audit_log існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця api_audit_log не існує');
            console.log('   Потрібно виконати міграцію 014_create_api_audit_log_table.sql');
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці api_audit_log');
    
    try {
        const { data, error } = await supabase
            .from('api_audit_log')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, user_id, method, path, status_code, duration, success');
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
            .from('api_audit_log')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} записів API логу`);
            
            if (data.length > 0) {
                console.log('   Приклад записів:');
                data.slice(0, 3).forEach((log, index) => {
                    console.log(`   ${index + 1}. ${log.method} ${log.path} (${log.status_code}, ${log.duration}ms)`);
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
    console.log('\n📋 Тест 4: Перевірка JSONB полів request_body та response_body');
    
    try {
        const { data, error } = await supabase
            .from('api_audit_log')
            .select('id, method, path, request_body, response_body')
            .not('request_body', 'is', null)
            .limit(3);
        
        if (!error) {
            console.log(`✅ JSONB поля працюють коректно`);
            console.log(`   Знайдено ${data.length} записів з JSONB даними`);
            
            if (data.length > 0) {
                console.log('   Приклад JSONB даних:');
                data.forEach((log, index) => {
                    const reqBody = log.request_body ? 'є дані' : 'NULL';
                    const resBody = log.response_body ? 'є дані' : 'NULL';
                    console.log(`   ${index + 1}. ${log.method} ${log.path}: request(${reqBody}), response(${resBody})`);
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
            .from('api_audit_log')
            .select(`
                id,
                method,
                path,
                user_id,
                users:user_id (
                    id,
                    username,
                    role
                )
            `)
            .not('user_id', 'is', null)
            .limit(3);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки з users працюють');
            console.log(`   Знайдено ${data.length} записів з користувачами`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((log, index) => {
                    const user = log.users;
                    console.log(`   ${index + 1}. ${log.method} ${log.path} → user: ${user ? user.username : 'NULL'} (${user ? user.role : 'N/A'})`);
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
 * Тест 6: Статистика API запитів
 */
async function testApiStatistics() {
    console.log('\n📋 Тест 6: Статистика API запитів');
    
    try {
        // Статистика по методах
        const { data: allLogs, error } = await supabase
            .from('api_audit_log')
            .select('method, success, duration, status_code')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість запитів: ${allLogs.length}`);
            
            // Групуємо по методах
            const methodStats = {};
            const statusStats = {};
            let totalDuration = 0;
            let durationCount = 0;
            
            allLogs.forEach(log => {
                // Статистика по методах
                if (!methodStats[log.method]) {
                    methodStats[log.method] = { total: 0, success: 0, failed: 0 };
                }
                methodStats[log.method].total++;
                if (log.success) {
                    methodStats[log.method].success++;
                } else {
                    methodStats[log.method].failed++;
                }
                
                // Статистика по статус кодах
                statusStats[log.status_code] = (statusStats[log.status_code] || 0) + 1;
                
                // Тривалість
                if (log.duration) {
                    totalDuration += log.duration;
                    durationCount++;
                }
            });
            
            console.log('✅ Статистика по HTTP методах:');
            Object.entries(methodStats).forEach(([method, stats]) => {
                console.log(`   - ${method}: ${stats.total} (success: ${stats.success}, failed: ${stats.failed})`);
            });
            
            console.log('✅ Статистика по статус кодах:');
            Object.entries(statusStats).forEach(([code, count]) => {
                console.log(`   - ${code}: ${count} запитів`);
            });
            
            if (durationCount > 0) {
                const avgDuration = Math.round(totalDuration / durationCount);
                console.log(`✅ Середня тривалість запиту: ${avgDuration}ms`);
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
        testApiStatistics
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
        console.log('✅ Таблиця api_audit_log готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця api_audit_log потребує додаткової налаштування');
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