// backend/supabase-database.js - Supabase заміна для database.js
const { supabase } = require('./supabase-client');

console.log('[SUPABASE DB] Ініціалізація Supabase database module...');

// ================================
// UTILITIES & HELPERS
// ================================

function handleSupabaseError(error, operation) {
    console.error(`[SUPABASE DB] Error in ${operation}:`, error.message);
    throw new Error(error.message);
}

// Supabase equivalent of initDatabase
async function initDatabase() {
    try {
        console.log('[SUPABASE DB] Testing Supabase connection...');
        
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .limit(1);
            
        if (error) throw error;
        
        console.log('🚀 Supabase база даних готова до роботи');
        return true;
    } catch (err) {
        console.error('❌ Помилка підключення до Supabase:', err.message);
        throw err;
    }
}

// ================================
// PRODUCT QUERIES - EXACT TRANSLATION
// ================================

const productQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
                
            if (error) handleSupabaseError(error, 'productQueries.getAll');
            
            // Add calculated fields to match SQLite behavior
            return data.map(product => ({
                ...product,
                stock_boxes: Math.floor(product.stock_pieces / product.pieces_per_box),
                calculated_boxes: Math.round((product.stock_pieces * 1.0) / product.pieces_per_box * 100) / 100,
                stock_status: product.stock_pieces < product.min_stock_pieces ? 'low' :
                             product.stock_pieces < product.min_stock_pieces * 2 ? 'warning' : 'good'
            }));
        } catch (err) {
            throw new Error(`productQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                handleSupabaseError(error, 'productQueries.getById');
            }
            
            // Add calculated fields
            return {
                ...data,
                stock_boxes: Math.floor(data.stock_pieces / data.pieces_per_box),
                calculated_boxes: Math.round((data.stock_pieces * 1.0) / data.pieces_per_box * 100) / 100
            };
        } catch (err) {
            throw new Error(`productQueries.getById: ${err.message}`);
        }
    },

    create: async (product) => {
        try {
            const { name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces } = product;
            
            const { data, error } = await supabase
                .from('products')
                .insert({
                    name,
                    code,
                    weight,
                    barcode,
                    pieces_per_box,
                    stock_pieces: stock_pieces || 0,
                    min_stock_pieces: min_stock_pieces || 0,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'productQueries.create');
            
            // Create initial stock movement if needed
            if (stock_pieces > 0) {
                await supabase
                    .from('stock_movements')
                    .insert({
                        product_id: data.id,
                        movement_type: 'IN',
                        pieces: stock_pieces,
                        boxes: Math.floor(stock_pieces / pieces_per_box),
                        reason: 'Початковий залишок'
                    });
            }
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`productQueries.create: ${err.message}`);
        }
    },

    update: async (id, product) => {
        try {
            const { name, code, weight, barcode, pieces_per_box, stock_pieces, min_stock_pieces } = product;
            
            const { error } = await supabase
                .from('products')
                .update({
                    name,
                    code,
                    weight,
                    barcode,
                    pieces_per_box,
                    stock_pieces,
                    min_stock_pieces,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'productQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`productQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'productQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`productQueries.delete: ${err.message}`);
        }
    },

    updateStock: async (productId, pieceChange, reason, movementType = 'ADJUSTMENT') => {
        try {
            // Get current product info
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('pieces_per_box, stock_pieces')
                .eq('id', productId)
                .single();
                
            if (productError) handleSupabaseError(productError, 'productQueries.updateStock.getProduct');
            if (!product) throw new Error('Товар не знайдено');
            
            let newStock = product.stock_pieces + pieceChange;
            if (newStock < 0) newStock = 0;
            
            const boxesChange = pieceChange / product.pieces_per_box;
            
            // Update stock
            const { error: updateError } = await supabase
                .from('products')
                .update({ stock_pieces: newStock })
                .eq('id', productId);
                
            if (updateError) handleSupabaseError(updateError, 'productQueries.updateStock.updateStock');
            
            // Create movement record
            const { error: movementError } = await supabase
                .from('stock_movements')
                .insert({
                    product_id: productId,
                    movement_type: movementType,
                    pieces: pieceChange,
                    boxes: boxesChange,
                    reason
                });
                
            if (movementError) handleSupabaseError(movementError, 'productQueries.updateStock.createMovement');
            
            return { success: true };
        } catch (err) {
            throw new Error(`productQueries.updateStock: ${err.message}`);
        }
    }
};

