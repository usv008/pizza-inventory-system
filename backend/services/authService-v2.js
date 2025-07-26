/**
 * Auth Service v2 - з підтримкою Supabase та SQLite
 * Використовує userService-v2 для універсальної роботи з БД
 */

const bcrypt = require('bcrypt');
const { NotFoundError, DatabaseError, ValidationError } = require('../middleware/errors/AppError');
const userServiceV2 = require('./userService-v2');

// Залежності для операційного логування
let sessionQueries = null;
let auditQueries = null;

/**
 * Ініціалізація залежностей
 */
function initialize(dependencies) {
    sessionQueries = dependencies.sessionQueries;
    auditQueries = dependencies.auditQueries;
    
    // Ініціалізуємо userService-v2
    userServiceV2.initialize(dependencies);
}

const saltRounds = 10;

/**
 * Отримати всіх активних користувачів для dropdown
 */
async function getActiveUsers() {
    try {
        const users = await userServiceV2.getAllUsers({ includeInactive: false });
        console.log(`👥 Отримано ${users.length} активних користувачів для вибору`);
        
        return users.map(user => ({
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
 * Отримати всіх користувачів для dropdown (старий метод)
 */
async function getAllUsers() {
    return await getActiveUsers();
}

/**
 * Аутентифікація користувача
 */
async function login(username, password, sessionInfo = {}) {
    try {
        // Знаходимо користувача за username (включаючи пароль)
        const user = await userServiceV2.getUserByUsername(username, true);
        
        if (!user) {
            await _logSecurityEvent('LOGIN_FAILED', null, {
                username,
                reason: 'User not found',
                ...sessionInfo
            });
            throw new NotFoundError('Користувача не знайдено');
        }

        const useSupabase = process.env.USE_SUPABASE === 'true';
        const activeValue = useSupabase ? true : 1;
        const firstLoginValue = useSupabase ? true : 1;

        if (user.active !== activeValue) {
            await _logSecurityEvent('LOGIN_FAILED', user.id, {
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
                await _logSecurityEvent('LOGIN_FAILED', user.id, {
                    username,
                    reason: 'Invalid password',
                    ...sessionInfo
                });
                throw new ValidationError('Неправильний пароль');
            }
        } else {
            // Для першого входу, коли немає пароля
            if (user.first_login !== firstLoginValue) {
                await _logSecurityEvent('LOGIN_FAILED', user.id, {
                    username,
                    reason: 'No password set',
                    ...sessionInfo
                });
                throw new ValidationError('Пароль не встановлений');
            }
        }

        // Успішний вхід
        await _logSecurityEvent('LOGIN_SUCCESS', user.id, {
            username,
            ...sessionInfo
        });

        await _logUserAudit(user.id, 'LOGIN', {
            username,
            first_login: user.first_login,
            ...sessionInfo
        });

        console.log(`🔐 Успішний вхід користувача: ${username} (ID: ${user.id})`);

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {}),
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
async function setFirstTimePassword(userId, password, sessionInfo = {}) {
    try {
        const user = await userServiceV2.getUserByUsername(null, true); // Отримуємо через getUserById
        const fullUser = await getUserByIdWithPassword(userId);
        if (!fullUser) {
            throw new NotFoundError('Користувача не знайдено');
        }

        const useSupabase = process.env.USE_SUPABASE === 'true';
        const firstLoginValue = useSupabase ? true : 1;

        if (fullUser.first_login !== firstLoginValue) {
            throw new ValidationError('Пароль вже встановлено');
        }

        // Встановлюємо пароль через userService-v2
        await userServiceV2.changeUserPassword(userId, password, userId);

        await _logUserAudit(userId, 'SET_PASSWORD', {
            username: fullUser.username,
            ...sessionInfo
        });

        console.log(`🔐 Встановлено пароль для користувача: ${fullUser.username} (ID: ${userId})`);

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
async function changeOwnPassword(userId, currentPassword, newPassword, sessionInfo = {}) {
    try {
        const user = await getUserByIdWithPassword(userId);
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

        // Змінюємо пароль через userService-v2
        await userServiceV2.changeUserPassword(userId, newPassword, userId);

        await _logUserAudit(userId, 'PASSWORD_CHANGED', {
            username: user.username,
            ...sessionInfo
        });

        await _logSecurityEvent('PASSWORD_CHANGED', userId, {
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
async function changePasswordByAdmin(userId, newPassword, adminId, sessionInfo = {}) {
    try {
        const user = await userServiceV2.getUserById(userId);
        if (!user) {
            throw new NotFoundError('Користувача не знайдено');
        }

        const admin = await userServiceV2.getUserById(adminId);
        if (!admin) {
            throw new NotFoundError('Адміністратора не знайдено');
        }

        // Перевіряємо права адміністратора
        const adminPermissions = admin.permissions || {};
        if (!adminPermissions.admin?.all_rights) {
            throw new ValidationError('Недостатньо прав для зміни пароля');
        }

        // Змінюємо пароль через userService-v2
        await userServiceV2.changeUserPassword(userId, newPassword, adminId);

        await _logUserAudit(userId, 'PASSWORD_CHANGED_BY_ADMIN', {
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
async function validateSession(sessionId) {
    try {
        if (!sessionQueries) {
            return null;
        }

        const session = await sessionQueries.getById(sessionId);
        
        if (!session) {
            return null;
        }

        // Перевіряємо чи сесія не закінчилась
        if (new Date() > new Date(session.expires_at)) {
            await sessionQueries.deactivate(sessionId);
            return null;
        }

        // Перевіряємо чи користувач активний
        const user = await userServiceV2.getUserById(session.user_id);
        if (!user) {
            await sessionQueries.deactivate(sessionId);
            return null;
        }

        const useSupabase = process.env.USE_SUPABASE === 'true';
        const activeValue = useSupabase ? true : 1;
        
        if (user.active !== activeValue) {
            await sessionQueries.deactivate(sessionId);
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions || {},
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
async function logout(sessionId, userId, sessionInfo = {}) {
    try {
        if (sessionId && sessionQueries) {
            await sessionQueries.deactivate(sessionId);
        }

        if (userId) {
            const user = await userServiceV2.getUserById(userId);
            if (user) {
                await _logUserAudit(userId, 'LOGOUT', {
                    username: user.username,
                    session_id: sessionId,
                    ...sessionInfo
                });

                await _logSecurityEvent('LOGOUT', userId, {
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
async function cleanupExpiredSessions() {
    try {
        if (!sessionQueries) {
            return 0;
        }

        const result = await sessionQueries.cleanupExpired();
        console.log(`🧹 Очищено ${result.changes} застарілих сесій`);
        return result.changes;
    } catch (error) {
        console.error('❌ Помилка очищення сесій:', error);
        throw new DatabaseError(`Помилка очищення сесій: ${error.message}`);
    }
}

/**
 * Логування подій аудиту користувача
 */
async function _logUserAudit(userId, action, details = {}) {
    try {
        if (auditQueries) {
            await auditQueries.logUserAction(userId, action, details);
        }
    } catch (error) {
        console.error('❌ Помилка логування аудиту:', error);
        // Не кидаємо помилку, щоб не перервати основну операцію
    }
}

/**
 * Логування подій безпеки
 */
async function _logSecurityEvent(eventType, userId, details = {}) {
    try {
        if (auditQueries) {
            await auditQueries.logSecurityEvent(eventType, userId, details);
        }
    } catch (error) {
        console.error('❌ Помилка логування події безпеки:', error);
        // Не кидаємо помилку, щоб не перервати основну операцію
    }
}

/**
 * Допоміжна функція для отримання користувача з паролем
 */
async function getUserByIdWithPassword(userId) {
    // Використовуємо метод userService-v2 з включеним паролем
    const { createDatabaseAdapter } = require('../config/database');
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select('*', { where: { id: userId }, limit: 1 });
        
        return users[0] || null;
    } catch (error) {
        console.error(`❌ Помилка отримання користувача з паролем ${userId}:`, error);
        throw new DatabaseError('Помилка отримання даних користувача');
    } finally {
        adapter.close();
    }
}

module.exports = {
    initialize,
    getActiveUsers,
    getAllUsers,
    login,
    setFirstTimePassword,
    changeOwnPassword,
    changePasswordByAdmin,
    validateSession,
    logout,
    cleanupExpiredSessions
};