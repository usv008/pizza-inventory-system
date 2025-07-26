// queries/supabase/batchQueries.js - Supabase запити для роботи з партіями товарів

const DatabaseAdapter = require('../../adapters/DatabaseAdapter');

/**
 * Клас для роботи з партіями товарів в Supabase
 */
class BatchQueries {
    constructor() {
        this.adapter = new DatabaseAdapter(true); // Використовуємо Supabase
    }

    /**
     * Отримати всі партії для конкретного товару
     */
    async getBatchesByProduct(productId, includeExpired = false) {
        let query = this.adapter.client
            .from('production_batches')
            .select(`
                *,
                products:product_id (
                    name,
                    code,
                    pieces_per_box
                )
            `)
            .eq('product_id', productId);

        if (!includeExpired) {
            query = query
                .eq('status', 'ACTIVE')
                .gte('expiry_date', new Date().toISOString().split('T')[0]);
        }

        query = query.order('batch_date', { ascending: true });

        const { data, error } = await query;
        if (error) throw new Error(`Помилка отримання партій: ${error.message}`);

        // Додаємо розрахункові поля
        return data.map(batch => ({
            ...batch,
            product_name: batch.products?.name,
            product_code: batch.products?.code,
            pieces_per_box: batch.products?.pieces_per_box,
            batch_status: this.calculateBatchStatus(batch),
            days_to_expiry: this.calculateDaysToExpiry(batch.expiry_date),
            boxes_quantity: Math.floor(batch.available_quantity / (batch.products?.pieces_per_box || 1)),
            pieces_remainder: batch.available_quantity % (batch.products?.pieces_per_box || 1),
            total_boxes: Math.floor(batch.total_quantity / (batch.products?.pieces_per_box || 1)),
            is_expiring: this.calculateDaysToExpiry(batch.expiry_date) <= 7 && this.calculateDaysToExpiry(batch.expiry_date) > 0,
            is_expired: this.calculateDaysToExpiry(batch.expiry_date) <= 0
        }));
    }

