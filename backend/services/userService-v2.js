/**
 * User Service v2 - з підтримкою Supabase та SQLite
 * Використовує DatabaseAdapter для універсальної роботи з БД
 */

const bcrypt = require('bcrypt');
const { NotFoundError, DatabaseError, ValidationError } = require('../middleware/errors/AppError');
const { createDatabaseAdapter } = require('../config/database');

// Залежності для операційного логування
let auditQueries = null;

/**
 * Ініціалізація залежностей
 */
function initialize(dependencies) {
    auditQueries = dependencies.auditQueries;
}

// Доступні ролі в системі
const availableRoles = [
    'ДИРЕКТОР',
    'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ',
    'БУХГАЛТЕР',
    'ПАКУВАЛЬНИК',
    'КОМІРНИК',
    'МЕНЕДЖЕР_З_ПРОДАЖІВ'
];

/**
 * Отримати всіх користувачів
 */
async function getAllUsers(options = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        const { includeInactive = false } = options;
        const users = await adapter
            .table('users')
            .select('*', { orderBy: { column: 'username', direction: 'asc' } });
        
        // Фільтруємо неактивних користувачів якщо потрібно
        let filteredUsers = users;
        if (!includeInactive) {
            const useSupabase = process.env.USE_SUPABASE === 'true';
            const activeValue = useSupabase ? true : 1;
            filteredUsers = users.filter(user => user.active === activeValue);
        }
        
        // Видаляємо паролі з результату
        return filteredUsers.map(user => sanitizeUser(user));
    } catch (error) {
        console.error('❌ Помилка отримання користувачів:', error);
        throw new DatabaseError('Помилка отримання списку користувачів');
    } finally {
        adapter.close();
    }
}

/**
 * Отримати користувача за ID
 */
