const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для управління правами доступу користувачів
 * Реалізує гібридну систему: базові права за роллю + індивідуальні налаштування
 */
class PermissionService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 хвилин
        this.initialized = false;
        
        // Базові права за ролями (default permissions matrix)
        this.roleDefaults = {
            'ДИРЕКТОР': { 
                admin: { all_rights: true }
            },
            'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ': {
                production: { read: true, write: true },
                writeoffs: { read: true, write: true },
                arrivals: { read: true, write: true }
            },
            'БУХГАЛТЕР': {
                orders: { read: true, write: true, create: true },
                writeoffs: { read: true, write: true },
                operations: { delete: true }
            },
            'ПАКУВАЛЬНИК': {
                production: { read: true, write: true },
                shipments: { write: true }
            },
            'КОМІРНИК': {
                arrivals: { read: true, write: true },
                writeoffs: { read: true, write: true },
                products: { create: true }
            },
            'МЕНЕДЖЕР_З_ПРОДАЖІВ': {
                orders: { read: true, write: true, create: true },
                shipments: { write: true }
            }
        };
        
        // Реєстр всіх можливих прав (для автоматичного додавання)
        this.permissionRegistry = {
            'orders.read': 'Перегляд замовлень',
            'orders.write': 'Редагування замовлень',
            'orders.create': 'Створення замовлень',
            'orders.delete': 'Видалення замовлень',
            'production.read': 'Перегляд виробництва',
            'production.write': 'Редагування виробництва',
            'writeoffs.read': 'Перегляд списань',
            'writeoffs.write': 'Створення списань',
            'arrivals.read': 'Перегляд приходів',
            'arrivals.write': 'Створення приходів',
            'products.create': 'Створення товарів',
            'shipments.write': 'Відвантаження товарів',
            'operations.delete': 'Видалення операцій',
            'admin.all_rights': 'Всі права доступу'
        };
    }

    /**
     * Ініціалізація сервісу
     */
    initialize() {
        this.initialized = true;
        console.log('✅ PermissionService ініціалізовано');
    }

    /**
     * Перевірка чи має користувач конкретне право
     * @param {number} userId - ID користувача
     * @param {string} permission - право в форматі "module.action"
     * @returns {boolean} чи має користувач це право
     */
    async hasPermission(userId, permission) {
        try {
            const userPermissions = await this.getUserPermissions(userId);
            
            // Перевірка прав адміністратора (дозволяє все)
            if (userPermissions.admin && userPermissions.admin.all_rights) {
                return true;
            }
            
            // Перевірка конкретного дозволу
            const [module, action] = permission.split('.');
            
            if (!module || !action) {
                console.warn(`⚠️ Некоректний формат permission: ${permission}`);
                return false;
            }
            
            return userPermissions[module] && userPermissions[module][action] === true;
        } catch (error) {
            console.error(`❌ Помилка перевірки права ${permission} для користувача ${userId}:`, error);
            return false;
        }
    }

    /**
     * Перевірка чи має користувач хоча б одне з прав
     * @param {number} userId - ID користувача
     * @param {Array<string>} permissions - масив прав
     * @returns {boolean} чи має користувач хоча б одне право
     */
    async hasAnyPermission(userId, permissions) {
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return false;
        }

        for (const permission of permissions) {
            if (await this.hasPermission(userId, permission)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Перевірка чи має користувач всі зазначені права
     * @param {number} userId - ID користувача
     * @param {Array<string>} permissions - масив прав
     * @returns {boolean} чи має користувач всі права
     */
    async hasAllPermissions(userId, permissions) {
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return true;
        }

        for (const permission of permissions) {
            if (!(await this.hasPermission(userId, permission))) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Отримати всі права користувача (кешовано)
     * @param {number} userId - ID користувача
     * @returns {Object} об'єкт з правами користувача
     */
    async getUserPermissions(userId) {
        const cacheKey = `permissions_${userId}`;
        const cached = this.cache.get(cacheKey);
        
        // Перевірка кешу
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.permissions;
        }
        
        try {
            // Динамічно завантажуємо database щоб уникнути circular dependency
            const database = require('../database');
            if (!database.userQueries) {
                throw new DatabaseError('UserQueries недоступні');
            }
            
            const user = await database.userQueries.getById(userId);
            if (!user) {
                throw new NotFoundError(`Користувача з ID ${userId} не знайдено`);
            }
            
            // Отримуємо базові права за роллю
            const rolePermissions = this.roleDefaults[user.role] || {};
            
            // Отримуємо індивідуальні налаштування
            const userOverrides = JSON.parse(user.permissions || '{}');
            
            // Об'єднуємо права (userOverrides мають вищий пріоритет)
            const finalPermissions = this.mergeDeep(rolePermissions, userOverrides);
            
            // Кешуємо результат
            this.cache.set(cacheKey, {
                permissions: finalPermissions,
                timestamp: Date.now()
            });
            
            return finalPermissions;
        } catch (error) {
            console.error(`❌ Помилка отримання прав користувача ${userId}:`, error);
            return {};
        }
    }

    /**
     * Очистити кеш прав для користувача
     * @param {number} userId - ID користувача (або null для очищення всього кешу)
     */
    clearUserCache(userId = null) {
        if (userId) {
            const cacheKey = `permissions_${userId}`;
            this.cache.delete(cacheKey);
            console.log(`🧹 Очищено кеш прав для користувача ${userId}`);
        } else {
            this.cache.clear();
            console.log('🧹 Очищено весь кеш прав');
        }
    }

    /**
     * Отримати базові права для ролі
     * @param {string} role - назва ролі
     * @returns {Object} об'єкт з базовими правами
     */
    getRolePermissions(role) {
        return this.roleDefaults[role] || {};
    }

    /**
     * Отримати список всіх доступних прав
     * @returns {Object} реєстр всіх прав з описами
     */
    getAllPermissions() {
        return { ...this.permissionRegistry };
    }

    /**
     * Зареєструвати нове право
     * @param {string} permission - право в форматі "module.action"
     * @param {string} description - опис права
     */
    registerPermission(permission, description) {
        if (!permission || !permission.includes('.')) {
            throw new ValidationError('Право має бути в форматі "module.action"');
        }
        
        this.permissionRegistry[permission] = description;
        console.log(`➕ Зареєстровано нове право: ${permission} - ${description}`);
        
        // Очищаємо кеш при додаванні нових прав
        this.clearUserCache();
    }

    /**
     * Отримати права за категоріями для UI
     * @returns {Object} структуровані права для інтерфейсу
     */
    getPermissionsForUI() {
        const categories = {
            'orders': {
                name: 'Замовлення',
                permissions: {
                    'read': 'Перегляд замовлень',
                    'write': 'Редагування замовлень', 
                    'create': 'Створення замовлень',
                    'delete': 'Видалення замовлень'
                }
            },
            'production': {
                name: 'Виробництво',
                permissions: {
                    'read': 'Перегляд виробництва',
                    'write': 'Редагування виробництва'
                }
            },
            'writeoffs': {
                name: 'Списання',
                permissions: {
                    'read': 'Перегляд списань',
                    'write': 'Створення списань'
                }
            },
            'arrivals': {
                name: 'Приходи',
                permissions: {
                    'read': 'Перегляд приходів',
                    'write': 'Створення приходів'
                }
            },
            'products': {
                name: 'Товари',
                permissions: {
                    'create': 'Створення товарів'
                }
            },
            'shipments': {
                name: 'Відвантаження',
                permissions: {
                    'write': 'Відвантаження товарів'
                }
            },
            'operations': {
                name: 'Операції',
                permissions: {
                    'delete': 'Видалення операцій'
                }
            },
            'admin': {
                name: 'Адміністрування',
                permissions: {
                    'all_rights': 'Всі права доступу'
                }
            }
        };
        
        return categories;
    }

    /**
     * Глибоке об'єднання об'єктів прав
     * @param {Object} target - базовий об'єкт
     * @param {Object} source - об'єкт що накладається
     * @returns {Object} об'єднаний результат
     */
    mergeDeep(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeDeep(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Валідація структури прав
     * @param {Object} permissions - об'єкт з правами
     * @returns {boolean} чи валідна структура
     */
    validatePermissionStructure(permissions) {
        if (!permissions || typeof permissions !== 'object') {
            return false;
        }
        
        for (const module in permissions) {
            if (typeof permissions[module] !== 'object') {
                return false;
            }
            
            for (const action in permissions[module]) {
                if (typeof permissions[module][action] !== 'boolean') {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Отримати статистику прав користувачів
     * @returns {Object} статистика використання прав
     */
    getCacheStats() {
        return {
            total_cached_users: this.cache.size,
            cache_expiry_minutes: this.cacheExpiry / (60 * 1000),
            total_permissions: Object.keys(this.permissionRegistry).length,
            available_roles: Object.keys(this.roleDefaults)
        };
    }
}

// Експортуємо singleton instance
module.exports = new PermissionService(); 