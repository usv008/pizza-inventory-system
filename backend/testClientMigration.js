#!/usr/bin/env node

/**
 * Client Service Migration Test
 * Тестує міграцію Client Service з SQLite на Supabase
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import services
const ClientService = require('./services/clientService');
const SupabaseClientService = require('./services/supabaseClientService');  
const HybridClientService = require('./services/hybridClientService');

// Import dependencies
const database = require('./database');
const OperationsLogController = require('./controllers/operations-log-controller');

let testResults = {
    legacy: { success: 0, failed: 0, errors: [] },
    supabase: { success: 0, failed: 0, errors: [] },
    hybrid: { success: 0, failed: 0, errors: [] }
};

// Test client data
const testClient = {
    name: `Test Client ${Date.now()}`,
    contact_person: 'Тестовий Контакт',
    phone: '+380123456789',
    email: 'test@example.com',
    address: 'Тестова адреса 123',
    notes: 'Створено для тестування міграції'
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
    console.log('📊 РЕЗУЛЬТАТИ ТЕСТУВАННЯ CLIENT SERVICE МІГРАЦІЇ');
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
 * Test Legacy Client Service (SQLite)
 */
async function testLegacyClientService() {
    console.log('\n🔧 ТЕСТУВАННЯ LEGACY CLIENT SERVICE (SQLite)');
    console.log('-'.repeat(50));
    
    const clientService = new ClientService();
    let createdClientId = null;
    
    try {
        // Initialize service
        await database.initDatabase();
        const dependencies = {
            clientQueries: database.clientQueries,
            OperationsLogController: OperationsLogController
        };
        clientService.initialize(dependencies);
        logTest('legacy', 'Ініціалізація', true, 'ClientService ініціалізовано');
        
        // Test getAllClients
        const allClients = await clientService.getAllClients();
        logTest('legacy', 'Отримання всіх клієнтів', true, `Отримано ${allClients.length} клієнтів`);
        
        // Test createClient
        const createResult = await clientService.createClient(testClient);
        createdClientId = createResult.id;
        logTest('legacy', 'Створення клієнта', true, `Створено клієнта з ID: ${createdClientId}`);
        
        // Test getClientById
        const retrievedClient = await clientService.getClientById(createdClientId);
        const isCorrect = retrievedClient && retrievedClient.name === testClient.name;
        logTest('legacy', 'Отримання клієнта за ID', isCorrect, 
                isCorrect ? `Отримано коректного клієнта: ${retrievedClient.name}` : 'Клієнта не знайдено або неправильні дані');
        
        // Test updateClient
        const updateData = { ...testClient, name: testClient.name + ' (Оновлено)' };
        const updateResult = await clientService.updateClient(createdClientId, updateData);
        logTest('legacy', 'Оновлення клієнта', updateResult.changes > 0, 
                `Оновлено ${updateResult.changes} записів`);
        
        // Test searchClients
        const searchResults = await clientService.searchClients({ name: 'Test Client' });
        logTest('legacy', 'Пошук клієнтів', Array.isArray(searchResults), 
                `Знайдено ${searchResults.length} клієнтів`);
        
        // Test getClientStats
        const stats = await clientService.getClientStats();
        logTest('legacy', 'Статистика клієнтів', 
                stats && typeof stats.total === 'number', 
                `Загалом клієнтів: ${stats.total}, активних: ${stats.active}`);
        
    } catch (error) {
        logTest('legacy', 'Загальна помилка', false, error.message, error);
    }
    
    return createdClientId;
}

/**
 * Test Supabase Client Service
 */
async function testSupabaseClientService() {
    console.log('\n🔧 ТЕСТУВАННЯ SUPABASE CLIENT SERVICE');
    console.log('-'.repeat(50));
    
    const supabaseClientService = new SupabaseClientService();
    let createdClientId = null;
    
    try {
        // Initialize service
        const dependencies = {
            OperationsLogController: OperationsLogController
        };
        supabaseClientService.initialize(dependencies);
        logTest('supabase', 'Ініціалізація', true, 'SupabaseClientService ініціалізовано');
        
        // Test getAllClients
        const allClients = await supabaseClientService.getAllClients();
        logTest('supabase', 'Отримання всіх клієнтів', true, `Отримано ${allClients.length} клієнтів`);
        
        // Test createClient
        const testClientSupabase = { ...testClient, name: testClient.name + ' (Supabase)' };
        const createResult = await supabaseClientService.createClient(testClientSupabase);
        createdClientId = createResult.id;
        logTest('supabase', 'Створення клієнта', true, `Створено клієнта з ID: ${createdClientId}`);
        
        // Test getClientById
        const retrievedClient = await supabaseClientService.getClientById(createdClientId);
        const isCorrect = retrievedClient && retrievedClient.name === testClientSupabase.name;
        logTest('supabase', 'Отримання клієнта за ID', isCorrect,
                isCorrect ? `Отримано коректного клієнта: ${retrievedClient.name}` : 'Клієнта не знайдено або неправильні дані');
        
        // Test updateClient
        const updateData = { ...testClientSupabase, name: testClientSupabase.name + ' (Оновлено)' };
        const updateResult = await supabaseClientService.updateClient(createdClientId, updateData);
        logTest('supabase', 'Оновлення клієнта', updateResult.changes > 0,
                `Оновлено ${updateResult.changes} записів`);
        
        // Test searchClients
        const searchResults = await supabaseClientService.searchClients({ name: 'Test Client' });
        logTest('supabase', 'Пошук клієнтів', Array.isArray(searchResults),
                `Знайдено ${searchResults.length} клієнтів`);
        
        // Test getClientStats
        const stats = await supabaseClientService.getClientStats();
        logTest('supabase', 'Статистика клієнтів',
                stats && typeof stats.total === 'number',
                `Загалом клієнтів: ${stats.total}, активних: ${stats.active}`);
        
    } catch (error) {
        logTest('supabase', 'Загальна помилка', false, error.message, error);
    }
    
    return createdClientId;
}

