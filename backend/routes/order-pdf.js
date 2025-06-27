// backend/routes/order-pdf.js - ПОВНА ЗАМІНА без Puppeteer
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Глобальні змінні для залежностей
let orderQueries, productQueries;

// Функція ініціалізації залежностей
function initPdfRoutes(dependencies) {
    console.log('[HTML Router] Ініціалізація HTML роутів...');
    orderQueries = dependencies.orderQueries;
    productQueries = dependencies.productQueries;
    
    if (!orderQueries || !productQueries) {
        console.error('[HTML Router] ПОМИЛКА: Не всі залежності передані!');
        console.error('[HTML Router] orderQueries:', !!orderQueries);
        console.error('[HTML Router] productQueries:', !!productQueries);
    } else {
        console.log('[HTML Router] ✅ HTML роути ініціалізовані успішно');
    }
}

// Альтернативний спосіб отримання залежностей
function getDependencies() {
    if (!orderQueries || !productQueries) {
        try {
            const database = require('../database');
            orderQueries = database.orderQueries;
            productQueries = database.productQueries;
            console.log('[HTML Router] Залежності отримані з database.js');
        } catch (err) {
            console.error('[HTML Router] Помилка отримання залежностей:', err.message);
            return false;
        }
    }
    return !!(orderQueries && productQueries);
}

// Функція для читання HTML шаблону
function loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '..', 'templates', templateName);
    console.log('[HTML Router] Шукаємо шаблон:', templatePath);
    
    if (fs.existsSync(templatePath)) {
        console.log('[HTML Router] ✅ Шаблон знайдено');
        return fs.readFileSync(templatePath, 'utf8');
    } else {
        console.error('[HTML Router] ❌ Шаблон не знайдено:', templatePath);
        return null;
    }
}

// Функція для заміни плейсхолдерів
function replacePlaceholders(template, data) {
    let html = template;
    
    Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = data[key] || '';
        html = html.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return html;
}

