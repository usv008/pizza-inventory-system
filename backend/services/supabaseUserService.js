require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для управління користувачами через Supabase
 * Реалізує CRUD операції для користувачів системи
 */
class SupabaseUserService {
    constructor() {
        this.supabase = null;
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
        console.log('✅ SupabaseUserService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації сервісу
     */
    checkInitialization() {
        if (!this.initialized || !this.supabase) {
            throw new DatabaseError('SupabaseUserService не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всіх користувачів
     * @param {Object} options - опції фільтрації
     * @returns {Array} масив користувачів
     */
    async getAllUsers(options = {}) {
        console.log('🔍 [DEBUG] SupabaseUserService.getAllUsers called with options:', options);
        this.checkInitialization();
        
        try {
            const { includeInactive = false } = options;
            
            let query = this.supabase
                .from('users')
                .select('*');
            
            // Фільтруємо неактивних користувачів якщо потрібно
            if (!includeInactive) {
                query = query.eq('is_active', true);
            }
            
            const { data: users, error } = await query;
            console.log('🔍 [DEBUG] Supabase query result:', { users: users?.length, error });
            
            if (error) {
                console.error('❌ Supabase помилка при отриманні користувачів:', error);
                throw new DatabaseError(`Помилка отримання користувачів: ${error.message}`);
            }
            
            // Адаптуємо до формату SQLite для сумісності
            const adaptedUsers = users.map(user => this.adaptUserToSQLiteFormat(user));
            console.log('🔍 [DEBUG] Adapted users count:', adaptedUsers.length);
            return adaptedUsers;
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
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
            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error || !user) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            return this.sanitizeUser(this.adaptUserToSQLiteFormat(user));
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка отримання користувача ${userId}:`, error);
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
            
            const { username, last_name, email, phone, role, permissions, password } = userData;
            
            // Перевірка чи користувач вже існує
            const { data: existingUser } = await this.supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();
                
            if (existingUser) {
                throw new ValidationError(`Користувач з username ${username} вже існує`);
            }
            
            // Перевірка email якщо надано
            if (email) {
                const { data: existingEmail } = await this.supabase
                    .from('users')
                    .select('id')
                    .eq('email', email)
                    .single();
                    
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
                last_name: last_name || null,
                email: email || null,
                phone: phone || null,
                password_hash: passwordHash,
                role,
                permissions: permissions || {},
                first_login: passwordHash ? false : true,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Створення користувача
            const { data: newUser, error } = await this.supabase
                .from('users')
                .insert([userCreateData])
                .select()
                .single();
                
            if (error) {
                console.error('❌ Помилка створення користувача:', error);
                throw new DatabaseError(`Помилка створення користувача: ${error.message}`);
            }
            
            console.log(`✅ Створено користувача: ${username} (ID: ${newUser.id})`);
            return this.sanitizeUser(this.adaptUserToSQLiteFormat(newUser));
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
            const { data: existingUser, error: fetchError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (fetchError || !existingUser) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            // Валідація даних для оновлення
            this.validateUpdateData(updateData);
            
            const updateFields = {};
            
            // Обробка основних полів
            if (updateData.username !== undefined) {
                // Перевірка унікальності username
                if (updateData.username !== existingUser.username) {
                    const { data: existingUserByUsername } = await this.supabase
                        .from('users')
                        .select('id')
                        .eq('username', updateData.username)
                        .single();
                        
                    if (existingUserByUsername && existingUserByUsername.id !== userId) {
                        throw new ValidationError(`Користувач з username ${updateData.username} вже існує`);
                    }
                }
                updateFields.username = updateData.username;
            }
            
            if (updateData.last_name !== undefined) {
                updateFields.last_name = updateData.last_name || null;
            }
            
            if (updateData.email !== undefined) {
                // Перевірка унікальності email
                if (updateData.email && updateData.email !== existingUser.email) {
                    const { data: existingUserByEmail } = await this.supabase
                        .from('users')
                        .select('id')
                        .eq('email', updateData.email)
                        .single();
                        
                    if (existingUserByEmail && existingUserByEmail.id !== userId) {
                        throw new ValidationError(`Користувач з email ${updateData.email} вже існує`);
                    }
                }
                updateFields.email = updateData.email || null;
            }
            
            if (updateData.phone !== undefined) {
                updateFields.phone = updateData.phone || null;
            }
            
            if (updateData.role !== undefined) {
                updateFields.role = updateData.role;
            }
            
            if (updateData.permissions !== undefined) {
                updateFields.permissions = updateData.permissions;
            }
            
            if (updateData.active !== undefined) {
                updateFields.is_active = updateData.active;
            }
            
            // Обробка зміни пароля
            if (updateData.password !== undefined) {
                const passwordHash = await bcrypt.hash(updateData.password, 10);
                updateFields.password_hash = passwordHash;
                updateFields.first_login = false; // Скидаємо first_login при зміні пароля
            }
            
            // Якщо немає полів для оновлення
            if (Object.keys(updateFields).length === 0) {
                return this.sanitizeUser(this.adaptUserToSQLiteFormat(existingUser));
            }
            
            // Додаємо час оновлення
            updateFields.updated_at = new Date().toISOString();
            
            // Оновлюємо користувача
            const { data: updatedUser, error } = await this.supabase
                .from('users')
                .update(updateFields)
                .eq('id', userId)
                .select()
                .single();
                
            if (error) {
                console.error('❌ Помилка оновлення користувача:', error);
                throw new DatabaseError(`Помилка оновлення користувача: ${error.message}`);
            }
            
            console.log(`✅ Оновлено користувача: ${updateData.username || existingUser.username} (ID: ${userId})`);
            return this.sanitizeUser(this.adaptUserToSQLiteFormat(updatedUser));
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення користувача ${userId}:`, error);
            throw new DatabaseError('Помилка оновлення користувача');
        }
    }

    /**
     * Видалити користувача
     * @param {number} userId - ID користувача
     * @param {number} deletedBy - ID користувача який видаляє
     * @returns {Object} результат видалення
     */
    async deleteUser(userId, deletedBy) {
        this.checkInitialization();
        
        try {
            // Перевірка існування користувача
            const { data: user, error: fetchError } = await this.supabase
                .from('users')
                .select('username')
                .eq('id', userId)
                .single();
                
            if (fetchError || !user) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            // Видалення користувача
            const { error } = await this.supabase
                .from('users')
                .delete()
                .eq('id', userId);
                
            if (error) {
                console.error('❌ Помилка видалення користувача:', error);
                throw new DatabaseError(`Помилка видалення користувача: ${error.message}`);
            }
            
            console.log(`✅ Видалено користувача: ${user.username} (ID: ${userId})`);
            return { success: true, message: 'Користувача успішно видалено' };
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка видалення користувача ${userId}:`, error);
            throw new DatabaseError('Помилка видалення користувача');
        }
    }

    /**
     * Отримати статистику користувачів
     * @returns {Object} статистика
     */
    async getUserStats() {
        this.checkInitialization();
        
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('role, is_active');
                
            if (error) {
                console.error('❌ Помилка отримання статистики:', error);
                throw new DatabaseError(`Помилка отримання статистики: ${error.message}`);
            }
            
            const totalUsers = users.length;
            const activeUsers = users.filter(u => u.is_active).length;
            const adminUsers = users.filter(u => u.role === 'ДИРЕКТОР').length;
            
            return {
                total_users: totalUsers,
                active_users: activeUsers,
                admin_users: adminUsers,
                inactive_users: totalUsers - activeUsers
            };
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            console.error('❌ Помилка отримання статистики користувачів:', error);
            throw new DatabaseError('Помилка отримання статистики користувачів');
        }
    }

    /**
     * Отримати доступні ролі
     * @returns {Array} масив ролей
     */
    getAvailableRoles() {
        return this.availableRoles.map(role => ({
            value: role,
            label: this.getRoleLabel(role)
        }));
    }

    /**
     * Отримати лейбл ролі
     * @param {string} role - роль
     * @returns {string} лейбл
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
     * Валідація даних користувача при створенні
     */
    validateUserData(userData) {
        const { username, role, password } = userData;
        
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            throw new ValidationError('Ім\'я користувача є обов\'язковим');
        }
        
        if (!role || !this.availableRoles.includes(role)) {
            throw new ValidationError('Некоректна роль користувача');
        }
        
        if (!password || password.length < 6) {
            throw new ValidationError('Пароль має бути не менше 6 символів');
        }
    }

    /**
     * Валідація даних для оновлення
     */
    validateUpdateData(updateData) {
        if (updateData.username !== undefined) {
            if (!updateData.username || typeof updateData.username !== 'string' || updateData.username.trim().length === 0) {
                throw new ValidationError('Ім\'я користувача не може бути порожнім');
            }
        }
        
        if (updateData.role !== undefined) {
            if (!this.availableRoles.includes(updateData.role)) {
                throw new ValidationError('Некоректна роль користувача');
            }
        }
        
        if (updateData.password !== undefined) {
            if (updateData.password.length < 6) {
                throw new ValidationError('Пароль має бути не менше 6 символів');
            }
        }
        
        if (updateData.email !== undefined && updateData.email) {
            if (!this.isValidEmail(updateData.email)) {
                throw new ValidationError('Некоректний формат email');
            }
        }
    }

    /**
     * Перевірка валідності email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Очищення користувача від чутливих даних
     */
    sanitizeUser(user) {
        const sanitized = { ...user };
        delete sanitized.password_hash;
        return sanitized;
    }

    /**
     * Адаптація користувача з Supabase формату до SQLite формату для сумісності
     */
    adaptUserToSQLiteFormat(supabaseUser) {
        return {
            id: supabaseUser.id,
            username: supabaseUser.username,
            last_name: supabaseUser.last_name,
            email: supabaseUser.email,
            phone: supabaseUser.phone,
            role: supabaseUser.role,
            permissions: supabaseUser.permissions || {},
            active: supabaseUser.is_active ? 1 : 0, // Convert boolean to integer
            created_at: supabaseUser.created_at,
            updated_at: supabaseUser.updated_at,
            first_login: supabaseUser.first_login ? 1 : 0, // Convert boolean to integer
            password_hash: supabaseUser.password_hash
        };
    }
}

module.exports = SupabaseUserService; 