const express = require('express');
const router = express.Router();

console.log('🔥 [TEST-ROUTER] Creating test router');

router.get('/', (req, res) => {
    console.log('🔥 [TEST-ROUTER] GET / called');
    res.json({
        success: true,
        data: [{ id: 999, username: "TEST_USER", from: "test-router" }],
        message: "This is from TEST router!"
    });
});

router.get('/test', (req, res) => {
    console.log('🔥 [TEST-ROUTER] GET /test called');
    res.json({ message: "Test endpoint works!" });
});

console.log('🔥 [TEST-ROUTER] Router created, exporting...');

module.exports = router; 