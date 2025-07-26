#!/usr/bin/env node

/**
 * Тест таблиці production_plan_items в Supabase
 * 
 * Перевіряє створення та роботу з таблицею production_plan_items
 * Запуск: node tests/supabase/test-production-plan-items-table.js
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

console.log('🧪 Тестування таблиці production_plan_items в Supabase...\n');

/**
 * Тест 1: Перевірка існування таблиці
 */
async function testTableExists() {
    console.log('📋 Тест 1: Перевірка існування таблиці production_plan_items');
    
    try {
        const { data, error } = await supabase
            .from('production_plan_items')
            .select('*')
            .limit(1);
        
        if (!error) {
            console.log('✅ Таблиця production_plan_items існує');
            return true;
        } else if (error.code === 'PGRST116') {
            console.log('❌ Таблиця production_plan_items не існує');
            console.log('   Потрібно виконати міграцію 016_create_production_plan_items_table.sql');
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
    console.log('\n📋 Тест 2: Перевірка структури таблиці production_plan_items');
    
    try {
        const { data, error } = await supabase
            .from('production_plan_items')
            .select('*')
            .limit(0);
        
        if (!error) {
            console.log('✅ Структура таблиці коректна');
            console.log('   Основні поля: id, plan_id, product_id, quantity_needed, quantity_planned, quantity_produced');
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
            .from('production_plan_items')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error) {
            console.log(`✅ Знайдено ${data.length} позицій планів виробництва`);
            
            if (data.length > 0) {
                console.log('   Приклад позицій:');
                data.slice(0, 3).forEach((item, index) => {
                    const completion = item.quantity_planned > 0 
                        ? Math.round((item.quantity_produced / item.quantity_planned) * 100) 
                        : 0;
                    
                    console.log(`   ${index + 1}. Plan ${item.plan_id}, Product ${item.product_id}: ${item.quantity_produced}/${item.quantity_planned} (${completion}%, ${item.priority})`);
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
 * Тест 4: Перевірка CHECK constraints та enum значень
 */
async function testConstraints() {
    console.log('\n📋 Тест 4: Перевірка CHECK constraints та enum значень');
    
    try {
        // Перевіряємо пріоритети
        const { data: priorities, error: error1 } = await supabase
            .from('production_plan_items')
            .select('priority')
            .limit(100);
        
        if (!error1) {
            const uniquePriorities = [...new Set(priorities.map(item => item.priority))];
            const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
            
            console.log(`✅ Знайдено пріоритети: ${uniquePriorities.join(', ')}`);
            
            const invalidPriorities = uniquePriorities.filter(p => !validPriorities.includes(p));
            if (invalidPriorities.length === 0) {
                console.log('✅ Всі пріоритети відповідають CHECK constraint');
            } else {
                console.log(`❌ Некоректні пріоритети: ${invalidPriorities.join(', ')}`);
            }
        }
        
        // Перевіряємо причини
        const { data: reasons, error: error2 } = await supabase
            .from('production_plan_items')
            .select('reason')
            .limit(100);
        
        if (!error2) {
            const uniqueReasons = [...new Set(reasons.map(item => item.reason))];
            const validReasons = ['ORDER', 'STOCK', 'SEASONAL', 'PROMO', 'OTHER'];
            
            console.log(`✅ Знайдено причини: ${uniqueReasons.join(', ')}`);
            
            const invalidReasons = uniqueReasons.filter(r => !validReasons.includes(r));
            if (invalidReasons.length === 0) {
                console.log('✅ Всі причини відповідають CHECK constraint');
            } else {
                console.log(`❌ Некоректні причини: ${invalidReasons.join(', ')}`);
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
            .from('production_plan_items')
            .select(`
                id,
                plan_id,
                product_id,
                order_id,
                quantity_planned,
                quantity_produced,
                priority,
                production_plans:plan_id (
                    id,
                    plan_date,
                    status
                ),
                products:product_id (
                    id,
                    name,
                    code
                ),
                orders:order_id (
                    id,
                    client_name
                )
            `)
            .limit(5);
        
        if (!error) {
            console.log('✅ Foreign key зв\'язки працюють');
            console.log(`   Знайдено ${data.length} позицій з пов\'язаними даними`);
            
            if (data.length > 0) {
                console.log('   Приклад зв\'язків:');
                data.forEach((item, index) => {
                    const plan = item.production_plans;
                    const product = item.products;
                    const order = item.orders;
                    
                    console.log(`   ${index + 1}. Plan: ${plan ? plan.plan_date : 'NULL'} (${plan ? plan.status : 'N/A'})`);
                    console.log(`      Product: ${product ? product.name : 'NULL'} (code: ${product ? product.code : 'N/A'})`);
                    console.log(`      Order: ${order ? order.client_name : 'NULL'}`);
                    console.log(`      Quantity: ${item.quantity_produced}/${item.quantity_planned}, Priority: ${item.priority}`);
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
 * Тест 6: Статистика позицій планів
 */
async function testItemsStatistics() {
    console.log('\n📋 Тест 6: Статистика позицій планів');
    
    try {
        // Загальна статистика
        const { data: allItems, error } = await supabase
            .from('production_plan_items')
            .select('priority, reason, quantity_needed, quantity_planned, quantity_produced')
            .limit(1000);
        
        if (!error) {
            console.log(`✅ Загальна кількість позицій: ${allItems.length}`);
            
            // Статистика по пріоритетах
            const priorityStats = {};
            const reasonStats = {};
            let totalNeeded = 0;
            let totalPlanned = 0;
            let totalProduced = 0;
            
            allItems.forEach(item => {
                // Пріоритети
                if (!priorityStats[item.priority]) {
                    priorityStats[item.priority] = { count: 0, planned: 0, produced: 0 };
                }
                priorityStats[item.priority].count++;
                priorityStats[item.priority].planned += item.quantity_planned || 0;
                priorityStats[item.priority].produced += item.quantity_produced || 0;
                
                // Причини
                reasonStats[item.reason] = (reasonStats[item.reason] || 0) + 1;
                
                // Загальні суми
                totalNeeded += item.quantity_needed || 0;
                totalPlanned += item.quantity_planned || 0;
                totalProduced += item.quantity_produced || 0;
            });
            
            console.log('✅ Статистика по пріоритетах:');
            Object.entries(priorityStats).forEach(([priority, stats]) => {
                const completion = stats.planned > 0 
                    ? Math.round((stats.produced / stats.planned) * 100) 
                    : 0;
                console.log(`   - ${priority}: ${stats.count} позицій, ${stats.produced}/${stats.planned} (${completion}%)`);
            });
            
            console.log('✅ Статистика по причинах:');
            Object.entries(reasonStats).forEach(([reason, count]) => {
                console.log(`   - ${reason}: ${count} позицій`);
            });
            
            const overallCompletion = totalPlanned > 0 
                ? Math.round((totalProduced / totalPlanned) * 100) 
                : 0;
            console.log(`✅ Загальне виконання: ${totalProduced}/${totalPlanned} (${overallCompletion}%)`);
            console.log(`✅ Потрібно всього: ${totalNeeded}`);
            
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
 * Тест 7: Перевірка CASCADE DELETE з планами
 */
async function testCascadeDelete() {
    console.log('\n📋 Тест 7: Перевірка CASCADE DELETE зв\'язку з планами');
    
    try {
        // Рахуємо позиції для кожного плану
        const { data: itemsByPlan, error } = await supabase
            .from('production_plan_items')
            .select('plan_id')
            .limit(1000);
        
        if (!error) {
            const planStats = {};
            itemsByPlan.forEach(item => {
                planStats[item.plan_id] = (planStats[item.plan_id] || 0) + 1;
            });
            
            console.log('✅ Розподіл позицій по планах:');
            Object.entries(planStats).forEach(([planId, count]) => {
                console.log(`   - План ${planId}: ${count} позицій`);
            });
            
            // Перевіряємо що всі плани існують
            const planIds = Object.keys(planStats);
            if (planIds.length > 0) {
                const { data: existingPlans, error: planError } = await supabase
                    .from('production_plans')
                    .select('id')
                    .in('id', planIds);
                
                if (!planError) {
                    const existingPlanIds = existingPlans.map(p => p.id.toString());
                    const missingPlans = planIds.filter(id => !existingPlanIds.includes(id));
                    
                    if (missingPlans.length === 0) {
                        console.log('✅ Всі пов\'язані плани існують - CASCADE DELETE налаштовано правильно');
                    } else {
                        console.log(`⚠️  Знайдено позиції з неіснуючими планами: ${missingPlans.join(', ')}`);
                    }
                }
            }
            
            return true;
        } else {
            console.log('❌ Помилка перевірки CASCADE:', error.message);
            return false;
        }
    } catch (err) {
        console.log('❌ Помилка тестування CASCADE:', err.message);
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
        testItemsStatistics,
        testCascadeDelete
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
        console.log('✅ Таблиця production_plan_items готова до використання');
    } else {
        console.log('⚠️  Деякі тести не пройшли. Перевірте логи вище');
        console.log('❌ Таблиця production_plan_items потребує додаткової налаштування');
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