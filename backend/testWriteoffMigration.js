#!/usr/bin/env node

/**
 * Writeoff Service Migration Test
 * Тестує міграцію Writeoff Service з SQLite на Supabase
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import services
const WriteoffService = require('./services/writeoffService');
const SupabaseWriteoffService = require('./services/supabaseWriteoffService');  
const HybridWriteoffService = require('./services/hybridWriteoffService');

// Import dependencies
const database = require('./database');
const OperationsLogController = require('./controllers/operations-log-controller');

let testResults = {
    legacy: { success: 0, failed: 0, errors: [] },
    supabase: { success: 0, failed: 0, errors: [] },
    hybrid: { success: 0, failed: 0, errors: [] }
};

// Test writeoff data
const testWriteoff = {
    product_id: 1, // Assuming product with ID 1 exists
    batch_id: null,
    total_quantity: 5, // Правильне поле для SQLite
    quantity: 5, // Для Supabase
    reason: 'Тестове списання',
    notes: 'Створено для тестування міграції',
    writeoff_date: new Date().toISOString().split('T')[0], // Тільки дата
    responsible: 'test_user' // Правильне поле для SQLite
};

/**
 * Utility functions
 */
function logTest(service, test, success, message, error = null) {
    const status = success ? '✅' : '❌';
    console.log(`${status} [${service.toUpperCase()}] ${test}: ${message}`);
    
    if (success) {
        testResults[service].success++;
    } else {
        testResults[service].failed++;
        if (error) {
            testResults[service].errors.push({ test, error: error.message });
        }
    }
}

function printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 РЕЗУЛЬТАТИ ТЕСТУВАННЯ WRITEOFF SERVICE МІГРАЦІЇ');
    console.log('='.repeat(70));
    
    Object.keys(testResults).forEach(service => {
        const result = testResults[service];
        const total = result.success + result.failed;
        const percentage = total > 0 ? Math.round((result.success / total) * 100) : 0;
        
        console.log(`\n🔧 ${service.toUpperCase()} SERVICE:`);
        console.log(`   ✅ Успішно: ${result.success}`);
        console.log(`   ❌ Помилок: ${result.failed}`);
        console.log(`   📈 Успішність: ${percentage}%`);
        
        if (result.errors.length > 0) {
            console.log(`   🚨 Помилки:`);
            result.errors.forEach((err, index) => {
                console.log(`      ${index + 1}. ${err.test}: ${err.error}`);
            });
        }
    });
    
    console.log('\n' + '='.repeat(70));
}

/**
 * Test Legacy Writeoff Service (SQLite)
 */
async function testLegacyWriteoffService() {
    console.log('\n🔧 ТЕСТУВАННЯ LEGACY WRITEOFF SERVICE (SQLite)');
    console.log('-'.repeat(50));
    
    const writeoffService = WriteoffService;
    let createdWriteoffId = null;
    
    try {
        // Initialize service
        await database.initDatabase();
        writeoffService.initialize({
            writeoffQueries: database.writeoffQueries,
            productQueries: database.productQueries,
            OperationsLogController: OperationsLogController
        });
        logTest('legacy', 'Ініціалізація', true, 'WriteoffService ініціалізовано');
        
        // Test getAllWriteoffs
        const allWriteoffs = await writeoffService.getAllWriteoffs();
        logTest('legacy', 'Отримання всіх списань', true, `Отримано ${allWriteoffs.length} списань`);
        
        // Test createWriteoff (тільки якщо метод існує)
        if (writeoffService.createWriteoff) {
            const createResult = await writeoffService.createWriteoff(testWriteoff);
            createdWriteoffId = createResult.id;
            logTest('legacy', 'Створення списання', true, `Створено списання з ID: ${createdWriteoffId}`);
        } else {
            logTest('legacy', 'Створення списання', false, 'Метод createWriteoff не знайдено в legacy service');
        }
        
        // Test getWriteoffsByProductId (доступний метод)
        const productWriteoffs = await writeoffService.getWriteoffsByProductId(1);
        logTest('legacy', 'Отримання списань за продуктом', Array.isArray(productWriteoffs), 
                `Отримано ${productWriteoffs.length} списань для продукту ID 1`);
        
        // Test getWriteoffStatistics (доступний метод)
        const stats = await writeoffService.getWriteoffStatistics();
        logTest('legacy', 'Статистика списань', 
                stats && typeof stats.totalWriteoffs === 'number', 
                `Загалом списань: ${stats.totalWriteoffs}, кількість: ${stats.totalQuantity}`);
        
    } catch (error) {
        logTest('legacy', 'Загальна помилка', false, error.message, error);
    }
    
    return createdWriteoffId;
}

