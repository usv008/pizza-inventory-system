const express = require('express');
const router = express.Router();

// Middleware and error handling
const { handleAsync } = require('../middleware/responseFormatter');
const { ValidationError, NotFoundError } = require('../middleware/errors/AppError');

// Validators
const { validateOrder, validateOrderId, validateOrderStatus, validateOrderUpdate } = require('../validators/orderValidator');

// Service
const orderService = require('../services/orderService');

/**
 * @api {get} /api/orders Get all orders
 * @apiDescription Отримати список всіх замовлень з можливістю фільтрації
 */
router.get('/', handleAsync(async (req, res) => {
    const { status, client_id, date_from, date_to, limit, offset } = req.query;
    
    const filters = {
        status: status || null,
        client_id: client_id ? parseInt(client_id) : null,
        date_from: date_from || null,
        date_to: date_to || null,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    };
    
    const orders = await orderService.getAllOrders(filters);
    
    res.json({
        success: true,
        data: orders,
        meta: {
            total: orders.length,
            filters: filters,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/orders/:id Get order by ID
 * @apiDescription Отримати замовлення за ID з повною інформацією включаючи позиції та партії
 */
router.get('/:id', validateOrderId, handleAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    
    if (!order) {
        throw new NotFoundError('Замовлення не знайдено');
    }
    
    res.json({
        success: true,
        data: order,
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/orders/:id/edit Get order for editing
 * @apiDescription Отримати замовлення для редагування з додатковою інформацією про товари
 */
router.get('/:id/edit', validateOrderId, handleAsync(async (req, res) => {
    const orderData = await orderService.getOrderForEdit(req.params.id);
    
    if (!orderData.order) {
        throw new NotFoundError('Замовлення не знайдено');
    }
    
    res.json({
        success: true,
        data: orderData,
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/orders Create new order
 * @apiDescription Створити нове замовлення з автоматичним резервуванням партій
 */
router.post('/', validateOrder, handleAsync(async (req, res) => {
    const orderData = {
        client_id: req.body.client_id || null,
        client_name: req.body.client_name,
        client_contact: req.body.client_contact || '',
        order_date: req.body.order_date,
        delivery_date: req.body.delivery_date || null,
        notes: req.body.notes || '',
        created_by: req.body.created_by || 'system',
        items: req.body.items.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            notes: item.notes || ''
        }))
    };
    
    const result = await orderService.createOrder(orderData, {
        user_name: orderData.created_by,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.status(201).json({
        success: true,
        data: {
            id: result.id,
            order_number: result.order_number,
            message: 'Замовлення створено успішно',
            batch_reservations: result.batch_reservations || null,
            warnings: result.warnings || null
        },
        meta: {
            operation: 'create',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {put} /api/orders/:id Update order
 * @apiDescription Оновити замовлення з перерезервуванням партій
 */
router.put('/:id', validateOrderId, validateOrderUpdate, handleAsync(async (req, res) => {
    const orderData = {
        client_name: req.body.client_name,
        client_contact: req.body.client_contact || '',
        delivery_date: req.body.delivery_date || null,
        notes: req.body.notes || '',
        status: req.body.status,
        items: req.body.items ? req.body.items.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            notes: item.notes || ''
        })) : null
    };
    
    const result = await orderService.updateOrder(req.params.id, orderData, {
        user_name: req.body.updated_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Замовлення оновлено успішно',
            batch_reservations: result.batch_reservations || null,
            warnings: result.warnings || null
        },
        meta: {
            operation: 'update',
            affected_rows: result.changes || 1,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {patch} /api/orders/:id/status Update order status
 * @apiDescription Оновити статус замовлення
 */
router.patch('/:id/status', validateOrderId, validateOrderStatus, handleAsync(async (req, res) => {
    const { status, updated_by } = req.body;
    
    const result = await orderService.updateOrderStatus(req.params.id, status, {
        user_name: updated_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Статус замовлення оновлено успішно'
        },
        meta: {
            operation: 'status_update',
            new_status: status,
            affected_rows: result.changes,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {delete} /api/orders/:id/cancel Cancel order
 * @apiDescription Скасувати замовлення (перевести в статус CANCELLED)
 */
router.delete('/:id/cancel', validateOrderId, handleAsync(async (req, res) => {
    const result = await orderService.cancelOrder(req.params.id, {
        user_name: req.body.cancelled_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Замовлення скасовано успішно'
        },
        meta: {
            operation: 'cancel',
            affected_rows: result.changes,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {delete} /api/orders/:id Delete order
 * @apiDescription Повністю видалити замовлення з бази даних
 */
router.delete('/:id', validateOrderId, handleAsync(async (req, res) => {
    const result = await orderService.deleteOrder(req.params.id, {
        user_name: req.body.deleted_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Замовлення видалено успішно',
            deleted_order: result.deleted_order
        },
        meta: {
            operation: 'delete',
            affected_rows: result.changes,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {get} /api/orders/stats Order statistics
 * @apiDescription Отримати статистику замовлень
 */
router.get('/stats', handleAsync(async (req, res) => {
    const { period } = req.query; // day, week, month, year
    const stats = await orderService.getOrderStats(period || 'month');
    
    res.json({
        success: true,
        data: stats,
        meta: {
            period: period || 'month',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/orders/:id/reserve-batches Reserve batches for order
 * @apiDescription Зарезервувати партії для замовлення (ручне резервування)
 */
router.post('/orders/:id/reserve-batches', validateOrderId, handleAsync(async (req, res) => {
    const result = await orderService.reserveBatchesForOrder(req.params.id, {
        user_name: req.body.reserved_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Партії зарезервовано успішно',
            reservations: result.reservations,
            warnings: result.warnings || null
        },
        meta: {
            operation: 'reserve_batches',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {delete} /api/orders/:id/unreserve-batches Unreserve batches for order
 * @apiDescription Звільнити зарезервовані партії для замовлення
 */
router.delete('/orders/:id/unreserve-batches', validateOrderId, handleAsync(async (req, res) => {
    const result = await orderService.unreserveBatchesForOrder(req.params.id, {
        user_name: req.body.unreserved_by || 'system',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Партії звільнено успішно'
        },
        meta: {
            operation: 'unreserve_batches',
            freed_batches: result.freed_count || 0,
            timestamp: new Date().toISOString()
        }
    });
}));

module.exports = router; 