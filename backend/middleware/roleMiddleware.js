const permissionService = require('../services/permissionService');
const { ForbiddenError, UnauthorizedError } = require('./errors/AppError');

/**
 * Middleware для перевірки прав доступу на основі ролі користувача
 */
class RoleMiddleware {
    /**
     * Створити middleware для перевірки конкретного права
     * @param {string} permission - право в форматі "module.action"
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static requirePermission(permission, errorMessage = null) {
        return async (req, res, next) => {
            try {
                // Перевірка чи є користувач авторизованим
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                // Перевірка прав доступу
                const hasPermission = await permissionService.hasPermission(req.user.id, permission);
                
                if (!hasPermission) {
                    const message = errorMessage || `Недостатньо прав для виконання операції: ${permission}`;
                    throw new ForbiddenError(message);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Перевірити чи має користувач хоча б одне з прав
     * @param {Array<string>} permissions - масив прав
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static requireAnyPermission(permissions, errorMessage = null) {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                const hasAnyPermission = await permissionService.hasAnyPermission(req.user.id, permissions);
                
                if (!hasAnyPermission) {
                    const message = errorMessage || `Недостатньо прав для виконання операції. Потрібно одне з: ${permissions.join(', ')}`;
                    throw new ForbiddenError(message);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Перевірити чи має користувач всі зазначені права
     * @param {Array<string>} permissions - масив прав
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static requireAllPermissions(permissions, errorMessage = null) {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                const hasAllPermissions = await permissionService.hasAllPermissions(req.user.id, permissions);
                
                if (!hasAllPermissions) {
                    const message = errorMessage || `Недостатньо прав для виконання операції. Потрібно всі: ${permissions.join(', ')}`;
                    throw new ForbiddenError(message);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Перевірити чи користувач має конкретну роль
     * @param {string|Array<string>} roles - роль або масив ролей
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static requireRole(roles, errorMessage = null) {
        const roleArray = Array.isArray(roles) ? roles : [roles];
        
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                if (!req.user.role || !roleArray.includes(req.user.role)) {
                    const message = errorMessage || `Доступ заборонено. Потрібна роль: ${roleArray.join(' або ')}`;
                    throw new ForbiddenError(message);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Перевірити чи користувач є адміністратором
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static requireAdmin(errorMessage = null) {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                // Перевірка адміністративних прав
                const hasAdminRights = await permissionService.hasPermission(req.user.id, 'admin.all_rights');
                
                if (!hasAdminRights) {
                    const message = errorMessage || 'Доступ заборонено. Потрібні адміністративні права';
                    throw new ForbiddenError(message);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Middleware для додавання інформації про права користувача в req.permissions
     * @returns {Function} middleware функція
     */
    static attachPermissions() {
        return async (req, res, next) => {
            try {
                if (req.user && req.user.id) {
                    // Отримуємо всі права користувача
                    const permissions = await permissionService.getUserPermissions(req.user.id);
                    
                    // Додаємо права до req для подальшого використання
                    req.permissions = permissions;
                    
                    // Додаємо helper функції для зручної перевірки
                    req.hasPermission = (permission) => {
                        return permissionService.hasPermission(req.user.id, permission);
                    };
                    
                    req.hasAnyPermission = (permissions) => {
                        return permissionService.hasAnyPermission(req.user.id, permissions);
                    };
                    
                    req.hasAllPermissions = (permissions) => {
                        return permissionService.hasAllPermissions(req.user.id, permissions);
                    };
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Комбінований middleware: авторизація + права + логування
     * @param {string} permission - право в форматі "module.action"
     * @param {string} errorMessage - кастомне повідомлення про помилку
     * @returns {Function} middleware функція
     */
    static secureEndpoint(permission, errorMessage = null) {
        return async (req, res, next) => {
            try {
                // Перевірка авторизації
                if (!req.user || !req.user.id) {
                    throw new UnauthorizedError('Необхідна авторизація');
                }

                // Перевірка прав доступу
                const hasPermission = await permissionService.hasPermission(req.user.id, permission);
                
                if (!hasPermission) {
                    const message = errorMessage || `Недостатньо прав для виконання операції: ${permission}`;
                    
                    // Логування спробі несанкціонованого доступу
                    console.warn(`🚨 Несанкціонована спроба доступу: ${req.user.username} (ID: ${req.user.id}) -> ${permission}`);
                    
                    throw new ForbiddenError(message);
                }

                // Логування успішного доступу
                console.log(`✅ Доступ дозволено: ${req.user.username} (ID: ${req.user.id}) -> ${permission}`);
                
                next();
            } catch (error) {
                next(error);
            }
        };
    }
}

// Експортуємо клас і також окремі методи для зручності
module.exports = RoleMiddleware;

// Експортуємо також окремі методи для зручного використання
module.exports.requirePermission = RoleMiddleware.requirePermission;
module.exports.requireAnyPermission = RoleMiddleware.requireAnyPermission;
module.exports.requireAllPermissions = RoleMiddleware.requireAllPermissions;
module.exports.requireRole = RoleMiddleware.requireRole;
module.exports.requireAdmin = RoleMiddleware.requireAdmin;
module.exports.attachPermissions = RoleMiddleware.attachPermissions;
module.exports.secureEndpoint = RoleMiddleware.secureEndpoint; 