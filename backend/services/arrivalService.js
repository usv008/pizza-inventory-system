/**
 * Arrival Service
 * Сервіс для роботи з приходуванням товарів
 */

let arrivalQueries, productQueries, OperationsLogController;

const ArrivalService = {
    // Ініціалізація сервісу з залежностями
    initialize(dependencies) {
        arrivalQueries = dependencies.arrivalQueries;
        productQueries = dependencies.productQueries;
        OperationsLogController = dependencies.OperationsLogController;
        console.log('✅ ArrivalService ініціалізовано з залежностями');
    },

    // Отримання всіх документів приходу
    async getAllArrivals(filters = {}) {
        try {
            if (!arrivalQueries) {
                throw new Error('ArrivalService не ініціалізовано');
            }

            const arrivals = await arrivalQueries.getAll(filters);

            return {
                success: true,
                message: 'Документи приходу отримано успішно',
                data: arrivals,
                pagination: {
                    total: arrivals.length,
                    count: arrivals.length
                }
            };
        } catch (error) {
            console.error('[ArrivalService.getAllArrivals] Помилка:', error);
            throw new Error(`Помилка отримання документів приходу: ${error.message}`);
        }
    },

    // Отримання документа приходу за ID
    async getArrivalById(id) {
        try {
            if (!arrivalQueries) {
                throw new Error('ArrivalService не ініціалізовано');
            }

            const arrival = await arrivalQueries.getById(id);
            
            if (!arrival) {
                throw new Error('Документ приходу не знайдено');
            }

            return {
                success: true,
                message: 'Документ приходу отримано успішно',
                data: arrival
            };
        } catch (error) {
            console.error('[ArrivalService.getArrivalById] Помилка:', error);
            throw new Error(`Помилка отримання документа приходу: ${error.message}`);
        }
    },

    // Створення документа приходу
    async createArrival(arrivalData, requestInfo = {}) {
        try {
            if (!arrivalQueries || !productQueries) {
                throw new Error('ArrivalService не ініціалізовано');
            }

            const { arrival_date, reason, created_by, items } = arrivalData;

            // Валідація
            if (!arrival_date || !reason || !Array.isArray(items) || items.length === 0) {
                throw new Error('Некоректні дані для оприходування');
            }

            // Валідація кожної позиції
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.product_id || !item.quantity || !item.batch_date) {
                    throw new Error(`Некоректна позиція ${i + 1}: всі поля обов'язкові`);
                }
                
                // Перевіряємо чи існує товар
                const product = await productQueries.getById(item.product_id);
                if (!product) {
                    throw new Error(`Товар з ID ${item.product_id} не знайдено`);
                }
            }

            // Створюємо основний документ
            const arrivalResult = await arrivalQueries.create({
                arrival_date,
                reason,
                created_by: created_by || 'system'
            });

            const arrival_id = arrivalResult.id;
            const arrival_number = arrivalResult.arrival_number;
            let totalQuantity = 0;

            // Обробляємо кожну позицію
            for (const item of items) {
                const { product_id, quantity, batch_date, notes } = item;
                const quantityInt = parseInt(quantity);
                totalQuantity += quantityInt;

                // Додаємо позицію в arrivals_items
                await arrivalQueries.createItem(arrival_id, {
                    product_id,
                    quantity: quantityInt,
                    batch_date,
                    notes
                });

                // Оновлюємо/створюємо партію
                await arrivalQueries.upsertBatch({
                    product_id,
                    batch_date,
                    quantity: quantityInt
                });

                // Оновлюємо залишки товару
                await arrivalQueries.updateProductStock(product_id, quantityInt);

                // Створюємо рух IN
                await arrivalQueries.createMovement({
                    product_id,
                    quantity: quantityInt,
                    reason,
                    created_by: created_by || 'system',
                    batch_date
                });
            }

            // Логуємо операцію
            if (OperationsLogController) {
                try {
                    await OperationsLogController.logOperation({
                        operation_type: OperationsLogController.OPERATION_TYPES.ARRIVAL,
                        operation_id: arrival_id,
                        entity_type: 'arrival',
                        entity_id: arrival_id,
                        new_data: {
                            arrival_number: arrival_number,
                            arrival_date: arrival_date,
                            reason: reason,
                            items_count: items.length,
                            total_quantity: totalQuantity,
                            created_by: created_by || 'system'
                        },
                        description: `Оприходування №${arrival_number}: ${totalQuantity} шт (${items.length} позицій) - ${reason}`,
                        user_name: created_by || 'system',
                        ip_address: requestInfo.ip || null,
                        user_agent: requestInfo.userAgent || null
                    });
                    console.log(`✅ Логування приходу ${arrival_number} успішне`);
                } catch (logError) {
                    console.error('❌ Помилка логування приходу:', logError);
                    // Не блокуємо операцію через помилку логування
                }
            }

            return {
                success: true,
                message: `Документ оприходування №${arrival_number} успішно створено!`,
                data: {
                    arrival_id,
                    arrival_number,
                    total_quantity: totalQuantity,
                    items_count: items.length
                }
            };

        } catch (error) {
            console.error('[ArrivalService.createArrival] Помилка:', error);
            throw new Error(`Помилка створення документа приходу: ${error.message}`);
        }
    }
};

module.exports = ArrivalService; 