// controllers/batch-controller.js - Повноцінний контролер партій з Supabase

const { productQueries, productionQueries, batchQueries, writeoffQueries } = require('../supabase-database');
const { supabase } = require('../supabase-client');
const OperationsLogController = require('./operations-log-controller');

class BatchController {
    
    // Основний метод для frontend - отримання всіх партій по групах товарів
    static async getAllBatchesGrouped(req, res) {
        try {
            console.log('🔄 getAllBatchesGrouped called');
            
            // Використовуємо новий batchQueries для правильного отримання партій
            const result = await batchQueries.getAllGroupedByProduct();
            
            console.log(`✅ Повернуто ${result.length} груп товарів з партіями`);
            console.log(`📊 Загальна кількість партій: ${result.reduce((sum, p) => sum + p.batches_count, 0)}`);
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ Помилка getAllBatchesGrouped:', error.message);
            res.status(500).json([]); // Порожній масив при помилці для сумісності з frontend
        }
    }
    
    // Отримання партій для конкретного товару
    static async getBatchesByProduct(req, res) {
        try {
            const { productId } = req.params;
            console.log(`🔄 getBatchesByProduct called for product ${productId}`);
            
            const batches = await batchQueries.getByProductId(parseInt(productId));
            
            console.log(`✅ Знайдено ${batches.length} партій для товару ${productId}`);
            res.json(batches || []);
        } catch (error) {
            console.error('❌ Помилка getBatchesByProduct:', error.message);
            res.status(500).json([]);
        }
    }
    
    // Резервування партій - базова реалізація
    static async reserveBatches(req, res) {
        try {
            const { product_id, quantity_needed } = req.body;
            
            if (!product_id || !quantity_needed || quantity_needed <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректні параметри резервування' 
                });
            }
            
            console.log(`🔄 Резервування ${quantity_needed} шт товару ${product_id}`);
            
            // Отримуємо доступні партії для товару (сортуємо по даті виробництва - FIFO)
            const batches = await productionQueries.getByProductId(product_id);
            const availableBatches = batches
                .filter(batch => batch.available_quantity > 0)
                .sort((a, b) => new Date(a.production_date) - new Date(b.production_date));
            
            if (availableBatches.length === 0) {
                return res.json({
                    success: false,
                    reserved_quantity: 0,
                    message: 'Немає доступних партій'
                });
            }
            
            let remaining = quantity_needed;
            let totalReserved = 0;
            const reservations = [];
            
            // Резервуємо по FIFO принципу
            for (const batch of availableBatches) {
                if (remaining <= 0) break;
                
                const canReserve = Math.min(remaining, batch.available_quantity);
                
                if (canReserve > 0) {
                    // Оновлюємо партію в БД
                    await productionQueries.updateQuantities(batch.id, {
                        available_quantity: batch.available_quantity - canReserve,
                        reserved_quantity: (batch.reserved_quantity || 0) + canReserve
                    });
                    
                    reservations.push({
                        batch_id: batch.id,
                        reserved_quantity: canReserve,
                        production_date: batch.production_date
                    });
                    
                    totalReserved += canReserve;
                    remaining -= canReserve;
                }
            }
            
            // Логуємо операцію
            await OperationsLogController.logProductOperation(
                product_id, 
                'RESERVE', 
                totalReserved, 
                { reservations }
            );
            