/**
 * Test Supabase Writeoff Service
 */
async function testSupabaseWriteoffService() {
    console.log('\n🔧 ТЕСТУВАННЯ SUPABASE WRITEOFF SERVICE');
    console.log('-'.repeat(50));
    
    const supabaseWriteoffService = new SupabaseWriteoffService();
    let createdWriteoffId = null;
    
    try {
        // Initialize service
        const dependencies = {
            OperationsLogController: OperationsLogController
        };
        supabaseWriteoffService.initialize(dependencies);
        logTest('supabase', 'Ініціалізація', true, 'SupabaseWriteoffService ініціалізовано');
        
        // Test getAllWriteoffs
        const allWriteoffs = await supabaseWriteoffService.getAllWriteoffs();
        logTest('supabase', 'Отримання всіх списань', true, `Отримано ${allWriteoffs.length} списань`);
        
        // Test createWriteoff
        const testWriteoffSupabase = { ...testWriteoff, reason: 'Supabase тестове списання' };
        const createResult = await supabaseWriteoffService.createWriteoff(testWriteoffSupabase);
        createdWriteoffId = createResult.id;
        logTest('supabase', 'Створення списання', true, `Створено списання з ID: ${createdWriteoffId}`);
        
        // Test getWriteoffById
        const retrievedWriteoff = await supabaseWriteoffService.getWriteoffById(createdWriteoffId);
        const isCorrect = retrievedWriteoff && retrievedWriteoff.quantity === testWriteoffSupabase.quantity;
        logTest('supabase', 'Отримання списання за ID', isCorrect,
                isCorrect ? `Отримано коректне списання: ${retrievedWriteoff.quantity} шт.` : 'Списання не знайдено або неправильні дані');
        
        // Test updateWriteoff
        const updateData = { ...testWriteoffSupabase, quantity: 15, reason: 'Оновлене Supabase списання' };
        const updateResult = await supabaseWriteoffService.updateWriteoff(createdWriteoffId, updateData);
        logTest('supabase', 'Оновлення списання', updateResult.changes > 0,
                `Оновлено ${updateResult.changes} записів`);
        
        // Test searchWriteoffs
        const searchResults = await supabaseWriteoffService.searchWriteoffs({ reason: 'Supabase' });
        logTest('supabase', 'Пошук списань', Array.isArray(searchResults),
                `Знайдено ${searchResults.length} списань`);
        
        // Test getWriteoffStats
        const stats = await supabaseWriteoffService.getWriteoffStats();
        logTest('supabase', 'Статистика списань',
                stats && typeof stats.total_writeoffs === 'number',
                `Загалом списань: ${stats.total_writeoffs}, кількість: ${stats.total_quantity}`);
        
    } catch (error) {
        logTest('supabase', 'Загальна помилка', false, error.message, error);
    }
    
    return createdWriteoffId;
}

/**
 * Test Hybrid Writeoff Service
 */
