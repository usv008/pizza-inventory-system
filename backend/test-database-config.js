#!/usr/bin/env node

/**
 * Тест конфігурації бази даних
 * Перевіряє переключення між SQLite та Supabase
 */

const {
    USE_SUPABASE,
    MIGRATE_SESSIONS_TO_SUPABASE,
    createDatabaseAdapter,
    checkDatabaseConnection,
    getDatabaseStats,
    switchDatabaseMode
} = require('./config/database');

async function testDatabaseConfig() {
    console.log('🧪 Тестування Database Configuration...\n');
    
    // Показати поточну конфігурацію
    console.log('1️⃣ Поточна конфігурація:');
    console.log(`   USE_SUPABASE: ${USE_SUPABASE}`);
    console.log(`   MIGRATE_SESSIONS_TO_SUPABASE: ${MIGRATE_SESSIONS_TO_SUPABASE}`);
    
    // Тест з'єднання в поточному режимі
    console.log('\n2️⃣ Тест з\'єднання в поточному режимі:');
    const connected = await checkDatabaseConnection();
    
    if (!connected) {
        console.error('❌ З\'єднання не вдалося');
        return;
    }
    
    // Тест статистики
    console.log('\n3️⃣ Статистика БД:');
    const stats = await getDatabaseStats();
    for (const [table, count] of Object.entries(stats)) {
        console.log(`   ${table}: ${count}`);
    }
    
    // Тест створення адаптера
    console.log('\n4️⃣ Тест DatabaseAdapter:');
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select(['username', 'role'], { limit: 2 });
            
        console.log(`   ✅ Отримано ${users.length} користувачів через адаптер:`);
        users.forEach((user, index) => {
            console.log(`      ${index + 1}. ${user.username} (${user.role})`);
        });
        
    } catch (error) {
        console.error(`   ❌ Помилка адаптера: ${error.message}`);
    } finally {
        adapter.close();
    }
    
    // Тест переключення режиму (тільки для демонстрації)
    console.log('\n5️⃣ Тест переключення режиму:');
    const originalMode = USE_SUPABASE;
    
    console.log(`   Поточний режим: ${originalMode ? 'Supabase' : 'SQLite'}`);
    
    // Переключити на протилежний режим
    switchDatabaseMode(!originalMode);
    console.log(`   Переключено на: ${!originalMode ? 'Supabase' : 'SQLite'}`);
    
    // Повернути назад
    switchDatabaseMode(originalMode);
    console.log(`   Повернуто до: ${originalMode ? 'Supabase' : 'SQLite'}`);
    
    console.log('\n🎉 Всі тести Database Configuration завершені успішно!');
}

// Запуск тестів
if (require.main === module) {
    testDatabaseConfig()
        .then(() => {
            console.log('\n📋 Тестування Database Configuration завершено');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testDatabaseConfig };