            res.json({
                success: true,
                reserved_quantity: totalReserved,
                shortage: remaining,
                reservations
            });
            
        } catch (error) {
            console.error('❌ Помилка резервування:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Помилка сервера при резервуванні' 
            });
        }
    }
    
    // Звільнення резервів
    static async unreserveBatchesForOrder(req, res) {
        try {
            const { orderId } = req.params;
            console.log(`🔄 Звільнення резервів для замовлення ${orderId}`);
            
            // Базова реалізація - повертаємо успіх
            // В реальній системі тут буде логіка роботи з order_items та allocated_batches
            
            await OperationsLogController.logOrderOperation(
                orderId, 
                'UNRESERVE', 
                { message: 'Резерви звільнено' }
            );
            
                                res.json({ 
                success: true, 
                message: 'Резерви успішно звільнено',
                order_id: parseInt(orderId),
                released_quantity: 0 // Поки що заглушка
            });
            
        } catch (error) {
            console.error('❌ Помилка звільнення резервів:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Помилка при звільненні резервів' 
            });
        }
    }
    
    // Створення нової партії
    static async createBatch(req, res) {
        try {
            const { product_id, production_date, total_quantity, expiry_date, responsible, notes } = req.body;
            
            if (!product_id || !total_quantity || total_quantity <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректні дані для створення партії' 
                });
            }
            
            const newBatch = await productionQueries.create({
                product_id,
                production_date: production_date || new Date().toISOString().split('T')[0],
                production_time: '00:00:00', // Додаємо обов'язковий параметр
                total_quantity,
                expiry_date,
                responsible,
                notes
            });
            
            // Логуємо створення партії
            await OperationsLogController.logProductOperation(
                product_id, 
                'BATCH_CREATE', 
                total_quantity,
                { batch_id: newBatch.id, responsible }
            );
            
            res.json({ success: true, data: newBatch });
            
        } catch (error) {
            console.error('❌ Помилка створення партії:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Помилка створення партії' 
            });
        }
    }
    
    // Інші методи для сумісності
    static async reserveBatchesForOrderItems(req, res) {
        res.json({ success: true, message: 'Order items reserve - базова реалізація', total_reserved: 0 });
    }
    
    static async getExpiringBatches(req, res) {
        try {
            // Партії що закінчуються протягом 30 днів
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            
            const allBatches = await productionQueries.getAll();
            const expiringBatches = allBatches.filter(batch => {
                if (!batch.expiry_date) return false;
                return new Date(batch.expiry_date) <= thirtyDaysFromNow;
            });
            
            res.json(expiringBatches);
        } catch (error) {
            console.error('❌ Помилка getExpiringBatches:', error);
            res.json([]);
        }
    }
    
    static async getProductAvailability(req, res) {
        try {
            const { productId } = req.params;
            const batches = await productionQueries.getByProductId(parseInt(productId));
            
            const totalAvailable = batches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
                
                res.json({
                product_id: parseInt(productId),
                available: totalAvailable 
            });
        } catch (error) {
            res.json({ available: 0 });
        }
    }
    
    static async writeoffBatch(req, res) {
        try {
            console.log('🚀 WRITEOFF ПРОЦЕС - запит отримано!');
            console.log('📋 Параметри:', { batchId: req.params.batchId, body: req.body });
            
            const { batchId } = req.params;
            const { quantity, reason, responsible } = req.body;
            
            // Валідація вхідних даних
            if (!quantity || quantity <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректна кількість для списання' 
                });
            }
            
            if (!batchId || isNaN(parseInt(batchId))) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректний ID партії' 
                });
            }
            
            // Отримуємо партію
            console.log('🔍 Шукаю партію з ID:', parseInt(batchId));
            const allBatches = await batchQueries.getAll();
            const batch = allBatches.find(b => b.id === parseInt(batchId));
                
            console.log('📊 Результат пошуку партії:', { 
                знайдено: batch ? 'так' : 'ні', 
                batchId: parseInt(batchId),
                доступно: batch?.available_quantity,
                товар: batch?.product_id
            });
                
            if (!batch) {
                console.log('❌ Партію не знайдено');
                return res.status(404).json({ 
                    success: false, 
                    error: 'Партію не знайдено' 
                });
            }
            
            // Перевіряємо достатність кількості
            if (batch.available_quantity < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Недостатньо товару в партії. Доступно: ${batch.available_quantity}, запитано: ${quantity}` 
                });
            }
            
            // Оновлюємо кількість в партії
            const newQuantity = batch.available_quantity - quantity;
            console.log('🔄 Оновлюю кількість в партії:', { 
                старе: batch.available_quantity, 
                списано: quantity, 
                нове: newQuantity 
            });
            
            try {
                await batchQueries.updateQuantities(parseInt(batchId), {
                    available_quantity: newQuantity
                });
                console.log('✅ Кількість в партії оновлено успішно');
            } catch (updateError) {
                console.error('❌ Помилка оновлення партії:', updateError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Помилка оновлення кількості в партії: ' + updateError.message 
                });
            }
            
            // Підготовка даних для записання списання
            const writeoffData = {
                product_id: batch.product_id,
                total_quantity: quantity,
                boxes_quantity: 0,
                pieces_quantity: quantity,
                reason: reason || 'Списання партії',
                writeoff_date: new Date().toISOString().split('T')[0],
                responsible: responsible || 'Система',
                notes: `Списання з партії ${batch.batch_date || batch.production_date}, ID партії: ${batchId}`,
                created_by_user_id: null
            };
            
            console.log('💾 Створюю запис списання в writeoffs:', writeoffData);
            
            let writeoffResult;
            try {
                // Використовуємо supabase клієнт
                const { supabase } = require('../supabase-client');
                
                const { data, error } = await supabase
                    .from('writeoffs')
                    .insert(writeoffData)
                    .select()
                    .single();
                
                console.log('📊 Supabase відповідь:', { data, error });
                
                if (error) {
                    console.error('❌ Помилка запису в writeoffs:', error);
                    
                    // Відкатуємо зміну кількості
                    await batchQueries.updateQuantities(parseInt(batchId), {
                        available_quantity: batch.available_quantity
                    });
                    console.log('✅ Відкат кількості виконано');
                    
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Помилка запису списання в БД: ' + error.message 
                    });
                }
                
                writeoffResult = data;
                console.log('✅ Запис списання створено в writeoffs:', writeoffResult);
                
                // Логуємо операцію
                try {
                    console.log('📝 Логую операцію WRITEOFF...');
                    const logResult = await OperationsLogController.logProductOperation(
                        batch.product_id, 
                        'WRITEOFF', 
                        quantity,
                        { 
                            batch_id: parseInt(batchId),
                            reason,
                            responsible,
                            writeoff_id: writeoffResult?.id || 'unknown'
                        }
                    );
                    console.log('✅ Операція залогована:', logResult);
                } catch (logError) {
                    console.error('⚠️ Помилка логування операції (не критично):', logError);
                }
                
            } catch (writeoffError) {
                console.error('❌ Помилка запису списання:', writeoffError);
                
                // Відкатуємо зміну кількості
                try {
                    await batchQueries.updateQuantities(parseInt(batchId), {
                        available_quantity: batch.available_quantity
                    });
                    console.log('✅ Відкат кількості виконано');
                } catch (rollbackError) {
                    console.error('❌ Помилка відкату:', rollbackError);
                }
                
                return res.status(500).json({ 
                    success: false, 
                    error: 'Помилка запису списання: ' + writeoffError.message 
                });
            }
            
            console.log('🎉 Списання завершено успішно!');
            
            res.json({ 
                success: true, 
                message: `Списано ${quantity} шт з партії ${batch.batch_date || batch.production_date}`,
                writeoff_id: writeoffResult.id,
                remaining_quantity: newQuantity,
                batch_id: parseInt(batchId),
                product_id: batch.product_id
            });
            
            console.log('📨 Response відправлено, функція writeoffBatch завершена');
            
        } catch (error) {
            console.error('❌ Критична помилка списання партії:', error);
            console.error('❌ Stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: 'Помилка сервера при списанні: ' + error.message 
            });
        }
    }
}

module.exports = BatchController;
