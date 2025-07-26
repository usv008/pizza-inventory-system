#!/usr/bin/env node

/**
 * Тест DatabaseAdapter - перевіряє роботу з SQLite та Supabase
 */

require('dotenv').config();
const DatabaseAdapter = require('./adapters/DatabaseAdapter');

async function testDatabaseAdapter() {
    console.log('🧪 Тестування DatabaseAdapter...\n');
    
    // Тест 1: SQLite режим
    console.log('1️⃣ Тест SQLite режиму...');
    await testAdapter(false, 'SQLite');
    
    // Тест 2: Supabase режим  
    console.log('\n2️⃣ Тест Supabase режиму...');
    await testAdapter(true, 'Supabase');
    
    console.log('\n🎉 Всі тести DatabaseAdapter завершені!');
}

async function testAdapter(useSupabase, modeName) {
    const adapter = new DatabaseAdapter(useSupabase);
    
    try {
        // Тест з'єднання
        console.log(`   🔗 Тест з'єднання ${modeName}...`);
        const connected = await adapter.testConnection();
        if (!connected) {
            console.error(`   ❌ ${modeName}: з'єднання не вдалося`);
            return;
        }
        console.log(`   ✅ ${modeName}: з'єднання успішне`);
        
        // Тест SELECT
        console.log(`   📖 Тест SELECT ${modeName}...`);
        const users = await adapter
            .table('users')
            .select(['id', 'username', 'role'], { 
                limit: 2,
                orderBy: { column: 'created_at', direction: 'desc' }
            });
            
        if (users && users.length > 0) {
            console.log(`   ✅ ${modeName}: отримано ${users.length} користувачів`);
            users.forEach((user, index) => {
                console.log(`      ${index + 1}. ${user.username} (${user.role})`);
            });
        } else {
            console.log(`   ⚠️  ${modeName}: користувачі не знайдені`);
        }
        
        // Тест SELECT з WHERE
        console.log(`   🔍 Тест SELECT з WHERE ${modeName}...`);
        const products = await adapter
            .table('products')
            .select('*', {
                where: { stock_pieces: [144, 96] },
                limit: 2
            });
            
        if (products && products.length > 0) {
            console.log(`   ✅ ${modeName}: знайдено ${products.length} продуктів з фільтром`);
            products.forEach((product, index) => {
                console.log(`      ${index + 1}. ${product.name} - ${product.stock_pieces} шт`);
            });
        } else {
            console.log(`   ⚠️  ${modeName}: продукти з фільтром не знайдені`);
        }
        
        // Тест статистики
        console.log(`   📊 Тест статистики ${modeName}...`);
        const tables = ['users', 'products', 'clients'];
        
        for (const tableName of tables) {
            try {
                const records = await adapter.table(tableName).select('COUNT(*) as count');
                
                let count;
                if (useSupabase) {
                    count = records.length; // В Supabase просто кількість записів
                } else {
                    count = records[0]?.count || 0; // В SQLite результат COUNT(*)
                }
                
                console.log(`      ${tableName}: ${count} записів`);
            } catch (error) {
                console.log(`      ${tableName}: помилка - ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`   ❌ ${modeName} помилка:`, error.message);
    } finally {
        // Закрити з'єднання SQLite
        if (!useSupabase) {
            adapter.close();
        }
    }
}

// Запуск тестів
if (require.main === module) {
    testDatabaseAdapter()
        .then(() => {
            console.log('\n📋 Тестування DatabaseAdapter завершено');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testDatabaseAdapter };