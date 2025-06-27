const express = require('express');
const router = express.Router();
const arrivalController = require('../controllers/arrival-controller');


// Створити документ приходу
router.post('/', arrivalController.createArrival);

module.exports = router; 