// ================================
// PRODUCTION QUERIES - SIMPLIFIED FOR SUPABASE
// ================================

const productionQueries = {
    create: async (record) => {
        try {
            let { product_id, production_date, total_quantity, expiry_date, responsible, notes, production_time } = record;
            
            // Auto-generate expiry_date if not provided
            if (!expiry_date && production_date) {
                const date = new Date(production_date);
                date.setDate(date.getDate() + 365);
                expiry_date = date.toISOString().split('T')[0];
            }
            
            // Auto-generate production_time if not provided
            if (!production_time) {
                const now = new Date();
                production_time = now.toLocaleTimeString('uk-UA', { hour12: false, timeZone: 'Europe/Kyiv' });
            }
            
            // Get product info
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('pieces_per_box')
                .eq('id', product_id)
                .single();
                
            if (productError) handleSupabaseError(productError, 'productionQueries.create.getProduct');
            if (!product) throw new Error('Товар не знайдено');
            
            const boxes_quantity = Math.floor(total_quantity / product.pieces_per_box);
            const pieces_quantity = total_quantity % product.pieces_per_box;
            
            // Create production record
            const { data: productionData, error: productionError } = await supabase
                .from('production')
                .insert({
                    product_id,
                    production_date,
                    production_time,
                    total_quantity,
                    boxes_quantity,
                    pieces_quantity,
                    expiry_date,
                    responsible: responsible || 'system',
                    notes
                })
                .select()
                .single();
                
            if (productionError) handleSupabaseError(productionError, 'productionQueries.create.insertProduction');
            
            // Create stock movement
            await supabase
                .from('stock_movements')
                .insert({
                    product_id,
                    movement_type: 'PRODUCTION',
                    pieces: total_quantity,
                    boxes: boxes_quantity,
                    reason: `Виробництво партії ${production_date}`,
                    user: responsible || 'system',
                    batch_date: production_date
                });
            
            // Update product stock - get current stock first
            const { data: currentProduct, error: stockError } = await supabase
                .from('products')
                .select('stock_pieces')
                .eq('id', product_id)
                .single();
                
            if (stockError) handleSupabaseError(stockError, 'productionQueries.create.getCurrentStock');
            
            const newStockPieces = (currentProduct.stock_pieces || 0) + total_quantity;
            
            await supabase
                .from('products')
                .update({
                    stock_pieces: newStockPieces,
                    updated_at: new Date().toISOString()
                })
                .eq('id', product_id);
            
            // ================================
            // CREATE OR UPDATE PRODUCTION BATCH
            // ================================
            // Перевіряємо чи існує партія з такою датою
            const { data: existingBatch } = await supabase
                .from('production_batches')
                .select('id, total_quantity, available_quantity')
                .eq('product_id', product_id)
                .eq('batch_date', production_date)
                .single();
                
            if (existingBatch) {
                // Оновлюємо існуючу партію
                await supabase
                    .from('production_batches')
                    .update({
                        total_quantity: existingBatch.total_quantity + total_quantity,
                        available_quantity: existingBatch.available_quantity + total_quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingBatch.id);
                console.log(`✅ Оновлено існуючу партію ${existingBatch.id}: +${total_quantity} шт`);
            } else {
                // Створюємо нову партію
                await supabase
                    .from('production_batches')
                    .insert({
                        product_id,
                        batch_date: production_date,
                        production_date: production_date,
                        production_id: productionData.id,
                        total_quantity,
                        available_quantity: total_quantity,
                        expiry_date,
                        status: 'ACTIVE',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                console.log(`✅ Створено нову партію: товар ${product_id}, дата ${production_date}, кількість ${total_quantity}`);
            }
                
            console.log(`✅ Створено партію для виробництва: товар ${product_id}, дата ${production_date}, кількість ${total_quantity}`);
                
            return { 
                id: productionData.id,
                success: true,
                total_quantity,
                batch_created: true
            };
        } catch (err) {
            throw new Error(`productionQueries.create: ${err.message}`);
        }
    },

    getAll: async () => {
        try {
            // Отримуємо production з даними про продукти
            const { data: productionData, error: productionError } = await supabase
                .from('production')
                .select(`
                    *,
                    products (name, code, pieces_per_box)
                `)
                .order('production_date', { ascending: false });
                
            if (productionError) handleSupabaseError(productionError, 'productionQueries.getAll');
            
            // Отримуємо дані про партії для кожного production
            const productionWithBatches = await Promise.all(
                productionData.map(async (item) => {
                    const { data: batch, error: batchError } = await supabase
                        .from('production_batches')
                        .select('id, available_quantity, status')
                        .eq('production_id', item.id)
                        .single();
                        
                    let batchInfo = {
                        batch_available_quantity: 0,
                        batch_status: 'NONE',
                        batch_id: null
                    };
                    
                    if (!batchError && batch) {
                        batchInfo = {
                            batch_available_quantity: batch.available_quantity || 0,
                            batch_status: batch.status || 'UNKNOWN',
                            batch_id: batch.id
                        };
                    }
                    
                    return {
                        ...item,
                        product_name: item.products?.name,
                        product_code: item.products?.code,
                        pieces_per_box: item.products?.pieces_per_box || 10,
                        ...batchInfo
                    };
                })
            );
            
            return productionWithBatches;
        } catch (err) {
            throw new Error(`productionQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('production')
                .select(`
                    *,
                    products (name, code)
                `)
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'productionQueries.getById');
            }
            
            return {
                ...data,
                product_name: data.products?.name,
                product_code: data.products?.code
            };
        } catch (err) {
            throw new Error(`productionQueries.getById: ${err.message}`);
        }
    },

    update: async (id, record) => {
        try {
            const { error } = await supabase
                .from('production')
                .update({
                    ...record,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'productionQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`productionQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('production')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'productionQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`productionQueries.delete: ${err.message}`);
        }
    },

    getByProductId: async (productId) => {
        try {
            const { data, error } = await supabase
                .from('production')
                .select(`
                    *,
                    products (name, code)
                `)
                .eq('product_id', productId)
                .order('production_date', { ascending: false });
                
            if (error) handleSupabaseError(error, 'productionQueries.getByProductId');
            
            return data.map(item => ({
                ...item,
                product_name: item.products?.name,
                product_code: item.products?.code
            }));
        } catch (err) {
            throw new Error(`productionQueries.getByProductId: ${err.message}`);
        }
    }
};

// ================================
// CLIENT QUERIES
// ================================

const clientQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');
                
            if (error) handleSupabaseError(error, 'clientQueries.getAll');
            return data;
        } catch (err) {
            throw new Error(`clientQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'clientQueries.getById');
            }
            
            return data;
        } catch (err) {
            throw new Error(`clientQueries.getById: ${err.message}`);
        }
    },

    create: async (client) => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert({
                    ...client,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'clientQueries.create');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`clientQueries.create: ${err.message}`);
        }
    },

    update: async (id, client) => {
        try {
            const { error } = await supabase
                .from('clients')
                .update({
                    ...client,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'clientQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`clientQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'clientQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`clientQueries.delete: ${err.message}`);
        }
    }
};

// ================================
// ORDER QUERIES - BASIC IMPLEMENTATION
// ================================

const orderQueries = {
    getAll: async (filters = {}) => {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    clients (name, contact_person),
                    order_items (
                        id,
                        product_id,
                        quantity,
                        pieces,
                        boxes,
                        notes,
                        products (name, code, pieces_per_box)
                    )
                `)
                .order('created_at', { ascending: false });
                
            // Застосовуємо фільтри
            if (filters.start_date) {
                query = query.gte('order_date', filters.start_date);
            }
            if (filters.end_date) {
                query = query.lte('order_date', filters.end_date);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.client_id) {
                query = query.eq('client_id', filters.client_id);
            }
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }
                
            const { data, error } = await query;
            
            if (error) handleSupabaseError(error, 'orderQueries.getAll');
            
            // Додаємо підрахунок товарів до кожного замовлення
            const enrichedData = (data || []).map(order => ({
                ...order,
                items_count: order.order_items?.length || 0,
                total_pieces: order.order_items?.reduce((sum, item) => sum + (item.pieces || item.quantity || 0), 0) || 0,
                total_boxes: order.order_items?.reduce((sum, item) => sum + (item.boxes || 0), 0) || 0,
                items: order.order_items // Alias для сумісності
            }));
            
            return enrichedData;
        } catch (err) {
            throw new Error(`orderQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    clients (name, contact_person),
                    order_items (
                        *,
                        products (name, code)
                    )
                `)
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'orderQueries.getById');
            }
            
            return data;
        } catch (err) {
            throw new Error(`orderQueries.getById: ${err.message}`);
        }
    },

    create: async (order) => {
        try {
            // Витягуємо items з order для окремої обробки
            const { items, ...orderWithoutItems } = order;
            
            // Створюємо замовлення без items
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    ...orderWithoutItems,
                    order_number: `ORD-${Date.now()}`, // Генеруємо номер замовлення
                    status: 'NEW',
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (orderError) handleSupabaseError(orderError, 'orderQueries.create.order');
            
            // Створюємо товари замовлення якщо є items
            if (items && items.length > 0) {
                const orderItems = items.map(item => ({
                    order_id: orderData.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    pieces: item.pieces || item.quantity || 0, // Додаємо pieces
                    boxes: item.boxes || 0, // Додаємо значення за замовчуванням
                    notes: item.notes || ''
                }));
                
                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);
                    
                if (itemsError) handleSupabaseError(itemsError, 'orderQueries.create.items');
            }
            
            return { 
                id: orderData.id,
                order_number: orderData.order_number
            };
        } catch (err) {
            throw new Error(`orderQueries.create: ${err.message}`);
        }
    },

    update: async (id, order) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    ...order,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'orderQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`orderQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'orderQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`orderQueries.delete: ${err.message}`);
        }
    }
};

// ================================
// WRITEOFF QUERIES
// ================================

const writeoffQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products (name, code)
                `)
                .order('writeoff_date', { ascending: false });
                
            if (error) handleSupabaseError(error, 'writeoffQueries.getAll');
            
            // Трансформуємо дані для сумісності з фронтендом
            const transformedData = data.map(item => ({
                ...item,
                product_name: item.products?.name,
                product_code: item.products?.code
            }));
            
            return transformedData;
        } catch (err) {
            throw new Error(`writeoffQueries.getAll: ${err.message}`);
        }
    },

    create: async (writeoff) => {
        try {
            const { data, error } = await supabase
                .from('writeoffs')
                .insert(writeoff)
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'writeoffQueries.create');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`writeoffQueries.create: ${err.message}`);
        }
    },

    getByProduct: async (productId) => {
        try {
            const { data, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products (name, code)
                `)
                .eq('product_id', productId)
                .order('writeoff_date', { ascending: false });
                
            if (error) handleSupabaseError(error, 'writeoffQueries.getByProduct');
            
            // Трансформуємо дані для сумісності з фронтендом
            const transformedData = data.map(item => ({
                ...item,
                product_name: item.products?.name,
                product_code: item.products?.code
            }));
            
            return transformedData;
        } catch (err) {
            throw new Error(`writeoffQueries.getByProduct: ${err.message}`);
        }
    }
};

