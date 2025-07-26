#!/usr/bin/env node

/**
 * Тест міграції clientService
 * Порівнює роботу SQLite та Supabase версій
 */

require('dotenv').config();
const clientServiceV2 = require('./services/clientService-v2');
const { switchDatabaseMode } = require('./config/database');

async function testClientServiceMigration() {
    console.log('🧪 Тестування міграції clientService...\n');
    
    try {
        // Тест 1: SQLite режим
        console.log('1️⃣ Тест clientService в SQLite режимі...');
        switchDatabaseMode(false);
        await testClientOperations('SQLite');
        
        // Тест 2: Supabase режим
        console.log('\n2️⃣ Тест clientService в Supabase режимі...');
        switchDatabaseMode(true);
        await testClientOperations('Supabase');
        
        // Тест 3: Порівняння результатів
        console.log('\n3️⃣ Порівняння результатів...');
        await compareResults();
        
        // Тест 4: CRUD операції
        console.log('\n4️⃣ Тест CRUD операцій...');
        await testCRUDOperations();
        
        console.log('\n🎉 Тестування міграції clientService завершено успішно!');
        
    } catch (error) {
        console.error('❌ Помилка тестування міграції:', error);
        throw error;
    }
}

async function testClientOperations(modeName) {
    try {
        console.log(`   📊 ${modeName}: Тест getAllClients...`);
        const allClients = await clientServiceV2.getAllClients();
        console.log(`   ✅ ${modeName}: Отримано ${allClients.length} клієнтів`);
        
        if (allClients.length > 0) {
            const firstClient = allClients[0];
            console.log(`      Перший клієнт: ${firstClient.name} (ID: ${firstClient.id})`);
            
            // Тест getClientById
            console.log(`   🔍 ${modeName}: Тест getClientById...`);
            const clientById = await clientServiceV2.getClientById(firstClient.id);
            console.log(`   ✅ ${modeName}: Отримано клієнта: ${clientById.name}`);
            
            // Тест getClientByName
            console.log(`   🔎 ${modeName}: Тест getClientByName...`);
            const clientByName = await clientServiceV2.getClientByName(firstClient.name);
            console.log(`   ✅ ${modeName}: Знайдено клієнта за назвою: ${clientByName ? clientByName.name : 'не знайдено'}`);
        }
        
        // Тест пошуку
        console.log(`   🔍 ${modeName}: Тест searchClients...`);
        const searchResults = await clientServiceV2.searchClients({ name: 'ТОВ' });
        console.log(`   ✅ ${modeName}: Знайдено ${searchResults.length} клієнтів за запитом "ТОВ"`);
        
        // Тест статистики
        console.log(`   📈 ${modeName}: Тест getClientStats...`);
        const stats = await clientServiceV2.getClientStats();
        console.log(`   ✅ ${modeName}: Статистика - ${stats.active_clients} активних / ${stats.total_clients} всього`);
        
        return {
            mode: modeName,
            totalClients: allClients.length,
            searchResults: searchResults.length,
            firstClient: allClients[0] || null,
            stats: stats
        };
        
    } catch (error) {
        console.error(`   ❌ ${modeName}: Помилка операцій - ${error.message}`);
        throw error;
    }
}

