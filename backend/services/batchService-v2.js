// services/batchService-v2.js - Універсальний сервіс для роботи з партіями товарів

const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const config = require('../config/database');

/**
 * Сервіс для роботи з партіями товарів
 * Підтримує як SQLite так і Supabase
 */
class BatchService {
    constructor() {
        this.useSupabase = config.USE_SUPABASE;
        this.adapter = new DatabaseAdapter(this.useSupabase);
        
        console.log(`🎯 BatchService: використовується ${this.useSupabase ? 'Supabase' : 'SQLite'}`);
        
        // Завантажуємо відповідні queries
        if (this.useSupabase) {
            this.queries = require('../queries/supabase/batchQueries');
        } else {
            this.queries = require('../queries/sqlite/batchQueries');
        }
    }

    /**
     * Отримати всі партії для конкретного товару
     */
    async getBatchesByProduct(productId, includeExpired = false) {
        try {
            const batches = await this.queries.getBatchesByProduct(productId, includeExpired);
            
            return {
                success: true,
                batches: batches,
                count: batches.length,
                product_id: parseInt(productId),
                include_expired: includeExpired
            };
        } catch (error) {
            console.error('Помилка отримання партій товару:', error);
            throw new Error(`Помилка отримання партій: ${error.message}`);
        }
    }

    /**
     * Отримати всі партії згруповані по товарах
     */
    async getAllBatchesGrouped() {
        try {
            const groupedBatches = await this.queries.getAllBatchesGrouped();
            
            // Додаємо статистику
            const totalProducts = groupedBatches.length;
            const totalBatches = groupedBatches.reduce((sum, product) => sum + (product.batches_count || 0), 0);
            const totalAvailable = groupedBatches.reduce((sum, product) => sum + (product.total_available || 0), 0);
            const lowStockProducts = groupedBatches.filter(product => product.stock_status === 'low').length;
            
            return {
                success: true,
                products: groupedBatches,
                stats: {
                    total_products: totalProducts,
                    total_batches: totalBatches,
                    total_available_pieces: totalAvailable,
                    low_stock_products: lowStockProducts
                }
            };
        } catch (error) {
            console.error('Помилка отримання згрупованих партій:', error);
            throw new Error(`Помилка отримання згрупованих партій: ${error.message}`);
        }
    }

