/**
 * Movement Service
 * Сервіс для роботи з рухами товарів (stock_movements)
 */

let movementsQueries, productQueries, OperationsLogController;

const MovementService = {
    // Ініціалізація сервісу з залежностями
    initialize(dependencies) {
        movementsQueries = dependencies.movementsQueries;
        productQueries = dependencies.productQueries;
        OperationsLogController = dependencies.OperationsLogController;
        console.log('✅ MovementService ініціалізовано з залежностями');
    },

    // Отримання всіх рухів з фільтрацією
    async getAllMovements(filters = {}) {
        try {
            if (!movementsQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            // Підготовка фільтрів для запиту
            const queryFilters = {};
            
            if (filters.product_id) {
                queryFilters.product_id = parseInt(filters.product_id);
            }
            
            if (filters.movement_type && filters.movement_type !== 'ALL') {
                queryFilters.movement_type = filters.movement_type;
            }
            
            if (filters.date_from) {
                queryFilters.date_from = filters.date_from;
            }
            
            if (filters.date_to) {
                queryFilters.date_to = filters.date_to;
            }
            
            if (filters.user) {
                queryFilters.user = filters.user;
            }

            // Встановлюємо ліміт та offset
            const limit = filters.limit ? parseInt(filters.limit) : 200;
            const offset = filters.offset ? parseInt(filters.offset) : 0;
            
            queryFilters.limit = limit;
            queryFilters.offset = offset;

            const movements = await movementsQueries.getAll(queryFilters);
            
            return {
                success: true,
                data: movements,
                pagination: {
                    limit,
                    offset,
                    count: movements.length
                },
                filters: filters
            };
        } catch (error) {
            console.error('[MovementService.getAllMovements] Помилка:', error);
            throw error;
        }
    },

    // Створення нового руху товару
    async createMovement(movementData, requestInfo = {}) {
        try {
            if (!movementsQueries || !productQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            const { product_id, movement_type, pieces, boxes, reason, user = 'system', batch_id, batch_date } = movementData;

            // Перевіряємо чи існує товар
            const product = await productQueries.getById(product_id);
            if (!product) {
                throw new Error(`Товар з ID ${product_id} не знайдено`);
            }

            // Для OUT рухів перевіряємо наявність товару
            if (movement_type === 'OUT' || movement_type === 'WRITEOFF') {
                if (product.stock_pieces < pieces) {
                    throw new Error(`Недостатньо товару на складі. Наявно: ${product.stock_pieces}, потрібно: ${pieces}`);
                }
            }

            // Створюємо рух в базі
            const movementId = await this._createMovementRecord({
                product_id,
                movement_type,
                pieces,
                boxes,
                reason,
                user,
                batch_id,
                batch_date
            });

            // Оновлюємо залишки товару
            await this._updateProductStock(product_id, movement_type, pieces);

            // Отримуємо створений рух для відповіді
            const newMovement = await this._getMovementById(movementId);

            // Логуємо операцію
            await this._logMovementOperation('CREATE', newMovement, requestInfo);

            return {
                success: true,
                data: newMovement,
                message: `Рух товару створено успішно`
            };
        } catch (error) {
            console.error('[MovementService.createMovement] Помилка:', error);
            throw error;
        }
    },

    // Оновлення руху (обмежене - тільки reason та user)
    async updateMovement(id, updateData, requestInfo = {}) {
        try {
            if (!movementsQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            // Отримуємо поточний рух
            const currentMovement = await this._getMovementById(id);
            if (!currentMovement) {
                throw new Error(`Рух з ID ${id} не знайдено`);
            }

            // Оновлюємо тільки дозволені поля
            const allowedFields = ['reason', 'user'];
            const updateFields = {};
            
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updateFields[field] = updateData[field];
                }
            }

            if (Object.keys(updateFields).length === 0) {
                throw new Error('Немає полів для оновлення');
            }

            await this._updateMovementRecord(id, updateFields);

            // Отримуємо оновлений рух
            const updatedMovement = await this._getMovementById(id);

            // Логуємо операцію
            await this._logMovementOperation('UPDATE', updatedMovement, requestInfo, currentMovement);

            return {
                success: true,
                data: updatedMovement,
                message: 'Рух товару оновлено успішно'
            };
        } catch (error) {
            console.error('[MovementService.updateMovement] Помилка:', error);
            throw error;
        }
    },

    // Отримання рухів для конкретного товару
    async getMovementsByProduct(productId, filters = {}) {
        try {
            if (!productQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            // Перевіряємо чи існує товар
            const product = await productQueries.getById(productId);
            if (!product) {
                throw new Error(`Товар з ID ${productId} не знайдено`);
            }

            // Додаємо product_id до фільтрів
            const productFilters = { ...filters, product_id: productId };
            
            return await this.getAllMovements(productFilters);
        } catch (error) {
            console.error('[MovementService.getMovementsByProduct] Помилка:', error);
            throw error;
        }
    },

    // Статистика рухів товарів
    async getMovementStatistics(options = {}) {
        try {
            if (!movementsQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            const { period = 'month', group_by = 'type', product_id, start_date, end_date } = options;

            const stats = await this._getStatisticsData({
                period,
                group_by,
                product_id,
                start_date,
                end_date
            });

            return {
                success: true,
                data: stats,
                options: options
            };
        } catch (error) {
            console.error('[MovementService.getMovementStatistics] Помилка:', error);
            throw error;
        }
    },

    // Видалення руху (обережно - змінює залишки!)
    async deleteMovement(id, requestInfo = {}) {
        try {
            if (!movementsQueries) {
                throw new Error('MovementService не ініціалізовано');
            }

            // Отримуємо рух для логування та перерахунку залишків
            const movement = await this._getMovementById(id);
            if (!movement) {
                throw new Error(`Рух з ID ${id} не знайдено`);
            }

            // Видаляємо рух
            await this._deleteMovementRecord(id);

            // Відновлюємо залишки (обернена операція)
            const reverseType = movement.movement_type === 'IN' ? 'OUT' : 'IN';
            await this._updateProductStock(movement.product_id, reverseType, movement.pieces);

            // Логуємо операцію
            await this._logMovementOperation('DELETE', movement, requestInfo);

            return {
                success: true,
                message: 'Рух товару видалено успішно'
            };
        } catch (error) {
            console.error('[MovementService.deleteMovement] Помилка:', error);
            throw error;
        }
    },

    // Допоміжні приватні методи
    async _createMovementRecord(data) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            const sql = `
                INSERT INTO stock_movements 
                (product_id, movement_type, pieces, boxes, reason, user, batch_id, batch_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            db.run(sql, [
                data.product_id, data.movement_type, data.pieces, data.boxes, 
                data.reason, data.user, data.batch_id, data.batch_date
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    },

    async _updateMovementRecord(id, data) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const values = Object.values(data);
            values.push(id);
            
            const sql = `UPDATE stock_movements SET ${fields} WHERE id = ?`;
            
            db.run(sql, values, function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    },

    async _deleteMovementRecord(id) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            db.run('DELETE FROM stock_movements WHERE id = ?', [id], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    },

    async _getMovementById(id) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            const sql = `
                SELECT 
                    sm.id,
                    sm.product_id,
                    sm.movement_type,
                    sm.pieces,
                    sm.boxes,
                    sm.reason,
                    sm.user,
                    sm.batch_id,
                    sm.batch_date,
                    sm.created_at,
                    p.name as product_name,
                    p.code as product_code
                FROM stock_movements sm
                JOIN products p ON sm.product_id = p.id
                WHERE sm.id = ?
            `;
            
            db.get(sql, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    },

    async _updateProductStock(productId, movementType, pieces) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            const operator = movementType === 'IN' || movementType === 'PRODUCTION' || movementType === 'CORRECTION' ? '+' : '-';
            
            const sql = `
                UPDATE products 
                SET stock_pieces = stock_pieces ${operator} ?, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(sql, [pieces, productId], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    },

    async _getStatisticsData(options) {
        return new Promise((resolve, reject) => {
            const { db } = require('../database');
            let sql = `
                SELECT 
                    movement_type,
                    COUNT(*) as count,
                    SUM(pieces) as total_pieces,
                    SUM(boxes) as total_boxes,
                    DATE(created_at) as movement_date
                FROM stock_movements sm
                JOIN products p ON sm.product_id = p.id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (options.product_id) {
                sql += ' AND sm.product_id = ?';
                params.push(options.product_id);
            }
            
            if (options.start_date) {
                sql += ' AND DATE(sm.created_at) >= ?';
                params.push(options.start_date);
            }
            
            if (options.end_date) {
                sql += ' AND DATE(sm.created_at) <= ?';
                params.push(options.end_date);
            }
            
            sql += ' GROUP BY movement_type, DATE(created_at) ORDER BY created_at DESC';
            
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    },

    async _logMovementOperation(operation, movementData, requestInfo, oldData = null) {
        try {
            if (!OperationsLogController) {
                console.warn('OperationsLogController недоступний для логування');
                return;
            }

            const description = this._getOperationDescription(operation, movementData);
            
            await OperationsLogController.logOperation({
                operation_type: operation === 'CREATE' 
                    ? OperationsLogController.OPERATION_TYPES.MOVEMENT_CREATE
                    : operation === 'UPDATE' 
                    ? OperationsLogController.OPERATION_TYPES.MOVEMENT_UPDATE
                    : OperationsLogController.OPERATION_TYPES.MOVEMENT_DELETE,
                operation_id: movementData.id,
                entity_type: 'movement',
                entity_id: movementData.id,
                old_data: oldData,
                new_data: movementData,
                description: description,
                user_name: requestInfo.user || movementData.user || 'system',
                ip_address: requestInfo.ip || null,
                user_agent: requestInfo.userAgent || null
            });
            
            console.log(`✅ Логування руху ${movementData.id} (${operation}) успішне`);
        } catch (error) {
            console.error('❌ Помилка логування руху:', error);
            // Не блокуємо основну операцію через помилку логування
        }
    },

    _getOperationDescription(operation, movementData) {
        const typeNames = {
            'IN': 'Прихід',
            'OUT': 'Видача',
            'TRANSFER': 'Переміщення',
            'CORRECTION': 'Корекція',
            'WRITEOFF': 'Списання',
            'PRODUCTION': 'Виробництво'
        };
        
        const typeName = typeNames[movementData.movement_type] || movementData.movement_type;
        
        switch (operation) {
            case 'CREATE':
                return `Створено рух: ${typeName} ${movementData.pieces} шт товару "${movementData.product_name}" - ${movementData.reason}`;
            case 'UPDATE':
                return `Оновлено рух: ${typeName} товару "${movementData.product_name}"`;
            case 'DELETE':
                return `Видалено рух: ${typeName} ${movementData.pieces} шт товару "${movementData.product_name}"`;
            default:
                return `Операція з рухом товару "${movementData.product_name}"`;
        }
    }
};

module.exports = MovementService; 