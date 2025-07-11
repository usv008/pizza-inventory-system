// controllers/new-writeoff-controller.js - Новий writeoff контролер

const { supabase } = require('../supabase-client');
const OperationsLogController = require('./operations-log-controller');

class NewWriteoffController {
    
    static async createWriteoff(req, res) {
        try {
            console.log('🆕 НОВИЙ WRITEOFF API - запит отримано!');
            console.log('📋 Дані:', req.body);
            
            const { batch_id, quantity, reason, responsible } = req.body;
            
            // Валідація
            if (!batch_id || !quantity || quantity <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректні дані: потрібен batch_id та quantity > 0' 
                });
            }
            
            // Імпортуємо batchQueries динамічно
            const { batchQueries } = require('../supabase-database');
            
            // 1. Знаходимо партію
            console.log('🔍 Шукаю партію з ID:', batch_id);
            const allBatches = await batchQueries.getAll();
            const batch = allBatches.find(b => b.id === parseInt(batch_id));
            
            if (!batch) {
                console.log('❌ Партію не знайдено');
                return res.status(404).json({ 
                    success: false, 
                    error: 'Партію не знайдено' 
                });
            }
            
            console.log('✅ Партію знайдено:', { 
                id: batch.id, 
                product_id: batch.product_id,
                available: batch.available_quantity 
            });
            
            // 2. Перевіряємо достатність кількості
            if (batch.available_quantity < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Недостатньо товару. Доступно: ${batch.available_quantity}, запитано: ${quantity}` 
                });
            }
            
            // 3. Оновлюємо партію (віднімаємо кількість)
            const newQuantity = batch.available_quantity - quantity;
            console.log('🔄 Оновлюю кількість в партії:', { старе: batch.available_quantity, нове: newQuantity });
            
            await batchQueries.updateQuantities(parseInt(batch_id), {
                available_quantity: newQuantity
            });
            console.log('✅ Кількість в партії оновлено');
            
            // 4. Створюємо запис в writeoffs
            const writeoffData = {
                product_id: batch.product_id,
                total_quantity: quantity,
                boxes_quantity: 0,
                pieces_quantity: quantity,
                reason: reason || 'Списання через новий API',
                writeoff_date: new Date().toISOString().split('T')[0],
                responsible: responsible || 'Система',
                notes: `Списання з партії ${batch.batch_date || batch.production_date}, batch_id: ${batch_id}`,
                created_by_user_id: null
            };
            
            console.log('💾 Створюю запис в writeoffs:', writeoffData);
            
            const { data: writeoffResult, error: writeoffError } = await supabase
                .from('writeoffs')
                .insert(writeoffData)
                .select()
                .single();
                
            if (writeoffError) {
                console.error('❌ Помилка створення writeoff:', writeoffError);
                
                // Rollback - відновлюємо кількість в партії
                await batchQueries.updateQuantities(parseInt(batch_id), {
                    available_quantity: batch.available_quantity
                });
                console.log('🔙 Rollback виконано');
                
                return res.status(500).json({ 
                    success: false, 
                    error: 'Помилка запису списання: ' + writeoffError.message 
                });
            }
            
            console.log('✅ Writeoff створено:', writeoffResult);
            
            // 5. Логуємо операцію
            try {
                console.log('📝 Логую операцію...');
                const logResult = await OperationsLogController.logProductOperation(
                    batch.product_id, 
                    'NEW_WRITEOFF', 
                    quantity,
                    { 
                        batch_id: parseInt(batch_id),
                        reason,
                        responsible,
                        writeoff_id: writeoffResult.id,
                        api_version: 'NEW_API'
                    }
                );
                console.log('✅ Операція залогована:', logResult);
            } catch (logError) {
                console.error('⚠️ Помилка логування (не критично):', logError);
            }
            
            // 6. Повертаємо успішний результат
            console.log('🎉 Списання завершено успішно!');
            res.json({ 
                success: true, 
                message: `Списано ${quantity} шт з партії ${batch.batch_date || batch.production_date}`,
                writeoff_id: writeoffResult.id,
                remaining_quantity: newQuantity,
                batch_id: parseInt(batch_id),
                product_id: batch.product_id,
                api_version: 'NEW_WRITEOFF_API'
            });
            
        } catch (error) {
            console.error('❌ Критична помилка в новому writeoff:', error);
            console.error('❌ Stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: 'Внутрішня помилка сервера: ' + error.message 
            });
        }
    }
    
    static async getWriteoffStatus(req, res) {
        try {
            // Показуємо статус writeoffs
            const { data: writeoffs, error } = await supabase
                .from('writeoffs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);
                
            if (error) throw error;
            
            res.json({
                success: true,
                total_writeoffs: writeoffs.length,
                recent_writeoffs: writeoffs,
                message: 'Статус writeoffs через новий API',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Помилка отримання статусу writeoffs:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
}

module.exports = NewWriteoffController; 