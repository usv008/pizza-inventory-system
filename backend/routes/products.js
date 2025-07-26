const express = require('express');
const router = express.Router();
const productService = require('../services/productService-v2');
const { validateProduct, validateProductId } = require('../validators/productValidator');
const responseFormatter = require('../middleware/responseFormatter');

/**
 * Products Router
 * Всі роути для роботи з товарами винесені з app.js
 * Використовує standardized responses згідно creative-api-design.md
 */

// GET /api/products - отримати всі товари
router.get('/products', async (req, res, next) => {
    try {
        const products = await productService.getAllProducts();
        res.json(responseFormatter.formatCollection(products));
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id - отримати товар за ID
router.get('/products/:id', validateProductId, async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.productId);
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
        
        const result = await productService.createProduct(req.validatedData, userContext);
        
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
        
        const result = await productService.updateProduct(req.productId, req.validatedData, userContext);
        
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
        
        await productService.deleteProduct(req.productId, userContext);
        
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
            stock_boxes: req.body.stock_boxes
        };
        
        await productService.updateProductStock(req.productId, stockData, userContext);
        
        res.json(responseFormatter.formatUpdated(null, 'Склад товару оновлено успішно'));
    } catch (error) {
        next(error);
    }
});

// Legacy compatibility route - GET /api/pizzas (для сумісності зі старим frontend)
router.get('/pizzas', async (req, res, next) => {
    try {
        const products = await productService.getAllProducts();
        
        // Перетворюємо в старий формат для сумісності
        const pizzas = products.map(p => ({
            id: p.id,
            name: p.name,
            stock: p.stock_pieces
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

module.exports = router; 