async function compareResults() {
    try {
        // Отримати результати з SQLite
        switchDatabaseMode(false);
        const sqliteClients = await clientServiceV2.getAllClients();
        
        // Отримати результати з Supabase
        switchDatabaseMode(true);
        const supabaseClients = await clientServiceV2.getAllClients();
        
        console.log(`   SQLite: ${sqliteClients.length} клієнтів`);
        console.log(`   Supabase: ${supabaseClients.length} клієнтів`);
        
        // Порівняти кількість
        if (sqliteClients.length === supabaseClients.length) {
            console.log('   ✅ Кількість клієнтів однакова');
        } else {
            console.log('   ⚠️  Кількість клієнтів відрізняється');
        }
        
        // Порівняти структуру перших записів
        if (sqliteClients.length > 0 && supabaseClients.length > 0) {
            const sqliteFirst = sqliteClients[0];
            const supabaseFirst = supabaseClients.find(c => c.name === sqliteFirst.name);
            
            if (supabaseFirst) {
                console.log('   ✅ Знайдено відповідний клієнт в обох БД');
                console.log(`      SQLite: ${sqliteFirst.name} - ${sqliteFirst.phone || 'без телефону'}`);
                console.log(`      Supabase: ${supabaseFirst.name} - ${supabaseFirst.phone || 'без телефону'}`);
                
                // Порівняти ключові поля
                const fieldsToCompare = ['name', 'company_type', 'address', 'phone', 'email'];
                let fieldsMatch = true;
                
                for (const field of fieldsToCompare) {
                    if (sqliteFirst[field] !== supabaseFirst[field]) {
                        console.log(`      ⚠️  Поле ${field} відрізняється: "${sqliteFirst[field]}" vs "${supabaseFirst[field]}"`);
                        fieldsMatch = false;
                    }
                }
                
                if (fieldsMatch) {
                    console.log('   ✅ Ключові поля співпадають');
                }
            } else {
                console.log('   ⚠️  Не знайдено відповідний клієнт в Supabase');
            }
        }
        
    } catch (error) {
        console.error('   ❌ Помилка порівняння результатів:', error.message);
        throw error;
    }
}

async function testCRUDOperations() {
    console.log('   🔧 Тестування CRUD операцій в обох режимах...');
    
    // Базові поля, які підтримуються в обох БД
    const testClientData = {
        name: 'ТЕСТ КлієнтМіграція ЛТД',
        address: 'вул. Тестова, 123',
        phone: '+380501234567',
        email: 'test@migration.com',
        notes: 'Тестовий клієнт для міграції'
    };
    
    // Тест в SQLite
    await testCRUDInMode(false, 'SQLite', testClientData);
    
    // Тест в Supabase
    await testCRUDInMode(true, 'Supabase', testClientData);
}

async function testCRUDInMode(useSupabase, modeName, testData) {
    switchDatabaseMode(useSupabase);
    let createdClientId = null;
    
    try {
        console.log(`   📝 ${modeName}: Створення тестового клієнта...`);
        const createdClient = await clientServiceV2.createClient(testData);
        createdClientId = createdClient.id;
        console.log(`   ✅ ${modeName}: Клієнт створено (ID: ${createdClientId})`);
        
        // Тест оновлення
        console.log(`   🔄 ${modeName}: Оновлення клієнта...`);
        const updateData = {
            phone: '+380509876543',
            notes: 'Оновлений тестовий клієнт'
        };
        const updatedClient = await clientServiceV2.updateClient(createdClientId, updateData);
        console.log(`   ✅ ${modeName}: Клієнт оновлено - телефон: ${updatedClient.phone}`);
        
        // Тест пошуку
        console.log(`   🔍 ${modeName}: Пошук створеного клієнта...`);
        const foundClients = await clientServiceV2.searchClients({ name: 'ТЕСТ КлієнтМіграція' });
        console.log(`   ✅ ${modeName}: Знайдено ${foundClients.length} клієнтів за пошуком`);
        
        // Тест деактивації
        console.log(`   🗑️ ${modeName}: Деактивація клієнта...`);
        await clientServiceV2.deactivateClient(createdClientId);
        console.log(`   ✅ ${modeName}: Клієнт деактивовано`);
        
        // Перевірка, що деактивований клієнт не показується в активних
        const activeClients = await clientServiceV2.getAllClients();
        const isInActive = activeClients.some(c => c.id === createdClientId);
        console.log(`   ${isInActive ? '⚠️' : '✅'} ${modeName}: Деактивований клієнт ${isInActive ? 'ще показується' : 'приховано'} в активних`);
        
    } catch (error) {
        console.error(`   ❌ ${modeName}: Помилка CRUD операцій - ${error.message}`);
        throw error;
    } finally {
        // Очищення: видалити тестового клієнта
        if (createdClientId) {
            try {
                await clientServiceV2.deleteClient(createdClientId);
                console.log(`   🧹 ${modeName}: Тестовий клієнт видалено`);
            } catch (cleanupError) {
                console.warn(`   ⚠️ ${modeName}: Не вдалося видалити тестового клієнта:`, cleanupError.message);
            }
        }
    }
}

// Запуск тестів
if (require.main === module) {
    testClientServiceMigration()
        .then(() => {
            console.log('\n📋 Міграція clientService протестована');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testClientServiceMigration };