// ================================
// MOVEMENTS QUERIES
// ================================

const movementsQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
                    *,
                    products (name, code)
                `)
                .order('created_at', { ascending: false });
                
            if (error) handleSupabaseError(error, 'movementsQueries.getAll');
            
            return data.map(item => ({
                ...item,
                product_name: item.products?.name,
                product_code: item.products?.code
            }));
        } catch (err) {
            throw new Error(`movementsQueries.getAll: ${err.message}`);
        }
    },

    create: async (movement) => {
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .insert(movement)
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'movementsQueries.create');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`movementsQueries.create: ${err.message}`);
        }
    },

    getByProduct: async (productId) => {
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
                
            if (error) handleSupabaseError(error, 'movementsQueries.getByProduct');
            return data;
        } catch (err) {
            throw new Error(`movementsQueries.getByProduct: ${err.message}`);
        }
    },

    update: async (id, movement) => {
        try {
            const { error } = await supabase
                .from('stock_movements')
                .update(movement)
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'movementsQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`movementsQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('stock_movements')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'movementsQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`movementsQueries.delete: ${err.message}`);
        }
    }
};

// ================================
// USER QUERIES
// ================================

const userQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('username');
                
            if (error) handleSupabaseError(error, 'userQueries.getAll');
            return data;
        } catch (err) {
            throw new Error(`userQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'userQueries.getById');
            }
            
            return data;
        } catch (err) {
            throw new Error(`userQueries.getById: ${err.message}`);
        }
    },

    getByUsername: async (username) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'userQueries.getByUsername');
            }
            
            return data;
        } catch (err) {
            throw new Error(`userQueries.getByUsername: ${err.message}`);
        }
    },

    create: async (user) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert({
                    ...user,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'userQueries.create');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`userQueries.create: ${err.message}`);
        }
    },

    update: async (id, user) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    ...user,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'userQueries.update');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`userQueries.update: ${err.message}`);
        }
    },

    delete: async (id) => {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', id);
                
            if (error) handleSupabaseError(error, 'userQueries.delete');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`userQueries.delete: ${err.message}`);
        }
    },

    validatePassword: async (username, password) => {
        try {
            const user = await userQueries.getByUsername(username);
            if (!user) return false;
            
            // This would need proper bcrypt comparison
            // For now, basic comparison (should be enhanced)
            return user.password_hash === password;
        } catch (err) {
            throw new Error(`userQueries.validatePassword: ${err.message}`);
        }
    }
};

// ================================
// SESSION QUERIES - BASIC IMPLEMENTATION
// ================================

const sessionQueries = {
    create: async (sessionData) => {
        try {
            // In real implementation, this would use user_sessions table
            // For now, basic memory/cache implementation
            return { success: true, session_id: Date.now().toString() };
        } catch (err) {
            throw new Error(`sessionQueries.create: ${err.message}`);
        }
    },

    validate: async (sessionId) => {
        try {
            // Basic validation - should be enhanced
            return sessionId && sessionId.length > 0;
        } catch (err) {
            throw new Error(`sessionQueries.validate: ${err.message}`);
        }
    },

    destroy: async (sessionId) => {
        try {
            // Basic destroy - should be enhanced
            return { success: true };
        } catch (err) {
            throw new Error(`sessionQueries.destroy: ${err.message}`);
        }
    }
};

// ================================
// AUDIT QUERIES - BASIC IMPLEMENTATION
// ================================

const auditQueries = {
    create: async (auditData) => {
        try {
            // Basic audit logging - should be enhanced with user_audit table
            console.log('[AUDIT]', auditData);
            return { success: true };
        } catch (err) {
            throw new Error(`auditQueries.create: ${err.message}`);
        }
    },

    getByUser: async (userId) => {
        try {
            // Basic implementation - should query user_audit table
            return [];
        } catch (err) {
            throw new Error(`auditQueries.getByUser: ${err.message}`);
        }
    }
};

// ================================
// BATCH QUERIES - SUPABASE IMPLEMENTATION
// ================================

const batchQueries = {
    getAll: async () => {
        try {
            const { data, error } = await supabase
                .from('production_batches')
                .select(`
                    *,
                    products (id, name, code, pieces_per_box)
                `)
                .order('batch_date', { ascending: false });
                
            if (error) handleSupabaseError(error, 'batchQueries.getAll');
            
            return data || [];
        } catch (err) {
            throw new Error(`batchQueries.getAll: ${err.message}`);
        }
    },

    getAllGroupedByProduct: async () => {
        try {
            // Отримуємо всі товари
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id, name, code, pieces_per_box, min_stock_pieces')
                .order('name');
                
            if (productsError) handleSupabaseError(productsError, 'batchQueries.getAllGroupedByProduct.products');
            
            // Отримуємо всі партії
            const { data: batches, error: batchesError } = await supabase
                .from('production_batches')
                .select('*')
                .eq('status', 'ACTIVE')
                .order('batch_date');
                
            if (batchesError) handleSupabaseError(batchesError, 'batchQueries.getAllGroupedByProduct.batches');
            
            // Групуємо партії по товарах
            const result = products.map(product => {
                const productBatches = (batches || []).filter(batch => batch.product_id === product.id);
                
                // Розраховуємо кількості
                const total_quantity = productBatches.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0);
                const available_quantity = productBatches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
                const reserved_quantity = productBatches.reduce((sum, batch) => sum + (batch.reserved_quantity || 0), 0);
                
                return {
                    product_id: product.id,
                    product_name: product.name,
                    product_code: product.code,
                    pieces_per_box: product.pieces_per_box,
                    total_quantity,
                    available_quantity,
                    reserved_quantity,
                    batches_count: productBatches.length,
                    batches: productBatches.map(batch => ({
                        id: batch.id,
                        production_id: batch.production_id,
                        batch_date: batch.batch_date,
                        production_date: batch.production_date,
                        expiry_date: batch.expiry_date,
                        total_quantity: batch.total_quantity,
                        available_quantity: batch.available_quantity,
                        reserved_quantity: batch.reserved_quantity || 0,
                        status: batch.status,
                        created_at: batch.created_at
                    }))
                };
            });
            
            return result;
        } catch (err) {
            throw new Error(`batchQueries.getAllGroupedByProduct: ${err.message}`);
        }
    },

    getByProductId: async (productId) => {
        try {
            const { data, error } = await supabase
                .from('production_batches')
                .select(`
                    *,
                    products (id, name, code, pieces_per_box)
                `)
                .eq('product_id', productId)
                .order('batch_date', { ascending: false });
                
            if (error) handleSupabaseError(error, 'batchQueries.getByProductId');
            
            return data || [];
        } catch (err) {
            throw new Error(`batchQueries.getByProductId: ${err.message}`);
        }
    },

    getExpiring: async (days = 7) => {
        try {
            // Партії що закінчуються протягом вказаної кількості днів
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);
            
            const { data, error } = await supabase
                .from('production_batches')
                .select(`
                    *,
                    products (id, name, code, pieces_per_box)
                `)
                .eq('status', 'ACTIVE')
                .gt('available_quantity', 0)
                .lte('expiry_date', expiryDate.toISOString().split('T')[0])
                .order('expiry_date');
                
            if (error) handleSupabaseError(error, 'batchQueries.getExpiring');
            
            return data || [];
        } catch (err) {
            throw new Error(`batchQueries.getExpiring: ${err.message}`);
        }
    },

    updateQuantities: async (batchId, updates) => {
        try {
            const { error } = await supabase
                .from('production_batches')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', batchId);
                
            if (error) handleSupabaseError(error, 'batchQueries.updateQuantities');
            
            return { changes: 1 };
        } catch (err) {
            throw new Error(`batchQueries.updateQuantities: ${err.message}`);
        }
    }
};

// ================================
// ARRIVAL QUERIES - SUPABASE IMPLEMENTATION
// ================================

const arrivalQueries = {
    getAll: async (filters = {}) => {
        try {
            let query = supabase
                .from('arrivals')
                .select(`
                    *,
                    arrivals_items (
                        id,
                        product_id,
                        quantity,
                        batch_date,
                        notes,
                        products (id, name, code)
                    )
                `)
                .order('arrival_date', { ascending: false });

            if (filters.date_from) {
                query = query.gte('arrival_date', filters.date_from);
            }
            if (filters.date_to) {
                query = query.lte('arrival_date', filters.date_to);
            }
            if (filters.created_by) {
                query = query.eq('created_by', filters.created_by);
            }
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }

            const { data, error } = await query;
            
            if (error) handleSupabaseError(error, 'arrivalQueries.getAll');
            
            return data || [];
        } catch (err) {
            throw new Error(`arrivalQueries.getAll: ${err.message}`);
        }
    },

    getById: async (id) => {
        try {
            const { data, error } = await supabase
                .from('arrivals')
                .select(`
                    *,
                    arrivals_items (
                        id,
                        product_id,
                        quantity,
                        batch_date,
                        notes,
                        products (id, name, code)
                    )
                `)
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null;
                handleSupabaseError(error, 'arrivalQueries.getById');
            }
            
            return data;
        } catch (err) {
            throw new Error(`arrivalQueries.getById: ${err.message}`);
        }
    },

    create: async (arrivalData) => {
        try {
            const { arrival_date, reason, created_by } = arrivalData;
            
            // Генеруємо arrival_number
            const { data: existingCount, error: countError } = await supabase
                .from('arrivals')
                .select('id', { count: 'exact' })
                .eq('arrival_date', arrival_date);
                
            if (countError) handleSupabaseError(countError, 'arrivalQueries.create.count');
            
            const count = (existingCount?.length || 0) + 1;
            const arrival_number = `${arrival_date.replace(/-/g, '')}-${String(count).padStart(3, '0')}`;
            
            const { data, error } = await supabase
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
                
            if (error) handleSupabaseError(error, 'arrivalQueries.create');
            
            return { id: data.id, arrival_number: data.arrival_number };
        } catch (err) {
            throw new Error(`arrivalQueries.create: ${err.message}`);
        }
    },

    createItem: async (arrivalId, itemData) => {
        try {
            const { product_id, quantity, batch_date, notes } = itemData;
            
            const { data, error } = await supabase
                .from('arrivals_items')
                .insert({
                    arrival_id: arrivalId,
                    product_id,
                    quantity,
                    batch_date,
                    notes: notes || '',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'arrivalQueries.createItem');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`arrivalQueries.createItem: ${err.message}`);
        }
    },

    updateProductStock: async (productId, quantityChange) => {
        try {
            // Отримуємо поточний stock
            const { data: product, error: getError } = await supabase
                .from('products')
                .select('stock_pieces')
                .eq('id', productId)
                .single();
                
            if (getError) handleSupabaseError(getError, 'arrivalQueries.updateProductStock.get');
            
            const newStock = (product.stock_pieces || 0) + quantityChange;
            
            const { error: updateError } = await supabase
                .from('products')
                .update({ 
                    stock_pieces: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);
                
            if (updateError) handleSupabaseError(updateError, 'arrivalQueries.updateProductStock.update');
            
            return { success: true, new_stock: newStock };
        } catch (err) {
            throw new Error(`arrivalQueries.updateProductStock: ${err.message}`);
        }
    },

    createMovement: async (movementData) => {
        try {
            const { product_id, quantity, reason, created_by, batch_date } = movementData;
            
            const { data, error } = await supabase
                .from('stock_movements')
                .insert({
                    product_id,
                    movement_type: 'IN',
                    pieces: quantity,
                    boxes: 0,
                    reason,
                    user: created_by || 'system',
                    batch_date,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (error) handleSupabaseError(error, 'arrivalQueries.createMovement');
            
            return { id: data.id };
        } catch (err) {
            throw new Error(`arrivalQueries.createMovement: ${err.message}`);
        }
    },

    upsertBatch: async (batchData) => {
        try {
            const { product_id, batch_date, quantity } = batchData;
            
            // Перевіряємо чи існує партія
            const { data: existingBatch, error: getError } = await supabase
                .from('production_batches')
                .select('*')
                .eq('product_id', product_id)
                .eq('batch_date', batch_date)
                .single();
                
            if (getError && getError.code !== 'PGRST116') {
                handleSupabaseError(getError, 'arrivalQueries.upsertBatch.get');
            }
            
            if (existingBatch) {
                // Оновлюємо існуючу партію
                const newTotal = existingBatch.total_quantity + quantity;
                const newAvailable = existingBatch.available_quantity + quantity;
                
                const { error: updateError } = await supabase
                    .from('production_batches')
                    .update({
                        total_quantity: newTotal,
                        available_quantity: newAvailable,
                        status: 'ACTIVE',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingBatch.id);
                    
                if (updateError) handleSupabaseError(updateError, 'arrivalQueries.upsertBatch.update');
                
                return { id: existingBatch.id, created: false };
            } else {
                // Створюємо нову партію
                const { data, error } = await supabase
                    .from('production_batches')
                    .insert({
                        product_id,
                        batch_date,
                        production_date: batch_date,
                        total_quantity: quantity,
                        available_quantity: quantity,
                        expiry_date: new Date(new Date(batch_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        status: 'ACTIVE',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                    
                if (error) handleSupabaseError(error, 'arrivalQueries.upsertBatch.create');
                
                return { id: data.id, created: true };
            }
        } catch (err) {
            throw new Error(`arrivalQueries.upsertBatch: ${err.message}`);
        }
    }
};

// ================================
// LEGACY DB COMPATIBILITY STUB
// ================================
// Тимчасова заглушка для db (для старих файлів що ще не мігровані)
const db = {
    run: () => { throw new Error('db.run() не підтримується в Supabase. Використовуйте orderQueries, productQueries і т.д.'); },
    get: () => { throw new Error('db.get() не підтримується в Supabase. Використовуйте orderQueries, productQueries і т.д.'); },
    all: () => { throw new Error('db.all() не підтримується в Supabase. Використовуйте orderQueries, productQueries і т.д.'); }
};

// ================================
// EXPORTS - IDENTICAL INTERFACE TO database.js
// ================================

module.exports = {
    db,
    initDatabase,
    supabase,
    productQueries,
    productionQueries,
    clientQueries,
    orderQueries,
    writeoffQueries,
    movementsQueries,
    batchQueries,
    arrivalQueries,
    userQueries,
    sessionQueries,
    auditQueries
};

console.log('[SUPABASE DB] ✅ Supabase database module створено успішно');
