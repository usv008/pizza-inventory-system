/**
 * Production Queries для Supabase PostgreSQL
 * Запити для роботи з виробництвом та партіями продукції
 */

const { supabase } = require('../../database-supabase');

const ProductionQueries = {
    /**
     * Отримати всі записи виробництва
     */
    async getAll() {
        const { data, error } = await supabase
            .from('production')
            .select(`
                *,
                products:product_id (
                    name,
                    code,
                    pieces_per_box
                )
            `)
            .order('production_date', { ascending: false })
            .order('production_time', { ascending: false });

        if (error) {
            console.error('Помилка отримання виробництва:', error);
            throw error;
        }

        // Отримуємо партії для кожного виробництва окремо
        const result = [];
        for (const item of data || []) {
            // Шукаємо партію за продуктом та датою виробництва
            const { data: batchData } = await supabase
                .from('production_batches')
                .select('batch_date, available_quantity')
                .eq('product_id', item.product_id)
                .eq('batch_date', item.production_date)
                .limit(1);

            const batch = batchData?.[0];

            result.push({
                ...item,
                product_name: item.products?.name,
                product_code: item.products?.code,
                pieces_per_box: item.products?.pieces_per_box,
                production_batches: batch ? [batch] : [],
                batch_date: batch?.batch_date,
                batch_available: batch?.available_quantity
            });
        }

        return result;
    },

    /**
     * Отримати виробництво за ID товару
     */
    async getByProductId(productId) {
        const { data, error } = await supabase
            .from('production')
            .select(`
                *,
                products:product_id (
                    name,
                    code,
                    pieces_per_box
                ),
                production_batches!production_id (
                    batch_date,
                    available_quantity
                )
            `)
            .eq('product_id', productId)
            .order('production_date', { ascending: false })
            .order('production_time', { ascending: false });

        if (error) {
            console.error('Помилка отримання виробництва за товаром:', error);
            throw error;
        }

        // Адаптуємо структуру для сумісності з SQLite
        return (data || []).map(item => ({
            ...item,
            product_name: item.products?.name,
            product_code: item.products?.code,
            pieces_per_box: item.products?.pieces_per_box,
            batch_date: item.production_batches?.[0]?.batch_date,
            batch_available: item.production_batches?.[0]?.available_quantity
        }));
    },

    /**
     * Створити запис виробництва з партією
     */
    async create(productionData) {
        try {
            const {
                product_id,
                production_date,
                total_quantity,
                expiry_date,
                responsible = 'system',
                notes,
                production_time
            } = productionData;

            // 1. Спочатку отримуємо інформацію про товар
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('pieces_per_box')
                .eq('id', product_id)
                .single();

            if (productError) {
                throw new Error(`Товар не знайдено: ${productError.message}`);
            }

            // Обчислюємо коробки та штуки
            const boxes_quantity = Math.floor(total_quantity / product.pieces_per_box);
            const pieces_quantity = total_quantity % product.pieces_per_box;

            // Автоматично встановлюємо expiry_date якщо не передано (+ 365 днів)
            let finalExpiryDate = expiry_date;
            if (!finalExpiryDate && production_date) {
                const date = new Date(production_date);
                date.setDate(date.getDate() + 365);
                finalExpiryDate = date.toISOString().split('T')[0];
            }

            // Автоматично встановлюємо production_time якщо не передано
            let finalProductionTime = production_time;
            if (!finalProductionTime) {
                const now = new Date();
                const kyivTime = now.toLocaleTimeString('uk-UA', { 
                    hour12: false, 
                    timeZone: 'Europe/Kyiv' 
                });
                finalProductionTime = kyivTime;
            }

            // 2. Створюємо запис виробництва
            const { data: productionRecord, error: productionError } = await supabase
                .from('production')
                .insert({
                    product_id,
                    production_date,
                    production_time: finalProductionTime,
                    total_quantity,
                    boxes_quantity,
                    pieces_quantity,
                    expiry_date: finalExpiryDate,
                    responsible,
                    notes
                })
                .select()
                .single();

            if (productionError) {
                throw new Error(`Помилка створення виробництва: ${productionError.message}`);
            }

            // 3. Перевіряємо чи існує партія на цю дату
            const { data: existingBatch, error: batchCheckError } = await supabase
                .from('production_batches')
                .select('*')
                .eq('product_id', product_id)
                .eq('batch_date', production_date)
                .single();

            let batchId;

            if (existingBatch && !batchCheckError) {
                // Оновлюємо існуючу партію
                const { data: updatedBatch, error: updateError } = await supabase
                    .from('production_batches')
                    .update({
                        total_quantity: existingBatch.total_quantity + total_quantity,
                        available_quantity: existingBatch.available_quantity + total_quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingBatch.id)
                    .select()
                    .single();

                if (updateError) {
                    throw new Error(`Помилка оновлення партії: ${updateError.message}`);
                }

                batchId = existingBatch.id;
                console.log(`✅ Партія оновлена: ID ${batchId}, додано ${total_quantity} шт`);
            } else {
                // Створюємо нову партію
                const { data: newBatch, error: createBatchError } = await supabase
                    .from('production_batches')
                    .insert({
                        product_id,
                        batch_date: production_date,
                        production_date,
                        total_quantity,
                        available_quantity: total_quantity,
                        reserved_quantity: 0,
                        used_quantity: 0,
                        expiry_date: finalExpiryDate,
                        production_id: productionRecord.id,
                        status: 'ACTIVE',
                        notes: 'Створено автоматично'
                    })
                    .select()
                    .single();

                if (createBatchError) {
                    throw new Error(`Помилка створення партії: ${createBatchError.message}`);
                }

                batchId = newBatch.id;
                console.log(`✅ Нова партія створена: ID ${batchId}, кількість ${total_quantity} шт`);
            }

            // 4. Створюємо запис руху запасів
            const { error: movementError } = await supabase
                .from('stock_movements')
                .insert({
                    product_id,
                    movement_type: 'PRODUCTION',
                    pieces: total_quantity,
                    boxes: boxes_quantity,
                    reason: `Виробництво партії ${production_date}`,
                    user_name: responsible || 'system',
                    batch_id: batchId,
                    batch_date: production_date
                });

            if (movementError) {
                console.error('Помилка створення руху запасів:', movementError);
                // Не викидаємо помилку, щоб не блокувати основну операцію
            }

            // 5. Оновлюємо залишки товару в таблиці products
            // Спочатку отримуємо поточні залишки
            const { data: currentProduct, error: getCurrentError } = await supabase
                .from('products')
                .select('stock_pieces, stock_boxes')
                .eq('id', product_id)
                .single();

            if (!getCurrentError && currentProduct) {
                const { error: stockUpdateError } = await supabase
                    .from('products')
                    .update({
                        stock_pieces: (currentProduct.stock_pieces || 0) + total_quantity,
                        stock_boxes: (currentProduct.stock_boxes || 0) + boxes_quantity
                    })
                    .eq('id', product_id);

                if (stockUpdateError) {
                    console.error('Помилка оновлення запасів:', stockUpdateError);
                    // Не викидаємо помилку, щоб не блокувати основну операцію
                }
            }

            console.log(`🎉 Виробництво ${productionRecord.id} створено з партією ${production_date}`);
            
            return {
                id: productionRecord.id,
                boxes_quantity,
                pieces_quantity,
                batch_date: production_date,
                batch_id: batchId,
                ...productionRecord
            };

        } catch (error) {
            console.error('Критична помилка створення виробництва:', error);
            throw error;
        }
    },

    /**
     * Отримати статистики виробництва за період
     */
    async getStats(startDate, endDate) {
        let query = supabase
            .from('production')
            .select(`
                id,
                product_id,
                production_date,
                total_quantity,
                products:product_id (name)
            `);

        if (startDate) {
            query = query.gte('production_date', startDate);
        }

        if (endDate) {
            query = query.lte('production_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Помилка отримання статистик виробництва:', error);
            throw error;
        }

        // Обчислюємо статистики
        const stats = {
            total_records: data.length,
            total_quantity: data.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
            unique_products: new Set(data.map(item => item.product_id)).size,
            date_range: null
        };

        if (data.length > 0) {
            const dates = data.map(item => new Date(item.production_date)).sort();
            stats.date_range = {
                start: dates[0].toISOString().split('T')[0],
                end: dates[dates.length - 1].toISOString().split('T')[0]
            };
        }

        // Статистики по товарах
        const productStats = {};
        data.forEach(item => {
            if (!productStats[item.product_id]) {
                productStats[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.products?.name,
                    total_quantity: 0,
                    records_count: 0
                };
            }
            productStats[item.product_id].total_quantity += item.total_quantity;
            productStats[item.product_id].records_count += 1;
        });

        return {
            overview: stats,
            by_products: Object.values(productStats),
            period: { start: startDate, end: endDate }
        };
    },

    /**
     * Отримати доступні партії для товару (FIFO логіка)
     */
    async getAvailableBatches(productId) {
        const { data, error } = await supabase
            .from('production_batches')
            .select(`
                *,
                products:product_id (
                    name,
                    pieces_per_box
                )
            `)
            .eq('product_id', productId)
            .eq('status', 'ACTIVE')
            .gt('available_quantity', 0)
            .order('batch_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Помилка отримання партій:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Резервувати кількість з доступних партій (FIFO)
     */
    async reserveBatches(productId, quantityNeeded, reservedBy = 'system') {
        try {
            const availableBatches = await this.getAvailableBatches(productId);
            
            if (availableBatches.length === 0) {
                throw new Error('Немає доступних партій для резервування');
            }

            const allocations = [];
            let remainingQuantity = quantityNeeded;

            // Розподіляємо кількість по партіях (FIFO)
            for (const batch of availableBatches) {
                if (remainingQuantity <= 0) break;

                const availableInBatch = batch.available_quantity;
                const toAllocate = Math.min(remainingQuantity, availableInBatch);

                if (toAllocate > 0) {
                    allocations.push({
                        batch_id: batch.id,
                        batch_date: batch.batch_date,
                        allocated_quantity: toAllocate,
                        remaining_after: availableInBatch - toAllocate
                    });
                    remainingQuantity -= toAllocate;
                }
            }

            if (remainingQuantity > 0) {
                throw new Error(`Недостатньо товару для резервування. Потрібно: ${quantityNeeded}, доступно: ${quantityNeeded - remainingQuantity}`);
            }

            // Оновлюємо партії
            for (const allocation of allocations) {
                // Спочатку отримуємо поточні значення
                const { data: currentBatch, error: getCurrentBatchError } = await supabase
                    .from('production_batches')
                    .select('reserved_quantity, available_quantity')
                    .eq('id', allocation.batch_id)
                    .single();

                if (getCurrentBatchError || !currentBatch) {
                    throw new Error(`Помилка отримання партії ${allocation.batch_id}: ${getCurrentBatchError?.message}`);
                }

                const { error: updateError } = await supabase
                    .from('production_batches')
                    .update({
                        reserved_quantity: (currentBatch.reserved_quantity || 0) + allocation.allocated_quantity,
                        available_quantity: (currentBatch.available_quantity || 0) - allocation.allocated_quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', allocation.batch_id);

                if (updateError) {
                    throw new Error(`Помилка резервування партії ${allocation.batch_id}: ${updateError.message}`);
                }
            }

            console.log(`✅ Зарезервовано ${quantityNeeded} шт товару ${productId} в ${allocations.length} партіях`);
            
            return {
                success: true,
                allocations,
                total_reserved: quantityNeeded
            };

        } catch (error) {
            console.error('Помилка резервування партій:', error);
            throw error;
        }
    }
};

module.exports = ProductionQueries;