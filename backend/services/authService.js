const bcrypt = require('bcrypt');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для аутентифікації користувачів
 * Надає бізнес-логіку для входу, виходу та управління сесіями
 */
class AuthService {
    constructor() {
        this.userQueries = null;
        this.sessionQueries = null;
        this.auditQueries = null;
        this.initialized = false;
        this.saltRounds = 10;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        this.userQueries = dependencies.userQueries;
        this.sessionQueries = dependencies.sessionQueries;
        this.auditQueries = dependencies.auditQueries;
        this.initialized = true;
        console.log('✅ AuthService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        console.log(`[AUTH DEBUG] initialized: ${this.initialized}, userQueries: ${!!this.userQueries}`);
        if (!this.initialized || !this.userQueries) {
            throw new DatabaseError('AuthService не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всіх активних користувачів для dropdown
     */
    async getActiveUsers() {
        this._checkInitialization();
        
        try {
            const users = await this.userQueries.getAll();
            console.log(`🔍 Отримано ${users.length} користувачів з БД`);
            
            // Фільтруємо тільки активних користувачів
            const activeUsers = users.filter(user => {
                console.log(`🔍 Користувач ${user.username}: active=${user.active} (type: ${typeof user.active})`);
                return user.active === 1;
            });
            
            console.log(`👥 Отримано ${activeUsers.length} активних користувачів для вибору`);
            return activeUsers.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                active: user.active,
                full_name: user.username // Використовуємо username як повне ім'я
            }));
        } catch (error) {
            console.error('❌ Помилка отримання активних користувачів:', error);
            throw new DatabaseError(`Помилка отримання активних користувачів: ${error.message}`);
        }
    }

    /**
     * Отримати всіх користувачів (включно з неактивними) для адмін панелі
     */
    async getAllUsers() {
        this._checkInitialization();
        
        try {
            const users = await this.userQueries.getAll();
            console.log(`🔍 Отримано ${users.length} користувачів з БД (включно з неактивними)`);
            
            return users.map(user => ({
                id: user.id,
                username: user.username,
                role: user.role,
                active: user.active,
                email: user.email,
                phone: user.phone,
                created_at: user.created_at,
                updated_at: user.updated_at,
                full_name: user.username // Використовуємо username як повне ім'я
            }));
        } catch (error) {
            console.error('❌ Помилка отримання всіх користувачів:', error);
            throw new DatabaseError(`Помилка отримання всіх користувачів: ${error.message}`);
        }
    }

    /**
     * Аутентифікація користувача
     */
    async login(username, password, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            // Знаходимо користувача за username
            const user = await this.userQueries.getByUsername(username);
            
            if (!user) {
                await this._logSecurityEvent('LOGIN_FAILED', null, {
                    username,
                    reason: 'User not found',
                    ...sessionInfo
                });
                throw new NotFoundError('Користувача не знайдено');
            }

            if (!user.active) {
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

            await this._logUserAudit(user.id, 'LOGIN', {
                username,
                first_login: user.first_login,
                ...sessionInfo
            });

            console.log(`🔐 Успішний вхід користувача: ${username} (ID: ${user.id})`);

            return {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: JSON.parse(user.permissions || '{}'),
                first_login: user.first_login,
                email: user.email,
                phone: user.phone
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
     * Встановлення пароля при першому вході
     */
    async setFirstTimePassword(userId, password, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            const user = await this.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            if (!user.first_login) {
                throw new ValidationError('Пароль вже встановлено');
            }

            // Хешуємо пароль
            const hashedPassword = await bcrypt.hash(password, this.saltRounds);

            // Оновлюємо користувача
            await this.userQueries.updatePassword(userId, hashedPassword);

            await this._logUserAudit(userId, 'SET_PASSWORD', {
                username: user.username,
                ...sessionInfo
            });

            console.log(`🔐 Встановлено пароль для користувача: ${user.username} (ID: ${userId})`);

            return true;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка встановлення пароля:', error);
            throw new DatabaseError(`Помилка встановлення пароля: ${error.message}`);
        }
    }

    /**
     * Зміна власного пароля користувачем
     */
    async changeOwnPassword(userId, currentPassword, newPassword, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            const user = await this.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            // Перевіряємо поточний пароль
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                throw new ValidationError('Поточний пароль неправильний');
            }

            // Перевіряємо що новий пароль відрізняється
            const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
            if (isSamePassword) {
                throw new ValidationError('Новий пароль повинен відрізнятися від поточного');
            }

            // Хешуємо новий пароль
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Оновлюємо пароль
            await this.userQueries.updatePassword(userId, hashedPassword);

            await this._logUserAudit(userId, 'PASSWORD_CHANGED', {
                username: user.username,
                ...sessionInfo
            });

            await this._logSecurityEvent('PASSWORD_CHANGED', userId, {
                username: user.username,
                ...sessionInfo
            });

            console.log(`🔐 Пароль змінено користувачем: ${user.username} (ID: ${userId})`);

            return true;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
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
            const user = await this.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError('Користувача не знайдено');
            }

            const admin = await this.userQueries.getById(adminId);
            if (!admin) {
                throw new NotFoundError('Адміністратора не знайдено');
            }

            // Перевіряємо права адміністратора
            const adminPermissions = JSON.parse(admin.permissions || '{}');
            if (!adminPermissions.admin?.all_rights) {
                throw new ValidationError('Недостатньо прав для зміни пароля');
            }

            // Хешуємо новий пароль
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Оновлюємо пароль
            await this.userQueries.updatePassword(userId, hashedPassword);

            await this._logUserAudit(userId, 'PASSWORD_CHANGED_BY_ADMIN', {
                username: user.username,
                admin_id: adminId,
                admin_username: admin.username,
                ...sessionInfo
            });

            console.log(`🔐 Пароль змінено адміністратором ${admin.username} для користувача: ${user.username}`);

            return true;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка зміни пароля:', error);
            throw new DatabaseError(`Помилка зміни пароля: ${error.message}`);
        }
    }

