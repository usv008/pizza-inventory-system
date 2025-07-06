const { NotFoundError, DatabaseError, UniqueConstraintError } = require('../middleware/errors/AppError');

/**
 * Product Service - бізнес-логіка для товарів
 * Згідно з creative-service-layer.md - Hybrid: Service Functions + Database Helpers
 */

let productQueries = null;
let OperationsLogController = null;

// Ініціалізація залежностей
function initialize(dependencies) {
    productQueries = dependencies.productQueries;
    OperationsLogController = dependencies.OperationsLogController;
}

/**
 * Отримати всі товари
 */
async function getAllProducts() {
    try {
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        const products = await productQueries.getAll();
        return products;
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        throw new DatabaseError('Помилка отримання товарів', error);
    }
}

/**
 * Отримати товар за ID
 */
async function getProductById(id) {
    try {
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        const product = await productQueries.getById(id);
        
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
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        const result = await productQueries.create(validatedData);
        
        // Логуємо створення товару
        if (OperationsLogController && result.id) {
            try {
                const newProduct = await productQueries.getById(result.id);
                
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
        
        return result;
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new UniqueConstraintError('Товар з таким кодом');
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
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        // Перевіряємо чи існує товар
        const existingProduct = await getProductById(id);
        
        const result = await productQueries.update(id, validatedData);
        
        // Логуємо оновлення товару
        if (OperationsLogController) {
            try {
                const updatedProduct = await productQueries.getById(id);
                
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
        
        return result;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new UniqueConstraintError('Товар з таким кодом');
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
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        // Перевіряємо чи існує товар перед видаленням
        const existingProduct = await getProductById(id);
        
        const result = await productQueries.delete(id);
        
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
        
        return result;
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
        if (!productQueries) {
            throw new DatabaseError('База даних недоступна');
        }
        
        // Перевіряємо чи існує товар
        const existingProduct = await getProductById(id);
        
        const result = await productQueries.updateStock(id, stockData);
        
        // Логуємо оновлення складу
        if (OperationsLogController) {
            try {
                const updatedProduct = await productQueries.getById(id);
                
                await OperationsLogController.logProductOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_STOCK,
                    updatedProduct,
                    userContext.userName || 'Адміністратор системи',
                    existingProduct,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення складу:', logError);
            }
        }
        
        return result;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateProductStock:', error);
        throw new DatabaseError('Помилка оновлення складу товару', error);
    }
}

module.exports = {
    initialize,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStock
}; 