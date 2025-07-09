require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для аутентифікації користувачів через Supabase
 * З повною підтримкою паролів та безпеки
 */
class SupabaseAuthService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
        this.saltRounds = 10;
    }

    /**
     * Ініціалізація сервісу
     */
    initialize() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY мають бути встановлені');
        }

        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        this.initialized = true;
        console.log('✅ SupabaseAuthService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized || !this.supabase) {
            throw new DatabaseError('AuthService не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всіх активних користувачів для dropdown
     * Адаптовано під існуючу структуру фронтенду
     */
    async getActiveUsers() {
        this._checkInitialization();
        
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('id, username, role, full_name, is_active')
                .eq('is_active', true);

            if (error) {
                console.error('❌ Supabase помилка:', error);
                throw new DatabaseError(`Помилка отримання користувачів: ${error.message}`);
            }

            console.log(`🔍 Отримано ${users.length} активних користувачів з Supabase`);

            // Адаптуємо до формату SQLite для сумісності
            return users.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                active: 1, // Маппінг is_active (true) -> active (1)
                full_name: user.full_name || user.username
            }));
        } catch (error) {
            console.error('❌ Помилка отримання активних користувачів:', error);
            throw new DatabaseError(`Помилка отримання активних користувачів: ${error.message}`);
        }
    }

    /**
     * Аутентифікація користувача з повною перевіркою паролів
     */
    async login(username, password, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            // Знаходимо користувача за username
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
            
            if (userError || !user) {
                await this._logSecurityEvent('LOGIN_FAILED', null, {
                    username,
                    reason: 'User not found',
                    ...sessionInfo
                });
                throw new NotFoundError('Користувача не знайдено');
            }

            if (!user.is_active) {
                await this._logSecurityEvent('LOGIN_FAILED', user.id, {
                    username,
                    reason: 'User inactive',
                    ...sessionInfo
                });
                throw new ValidationError('Користувач деактивований');
            }

            // Перевіряємо пароль
            if (user.password_hash) {
                const isPasswordValid = await bcrypt.compare(password, user.password_hash);
                if (!isPasswordValid) {
                    await this._logSecurityEvent('LOGIN_FAILED', user.id, {
                        username,
                        reason: 'Invalid password',
                        ...sessionInfo
                    });
                    throw new ValidationError('Неправильний пароль');
                }
            } else {
                // Для першого входу, коли немає пароля
                if (!user.first_login) {
                    await this._logSecurityEvent('LOGIN_FAILED', user.id, {
                        username,
                        reason: 'No password set',
                        ...sessionInfo
                    });
                    throw new ValidationError('Пароль не встановлений');
                }
            }

            // Успішний вхід
            await this._logSecurityEvent('LOGIN_SUCCESS', user.id, {
                username,
                ...sessionInfo
            });

            console.log(`🔐 Успішний вхід користувача: ${username} (ID: ${user.id})`);

            let permissions = {};
            try {
                permissions = typeof user.permissions === 'object' 
                    ? user.permissions
                    : (user.permissions ? JSON.parse(user.permissions) : {});
            } catch (err) {
                console.warn('⚠️ Помилка парсингу permissions:', err);
                permissions = {};
            }

            return {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: permissions,
                first_login: user.first_login,
                email: user.email,
                phone: user.phone || null
            };
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка входу:', error);
            throw new DatabaseError(`Помилка входу: ${error.message}`);
        }
    }

    /**
     * Валідація сесії
     */
    async validateSession(sessionId) {
        // Для спрощення - повертаємо null, оскільки сесії управляються Express
        // В реальній системі тут була б перевірка в БД
        console.log(`🔍 Перевірка сесії: ${sessionId}`);
        return null;
    }

    /**
     * Вихід користувача з системи
     */
    async logout(sessionId, userId, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            if (userId) {
                await this._logSecurityEvent('LOGOUT', userId, {
                    session_id: sessionId,
                    ...sessionInfo
                });
                console.log(`🔓 Користувач ${userId} вийшов з системи`);
            } else {
                console.log(`🔓 Вихід з системи (сесія: ${sessionId})`);
            }
        } catch (error) {
            console.error('❌ Помилка логування виходу:', error);
            // Не кидаємо помилку, щоб не блокувати вихід
        }
    }

    /**
     * Очищення застарілих сесій
     */
    async cleanupExpiredSessions() {
        console.log('🧹 Очищення застарілих сесій (заглушка)');
        return 0; // Повертаємо 0 як кількість очищених сесій
    }

    /**
     * Встановлення пароля при першому вході
     */
    async setFirstTimePassword(userId, password, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (userError || !user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            if (!user.first_login) {
                throw new ValidationError('Пароль вже встановлено');
            }

            // Хешуємо пароль
            const hashedPassword = await bcrypt.hash(password, this.saltRounds);

            // Оновлюємо користувача
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    password_hash: hashedPassword,
                    first_login: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new DatabaseError(`Помилка оновлення пароля: ${updateError.message}`);
            }

            await this._logSecurityEvent('PASSWORD_SET', userId, {
                username: user.username,
                ...sessionInfo
            });

            console.log(`🔑 Встановлено пароль для користувача: ${user.username} (ID: ${userId})`);
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Помилка встановлення пароля:', error);
            throw new DatabaseError(`Помилка встановлення пароля: ${error.message}`);
        }
    }

    /**
     * Зміна власного пароля
     */
    async changeOwnPassword(userId, currentPassword, newPassword, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (userError || !user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            // Перевіряємо поточний пароль
            if (!user.password_hash) {
                throw new ValidationError('У користувача немає встановленого пароля');
            }

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                throw new ValidationError('Поточний пароль неправильний');
            }

            // Хешуємо новий пароль
            const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Оновлюємо пароль
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    password_hash: hashedNewPassword,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new DatabaseError(`Помилка зміни пароля: ${updateError.message}`);
            }

            await this._logSecurityEvent('PASSWORD_CHANGED', userId, {
                username: user.username,
                ...sessionInfo
            });

            console.log(`🔑 Змінено пароль для користувача: ${user.username} (ID: ${userId})`);
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Помилка зміни пароля:', error);
            throw new DatabaseError(`Помилка зміни пароля: ${error.message}`);
        }
    }

    /**
     * Зміна пароля адміністратором
     */
    async changePasswordByAdmin(userId, newPassword, adminId, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (userError || !user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            // Хешуємо новий пароль
            const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Оновлюємо пароль
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    password_hash: hashedNewPassword,
                    first_login: false, // Скидаємо first_login при зміні адміном
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new DatabaseError(`Помилка зміни пароля: ${updateError.message}`);
            }

            await this._logSecurityEvent('PASSWORD_CHANGED_BY_ADMIN', userId, {
                username: user.username,
                admin_id: adminId,
                ...sessionInfo
            });

            console.log(`🔑 Адмін змінив пароль для користувача: ${user.username} (ID: ${userId})`);
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Помилка зміни пароля адміном:', error);
            throw new DatabaseError(`Помилка зміни пароля адміном: ${error.message}`);
        }
    }

    /**
     * Логування безпекових подій
     */
    async _logSecurityEvent(eventType, userId, details = {}) {
        try {
            console.log(`🔐 Security Event: ${eventType} для користувача ${userId}`, details);
            
            // TODO: Додати збереження в audit таблицю якщо потрібно
            
        } catch (error) {
            console.error('❌ Помилка логування security event:', error);
        }
    }
}

module.exports = SupabaseAuthService; 