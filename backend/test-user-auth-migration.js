#!/usr/bin/env node

/**
 * Тест міграції userService + authService
 * Порівнює роботу SQLite та Supabase версій
 */

require('dotenv').config();
const userServiceV2 = require('./services/userService-v2');
const authServiceV2 = require('./services/authService-v2');
const { switchDatabaseMode } = require('./config/database');

async function testUserAuthMigration() {
    console.log('🧪 Тестування міграції userService + authService...\n');
    
    try {
        // Тест 1: SQLite режим
        console.log('1️⃣ Тест userService + authService в SQLite режимі...');
        switchDatabaseMode(false);
        await testUserAuthOperations('SQLite');
        
        // Тест 2: Supabase режим
        console.log('\n2️⃣ Тест userService + authService в Supabase режимі...');
        switchDatabaseMode(true);
        await testUserAuthOperations('Supabase');
        
        // Тест 3: Порівняння результатів
        console.log('\n3️⃣ Порівняння результатів...');
        await compareResults();
        
        // Тест 4: CRUD операції з користувачами
        console.log('\n4️⃣ Тест CRUD операцій з користувачами...');
        await testUserCRUDOperations();
        
        // Тест 5: Автентифікація
        console.log('\n5️⃣ Тест автентифікації...');
        await testAuthenticationFlow();
        
        console.log('\n🎉 Тестування міграції userService + authService завершено успішно!');
        
    } catch (error) {
        console.error('❌ Помилка тестування міграції:', error);
        throw error;
    }
}

