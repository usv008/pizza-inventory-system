const { ValidationError, NotFoundError } = require('./errors/AppError');

/**
 * Middleware для перевірки аутентифікації користувача
 * Перевіряє чи користувач увійшов в систему через сесію
 */
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Необхідна аутентифікація. Будь ласка, увійдіть в систему.'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }

    // Додаємо інформацію про користувача до req для подальшого використання
    req.user = req.session.user;
    next();
};

/**
 * Middleware для перевірки конкретних прав доступу
 * @param {string|Array} requiredPermissions - права які потрібні для доступу
 * @returns {Function} middleware function
 */
const requirePermission = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Необхідна аутентифікація'
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            });
        }

        const userPermissions = req.user.permissions || {};
        
        // Якщо користувач має права адміністратора - дозволяємо все
        if (userPermissions.admin?.all_rights) {
            return next();
        }

        // Перетворюємо одну permission в масив для уніфікації
        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
        
        // Перевіряємо чи користувач має хоча б одну з необхідних прав
        const hasPermission = permissions.some(permission => {
            return checkUserPermission(userPermissions, permission);
        });

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Недостатньо прав для виконання цієї операції',
                    required_permissions: permissions
                },
                meta: {
                    user_role: req.user.role,
                    user_permissions: Object.keys(userPermissions),
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();
    };
};

/**
 * Middleware для перевірки ролі користувача
 * @param {string|Array} allowedRoles - дозволені ролі
 * @returns {Function} middleware function
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Необхідна аутентифікація'
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            });
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Недостатньо прав. Потрібна роль: ' + roles.join(' або '),
                    required_roles: roles
                },
                meta: {
                    user_role: req.user.role,
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();
    };
};

/**
 * Middleware для перевірки що користувач є адміністратором
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Необхідна аутентифікація'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }

    const userPermissions = req.user.permissions || {};
    
    if (!userPermissions.admin?.all_rights) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'Потрібні права адміністратора'
            },
            meta: {
                user_role: req.user.role,
                timestamp: new Date().toISOString()
            }
        });
    }

    next();
};

/**
 * Middleware для логування API викликів
 */
const logApiCall = (req, res, next) => {
    const startTime = Date.now();
    
    // Перехоплюємо відповідь для логування
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;
        
        // Асинхронно логуємо API виклик
        setImmediate(() => {
            logApiCallAsync(req, statusCode, duration, success);
        });
        
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Асинхронне логування API викликів
 */
async function logApiCallAsync(req, statusCode, duration, success) {
    try {
        // Динамічно завантажуємо database щоб уникнути circular dependency
        const database = require('../database');
        if (database.auditQueries) {
            await database.auditQueries.logApiCall(
                req.user ? req.user.id : null,
                req.method,
                req.originalUrl,
                statusCode,
                duration,
                success ? 1 : 0,
                {
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                }
            );
        }
    } catch (error) {
        console.error('❌ Помилка логування API виклику:', error);
        // Не кидаємо помилку щоб не перервати відповідь
    }
}

/**
 * Перевірка конкретної permission у користувача
 * @param {Object} userPermissions - права користувача
 * @param {string} permission - потрібна permission (format: "module.action")
 * @returns {boolean} чи має користувач цю permission
 */
function checkUserPermission(userPermissions, permission) {
    if (!permission || !userPermissions) return false;
    
    // Розділяємо permission на модуль та дію
    const [module, action] = permission.split('.');
    
    if (!module) return false;
    
    const modulePermissions = userPermissions[module];
    if (!modulePermissions) return false;
    
    // Якщо не вказана дія, перевіряємо що модуль взагалі доступний
    if (!action) {
        return Object.values(modulePermissions).some(val => val === true);
    }
    
    // Перевіряємо конкретну дію
    return modulePermissions[action] === true;
}

/**
 * Middleware для перевірки власності ресурсу
 * Перевіряє чи користувач має право редагувати конкретний ресурс
 * @param {string} userIdField - поле в req.params яке містить user_id ресурсу
 * @returns {Function} middleware function
 */
const requireOwnership = (userIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Необхідна аутентифікація'
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Адміністратори можуть редагувати все
        const userPermissions = req.user.permissions || {};
        if (userPermissions.admin?.all_rights) {
            return next();
        }

        // Перевіряємо власність ресурсу
        const resourceUserId = parseInt(req.params[userIdField] || req.body[userIdField]);
        if (resourceUserId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Ви можете редагувати тільки свої власні ресурси'
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            });
        }

        next();
    };
};

/**
 * Комбінований middleware для аутентифікації + логування
 */
const authWithLogging = [requireAuth, logApiCall];

/**
 * Комбінований middleware для адміністратора + логування
 */
const adminWithLogging = [requireAuth, requireAdmin, logApiCall];

module.exports = {
    requireAuth,
    requirePermission,
    requireRole,
    requireAdmin,
    requireOwnership,
    logApiCall,
    authWithLogging,
    adminWithLogging,
    checkUserPermission
}; 