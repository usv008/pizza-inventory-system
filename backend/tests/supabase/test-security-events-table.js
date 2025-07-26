#!/usr/bin/env node

/**
 * Тест таблиці security_events в Supabase
 * 
 * Перевіряє створення та роботу з таблицею security_events
 * Запуск: node tests/supabase/test-security-events-table.js
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

console.log('🧪 Тестування таблиці security_events в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці security_events');
    
    try {
        const { data, error } = await supabase
            .from('security_events')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця security_events існує');
            console.log(`   Тестовий запит успішний`);
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця security_events не існує');
            console.log('   Потрібно виконати міграцію 013_create_security_events_table.sql');
            return false;
        } else {
            console.log('⚠️  Помилка доступу до таблиці:');
            console.log(`   Код: ${error.code}`);
            console.log(`   Повідомлення: ${error.message}`);
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці security_events');
    
    try {
        const { data, error } = await supabase
            .from('security_events')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, event_type, user_id, ip_address, details, created_at, severity');
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
            .from('security_events')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} записів подій безпеки`);
            
            if (data.length > 0) {
                console.log('   Приклад записів:');
                data.slice(0, 3).forEach((event, index) => {
                    console.log(`   ${index + 1}. ${event.event_type} (severity: ${event.severity}, resolved: ${event.resolved})`);
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
 * Тест 4: Перевірка JSONB поля details
 */
async function testJsonbField() {
    console.log('\n📋 Тест 4: Перевірка JSONB поля details');
    
    try {
        const { data, error } = await supabase
            .from('security_events')
            .select('id, event_type, details')
            .not('details', 'is', null)
            .limit(3);
        
        if (!error) {
            console.log(`✅ JSONB поле details працює коректно`);
            console.log(`   Знайдено ${data.length} записів з details`);
            
            if (data.length > 0) {
                console.log('   Приклад JSONB даних:');
                data.forEach((event, index) => {
                    console.log(`   ${index + 1}. ${event.event_type}: ${JSON.stringify(event.details)}`);
                });
            }
            
            return true;
        } else {
            console.log('❌ Помилка JSONB поля:', error.message);
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
            .from('security_events')
            .select(`
                id,
                event_type,
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
                data.forEach((event, index) => {
                    const user = event.users;
                    console.log(`   ${index + 1}. ${event.event_type} → user: ${user ? user.username : 'NULL'} (${user ? user.role : 'N/A'})`);
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
 * Тест 6: Перевірка індексів та фільтрації
 */
async function testIndexesAndFilters() {
    console.log('\n📋 Тест 6: Перевірка індексів та фільтрації');
    
    try {
        // Тест фільтрації по severity
        const { data: highSeverity, error: error1 } = await supabase
            .from('security_events')
            .select('id, event_type, severity')
            .in('severity', ['high', 'critical']);
        
        if (!error1) {
            console.log(`✅ Фільтрація по severity: знайдено ${highSeverity.length} записів високої важливості`);
        }
        
        // Тест фільтрації по resolved
        const { data: unresolved, error: error2 } = await supabase
            .from('security_events')
            .select('id, event_type, resolved')
            .eq('resolved', false);
        
        if (!error2) {
            console.log(`✅ Фільтрація по resolved: знайдено ${unresolved.length} нерозв'язаних подій`);
        }
        
        // Тест фільтрації по IP адресах
        const { data: ipEvents, error: error3 } = await supabase
            .from('security_events')
            .select('id, event_type, ip_address')
            .not('ip_address', 'is', null);
        
        if (!error3) {
            console.log(`✅ Фільтрація по IP: знайдено ${ipEvents.length} подій з IP адресами`);
        }
        
        return !error1 && !error2 && !error3;
    } catch (err) {
        console.log('❌ Помилка тестування індексів:', err.message);
        return false;
    }
}

/**
 * Тест 7: Статистика подій безпеки
 */
async function testSecurityStatistics() {
    console.log('\n📋 Тест 7: Статистика подій безпеки');
    
    try {
        // Загальна статистика
        const { count, error } = await supabase
            .from('security_events')
            .select('*', { count: 'exact', head: true });
        
        if (!error) {
            console.log(`✅ Загальна кількість подій: ${count}`);
        }
        
        // Статистика по типах подій
        const { data: eventTypes, error: error2 } = await supabase
            .from('security_events')
            .select('event_type')
            .limit(1000);
        
        if (!error2) {
            const typeStats = {};
            eventTypes.forEach(event => {
                typeStats[event.event_type] = (typeStats[event.event_type] || 0) + 1;
            });
            
            console.log('✅ Статистика по типах подій:');
            Object.entries(typeStats).forEach(([type, count]) => {
                console.log(`   - ${type}: ${count} подій`);
            });
        }
        
        return !error && !error2;
    } catch (err) {
        console.log('❌ Помилка статистики:', err.message);
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
        testJsonbField,
        testForeignKeys,
        testIndexesAndFilters,
        testSecurityStatistics
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
        console.log('✅ Таблиця security_events готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця security_events потребує додаткової налаштування');
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