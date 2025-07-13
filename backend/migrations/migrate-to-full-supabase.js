const { supabase } = require('../supabase-client');

/**
 * Міграція на повний Supabase
 * Додає необхідні поля до user_sessions та тестує функціональність
 */
async function migrateToFullSupabase() {
    console.log('🚀 Початок міграції на повний Supabase...');
    
    try {
        // 1. Додаємо поле sess до user_sessions
        console.log('📋 Додаємо поле sess до user_sessions...');
        
        // Спробуємо виконати ALTER TABLE через RPC
        const { data: alterResult, error: alterError } = await supabase
            .rpc('execute_sql', { 
                sql: 'ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sess JSONB;' 
            });
        
        if (alterError) {
            console.warn('⚠️  RPC недоступний, використовую альтернативний підхід:', alterError.message);
            
            // Альтернативний підхід - спробуємо вставити запис з sess полем
            const testResult = await supabase
                .from('user_sessions')
                .insert({
                    session_id: 'migration-test-' + Date.now(),
                    user_id: 1,
                    expires_at: new Date(Date.now() + 3600000).toISOString(),
                    sess: { migration: true }
                });
            
            if (testResult.error && testResult.error.message.includes('sess')) {
                console.error('❌ Поле sess не існує і не може бути додано автоматично');
                console.log('💡 Необхідно вручну додати поле через Supabase Dashboard:');
                console.log('   ALTER TABLE user_sessions ADD COLUMN sess JSONB;');
                return false;
            } else if (testResult.error) {
                console.error('❌ Інша помилка:', testResult.error.message);
                return false;
            } else {
                console.log('✅ Поле sess вже існує або було додано');
                // Очищаємо тестовий запис
                await supabase
                    .from('user_sessions')
                    .delete()
                    .like('session_id', 'migration-test-%');
            }
        } else {
            console.log('✅ SQL команда виконана через RPC');
        }
        
        // 2. Створюємо індекси для оптимізації
        console.log('📋 Створюємо індекси для оптимізації...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active);',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);'
        ];
        
        for (const indexSql of indexes) {
            const { error: indexError } = await supabase
                .rpc('execute_sql', { sql: indexSql });
            
            if (indexError) {
                console.warn(`⚠️  Індекс не створено: ${indexError.message}`);
            } else {
                console.log(`✅ Індекс створено: ${indexSql.split(' ')[5]}`);
            }
        }
        
        // 3. Тестування нового session store
        console.log('🧪 Тестування нового session store...');
        
        const testSessionData = {
            session_id: 'test-migration-' + Date.now(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            sess: { 
                test: true, 
                migrated: true,
                user: { id: 1, name: 'Test User' },
                cookie: { maxAge: 3600000 }
            },
            user_id: 1,
            ip_address: '127.0.0.1',
            user_agent: 'Migration Test',
            active: 1
        };
        
        // Тест вставки
        const { error: insertError } = await supabase
            .from('user_sessions')
            .insert(testSessionData);
        
        if (insertError) {
            console.error('❌ Помилка тестування вставки:', insertError.message);
            return false;
        }
        
        // Тест отримання
        const { data: selectData, error: selectError } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('session_id', testSessionData.session_id)
            .single();
        
        if (selectError) {
            console.error('❌ Помилка тестування отримання:', selectError.message);
            return false;
        }
        
        // Перевірка структури даних
        if (!selectData.sess || !selectData.sess.test) {
            console.error('❌ Дані сесії не збережені правильно');
            return false;
        }
        
        // Тест оновлення
        const { error: updateError } = await supabase
            .from('user_sessions')
            .update({ 
                sess: { ...selectData.sess, updated: true },
                active: 0 
            })
            .eq('session_id', testSessionData.session_id);
        
        if (updateError) {
            console.error('❌ Помилка тестування оновлення:', updateError.message);
            return false;
        }
        
        // Очищаємо тестову сесію
        await supabase
            .from('user_sessions')
            .delete()
            .eq('session_id', testSessionData.session_id);
        
        console.log('✅ Всі тести пройдено успішно!');
        
        // 4. Статистика міграції
        console.log('📊 Статистика міграції:');
        
        const { count: totalSessions } = await supabase
            .from('user_sessions')
            .select('*', { count: 'exact' });
        
        const { count: activeSessions } = await supabase
            .from('user_sessions')
            .select('*', { count: 'exact' })
            .eq('active', 1)
            .gt('expires_at', new Date().toISOString());
        
        console.log(`   - Всього сесій в БД: ${totalSessions || 0}`);
        console.log(`   - Активних сесій: ${activeSessions || 0}`);
        
        console.log('✅ Міграція на повний Supabase завершена успішно!');
        console.log('📋 Наступні кроки:');
        console.log('   1. Оновити app-new.js для використання SupabaseSessionStore');
        console.log('   2. Видалити SQLite залежності');
        console.log('   3. Протестувати повну функціональність');
        
        return true;
        
    } catch (err) {
        console.error('❌ Критична помилка міграції:', err.message);
        console.error('Stack trace:', err.stack);
        return false;
    }
}

/**
 * Перевірка готовності до міграції
 */
async function checkMigrationReadiness() {
    console.log('🔍 Перевірка готовності до міграції...');
    
    try {
        // Перевірка підключення до Supabase
        const { data, error } = await supabase
            .from('user_sessions')
            .select('id')
            .limit(1);
        
        if (error) {
            console.error('❌ Немає доступу до таблиці user_sessions:', error.message);
            return false;
        }
        
        console.log('✅ Підключення до Supabase працює');
        
        // Перевірка структури таблиці
        const { data: testData, error: testError } = await supabase
            .from('user_sessions')
            .select('session_id, user_id, expires_at, active')
            .limit(1);
        
        if (testError) {
            console.error('❌ Проблема зі структурою таблиці:', testError.message);
            return false;
        }
        
        console.log('✅ Базова структура таблиці user_sessions в порядку');
        return true;
        
    } catch (err) {
        console.error('❌ Помилка перевірки готовності:', err.message);
        return false;
    }
}

// Запуск міграції якщо файл викликається напряму
if (require.main === module) {
    console.log('🎯 Запуск міграції на повний Supabase...');
    
    checkMigrationReadiness()
        .then(ready => {
            if (!ready) {
                console.error('❌ Система не готова до міграції');
                process.exit(1);
            }
            
            return migrateToFullSupabase();
        })
        .then(success => {
            if (success) {
                console.log('🎉 Міграція завершена успішно!');
                process.exit(0);
            } else {
                console.error('❌ Міграція не вдалася');
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('❌ Фатальна помилка міграції:', err);
            process.exit(1);
        });
}

module.exports = { 
    migrateToFullSupabase, 
    checkMigrationReadiness 
}; 