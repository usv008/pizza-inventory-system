/**
 * Product Service v2 - з підтримкою Supabase та SQLite
 * Використовує DatabaseAdapter для універсальної роботи з БД
 */

const { NotFoundError, DatabaseError, UniqueConstraintError } = require('../middleware/errors/AppError');
const { createDatabaseAdapter } = require('../config/database');

// Залежності для операційного логування
let OperationsLogController = null;

/**
 * Ініціалізація залежностей
 */
function initialize(dependencies) {
    OperationsLogController = dependencies.OperationsLogController;
}

/**
 * Отримати всі товари
 */
async function getAllProducts() {
    const adapter = createDatabaseAdapter();
    
    try {
        const products = await adapter
            .table('products')
            .select('*', { orderBy: { column: 'name', direction: 'asc' } });
            
        return products;
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        throw new DatabaseError('Помилка отримання товарів', error);
    } finally {
        adapter.close();
    }
}

/**
 * Отримати товар за ID
 */
async function getProductById(id) {
    const adapter = createDatabaseAdapter();
    
    try {
        const products = await adapter
            .table('products')
            .select('*', { where: { id }, limit: 1 });
            
        const product = products[0];
        
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
    } finally {
        adapter.close();
    }
}

/**
 * Отримати товар за кодом
 */
async function getProductByCode(code) {
    const adapter = createDatabaseAdapter();
    
    try {
        const products = await adapter
            .table('products')
            .select('*', { where: { code }, limit: 1 });
            
        return products[0] || null;
    } catch (error) {
        console.error('Error in getProductByCode:', error);
        throw new DatabaseError('Помилка пошуку товару за кодом', error);
    } finally {
        adapter.close();
    }
}

/**
 * Отримати товар за штрихкодом
 */
async function getProductByBarcode(barcode) {
    const adapter = createDatabaseAdapter();
    
    try {
        const products = await adapter
            .table('products')
            .select('*', { where: { barcode }, limit: 1 });
            
        return products[0] || null;
    } catch (error) {
        console.error('Error in getProductByBarcode:', error);
        throw new DatabaseError('Помилка пошуку товару за штрихкодом', error);
    } finally {
        adapter.close();
    }
}

/**
 * Створити новий товар
 */
async function createProduct(validatedData, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Перевірити унікальність коду
        const existingByCode = await getProductByCode(validatedData.code);
        if (existingByCode) {
            throw new UniqueConstraintError('Товар з таким кодом');
        }
        
        // Перевірити унікальність штрихкоду (якщо вказано)
        if (validatedData.barcode) {
            const existingByBarcode = await getProductByBarcode(validatedData.barcode);
            if (existingByBarcode) {
                throw new UniqueConstraintError('Товар з таким штрихкодом');
            }
        }
        
        // Підготувати дані для створення
        const productData = {
            ...validatedData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Створити товар
        const result = await adapter.table('products').insert(productData);
        
        // Отримати створений товар
        const newProduct = await getProductById(result.id);
        
        // Логуємо створення товару
        if (OperationsLogController && newProduct.id) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.CREATE_PRODUCT,
                    newProduct,
                    userContext.userName || 'Адміністратор системи',
                    null,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування створення товару:', logError);
                // Не кидаємо помилку логування, щоб не зламати основну операцію
            }
        }
        
        return newProduct;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in createProduct:', error);
        throw new DatabaseError('Помилка створення товару', error);
    } finally {
        adapter.close();
    }
}

/**
 * Оновити товар
 */
async function updateProduct(id, validatedData, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати поточний товар
        const oldProduct = await getProductById(id);
        
        // Перевірити унікальність коду (якщо змінюється)
        if (validatedData.code && validatedData.code !== oldProduct.code) {
            const existingByCode = await getProductByCode(validatedData.code);
            if (existingByCode) {
                throw new UniqueConstraintError('Товар з таким кодом');
            }
        }
        
        // Перевірити унікальність штрихкоду (якщо змінюється)
        if (validatedData.barcode && validatedData.barcode !== oldProduct.barcode) {
            const existingByBarcode = await getProductByBarcode(validatedData.barcode);
            if (existingByBarcode) {
                throw new UniqueConstraintError('Товар з таким штрихкодом');
            }
        }
        
        // Підготувати дані для оновлення
        const updateData = {
            ...validatedData,
            updated_at: new Date().toISOString()
        };
        
        // Оновити товар
        await adapter.table('products').update(updateData, { id });
        
        // Отримати оновлений товар
        const updatedProduct = await getProductById(id);
        
        // Логуємо оновлення товару
        if (OperationsLogController && updatedProduct.id) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_PRODUCT,
                    updatedProduct,
                    userContext.userName || 'Адміністратор системи',
                    oldProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення товару:', logError);
            }
        }
        
        return updatedProduct;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateProduct:', error);
        throw new DatabaseError('Помилка оновлення товару', error);
    } finally {
        adapter.close();
    }
}

