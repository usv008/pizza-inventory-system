const { supabase } = require('../supabase-client');

/**
 * Симуляція додавання поля sess для розробки
 * В реальному середовищі потрібно виконати SQL через Supabase Dashboard
 */
async function simulateSessField() {
    console.log('🔧 Симуляція додавання поля sess для розробки...');
    
    try {
        // Тестуємо, чи можемо працювати з полем sess
        const testSessionData = {
            session_id: 'dev-test-' + Date.now(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            user_id: 43, // Використовуємо існуючого користувача
            ip_address: '127.0.0.1',
            user_agent: 'Development Test',
            active: 1
        };
        
        // Спробуємо вставити без поля sess
        console.log('📋 Тестування вставки без поля sess...');
        const { data: insertData, error: insertError } = await supabase
            .from('user_sessions')
            .insert(testSessionData)
            .select()
            .single();
        
        if (insertError) {
            console.error('❌ Помилка вставки:', insertError.message);
            return false;
        }
        
        console.log('✅ Базова вставка працює');
        
        // Спробуємо оновити з полем sess
        console.log('📋 Тестування оновлення з полем sess...');
        const { error: updateError } = await supabase
            .from('user_sessions')
            .update({ 
                sess: { 
                    test: true, 
                    development: true,
                    cookie: { maxAge: 3600000 }
                }
            })
            .eq('id', insertData.id);
        
        if (updateError) {
            console.warn('⚠️  Поле sess недоступне:', updateError.message);
            console.log('💡 Продовжуємо розробку без поля sess');
            console.log('💡 В production потрібно виконати SQL скрипт add-sess-field.sql');
            
            // Очищаємо тестовий запис
            await supabase
                .from('user_sessions')
                .delete()
                .eq('id', insertData.id);
            
            return 'partial'; // Часткова підтримка
        }
        
        // Тест отримання з полем sess
        const { data: selectData, error: selectError } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('id', insertData.id)
            .single();
        
        if (selectError) {
            console.error('❌ Помилка отримання:', selectError.message);
            return false;
        }
        
        if (selectData.sess && selectData.sess.test) {
            console.log('✅ Поле sess працює повністю!');
        }
        
        // Очищаємо тестовий запис
        await supabase
            .from('user_sessions')
            .delete()
            .eq('id', insertData.id);
        
        console.log('✅ Симуляція завершена успішно');
        return true;
        
    } catch (err) {
        console.error('❌ Помилка симуляції:', err.message);
        return false;
    }
}

if (require.main === module) {
    simulateSessField()
        .then(result => {
            if (result === 'partial') {
                console.log('⚠️  Часткова підтримка - можна продовжувати розробку');
                process.exit(0);
            } else if (result) {
                console.log('✅ Повна підтримка - все готово');
                process.exit(0);
            } else {
                console.error('❌ Симуляція не вдалася');
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('❌ Фатальна помилка:', err);
            process.exit(1);
        });
}

module.exports = { simulateSessField }; 