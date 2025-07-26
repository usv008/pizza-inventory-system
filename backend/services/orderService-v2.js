/**
 * Order Service v2
 * Універсальний сервіс для роботи з замовленнями
 * Підтримує як SQLite, так і Supabase PostgreSQL
 */

const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

// Завантажуємо queries в залежності від типу БД
let orderQueries, productQueries;

const initializeQueries = (dependencies = {}) => {
    const useSupabase = process.env.USE_SUPABASE === 'true';
    
    if (useSupabase) {
        orderQueries = require('../queries/supabase/orderQueries');
        productQueries = require('../queries/supabase/productQueries');
    } else {
        console.log('⚠️ SQLite mode: використовується SQLite queries для orders');
        orderQueries = require('../queries/sqlite/orderQueries');
        productQueries = require('../queries/supabase/productQueries'); // адаптований для SQLite
    }
};

/**
 * Сервіс для роботи з замовленнями v2
 * Надає бізнес-логіку для операцій з замовленнями включаючи резервування партій
 */
class OrderServiceV2 {
    constructor() {
        this.batchController = null;
        this.OperationsLogController = null;
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        initializeQueries(dependencies);
        
        this.batchController = dependencies.batchController;
        this.OperationsLogController = dependencies.OperationsLogController;
        this.initialized = true;
        console.log('✅ OrderService v2 ініціалізовано з підтримкою', 
            process.env.USE_SUPABASE === 'true' ? 'Supabase' : 'SQLite');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized || !orderQueries) {
            throw new DatabaseError('OrderService v2 не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всі замовлення з фільтрацією
     */
    async getAllOrders(filters = {}) {
        this._checkInitialization();
        
        try {
            const orders = await orderQueries.getAll(filters);
            
            console.log(`📋 Отримано ${orders.length} замовлень`);
            return orders;
        } catch (error) {
            console.error('❌ Помилка отримання замовлень:', error);
            throw new DatabaseError(`Помилка отримання замовлень: ${error.message}`);
        }
    }

    /**
     * Отримати замовлення за ID
     */
    async getOrderById(orderId) {
        this._checkInitialization();
        
        try {
            const order = await orderQueries.getById(orderId);
            
            if (!order) {
                throw new NotFoundError(`Замовлення з ID ${orderId} не знайдено`);
            }
            
            console.log(`📋 Отримано замовлення ${order.order_number}`);
            return order;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error('❌ Помилка отримання замовлення:', error);
            throw new DatabaseError(`Помилка отримання замовлення: ${error.message}`);
        }
    }

    /**
     * Отримати замовлення для редагування (з повною інформацією)
     */
    async getOrderForEdit(orderId) {
        // Використовуємо той же метод що і getOrderById
        return await this.getOrderById(orderId);
    }

    /**
     * Створити нове замовлення
     */
    async createOrder(orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Валідація товарів у позиціях
            if (orderData.items && orderData.items.length > 0) {
                await this._validateOrderProducts(orderData.items);
            }

            // Генеруємо номер замовлення якщо не вказано
            if (!orderData.order_number) {
                orderData.order_number = await this._generateOrderNumber();
            }

            // Створюємо замовлення
            const orderId = await orderQueries.create({
                order_number: orderData.order_number,
                client_id: orderData.client_id,
                client_name: orderData.client_name,
                client_contact: orderData.client_contact,
                order_date: orderData.order_date || new Date().toISOString().slice(0, 10),
                delivery_date: orderData.delivery_date,
                status: orderData.status || 'NEW',
                notes: orderData.notes,
                created_by: auditInfo.user || orderData.created_by || 'system',
                created_by_user_id: auditInfo.userId || orderData.created_by_user_id
            });

            // Створюємо позиції замовлення
            if (orderData.items && orderData.items.length > 0) {
                for (const item of orderData.items) {
                    await orderQueries.createItem({
                        order_id: orderId,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        boxes: item.boxes || Math.floor(item.quantity / 12), // припущення про кількість в коробці
                        pieces: item.pieces || (item.quantity % 12),
                        reserved_quantity: item.reserved_quantity || 0,
                        produced_quantity: item.produced_quantity || 0,
                        notes: item.notes,
                        allocated_batches: item.allocated_batches
                    });
                }
                
                // Оновлюємо підсумки замовлення
                await orderQueries.updateTotals(orderId);
            }

            // Отримуємо створене замовлення для відповіді
            const newOrder = await this.getOrderById(orderId);

            // Резервуємо партії якщо потрібно
            if (orderData.auto_reserve && this.batchController) {
                await this.reserveBatchesForOrder(orderId, auditInfo);
            }

            // Логуємо операцію
            await this._logOrderOperation('CREATE', orderId, {
                ...auditInfo,
                orderData: newOrder
            });

            console.log(`✅ Створено замовлення ${newOrder.order_number} (ID: ${orderId})`);
            return newOrder;
        } catch (error) {
            console.error('❌ Помилка створення замовлення:', error);
            throw error instanceof DatabaseError || error instanceof ValidationError 
                ? error 
                : new DatabaseError(`Помилка створення замовлення: ${error.message}`);
        }
    }

    /**
     * Оновити замовлення
     */
    async updateOrder(orderId, orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Перевіряємо чи існує замовлення
            const existingOrder = await this.getOrderById(orderId);

            // Оновлюємо основні дані замовлення
            await orderQueries.update(orderId, orderData);

            // Якщо є нові позиції, оновлюємо їх
            if (orderData.items) {
                // Видаляємо старі позиції
                await orderQueries.deleteAllItems(orderId);
                
                // Створюємо нові позиції
                for (const item of orderData.items) {
                    await orderQueries.createItem({
                        order_id: orderId,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        boxes: item.boxes || Math.floor(item.quantity / 12),
                        pieces: item.pieces || (item.quantity % 12),
                        reserved_quantity: item.reserved_quantity || 0,
                        produced_quantity: item.produced_quantity || 0,
                        notes: item.notes,
                        allocated_batches: item.allocated_batches
                    });
                }
                
                // Оновлюємо підсумки
                await orderQueries.updateTotals(orderId);
            }

            // Отримуємо оновлене замовлення
            const updatedOrder = await this.getOrderById(orderId);

            // Логуємо операцію
            await this._logOrderOperation('UPDATE', orderId, {
                ...auditInfo,
                oldData: existingOrder,
                newData: updatedOrder
            });

            console.log(`✅ Оновлено замовлення ${updatedOrder.order_number}`);
            return updatedOrder;
        } catch (error) {
            console.error('❌ Помилка оновлення замовлення:', error);
            throw error instanceof DatabaseError || error instanceof NotFoundError
                ? error 
                : new DatabaseError(`Помилка оновлення замовлення: ${error.message}`);
        }
    }

