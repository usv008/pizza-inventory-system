const { Store } = require('express-session');

/**
 * Supabase Session Store для Express Sessions (Development Version)
 * Адаптована версія для роботи без поля sess
 * В production потрібно додати поле sess та використовувати повну версію
 */
class SupabaseSessionStoreDev extends Store {
    constructor(options = {}) {
        super(options);
        this.supabase = options.supabase;
        this.tableName = 'user_sessions';
        this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000; // 15 хвилин
        this.sessionsCache = new Map(); // Тимчасовий кеш для session data
        
        console.log('[SUPABASE SESSION STORE DEV] Ініціалізація (без поля sess)...');
        console.log('[SUPABASE SESSION STORE DEV] ⚠️  В production додайте поле sess до таблиці');
        
        // Запускаємо автоматичне очищення
        this.startCleanup();
    }
    
    /**
     * Отримання сесії за session ID
     */
    async get(sid, callback) {
        try {
            console.log(`[SESSION STORE DEV] Отримання сесії: ${sid}`);
            
            // Спочатку перевіряємо кеш
            if (this.sessionsCache.has(sid)) {
                const cachedData = this.sessionsCache.get(sid);
                if (new Date(cachedData.expires_at) > new Date()) {
                    console.log(`[SESSION STORE DEV] ✅ Сесія з кешу: ${sid}`);
                    return callback(null, cachedData.sess);
                } else {
                    this.sessionsCache.delete(sid);
                }
            }
            
            // Перевіряємо в базі даних
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('id, session_id, expires_at, user_id, ip_address, user_agent')
                .eq('session_id', sid)
                .eq('active', 1)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`[SESSION STORE DEV] Сесія не знайдена: ${sid}`);
                    return callback(null, null); // Session not found
                }
                console.error(`[SESSION STORE DEV] Помилка отримання сесії ${sid}:`, error.message);
                return callback(error);
            }
            
            // Перевірка терміну дії
            if (new Date(data.expires_at) < new Date()) {
                console.log(`[SESSION STORE DEV] Сесія застаріла: ${sid}`);
                await this.destroy(sid, () => {});
                return callback(null, null);
            }
            
            // Створюємо базову session data (оскільки поля sess немає)
            const sessionData = {
                cookie: {
                    maxAge: new Date(data.expires_at).getTime() - Date.now(),
                    httpOnly: true,
                    secure: false
                },
                user: data.user_id ? { id: data.user_id } : null,
                ip: data.ip_address,
                userAgent: data.user_agent
            };
            
            console.log(`[SESSION STORE DEV] ✅ Сесія отримана: ${sid}`);
            callback(null, sessionData);
        } catch (err) {
            console.error(`[SESSION STORE DEV] Критична помилка отримання сесії ${sid}:`, err.message);
            callback(err);
        }
    }
    
    /**
     * Збереження сесії
     */
    async set(sid, session, callback) {
        try {
            console.log(`[SESSION STORE DEV] Збереження сесії: ${sid}`);
            
            const expires_at = new Date(Date.now() + (session.cookie.maxAge || 86400000));
            const user_id = session.user?.id || null;
            const ip_address = session.ip || null;
            const user_agent = session.userAgent || null;
            
            // Зберігаємо в кеш
            this.sessionsCache.set(sid, {
                sess: session,
                expires_at: expires_at.toISOString()
            });
            
            // Зберігаємо метадані в базу даних
            const { error } = await this.supabase
                .from(this.tableName)
                .upsert({
                    session_id: sid,
                    expires_at: expires_at.toISOString(),
                    user_id,
                    ip_address,
                    user_agent,
                    active: 1
                }, {
                    onConflict: 'session_id'
                });
            
            if (error) {
                console.error(`[SESSION STORE DEV] Помилка збереження сесії ${sid}:`, error.message);
                this.sessionsCache.delete(sid); // Видаляємо з кешу при помилці
                return callback(error);
            }
            
            console.log(`[SESSION STORE DEV] ✅ Сесія збережена: ${sid}`);
            callback(null);
        } catch (err) {
            console.error(`[SESSION STORE DEV] Критична помилка збереження сесії ${sid}:`, err.message);
            this.sessionsCache.delete(sid);
            callback(err);
        }
    }
    
    /**
     * Видалення сесії
     */
    async destroy(sid, callback) {
        try {
            console.log(`[SESSION STORE DEV] Видалення сесії: ${sid}`);
            
            // Видаляємо з кешу
            this.sessionsCache.delete(sid);
            
            // Видаляємо з бази даних
            const { error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 })
                .eq('session_id', sid);
            
            if (error) {
                console.error(`[SESSION STORE DEV] Помилка видалення сесії ${sid}:`, error.message);
                return callback(error);
            }
            
            console.log(`[SESSION STORE DEV] ✅ Сесія видалена: ${sid}`);
            callback(null);
        } catch (err) {
            console.error(`[SESSION STORE DEV] Критична помилка видалення сесії ${sid}:`, err.message);
            callback(err);
        }
    }
    
    /**
     * Очищення всіх сесій
     */
    async clear(callback) {
        try {
            console.log('[SESSION STORE DEV] Очищення всіх сесій');
            
            // Очищаємо кеш
            this.sessionsCache.clear();
            
            // Очищаємо базу даних
            const { error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 });
            
            if (error) {
                console.error('[SESSION STORE DEV] Помилка очищення сесій:', error.message);
                return callback(error);
            }
            
            console.log('[SESSION STORE DEV] ✅ Всі сесії очищено');
            callback(null);
        } catch (err) {
            console.error('[SESSION STORE DEV] Критична помилка очищення сесій:', err.message);
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
                console.error('[SESSION STORE DEV] Помилка підрахунку сесій:', error.message);
                return callback(error);
            }
            
            console.log(`[SESSION STORE DEV] Активних сесій: ${count}`);
            callback(null, count);
        } catch (err) {
            console.error('[SESSION STORE DEV] Критична помилка підрахунку сесій:', err.message);
            callback(err);
        }
    }
    
    /**
     * Автоматичне очищення застарілих сесій
     */
    async cleanup() {
        try {
            console.log('[SESSION CLEANUP DEV] Початок очищення застарілих сесій...');
            
            // Очищаємо кеш
            const now = new Date();
            let cleanedFromCache = 0;
            
            for (const [sid, data] of this.sessionsCache.entries()) {
                if (new Date(data.expires_at) < now) {
                    this.sessionsCache.delete(sid);
                    cleanedFromCache++;
                }
            }
            
            // Очищаємо базу даних
            const { count, error } = await this.supabase
                .from(this.tableName)
                .update({ active: 0 })
                .lt('expires_at', now.toISOString())
                .select('*', { count: 'exact' });
            
            if (error) {
                console.error('[SESSION CLEANUP DEV] Помилка очищення БД:', error.message);
            } else {
                console.log(`[SESSION CLEANUP DEV] ✅ Очищено: ${cleanedFromCache} з кешу, ${count || 0} з БД`);
            }
        } catch (err) {
            console.error('[SESSION CLEANUP DEV] Критична помилка очищення:', err.message);
        }
    }
    
    /**
     * Запуск автоматичного очищення
     */
    startCleanup() {
        console.log(`[SESSION STORE DEV] Запуск автоматичного очищення кожні ${this.cleanupInterval / 1000} секунд`);
        
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
                expired: (total?.length || 0) - (active?.length || 0),
                cached: this.sessionsCache.size
            };
        } catch (err) {
            console.error('[SESSION STORE DEV] Помилка отримання статистики:', err.message);
            return { active: 0, total: 0, expired: 0, cached: 0 };
        }
    }
}

module.exports = SupabaseSessionStoreDev; 