/**
 * Видалити товар
 */
async function deleteProduct(id, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати товар перед видаленням
        const product = await getProductById(id);
        
        // Видалити товар
        const deleted = await adapter.table('products').delete({ id });
        
        if (!deleted) {
            throw new DatabaseError('Не вдалося видалити товар');
        }
        
        // Логуємо видалення товару
        if (OperationsLogController && product.id) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.DELETE_PRODUCT,
                    product,
                    userContext.userName || 'Адміністратор системи',
                    product,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування видалення товару:', logError);
            }
        }
        
        return true;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in deleteProduct:', error);
        throw new DatabaseError('Помилка видалення товару', error);
    } finally {
        adapter.close();
    }
}

/**
 * Оновити запаси товару
 */
async function updateProductStock(id, stockData, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати поточний товар
        const oldProduct = await getProductById(id);
        
        // Підготувати дані для оновлення
        const updateData = {
            stock_pieces: stockData.stock_pieces,
            stock_boxes: stockData.stock_boxes,
            updated_at: new Date().toISOString()
        };
        
        // Оновити запаси
        await adapter.table('products').update(updateData, { id });
        
        // Отримати оновлений товар
        const updatedProduct = await getProductById(id);
        
        // Логуємо оновлення запасів
        if (OperationsLogController && updatedProduct.id) {
            try {
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_STOCK,
                    updatedProduct,
                    userContext.userName || 'Система',
                    oldProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення запасів:', logError);
            }
        }
        
        return updatedProduct;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateProductStock:', error);
        throw new DatabaseError('Помилка оновлення запасів товару', error);
    } finally {
        adapter.close();
    }
}

/**
 * Отримати товари з низькими запасами
 */
async function getLowStockProducts() {
    const adapter = createDatabaseAdapter();
    
    try {
        // В SQLite та Supabase різна логіка для порівняння колонок
        const useSupabase = process.env.USE_SUPABASE === 'true';
        if (useSupabase) {
            // Використовуємо Supabase специфічний запит
            const { supabase } = require('../database-supabase');
            const { data, error } = await supabase
                .rpc('get_low_stock_products');
                
            if (error) {
                throw new Error(`Supabase getLowStockProducts error: ${error.message}`);
            }
            
            return data || [];
        } else {
            // Для SQLite використовуємо raw запит
            const sql = `
                SELECT * FROM products 
                WHERE stock_pieces < min_stock_pieces 
                ORDER BY name
            `;
            return await adapter.raw(sql);
        }
    } catch (error) {
        console.error('Error in getLowStockProducts:', error);
        throw new DatabaseError('Помилка отримання товарів з низькими запасами', error);
    } finally {
        adapter.close();
    }
}

/**
 * Пошук товарів
 */
async function searchProducts(query) {
    const adapter = createDatabaseAdapter();
    
    try {
        const useSupabase = process.env.USE_SUPABASE === 'true';
        if (useSupabase) {
            // Використовуємо Supabase ilike для пошуку
            const { supabase } = require('../database-supabase');
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
                .order('name');
                
            if (error) {
                throw new Error(`Supabase searchProducts error: ${error.message}`);
            }
            
            return data || [];
        } else {
            // Для SQLite використовуємо LIKE
            const sql = `
                SELECT * FROM products 
                WHERE name LIKE ? OR code LIKE ?
                ORDER BY name
            `;
            const searchPattern = `%${query}%`;
            return await adapter.raw(sql, [searchPattern, searchPattern]);
        }
    } catch (error) {
        console.error('Error in searchProducts:', error);
        throw new DatabaseError('Помилка пошуку товарів', error);
    } finally {
        adapter.close();
    }
}

module.exports = {
    initialize,
    getAllProducts,
    getProductById,
    getProductByCode,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    getLowStockProducts,
    searchProducts
};