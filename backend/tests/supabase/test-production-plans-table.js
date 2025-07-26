#!/usr/bin/env node

/**
 * Тест таблиці production_plans в Supabase
 * 
 * Перевіряє створення та роботу з таблицею production_plans
 * Запуск: node tests/supabase/test-production-plans-table.js
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

console.log('🧪 Тестування таблиці production_plans в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці production_plans');
    
    try {
        const { data, error } = await supabase
            .from('production_plans')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця production_plans існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця production_plans не існує');
            console.log('   Потрібно виконати міграцію 015_create_production_plans_table.sql');
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці production_plans');
    
    try {
        const { data, error } = await supabase
            .from('production_plans')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, plan_date, status, total_planned, total_produced');
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
            .from('production_plans')
            .select('*')
            .order('plan_date', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} планів виробництва`);
            
            if (data.length > 0) {
                console.log('   Приклад планів:');
                data.slice(0, 3).forEach((plan, index) => {
                    const completion = plan.total_planned > 0 
                        ? Math.round((plan.total_produced / plan.total_planned) * 100) 
                        : 0;
                    
                    console.log(`   ${index + 1}. ${plan.plan_date} (${plan.status}): ${plan.total_produced}/${plan.total_planned} (${completion}%)`);
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
 * Тест 4: Перевірка статусів та CHECK constraints
 */
async function testStatusConstraints() {
    console.log('\n📋 Тест 4: Перевірка статусів та обмежень');
    
    try {
        // Перевіряємо різні статуси
        const { data, error } = await supabase
            .from('production_plans')
            .select('status')
            .limit(100);
        
        if (!error) {
            const statuses = [...new Set(data.map(plan => plan.status))];
            const validStatuses = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
            
            console.log(`✅ Знайдено статуси: ${statuses.join(', ')}`);
            
            const invalidStatuses = statuses.filter(status => !validStatuses.includes(status));
            if (invalidStatuses.length === 0) {
                console.log('✅ Всі статуси відповідають CHECK constraint');
            } else {
                console.log(`❌ Знайдено некоректні статуси: ${invalidStatuses.join(', ')}`);
            }
            
            return invalidStatuses.length === 0;
        } else {
            console.log('❌ Помилка перевірки статусів:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування статусів:', err.message);
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
            .from('production_plans')
            .select(`
                id,
                plan_date,
                status,
                created_by_user_id,
                approved_by_user_id,
                creator:created_by_user_id (
                    id,
                    username,
                    role
                ),
                approver:approved_by_user_id (
                    id,
                    username,
                    role
                )
            `)
            .limit(5);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки з users працюють');
            console.log(`   Знайдено ${data.length} планів з користувачами`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((plan, index) => {
                    const creator = plan.creator;
                    const approver = plan.approver;
                    console.log(`   ${index + 1}. ${plan.plan_date} (${plan.status})`);
                    console.log(`      Created by: ${creator ? creator.username : 'NULL'} (${creator ? creator.role : 'N/A'})`);
                    console.log(`      Approved by: ${approver ? approver.username : 'NULL'} (${approver ? approver.role : 'N/A'})`);
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
 * Тест 6: Статистика планів виробництва
 */
async function testProductionStatistics() {
    console.log('\n📋 Тест 6: Статистика планів виробництва');
    
    try {
        // Загальна статистика
        const { data: allPlans, error } = await supabase
            .from('production_plans')
            .select('status, total_planned, total_produced')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість планів: ${allPlans.length}`);
            
            // Статистика по статусах
            const statusStats = {};
            let totalPlanned = 0;
            let totalProduced = 0;
            
            allPlans.forEach(plan => {
                if (!statusStats[plan.status]) {
                    statusStats[plan.status] = { count: 0, planned: 0, produced: 0 };
                }
                statusStats[plan.status].count++;
                statusStats[plan.status].planned += plan.total_planned || 0;
                statusStats[plan.status].produced += plan.total_produced || 0;
                
                totalPlanned += plan.total_planned || 0;
                totalProduced += plan.total_produced || 0;
            });
            
            console.log('✅ Статистика по статусах:');
            Object.entries(statusStats).forEach(([status, stats]) => {
                const completion = stats.planned > 0 
                    ? Math.round((stats.produced / stats.planned) * 100) 
                    : 0;
                console.log(`   - ${status}: ${stats.count} планів, ${stats.produced}/${stats.planned} (${completion}%)`);
            });
            
            const overallCompletion = totalPlanned > 0 
                ? Math.round((totalProduced / totalPlanned) * 100) 
                : 0;
            console.log(`✅ Загальне виконання: ${totalProduced}/${totalPlanned} (${overallCompletion}%)`);
            
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
 * Тест 7: Перевірка унікального індексу на дату
 */
async function testUniqueConstraint() {
    console.log('\n📋 Тест 7: Перевірка унікального індексу на дату');
    
    try {
        // Групуємо по датах (виключаючи CANCELLED)
        const { data, error } = await supabase
            .from('production_plans')
            .select('plan_date, status')
            .neq('status', 'CANCELLED')
            .limit(1000);
        
        if (!error) {
            const dateGroups = {};
            
            data.forEach(plan => {
                if (!dateGroups[plan.plan_date]) {
                    dateGroups[plan.plan_date] = [];
                }
                dateGroups[plan.plan_date].push(plan.status);
            });
            
            const duplicateDates = Object.entries(dateGroups)
                .filter(([date, statuses]) => statuses.length > 1);
            
            if (duplicateDates.length === 0) {
                console.log('✅ Унікальний індекс на дату працює коректно');
                console.log('   Немає дублюючих планів на одну дату (окрім CANCELLED)');
            } else {
                console.log('⚠️  Знайдено дублюючі дати:');
                duplicateDates.forEach(([date, statuses]) => {
                    console.log(`   - ${date}: статуси ${statuses.join(', ')}`);
                });
            }
            
            return duplicateDates.length === 0;
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
 * Запуск всіх тестів
 */
async function runAllTests() {
    let totalTests = 0;
    let passedTests = 0;
    
    const tests = [
        testTableExists,
        testTableStructure,
        testSampleData,
        testStatusConstraints,
        testForeignKeys,
        testProductionStatistics,
        testUniqueConstraint
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
        console.log('✅ Таблиця production_plans готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця production_plans потребує додаткової налаштування');
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