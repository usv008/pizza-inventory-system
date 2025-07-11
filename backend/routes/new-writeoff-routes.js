// routes/new-writeoff-routes.js - Нові роути для writeoffs

const express = require('express');
const NewWriteoffController = require('../controllers/new-writeoff-controller');

const router = express.Router();

// Новий API для створення writeoffs
router.post('/new-writeoff', NewWriteoffController.createWriteoff);

// Статус writeoffs
router.get('/writeoff-status', NewWriteoffController.getWriteoffStatus);

module.exports = router; 