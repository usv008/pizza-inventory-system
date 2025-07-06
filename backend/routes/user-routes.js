const express = require('express');
const router = express.Router();

const userService = require('../services/userService');
const permissionService = require('../services/permissionService');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { formatResponse } = require('../middleware/responseFormatter');

// Middleware для всіх маршрутів користувачів
router.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync('/tmp/middleware_debug.log', `${new Date().toISOString()} - ${req.method} ${req.url} - User: ${req.session?.user?.username || 'None'}\n`);
    next();
});

router.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync('/tmp/middleware_debug.log', `Before requireAuth\n`);
    next();
});

router.use(requireAuth);

router.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync('/tmp/middleware_debug.log', `After requireAuth\n`);
    next();
});

/**
 * @route GET /api/users
 * @desc Отримати список всіх користувачів
 * @access Admin only
 */
router.get('/', requireAdmin, async (req, res, next) => {
    try {
        const { include_inactive } = req.query;
        
        const users = await userService.getAllUsers({
            includeInactive: include_inactive === 'true'
        });
        
        res.json(formatResponse(users, 'Список користувачів отримано успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/users/roles
 * @desc Отримати список доступних ролей
 * @access Admin only
 */
router.get('/roles', requireAdmin, async (req, res, next) => {
    const fs = require('fs');
    
    try {
        fs.appendFileSync('/tmp/roles_debug.log', `${new Date().toISOString()} - START /api/users/roles\n`);
        fs.appendFileSync('/tmp/roles_debug.log', `User: ${JSON.stringify(req.user)}\n`);
        fs.appendFileSync('/tmp/roles_debug.log', `UserService type: ${typeof userService}\n`);
        
        const roles = [
            { value: 'ДИРЕКТОР', label: 'Директор' },
            { value: 'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ', label: 'Завідуючий виробництвом' },
            { value: 'БУХГАЛТЕР', label: 'Бухгалтер' },
            { value: 'ПАКУВАЛЬНИК', label: 'Пакувальник' },
            { value: 'КОМІРНИК', label: 'Комірник' },
            { value: 'МЕНЕДЖЕР_З_ПРОДАЖІВ', label: 'Менеджер з продажів' }
        ];
        
        fs.appendFileSync('/tmp/roles_debug.log', `Roles: ${JSON.stringify(roles)}\n`);
        fs.appendFileSync('/tmp/roles_debug.log', `About to send response\n`);
        
        res.json(formatResponse(roles, 'Список ролей отримано успішно'));
        
        fs.appendFileSync('/tmp/roles_debug.log', `Response sent successfully\n`);
    } catch (error) {
        fs.appendFileSync('/tmp/roles_debug.log', `ERROR: ${error.message}\n`);
        fs.appendFileSync('/tmp/roles_debug.log', `STACK: ${error.stack}\n`);
        next(error);
    }
});

/**
 * @route GET /api/users/permissions
 * @desc Отримати структуру прав для UI
 * @access Admin only
 */
router.get('/permissions', requireAdmin, async (req, res, next) => {
    try {
        console.log('🔍 [DEBUG] /api/users/permissions - Початок обробки');
        const permissions = permissionService.getPermissionsForUI();
        console.log('✅ [DEBUG] /api/users/permissions - Права отримано:', permissions);
        
        res.json(formatResponse(permissions, 'Структура прав отримана успішно'));
    } catch (error) {
        console.error('❌ [ERROR] /api/users/permissions - Помилка:', error);
        next(error);
    }
});

/**
 * @route GET /api/users/stats
 * @desc Отримати статистику користувачів
 * @access Admin only
 */
router.get('/stats', requireAdmin, async (req, res, next) => {
    try {
        console.log('🔍 [DEBUG] /api/users/stats - Початок обробки');
        const stats = await userService.getUserStats();
        console.log('✅ [DEBUG] /api/users/stats - Статистика отримана:', stats);
        
        res.json(formatResponse(stats, 'Статистика користувачів отримана успішно'));
    } catch (error) {
        console.error('❌ [ERROR] /api/users/stats - Помилка:', error);
        next(error);
    }
});

/**
 * @route GET /api/users/:id
 * @desc Отримати дані конкретного користувача
 * @access Admin only
 */
router.get('/:id', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        const user = await userService.getUserById(userId);
        
        res.json(formatResponse(user, 'Дані користувача отримано успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/users
 * @desc Створити нового користувача
 * @access Admin only
 */
router.post('/', requireAdmin, async (req, res, next) => {
    try {
        const { username, email, phone, role, permissions, password } = req.body;
        
        // Валідація обов'язкових полів
        if (!username || !role || !password) {
            return res.status(400).json(formatResponse(null, 'Ім\'я користувача, роль та пароль є обов\'язковими', false));
        }
        
        const userData = {
            username,
            email,
            phone,
            role,
            permissions: permissions || {},
            password
        };
        
        const newUser = await userService.createUser(userData, req.user.id);
        
        res.status(201).json(formatResponse(newUser, 'Користувача створено успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/users/:id
 * @desc Оновити дані користувача
 * @access Admin only
 */
router.put('/:id', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        const { username, email, phone, role, permissions, active } = req.body;
        
        const updateData = {};
        
        // Додаємо тільки надані поля
        if (username !== undefined) updateData.username = username;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (active !== undefined) updateData.active = active;
        
        const updatedUser = await userService.updateUser(userId, updateData, req.user.id);
        
        res.json(formatResponse(updatedUser, 'Дані користувача оновлено успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/users/:id
 * @desc Видалити (деактивувати) користувача
 * @access Admin only
 */
router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        await userService.deleteUser(userId, req.user.id);
        
        res.json(formatResponse(null, 'Користувача видалено успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/users/:id/change-password
 * @desc Змінити пароль користувача (тільки адміністратор)
 * @access Admin only
 */
router.post('/:id/change-password', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { password } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        if (!password) {
            return res.status(400).json(formatResponse(null, 'Пароль є обов\'язковим', false));
        }
        
        await userService.changeUserPassword(userId, password, req.user.id);
        
        res.json(formatResponse(null, 'Пароль користувача змінено успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/users/:id/permissions
 * @desc Отримати права конкретного користувача
 * @access Admin only
 */
router.get('/:id/permissions', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        const permissions = await permissionService.getUserPermissions(userId);
        
        res.json(formatResponse(permissions, 'Права користувача отримано успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/users/:id/permissions/check
 * @desc Перевірити чи має користувач конкретне право
 * @access Admin only
 */
router.post('/:id/permissions/check', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { permission } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        if (!permission) {
            return res.status(400).json(formatResponse(null, 'Право для перевірки є обов\'язковим', false));
        }
        
        const hasPermission = await permissionService.hasPermission(userId, permission);
        
        res.json(formatResponse({ 
            user_id: userId, 
            permission, 
            has_permission: hasPermission 
        }, 'Перевірка права виконана успішно'));
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/users/:id/permissions/clear-cache
 * @desc Очистити кеш прав користувача
 * @access Admin only
 */
router.post('/:id/permissions/clear-cache', requireAdmin, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json(formatResponse(null, 'Некоректний ID користувача', false));
        }
        
        permissionService.clearUserCache(userId);
        
        res.json(formatResponse(null, 'Кеш прав користувача очищено успішно'));
    } catch (error) {
        next(error);
    }
});

module.exports = router; 