    /**
     * Оновити статус замовлення
     */
    async updateOrderStatus(orderId, status, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const existingOrder = await this.getOrderById(orderId);
            
            await orderQueries.update(orderId, { status });
            
            const updatedOrder = await this.getOrderById(orderId);

            // Логуємо зміну статусу
            await this._logOrderOperation('STATUS_CHANGE', orderId, {
                ...auditInfo,
                oldStatus: existingOrder.status,
                newStatus: status
            });

            console.log(`✅ Статус замовлення ${updatedOrder.order_number} змінено: ${existingOrder.status} → ${status}`);
            return updatedOrder;
        } catch (error) {
            console.error('❌ Помилка зміни статусу замовлення:', error);
            throw error instanceof DatabaseError || error instanceof NotFoundError
                ? error 
                : new DatabaseError(`Помилка зміни статусу замовлення: ${error.message}`);
        }
    }

    /**
     * Скасувати замovлення
     */
    async cancelOrder(orderId, auditInfo = {}) {
        return await this.updateOrderStatus(orderId, 'CANCELLED', auditInfo);
    }

    /**
     * Видалити замовлення
     */
    async deleteOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const order = await this.getOrderById(orderId);

            // Відміняємо резервування партій
            if (this.batchController) {
                await this.unreserveBatchesForOrder(orderId, auditInfo);
            }

            // Видаляємо замовлення (позиції видаляться автоматично через CASCADE)
            await orderQueries.delete(orderId);

            // Логуємо операцію
            await this._logOrderOperation('DELETE', orderId, {
                ...auditInfo,
                orderData: order
            });

            console.log(`✅ Видалено замовлення ${order.order_number}`);
            return { success: true, message: 'Замовлення видалено успішно' };
        } catch (error) {
            console.error('❌ Помилка видалення замовлення:', error);
            throw error instanceof DatabaseError || error instanceof NotFoundError
                ? error 
                : new DatabaseError(`Помилка видалення замовлення: ${error.message}`);
        }
    }

    /**
     * Резервувати партії для замовлення
     */
    async reserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        if (!this.batchController) {
            console.warn('⚠️ BatchController недоступний для резервування');
            return { success: false, message: 'Система партій недоступна' };
        }

        try {
            const order = await this.getOrderById(orderId);
            
            const reservations = [];
            const warnings = [];

            for (const item of order.order_items) {
                try {
                    const reservation = await this.batchController.reserveForOrder(
                        item.product_id,
                        item.quantity,
                        orderId,
                        auditInfo
                    );
                    
                    if (reservation.success) {
                        reservations.push(reservation);
                        
                        // Оновлюємо позицію з інформацією про резервування
                        await orderQueries.updateItem(item.id, {
                            reserved_quantity: item.quantity,
                            allocated_batches: reservation.batches
                        });
                    } else {
                        warnings.push(`Товар ${item.products?.name}: ${reservation.message}`);
                    }
                } catch (error) {
                    warnings.push(`Товар ${item.products?.name}: помилка резервування`);
                }
            }

            console.log(`✅ Резервування для замовлення ${order.order_number}: ${reservations.length} успішних, ${warnings.length} попереджень`);
            
            return {
                success: true,
                reservations,
                warnings
            };
        } catch (error) {
            console.error('❌ Помилка резервування партій:', error);
            throw new DatabaseError(`Помилка резервування партій: ${error.message}`);
        }
    }

    /**
     * Відмінити резервування партій для замовлення
     */
    async unreserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        if (!this.batchController) {
            console.warn('⚠️ BatchController недоступний для відміни резервування');
            return { success: false, message: 'Система партій недоступна' };
        }

        try {
            const order = await this.getOrderById(orderId);
            
            for (const item of order.order_items) {
                if (item.reserved_quantity > 0) {
                    await this.batchController.unreserveForOrder(
                        item.product_id,
                        item.reserved_quantity,
                        orderId,
                        auditInfo
                    );
                    
                    // Очищуємо резервування в позиції
                    await orderQueries.updateItem(item.id, {
                        reserved_quantity: 0,
                        allocated_batches: null
                    });
                }
            }

            console.log(`✅ Відмінено резервування для замовлення ${order.order_number}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Помилка відміни резервування:', error);
            throw new DatabaseError(`Помилка відміни резервування: ${error.message}`);
        }
    }

    /**
     * Статистика замовлень
     */
    async getOrderStats(period = 'month') {
        this._checkInitialization();
        
        try {
            const stats = await orderQueries.getStats(period);
            
            console.log(`📊 Статистика замовлень за ${period}: ${stats.total_orders} замовлень`);
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики:', error);
            throw new DatabaseError(`Помилка отримання статистики: ${error.message}`);
        }
    }

    /**
     * Валідація товарів у замовленні
     */
    async _validateOrderProducts(items) {
        if (!productQueries) {
            console.warn('⚠️ productQueries недоступний для валідації товарів');
            return;
        }

        for (const item of items) {
            const product = await productQueries.getById(item.product_id);
            if (!product) {
                throw new ValidationError(`Товар з ID ${item.product_id} не знайдено`);
            }
            
            if (item.quantity <= 0) {
                throw new ValidationError(`Кількість товару ${product.name} має бути більше 0`);
            }
        }
    }

    /**
     * Генерація номера замовлення
     */
    async _generateOrderNumber() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        
        // Знаходимо останній номер за сьогодні
        try {
            const orders = await orderQueries.getAll({
                date_from: today.toISOString().slice(0, 10),
                date_to: today.toISOString().slice(0, 10),
                limit: 1
            });
            
            let counter = 1;
            if (orders.length > 0) {
                const lastNumber = orders[0].order_number;
                const match = lastNumber.match(/-(\d+)$/);
                if (match) {
                    counter = parseInt(match[1]) + 1;
                }
            }
            
            return `${dateStr}-${counter.toString().padStart(3, '0')}`;
        } catch (error) {
            // Fallback до простого номера
            return `${dateStr}-001`;
        }
    }

    /**
     * Логування операцій з замовленнями
     */
    async _logOrderOperation(operationType, orderId, logData) {
        if (!this.OperationsLogController) {
            console.warn('⚠️ OperationsLogController недоступний для логування');
            return;
        }

        try {
            await this.OperationsLogController.logOperation({
                operation_type: `ORDER_${operationType}`,
                operation_id: orderId,
                entity_type: 'order',
                entity_id: orderId,
                old_data: logData.oldData || null,
                new_data: logData.newData || logData.orderData || null,
                description: this._getOperationDescription(operationType, logData),
                user_name: logData.user || 'system',
                ip_address: logData.ip || null,
                user_agent: logData.userAgent || null
            });
        } catch (error) {
            console.error('❌ Помилка логування операції замовлення:', error);
            // Не блокуємо основну операцію через помилку логування
        }
    }

    /**
     * Опис операції для логування
     */
    _getOperationDescription(operationType, logData) {
        const orderData = logData.orderData || logData.newData;
        const orderNumber = orderData?.order_number || 'невідоме';
        
        switch (operationType) {
            case 'CREATE':
                return `Створено замовлення ${orderNumber}`;
            case 'UPDATE':
                return `Оновлено замовлення ${orderNumber}`;
            case 'STATUS_CHANGE':
                return `Змінено статус замовлення ${orderNumber}: ${logData.oldStatus} → ${logData.newStatus}`;
            case 'DELETE':
                return `Видалено замовлення ${orderNumber}`;
            default:
                return `Операція з замовленням ${orderNumber}`;
        }
    }
}

// Експортуємо instance класу для сумісності зі старим кодом
const orderServiceV2 = new OrderServiceV2();

module.exports = orderServiceV2;