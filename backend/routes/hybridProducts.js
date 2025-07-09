const express = require('express');
const router = express.Router();

// Phase 4 Migration: Use hybrid service instead of legacy
const hybridProductService = require('../services/hybridProductService');
const { validateProduct, validateProductId } = require('../validators/productValidator');
const responseFormatter = require('../middleware/responseFormatter');

/**
 * Hybrid Products Router - Phase 4 Migration
 * Використовує hybrid service для поступової міграції на Supabase
 * Підтримує як SQLite, так і Supabase бекенди
 */

// GET /api/products - отримати всі товари
router.get('/products', async (req, res, next) => {
    try {
        const products = await hybridProductService.getAllProducts();
        res.json(responseFormatter.formatCollection(products));
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id - отримати товар за ID
router.get('/products/:id', validateProductId, async (req, res, next) => {
    try {
        const product = await hybridProductService.getProductById(req.productId);
        res.json(responseFormatter.formatSuccess(product));
    } catch (error) {
        next(error);
    }
});

// POST /api/products - створити новий товар
router.post('/products', validateProduct, async (req, res, next) => {
    try {
        const userContext = {
            userName: req.body.created_by || 'Адміністратор системи',
            req: req
        };
        
        const result = await hybridProductService.createProduct(req.validatedData, userContext);
        
        res.status(201).json(responseFormatter.formatCreated({ id: result.id }, 'Товар створено успішно'));
    } catch (error) {
        next(error);
    }
});

// PUT /api/products/:id - оновити товар
router.put('/products/:id', validateProductId, validateProduct, async (req, res, next) => {
    try {
        const userContext = {
            userName: req.body.updated_by || 'Адміністратор системи',
            req: req
        };
        
        const result = await hybridProductService.updateProduct(req.productId, req.validatedData, userContext);
        
        res.json(responseFormatter.formatUpdated({ id: req.productId }, 'Товар оновлено успішно'));
    } catch (error) {
        next(error);
    }
});

// DELETE /api/products/:id - видалити товар
router.delete('/products/:id', validateProductId, async (req, res, next) => {
    try {
        const userContext = {
            userName: (req.body && req.body.deleted_by) || 'Адміністратор системи',
            req: req
        };
        
        await hybridProductService.deleteProduct(req.productId, userContext);
        
        res.json(responseFormatter.formatDeleted('Товар видалено успішно'));
    } catch (error) {
        next(error);
    }
});

// POST /api/products/:id/stock - оновити склад товару
router.post('/products/:id/stock', validateProductId, async (req, res, next) => {
    try {
        const userContext = {
            userName: req.body.updated_by || 'Адміністратор системи',
            req: req
        };
        
        const stockData = {
            stock_pieces: req.body.stock_pieces,
            stock_boxes: req.body.stock_boxes,
            current_stock: req.body.current_stock || req.body.stock_pieces,
            reason: req.body.reason || 'Manual stock adjustment',
            movement_type: req.body.movement_type || 'ADJUSTMENT'
        };
        
        await hybridProductService.updateProductStock(req.productId, stockData, userContext);
        
        res.json(responseFormatter.formatUpdated(null, 'Склад товару оновлено успішно'));
    } catch (error) {
        next(error);
    }
});

// Legacy compatibility route - GET /api/pizzas (для сумісності зі старим frontend)
router.get('/pizzas', async (req, res, next) => {
    try {
        const products = await hybridProductService.getAllProducts();
        
        // Перетворюємо в старий формат для сумісності
        const pizzas = products.map(p => ({
            id: p.id,
            name: p.name,
            stock: p.stock_pieces || p.current_stock || 0
        }));
        
        // Для legacy роуту використовуємо старий формат (без wrapper)
        res.json(pizzas);
    } catch (error) {
        // Fallback дані якщо сервіс недоступний
        const fallbackPizzas = [
            { id: 1, name: 'Маргарита', stock: 15 },
            { id: 2, name: 'Пепероні', stock: 8 },
            { id: 3, name: 'Гавайська', stock: 12 }
        ];
        res.json(fallbackPizzas);
    }
});

// Migration status endpoint (for debugging and monitoring)
router.get('/migration-status', async (req, res, next) => {
    try {
        const status = hybridProductService.getMigrationStatus();
        const connectivity = await hybridProductService.testConnectivity();
        
        res.json({
            status: 'success',
            data: {
                migration: status,
                connectivity: connectivity,
                timestamp: new Date().toISOString()
            },
            message: 'Migration status retrieved successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Migration control endpoints (for dynamic configuration)
router.post('/migration-config', async (req, res, next) => {
    try {
        const newConfig = req.body;
        hybridProductService.updateMigrationConfig(newConfig);
        
        res.json({
            status: 'success',
            data: hybridProductService.getMigrationStatus(),
            message: 'Migration configuration updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Emergency fallback endpoint
router.post('/emergency-fallback', async (req, res, next) => {
    try {
        hybridProductService.emergencyFallbackToLegacy();
        
        res.json({
            status: 'success',
            data: hybridProductService.getMigrationStatus(),
            message: 'Emergency fallback to legacy activated'
        });
    } catch (error) {
        next(error);
    }
});

// Enable full Supabase mode
router.post('/enable-supabase', async (req, res, next) => {
    try {
        hybridProductService.enableFullSupabaseMode();
        
        res.json({
            status: 'success',
            data: hybridProductService.getMigrationStatus(),
            message: 'Full Supabase mode enabled'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router; 