// Функція для генерації рядків таблиці товарів
function generateItemsRows(items) {
    if (!items || items.length === 0) {
        return '<tr><td colspan="7" style="text-align: center; color: #666;">Немає товарів</td></tr>';
    }
    
    return items.map((item, index) => {
        const boxes = Math.floor(item.quantity / (item.pieces_per_box || 1)) || 0;
        const pieces = item.quantity % (item.pieces_per_box || 1) || 0;
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td class="text-left"><strong>${escapeHtml(item.product_name || '')}</strong></td>
                <td>${escapeHtml(item.product_code || '')}</td>
                <td><strong>${item.quantity || 0}</strong></td>
                <td>${boxes}</td>
                <td>${pieces}</td>
                <td class="text-left">${escapeHtml(item.notes || '')}</td>
            </tr>
        `;
    }).join('');
}

// Функція для екранування HTML
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Функція для отримання тексту статусу
function getStatusInfo(status) {
    const statusMap = {
        'NEW': { text: 'Нове', class: 'new' },
        'CONFIRMED': { text: 'Підтверджене', class: 'confirmed' },
        'IN_PRODUCTION': { text: 'Виробництво', class: 'in_production' },
        'READY': { text: 'Готове', class: 'ready' },
        'SHIPPED': { text: 'Відвантажене', class: 'shipped' },
        'COMPLETED': { text: 'Завершене', class: 'completed' }
    };
    
    return statusMap[status] || { text: status, class: 'new' };
}

// Функція для форматування дати
function formatDate(dateString) {
    if (!dateString) return 'Не вказана';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

// Функція для завантаження логотипу
function getLogoBase64() {
    // Пробуємо різні можливі шляхи до логотипу
    const possiblePaths = [
        path.join(__dirname, '..', 'public', 'images', 'logo.png'),
        path.join(__dirname, '..', 'public', 'logo.png'),
        path.join(__dirname, '..', 'images', 'logo.png'),
        path.join(__dirname, '..', 'logo.png'),
        path.join(__dirname, '..', '..', 'logo.png')
    ];
    
    for (const logoPath of possiblePaths) {
        try {
            if (fs.existsSync(logoPath)) {
                console.log(`[HTML Router] ✅ Логотип знайдено: ${logoPath}`);
                const logoBuffer = fs.readFileSync(logoPath);
                const logoBase64 = logoBuffer.toString('base64');
                return `data:image/png;base64,${logoBase64}`;
            }
        } catch (error) {
            console.error(`[HTML Router] Помилка завантаження логотипу з ${logoPath}:`, error.message);
        }
    }
    
    console.log('[HTML Router] ⚠️ Логотип не знайдено в жодному з шляхів');
    return null;
}

// Функція для підготовки даних замовлення
async function prepareOrderData(order) {
    let itemsWithDetails = [];
    
    if (order.items && order.items.length > 0) {
        for (const item of order.items) {
            try {
                const product = await productQueries.getById(item.product_id);
                itemsWithDetails.push({
                    ...item,
                    pieces_per_box: product ? product.pieces_per_box : 1
                });
            } catch (err) {
                console.error(`[HTML Router] Помилка отримання товару ${item.product_id}:`, err);
                itemsWithDetails.push({
                    ...item,
                    pieces_per_box: 1
                });
            }
        }
    }

    const totalQuantity = itemsWithDetails.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalBoxes = itemsWithDetails.reduce((sum, item) => {
        const boxes = Math.floor((item.quantity || 0) / (item.pieces_per_box || 1));
        return sum + boxes;
    }, 0);

    const statusInfo = getStatusInfo(order.status);
    const logoDataUrl = getLogoBase64();
    
    // Генеруємо правильний HTML для логотипу
    let logoContent;
    if (logoDataUrl) {
        logoContent = `<img src="${logoDataUrl}" alt="FROST PULSE Logo" class="logo">`;
        console.log('[HTML Router] ✅ Логотип буде відображено');
    } else {
        logoContent = `<div class="logo-placeholder">ЛОГОТИП<br>FROST PULSE</div>`;
        console.log('[HTML Router] ⚠️ Відображається заглушка логотипу');
    }
    
    return {
        order,
        itemsWithDetails,
        totalQuantity,
        totalBoxes,
        statusInfo,
        templateData: {
            ORDER_NUMBER: order.order_number || '',
            ORDER_DATE: formatDate(order.order_date),
            DELIVERY_DATE: formatDate(order.delivery_date),
            CLIENT_NAME: order.client_name || '',
            CLIENT_CONTACT: order.client_contact || '',
            STATUS_TEXT: statusInfo.text,
            STATUS_CLASS: statusInfo.class,
            CREATED_BY: order.created_by || '',
            ORDER_NOTES: order.notes || 'Немає особливих вимог',
            ITEMS_ROWS: generateItemsRows(itemsWithDetails),
            TOTAL_QUANTITY: totalQuantity,
            TOTAL_BOXES: totalBoxes,
            ITEMS_COUNT: itemsWithDetails.length,
            LOGO_CONTENT: logoContent,  // ЗМІНЕНО: тепер готовий HTML
            PRINT_DATE: new Date().toLocaleDateString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        }
    };
}

// ЕНДПОІНТ ДЛЯ HTML ПРЕВЬЮ (основний для друку)
router.get('/orders/:id/preview', async (req, res) => {
    try {
        console.log(`[HTML Router] Генерація HTML для замовлення ${req.params.id}`);
        
        if (!getDependencies()) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const order = await orderQueries.getById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        const template = loadTemplate('order_print.html');
        if (!template) {
            return res.status(500).json({ error: 'Шаблон не знайдено' });
        }

        const orderData = await prepareOrderData(order);
        const finalHtml = replacePlaceholders(template, orderData.templateData);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(finalHtml);

        console.log(`[HTML Router] ✅ HTML для замовлення ${order.order_number} згенеровано успішно`);

    } catch (error) {
        console.error('[HTML Router] ❌ Помилка генерації HTML:', error);
        res.status(500).json({ 
            error: 'Помилка генерації HTML',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ЗАЛИШАЄМО PDF ЕНДПОІНТ ЯК ЗАГЛУШКУ (переадресація на HTML)
router.get('/orders/:id/pdf', async (req, res) => {
    console.log(`[HTML Router] PDF запит переадресовано на HTML для замовлення ${req.params.id}`);
    
    // Переадресовуємо на HTML версію
    res.redirect(`/api/orders/${req.params.id}/preview`);
});

// Експорт
module.exports = {
    router,
    initPdfRoutes
};