async function testHybridWriteoffService() {
    console.log('\n🔧 ТЕСТУВАННЯ HYBRID WRITEOFF SERVICE');
    console.log('-'.repeat(50));
    
    const hybridWriteoffService = new HybridWriteoffService();
    
    try {
        // Initialize services
        const legacyWriteoffService = WriteoffService;
        const supabaseWriteoffService = new SupabaseWriteoffService();
        
        const dependencies = {
            legacyWriteoffService: legacyWriteoffService,
            supabaseWriteoffService: supabaseWriteoffService,
            writeoffQueries: database.writeoffQueries,
            productQueries: database.productQueries,
            OperationsLogController: OperationsLogController
        };
        
        hybridWriteoffService.initialize(dependencies);
        logTest('hybrid', 'Ініціалізація', true, 'HybridWriteoffService ініціалізовано');
        
        // Test migration status
        const status = hybridWriteoffService.getMigrationStatus();
        logTest('hybrid', 'Статус міграції', status && status.services,
                `Legacy: ${status.services.legacy}, Supabase: ${status.services.supabase}`);
        
        // Test connectivity
        const connectivity = await hybridWriteoffService.testConnectivity();
        logTest('hybrid', 'Тест з\'єднання', 
                connectivity.legacy || connectivity.supabase,
                `Legacy: ${connectivity.legacy}, Supabase: ${connectivity.supabase}`);
        
        // Test Phase 1: SQLite only
        console.log('\n   📍 ФАЗА 1: Тільки SQLite');
        hybridWriteoffService.updateMigrationConfig({
            USE_SUPABASE_READ: false,
            USE_SUPABASE_WRITE: false
        });
        
        const allWriteoffsPhase1 = await hybridWriteoffService.getAllWriteoffs();
        logTest('hybrid', 'Фаза 1 - читання', true, `SQLite: ${allWriteoffsPhase1.length} списань`);
        
        // Test Phase 2: Read from Supabase, write to SQLite
        console.log('\n   📍 ФАЗА 2: Читання Supabase, запис SQLite');
        hybridWriteoffService.updateMigrationConfig({
            USE_SUPABASE_READ: true,
            USE_SUPABASE_WRITE: false
        });
        
        const allWriteoffsPhase2 = await hybridWriteoffService.getAllWriteoffs();
        logTest('hybrid', 'Фаза 2 - читання', true, `Supabase читання: ${allWriteoffsPhase2.length} списань`);
        
        // Test Phase 3: Full Supabase with fallback
        console.log('\n   📍 ФАЗА 3: Повний Supabase з fallback');
        hybridWriteoffService.updateMigrationConfig({
            USE_SUPABASE_READ: true,
            USE_SUPABASE_WRITE: true,
            FALLBACK_TO_LEGACY: true
        });
        
        const testWriteoffHybrid = { ...testWriteoff, reason: 'Hybrid тестове списання' };
        const createResult = await hybridWriteoffService.createWriteoff(testWriteoffHybrid);
        logTest('hybrid', 'Фаза 3 - створення', !!createResult.id, `ID: ${createResult.id}`);
        
        // Test Phase 4: Supabase only
        console.log('\n   📍 ФАЗА 4: Тільки Supabase');
        hybridWriteoffService.enableFullSupabaseMode();
        
        const allWriteoffsPhase4 = await hybridWriteoffService.getAllWriteoffs();
        logTest('hybrid', 'Фаза 4 - читання', true, `Supabase тільки: ${allWriteoffsPhase4.length} списань`);
        
    } catch (error) {
        logTest('hybrid', 'Загальна помилка', false, error.message, error);
    }
}

/**
 * Main test execution
 */
async function runAllTests() {
    console.log('🚀 ПОЧАТОК ТЕСТУВАННЯ WRITEOFF SERVICE МІГРАЦІЇ');
    console.log('='.repeat(70));
    
    try {
        // Run all tests
        await testLegacyWriteoffService();
        await testSupabaseWriteoffService(); 
        await testHybridWriteoffService();
        
        // Print final results
        printResults();
        
        console.log('\n🎉 ТЕСТУВАННЯ ЗАВЕРШЕНО');
        
    } catch (error) {
        console.error('💥 КРИТИЧНА ПОМИЛКА:', error);
    } finally {
        // Cleanup
        if (database && database.db) {
            database.db.close();
        }
        process.exit(0);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests }; 