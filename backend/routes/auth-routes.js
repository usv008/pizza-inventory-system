const express = require('express');
const router = express.Router();

// Middleware and error handling
const { handleAsync } = require('../middleware/responseFormatter');
const { ValidationError, NotFoundError } = require('../middleware/errors/AppError');

// Service - використовуємо нову версію з підтримкою Supabase
const authService = require('../services/authService-v2');

// Простий тест маршрут
router.get('/test', (req, res) => {
    console.log('🔍 AUTH ROUTE TEST: Запит на /api/auth/test');
    res.json({ message: 'Auth route works!' });
});

/**
 * @api {get} /api/auth/users Get all users for dropdown
 * @apiDescription Отримати список всіх активних користувачів для dropdown входу
 */
router.get('/users', handleAsync(async (req, res) => {
    console.log('🔍 AUTH ROUTE: Запит на /api/auth/users');
    
    try {
        const activeUsers = await authService.getActiveUsers();
        console.log(`🔍 AUTH ROUTE: authService.getActiveUsers() повернув:`, activeUsers);
        
        // Додаткова фільтрація на рівні route як запасний варіант
        const filteredUsers = activeUsers.filter(user => {
            console.log(`🔍 AUTH ROUTE: Користувач ${user.username}, active: ${user.active} (type: ${typeof user.active})`);
            return user.active === 1 || user.active === true;
        });
        
        console.log(`🔍 AUTH ROUTE: отримано ${activeUsers.length} користувачів, після фільтрації: ${filteredUsers.length}`);
        
        res.json({
            success: true,
            data: filteredUsers,
            meta: {
                total: filteredUsers.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ AUTH ROUTE ERROR:', error);
        throw error;
    }
}));

/**
 * @api {post} /api/auth/login User login
 * @apiDescription Аутентифікація користувача
 */
router.post('/login', handleAsync(async (req, res) => {
    const { username, password } = req.body;
    
    if (!username) {
        throw new ValidationError('Username є обов\'язковим');
    }
    
    if (!password) {
        throw new ValidationError('Password є обов\'язковим');
    }
    
    const sessionInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    const user = await authService.login(username, password, sessionInfo);
    
    // Створюємо сесію в Express
    req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
    };
    
    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions,
                first_login: user.first_login,
                email: user.email,
                phone: user.phone
            },
            session_id: req.session.id
        },
        meta: {
            operation: 'login',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/auth/set-password Set password for first login
 * @apiDescription Встановити пароль для першого входу
 */
router.post('/set-password', handleAsync(async (req, res) => {
    const { user_id, password } = req.body;
    
    if (!user_id) {
        throw new ValidationError('User ID є обов\'язковим');
    }
    
    if (!password) {
        throw new ValidationError('Password є обов\'язковим');
    }
    
    if (password.length < 6) {
        throw new ValidationError('Пароль має бути не менше 6 символів');
    }
    
    const sessionInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    await authService.setFirstTimePassword(user_id, password, sessionInfo);
    
    res.json({
        success: true,
        data: {
            message: 'Пароль встановлено успішно'
        },
        meta: {
            operation: 'set_password',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/auth/change-password Change own password
 * @apiDescription Зміна власного пароля користувачем
 */
router.post('/change-password', handleAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword) {
        throw new ValidationError('Поточний пароль є обов\'язковим');
    }
    
    if (!newPassword) {
        throw new ValidationError('Новий пароль є обов\'язковим');
    }
    
    if (newPassword.length < 6) {
        throw new ValidationError('Пароль має бути не менше 6 символів');
    }
    
    // Перевіряємо що користувач аутентифікований
    if (!req.session.user) {
        throw new ValidationError('Необхідна аутентифікація');
    }
    
    const sessionInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    await authService.changeOwnPassword(req.session.user.id, currentPassword, newPassword, sessionInfo);
    
    res.json({
        success: true,
        data: {
            message: 'Пароль змінено успішно'
        },
        meta: {
            operation: 'change_own_password',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/auth/admin/change-password Change password by admin
 * @apiDescription Зміна пароля адміністратором
 */
router.post('/admin/change-password', handleAsync(async (req, res) => {
    const { user_id, new_password } = req.body;
    
    if (!user_id) {
        throw new ValidationError('User ID є обов\'язковим');
    }
    
    if (!new_password) {
        throw new ValidationError('New password є обов\'язковим');
    }
    
    if (new_password.length < 6) {
        throw new ValidationError('Пароль має бути не менше 6 символів');
    }
    
    // Перевіряємо що користувач аутентифікований
    if (!req.session.user) {
        throw new ValidationError('Необхідна аутентифікація');
    }
    
    const sessionInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    await authService.changePasswordByAdmin(user_id, new_password, req.session.user.id, sessionInfo);
    
    res.json({
        success: true,
        data: {
            message: 'Пароль змінено успішно'
        },
        meta: {
            operation: 'admin_change_password',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/auth/validate Validate session
 * @apiDescription Перевірити дійсність поточної сесії
 */
router.get('/validate', handleAsync(async (req, res) => {
    if (!req.session.user) {
        return res.json({
            success: false,
            data: {
                authenticated: false,
                message: 'Сесія не активна'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    
    const sessionId = req.session.id;
    const user = await authService.validateSession(sessionId);
    
    if (!user) {
        // Очищаємо сесію якщо вона не дійсна
        req.session.destroy();
        return res.json({
            success: false,
            data: {
                authenticated: false,
                message: 'Сесія закінчилась'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    
    res.json({
        success: true,
        data: {
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            }
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/auth/logout User logout
 * @apiDescription Вихід користувача з системи
 */
router.post('/logout', handleAsync(async (req, res) => {
    const sessionId = req.session.id;
    const userId = req.session.user ? req.session.user.id : null;
    
    const sessionInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    await authService.logout(sessionId, userId, sessionInfo);
    
    // Знищуємо сесію в Express
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Помилка знищення сесії:', err);
        }
    });
    
    res.json({
        success: true,
        data: {
            message: 'Вихід виконано успішно'
        },
        meta: {
            operation: 'logout',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/auth/me Get current user info
 * @apiDescription Отримати інформацію про поточного користувача
 */
router.get('/me', handleAsync(async (req, res) => {
    if (!req.session.user) {
        throw new ValidationError('Користувач не аутентифікований');
    }
    
    res.json({
        success: true,
        data: {
            user: req.session.user,
            session_id: req.session.id
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/auth/cleanup-sessions Cleanup expired sessions
 * @apiDescription Очищення застарілих сесій (admin only)
 */
router.post('/cleanup-sessions', handleAsync(async (req, res) => {
    // Перевіряємо права адміністратора
    if (!req.session.user) {
        throw new ValidationError('Користувач не аутентифікований');
    }
    
    const userPermissions = req.session.user.permissions || {};
    if (!userPermissions.admin?.all_rights) {
        throw new ValidationError('Недостатньо прав для очищення сесій');
    }
    
    const cleanedCount = await authService.cleanupExpiredSessions();
    
    res.json({
        success: true,
        data: {
            message: `Очищено ${cleanedCount} застарілих сесій`,
            cleaned_sessions: cleanedCount
        },
        meta: {
            operation: 'cleanup_sessions',
            timestamp: new Date().toISOString()
        }
    });
}));

module.exports = router; 