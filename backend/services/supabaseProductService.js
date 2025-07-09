const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { NotFoundError, DatabaseError, UniqueConstraintError } = require('../middleware/errors/AppError');

/**
 * Supabase Product Service - бізнес-логіка для товарів через Supabase
 * Міграція з SQLite на PostgreSQL/Supabase
 */

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

let OperationsLogController = null;

// Ініціалізація залежностей
function initialize(dependencies) {
    OperationsLogController = dependencies.OperationsLogController;
}

/**
 * Отримати всі товари
 */
async function getAllProducts() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                id,
                name,
                category,
                unit,
                cost_per_unit,
                selling_price,
                current_stock,
                min_stock_level,
                max_stock_level,
                supplier,
                description,
                is_active,
                created_at,
                updated_at
            `)
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Supabase error in getAllProducts:', error);
            throw new DatabaseError('Помилка отримання товарів з Supabase', error);
        }

        // Add stock_status calculation
        const productsWithStatus = (products || []).map(product => ({
            ...product,
            stock_status: product.current_stock < product.min_stock_level ? 'low' :
                         product.current_stock < product.min_stock_level * 2 ? 'warning' : 'good'
        }));

        return productsWithStatus;
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        if (error instanceof DatabaseError) {
            throw error;
        }
        throw new DatabaseError('Помилка отримання товарів', error);
    }
}

/**
 * Отримати товар за ID
 */
async function getProductById(id) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select(`
                id,
                name,
                category,
                unit,
                cost_per_unit,
                selling_price,
                current_stock,
                min_stock_level,
                max_stock_level,
                supplier,
                description,
                is_active,
                created_at,
                updated_at
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotFoundError('Товар');
            }
            console.error('Supabase error in getProductById:', error);
            throw new DatabaseError('Помилка отримання товару з Supabase', error);
        }

        if (!product) {
            throw new NotFoundError('Товар');
        }

        return product;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in getProductById:', error);
        throw new DatabaseError('Помилка отримання товару', error);
    }
}

/**
 * Створити новий товар
 */
async function createProduct(validatedData, userContext = {}) {
    try {
        // Map data from SQLite format to Supabase format
        const supabaseData = {
            name: validatedData.name,
            category: validatedData.category || 'general',
            unit: validatedData.unit || 'pieces',
            cost_per_unit: validatedData.cost_per_unit || 0,
            selling_price: validatedData.selling_price || 0,
            current_stock: validatedData.stock_pieces || validatedData.current_stock || 0,
            min_stock_level: validatedData.min_stock_pieces || validatedData.min_stock_level || 0,
            max_stock_level: validatedData.max_stock_level || null,
            supplier: validatedData.supplier || null,
            description: validatedData.description || 
                        `Product code: ${validatedData.code || 'N/A'}, Weight: ${validatedData.weight || 'N/A'}`,
            is_active: true
        };

        const { data: product, error } = await supabase
            .from('products')
            .insert([supabaseData])
            .select()
            .single();

        if (error) {
            console.error('Supabase error in createProduct:', error);
            if (error.code === '23505') { // PostgreSQL unique constraint violation
                throw new UniqueConstraintError('Товар з такими даними');
            }
            throw new DatabaseError('Помилка створення товару в Supabase', error);
        }

        // Логуємо створення товару
        if (OperationsLogController && product.id) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.CREATE_PRODUCT,
                    product,
                    userContext.userName || 'Адміністратор системи',
                    null,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування створення товару:', logError);
                // Не кидаємо помилку логування, щоб не зламати основну операцію
            }
        }

        return { id: product.id };
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in createProduct:', error);
        throw new DatabaseError('Помилка створення товару', error);
    }
}

/**
 * Оновити товар
 */
