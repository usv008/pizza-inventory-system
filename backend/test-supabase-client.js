#!/usr/bin/env node

/**
 * Тест нового Supabase клієнта
 * Перевіряє з'єднання та базову функціональність
 */

const { supabase, testConnection } = require('./database-supabase');

async function testSupabaseClient() {
    console.log('🧪 Тестування Supabase клієнта...\n');
    
    try {
        // 1. Тест з'єднання
        console.log('1️⃣ Тест з\'єднання...');
        const connected = await testConnection();
        
        if (!connected) {
            console.error('❌ Не вдалося з\'єднатися з Supabase');
            process.exit(1);
        }
        
        // 2. Тест отримання користувачів
        console.log('\n2️⃣ Тест отримання користувачів...');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, username, role, created_at')
            .limit(3);
            
        if (usersError) {
            console.error('❌ Помилка отримання користувачів:', usersError.message);
        } else {
            console.log(`✅ Отримано ${users.length} користувачів`);
            users.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.username} (${user.role}) - ${user.created_at}`);
            });
        }
        
        // 3. Тест отримання продуктів
        console.log('\n3️⃣ Тест отримання продуктів...');
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, code, stock_pieces')
            .limit(3);
            
        if (productsError) {
            console.error('❌ Помилка отримання продуктів:', productsError.message);
        } else {
            console.log(`✅ Отримано ${products.length} продуктів`);
            products.forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.name} (${product.code}) - ${product.stock_pieces} шт`);
            });
        }
        
        // 4. Тест JSONB полів
        console.log('\n4️⃣ Тест JSONB полів...');
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, delivery_info')
            .not('delivery_info', 'is', null)
            .limit(2);
            
        if (ordersError) {
            console.error('❌ Помилка отримання замовлень:', ordersError.message);
        } else {
            console.log(`✅ Отримано ${orders.length} замовлень з JSONB даними`);
            orders.forEach((order, index) => {
                console.log(`   ${index + 1}. ${order.order_number}: delivery_info =`, 
                           typeof order.delivery_info === 'object' ? 'JSONB ✅' : 'не JSONB ❌');
            });
        }
        
        // 5. Тест статистики
        console.log('\n5️⃣ Тест статистики...');
        const tables = ['users', 'products', 'clients', 'orders', 'stock_movements'];
        
        for (const tableName of tables) {
            const { count, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
                
            if (error) {
                console.log(`   ${tableName}: помилка - ${error.message}`);
            } else {
                console.log(`   ${tableName}: ${count} записів`);
            }
        }
        
        console.log('\n🎉 Всі тести Supabase клієнта пройшли успішно!');
        console.log('✅ Готово до міграції сервісів');
        
    } catch (error) {
        console.error('\n❌ Критична помилка тестування:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Запуск тестів
if (require.main === module) {
    testSupabaseClient()
        .then(() => {
            console.log('\n📋 Тестування завершено');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testSupabaseClient };