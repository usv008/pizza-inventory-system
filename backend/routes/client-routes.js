const express = require('express');
const router = express.Router();

// Middleware and error handling
const { handleAsync } = require('../middleware/responseFormatter');
const { ValidationError, NotFoundError } = require('../middleware/errors/AppError');

// Validators
const { validateClient, validateClientId } = require('../validators/clientValidator');

// Service
const clientService = require('../services/clientService');

/**
 * @api {get} /api/clients Get all clients
 * @apiDescription Отримати список всіх активних клієнтів
 */
router.get('/', handleAsync(async (req, res) => {
    const clients = await clientService.getAllClients();
    
    // Return clean array for frontend compatibility (no wrapper)
    res.json(clients);
}));

/**
 * @api {get} /api/clients/:id Get client by ID
 * @apiDescription Отримати клієнта за ID
 */
router.get('/:id', validateClientId, handleAsync(async (req, res) => {
    const client = await clientService.getClientById(req.params.id);
    
    if (!client) {
        throw new NotFoundError('Клієнта не знайдено');
    }
    
    res.json({
        success: true,
        data: client,
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {post} /api/clients Create new client
 * @apiDescription Створити нового клієнта
 */
router.post('/', validateClient, handleAsync(async (req, res) => {
    const clientData = {
        name: req.body.name,
        contact_person: req.body.contact_person || '',
        phone: req.body.phone || '',
        email: req.body.email || '',
        address: req.body.address || '',
        notes: req.body.notes || ''
    };
    
    const result = await clientService.createClient(clientData, {
        user_name: req.body.created_by || 'Комерційний директор',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.status(201).json({
        success: true,
        data: {
            id: result.id,
            message: 'Клієнта створено успішно'
        },
        meta: {
            operation: 'create',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {put} /api/clients/:id Update client
 * @apiDescription Оновити інформацію про клієнта
 */
router.put('/:id', validateClientId, validateClient, handleAsync(async (req, res) => {
    const clientData = {
        name: req.body.name,
        contact_person: req.body.contact_person || '',
        phone: req.body.phone || '',
        email: req.body.email || '',
        address: req.body.address || '',
        notes: req.body.notes || ''
    };
    
    const result = await clientService.updateClient(req.params.id, clientData, {
        user_name: req.body.updated_by || 'Комерційний директор',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Клієнта оновлено успішно'
        },
        meta: {
            operation: 'update',
            affected_rows: result.changes,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * @api {delete} /api/clients/:id Deactivate client
 * @apiDescription Деактивувати клієнта (soft delete)
 */
router.delete('/:id', validateClientId, handleAsync(async (req, res) => {
    const result = await clientService.deactivateClient(req.params.id, {
        user_name: req.body.deleted_by || 'Система',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
    });
    
    res.json({
        success: true,
        data: {
            message: 'Клієнта деактивовано успішно'
        },
        meta: {
            operation: 'deactivate',
            affected_rows: result.changes,
            timestamp: new Date().toISOString()
        }
    });
}));

module.exports = router; 