async function testUserAuthOperations(modeName) {
    try {
        console.log(`   📊 ${modeName}: Тест getAllUsers...`);
        const allUsers = await userServiceV2.getAllUsers();
        console.log(`   ✅ ${modeName}: Отримано ${allUsers.length} користувачів`);
        
        if (allUsers.length > 0) {
            const firstUser = allUsers[0];
            console.log(`      Перший користувач: ${firstUser.username} (${firstUser.role})`);
            
            // Тест getUserById
            console.log(`   🔍 ${modeName}: Тест getUserById...`);
            const userById = await userServiceV2.getUserById(firstUser.id);
            console.log(`   ✅ ${modeName}: Отримано користувача: ${userById.username}`);
            
            // Тест getUserByUsername
            console.log(`   🔎 ${modeName}: Тест getUserByUsername...`);
            const userByUsername = await userServiceV2.getUserByUsername(firstUser.username);
            console.log(`   ✅ ${modeName}: Знайдено користувача за username: ${userByUsername ? userByUsername.username : 'не знайдено'}`);
        }
        
        // Тест статистики
        console.log(`   📈 ${modeName}: Тест getUserStats...`);
        const stats = await userServiceV2.getUserStats();
        console.log(`   ✅ ${modeName}: Статистика - ${stats.active_users} активних / ${stats.total_users} всього`);
        
        // Тест getActiveUsers (authService)
        console.log(`   👥 ${modeName}: Тест getActiveUsers (authService)...`);
        const activeUsers = await authServiceV2.getActiveUsers();
        console.log(`   ✅ ${modeName}: AuthService отримано ${activeUsers.length} активних користувачів`);
        
        return {
            mode: modeName,
            totalUsers: allUsers.length,
            activeUsers: activeUsers.length,
            firstUser: allUsers[0] || null,
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
        const sqliteUsers = await userServiceV2.getAllUsers();
        
        // Отримати результати з Supabase
        switchDatabaseMode(true);
        const supabaseUsers = await userServiceV2.getAllUsers();
        
        console.log(`   SQLite: ${sqliteUsers.length} користувачів`);
        console.log(`   Supabase: ${supabaseUsers.length} користувачів`);
        
        // Порівняти кількість
        if (sqliteUsers.length === supabaseUsers.length) {
            console.log('   ✅ Кількість користувачів однакова');
        } else {
            console.log('   ⚠️  Кількість користувачів відрізняється');
        }
        
        // Порівняти структуру перших записів
        if (sqliteUsers.length > 0 && supabaseUsers.length > 0) {
            const sqliteFirst = sqliteUsers[0];
            const supabaseFirst = supabaseUsers.find(u => u.username === sqliteFirst.username);
            
            if (supabaseFirst) {
                console.log('   ✅ Знайдено відповідний користувач в обох БД');
                console.log(`      SQLite: ${sqliteFirst.username} - ${sqliteFirst.role}`);
                console.log(`      Supabase: ${supabaseFirst.username} - ${supabaseFirst.role}`);
                
                // Порівняти ключові поля
                const fieldsToCompare = ['username', 'role', 'email', 'phone'];
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
                console.log('   ⚠️  Не знайдено відповідний користувач в Supabase');
            }
        }
        
    } catch (error) {
        console.error('   ❌ Помилка порівняння результатів:', error.message);
        throw error;
    }
}

async function testUserCRUDOperations() {
    console.log('   🔧 Тестування CRUD операцій з користувачами в обох режимах...');
    
    const testUserData = {
        username: 'тест_міграція_user',
        email: 'test-migration@pizza.com',
        phone: '+380501234567',
        role: 'ПАКУВАЛЬНИК',
        permissions: {
            inventory: { read: true, write: false },
            orders: { read: true, write: false }
        },
        password: 'testpassword123'
    };
    
    // Тест в SQLite
    await testUserCRUDInMode(false, 'SQLite', testUserData);
    
    // Тест в Supabase
    await testUserCRUDInMode(true, 'Supabase', testUserData);
}

async function testUserCRUDInMode(useSupabase, modeName, testData) {
    switchDatabaseMode(useSupabase);
    let createdUserId = null;
    
    try {
        console.log(`   📝 ${modeName}: Створення тестового користувача...`);
        const createdUser = await userServiceV2.createUser(testData, 1); // Створюємо від імені користувача з ID 1
        createdUserId = createdUser.id;
        console.log(`   ✅ ${modeName}: Користувач створено (ID: ${createdUserId})`);
        
        // Тест оновлення
        console.log(`   🔄 ${modeName}: Оновлення користувача...`);
        const updateData = {
            phone: '+380509876543',
            role: 'КОМІРНИК'
        };
        const updatedUser = await userServiceV2.updateUser(createdUserId, updateData, 1);
        console.log(`   ✅ ${modeName}: Користувач оновлено - роль: ${updatedUser.role}`);
        
        // Тест зміни пароля
        console.log(`   🔑 ${modeName}: Зміна пароля...`);
        await userServiceV2.changeUserPassword(createdUserId, 'newpassword123', 1);
        console.log(`   ✅ ${modeName}: Пароль змінено`);
        
        // Тест деактивації
        console.log(`   🗑️ ${modeName}: Деактивація користувача...`);
        await userServiceV2.deleteUser(createdUserId, 1);
        console.log(`   ✅ ${modeName}: Користувач деактивовано`);
        
        // Перевірка, що деактивований користувач не показується в активних
        const activeUsers = await userServiceV2.getAllUsers({ includeInactive: false });
        const isInActive = activeUsers.some(u => u.id === createdUserId);
        console.log(`   ${isInActive ? '⚠️' : '✅'} ${modeName}: Деактивований користувач ${isInActive ? 'ще показується' : 'приховано'} в активних`);
        
    } catch (error) {
        console.error(`   ❌ ${modeName}: Помилка CRUD операцій - ${error.message}`);
        throw error;
    } finally {
        // Очищення не потрібне, оскільки ми використовуємо soft delete
        if (createdUserId) {
            console.log(`   🧹 ${modeName}: Тестовий користувач деактивовано (soft delete)`);
        }
    }
}

async function testAuthenticationFlow() {
    console.log('   🔐 Тестування автентифікації в обох режимах...');
    
    // Тест в SQLite
    await testAuthInMode(false, 'SQLite');
    
    // Тест в Supabase
    await testAuthInMode(true, 'Supabase');
}

async function testAuthInMode(useSupabase, modeName) {
    switchDatabaseMode(useSupabase);
    
    try {
        console.log(`   🔑 ${modeName}: Тест автентифікації...`);
        
        // Отримуємо активних користувачів
        const activeUsers = await authServiceV2.getActiveUsers();
        console.log(`   👥 ${modeName}: Доступно ${activeUsers.length} активних користувачів для входу`);
        
        if (activeUsers.length > 0) {
            const testUser = activeUsers[0];
            console.log(`   🧪 ${modeName}: Спроба входу користувача ${testUser.username}...`);
            
            // Примітка: Ми не можемо протестувати реальний логін без знання пароля
            // Тому тестуємо тільки перевірку існування користувача
            const userByUsername = await userServiceV2.getUserByUsername(testUser.username);
            if (userByUsername) {
                console.log(`   ✅ ${modeName}: Користувач ${testUser.username} знайдений для автентифікації`);
            } else {
                console.log(`   ⚠️ ${modeName}: Користувач ${testUser.username} не знайдений`);
            }
        } else {
            console.log(`   ⚠️ ${modeName}: Немає активних користувачів для тестування автентифікації`);
        }
        
        // Тест неіснуючого користувача
        try {
            await authServiceV2.login('неіснуючий_користувач', 'password123');
            console.log(`   ⚠️ ${modeName}: Несподівано успішний вхід неіснуючого користувача`);
        } catch (error) {
            if (error.message.includes('не знайдено')) {
                console.log(`   ✅ ${modeName}: Правильно відхилено вхід неіснуючого користувача`);
            } else {
                console.log(`   ⚠️ ${modeName}: Неочікувана помилка: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`   ❌ ${modeName}: Помилка тестування автентифікації - ${error.message}`);
        throw error;
    }
}

// Запуск тестів
if (require.main === module) {
    testUserAuthMigration()
        .then(() => {
            console.log('\n📋 Міграція userService + authService протестована');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testUserAuthMigration };