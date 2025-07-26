// queries/supabase/arrivalQueries.js - Supabase запити для роботи з приходами товарів

const DatabaseAdapter = require('../../adapters/DatabaseAdapter');

/**
 * Клас для роботи з приходами товарів в Supabase
 */
class ArrivalQueries {
    constructor() {
        this.adapter = new DatabaseAdapter(true); // Використовуємо Supabase
    }

    /**
     * Створити документ приходу з позиціями
     */
    async createArrival(arrivalData, items) {
        const { arrival_date, reason, created_by } = arrivalData;
        
        // 1. Генеруємо arrival_number
        const { count: todayCount } = await this.getArrivalsCountForDate(arrival_date);
        const arrival_number = `${arrival_date.replace(/-/g, '')}-${String(todayCount + 1).padStart(3, '0')}`;
        
        // 2. Створюємо arrival
        const { data: arrival, error: arrivalError } = await this.adapter.client
            .from('arrivals')
            .insert({
                arrival_number,
                arrival_date,
                reason,
                created_by: created_by || 'system',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (arrivalError) {
            throw new Error(`Помилка створення приходу: ${arrivalError.message}`);
        }

        // 3. Створюємо позиції приходу
        const arrivalItems = items.map(item => ({
            arrival_id: arrival.id,
            product_id: item.product_id,
            quantity: item.quantity,
            batch_date: item.batch_date,
            notes: item.notes || '',
            created_at: new Date().toISOString()
        }));

        const { data: createdItems, error: itemsError } = await this.adapter.client
            .from('arrivals_items')
            .insert(arrivalItems)
            .select(`
                *,
                products:product_id (
                    name,
                    code,
                    pieces_per_box
                )
            `);

        if (itemsError) {
            // Видаляємо arrival якщо не вдалося створити позиції
            await this.adapter.client
                .from('arrivals')
                .delete()
                .eq('id', arrival.id);
            
            throw new Error(`Помилка створення позицій приходу: ${itemsError.message}`);
        }

        // 4. Створюємо партії товарів та оновлюємо залишки
        for (const item of createdItems) {
            await this.createProductionBatch(item);
            await this.updateProductStock(item.product_id, item.quantity);
        }

        return {
            arrival: {
                ...arrival,
                items: createdItems
            },
            arrival_number,
            total_items: createdItems.length,
            total_quantity: createdItems.reduce((sum, item) => sum + item.quantity, 0)
        };
    }

    /**
     * Отримати кількість приходів за дату
     */
    async getArrivalsCountForDate(date) {
        const { count, error } = await this.adapter.client
            .from('arrivals')
            .select('*', { count: 'exact', head: true })
            .eq('arrival_date', date);

        if (error) {
            throw new Error(`Помилка підрахунку приходів: ${error.message}`);
        }

        return { count: count || 0 };
    }

    /**
     * Створити партію товару з приходу
     */
    async createProductionBatch(arrivalItem) {
        const batch = {
            product_id: arrivalItem.product_id,
            batch_date: arrivalItem.batch_date,
            production_date: arrivalItem.batch_date,
            total_quantity: arrivalItem.quantity,
            available_quantity: arrivalItem.quantity,
            reserved_quantity: 0,
            used_quantity: 0,
            expiry_date: this.calculateExpiryDate(arrivalItem.batch_date),
            status: 'ACTIVE',
            notes: `Партія з приходу ${arrivalItem.arrival_id}: ${arrivalItem.notes}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await this.adapter.client
            .from('production_batches')
            .insert(batch)
            .select()
            .single();

        if (error) {
            throw new Error(`Помилка створення партії: ${error.message}`);
        }

        return data;
    }

    /**
     * Оновити залишки товару
     */
    async updateProductStock(productId, quantity) {
        // Отримуємо поточні залишки
        const { data: product, error: productError } = await this.adapter.client
            .from('products')
            .select('stock_pieces, stock_boxes, pieces_per_box')
            .eq('id', productId)
            .single();

        if (productError) {
            throw new Error(`Помилка отримання товару: ${productError.message}`);
        }

        const pieces_per_box = product.pieces_per_box || 1;
        const boxes_to_add = Math.floor(quantity / pieces_per_box);
        
        const { error: updateError } = await this.adapter.client
            .from('products')
            .update({
                stock_pieces: (product.stock_pieces || 0) + quantity,
                stock_boxes: (product.stock_boxes || 0) + boxes_to_add,
                updated_at: new Date().toISOString()
            })
            .eq('id', productId);

        if (updateError) {
            throw new Error(`Помилка оновлення залишків: ${updateError.message}`);
        }

        // Додаємо запис руху запасів
        await this.createStockMovement(productId, quantity, boxes_to_add, `Приход товару`);
    }

    /**
     * Створити запис руху запасів
     */
    async createStockMovement(productId, pieces, boxes, reason) {
        const { error } = await this.adapter.client
            .from('stock_movements')
            .insert({
                product_id: productId,
                movement_type: 'ARRIVAL',
                pieces: pieces,
                boxes: boxes,
                reason: reason,
                user: 'system',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.warn(`Помилка створення руху запасів: ${error.message}`);
        }
    }

    /**
     * Розрахувати дату закінчення терміну придатності
     */
    calculateExpiryDate(batchDate) {
        const date = new Date(batchDate);
        date.setFullYear(date.getFullYear() + 1); // +1 рік за замовчуванням
        return date.toISOString().split('T')[0];
    }

    /**
     * Отримати всі приходи з фільтрацією
     */
    async getAllArrivals(filters = {}) {
        let query = this.adapter.client
            .from('arrivals')
            .select(`
                *,
                arrivals_items (
                    *,
                    products:product_id (
                        name,
                        code,
                        pieces_per_box
                    )
                )
            `);

        if (filters.start_date) {
            query = query.gte('arrival_date', filters.start_date);
        }

        if (filters.end_date) {
            query = query.lte('arrival_date', filters.end_date);
        }

        if (filters.created_by) {
            query = query.eq('created_by', filters.created_by);
        }

        query = query.order('arrival_date', { ascending: false })
                    .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            throw new Error(`Помилка отримання приходів: ${error.message}`);
        }

        // Обробляємо дані
        return data.map(arrival => ({
            ...arrival,
            total_items: arrival.arrivals_items?.length || 0,
            total_quantity: arrival.arrivals_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
            items: arrival.arrivals_items || []
        }));
    }

    /**
     * Отримати прихід за ID
     */
    async getArrivalById(arrivalId) {
        const { data, error } = await this.adapter.client
            .from('arrivals')
            .select(`
                *,
                arrivals_items (
                    *,
                    products:product_id (
                        name,
                        code,
                        pieces_per_box
                    )
                )
            `)
            .eq('id', arrivalId)
            .single();

        if (error) {
            throw new Error(`Помилка отримання приходу: ${error.message}`);
        }

        return {
            ...data,
            total_items: data.arrivals_items?.length || 0,
            total_quantity: data.arrivals_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
            items: data.arrivals_items || []
        };
    }

    /**
     * Видалити прихід (помічає як видалений)
     */
    async deleteArrival(arrivalId) {
        // В Supabase можемо або видалити повністю, або додати поле deleted_at
        const { error } = await this.adapter.client
            .from('arrivals')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', arrivalId);

        if (error) {
            throw new Error(`Помилка видалення приходу: ${error.message}`);
        }

        return { message: 'Прихід успішно видалено' };
    }

    /**
     * Отримати статистику приходів
     */
    async getArrivalStatistics(startDate, endDate) {
        let query = this.adapter.client
            .from('arrivals')
            .select(`
                id,
                arrival_date,
                arrivals_items (
                    quantity
                )
            `);

        if (startDate) {
            query = query.gte('arrival_date', startDate);
        }

        if (endDate) {
            query = query.lte('arrival_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Помилка отримання статистики: ${error.message}`);
        }

        const totalArrivals = data.length;
        const totalQuantity = data.reduce((sum, arrival) => {
            return sum + (arrival.arrivals_items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);

        return {
            total_arrivals: totalArrivals,
            total_quantity: totalQuantity,
            average_quantity_per_arrival: totalArrivals > 0 ? Math.round(totalQuantity / totalArrivals) : 0,
            period: {
                start_date: startDate,
                end_date: endDate
            }
        };
    }
}

module.exports = new ArrivalQueries();