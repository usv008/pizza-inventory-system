/**
 * Product Queries для Supabase PostgreSQL
 * Замінює SQLite запити для роботи з продуктами
 */

const { supabase } = require('../../database-supabase');

const productQueries = {
    /**
     * Отримати всі продукти
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
                
            if (error) {
                throw new Error(`Supabase getAll products error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('productQueries.getAll error:', error);
            throw error;
        }
    },

    /**
     * Отримати продукт за ID
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getById product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.getById error:', error);
            throw error;
        }
    },

    /**
     * Отримати продукт за кодом
     */
    async getByCode(code) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('code', code)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getByCode product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.getByCode error:', error);
            throw error;
        }
    },

    /**
     * Отримати продукт за штрихкодом
     */
    async getByBarcode(barcode) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('barcode', barcode)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getByBarcode product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.getByBarcode error:', error);
            throw error;
        }
    },

    /**
     * Створити новий продукт
     */
    async create(productData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...productData,
                properties: productData.properties ? productData.properties : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('products')
                .insert(processedData)
                .select()
                .single();
                
            if (error) {
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('code')) {
                        throw new Error('Продукт з таким кодом вже існує');
                    }
                    if (error.message.includes('barcode')) {
                        throw new Error('Продукт з таким штрихкодом вже існує');
                    }
                }
                throw new Error(`Supabase create product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.create error:', error);
            throw error;
        }
    },

    /**
     * Оновити продукт
     */
    async update(id, productData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...productData,
                properties: productData.properties ? productData.properties : null,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('products')
                .update(processedData)
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Продукт не знайдений');
                }
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('code')) {
                        throw new Error('Продукт з таким кодом вже існує');
                    }
                    if (error.message.includes('barcode')) {
                        throw new Error('Продукт з таким штрихкодом вже існує');
                    }
                }
                throw new Error(`Supabase update product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.update error:', error);
            throw error;
        }
    },

    /**
     * Видалити продукт
     */
    async delete(id) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
                
            if (error) {
                throw new Error(`Supabase delete product error: ${error.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('productQueries.delete error:', error);
            throw error;
        }
    },

    /**
     * Оновити запаси продукту
     */
    async updateStock(id, stockData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update({
                    stock_pieces: stockData.stock_pieces,
                    stock_boxes: stockData.stock_boxes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Продукт не знайдений');
                }
                throw new Error(`Supabase updateStock product error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('productQueries.updateStock error:', error);
            throw error;
        }
    },

    /**
     * Отримати продукти з низькими запасами
     */
    async getLowStockProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .lt('stock_pieces', supabase.ref('min_stock_pieces'))
                .order('name');
                
            if (error) {
                throw new Error(`Supabase getLowStockProducts error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('productQueries.getLowStockProducts error:', error);
            throw error;
        }
    },

    /**
     * Пошук продуктів за назвою або кодом
     */
    async search(query) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
                .order('name');
                
            if (error) {
                throw new Error(`Supabase search products error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('productQueries.search error:', error);
            throw error;
        }
    }
};

module.exports = productQueries;