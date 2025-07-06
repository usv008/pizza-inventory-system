const bcrypt = require('bcrypt');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для управління користувачами
 * Реалізує CRUD операції для користувачів системи
 */
class UserService {
    constructor() {
        this.userQueries = null;
        this.auditQueries = null;
        this.initialized = false;
        
        // Доступні ролі в системі
        this.availableRoles = [
            'ДИРЕКТОР',
            'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ',
            'БУХГАЛТЕР',
            'ПАКУВАЛЬНИК',
            'КОМІРНИК',
            'МЕНЕДЖЕР_З_ПРОДАЖІВ'
        ];
    }

    /**
     * Ініціалізація сервісу з залежностями
     * @param {Object} dependencies - залежності сервісу
     */
    initialize(dependencies) {
        const { userQueries, auditQueries } = dependencies;
        
        if (!userQueries || !auditQueries) {
            throw new Error('UserService потребує userQueries та auditQueries');
        }
        
        this.userQueries = userQueries;
        this.auditQueries = auditQueries;
        this.initialized = true;
        
        console.log('✅ UserService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації сервісу
     */
    checkInitialization() {
        if (!this.initialized) {
            throw new Error('UserService не ініціалізовано');
        }
    }

    /**
     * Отримати всіх користувачів
     * @param {Object} options - опції фільтрації
     * @returns {Array} масив користувачів
     */
    async getAllUsers(options = {}) {
        this.checkInitialization();
        
        try {
            const { includeInactive = false } = options;
            
            const users = await this.userQueries.getAll();
            
            // Фільтруємо неактивних користувачів якщо потрібно
            let filteredUsers = users;
            if (!includeInactive) {
                filteredUsers = users.filter(user => user.active === 1);
            }
            
            // Видаляємо паролі з результату
            return filteredUsers.map(user => this.sanitizeUser(user));
        } catch (error) {
            console.error('❌ Помилка отримання користувачів:', error);
            throw new DatabaseError('Помилка отримання списку користувачів');
        }
    }

    /**
     * Отримати користувача за ID
     * @param {number} userId - ID користувача
     * @returns {Object} дані користувача
     */
    async getUserById(userId) {
        this.checkInitialization();
        
        try {
            const user = await this.userQueries.getById(userId);
            
            if (!user) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            return this.sanitizeUser(user);
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка отримання користувача ${userId}:`, error);
            throw new DatabaseError('Помилка отримання даних користувача');
        }
    }

    /**
     * Отримати користувача за username
     * @param {string} username - ім'я користувача
     * @returns {Object} дані користувача
     */
    async getUserByUsername(username) {
        this.checkInitialization();
        
        try {
            const user = await this.userQueries.getByUsername(username);
            
            if (!user) {
                throw new NotFoundError(`Користувача з username ${username} не знайдено`);
            }
            
            return this.sanitizeUser(user);
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка отримання користувача ${username}:`, error);
            throw new DatabaseError('Помилка отримання даних користувача');
        }
    }

    /**
     * Створити нового користувача
     * @param {Object} userData - дані користувача
     * @param {number} createdBy - ID користувача який створює
     * @returns {Object} створений користувач
     */
    async createUser(userData, createdBy) {
        this.checkInitialization();
        
        try {
            // Валідація даних
            this.validateUserData(userData);
            
            const { username, email, phone, role, permissions, password } = userData;
            
            // Перевірка чи користувач вже існує
            const existingUser = await this.userQueries.getByUsername(username);
            if (existingUser) {
                throw new ValidationError(`Користувач з username ${username} вже існує`);
            }
            
            // Перевірка email якщо надано
            if (email) {
                const existingEmail = await this.userQueries.getByEmail(email);
                if (existingEmail) {
                    throw new ValidationError(`Користувач з email ${email} вже існує`);
                }
            }
            
            // Хешування пароля
            let passwordHash = null;
            if (password) {
                passwordHash = await bcrypt.hash(password, 10);
            }
            
            // Підготовка даних для створення
            const userCreateData = {
                username,
                email: email || null,
                phone: phone || null,
                password_hash: passwordHash,
                role,
                permissions: JSON.stringify(permissions || {}),
                first_login: passwordHash ? 0 : 1, // Якщо пароль встановлено, то не перший вхід
                active: 1,
                created_by: createdBy
            };
            
            // Створення користувача
            const userId = await this.userQueries.create(userCreateData);
            
            // Логування в аудит
            await this.auditQueries.log({
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
            
            // Отримуємо створеного користувача
            const newUser = await this.getUserById(userId);
            
            console.log(`✅ Створено користувача: ${username} (ID: ${userId})`);
            return newUser;
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Помилка створення користувача:', error);
            throw new DatabaseError('Помилка створення користувача');
        }
    }

    /**
     * Оновити дані користувача
     * @param {number} userId - ID користувача
     * @param {Object} updateData - дані для оновлення
     * @param {number} updatedBy - ID користувача який оновлює
     * @returns {Object} оновлений користувач
     */
    async updateUser(userId, updateData, updatedBy) {
        this.checkInitialization();
        
        try {
            // Перевірка існування користувача
            const existingUser = await this.userQueries.getById(userId);
            if (!existingUser) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            // Валідація даних оновлення
            this.validateUpdateData(updateData);
            
            const { username, email, phone, role, permissions, active } = updateData;
            
            // Перевірка унікальності username якщо змінюється
            if (username && username !== existingUser.username) {
                const existingUsername = await this.userQueries.getByUsername(username);
                if (existingUsername) {
                    throw new ValidationError(`Користувач з username ${username} вже існує`);
                }
            }
            
            // Перевірка унікальності email якщо змінюється
            if (email && email !== existingUser.email) {
                const existingEmail = await this.userQueries.getByEmail(email);
                if (existingEmail) {
                    throw new ValidationError(`Користувач з email ${email} вже існує`);
                }
            }
            
            // Підготовка даних для оновлення
            const userUpdateData = {};
            
            if (username !== undefined) userUpdateData.username = username;
            if (email !== undefined) userUpdateData.email = email;
            if (phone !== undefined) userUpdateData.phone = phone;
            if (role !== undefined) userUpdateData.role = role;
            if (permissions !== undefined) userUpdateData.permissions = JSON.stringify(permissions);
            if (active !== undefined) {
                // Конвертуємо boolean в число для SQLite
                userUpdateData.active = active === true || active === 1 ? 1 : 0;
            }
            
            // Оновлення користувача
            await this.userQueries.update(userId, userUpdateData);
            
            // Очищення кешу прав користувача
            const permissionService = require('./permissionService');
            permissionService.clearUserCache(userId);
            
            // Логування в аудит
            await this.auditQueries.log({
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
            
            // Отримуємо оновленого користувача
            const updatedUser = await this.getUserById(userId);
            
            console.log(`✅ Оновлено користувача: ${updatedUser.username} (ID: ${userId})`);
            return updatedUser;
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення користувача ${userId}:`, error);
            throw new DatabaseError('Помилка оновлення користувача');
        }
    }

    /**
     * Видалити (деактивувати) користувача
     * @param {number} userId - ID користувача
     * @param {number} deletedBy - ID користувача який видаляє
     */
    async deleteUser(userId, deletedBy) {
        this.checkInitialization();
        
        try {
            // Перевірка існування користувача
            const existingUser = await this.userQueries.getById(userId);
            if (!existingUser) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            // Не можна видалити самого себе
            if (userId === deletedBy) {
                throw new ValidationError('Не можна видалити самого себе');
            }
            
            // Деактивація користувача
            await this.userQueries.update(userId, { active: 0 });
            
            // Очищення кешу прав користувача
            const permissionService = require('./permissionService');
            permissionService.clearUserCache(userId);
            
            // Логування в аудит
            await this.auditQueries.log({
                user_id: deletedBy,
                action: 'DELETE_USER',
                resource_type: 'USER',
                resource_id: userId,
                details: JSON.stringify({
                    deleted_username: existingUser.username
                })
            });
            
            console.log(`✅ Видалено користувача: ${existingUser.username} (ID: ${userId})`);
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка видалення користувача ${userId}:`, error);
            throw new DatabaseError('Помилка видалення користувача');
        }
    }

    /**
     * Змінити пароль користувача
     * @param {number} userId - ID користувача
     * @param {string} newPassword - новий пароль
     * @param {number} changedBy - ID користувача який змінює пароль
     */
    async changeUserPassword(userId, newPassword, changedBy) {
        this.checkInitialization();
        
        try {
            // Перевірка існування користувача
            const existingUser = await this.userQueries.getById(userId);
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
            await this.userQueries.update(userId, { 
                password_hash: hashedPassword,
                first_login: 0 // Скидаємо прапорець першого входу
            });
            
            // Логування в аудит
            await this.auditQueries.log({
                user_id: changedBy,
                action: 'CHANGE_PASSWORD',
                resource_type: 'USER',
                resource_id: userId,
                details: JSON.stringify({
                    target_username: existingUser.username,
                    changed_by_admin: changedBy !== userId
                })
            });
            
            console.log(`✅ Змінено пароль користувача: ${existingUser.username} (ID: ${userId})`);
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка зміни пароля користувача ${userId}:`, error);
            throw new DatabaseError('Помилка зміни пароля користувача');
        }
    }

    /**
     * Отримати статистику користувачів
     * @returns {Object} статистика користувачів
     */
    async getUserStats() {
        this.checkInitialization();
        
        try {
            const allUsers = await this.userQueries.getAll();
            
            const stats = {
                total_users: allUsers.length,
                active_users: allUsers.filter(u => u.active === 1).length,
                inactive_users: allUsers.filter(u => u.active === 0).length,
                admin_users: allUsers.filter(u => u.role === 'ДИРЕКТОР' && u.active === 1).length,
                first_login_pending: allUsers.filter(u => u.first_login === 1).length,
                by_role: {}
            };
            
            // Статистика за ролями
            this.availableRoles.forEach(role => {
                stats.by_role[role] = allUsers.filter(u => u.role === role && u.active === 1).length;
            });
            
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики користувачів:', error);
            throw new DatabaseError('Помилка отримання статистики користувачів');
        }
    }

    /**
     * Отримати доступні ролі
     * @returns {Array} масив доступних ролей
     */
    getAvailableRoles() {
        return this.availableRoles.map(role => ({
            value: role,
            label: this.getRoleLabel(role)
        }));
    }

    /**
     * Отримати локалізовану назву ролі
     * @param {string} role - роль
     * @returns {string} локалізована назва
     */
    getRoleLabel(role) {
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
     * @param {Object} userData - дані користувача
     */
    validateUserData(userData) {
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
        
        if (!role || !this.availableRoles.includes(role)) {
            throw new ValidationError('Некоректна роль користувача');
        }
        
        if (password && password.length < 6) {
            throw new ValidationError('Пароль повинен містити мінімум 6 символів');
        }
        
        if (email && !this.isValidEmail(email)) {
            throw new ValidationError('Некоректний формат email');
        }
    }

    /**
     * Валідація даних оновлення
     * @param {Object} updateData - дані для оновлення
     */
    validateUpdateData(updateData) {
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
        
        if (role !== undefined && !this.availableRoles.includes(role)) {
            throw new ValidationError('Некоректна роль користувача');
        }
        
        if (email !== undefined && email !== null && !this.isValidEmail(email)) {
            throw new ValidationError('Некоректний формат email');
        }
        
        if (active !== undefined && ![0, 1, true, false].includes(active)) {
            throw new ValidationError('Статус активності повинен бути 0, 1, true або false');
        }
    }

    /**
     * Перевірка валідності email
     * @param {string} email - email адреса
     * @returns {boolean} чи валідний email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Очищення користувача від чутливих даних
     * @param {Object} user - користувач
     * @returns {Object} очищений користувач
     */
    sanitizeUser(user) {
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
}

module.exports = new UserService(); 