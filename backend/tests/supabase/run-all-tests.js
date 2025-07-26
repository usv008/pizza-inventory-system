#!/usr/bin/env node

/**
 * Запуск всіх тестів Supabase міграції
 * 
 * Послідовно виконує всі тести та показує загальний результат
 * Запуск: node tests/supabase/run-all-tests.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 ЗАПУСК ВСІХ ТЕСТІВ SUPABASE МІГРАЦІЇ');
console.log('=====================================\n');

// Список тестів у порядку виконання
const tests = [
    {
        name: 'Тест з\'єднання',
        file: 'test-connection.js',
        description: 'Базове з\'єднання з Supabase'
    },
    {
        name: 'Тест клієнта',
        file: 'test-client.js', 
        description: 'Supabase JS клієнт'
    },
    {
        name: 'Таблиця products',
        file: 'test-products-table.js',
        description: 'Каталог товарів'
    },
    {
        name: 'Таблиця clients',
        file: 'test-clients-table.js',
        description: 'Каталог клієнтів'
    },
    {
        name: 'Таблиця stock_movements',
        file: 'test-stock-movements-table.js',
        description: 'Журнал рухів запасів'
    }
    // Додаткові тести будуть додані по мірі створення таблиць
];

/**
 * Запуск одного тесту
 */
function runTest(test) {
    return new Promise((resolve) => {
        console.log(`🔄 Запуск: ${test.name}`);
        console.log(`   ${test.description}`);
        
        const testPath = path.join(__dirname, test.file);
        const testProcess = spawn('node', [testPath], {
            stdio: 'pipe'
        });
        
        let output = '';
        let hasError = false;
        
        testProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        testProcess.stderr.on('data', (data) => {
            output += data.toString();
            hasError = true;
        });
        
        testProcess.on('close', (code) => {
            const success = code === 0 && !hasError;
            
            if (success) {
                console.log(`✅ ${test.name}: ПРОЙДЕНО\n`);
            } else {
                console.log(`❌ ${test.name}: ПОМИЛКА`);
                console.log(`   Код виходу: ${code}`);
                if (output.length > 0) {
                    // Показуємо тільки останні рядки для стислості
                    const lines = output.trim().split('\n');
                    const lastLines = lines.slice(-3);
                    console.log(`   Вивід: ${lastLines.join(', ')}`);
                }
                console.log('');
            }
            
            resolve({
                name: test.name,
                success,
                code,
                output: success ? '' : output
            });
        });
    });
}

/**
 * Головна функція запуску всіх тестів
 */
async function runAllTests() {
    const results = [];
    
    console.log(`📋 Всього тестів до виконання: ${tests.length}\n`);
    
    // Запускаємо тести послідовно
    for (const test of tests) {
        const result = await runTest(test);
        results.push(result);
        
        // Короткая пауза між тестами
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Підсумки
    console.log('📊 ПІДСУМКИ ВСІХ ТЕСТІВ');
    console.log('=======================');
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`📈 Результат: ${successCount}/${totalCount} тестів пройшли`);
    
    if (successCount === totalCount) {
        console.log('🎉 Всі тести пройшли успішно!');
        console.log('✅ Supabase міграція працює коректно');
    } else {
        console.log('\n❌ Деякі тести провалились:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`   - ${result.name} (код: ${result.code})`);
        });
        console.log('\n🔧 Потрібно вирішити проблеми перед продовженням');
    }
    
    console.log(`\n📅 Дата запуску: ${new Date().toLocaleString('uk-UA')}`);
    
    return successCount === totalCount;
}

// Запуск тестів
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Критична помилка запуску тестів:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };