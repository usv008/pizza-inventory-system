const express = require('express');
const router = express.Router();

// Middleware and error handling
const { handleAsync } = require('../middleware/responseFormatter');
const { ValidationError, NotFoundError } = require('../middleware/errors/AppError');

// Service
const authService = require('../services/authService');

/**
 * @api {get} /api/auth/users Get all users
 * @apiDescription Отримати список всіх користувачів (для dropdown входу та адмін панелі)
 */
router.get('/users', handleAsync(async (req, res) => {
    const { include_inactive } = req.query;
    
    if (include_inactive === 'true') {
        // Для адмін панелі - всі користувачі
        const allUsers = await authService.getAllUsers();
        console.log(`🔍 Route: отримано ${allUsers.length} користувачів (включно з неактивними)`);
        res.json(allUsers);
    } else {
        // Для dropdown входу - тільки активні
        const activeUsers = await authService.getActiveUsers();
        const filteredUsers = activeUsers.filter(user => user.active === 1);
        console.log(`🔍 Route: отримано ${activeUsers.length} користувачів, після фільтрації: ${filteredUsers.length}`);
        res.json(filteredUsers);
    }
}));

/**
 * @api {get} /api/auth/users/roles Get available roles
 * @apiDescription Отримати список доступних ролей для користувачів
 */
router.get('/users/roles', handleAsync(async (req, res) => {
    const roles = [
        { value: 'ДИРЕКТОР', label: 'Директор' },
        { value: 'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ', label: 'Завідуючий виробництвом' },
        { value: 'БУХГАЛТЕР', label: 'Бухгалтер' },
        { value: 'ПАКУВАЛЬНИК', label: 'Пакувальник' },
        { value: 'КОМІРНИК', label: 'Комірник' },
        { value: 'МЕНЕДЖЕР_З_ПРОДАЖІВ', label: 'Менеджер з продажів' }
    ];
    
    res.json(roles);
}));

/**
 * @api {get} /api/auth/users/stats Get user statistics
 * @apiDescription Отримати статистику користувачів
 */
router.get('/users/stats', handleAsync(async (req, res) => {
    const allUsers = await authService.getAllUsers();
    
    const stats = {
        total_users: allUsers.length,
        active_users: allUsers.filter(u => u.active === 1).length,
        admin_users: allUsers.filter(u => u.role === 'ДИРЕКТОР').length
    };
    
    res.json(stats);
}));

/**
 * @api {post} /api/auth/users Create new user
 * @apiDescription Створити нового користувача (тільки для адміністраторів)
 */
router.post('/users', handleAsync(async (req, res) => {
    // Перевіряємо аутентифікацію
    if (!req.session.user) {
        throw new ValidationError('Необхідна аутентифікація');
    }
    
    // Перевіряємо права адміністратора
    if (req.session.user.role !== 'ДИРЕКТОР') {
        throw new ValidationError('Недостатньо прав для створення користувачів');
    }
    
    const { username, email, phone, role, password, active } = req.body;
    
    if (!username || !role || !password) {
        throw new ValidationError('Ім\'я користувача, роль та пароль є обов\'язковими');
    }
    
    const userData = {
        username,
        email,
        phone,
        role,
        password,
        active: active !== false // за замовчуванням true
    };
    
    const newUser = await authService.createUser(userData, req.session.user.id);
    res.json({ success: true, data: newUser });
}));

/**
 * @api {put} /api/auth/users/:id Update user
 * @apiDescription Оновити дані користувача (тільки для адміністраторів)
 */
router.put('/users/:id', handleAsync(async (req, res) => {
    // Перевіряємо аутентифікацію
    if (!req.session.user) {
        throw new ValidationError('Необхідна аутентифікація');
    }
    
    // Перевіряємо права адміністратора
    if (req.session.user.role !== 'ДИРЕКТОР') {
        throw new ValidationError('Недостатньо прав для оновлення користувачів');
    }
    
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
        throw new ValidationError('Некоректний ID користувача');
    }
    
    const { username, email, phone, role, active } = req.body;
    
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;
    
    const updatedUser = await authService.updateUser(userId, updateData, req.session.user.id);
    res.json({ success: true, data: updatedUser });
}));

/**
 * @api {delete} /api/auth/users/:id Delete user
 * @apiDescription Видалити користувача (тільки для адміністраторів)
 */
router.delete('/users/:id', handleAsync(async (req, res) => {
    // Перевіряємо аутентифікацію
    if (!req.session.user) {
        throw new ValidationError('Необхідна аутентифікація');
    }
    
    // Перевіряємо права адміністратора
    if (req.session.user.role !== 'ДИРЕКТОР') {
        throw new ValidationError('Недостатньо прав для видалення користувачів');
    }
    
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
        throw new ValidationError('Некоректний ID користувача');
    }
    
    // Не дозволяємо видаляти системного адміністратора
    if (userId === 1) {
        throw new ValidationError('Неможливо видалити системного адміністратора');
    }
    
    await authService.deleteUser(userId, req.session.user.id);
    res.json({ success: true, data: { message: 'Користувача видалено' } });
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