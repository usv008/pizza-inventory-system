const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');
const BatchReservationHelper = require('../utils/batchReservationHelper');

/**
 * Сервіс для роботи з замовленнями
 * Надає бізнес-логіку для операцій з замовленнями включаючи резервування партій
 */
class OrderService {
    constructor() {
        this.orderQueries = null;
        this.productQueries = null;
        this.batchController = null;
        this.OperationsLogController = null;
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        this.orderQueries = dependencies.orderQueries;
        this.productQueries = dependencies.productQueries;
        this.batchQueries = dependencies.batchQueries; // Додано для batch integration
        this.batchController = dependencies.batchController;
        this.OperationsLogController = dependencies.OperationsLogController;
        this.initialized = true;
        console.log('✅ OrderService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized || !this.orderQueries) {
            throw new DatabaseError('OrderService не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всі замовлення з фільтрацією
     */
    async getAllOrders(filters = {}) {
        this._checkInitialization();
        
        try {
            const orders = await this.orderQueries.getAll(filters);
            
            console.log(`📋 Отримано ${orders.length} замовлень`);
            return orders;
        } catch (error) {
            console.error('❌ Помилка отримання замовлень:', error);
            throw new DatabaseError(`Помилка отримання замовлень: ${error.message}`);
        }
    }

    /**
     * Отримати замовлення за ID з повною інформацією
     */
    async getOrderById(orderId) {
        this._checkInitialization();
        
        try {
            const order = await this.orderQueries.getById(orderId);
            
            if (order) {
                console.log(`📋 Отримано замовлення: ${order.order_number} (ID: ${orderId})`);
            } else {
                console.log(`⚠️ Замовлення з ID ${orderId} не знайдено`);
            }
            
            return order;
        } catch (error) {
            console.error(`❌ Помилка отримання замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка отримання замовлення: ${error.message}`);
        }
    }

    /**
     * Отримати замовлення для редагування
     */
    async getOrderForEdit(orderId) {
        this._checkInitialization();
        
        try {
            const order = await this.orderQueries.getById(orderId);
            
            if (!order) {
                return { order: null, products: [] };
            }

            // Отримуємо список всіх товарів для селекту
            const products = this.productQueries ? await this.productQueries.getAll() : [];
            
            console.log(`📋 Отримано замовлення для редагування: ${order.order_number}`);
            
            return {
                order: order,
                products: products
            };
        } catch (error) {
            console.error(`❌ Помилка отримання замовлення для редагування ${orderId}:`, error);
            throw new DatabaseError(`Помилка отримання замовлення для редагування: ${error.message}`);
        }
    }

    /**
     * Створити нове замовлення з резервуванням партій
     */
    async createOrder(orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Валідуємо товари перед створенням
            await this._validateOrderProducts(orderData.items);

            const result = await this.orderQueries.create(orderData);
            
            console.log(`✅ Створено замовлення: ${result.order_number} (ID: ${result.id})`);

            // Резервуємо партії для нового замовлення
            let batchReservations = null;
            let warnings = null;

            if (this.batchQueries && orderData.items && orderData.items.length > 0) {
                try {
                    const reservationResult = await BatchReservationHelper.reserveBatchesForOrder(
                        orderData.items,
                        this.batchQueries
                    );
                    
                    batchReservations = reservationResult.reservations;
                    warnings = reservationResult.warnings;
                    
                    // Застосовуємо резервування в базі даних
                    if (batchReservations && batchReservations.length > 0) {
                        const applyResult = await BatchReservationHelper.applyReservations(
                            batchReservations,
                            this.batchQueries
                        );
                        
                        if (!applyResult.success) {
                            console.warn('⚠️ Проблеми застосування резервування:', applyResult.errors);
                            warnings = warnings || [];
                            warnings.push(...applyResult.errors.map(e => `Помилка резервування: ${e.error || e.general || JSON.stringify(e)}`));
                        } else {
                            console.log(`✅ Застосовано резервування: ${applyResult.summary.total_applied} шт в ${applyResult.summary.batches_updated} партіях`);
                        }
                    }
                    
                    console.log(`📦 Batch reservations: ${reservationResult.summary.total_reserved}/${reservationResult.summary.total_requested} шт`);
                    
                } catch (batchError) {
                    console.warn('⚠️ Помилка резервування партій:', batchError.message);
                    warnings = [`Помилка резервування партій: ${batchError.message}`];
                }
            }

            // Логуємо операцію з batch details
            const logDetails = {
                order_number: result.order_number,
                client_id: orderData.client_id,
                items_count: orderData.items?.length || 0,
                total_pieces: orderData.items?.reduce((sum, item) => sum + (item.pieces || item.quantity || 0), 0) || 0,
                batch_reservations: batchReservations ? BatchReservationHelper.formatReservationForLog({ success: true, reservations: batchReservations, warnings, summary: { total_reserved: batchReservations.reduce((sum, r) => sum + r.reserved_quantity, 0) } }) : null,
                warnings_count: warnings?.length || 0
            };
            
            await this._logOrderOperation('CREATE_ORDER', result.id, logDetails, auditInfo);

            return {
                id: result.id,
                order_number: result.order_number,
                batch_reservations: batchReservations,
                warnings: warnings
            };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка створення замовлення:', error);
            throw new DatabaseError(`Помилка створення замовлення: ${error.message}`);
        }
    }

    /**
     * Оновити замовлення з перерезервуванням партій
     */
    async updateOrder(orderId, orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо старі дані для логування
            const oldOrder = await this.orderQueries.getById(orderId);
            if (!oldOrder) {
                throw new NotFoundError('Замовлення не знайдено');
            }

            // Валідуємо товари якщо вони надані
            if (orderData.items) {
                await this._validateOrderProducts(orderData.items);
            }

            // Звільняємо старі резерви якщо оновлюються позиції
            if (orderData.items && this.batchController) {
                try {
                    await this.batchController.unreserveBatchesForOrder({ params: { orderId } }, null);
                } catch (unreserveError) {
                    console.warn('⚠️ Помилка звільнення старих резервів:', unreserveError.message);
                }
            }

            const result = await this.orderQueries.update(orderId, orderData);
            
            if (result.changes === 0) {
                throw new NotFoundError('Замовлення не знайдено або не оновлено');
            }

            console.log(`✅ Оновлено замовлення: ${oldOrder.order_number} (ID: ${orderId})`);

            // Резервуємо нові партії якщо оновлювались позиції
            let batchReservations = null;
            let warnings = null;

            if (orderData.items && this.batchController) {
                try {
                    const reservationResult = await this._reserveBatchesForNewOrder(orderId, orderData.items);
                    batchReservations = reservationResult.reservations;
                    warnings = reservationResult.warnings;
                } catch (batchError) {
                    console.warn('⚠️ Помилка перерезервування партій:', batchError.message);
                    warnings = [`Помилка резервування партій: ${batchError.message}`];
                }
            }

            // Логуємо операцію
            await this._logOrderOperation('UPDATE_ORDER', orderId, {
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                old_data: oldOrder,
                new_data: orderData,
                description: `Оновлено замовлення "${oldOrder.order_number}"`,
                ...auditInfo
            });

            return {
                changes: result.changes,
                batch_reservations: batchReservations,
                warnings: warnings
            };
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка оновлення замовлення: ${error.message}`);
        }
    }

    /**
     * Оновити статус замовлення
     */
    async updateOrderStatus(orderId, status, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо старе замовлення для логування
            const oldOrder = await this.orderQueries.getById(orderId);
            if (!oldOrder) {
                throw new NotFoundError('Замовлення не знайдено');
            }

            const result = await this.orderQueries.updateStatus(orderId, status, auditInfo.user_name);
            
            if (result.changes === 0) {
                throw new NotFoundError('Замовлення не знайдено');
            }

            console.log(`✅ Оновлено статус замовлення ${oldOrder.order_number}: ${oldOrder.status} → ${status}`);

            // Логуємо операцію
            await this._logOrderOperation('UPDATE_ORDER_STATUS', orderId, {
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                old_data: { status: oldOrder.status },
                new_data: { status: status },
                description: `Змінено статус замовлення "${oldOrder.order_number}" з "${oldOrder.status}" на "${status}"`,
                ...auditInfo
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення статусу замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка оновлення статусу: ${error.message}`);
        }
    }

