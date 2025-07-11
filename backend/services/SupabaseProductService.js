const { supabase } = require('../supabase-client');

class SupabaseProductService {
    constructor() {
        console.log('✅ SupabaseProductService ініціалізовано');
    }

    async getAllProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка отримання товарів:', err.message);
            throw err;
        }
    }

    async getProductById(id) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка отримання товару:', err.message);
            throw err;
        }
    }

    async createProduct(productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    name: productData.name,
                    code: productData.code,
                    weight: productData.weight || null,
                    barcode: productData.barcode || null,
                    pieces_per_box: productData.pieces_per_box || 1,
                    stock_pieces: productData.stock_pieces || 0,
                    stock_boxes: productData.stock_boxes || 0,
                    min_stock_pieces: productData.min_stock_pieces || 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка створення товару:', err.message);
            throw err;
        }
    }

    async updateProduct(id, productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update({
                    name: productData.name,
                    code: productData.code,
                    weight: productData.weight,
                    barcode: productData.barcode,
                    pieces_per_box: productData.pieces_per_box,
                    stock_pieces: productData.stock_pieces,
                    stock_boxes: productData.stock_boxes,
                    min_stock_pieces: productData.min_stock_pieces,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка оновлення товару:', err.message);
            throw err;
        }
    }

    async deleteProduct(id) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[ProductService] Помилка видалення товару:', err.message);
            throw err;
        }
    }

    async getProductStats() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('stock_pieces, stock_boxes, min_stock_pieces');
                
            if (error) throw error;
            
            const stats = {
                total: data.length,
                low_stock: data.filter(p => p.stock_pieces < p.min_stock_pieces).length,
                out_of_stock: data.filter(p => p.stock_pieces === 0).length
            };
            
            return stats;
        } catch (err) {
            console.error('[ProductService] Помилка отримання статистики:', err.message);
            throw err;
        }
    }

    async searchProducts(query) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .or(`name.ilike.%${query}%,code.ilike.%${query}%,barcode.ilike.%${query}%`)
                .order('name');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка пошуку товарів:', err.message);
            throw err;
        }
    }

    async updateStock(id, pieces, boxes) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update({
                    stock_pieces: pieces,
                    stock_boxes: boxes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductService] Помилка оновлення залишків:', err.message);
            throw err;
        }
    }
}

module.exports = SupabaseProductService;
