const express = require('express');
const router = express.Router();
const arrivalController = require('../controllers/arrival-controller');

/**
 * Arrival Routes
 * REST API для приходування товарів
 */

// Отримати всі документи приходу
// GET /api/arrivals
router.get('/', arrivalController.getAllArrivals);

// Отримати документ приходу за ID
// GET /api/arrivals/:id
router.get('/:id', arrivalController.getArrivalById);

// Створити документ приходу
// POST /api/arrivals
router.post('/', arrivalController.createArrival);

module.exports = router; 