/**
 * Test Hybrid Client Service
 */
async function testHybridClientService() {
    console.log('\n🔧 ТЕСТУВАННЯ HYBRID CLIENT SERVICE');
    console.log('-'.repeat(50));
    
    const hybridClientService = new HybridClientService();
    
    try {
        // Initialize services
        const legacyClientService = new ClientService();
        const supabaseClientService = new SupabaseClientService();
        
        const dependencies = {
            legacyClientService: legacyClientService,
            supabaseClientService: supabaseClientService,
            clientQueries: database.clientQueries,
            OperationsLogController: OperationsLogController
        };
        
        hybridClientService.initialize(dependencies);
        logTest('hybrid', 'Ініціалізація', true, 'HybridClientService ініціалізовано');
        
        // Test migration status
        const status = hybridClientService.getMigrationStatus();
        logTest('hybrid', 'Статус міграції', status && status.services,
                `Legacy: ${status.services.legacy}, Supabase: ${status.services.supabase}`);
        
        // Test connectivity
        const connectivity = await hybridClientService.testConnectivity();
        logTest('hybrid', 'Тест з\'єднання', 
                connectivity.legacy || connectivity.supabase,
                `Legacy: ${connectivity.legacy}, Supabase: ${connectivity.supabase}`);
        
        // Test Phase 1: SQLite only
        console.log('\n   📍 ФАЗА 1: Тільки SQLite');
        hybridClientService.updateMigrationConfig({
            USE_SUPABASE_READ: false,
            USE_SUPABASE_WRITE: false
        });
        
        const allClientsPhase1 = await hybridClientService.getAllClients();
        logTest('hybrid', 'Фаза 1 - читання', true, `SQLite: ${allClientsPhase1.length} клієнтів`);
        
        // Test Phase 2: Read from Supabase, write to SQLite
        console.log('\n   📍 ФАЗА 2: Читання Supabase, запис SQLite');
        hybridClientService.updateMigrationConfig({
            USE_SUPABASE_READ: true,
            USE_SUPABASE_WRITE: false
        });
        
        const allClientsPhase2 = await hybridClientService.getAllClients();
        logTest('hybrid', 'Фаза 2 - читання', true, `Supabase читання: ${allClientsPhase2.length} клієнтів`);
        
        // Test Phase 3: Full Supabase with fallback
        console.log('\n   📍 ФАЗА 3: Повний Supabase з fallback');
        hybridClientService.updateMigrationConfig({
            USE_SUPABASE_READ: true,
            USE_SUPABASE_WRITE: true,
            FALLBACK_TO_LEGACY: true
        });
        
        const testClientHybrid = { ...testClient, name: testClient.name + ' (Hybrid)' };
        const createResult = await hybridClientService.createClient(testClientHybrid);
        logTest('hybrid', 'Фаза 3 - створення', !!createResult.id, `ID: ${createResult.id}`);
        
        // Test Phase 4: Supabase only
        console.log('\n   📍 ФАЗА 4: Тільки Supabase');
        hybridClientService.enableFullSupabaseMode();
        
        const allClientsPhase4 = await hybridClientService.getAllClients();
        logTest('hybrid', 'Фаза 4 - читання', true, `Supabase тільки: ${allClientsPhase4.length} клієнтів`);
        
    } catch (error) {
        logTest('hybrid', 'Загальна помилка', false, error.message, error);
    }
}

/**
 * Main test execution
 */
async function runAllTests() {
    console.log('🚀 ПОЧАТОК ТЕСТУВАННЯ CLIENT SERVICE МІГРАЦІЇ');
    console.log('='.repeat(70));
    
    try {
        // Run all tests
        await testLegacyClientService();
        await testSupabaseClientService(); 
        await testHybridClientService();
        
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