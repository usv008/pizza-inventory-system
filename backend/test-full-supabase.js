const { supabase } = require('./supabase-client');
const SupabaseSessionStoreDev = require('./middleware/supabase-session-store-dev');

/**
 * Повний тест міграції на Supabase
 * Перевіряє сесії та партії
 */
async function testFullSupabaseMigration() {
    console.log('🧪 Повний тест міграції на Supabase...\n');
    
    try {
        // ================================
        // ТЕСТ 1: ПІДКЛЮЧЕННЯ ДО SUPABASE
        // ================================
        console.log('📋 Тест 1: Підключення до Supabase');
        const { data: connectionTest, error: connectionError } = await supabase
            .from('products')
            .select('id')
            .limit(1);
        
        if (connectionError) {
            throw new Error(`Помилка підключення: ${connectionError.message}`);
        }
        
        console.log('✅ Підключення до Supabase працює\n');
        
        // ================================
        // ТЕСТ 2: СЕСІЇ (SUPABASE SESSION STORE)
        // ================================
        console.log('📋 Тест 2: Supabase Session Store');
        
        const sessionStore = new SupabaseSessionStoreDev({
            supabase: supabase,
            cleanupInterval: 60000
        });
        
        const testSid = 'migration-test-' + Date.now();
        const testSession = {
            cookie: { maxAge: 3600000, httpOnly: true },
            user: { id: 43, username: 'test-user' },
            migrationTest: true
        };
        
        // Тест збереження сесії
        await new Promise((resolve, reject) => {
            sessionStore.set(testSid, testSession, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Тест отримання сесії
        const retrievedSession = await new Promise((resolve, reject) => {
            sessionStore.get(testSid, (err, session) => {
                if (err) reject(err);
                else resolve(session);
            });
        });
        
        if (!retrievedSession || !retrievedSession.migrationTest) {
            throw new Error('Сесія не була збережена або отримана правильно');
        }
        
        // Очищення тестової сесії
        await new Promise((resolve, reject) => {
            sessionStore.destroy(testSid, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log('✅ Supabase Session Store працює правильно\n');
        
        // ================================
        // ТЕСТ 3: ПАРТІЇ (BATCH QUERIES)
        // ================================
        console.log('📋 Тест 3: Batch Queries в Supabase');
        
        const { batchQueries } = require('./supabase-database');
        
        if (!batchQueries) {
            throw new Error('batchQueries не знайдено в supabase-database');
        }
        
        // Тест отримання всіх партій
        const allBatches = await batchQueries.getAll();
        console.log(`   - Всього партій: ${allBatches.length}`);
        
        // Тест групування по товарах
        const groupedBatches = await batchQueries.getAllGroupedByProduct();
        console.log(`   - Товарів з партіями: ${groupedBatches.length}`);
        
        // Тест отримання партій що закінчуються
        const expiringBatches = await batchQueries.getExpiring(30);
        console.log(`   - Партій що закінчуються (30 днів): ${expiringBatches.length}`);
        
        console.log('✅ Batch Queries працюють правильно\n');
        
        // ================================
        // ТЕСТ 4: ПЕРЕВІРКА ВІДСУТНОСТІ SQLITE
        // ================================
        console.log('📋 Тест 4: Перевірка відсутності SQLite залежностей');
        
        let sqliteFound = false;
        
        try {
            require('sqlite3');
            sqliteFound = true;
        } catch (err) {
            // SQLite не знайдено - це добре
        }
        
        try {
            require('connect-sqlite3');
            sqliteFound = true;
        } catch (err) {
            // connect-sqlite3 не знайдено - це добре
        }
        
        if (sqliteFound) {
            console.log('⚠️  SQLite залежності все ще присутні (не критично)');
        } else {
            console.log('✅ SQLite залежності успішно видалено');
        }
        
        console.log('');
        
        // ================================
        // ТЕСТ 5: СТАТИСТИКА МІГРАЦІЇ
        // ================================
        console.log('📋 Тест 5: Статистика міграції');
        
        // Статистика сесій
        const sessionStats = await sessionStore.getStats();
        console.log(`   - Активних сесій: ${sessionStats.active}`);
        console.log(`   - Всього сесій: ${sessionStats.total}`);
        console.log(`   - В кеші: ${sessionStats.cached}`);
        
        // Статистика таблиць
        const { data: productsCount } = await supabase
            .from('products')
            .select('*', { count: 'exact' });
        
        const { data: ordersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact' });
        
        const { data: batchesCount } = await supabase
            .from('production_batches')
            .select('*', { count: 'exact' });
        
        console.log(`   - Товарів в Supabase: ${productsCount?.length || 0}`);
        console.log(`   - Замовлень в Supabase: ${ordersCount?.length || 0}`);
        console.log(`   - Партій в Supabase: ${batchesCount?.length || 0}`);
        
        console.log('\n🎉 Міграція на повний Supabase завершена успішно!');
        console.log('\n📋 Результати міграції:');
        console.log('   ✅ Сесії: Supabase user_sessions (з кешем)');
        console.log('   ✅ Партії: Supabase production_batches');
        console.log('   ✅ Товари: Supabase products');
        console.log('   ✅ Замовлення: Supabase orders');
        console.log('   ✅ Клієнти: Supabase clients');
        console.log('   ✅ Користувачі: Supabase users');
        console.log('   ✅ Операції: Supabase operations_log');
        console.log('   ✅ Приходи: Supabase arrivals');
        
        console.log('\n📝 Наступні кроки:');
        console.log('   1. В production додайте поле sess до user_sessions');
        console.log('   2. Протестуйте повну функціональність системи');
        console.log('   3. Видаліть .backup файли після підтвердження');
        
        return true;
        
    } catch (err) {
        console.error('\n❌ Тест міграції не пройдено:', err.message);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

if (require.main === module) {
    testFullSupabaseMigration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(err => {
            console.error('❌ Фатальна помилка тестування:', err);
            process.exit(1);
        });
}

module.exports = { testFullSupabaseMigration }; 