// routes/order-update-routes.js - Роути для оновлення замовлень з логуванням

const express = require('express');
const router = express.Router();

// Отримати замовлення для редагування
router.get('/orders/:id/edit', async (req, res) => {
    console.log('=== GET /orders/:id/edit викликано ===');
    console.log('Order ID:', req.params.id);
    
    try {
        const { orderQueries, productQueries } = require('../database');
        
        if (!orderQueries) {
            console.log('База даних недоступна');
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const order = await orderQueries.getById(req.params.id);
        if (!order) {
            console.log('Замовлення не знайдено');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        // Отримуємо також список всіх товарів для форми редагування
        const products = await productQueries.getAll();
        
        console.log('Відправляємо дані замовлення та товарів');
        res.json({
            order,
            products
        });
    } catch (error) {
        console.error('Помилка отримання замовлення для редагування:', error);
        res.status(500).json({ error: 'Помилка сервера: ' + error.message });
    }
});

// Оновити замовлення (спрощена версія без логування операцій)
router.put('/orders/:id', async (req, res) => {
    console.log('=== PUT /orders/:id викликано ===');
    console.log('Order ID:', req.params.id);
    console.log('Request body:', req.body);
    
    try {
        const { orderQueries } = require('../database');
        const orderId = parseInt(req.params.id);
        
        if (!orderQueries) {
            console.log('База даних недоступна');
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        // Отримуємо старе замовлення
        const oldOrder = await orderQueries.getById(orderId);
        if (!oldOrder) {
            console.log('Замовлення не знайдено');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        const { 
            client_name, 
            client_contact, 
            delivery_date, 
            notes, 
            status,
            updated_by = 'system',
            items = []
        } = req.body;
        
        // Валідація
        if (!client_name) {
            console.log('Назва клієнта обов\'язкова');
            return res.status(400).json({ error: 'Назва клієнта обов\'язкова' });
        }
        
        const { db } = require('../database');
        
        // Простий UPDATE без позицій (для початку)
        console.log('Оновлюємо основну інформацію замовлення...');
        
        db.run(`UPDATE orders 
               SET client_name = ?, client_contact = ?, delivery_date = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
               [client_name, client_contact, delivery_date, notes, status || oldOrder.status, orderId],
               function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Помилка оновлення замовлення: ' + err.message });
            }
            
            console.log('Замовлення оновлено, змін:', this.changes);
            
            // Якщо передані items - попереджуємо що вони не оновлюються поки що
            if (items.length > 0) {
                console.log('Попередження: позиції замовлення не оновлюються в цій версії');
            }
            
            res.json({ 
                message: 'Замовлення оновлено успішно (основна інформація)',
                updated: this.changes > 0,
                warning: items.length > 0 ? 'Позиції замовлення не оновлювалися' : null
            });
        });
        
    } catch (error) {
        console.error('Помилка оновлення замовлення:', error);
        res.status(500).json({ error: 'Помилка сервера: ' + error.message });
    }
});

module.exports = router;