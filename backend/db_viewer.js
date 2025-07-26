// db_viewer.js - Простий веб-інтерфейс для перегляду БД
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

const db = new sqlite3.Database('./pizza_inventory.db');

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Pizza Inventory DB Viewer</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .query-form { margin: 20px 0; }
                textarea { width: 100%; height: 100px; }
                button { padding: 10px 20px; background: #007cba; color: white; border: none; cursor: pointer; margin: 5px; }
                .warning { background: #d63384 !important; }
                .success { color: green; }
                .error { color: red; }
            </style>
        </head>
        <body>
            <h1>🍕 Pizza Inventory Database Viewer</h1>
            
            <div class="query-form">
                <h3>Виконати SQL запит:</h3>
                <form action="/query" method="post">
                    <textarea name="sql" placeholder="SELECT * FROM orders WHERE id = 19;"></textarea><br>
                    <button type="submit">Виконати SELECT</button>
                </form>
            </div>
            
            <div class="query-form">
                <h3>Редагувати дані (INSERT/UPDATE/DELETE):</h3>
                <form action="/execute" method="post">
                    <textarea name="sql" placeholder="UPDATE products SET stock_pieces = 100 WHERE id = 1;"></textarea><br>
                    <button type="submit" style="background: #d63384;">Виконати зміни</button>
                </form>
            </div>
            
            <h3>Швидкі запити:</h3>
            <a href="/table/orders">📋 Замовлення</a> |
            <a href="/table/products">📦 Товари</a> |
            <a href="/table/order_items">📝 Позиції замовлень</a> |
            <a href="/table/clients">👥 Клієнти</a> |
            <a href="/table/operations_log">📊 Логи операцій</a>
            
            <h3>Конкретне замовлення:</h3>
            <a href="/order/19">🔍 Замовлення #19</a>
        </body>
        </html>
    `);
});

app.use(express.urlencoded({ extended: true }));

app.post('/query', (req, res) => {
    const sql = req.body.sql;
    
    db.all(sql, (err, rows) => {
        if (err) {
            res.send(`<h2 class="error">Помилка:</h2><pre>${err.message}</pre><a href="/">← Назад</a>`);
            return;
        }
        
        let html = '<h2 class="success">Результати запиту:</h2><table><thead>';
        
        if (rows.length > 0) {
            // Headers
            html += '<tr>';
            Object.keys(rows[0]).forEach(key => {
                html += `<th>${key}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            // Data
            rows.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(value => {
                    html += `<td>${value}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p>Немає результатів</p>';
        }
        
        html += '<a href="/">← Назад</a>';
        res.send(html);
    });
});

app.post('/execute', (req, res) => {
    const sql = req.body.sql;
    
    // Перевірка на небезпечні операції
    const dangerousOperations = ['DROP', 'TRUNCATE', 'ALTER'];
    const upperSQL = sql.toUpperCase();
    
    if (dangerousOperations.some(op => upperSQL.includes(op))) {
        res.send(`<h2 class="error">Небезпечна операція заборонена!</h2>
                  <p>Операції DROP, TRUNCATE, ALTER заборонені для безпеки</p>
                  <a href="/">← Назад</a>`);
        return;
    }
    
    db.run(sql, function(err) {
        if (err) {
            res.send(`<h2 class="error">Помилка виконання:</h2><pre>${err.message}</pre><a href="/">← Назад</a>`);
            return;
        }
        
        const result = {
            changes: this.changes,
            lastID: this.lastID
        };
        
        res.send(`<h2 class="success">Операція виконана успішно!</h2>
                  <p>Змінено рядків: ${result.changes}</p>
                  ${result.lastID ? `<p>ID нового запису: ${result.lastID}</p>` : ''}
                  <a href="/">← Назад</a>`);
    });
});

app.get('/table/:tableName', (req, res) => {
    const tableName = req.params.tableName;
    
    db.all(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 50`, (err, rows) => {
        if (err) {
            res.send(`<h2>Помилка:</h2><pre>${err.message}</pre><a href="/">← Назад</a>`);
            return;
        }
        
        let html = `<h2>Таблиця: ${tableName}</h2><table><thead>`;
        
        if (rows.length > 0) {
            // Headers
            html += '<tr>';
            Object.keys(rows[0]).forEach(key => {
                html += `<th>${key}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            // Data
            rows.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(value => {
                    html += `<td>${value}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p>Таблиця порожня</p>';
        }
        
        html += '<a href="/">← Назад</a>';
        res.send(html);
    });
});

app.get('/order/:id', (req, res) => {
    const orderId = req.params.id;
    
    db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
        if (err) {
            res.send(`<h2>Помилка:</h2><pre>${err.message}</pre><a href="/">← Назад</a>`);
            return;
        }
        
        if (!order) {
            res.send(`<h2>Замовлення #${orderId} не знайдено</h2><a href="/">← Назад</a>`);
            return;
        }
        
        let html = `<h2>Замовлення #${orderId}</h2><table>`;
        Object.entries(order).forEach(([key, value]) => {
            html += `<tr><th>${key}</th><td>${value}</td></tr>`;
        });
        html += '</table>';
        
        // Позиції замовлення
        db.all(`SELECT oi.*, p.name as product_name FROM order_items oi 
                LEFT JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?`, [orderId], (err, items) => {
            if (!err && items.length > 0) {
                html += '<h3>Позиції замовлення:</h3><table><thead><tr>';
                Object.keys(items[0]).forEach(key => {
                    html += `<th>${key}</th>`;
                });
                html += '</tr></thead><tbody>';
                
                items.forEach(item => {
                    html += '<tr>';
                    Object.values(item).forEach(value => {
                        html += `<td>${value}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table>';
            }
            
            html += '<a href="/">← Назад</a>';
            res.send(html);
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔍 DB Viewer запущено на http://localhost:${PORT}`);
    console.log(`🔍 Або http://116.203.116.234:${PORT}`);
});