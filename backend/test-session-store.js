const SupabaseSessionStoreDev = require('./middleware/supabase-session-store-dev');
const { supabase } = require('./supabase-client');

/**
 * Тестування SupabaseSessionStoreDev
 */
async function testSessionStore() {
    console.log('🧪 Тестування SupabaseSessionStoreDev...');
    
    try {
        // Створюємо session store
        const sessionStore = new SupabaseSessionStoreDev({
            supabase: supabase,
            cleanupInterval: 60000 // 1 хвилина для тестування
        });
        
        const testSid = 'test-session-' + Date.now();
        const testSession = {
            cookie: {
                maxAge: 3600000, // 1 година
                httpOnly: true,
                secure: false
            },
            user: { id: 43, username: 'test-user' },
            ip: '127.0.0.1',
            userAgent: 'Test Agent',
            testData: 'This is test session data'
        };
        
        console.log('\n📋 Тест 1: Збереження сесії');
        await new Promise((resolve, reject) => {
            sessionStore.set(testSid, testSession, (err) => {
                if (err) {
                    console.error('❌ Помилка збереження:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Сесія збережена');
                    resolve();
                }
            });
        });
        
        console.log('\n📋 Тест 2: Отримання сесії');
        const retrievedSession = await new Promise((resolve, reject) => {
            sessionStore.get(testSid, (err, session) => {
                if (err) {
                    console.error('❌ Помилка отримання:', err.message);
                    reject(err);
                } else if (!session) {
                    console.error('❌ Сесія не знайдена');
                    reject(new Error('Session not found'));
                } else {
                    console.log('✅ Сесія отримана:', JSON.stringify(session, null, 2));
                    resolve(session);
                }
            });
        });
        
        console.log('\n📋 Тест 3: Підрахунок сесій');
        await new Promise((resolve, reject) => {
            sessionStore.length((err, count) => {
                if (err) {
                    console.error('❌ Помилка підрахунку:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ Кількість активних сесій: ${count}`);
                    resolve();
                }
            });
        });
        
        console.log('\n📋 Тест 4: Статистика');
        const stats = await sessionStore.getStats();
        console.log('✅ Статистика сесій:', stats);
        
        console.log('\n📋 Тест 5: Видалення сесії');
        await new Promise((resolve, reject) => {
            sessionStore.destroy(testSid, (err) => {
                if (err) {
                    console.error('❌ Помилка видалення:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Сесія видалена');
                    resolve();
                }
            });
        });
        
        console.log('\n📋 Тест 6: Перевірка видалення');
        await new Promise((resolve, reject) => {
            sessionStore.get(testSid, (err, session) => {
                if (err) {
                    console.error('❌ Помилка перевірки:', err.message);
                    reject(err);
                } else if (session) {
                    console.error('❌ Сесія не була видалена');
                    reject(new Error('Session still exists'));
                } else {
                    console.log('✅ Сесія успішно видалена');
                    resolve();
                }
            });
        });
        
        console.log('\n🎉 Всі тести пройдено успішно!');
        console.log('📋 SupabaseSessionStoreDev готовий до використання');
        
        return true;
        
    } catch (err) {
        console.error('\n❌ Тести не пройдено:', err.message);
        return false;
    }
}

if (require.main === module) {
    testSessionStore()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(err => {
            console.error('❌ Фатальна помилка тестування:', err);
            process.exit(1);
        });
}

module.exports = { testSessionStore }; 