// routes/operations-log-routes.js - Роути для логування операцій

const express = require('express');
const OperationsLogController = require('../controllers/operations-log-controller');

const router = express.Router();

// Отримати логи з фільтрами
router.get('/logs', OperationsLogController.getLogs);

// Отримати статистику операцій
router.get('/logs/stats', OperationsLogController.getOperationsStats);

// Отримати операції по конкретній сутності
router.get('/logs/entity/:entity_type/:entity_id', OperationsLogController.getEntityOperations);

module.exports = router;