    /**
     * Перевірка дійсності сесії
     */
    async validateSession(sessionId) {
        this._checkInitialization();
        
        try {
            const session = await this.sessionQueries.getById(sessionId);
            
            if (!session) {
                return null;
            }

            // Перевіряємо чи сесія не закінчилась
            if (new Date() > new Date(session.expires_at)) {
                await this.sessionQueries.deactivate(sessionId);
                return null;
            }

            // Перевіряємо чи користувач активний
            const user = await this.userQueries.getById(session.user_id);
            if (!user || !user.active) {
                await this.sessionQueries.deactivate(sessionId);
                return null;
            }

            return {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: JSON.parse(user.permissions || '{}'),
                session_id: sessionId
            };
        } catch (error) {
            console.error('❌ Помилка перевірки сесії:', error);
            return null;
        }
    }

    /**
     * Видалення сесії (logout)
     */
    async logout(sessionId, userId, sessionInfo = {}) {
        this._checkInitialization();
        
        try {
            if (sessionId) {
                await this.sessionQueries.deactivate(sessionId);
            }

            if (userId) {
                const user = await this.userQueries.getById(userId);
                if (user) {
                    await this._logUserAudit(userId, 'LOGOUT', {
                        username: user.username,
                        session_id: sessionId,
                        ...sessionInfo
                    });

                    await this._logSecurityEvent('LOGOUT', userId, {
                        username: user.username,
                        session_id: sessionId,
                        ...sessionInfo
                    });

                    console.log(`🔐 Вихід користувача: ${user.username} (ID: ${userId})`);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Помилка виходу:', error);
            throw new DatabaseError(`Помилка виходу: ${error.message}`);
        }
    }

    /**
     * Очищення застарілих сесій
     */
    async cleanupExpiredSessions() {
        this._checkInitialization();
        
        try {
            const result = await this.sessionQueries.cleanupExpired();
            console.log(`🧹 Очищено ${result.changes} застарілих сесій`);
            return result.changes;
        } catch (error) {
            console.error('❌ Помилка очищення сесій:', error);
            throw new DatabaseError(`Помилка очищення сесій: ${error.message}`);
        }
    }

    /**
     * Створення нового користувача
     */
    async createUser(userData, adminId) {
        this._checkInitialization();
        
        try {
            const { username, email, phone, role, password, active } = userData;
            
            // Перевіряємо чи користувач з таким username вже існує
            const existingUser = await this.userQueries.getByUsername(username);
            if (existingUser) {
                throw new ValidationError('Користувач з таким іменем вже існує');
            }
            
            // Хешуємо пароль
            const hashedPassword = await bcrypt.hash(password, this.saltRounds);
            
            // Створюємо користувача
            const newUser = await this.userQueries.create({
                username,
                email: email || null,
                phone: phone || null,
                role,
                password_hash: hashedPassword,
                active: active ? 1 : 0,
                first_login: 0, // Пароль вже встановлено
                permissions: JSON.stringify({}) // Базові права
            });
            
            await this._logUserAudit(newUser.id, 'USER_CREATED', {
                username,
                role,
                created_by: adminId
            });
            
            console.log(`👤 Створено нового користувача: ${username} (ID: ${newUser.id})`);
            
            return {
                id: newUser.id,
                username,
                email,
                phone,
                role,
                active: active ? 1 : 0,
                created_at: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка створення користувача:', error);
            throw new DatabaseError(`Помилка створення користувача: ${error.message}`);
        }
    }
    
    /**
     * Оновлення даних користувача
     */
    async updateUser(userId, updateData, adminId) {
        this._checkInitialization();
        
        try {
            const user = await this.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError('Користувача не знайдено');
            }
            
            // Перевіряємо чи username не зайнятий іншим користувачем
            if (updateData.username && updateData.username !== user.username) {
                const existingUser = await this.userQueries.getByUsername(updateData.username);
                if (existingUser && existingUser.id !== userId) {
                    throw new ValidationError('Користувач з таким іменем вже існує');
                }
            }
            
            // Підготовка даних для оновлення
            const updateFields = {};
            if (updateData.username !== undefined) updateFields.username = updateData.username;
            if (updateData.email !== undefined) updateFields.email = updateData.email;
            if (updateData.phone !== undefined) updateFields.phone = updateData.phone;
            if (updateData.role !== undefined) updateFields.role = updateData.role;
            if (updateData.active !== undefined) updateFields.active = updateData.active ? 1 : 0;
            
            // Оновлюємо користувача
            const updatedUser = await this.userQueries.update(userId, updateFields);
            
            await this._logUserAudit(userId, 'USER_UPDATED', {
                username: user.username,
                updated_fields: Object.keys(updateFields),
                updated_by: adminId
            });
            
            console.log(`👤 Оновлено користувача: ${user.username} (ID: ${userId})`);
            
            return {
                id: userId,
                username: updateFields.username || user.username,
                email: updateFields.email || user.email,
                phone: updateFields.phone || user.phone,
                role: updateFields.role || user.role,
                active: updateFields.active !== undefined ? updateFields.active : user.active,
                updated_at: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка оновлення користувача:', error);
            throw new DatabaseError(`Помилка оновлення користувача: ${error.message}`);
        }
    }
    
    /**
     * Видалення користувача
     */
    async deleteUser(userId, adminId) {
        this._checkInitialization();
        
        try {
            const user = await this.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError('Користувача не знайдено');
            }
            
            // Не дозволяємо видаляти системного адміністратора
            if (userId === 1) {
                throw new ValidationError('Неможливо видалити системного адміністратора');
            }
            
            // Видаляємо користувача
            await this.userQueries.delete(userId);
            
            await this._logUserAudit(userId, 'USER_DELETED', {
                username: user.username,
                deleted_by: adminId
            });
            
            console.log(`👤 Видалено користувача: ${user.username} (ID: ${userId})`);
            
            return true;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка видалення користувача:', error);
            throw new DatabaseError(`Помилка видалення користувача: ${error.message}`);
        }
    }

    /**
     * Логування подій аудиту користувача
     */
    async _logUserAudit(userId, action, details = {}) {
        try {
            if (this.auditQueries) {
                await this.auditQueries.logUserAction(userId, action, details);
            }
        } catch (error) {
            console.error('❌ Помилка логування аудиту:', error);
            // Не кидаємо помилку, щоб не перервати основну операцію
        }
    }

    /**
     * Логування подій безпеки
     */
    async _logSecurityEvent(eventType, userId, details = {}) {
        try {
            if (this.auditQueries) {
                await this.auditQueries.logSecurityEvent(eventType, userId, details);
            }
        } catch (error) {
            console.error('❌ Помилка логування події безпеки:', error);
            // Не кидаємо помилку, щоб не перервати основну операцію
        }
    }
}

// Експортуємо singleton instance
module.exports = new AuthService(); 