    /**
     * Скасувати замовлення (перевести в статус CANCELLED)
     */
    async cancelOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Звільняємо зарезервовані партії
            if (this.batchController) {
                try {
                    await this.batchController.unreserveBatchesForOrder({ params: { orderId } }, null);
                } catch (unreserveError) {
                    console.warn('⚠️ Помилка звільнення партій при скасуванні:', unreserveError.message);
                }
            }

            const result = await this.updateOrderStatus(orderId, 'CANCELLED', auditInfo);
            
            console.log(`🗑️ Скасовано замовлення ID: ${orderId}`);
            return result;
        } catch (error) {
            console.error(`❌ Помилка скасування замовлення ${orderId}:`, error);
            throw error; // Перекидаємо помилку з updateOrderStatus
        }
    }

    /**
     * Повністю видалити замовлення з бази даних
     */
    async deleteOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо дані замовлення для логування перед видаленням
            const order = await this.orderQueries.getById(orderId);
            if (!order) {
                throw new NotFoundError('Замовлення не знайдено');
            }

            // Звільняємо зарезервовані партії
            if (this.batchController) {
                try {
                    await this.batchController.unreserveBatchesForOrder({ params: { orderId } }, null);
                    console.log(`📦 Звільнено партії для замовлення ${order.order_number}`);
                } catch (unreserveError) {
                    console.warn('⚠️ Помилка звільнення партій при видаленні:', unreserveError.message);
                }
            }

            // Видаляємо замовлення (order_items видаляться автоматично через ON DELETE CASCADE)
            const result = await this.orderQueries.delete(orderId);
            
            if (result.changes === 0) {
                throw new NotFoundError('Замовлення не знайдено або вже видалено');
            }

            console.log(`🗑️ Видалено замовлення: ${order.order_number} (ID: ${orderId})`);

            // Логуємо операцію видалення
            await this._logOrderOperation('DELETE_ORDER', orderId, {
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                old_data: order,
                description: `Видалено замовлення "${order.order_number}" (${order.items_count || 0} позицій, ${order.total_quantity || 0} шт)`,
                ...auditInfo
            });

            return { 
                changes: result.changes,
                deleted_order: {
                    id: orderId,
                    order_number: order.order_number,
                    client_name: order.client_name
                }
            };
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка видалення замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка видалення замовлення: ${error.message}`);
        }
    }

    /**
     * Зарезервувати партії для замовлення
     */
    async reserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        if (!this.batchController) {
            throw new ValidationError('Контролер партій недоступний');
        }

        try {
            const order = await this.orderQueries.getById(orderId);
            if (!order || !order.items) {
                throw new NotFoundError('Замовлення або його позиції не знайдено');
            }

            const reservationResult = await this._reserveBatchesForNewOrder(orderId, order.items);
            
            console.log(`📦 Зарезервовано партії для замовлення: ${order.order_number}`);

            // Логуємо операцію
            await this._logOrderOperation('RESERVE_BATCHES', orderId, {
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                description: `Зарезервовано партії для замовлення "${order.order_number}"`,
                ...auditInfo
            });

            return reservationResult;
        } catch (error) {
            console.error(`❌ Помилка резервування партій для замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка резервування партій: ${error.message}`);
        }
    }

    /**
     * Звільнити партії для замовлення
     */
    async unreserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        if (!this.batchController) {
            throw new ValidationError('Контролер партій недоступний');
        }

        try {
            const order = await this.orderQueries.getById(orderId);
            if (!order) {
                throw new NotFoundError('Замовлення не знайдено');
            }

            const result = await this.batchController.unreserveBatchesForOrder({ params: { orderId } }, null);
            
            console.log(`📦 Звільнено партії для замовлення: ${order.order_number}`);

            // Логуємо операцію
            await this._logOrderOperation('UNRESERVE_BATCHES', orderId, {
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                description: `Звільнено партії для замовлення "${order.order_number}"`,
                ...auditInfo
            });

            return { freed_count: result?.freed_count || 0 };
        } catch (error) {
            console.error(`❌ Помилка звільнення партій для замовлення ${orderId}:`, error);
            throw new DatabaseError(`Помилка звільнення партій: ${error.message}`);
        }
    }

    /**
     * Отримати статистику замовлень
     */
    async getOrderStats(period = 'month') {
        this._checkInitialization();
        
        try {
            const allOrders = await this.orderQueries.getAll();
            
            // Фільтруємо за періодом
            const now = new Date();
            let filterDate = new Date();
            
            switch (period) {
                case 'day':
                    filterDate.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    filterDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    filterDate.setMonth(now.getMonth() - 1);
            }

            const periodOrders = allOrders.filter(order => {
                const orderDate = new Date(order.order_date);
                return orderDate >= filterDate;
            });

            const stats = {
                total_orders: allOrders.length,
                period_orders: periodOrders.length,
                orders_by_status: {},
                total_items: allOrders.reduce((sum, o) => sum + (o.items_count || 0), 0),
                total_quantity: allOrders.reduce((sum, o) => sum + (o.total_quantity || 0), 0),
                period_items: periodOrders.reduce((sum, o) => sum + (o.items_count || 0), 0),
                period_quantity: periodOrders.reduce((sum, o) => sum + (o.total_quantity || 0), 0),
                avg_items_per_order: allOrders.length > 0 ? 
                    (allOrders.reduce((sum, o) => sum + (o.items_count || 0), 0) / allOrders.length).toFixed(1) : 0,
                avg_quantity_per_order: allOrders.length > 0 ? 
                    (allOrders.reduce((sum, o) => sum + (o.total_quantity || 0), 0) / allOrders.length).toFixed(1) : 0
            };

            // Підраховуємо по статусах
            const statuses = ['NEW', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
            statuses.forEach(status => {
                stats.orders_by_status[status] = allOrders.filter(o => o.status === status).length;
            });
            
            console.log(`📊 Статистика замовлень за ${period}: ${stats.period_orders} замовлень`);
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики замовлень:', error);
            throw new DatabaseError(`Помилка отримання статистики: ${error.message}`);
        }
    }

    /**
     * Приватний метод: валідація товарів у замовленні
     */
    async _validateOrderProducts(items) {
        if (!this.productQueries) {
            console.warn('⚠️ productQueries недоступний для валідації товарів');
            return;
        }

        try {
            for (const item of items) {
                const product = await this.productQueries.getById(item.product_id);
                if (!product) {
                    throw new ValidationError(`Товар з ID ${item.product_id} не знайдено`);
                }
                // Валідація активності товарів прибрана - в таблиці products немає поля is_active
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.warn('⚠️ Помилка валідації товарів:', error.message);
        }
    }

    /**
     * Приватний метод: резервування партій для нового замовлення
     */
    async _reserveBatchesForNewOrder(orderId, items) {
        const reservations = [];
        const warnings = [];

        for (const item of items) {
            try {
                const batchResult = await this.batchController.reserveBatchesForOrderItem({
                    params: { orderId },
                    body: {
                        product_id: item.product_id,
                        quantity: item.quantity
                    }
                }, null);

                if (batchResult && batchResult.reservations) {
                    reservations.push(...batchResult.reservations);
                }

                if (batchResult && batchResult.shortage) {
                    warnings.push(`Недостача товару ID ${item.product_id}: ${batchResult.shortage} шт`);
                }
            } catch (error) {
                console.warn(`⚠️ Помилка резервування для товару ${item.product_id}:`, error.message);
                warnings.push(`Помилка резервування товару ID ${item.product_id}: ${error.message}`);
            }
        }

        return { reservations, warnings: warnings.length > 0 ? warnings : null };
    }

    /**
     * Приватний метод: логування операцій з замовленнями
     */
    async _logOrderOperation(operationType, orderId, logData) {
        if (!this.OperationsLogController) {
            console.warn('⚠️ OperationsLogController недоступний для логування');
            return;
        }

        try {
            await this.OperationsLogController.logOperation({
                operation_type: operationType,
                ...logData
            });
        } catch (logError) {
            console.error(`❌ Помилка логування операції ${operationType} для замовлення ${orderId}:`, logError);
            // Не кидаємо помилку, щоб не зламати основну операцію
        }
    }
}

// Експортуємо singleton instance
module.exports = new OrderService(); 