// Mock batch controller для тестування writeoffs без Supabase

class MockBatchController {
    // Mock данні партій
    static mockBatches = [
        {
            id: 10,
            product_id: 39,
            batch_date: '2025-01-19',
            production_date: '2025-01-19',
            available_quantity: 100,
            total_quantity: 100,
            status: 'ACTIVE'
        }
    ];

    // Mock данні списань
    static mockWriteoffs = [];

    static async writeoffBatch(req, res) {
        try {
            console.log('🔄 MOCK writeoffBatch викликано:', { batchId: req.params.batchId, body: req.body });
            const { batchId } = req.params;
            const { quantity, reason, responsible } = req.body;
            
            if (!quantity || quantity <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Некоректна кількість для списання' 
                });
            }
            
            // Знаходимо партію в mock даних
            const batch = MockBatchController.mockBatches.find(b => b.id === parseInt(batchId));
            
            if (!batch) {
                console.log('❌ Партію не знайдено');
                return res.status(404).json({ 
                    success: false, 
                    error: 'Партію не знайдено' 
                });
            }
            
            if (batch.available_quantity < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Недостатньо товару в партії. Доступно: ${batch.available_quantity}` 
                });
            }
            
            // Оновлюємо кількість
            const newQuantity = batch.available_quantity - quantity;
            batch.available_quantity = newQuantity;
            
            console.log('✅ Кількість в партії оновлено успішно');
            
            // Створюємо запис списання
            const writeoffId = MockBatchController.mockWriteoffs.length + 1;
            const writeoff = {
                id: writeoffId,
                product_id: batch.product_id,
                batch_id: parseInt(batchId),
                quantity: quantity,
                reason: reason || 'Списання партії',
                responsible: responsible || 'system',
                writeoff_date: new Date().toISOString().split('T')[0],
                batch_date: batch.batch_date
            };
            
            MockBatchController.mockWriteoffs.push(writeoff);
            console.log('✅ Запис списання створено:', writeoff);
            
            res.json({ 
                success: true, 
                message: `Списано ${quantity} шт з партії ${batch.batch_date}`,
                writeoff_id: writeoffId,
                remaining_quantity: newQuantity
            });
            
        } catch (error) {
            console.error('❌ Помилка списання партії:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Помилка сервера при списанні' 
            });
        }
    }

    // Метод для перегляду поточного стану
    static async getStatus(req, res) {
        res.json({
            batches: MockBatchController.mockBatches,
            writeoffs: MockBatchController.mockWriteoffs
        });
    }
}

module.exports = MockBatchController; 