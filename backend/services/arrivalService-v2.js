// services/arrivalService-v2.js - Універсальний сервіс для роботи з приходами товарів

const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const config = require('../config/database');

/**
 * Сервіс для роботи з приходами товарів
 * Підтримує як SQLite так і Supabase
 */
class ArrivalService {
    constructor() {
        this.useSupabase = config.USE_SUPABASE;
        this.adapter = new DatabaseAdapter(this.useSupabase);
        
        console.log(`🚛 ArrivalService: використовується ${this.useSupabase ? 'Supabase' : 'SQLite'}`);
        
        // Завантажуємо відповідні queries
        if (this.useSupabase) {
            this.queries = require('../queries/supabase/arrivalQueries');
        } else {
            this.queries = require('../queries/sqlite/arrivalQueries');
        }
    }

    /**
     * Створити документ приходу товарів
     */
    async createArrival(arrivalData, items, context = {}) {
        try {
            // Валідація даних
            if (!arrivalData.arrival_date || !arrivalData.reason) {
                throw new Error('Обов\'язкові поля: arrival_date, reason');
            }

            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('Потрібно вказати хоча б одну позицію товару');
            }

            // Валідація позицій
            for (const item of items) {
                if (!item.product_id || !item.quantity || !item.batch_date) {
                    throw new Error('Кожна позиція повинна мати product_id, quantity та batch_date');
                }

                if (item.quantity <= 0) {
                    throw new Error('Кількість повинна бути більше 0');
                }
            }

            const result = await this.queries.createArrival(arrivalData, items);
            
            console.log(`📦 Створено прихід ${result.arrival_number}: ${result.total_quantity} шт (${result.total_items} позицій)`);
            
            // Логування операції
            if (context.log_operation) {
                // TODO: Інтегрувати з OperationsLogService коли буде створено
                console.log(`📊 Операція приходу: ${result.arrival_number} від ${context.user || 'system'}`);
            }

            return {
                success: true,
                message: 'Прихід товарів успішно створено',
                ...result
            };
        } catch (error) {
            console.error('Помилка створення приходу:', error);
            throw new Error(`Помилка створення приходу: ${error.message}`);
        }
    }

    /**
     * Отримати всі приходи з фільтрацією
     */
    async getAllArrivals(filters = {}) {
        try {
            const arrivals = await this.queries.getAllArrivals(filters);
            
            // Додаємо статистику
            const totalQuantity = arrivals.reduce((sum, arrival) => sum + (arrival.total_quantity || 0), 0);
            const totalItems = arrivals.reduce((sum, arrival) => sum + (arrival.total_items || 0), 0);
            
            return {
                success: true,
                arrivals: arrivals,
                count: arrivals.length,
                stats: {
                    total_arrivals: arrivals.length,
                    total_quantity: totalQuantity,
                    total_items: totalItems
                },
                filters: filters
            };
        } catch (error) {
            console.error('Помилка отримання приходів:', error);
            throw new Error(`Помилка отримання приходів: ${error.message}`);
        }
    }

    /**
     * Отримати прихід за ID з повною інформацією
     */
    async getArrivalById(arrivalId) {
        try {
            if (!arrivalId) {
                throw new Error('Не вказано ID приходу');
            }

            const arrival = await this.queries.getArrivalById(arrivalId);
            
            return {
                success: true,
                arrival: arrival
            };
        } catch (error) {
            console.error('Помилка отримання приходу:', error);
            throw new Error(`Помилка отримання приходу: ${error.message}`);
        }
    }

    /**
     * Видалити прихід (помічає як видалений)
     */
    async deleteArrival(arrivalId, context = {}) {
        try {
            if (!arrivalId) {
                throw new Error('Не вказано ID приходу');
            }

            // Перевіряємо чи існує прихід
            const existingArrival = await this.getArrivalById(arrivalId);
            if (!existingArrival.success) {
                throw new Error('Прихід не знайдено');
            }

            const result = await this.queries.deleteArrival(arrivalId);
            
            console.log(`🗑️ Видалено прихід ${arrivalId} користувачем ${context.user || 'system'}`);
            
            // Логування операції
            if (context.log_operation) {
                // TODO: Інтегрувати з OperationsLogService
                console.log(`📊 Операція видалення приходу: ${arrivalId} від ${context.user || 'system'}`);
            }

            return {
                success: true,
                message: 'Прихід успішно видалено',
                arrival_id: parseInt(arrivalId)
            };
        } catch (error) {
            console.error('Помилка видалення приходу:', error);
            throw new Error(`Помилка видалення приходу: ${error.message}`);
        }
    }

    /**
     * Отримати статистику приходів за період
     */
    async getArrivalStatistics(startDate, endDate) {
        try {
            const stats = await this.queries.getArrivalStatistics(startDate, endDate);
            
            return {
                success: true,
                statistics: stats
            };
        } catch (error) {
            console.error('Помилка отримання статистики приходів:', error);
            throw new Error(`Помилка отримання статистики: ${error.message}`);
        }
    }

    /**
     * Отримати приходи за період для звіту
     */
    async getArrivalsReport(startDate, endDate, groupBy = 'date') {
        try {
            const arrivals = await this.queries.getAllArrivals({
                start_date: startDate,
                end_date: endDate
            });

            const report = {
                period: { startDate, endDate },
                groupBy: groupBy,
                data: [],
                summary: {
                    total_arrivals: arrivals.length,
                    total_quantity: 0,
                    total_items: 0
                }
            };

            // Групуємо дані
            const groupedData = {};
            
            arrivals.forEach(arrival => {
                const key = groupBy === 'date' 
                    ? arrival.arrival_date 
                    : arrival.created_by || 'system';
                
                if (!groupedData[key]) {
                    groupedData[key] = {
                        key: key,
                        arrivals: 0,
                        quantity: 0,
                        items: 0
                    };
                }
                
                groupedData[key].arrivals++;
                groupedData[key].quantity += arrival.total_quantity || 0;
                groupedData[key].items += arrival.total_items || 0;
                
                report.summary.total_quantity += arrival.total_quantity || 0;
                report.summary.total_items += arrival.total_items || 0;
            });

            report.data = Object.values(groupedData).sort((a, b) => a.key.localeCompare(b.key));

            return {
                success: true,
                report: report
            };
        } catch (error) {
            console.error('Помилка створення звіту приходів:', error);
            throw new Error(`Помилка створення звіту: ${error.message}`);
        }
    }

    /**
     * Валідувати дані приходу перед створенням
     */
    async validateArrivalData(arrivalData, items) {
        const errors = [];

        // Валідація базових даних
        if (!arrivalData.arrival_date) {
            errors.push('Не вказана дата приходу');
        } else {
            const arrivalDate = new Date(arrivalData.arrival_date);
            const today = new Date();
            if (arrivalDate > today) {
                errors.push('Дата приходу не може бути в майбутньому');
            }
        }

        if (!arrivalData.reason || arrivalData.reason.trim().length < 3) {
            errors.push('Причина приходу повинна містити принаймні 3 символи');
        }

        // Валідація позицій
        if (!Array.isArray(items) || items.length === 0) {
            errors.push('Потрібно вказати хоча б одну позицію товару');
        } else {
            items.forEach((item, index) => {
                if (!item.product_id) {
                    errors.push(`Позиція ${index + 1}: не вказано товар`);
                }
                
                if (!item.quantity || item.quantity <= 0) {
                    errors.push(`Позиція ${index + 1}: некоректна кількість`);
                }
                
                if (!item.batch_date) {
                    errors.push(`Позиція ${index + 1}: не вказана дата партії`);
                } else {
                    const batchDate = new Date(item.batch_date);
                    const today = new Date();
                    if (batchDate > today) {
                        errors.push(`Позиція ${index + 1}: дата партії не може бути в майбутньому`);
                    }
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Отримати останні приходи (для dashboard)
     */
    async getRecentArrivals(limit = 10) {
        try {
            const arrivals = await this.queries.getAllArrivals({});
            
            // Повертаємо тільки останні records
            const recentArrivals = arrivals.slice(0, limit);
            
            return {
                success: true,
                arrivals: recentArrivals,
                count: recentArrivals.length
            };
        } catch (error) {
            console.error('Помилка отримання останніх приходів:', error);
            throw new Error(`Помилка отримання останніх приходів: ${error.message}`);
        }
    }
}

module.exports = new ArrivalService();