async function getUserById(userId) {
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select('*', { where: { id: userId }, limit: 1 });
        
        const user = users[0];
        
        if (!user) {
            throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
        }
        
        return sanitizeUser(user);
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error(`❌ Помилка отримання користувача ${userId}:`, error);
        throw new DatabaseError('Помилка отримання даних користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Отримати користувача за username (включаючи пароль для автентифікації)
 */
async function getUserByUsername(username, includePassword = false) {
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select('*', { where: { username }, limit: 1 });
        
        const user = users[0];
        
        if (!user) {
            return null;
        }
        
        // Якщо потрібен пароль (для автентифікації), не очищаємо його
        return includePassword ? user : sanitizeUser(user);
    } catch (error) {
        console.error(`❌ Помилка отримання користувача ${username}:`, error);
        throw new DatabaseError('Помилка отримання даних користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Отримати користувача за email
 */
async function getUserByEmail(email) {
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select('*', { where: { email }, limit: 1 });
        
        return users[0] || null;
    } catch (error) {
        console.error(`❌ Помилка отримання користувача за email ${email}:`, error);
        throw new DatabaseError('Помилка пошуку користувача за email');
    } finally {
        adapter.close();
    }
}

/**
 * Створити нового користувача
 */
async function createUser(userData, createdBy) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Валідація даних
        validateUserData(userData);
        
        const { username, email, phone, role, permissions, password } = userData;
        
        // Перевірка чи користувач вже існує
        const existingUser = await getUserByUsername(username);
        if (existingUser) {
            throw new ValidationError(`Користувач з username ${username} вже існує`);
        }
        
        // Перевірка email якщо надано
        if (email) {
            const existingEmail = await getUserByEmail(email);
            if (existingEmail) {
                throw new ValidationError(`Користувач з email ${email} вже існує`);
            }
        }
        
        // Хешування пароля
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }
        
        // Підготовка даних для створення (адаптуємо до структури БД)
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const userCreateData = {
            username,
            email: email || null,
            phone: phone || null,
            password_hash: passwordHash,
            role,
            permissions: JSON.stringify(permissions || {}),
            first_login: useSupabase ? (passwordHash ? false : true) : (passwordHash ? 0 : 1),
            active: useSupabase ? true : 1,
            created_by: createdBy,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Створення користувача
        const result = await adapter.table('users').insert(userCreateData);
        const userId = result.id;
        
        // Логування в аудит
        if (auditQueries) {
            try {
                await auditQueries.log({
                    user_id: createdBy,
                    action: 'CREATE_USER',
                    resource_type: 'USER',
                    resource_id: userId,
                    details: JSON.stringify({
                        username,
                        role,
                        email: email || null
                    })
                });
            } catch (logError) {
                console.error('Помилка логування створення користувача:', logError);
            }
        }
        
        // Отримуємо створеного користувача
        const newUser = await getUserById(userId);
        
        console.log(`✅ Створено користувача: ${username} (ID: ${userId})`);
        return newUser;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('❌ Помилка створення користувача:', error);
        throw new DatabaseError('Помилка створення користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Оновити дані користувача
 */
async function updateUser(userId, updateData, updatedBy) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Перевірка існування користувача
        const existingUser = await getUserByUserIdRaw(userId); // Отримуємо сирі дані
        if (!existingUser) {
            throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
        }
        
        // Валідація даних оновлення
        validateUpdateData(updateData);
        
        const { username, email, phone, role, permissions, active } = updateData;
        
        // Перевірка унікальності username якщо змінюється
        if (username && username !== existingUser.username) {
            const existingUsername = await getUserByUsername(username);
            if (existingUsername) {
                throw new ValidationError(`Користувач з username ${username} вже існує`);
            }
        }
        
        // Перевірка унікальності email якщо змінюється
        if (email && email !== existingUser.email) {
            const existingEmail = await getUserByEmail(email);
            if (existingEmail) {
                throw new ValidationError(`Користувач з email ${email} вже існує`);
            }
        }
        
        // Підготовка даних для оновлення (адаптуємо до структури БД)
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const userUpdateData = {
            updated_at: new Date().toISOString()
        };
        
        if (username !== undefined) userUpdateData.username = username;
        if (email !== undefined) userUpdateData.email = email;
        if (phone !== undefined) userUpdateData.phone = phone;
        if (role !== undefined) userUpdateData.role = role;
        if (permissions !== undefined) userUpdateData.permissions = JSON.stringify(permissions);
        if (active !== undefined) {
            // Конвертуємо boolean в число для SQLite
            userUpdateData.active = useSupabase ? (active === true || active === 1) : (active === true || active === 1 ? 1 : 0);
        }
        
        // Оновлення користувача
        await adapter.table('users').update(userUpdateData, { id: userId });
        
        // Очищення кешу прав користувача (якщо доступно)
        try {
            const permissionService = require('./permissionService');
            permissionService.clearUserCache(userId);
        } catch (err) {
            // Ігноруємо помилку якщо permissionService не доступний
        }
        
        // Логування в аудит
        if (auditQueries) {
            try {
                await auditQueries.log({
                    user_id: updatedBy,
                    action: 'UPDATE_USER',
                    resource_type: 'USER',
                    resource_id: userId,
                    details: JSON.stringify({
                        updated_fields: Object.keys(userUpdateData),
                        old_username: existingUser.username,
                        new_username: username || existingUser.username
                    })
                });
            } catch (logError) {
                console.error('Помилка логування оновлення користувача:', logError);
            }
        }
        
        // Отримуємо оновленого користувача
        const updatedUser = await getUserById(userId);
        
        console.log(`✅ Оновлено користувача: ${updatedUser.username} (ID: ${userId})`);
        return updatedUser;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error(`❌ Помилка оновлення користувача ${userId}:`, error);
        throw new DatabaseError('Помилка оновлення користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Видалити (деактивувати) користувача
 */
async function deleteUser(userId, deletedBy) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Перевірка існування користувача
        const existingUser = await getUserByUserIdRaw(userId);
        if (!existingUser) {
            throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
        }
        
        // Не можна видалити самого себе
        if (userId === deletedBy) {
            throw new ValidationError('Не можна видалити самого себе');
        }
        
        // Деактивація користувача
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const updateData = {
            active: useSupabase ? false : 0,
            updated_at: new Date().toISOString()
        };
        
        await adapter.table('users').update(updateData, { id: userId });
        
        // Очищення кешу прав користувача (якщо доступно)
        try {
            const permissionService = require('./permissionService');
            permissionService.clearUserCache(userId);
        } catch (err) {
            // Ігноруємо помилку якщо permissionService не доступний
        }
        
        // Логування в аудит
        if (auditQueries) {
            try {
                await auditQueries.log({
                    user_id: deletedBy,
                    action: 'DELETE_USER',
                    resource_type: 'USER',
                    resource_id: userId,
                    details: JSON.stringify({
                        deleted_username: existingUser.username
                    })
                });
            } catch (logError) {
                console.error('Помилка логування видалення користувача:', logError);
            }
        }
        
        console.log(`✅ Видалено користувача: ${existingUser.username} (ID: ${userId})`);
        return true;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error(`❌ Помилка видалення користувача ${userId}:`, error);
        throw new DatabaseError('Помилка видалення користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Змінити пароль користувача
 */
async function changeUserPassword(userId, newPassword, changedBy) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Перевірка існування користувача
        const existingUser = await getUserByUserIdRaw(userId);
        if (!existingUser) {
            throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
        }
        
        // Валідація пароля
        if (!newPassword || newPassword.length < 6) {
            throw new ValidationError('Пароль повинен містити мінімум 6 символів');
        }
        
        // Хешування нового пароля
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Оновлення пароля
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const updateData = {
            password_hash: hashedPassword,
            first_login: useSupabase ? false : 0, // Скидаємо прапорець першого входу
            updated_at: new Date().toISOString()
        };
        
        await adapter.table('users').update(updateData, { id: userId });
        
        // Логування в аудит
        if (auditQueries) {
            try {
                await auditQueries.log({
                    user_id: changedBy,
                    action: 'CHANGE_PASSWORD',
                    resource_type: 'USER',
                    resource_id: userId,
                    details: JSON.stringify({
                        target_username: existingUser.username,
                        changed_by_admin: changedBy !== userId
                    })
                });
            } catch (logError) {
                console.error('Помилка логування зміни пароля:', logError);
            }
        }
        
        console.log(`✅ Змінено пароль користувача: ${existingUser.username} (ID: ${userId})`);
        return true;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error(`❌ Помилка зміни пароля користувача ${userId}:`, error);
        throw new DatabaseError('Помилка зміни пароля користувача');
    } finally {
        adapter.close();
    }
}

/**
 * Отримати статистику користувачів
 */
async function getUserStats() {
    const adapter = createDatabaseAdapter();
    
    try {
        const allUsers = await adapter.table('users').select('*');
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const activeValue = useSupabase ? true : 1;
        const inactiveValue = useSupabase ? false : 0;
        const firstLoginValue = useSupabase ? true : 1;
        
        const stats = {
            total_users: allUsers.length,
            active_users: allUsers.filter(u => u.active === activeValue).length,
            inactive_users: allUsers.filter(u => u.active === inactiveValue).length,
            admin_users: allUsers.filter(u => u.role === 'ДИРЕКТОР' && u.active === activeValue).length,
            first_login_pending: allUsers.filter(u => u.first_login === firstLoginValue).length,
            by_role: {}
        };
        
        // Статистика за ролями
        availableRoles.forEach(role => {
            stats.by_role[role] = allUsers.filter(u => u.role === role && u.active === activeValue).length;
        });
        
        return stats;
    } catch (error) {
        console.error('❌ Помилка отримання статистики користувачів:', error);
        throw new DatabaseError('Помилка отримання статистики користувачів');
    } finally {
        adapter.close();
    }
}

/**
 * Отримати доступні ролі
 */
function getAvailableRoles() {
    return availableRoles.map(role => ({
        value: role,
        label: getRoleLabel(role)
    }));
}

/**
 * Отримати локалізовану назву ролі
 */
function getRoleLabel(role) {
    const roleLabels = {
        'ДИРЕКТОР': 'Директор',
        'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ': 'Завідуючий виробництвом',
        'БУХГАЛТЕР': 'Бухгалтер',
        'ПАКУВАЛЬНИК': 'Пакувальник',
        'КОМІРНИК': 'Комірник',
        'МЕНЕДЖЕР_З_ПРОДАЖІВ': 'Менеджер з продажів'
    };
    
    return roleLabels[role] || role;
}

/**
 * Валідація даних користувача
 */
function validateUserData(userData) {
    const { username, email, role, password } = userData;
    
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        throw new ValidationError('Ім\'я користувача є обов\'язковим');
    }
    
    if (username.length < 3) {
        throw new ValidationError('Ім\'я користувача повинно містити мінімум 3 символи');
    }
    
    // Заборона створення користувача з ім'ям admin
    if (username.toLowerCase() === 'admin') {
        throw new ValidationError('Ім\'я користувача "admin" заборонено. Використовуйте роль "Директор" для адміністративних прав');
    }
    
    if (!role || !availableRoles.includes(role)) {
        throw new ValidationError('Некоректна роль користувача');
    }
    
    if (password && password.length < 6) {
        throw new ValidationError('Пароль повинен містити мінімум 6 символів');
    }
    
    if (email && !isValidEmail(email)) {
        throw new ValidationError('Некоректний формат email');
    }
}

/**
 * Валідація даних оновлення
 */
function validateUpdateData(updateData) {
    const { username, email, role, active } = updateData;
    
    if (username !== undefined) {
        if (typeof username !== 'string' || username.trim().length === 0) {
            throw new ValidationError('Ім\'я користувача не може бути порожнім');
        }
        if (username.length < 3) {
            throw new ValidationError('Ім\'я користувача повинно містити мінімум 3 символи');
        }
        // Заборона зміни імені на admin
        if (username.toLowerCase() === 'admin') {
            throw new ValidationError('Ім\'я користувача "admin" заборонено. Використовуйте роль "Директор" для адміністративних прав');
        }
    }
    
    if (role !== undefined && !availableRoles.includes(role)) {
        throw new ValidationError('Некоректна роль користувача');
    }
    
    if (email !== undefined && email !== null && !isValidEmail(email)) {
        throw new ValidationError('Некоректний формат email');
    }
    
    if (active !== undefined && ![0, 1, true, false].includes(active)) {
        throw new ValidationError('Статус активності повинен бути 0, 1, true або false');
    }
}

/**
 * Перевірка валідності email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Очищення користувача від чутливих даних
 */
function sanitizeUser(user) {
    const { password_hash, ...sanitizedUser } = user;
    
    // Парсимо permissions якщо це строка
    if (typeof sanitizedUser.permissions === 'string') {
        try {
            sanitizedUser.permissions = JSON.parse(sanitizedUser.permissions);
        } catch (error) {
            sanitizedUser.permissions = {};
        }
    }
    
    return sanitizedUser;
}

/**
 * Отримати користувача за ID (включаючи пароль) - для внутрішнього використання
 */
async function getUserByUserIdRaw(userId) {
    const adapter = createDatabaseAdapter();
    
    try {
        const users = await adapter
            .table('users')
            .select('*', { where: { id: userId }, limit: 1 });
        
        return users[0] || null;
    } catch (error) {
        console.error(`❌ Помилка отримання сирих даних користувача ${userId}:`, error);
        throw new DatabaseError('Помилка отримання даних користувача');
    } finally {
        adapter.close();
    }
}

module.exports = {
    initialize,
    getAllUsers,
    getUserById,
    getUserByUsername,
    getUserByEmail,
    createUser,
    updateUser,
    deleteUser,
    changeUserPassword,
    getUserStats,
    getAvailableRoles,
    getRoleLabel,
    validateUserData,
    validateUpdateData,
    isValidEmail,
    sanitizeUser
};