    /**
     * Отримати всі партії згруповані по товарах
     */
    async getAllBatchesGrouped() {
        // Отримуємо товари з партіями
        const { data: products, error: productsError } = await this.adapter.client
            .from('products')
            .select(`
                id,
                name,
                code,
                pieces_per_box,
                min_stock_pieces,
                production_batches!inner (
                    id,
                    batch_date,
                    available_quantity,
                    reserved_quantity,
                    total_quantity,
                    expiry_date,
                    status
                )
            `)
            .eq('production_batches.status', 'ACTIVE')
            .gt('production_batches.available_quantity', 0);

        if (productsError) throw new Error(`Помилка отримання згрупованих партій: ${productsError.message}`);

        // Обробляємо дані
        return products.map(product => {
            const batches = product.production_batches || [];
            const totalAvailable = batches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
            const totalReserved = batches.reduce((sum, batch) => sum + (batch.reserved_quantity || 0), 0);
            const expiringQuantity = batches.reduce((sum, batch) => {
                const daysToExpiry = this.calculateDaysToExpiry(batch.expiry_date);
                return daysToExpiry <= 7 ? sum + (batch.available_quantity || 0) : sum;
            }, 0);

            const processedBatches = batches
                .map(batch => ({
                    ...batch,
                    batch_status: this.calculateBatchStatus(batch),
                    days_to_expiry: this.calculateDaysToExpiry(batch.expiry_date),
                    status: this.calculateBatchStatus(batch)
                }))
                .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date));

            return {
                product_id: product.id,
                product_name: product.name,
                product_code: product.code,
                pieces_per_box: product.pieces_per_box,
                min_stock_pieces: product.min_stock_pieces,
                batches_count: batches.length,
                total_available: totalAvailable,
                total_reserved: totalReserved,
                oldest_batch: batches.length > 0 ? Math.min(...batches.map(b => new Date(b.batch_date).getTime())) : null,
                newest_batch: batches.length > 0 ? Math.max(...batches.map(b => new Date(b.batch_date).getTime())) : null,
                expiring_quantity: expiringQuantity,
                batches: processedBatches,
                total_boxes: Math.floor(totalAvailable / product.pieces_per_box),
                stock_status: totalAvailable < product.min_stock_pieces ? 'low' : 
                           totalAvailable < product.min_stock_pieces * 2 ? 'warning' : 'good'
            };
        });
    }

    /**
     * Отримати партії що закінчуються
     */
    async getExpiringBatches(days = 7) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(days));

        const { data, error } = await this.adapter.client
            .from('production_batches')
            .select(`
                *,
                products:product_id (
                    name,
                    code,
                    pieces_per_box
                )
            `)
            .eq('status', 'ACTIVE')
            .gt('available_quantity', 0)
            .lte('expiry_date', expiryDate.toISOString().split('T')[0])
            .gte('expiry_date', new Date().toISOString().split('T')[0])
            .order('expiry_date', { ascending: true })
            .order('products(name)', { ascending: true });

        if (error) throw new Error(`Помилка отримання партій що закінчуються: ${error.message}`);

        return data.map(batch => ({
            ...batch,
            product_name: batch.products?.name,
            product_code: batch.products?.code,
            pieces_per_box: batch.products?.pieces_per_box,
            days_to_expiry: this.calculateDaysToExpiry(batch.expiry_date),
            boxes_quantity: Math.floor(batch.available_quantity / (batch.products?.pieces_per_box || 1)),
            pieces_remainder: batch.available_quantity % (batch.products?.pieces_per_box || 1),
            urgency: this.calculateUrgency(batch.expiry_date)
        }));
    }

    /**
     * Зарезервувати партії для замовлення
     */
    async reserveBatches(allocations) {
        const results = [];
        
        for (const allocation of allocations) {
            const { batch_id, quantity } = allocation;
            
            // Перевіряємо доступність партії
            const { data: batch, error: batchError } = await this.adapter.client
                .from('production_batches')
                .select('available_quantity')
                .eq('id', batch_id)
                .single();

            if (batchError || !batch) {
                throw new Error(`Партія ${batch_id} не знайдена`);
            }

            if (batch.available_quantity < quantity) {
                throw new Error(`Недостатньо товару в партії ${batch_id}. Доступно: ${batch.available_quantity}`);
            }

            // Резервуємо
            const { error: updateError } = await this.adapter.client
                .from('production_batches')
                .update({
                    reserved_quantity: (batch.reserved_quantity || 0) + quantity,
                    available_quantity: batch.available_quantity - quantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', batch_id);

            if (updateError) {
                throw new Error(`Помилка резервування партії ${batch_id}: ${updateError.message}`);
            }

            results.push({ batch_id, quantity, success: true });
        }

        return results;
    }

    /**
     * Звільнити резерви партій для замовлення
     */
    async unreserveBatches(allocations) {
        const results = [];
        
        for (const allocation of allocations) {
            const { batch_id, quantity } = allocation;
            
            // Отримуємо поточний стан партії
            const { data: batch, error: batchError } = await this.adapter.client
                .from('production_batches')
                .select('reserved_quantity, available_quantity')
                .eq('id', batch_id)
                .single();

            if (batchError || !batch) {
                console.warn(`Партія ${batch_id} не знайдена при звільненні резерву`);
                continue;
            }

            const releaseQuantity = Math.min(quantity, batch.reserved_quantity || 0);
            
            // Звільняємо резерв
            const { error: updateError } = await this.adapter.client
                .from('production_batches')
                .update({
                    reserved_quantity: Math.max(0, (batch.reserved_quantity || 0) - releaseQuantity),
                    available_quantity: batch.available_quantity + releaseQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', batch_id);

            if (updateError) {
                console.error(`Помилка звільнення резерву партії ${batch_id}:`, updateError);
            } else {
                results.push({ batch_id, quantity: releaseQuantity, success: true });
            }
        }

        return results;
    }

    /**
     * Отримати доступні партії для товару (FIFO)
     */
    async getAvailableBatchesForProduct(productId, quantityNeeded) {
        const { data: batches, error } = await this.adapter.client
            .from('production_batches')
            .select(`
                *,
                products:product_id (
                    pieces_per_box,
                    name
                )
            `)
            .eq('product_id', productId)
            .eq('status', 'ACTIVE')
            .gt('available_quantity', 0)
            .gte('expiry_date', new Date().toISOString().split('T')[0])
            .order('batch_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Помилка отримання доступних партій: ${error.message}`);

        const totalAvailable = batches.reduce((sum, batch) => sum + batch.available_quantity, 0);
        
        if (totalAvailable === 0) {
            return {
                quantity_reserved: 0,
                shortage: quantityNeeded,
                allocated_batches: [],
                product_name: batches[0]?.products?.name || 'Невідомий товар'
            };
        }

        // Розподіляємо кількість по партіях (FIFO)
        const allocatedBatches = [];
        let remainingQuantity = quantityNeeded;
        let quantityReserved = 0;

        for (const batch of batches) {
            if (remainingQuantity <= 0) break;

            const allocateFromBatch = Math.min(remainingQuantity, batch.available_quantity);

            allocatedBatches.push({
                batch_id: batch.id,
                batch_date: batch.batch_date,
                quantity: allocateFromBatch,
                expiry_date: batch.expiry_date
            });

            remainingQuantity -= allocateFromBatch;
            quantityReserved += allocateFromBatch;
        }

        return {
            quantity_reserved: quantityReserved,
            shortage: Math.max(0, remainingQuantity),
            allocated_batches: allocatedBatches,
            product_name: batches[0]?.products?.name
        };
    }

    /**
     * Списати партію
     */
    async writeoffBatch(batchId, quantity, reason, responsible, notes = '') {
        // Отримуємо інформацію про партію
        const { data: batch, error: batchError } = await this.adapter.client
            .from('production_batches')
            .select(`
                *,
                products:product_id (
                    pieces_per_box
                )
            `)
            .eq('id', batchId)
            .single();

        if (batchError || !batch) {
            throw new Error('Партію не знайдено');
        }

        if (batch.available_quantity < quantity) {
            throw new Error(`Недостатньо товару в партії. Доступно: ${batch.available_quantity}`);
        }

        const pieces_per_box = batch.products?.pieces_per_box || 1;
        const boxes_quantity = Math.floor(quantity / pieces_per_box);
        const pieces_quantity = quantity % pieces_per_box;

        // Транзакція для списання
        const { error: batchUpdateError } = await this.adapter.client
            .from('production_batches')
            .update({
                available_quantity: batch.available_quantity - quantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', batchId);

        if (batchUpdateError) {
            throw new Error(`Помилка оновлення партії: ${batchUpdateError.message}`);
        }

        // Створюємо запис списання
        const { error: writeoffError } = await this.adapter.client
            .from('writeoffs')
            .insert({
                product_id: batch.product_id,
                writeoff_date: new Date().toISOString().split('T')[0],
                total_quantity: quantity,
                boxes_quantity: boxes_quantity,
                pieces_quantity: pieces_quantity,
                reason: reason,
                responsible: responsible,
                notes: notes || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (writeoffError) {
            throw new Error(`Помилка створення запису списання: ${writeoffError.message}`);
        }

        // Додаємо рух запасів
        const { error: movementError } = await this.adapter.client
            .from('stock_movements')
            .insert({
                product_id: batch.product_id,
                movement_type: 'WRITEOFF',
                pieces: -quantity,
                boxes: -boxes_quantity,
                reason: `Списання партії ${batch.batch_date}: ${reason}`,
                user: responsible,
                batch_id: batchId,
                batch_date: batch.batch_date,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (movementError) {
            throw new Error(`Помилка запису руху: ${movementError.message}`);
        }

        // Оновлюємо загальні залишки
        const { error: productUpdateError } = await this.adapter.client
            .from('products')
            .update({
                stock_pieces: batch.products.stock_pieces - quantity,
                stock_boxes: batch.products.stock_boxes - boxes_quantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', batch.product_id);

        if (productUpdateError) {
            throw new Error(`Помилка оновлення загальних залишків: ${productUpdateError.message}`);
        }

        return {
            message: 'Партію успішно списано',
            batch_date: batch.batch_date,
            quantity_writeoff: quantity
        };
    }

    /**
     * Отримати доступність товару з урахуванням партій
     */
    async getProductAvailability(productId) {
        const { data: product, error: productError } = await this.adapter.client
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            throw new Error('Товар не знайдено');
        }

        // Отримуємо статистику партій
        const { data: batchStats, error: statsError } = await this.adapter.client
            .from('production_batches')
            .select('available_quantity, expiry_date')
            .eq('product_id', productId)
            .eq('status', 'ACTIVE')
            .gt('available_quantity', 0);

        if (statsError) {
            throw new Error(`Помилка отримання статистики партій: ${statsError.message}`);
        }

        const totalAvailable = batchStats.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
        const activeBatches = batchStats.length;
        
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const expiringQuantity = batchStats.reduce((sum, batch) => {
            const expiryDate = new Date(batch.expiry_date);
            return expiryDate <= weekFromNow ? sum + (batch.available_quantity || 0) : sum;
        }, 0);

        const expiredQuantity = batchStats.reduce((sum, batch) => {
            const expiryDate = new Date(batch.expiry_date);
            return expiryDate < now ? sum + (batch.available_quantity || 0) : sum;
        }, 0);

        const stockStatus = totalAvailable < product.min_stock_pieces ? 'low' : 
                          totalAvailable < product.min_stock_pieces * 2 ? 'warning' : 'good';

        return {
            product_id: productId,
            product_name: product.name,
            product_code: product.code,
            pieces_per_box: product.pieces_per_box,
            stock_pieces: product.stock_pieces,
            min_stock_pieces: product.min_stock_pieces,
            total_available: totalAvailable,
            active_batches: activeBatches,
            expiring_quantity: expiringQuantity,
            expired_quantity: expiredQuantity,
            stock_status: stockStatus,
            has_sufficient_stock: totalAvailable > 0,
            is_low_stock: totalAvailable < product.min_stock_pieces
        };
    }

    // Допоміжні методи
    calculateBatchStatus(batch) {
        const now = new Date();
        const expiryDate = new Date(batch.expiry_date);
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (expiryDate < now) return 'EXPIRED';
        if (expiryDate <= weekFromNow) return 'EXPIRING';
        if (batch.available_quantity <= 0) return 'DEPLETED';
        return 'ACTIVE';
    }

    calculateDaysToExpiry(expiryDate) {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    calculateUrgency(expiryDate) {
        const days = this.calculateDaysToExpiry(expiryDate);
        if (days <= 1) return 'critical';
        if (days <= 3) return 'high';
        return 'medium';
    }
}

module.exports = new BatchQueries();