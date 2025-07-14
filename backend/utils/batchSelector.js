/**
 * Утиліта для автоматичного вибору партії (batch_id) при створенні рухів товарів
 */

class BatchSelector {
    /**
     * Автоматично вибирає найкращу партію для руху товару
     * @param {number} productId - ID товару
     * @param {string} movementType - Тип руху (IN, OUT, PRODUCTION, WRITEOFF, etc)
     * @param {number} quantity - Кількість
     * @param {Object} batchQueries - Queries для роботи з партіями
     * @param {string} specificDate - Конкретна дата для PRODUCTION рухів
     * @returns {Object} {batch_id, batch_date} або {batch_id: null, batch_date: null}
     */
    static async selectBatchForMovement(productId, movementType, quantity, batchQueries, specificDate = null) {
        try {
            console.log(`🔍 Вибираю партію для товару ${productId}, тип: ${movementType}, кількість: ${quantity}`);
            
            // Отримуємо всі активні партії для товару
            const batches = await batchQueries.getByProductId(productId);
            
            if (!batches || batches.length === 0) {
                console.log(`⚠️ Партій для товару ${productId} не знайдено`);
                return { batch_id: null, batch_date: null };
            }
            
            let selectedBatch = null;
            
            switch (movementType) {
                case 'PRODUCTION':
                    selectedBatch = this._selectBatchForProduction(batches, quantity, specificDate);
                    break;
                    
                case 'OUT':
                case 'WRITEOFF':
                    selectedBatch = this._selectBatchForOutput(batches, quantity);
                    break;
                    
                case 'IN':
                case 'TRANSFER':
                case 'CORRECTION':
                    selectedBatch = this._selectBatchForInput(batches);
                    break;
                    
                default:
                    selectedBatch = this._selectBatchFIFO(batches);
                    break;
            }
            
            if (selectedBatch) {
                console.log(`✅ Вибрано партію ${selectedBatch.id} (${selectedBatch.batch_date})`);
                return {
                    batch_id: selectedBatch.id,
                    batch_date: selectedBatch.batch_date
                };
            } else {
                console.log(`⚠️ Підходящу партію для товару ${productId} не знайдено`);
                return { batch_id: null, batch_date: null };
            }
            
        } catch (error) {
            console.error(`❌ Помилка вибору партії для товару ${productId}:`, error);
            return { batch_id: null, batch_date: null };
        }
    }
    
    /**
     * Вибір партії для виробництва
     * Шукає партію з конкретною датою та кількістю, або найближчу
     */
    static _selectBatchForProduction(batches, quantity, specificDate) {
        if (!specificDate) {
            return this._selectBatchNewest(batches);
        }
        
        // Точна відповідність по даті та кількості
        let exactMatch = batches.find(batch => 
            batch.batch_date === specificDate && 
            batch.total_quantity === quantity
        );
        if (exactMatch) return exactMatch;
        
        // Відповідність по даті
        let dateMatch = batches.find(batch => batch.batch_date === specificDate);
        if (dateMatch) return dateMatch;
        
        // Найближча за часом
        return this._selectBatchNewest(batches);
    }
    
    /**
     * Вибір партії для видачі/списання
     * Використовує FIFO - найстарші партії спочатку
     */
    static _selectBatchForOutput(batches, quantity) {
        // Фільтруємо тільки активні партії з достатньою кількістю
        const availableBatches = batches.filter(batch => 
            batch.status === 'ACTIVE' && 
            batch.available_quantity >= quantity
        );
        
        if (availableBatches.length === 0) {
            // Якщо немає партій з повною кількістю, беремо найстарішу з наявною
            return this._selectBatchFIFO(batches.filter(batch => 
                batch.status === 'ACTIVE' && batch.available_quantity > 0
            ));
        }
        
        return this._selectBatchFIFO(availableBatches);
    }
    
    /**
     * Вибір партії для приходу/корекції
     * Використовує найновішу активну партію
     */
    static _selectBatchForInput(batches) {
        const activeBatches = batches.filter(batch => batch.status === 'ACTIVE');
        return this._selectBatchNewest(activeBatches);
    }
    
    /**
     * FIFO - First In, First Out (найстарша партія)
     */
    static _selectBatchFIFO(batches) {
        if (batches.length === 0) return null;
        
        return batches
            .filter(batch => batch.status === 'ACTIVE')
            .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date))[0];
    }
    
    /**
     * LIFO - Last In, First Out (найновіша партія)
     */
    static _selectBatchNewest(batches) {
        if (batches.length === 0) return null;
        
        return batches
            .filter(batch => batch.status === 'ACTIVE')
            .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))[0];
    }
    
    /**
     * Перевіряє чи потрібно автоматично встановити batch_id
     * @param {Object} movementData - Дані руху товару
     * @param {Object} batchQueries - Queries для роботи з партіями
     * @returns {Object} movementData з доданим batch_id та batch_date
     */
    static async enhanceMovementWithBatch(movementData, batchQueries) {
        // Якщо batch_id вже встановлений, нічого не робимо
        if (movementData.batch_id) {
            return movementData;
        }
        
        const { product_id, movement_type, pieces, batch_date } = movementData;
        
        const batchInfo = await this.selectBatchForMovement(
            product_id,
            movement_type,
            pieces,
            batchQueries,
            batch_date
        );
        
        return {
            ...movementData,
            batch_id: batchInfo.batch_id,
            batch_date: batchInfo.batch_date || movementData.batch_date
        };
    }
}

module.exports = BatchSelector; 