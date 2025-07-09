const express = require('express');
const router = express.Router();

console.log('🔄 [USER-ROUTES] Creating simple user router');

// Simple middleware for debug
router.use((req, res, next) => {
    console.log('🔍 [USER-ROUTES] Request intercepted:', req.method, req.url);
    next();
});

/**
 * @route GET /api/users
 * @desc Отримати список всіх користувачів через Supabase DIRECT
 * @access Admin only  
 */
router.get('/', async (req, res, next) => {
    try {
        console.log('🔍 [USER-ROUTES] GET /api/users - DIRECT Supabase call');
        
        // DIRECT Supabase call without service layer
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('is_active', true);
            
        if (error) {
            console.error('❌ [USER-ROUTES] Supabase error:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Адаптуємо формат
        const adaptedUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            permissions: user.permissions || {},
            active: user.is_active ? 1 : 0,
            created_at: user.created_at,
            updated_at: user.updated_at,
            first_login: user.first_login ? 1 : 0
        }));
        
        console.log('✅ [USER-ROUTES] Retrieved users from Supabase DIRECT:', adaptedUsers?.length);
        
        res.json({
            success: true,
            data: adaptedUsers,
            meta: {
                timestamp: new Date().toISOString()
            },
            message: 'Список користувачів отримано успішно'
        });
    } catch (error) {
        console.error('❌ [USER-ROUTES] Error getting users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route GET /api/users/roles
 * @desc Отримати список доступних ролей
 */
router.get('/roles', (req, res) => {
    console.log('🔍 [USER-ROUTES] GET /api/users/roles');
    
    const roles = [
        { value: 'ДИРЕКТОР', label: 'Директор' },
        { value: 'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ', label: 'Завідуючий виробництвом' },
        { value: 'БУХГАЛТЕР', label: 'Бухгалтер' },
        { value: 'ПАКУВАЛЬНИК', label: 'Пакувальник' },
        { value: 'КОМІРНИК', label: 'Комірник' },
        { value: 'МЕНЕДЖЕР_З_ПРОДАЖІВ', label: 'Менеджер з продажів' }
    ];
    
    res.json({
        success: true,
        data: roles,
        message: 'Список ролей отримано успішно'
    });
});

/**
 * @route GET /api/users/stats
 * @desc Отримати статистику користувачів
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('🔍 [USER-ROUTES] GET /api/users/stats - DIRECT Supabase');
        
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data: users, error } = await supabase
            .from('users')
            .select('is_active, role');
            
        if (error) {
            console.error('❌ [USER-ROUTES] Stats error:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const stats = {
            total: users.length,
            active: users.filter(u => u.is_active).length,
            inactive: users.filter(u => !u.is_active).length,
            by_role: {}
        };
        
        // Підрахунок по ролях
        users.forEach(user => {
            if (user.is_active) {
                stats.by_role[user.role] = (stats.by_role[user.role] || 0) + 1;
            }
        });
        
        console.log('✅ [USER-ROUTES] Stats calculated:', stats);
        
        res.json({
            success: true,
            data: stats,
            message: 'Статистика користувачів отримана успішно'
        });
    } catch (error) {
        console.error('❌ [USER-ROUTES] Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

console.log('✅ [USER-ROUTES] Simple user router created successfully');

module.exports = router; 