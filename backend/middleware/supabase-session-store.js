const { Store } = require('express-session');

/**
 * Supabase Session Store для Express Sessions
 * Замінює SQLiteStore для зберігання сесій в Supabase PostgreSQL
 */
class SupabaseSessionStore extends Store {
    constructor(options = {}) {
        super(options);
        this.supabase = options.supabase;
        this.tableName = 'user_sessions';
        this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000; // 15 хвилин
        
        console.log('[SUPABASE SESSION STORE] Ініціалізація...');
        
        // Запускаємо автоматичне очищення
        this.startCleanup();
    }
    
    /**
     * Отримання сесії за session ID
     */
    async get(sid, callback) {
        try {
            console.log(`[SESSION STORE] Отримання сесії: ${sid}`);
            
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('sess, expires_at, user_id')
                .eq('session_id', sid)
                .eq('active', 1)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`[SESSION STORE] Сесія не знайдена: ${sid}`);
                    return callback(null, null); // Session not found
                }
                console.error(`[SESSION STORE] Помилка отримання сесії ${sid}:`, error.message);
                return callback(error);
            }
            
            // Перевірка терміну дії
            if (new Date(data.expires_at) < new Date()) {
                console.log(`[SESSION STORE] Сесія застаріла: ${sid}`);
                await this.destroy(sid, () => {});
                return callback(null, null);
            }
            
            console.log(`[SESSION STORE] ✅ Сесія отримана: ${sid}`);
            callback(null, data.sess);
        } catch (err) {
            console.error(`[SESSION STORE] Критична помилка отримання сесії ${sid}:`, err.message);
            callback(err);
        }
    }
    
    /**
     * Збереження сесії
     */
    async set(sid, session, callback) {
        try {
            console.log(`[SESSION STORE] Збереження сесії: ${sid}`);
            
            const expires_at = new Date(Date.now() + (session.cookie.maxAge || 86400000));
            const user_id = session.user?.id || null;
            const ip_address = session.ip || null;
            const user_agent = session.userAgent || null;
            
            const { error } = await this.supabase
                .from(this.tableName)
                .upsert({
                    session_id: sid,
                    sess: session,
                    expires_at: expires_at.toISOString(),
                    user_id,
                    ip_address,
                    user_agent,
                    active: 1
                }, {
                    onConflict: 'session_id'
                });
            
            if (error) {
                console.error(`[SESSION STORE] Помилка збереження сесії ${sid}:`, error.message);
                return callback(error);
            }
            
            console.log(`[SESSION STORE] ✅ Сесія збережена: ${sid}`);
            callback(null);
        } catch (err) {
            console.error(`[SESSION STORE] Критична помилка збереження сесії ${sid}:`, err.message);
            callback(err);
        }
    }
    
    /**
     * Видалення сесії
     */
    async destroy(sid, callback) {
        try {
            console.log(`[SESSION STORE] Видалення сесії: ${sid}`);
            
            const { error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 })
                .eq('session_id', sid);
            
            if (error) {
                console.error(`[SESSION STORE] Помилка видалення сесії ${sid}:`, error.message);
                return callback(error);
            }
            
            console.log(`[SESSION STORE] ✅ Сесія видалена: ${sid}`);
            callback(null);
        } catch (err) {
            console.error(`[SESSION STORE] Критична помилка видалення сесії ${sid}:`, err.message);
            callback(err);
        }
    }
    
    /**
     * Очищення всіх сесій
     */
    async clear(callback) {
        try {
            console.log('[SESSION STORE] Очищення всіх сесій');
            
            const { error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 });
            
            if (error) {
                console.error('[SESSION STORE] Помилка очищення сесій:', error.message);
                return callback(error);
            }
            
            console.log('[SESSION STORE] ✅ Всі сесії очищено');
            callback(null);
        } catch (err) {
            console.error('[SESSION STORE] Критична помилка очищення сесій:', err.message);
            callback(err);
        }
    }
    
    /**
     * Підрахунок активних сесій
     */
    async length(callback) {
        try {
            const { count, error } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact' })
                .eq('active', 1)
                .gt('expires_at', new Date().toISOString());
            
            if (error) {
                console.error('[SESSION STORE] Помилка підрахунку сесій:', error.message);
                return callback(error);
            }
            
            console.log(`[SESSION STORE] Активних сесій: ${count}`);
            callback(null, count);
        } catch (err) {
            console.error('[SESSION STORE] Критична помилка підрахунку сесій:', err.message);
            callback(err);
        }
    }
    
    /**
     * Автоматичне очищення застарілих сесій
     */
    async cleanup() {
        try {
            console.log('[SESSION CLEANUP] Початок очищення застарілих сесій...');
            
            const { count, error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 })
                .lt('expires_at', new Date().toISOString())
                .select('*', { count: 'exact' });
            
            if (error) {
                console.error('[SESSION CLEANUP] Помилка очищення:', error.message);
            } else {
                console.log(`[SESSION CLEANUP] ✅ Очищено ${count || 0} застарілих сесій`);
            }
        } catch (err) {
            console.error('[SESSION CLEANUP] Критична помилка очищення:', err.message);
        }
    }
    
    /**
     * Запуск автоматичного очищення
     */
    startCleanup() {
        console.log(`[SESSION STORE] Запуск автоматичного очищення кожні ${this.cleanupInterval / 1000} секунд`);
        
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
        
        // Запускаємо перше очищення через 30 секунд
        setTimeout(() => {
            this.cleanup();
        }, 30000);
    }
    
    /**
     * Отримання статистики сесій
     */
    async getStats() {
        try {
            const { data: active, error: activeError } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact' })
                .eq('active', 1)
                .gt('expires_at', new Date().toISOString());
                
            const { data: total, error: totalError } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact' });
            
            if (activeError || totalError) {
                throw new Error(activeError?.message || totalError?.message);
            }
            
            return {
                active: active?.length || 0,
                total: total?.length || 0,
                expired: (total?.length || 0) - (active?.length || 0)
            };
        } catch (err) {
            console.error('[SESSION STORE] Помилка отримання статистики:', err.message);
            return { active: 0, total: 0, expired: 0 };
        }
    }
}

module.exports = SupabaseSessionStore; 