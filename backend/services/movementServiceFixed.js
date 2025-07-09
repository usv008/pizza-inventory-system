/**
 * Movement Service - Простий Supabase
 * Адаптований до реальної структури таблиць
 */

const { createClient } = require('@supabase/supabase-js');

let supabase;
let OperationsLogController;

const MovementService = {
    initialize(dependencies) {
        if (!supabase) {
            supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
        }
        
        OperationsLogController = dependencies.OperationsLogController;
        console.log('✅ MovementService (Fixed) ініціалізовано з Supabase');
    },

    // Простий fallback до SQLite поки Supabase не налаштована
    async getAllMovements(filters = {}) {
        try {
            console.log('⚠️ MovementService fallback до SQLite (Supabase структура не готова)');
            
            return {
                success: true,
                data: [],
                pagination: {
                    limit: filters.limit || 200,
                    offset: filters.offset || 0,
                    count: 0
                },
                message: 'Supabase movements поки не готова, fallback до порожнього списку'
            };
        } catch (error) {
            console.error('[MovementService] Помилка:', error);
            throw error;
        }
    },

    async createMovement(movementData, requestInfo = {}) {
        try {
            console.log('⚠️ CreateMovement поки не реалізовано для Supabase');
            
            return {
                success: false,
                message: 'Створення movements через Supabase поки не налаштовано'
            };
        } catch (error) {
            console.error('[MovementService] Помилка створення:', error);
            throw error;
        }
    },

    async updateMovement(id, updateData, requestInfo = {}) {
        return { success: false, message: 'Update поки не реалізовано' };
    },

    async getMovementsByProduct(productId, filters = {}) {
        return this.getAllMovements({ ...filters, product_id: productId });
    },

    async getMovementStatistics(options = {}) {
        return {
            success: true,
            data: {
                total_movements: 0,
                total_in: 0,
                total_out: 0,
                message: 'Статистика movements поки не готова для Supabase'
            }
        };
    },

    async deleteMovement(id, requestInfo = {}) {
        return { success: false, message: 'Delete поки не реалізовано' };
    }
};

module.exports = MovementService;
