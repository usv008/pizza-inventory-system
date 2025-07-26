// routes/batch-routes.js - Роути для управління партіями (оновлено для Supabase)

console.log('🚀 Loading batch-routes.js...');

const express = require('express');
const batchService = require('../services/batchService-v2');
const { handleAsync } = require('../middleware/responseFormatter');

const router = express.Router();

console.log('✅ Batch router created successfully');

// Logging middleware
router.use((req, res, next) => {
    console.log('🔍 Batch route hit:', req.method, req.url);
    next();
});

// Отримати всі партії з групуванням по товарах (для головної сторінки)
router.get('/batches/grouped', async (req, res) => {
    try {
        const result = await batchService.getAllBatchesGrouped();
        res.json(result);
    } catch (error) {
        console.error('Error in /batches/grouped:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка завантаження партій',
            details: error.message 
        });
    }
});

// Отримати партії товару
router.get('/products/:productId/batches', handleAsync(async (req, res) => {
    const { productId } = req.params;
    const { includeExpired = false } = req.query;
    
    const result = await batchService.getBatchesByProduct(
        productId, 
        includeExpired === 'true'
    );
    
    res.json(result);
}));

// Отримати партії що закінчуються терміном
router.get('/batches/expiring', handleAsync(async (req, res) => {
    const { days = 7 } = req.query;
    
    const result = await batchService.getExpiringBatches(days);
    
    res.json(result);
}));

// Резервування партій під замовлення (звичайний спосіб)
router.post('/orders/:orderId/reserve-batches', handleAsync(async (req, res) => {
    const { orderId } = req.params;
    const { allocations } = req.body;
    
    const context = {
        user: req.body.user || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    const result = await batchService.reserveBatches(allocations, context);
    
    res.json({
        ...result,
        order_id: parseInt(orderId)
    });
}));

// Списання партії
router.post('/batches/:batchId/writeoff', handleAsync(async (req, res) => {
    const { batchId } = req.params;
    const { quantity, reason, responsible, notes } = req.body;
    
    if (!quantity || !reason || !responsible) {
        return res.status(400).json({
            success: false,
            error: 'Обов\'язкові поля: quantity, reason, responsible'
        });
    }
    
    const context = {
        user: responsible,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        log_operation: true
    };
    
    const result = await batchService.writeoffBatch(
        batchId, 
        quantity, 
        reason, 
        responsible, 
        notes || '',
        context
    );
    
    res.json(result);
}));

// Отримати доступність товару
router.get('/products/:productId/availability', handleAsync(async (req, res) => {
    const { productId } = req.params;
    
    const result = await batchService.getProductAvailability(productId);
    
    res.json(result);
}));

// НОВІ роути для редагування замовлень з партіями

// Звільнити всі резерви замовлення
router.post('/orders/:orderId/unreserve-batches', handleAsync(async (req, res) => {
    const { orderId } = req.params;
    const { orderItems } = req.body; // Масив позицій замовлення з allocated_batches
    
    const context = {
        user: req.body.user || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    const result = await batchService.unreserveBatchesForOrder(orderId, orderItems, context);
    
    res.json(result);
}));

// Зарезервувати партії для позицій замовлення (автоматично FIFO)
router.post('/orders/:orderId/reserve-batches-items', handleAsync(async (req, res) => {
    const { orderId } = req.params;
    const { items } = req.body; // [{ product_id, quantity, notes }]
    
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({
            success: false,
            error: 'Некоректні дані позицій замовлення'
        });
    }
    
    const context = {
        user: req.body.user || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    };
    
    const result = await batchService.reserveBatchesForOrderItems(orderId, items, context);
    
    res.json(result);
}));

module.exports = router;