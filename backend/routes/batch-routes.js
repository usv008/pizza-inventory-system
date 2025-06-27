// routes/batch-routes.js - Роути для управління партіями

const express = require('express');
const BatchController = require('../controllers/batch-controller');

const router = express.Router();

// Отримати всі партії з групуванням по товарах (для головної сторінки)
router.get('/batches/grouped', BatchController.getAllBatchesGrouped);

// Отримати партії товару
router.get('/products/:productId/batches', BatchController.getBatchesByProduct);

// Отримати партії що закінчуються терміном
router.get('/batches/expiring', BatchController.getExpiringBatches);

// Резервування партій під замовлення
router.post('/orders/:orderId/reserve-batches', BatchController.reserveBatches);

// Списання партії
router.post('/batches/:batchId/writeoff', BatchController.writeoffBatch);

// Отримати доступність товару
router.get('/products/:productId/availability', BatchController.getProductAvailability);

// НОВІ роути для редагування замовлень з партіями
router.post('/orders/:orderId/unreserve-batches', BatchController.unreserveBatchesForOrder);
router.post('/orders/:orderId/reserve-batches-items', BatchController.reserveBatchesForOrderItems);

module.exports = router;