async function updateProduct(id, validatedData, userContext = {}) {
    try {
        // Перевіряємо чи існує товар
        const existingProduct = await getProductById(id);

        // Map data from SQLite format to Supabase format
        const supabaseData = {
            name: validatedData.name,
            category: validatedData.category || existingProduct.category,
            unit: validatedData.unit || existingProduct.unit,
            cost_per_unit: validatedData.cost_per_unit !== undefined 
                          ? validatedData.cost_per_unit 
                          : existingProduct.cost_per_unit,
            selling_price: validatedData.selling_price !== undefined 
                          ? validatedData.selling_price 
                          : existingProduct.selling_price,
            current_stock: validatedData.stock_pieces !== undefined 
                          ? validatedData.stock_pieces 
                          : (validatedData.current_stock !== undefined 
                             ? validatedData.current_stock 
                             : existingProduct.current_stock),
            min_stock_level: validatedData.min_stock_pieces !== undefined 
                            ? validatedData.min_stock_pieces 
                            : (validatedData.min_stock_level !== undefined 
                               ? validatedData.min_stock_level 
                               : existingProduct.min_stock_level),
            max_stock_level: validatedData.max_stock_level !== undefined 
                            ? validatedData.max_stock_level 
                            : existingProduct.max_stock_level,
            supplier: validatedData.supplier !== undefined 
                     ? validatedData.supplier 
                     : existingProduct.supplier,
            description: validatedData.description !== undefined 
                        ? validatedData.description 
                        : existingProduct.description,
            updated_at: new Date().toISOString()
        };

        const { data: updatedProduct, error } = await supabase
            .from('products')
            .update(supabaseData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Supabase error in updateProduct:', error);
            if (error.code === '23505') { // PostgreSQL unique constraint violation
                throw new UniqueConstraintError('Товар з такими даними');
            }
            throw new DatabaseError('Помилка оновлення товару в Supabase', error);
        }

        // Логуємо оновлення товару
        if (OperationsLogController) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_PRODUCT,
                    updatedProduct,
                    userContext.userName || 'Адміністратор системи',
                    existingProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення товару:', logError);
            }
        }

        return { changes: 1 };
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateProduct:', error);
        throw new DatabaseError('Помилка оновлення товару', error);
    }
}

/**
 * Видалити товар
 */
async function deleteProduct(id, userContext = {}) {
    try {
        // Перевіряємо чи існує товар перед видаленням
        const existingProduct = await getProductById(id);

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error in deleteProduct:', error);
            throw new DatabaseError('Помилка видалення товару з Supabase', error);
        }

        // Логуємо видалення товару
        if (OperationsLogController) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.DELETE_PRODUCT,
                    null,
                    userContext.userName || 'Адміністратор системи',
                    existingProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування видалення товару:', logError);
            }
        }

        return { changes: 1 };
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in deleteProduct:', error);
        throw new DatabaseError('Помилка видалення товару', error);
    }
}

/**
 * Оновити склад товару
 */
async function updateProductStock(id, stockData, userContext = {}) {
    try {
        // Перевіряємо чи існує товар
        const existingProduct = await getProductById(id);

        const { current_stock, reason, movement_type = 'ADJUSTMENT' } = stockData;
        let newStock = current_stock;

        if (typeof current_stock !== 'number') {
            throw new Error('current_stock має бути числом');
        }

        // Оновлюємо stock в товарі
        const { data: updatedProduct, error } = await supabase
            .from('products')
            .update({ 
                current_stock: newStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Supabase error in updateProductStock:', error);
            throw new DatabaseError('Помилка оновлення складу товару в Supabase', error);
        }

        // Створюємо запис руху (якщо є stock_movements таблиця)
        if (reason && movement_type) {
            try {
                const stockMovementData = {
                    product_id: id,
                    movement_type: movement_type.toUpperCase(),
                    quantity: newStock - existingProduct.current_stock,
                    reason: reason,
                    reference_type: 'manual',
                    reference_id: null,
                    created_at: new Date().toISOString()
                };

                // Note: Ця таблиця може не існувати в поточній Supabase схемі
                const { error: movementError } = await supabase
                    .from('stock_movements')
                    .insert([stockMovementData]);

                if (movementError) {
                    console.warn('Warning: Could not create stock movement record:', movementError);
                    // Не кидаємо помилку, тому що основна операція пройшла успішно
                }
            } catch (movementErr) {
                console.warn('Warning: Stock movements table may not exist:', movementErr);
            }
        }

        // Логуємо оновлення складу
        if (OperationsLogController) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_PRODUCT_STOCK,
                    updatedProduct,
                    userContext.userName || 'Адміністратор системи',
                    existingProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення складу товару:', logError);
            }
        }

        return { success: true };
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateProductStock:', error);
        throw new DatabaseError('Помилка оновлення складу товару', error);
    }
}

/**
 * Compatibility wrapper для повернення результатів в SQLite форматі
 */
function wrapLegacyResponse(supabaseData) {
    if (!supabaseData) return null;

    return {
        ...supabaseData,
        // Map Supabase fields to SQLite equivalents for backward compatibility
        code: supabaseData.description ? supabaseData.description.match(/Product code: ([^,]+)/)?.[1] : null,
        weight: supabaseData.description ? supabaseData.description.match(/Weight: ([^,]+)/)?.[1] : null,
        stock_pieces: supabaseData.current_stock,
        min_stock_pieces: supabaseData.min_stock_level,
        pieces_per_box: 1, // Default value since not stored in Supabase
        stock_boxes: Math.floor(supabaseData.current_stock / 1), // Assuming 1 piece per box
        calculated_boxes: supabaseData.current_stock / 1
    };
}

module.exports = {
    initialize,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    wrapLegacyResponse
}; 