    /**
     * Отримати партії що закінчуються
     */
    async getExpiringBatches(days = 7) {
        try {
            const expiringBatches = await this.queries.getExpiringBatches(days);
            
            // Групуємо по рівню терміновості
            const critical = expiringBatches.filter(batch => batch.urgency === 'critical');
            const high = expiringBatches.filter(batch => batch.urgency === 'high');
            const medium = expiringBatches.filter(batch => batch.urgency === 'medium');
            
            return {
                success: true,
                batches: expiringBatches,
                count: expiringBatches.length,
                days_filter: parseInt(days),
                urgency_breakdown: {
                    critical: critical.length,
                    high: high.length,
                    medium: medium.length
                },
                total_expiring_quantity: expiringBatches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0)
            };
        } catch (error) {
            console.error('Помилка отримання партій що закінчуються:', error);
            throw new Error(`Помилка отримання партій що закінчуються: ${error.message}`);
        }
    }

    /**
     * Зарезервувати партії для замовлення
     */
    async reserveBatches(allocations, context = {}) {
        try {
            if (!Array.isArray(allocations) || allocations.length === 0) {
                throw new Error('Некоректні дані резервування');
            }

            // Валідація allocations
            for (const allocation of allocations) {
                if (!allocation.batch_id || !allocation.quantity || allocation.quantity <= 0) {
                    throw new Error('Кожне резервування повинно мати batch_id та quantity > 0');
                }
            }

            const results = await this.queries.reserveBatches(allocations);
            
            const totalReserved = results.reduce((sum, result) => sum + (result.quantity || 0), 0);
            
            // Логування операції
            if (context.user) {
                console.log(`🔒 Зарезервовано ${totalReserved} шт в ${results.length} партіях користувачем ${context.user}`);
            }
            
            return {
                success: true,
                message: 'Партії успішно зарезервовано',
                reservations: results,
                total_reserved: totalReserved,
                batches_count: results.length
            };
        } catch (error) {
            console.error('Помилка резервування партій:', error);
            throw new Error(`Помилка резервування партій: ${error.message}`);
        }
    }

    /**
     * Звільнити резерви партій
     */
    async unreserveBatches(allocations, context = {}) {
        try {
            if (!Array.isArray(allocations)) {
                allocations = [];
            }

            if (allocations.length === 0) {
                return {
                    success: true,
                    message: 'Немає резервів для звільнення',
                    released: [],
                    total_released: 0
                };
            }

            const results = await this.queries.unreserveBatches(allocations);
            
            const totalReleased = results.reduce((sum, result) => sum + (result.quantity || 0), 0);
            
            // Логування операції
            if (context.user) {
                console.log(`🔓 Звільнено ${totalReleased} шт з ${results.length} партій користувачем ${context.user}`);
            }
            
            return {
                success: true,
                message: 'Резерви успішно звільнено',
                released: results,
                total_released: totalReleased,
                batches_count: results.length
            };
        } catch (error) {
            console.error('Помилка звільнення резервів:', error);
            throw new Error(`Помилка звільнення резервів: ${error.message}`);
        }
    }

    /**
     * Автоматичне резервування партій для товару (FIFO)
     */
    async reserveBatchesForProduct(productId, quantityNeeded, context = {}) {
        try {
            if (!productId || !quantityNeeded || quantityNeeded <= 0) {
                throw new Error('Некоректні параметри для резервування');
            }

            const availability = await this.queries.getAvailableBatchesForProduct(productId, quantityNeeded);
            
            if (availability.allocated_batches.length > 0) {
                // Резервуємо знайдені партії
                const allocations = availability.allocated_batches.map(batch => ({
                    batch_id: batch.batch_id,
                    quantity: batch.quantity
                }));
                
                await this.queries.reserveBatches(allocations);
                
                console.log(`✅ Автоматично зарезервовано ${availability.quantity_reserved} шт товару ${productId} в ${allocations.length} партіях`);
            }
            
            return {
                success: true,
                product_id: parseInt(productId),
                product_name: availability.product_name,
                quantity_requested: quantityNeeded,
                quantity_reserved: availability.quantity_reserved,
                shortage: availability.shortage,
                allocated_batches: availability.allocated_batches,
                has_shortage: availability.shortage > 0
            };
        } catch (error) {
            console.error('Помилка автоматичного резервування:', error);
            throw new Error(`Помилка автоматичного резервування: ${error.message}`);
        }
    }

    /**
     * Резервування партій для позицій замовлення
     */
    async reserveBatchesForOrderItems(orderId, items, context = {}) {
        try {
            if (!orderId || !Array.isArray(items) || items.length === 0) {
                throw new Error('Некоректні дані для резервування замовлення');
            }

            const reservationResults = [];
            let totalReserved = 0;
            let hasShortages = false;

            for (const item of items) {
                const { product_id, quantity } = item;
                
                if (!product_id || !quantity || quantity <= 0) {
                    console.warn(`Пропускаю некоректну позицію: product_id=${product_id}, quantity=${quantity}`);
                    continue;
                }

                try {
                    const reservationResult = await this.reserveBatchesForProduct(product_id, quantity, context);
                    reservationResults.push({
                        product_id: product_id,
                        quantity_requested: quantity,
                        ...reservationResult
                    });
                    
                    totalReserved += reservationResult.quantity_reserved || 0;
                    if (reservationResult.shortage > 0) {
                        hasShortages = true;
                    }
                } catch (error) {
                    console.error(`Помилка резервування для товару ${product_id}:`, error);
                    reservationResults.push({
                        product_id: product_id,
                        quantity_requested: quantity,
                        quantity_reserved: 0,
                        shortage: quantity,
                        error: error.message,
                        allocated_batches: []
                    });
                    hasShortages = true;
                }
            }

            return {
                success: true,
                message: 'Резервування завершено',
                order_id: parseInt(orderId),
                total_reserved: totalReserved,
                has_shortages: hasShortages,
                items_processed: items.length,
                reservations: reservationResults
            };
        } catch (error) {
            console.error('Помилка резервування для замовлення:', error);
            throw new Error(`Помилка резервування для замовлення: ${error.message}`);
        }
    }

    /**
     * Звільнити всі резерви замовлення
     */
    async unreserveBatchesForOrder(orderId, orderItems, context = {}) {
        try {
            if (!orderId) {
                throw new Error('Не вказано ID замовлення');
            }

            if (!Array.isArray(orderItems) || orderItems.length === 0) {
                return {
                    success: true,
                    message: 'Немає позицій для звільнення резервів',
                    order_id: parseInt(orderId),
                    released_quantity: 0
                };
            }

            let totalReleased = 0;
            const releaseResults = [];

            for (const item of orderItems) {
                let allocatedBatches = [];
                
                // Парсимо allocated_batches
                if (item.allocated_batches) {
                    try {
                        if (typeof item.allocated_batches === 'string') {
                            allocatedBatches = JSON.parse(item.allocated_batches);
                        } else {
                            allocatedBatches = item.allocated_batches;
                        }
                    } catch (parseError) {
                        console.warn(`Помилка парсингу allocated_batches для позиції ${item.id}:`, parseError);
                        continue;
                    }
                }

                if (Array.isArray(allocatedBatches) && allocatedBatches.length > 0) {
                    // Підготовуємо allocations для звільнення
                    const allocations = allocatedBatches.map(batchAllocation => ({
                        batch_id: batchAllocation.batch_id,
                        quantity: batchAllocation.quantity || batchAllocation.allocated_quantity || 0
                    })).filter(alloc => alloc.batch_id && alloc.quantity > 0);

                    if (allocations.length > 0) {
                        try {
                            const unreserveResult = await this.unreserveBatches(allocations, context);
                            totalReleased += unreserveResult.total_released;
                            releaseResults.push({
                                item_id: item.id,
                                product_id: item.product_id,
                                released: unreserveResult.total_released,
                                batches_count: unreserveResult.batches_count
                            });
                        } catch (error) {
                            console.error(`Помилка звільнення резервів для позиції ${item.id}:`, error);
                        }
                    }
                }
            }

            console.log(`🎉 Звільнено резервів: ${totalReleased} шт для замовлення ${orderId}`);

            return {
                success: true,
                message: 'Резерви успішно звільнено',
                order_id: parseInt(orderId),
                released_quantity: totalReleased,
                items_processed: orderItems.length,
                release_details: releaseResults
            };
        } catch (error) {
            console.error('Помилка звільнення резервів замовлення:', error);
            throw new Error(`Помилка звільнення резервів замовлення: ${error.message}`);
        }
    }

    /**
     * Списати партію
     */
    async writeoffBatch(batchId, quantity, reason, responsible, notes = '', context = {}) {
        try {
            if (!batchId || !quantity || !reason || !responsible) {
                throw new Error('Обов\'язкові поля: batchId, quantity, reason, responsible');
            }

            if (quantity <= 0) {
                throw new Error('Кількість для списання повинна бути більше 0');
            }

            const result = await this.queries.writeoffBatch(batchId, quantity, reason, responsible, notes);
            
            console.log(`📝 Списано партію ${batchId}: ${quantity} шт (${reason}) користувачем ${responsible}`);
            
            // Логування операції (якщо потрібно інтегрувати з OperationsLog)
            if (context.log_operation) {
                // TODO: Інтегрувати з OperationsLogService коли буде створено
            }

            return {
                success: true,
                ...result,
                batch_id: parseInt(batchId),
                quantity_written_off: quantity,
                reason: reason,
                responsible: responsible
            };
        } catch (error) {
            console.error('Помилка списання партії:', error);
            throw new Error(`Помилка списання партії: ${error.message}`);
        }
    }

    /**
     * Отримати доступність товару з урахуванням партій
     */
    async getProductAvailability(productId) {
        try {
            if (!productId) {
                throw new Error('Не вказано ID товару');
            }

            const availability = await this.queries.getProductAvailability(productId);
            
            return {
                success: true,
                ...availability
            };
        } catch (error) {
            console.error('Помилка отримання доступності товару:', error);
            throw new Error(`Помилка отримання доступності товару: ${error.message}`);
        }
    }

    /**
     * Отримати детальну інформацію про партію
     */
    async getBatchDetails(batchId) {
        try {
            if (!batchId) {
                throw new Error('Не вказано ID партії');
            }

            // Використовуємо getBatchesByProduct з фільтром по ID
            // Це не найефективніше, але універсальне для обох БД
            // TODO: Можна додати окремий метод getBatchById в queries
            
            const productId = await this.getProductIdByBatchId(batchId);
            const batches = await this.getBatchesByProduct(productId, true);
            
            const batch = batches.batches.find(b => b.id === parseInt(batchId));
            
            if (!batch) {
                throw new Error('Партію не знайдено');
            }

            return {
                success: true,
                batch: batch
            };
        } catch (error) {
            console.error('Помилка отримання деталей партії:', error);
            throw new Error(`Помилка отримання деталей партії: ${error.message}`);
        }
    }

    /**
     * Допоміжний метод для отримання product_id по batch_id
     * (буде реалізовано в queries якщо потрібно)
     */
    async getProductIdByBatchId(batchId) {
        // Простий workaround - можна покращити
        if (this.useSupabase) {
            const { data, error } = await this.adapter.client
                .from('production_batches')
                .select('product_id')
                .eq('id', batchId)
                .single();
            
            if (error || !data) {
                throw new Error('Партію не знайдено');
            }
            
            return data.product_id;
        } else {
            return new Promise((resolve, reject) => {
                this.adapter.client.get(
                    'SELECT product_id FROM production_batches WHERE id = ?', 
                    [batchId], 
                    (err, row) => {
                        if (err || !row) {
                            reject(new Error('Партію не знайдено'));
                        } else {
                            resolve(row.product_id);
                        }
                    }
                );
            });
        }
    }
}

module.exports = new BatchService();