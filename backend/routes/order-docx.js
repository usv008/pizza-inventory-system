const express = require('express');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { orderQueries } = require('../supabase-database');

const router = express.Router();

router.get('/api/orders/:id/docx', async (req, res) => {
    try {
        console.log('DOCX: старт роута для orderId', req.params.id);
        const order = await orderQueries.getById(req.params.id);
        if (!order) {
            console.error('DOCX: замовлення не знайдено');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        const templatePath = path.join(__dirname, '../templates', 'order_template.docx');
        console.log('DOCX: шлях до шаблону', templatePath);
        if (!fs.existsSync(templatePath)) {
            console.error('DOCX: шаблон не знайдено');
            return res.status(500).json({ error: 'Шаблон не знайдено' });
        }
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        const data = {
            order_number: order.order_number,
            client_name: order.client_name,
            order_date: order.order_date,
            delivery_date: order.delivery_date || '',
            status: order.status,
            created_by: order.created_by,
            notes: order.notes || '',
            // Додай інші поля за потреби
        };
        console.log('DOCX: дані для шаблону', data);

        doc.setData(data);

        try {
            doc.render();
        } catch (err) {
            const e = err;
            console.error('DOCX: помилка рендеру шаблону', e);
            if (e.errors) {
                e.errors.forEach((error, i) => {
                    console.error(`DOCX: шаблон помилка #${i + 1}:`, error);
                });
            }
            return res.status(500).json({ error: 'Помилка рендеру шаблону', details: e.message, errors: e.errors });
        }

        const buf = doc.getZip().generate({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=order_${order.order_number}.docx`);
        res.send(buf);
    } catch (error) {
        console.error('DOCX generation error:', error);
        res.status(500).json({ error: 'Помилка генерації DOCX', details: error.message });
    }
});

module.exports = router; 