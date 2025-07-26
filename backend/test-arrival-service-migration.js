// test-arrival-service-migration.js - Тести міграції ArrivalService

const arrivalService = require('./services/arrivalService-v2');

/**
 * Комплексні тести для ArrivalService-v2
 * Тестує роботу з приходами товарів в обох БД (SQLite та Supabase)
 */
class ArrivalServiceMigrationTest {
    constructor() {
        this.testResults = [];
        this.testArrivalId = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        console.log(logMessage);
        
        if (type === 'error') {
            this.testResults.push({ message, success: false, timestamp });
        } else if (type === 'success') {
            this.testResults.push({ message, success: true, timestamp });
        }
    }

    async runAllTests() {
        this.log('🚀 Початок тестування ArrivalService-v2', 'info');
        this.log(`📊 База даних: ${arrivalService.useSupabase ? 'Supabase' : 'SQLite'}`, 'info');

        try {
            // Основні тести функціональності
            await this.testGetAllArrivals();
            await this.testCreateArrival();
            
            if (this.testArrivalId) {
                await this.testGetArrivalById();
                await this.testArrivalStatistics();
            }
            
            await this.testValidation();

            // Підсумок тестування
            this.generateTestReport();
            
        } catch (error) {
            this.log(`❌ Критична помилка тестування: ${error.message}`, 'error');
        }
    }

    async testGetAllArrivals() {
        try {
            this.log('🧪 Тестування getAllArrivals()...', 'info');
            
            const result = await arrivalService.getAllArrivals();
            
            // Перевірка структури відповіді
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!Array.isArray(result.arrivals)) {
                throw new Error('arrivals не є масивом');
            }
            
            if (!result.stats || typeof result.stats !== 'object') {
                throw new Error('Відсутня або некоректна статистика');
            }
            
            this.log(`✅ getAllArrivals: ${result.arrivals.length} приходів знайдено`, 'success');
            this.log(`✅ Статистика: загалом ${result.stats.total_quantity} шт`, 'success');
            
        } catch (error) {
            this.log(`❌ getAllArrivals: ${error.message}`, 'error');
        }
    }

    async testCreateArrival() {
        try {
            this.log('🧪 Тестування createArrival()...', 'info');
            
            // Тестові дані для створення приходу
            const arrivalData = {
                arrival_date: new Date().toISOString().split('T')[0], // Сьогоднішня дата
                reason: 'Тестовий прихід товарів',
                created_by: 'test-user'
            };
            
            const items = [
                {
                    product_id: 1, // Припускаємо що товар з ID=1 існує
                    quantity: 50,
                    batch_date: new Date().toISOString().split('T')[0],
                    notes: 'Тестова партія товару'
                }
            ];

            const context = { user: 'test-user', log_operation: true };
            
            const result = await arrivalService.createArrival(arrivalData, items, context);
            
            if (!result.success) {
                throw new Error('Невуспішне створення приходу');
            }
            
            if (!result.arrival || !result.arrival_number) {
                throw new Error('Некоректна структура створеного приходу');
            }
            
            // Зберігаємо ID для подальших тестів
            this.testArrivalId = result.arrival.id;
            
            this.log(`✅ createArrival: прихід ${result.arrival_number} створено`, 'success');
            this.log(`✅ ID приходу: ${this.testArrivalId}, позицій: ${result.total_items}`, 'success');
            
        } catch (error) {
            this.log(`❌ createArrival: ${error.message}`, 'error');
            
            // Можливо товар з ID=1 не існує, спробуємо з іншими параметрами
            if (error.message.includes('товар') || error.message.includes('product')) {
                this.log('⚠️ Можливо товар з ID=1 не існує в БД', 'info');
            }
        }
    }

    async testGetArrivalById() {
        try {
            this.log(`🧪 Тестування getArrivalById(${this.testArrivalId})...`, 'info');
            
            const result = await arrivalService.getArrivalById(this.testArrivalId);
            
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!result.arrival || result.arrival.id !== this.testArrivalId) {
                throw new Error('Некоректний прихід повернений');
            }
            
            const requiredFields = ['id', 'arrival_number', 'arrival_date', 'reason', 'items'];
            for (const field of requiredFields) {
                if (!(field in result.arrival)) {
                    throw new Error(`Відсутнє поле ${field} в структурі приходу`);
                }
            }
            
            this.log(`✅ getArrivalById: прихід ${result.arrival.arrival_number} отримано`, 'success');
            this.log(`✅ Структура: ${result.arrival.total_items} позицій, ${result.arrival.total_quantity} шт`, 'success');
            
        } catch (error) {
            this.log(`❌ getArrivalById: ${error.message}`, 'error');
        }
    }

    async testArrivalStatistics() {
        try {
            this.log('🧪 Тестування getArrivalStatistics()...', 'info');
            
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const result = await arrivalService.getArrivalStatistics(weekAgo, today);
            
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!result.statistics || typeof result.statistics !== 'object') {
                throw new Error('Відсутня статистика');
            }
            
            const requiredStatsFields = ['total_arrivals', 'total_quantity', 'average_quantity_per_arrival'];
            for (const field of requiredStatsFields) {
                if (!(field in result.statistics)) {
                    throw new Error(`Відсутнє поле ${field} в статистиці`);
                }
            }
            
            this.log(`✅ getArrivalStatistics: ${result.statistics.total_arrivals} приходів за тиждень`, 'success');
            this.log(`✅ Загальна кількість: ${result.statistics.total_quantity} шт`, 'success');
            
        } catch (error) {
            this.log(`❌ getArrivalStatistics: ${error.message}`, 'error');
        }
    }

    async testValidation() {
        try {
            this.log('🧪 Тестування validateArrivalData()...', 'info');
            
            // Тест 1: Валідні дані
            const validArrivalData = {
                arrival_date: new Date().toISOString().split('T')[0],
                reason: 'Валідний тестовий прихід'
            };
            
            const validItems = [
                {
                    product_id: 1,
                    quantity: 10,
                    batch_date: new Date().toISOString().split('T')[0]
                }
            ];
            
            const validResult = await arrivalService.validateArrivalData(validArrivalData, validItems);
            
            if (!validResult.isValid) {
                throw new Error(`Валідні дані не пройшли валідацію: ${validResult.errors.join(', ')}`);
            }
            
            this.log('✅ Валідація: валідні дані пройшли перевірку', 'success');
            
            // Тест 2: Невалідні дані
            const invalidArrivalData = {
                arrival_date: '', // Порожня дата
                reason: 'xx' // Занадто короткий reason
            };
            
            const invalidItems = [
                {
                    product_id: null, // Відсутній товар
                    quantity: -5, // Від'ємна кількість
                    batch_date: '2030-01-01' // Майбутня дата
                }
            ];
            
            const invalidResult = await arrivalService.validateArrivalData(invalidArrivalData, invalidItems);
            
            if (invalidResult.isValid) {
                throw new Error('Невалідні дані пройшли валідацію');
            }
            
            if (!Array.isArray(invalidResult.errors) || invalidResult.errors.length === 0) {
                throw new Error('Помилки валідації не повернені');
            }
            
            this.log(`✅ Валідація: невалідні дані відхилені (${invalidResult.errors.length} помилок)`, 'success');
            
        } catch (error) {
            this.log(`❌ Тестування валідації: ${error.message}`, 'error');
        }
    }

    generateTestReport() {
        this.log('\n📋 ЗВІТ ТЕСТУВАННЯ ARRIVALSERVICE-V2', 'info');
        this.log('=' * 50, 'info');
        
        const successCount = this.testResults.filter(r => r.success).length;
        const totalCount = this.testResults.length;
        const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
        
        this.log(`📊 Результати: ${successCount}/${totalCount} тестів пройдено (${successRate}%)`, 'info');
        this.log(`🗃️ База даних: ${arrivalService.useSupabase ? 'Supabase PostgreSQL' : 'SQLite'}`, 'info');
        
        if (this.testArrivalId) {
            this.log(`🧪 Тестовий прихід: ID ${this.testArrivalId}`, 'info');
        }
        
        // Детальні результати
        this.log('\n📝 Детальні результати:', 'info');
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            this.log(`${index + 1}. ${status} ${result.message}`, 'info');
        });
        
        // Підсумок
        if (successRate >= 80) {
            this.log('\n🎉 ТЕСТУВАННЯ ЗАВЕРШЕНО УСПІШНО!', 'success');
            this.log('ArrivalService-v2 готовий до використання з обраною БД', 'info');
        } else if (successRate >= 60) {
            this.log('\n⚠️ ТЕСТУВАННЯ ЗАВЕРШЕНО З ПОПЕРЕДЖЕННЯМИ', 'info');
            this.log('Основна функціональність працює, але є проблеми', 'info');
        } else {
            this.log('\n❌ ТЕСТУВАННЯ ПРОВАЛЕНО!', 'error');
            this.log('Критичні помилки в ArrivalService-v2, потребує виправлення', 'error');
        }
        
        this.log('\n💡 Рекомендації:', 'info');
        this.log('1. Перевірте конфігурацію USE_SUPABASE в .env', 'info');
        this.log('2. Переконайтеся що є тестові товари в обраній БД', 'info');
        this.log('3. Якщо тести провалилися - перевірте connection та схему БД', 'info');
        
        return {
            success_rate: successRate,
            total_tests: totalCount,
            successful_tests: successCount,
            database_type: arrivalService.useSupabase ? 'Supabase' : 'SQLite'
        };
    }
}

// Запуск тестів
async function runArrivalServiceTests() {
    const tester = new ArrivalServiceMigrationTest();
    const results = await tester.runAllTests();
    
    // Повертаємо результати для використання в CI/CD
    return results;
}

// Якщо файл запущено напряму
if (require.main === module) {
    runArrivalServiceTests()
        .then(results => {
            console.log('\n🏁 Тестування завершено!');
            process.exit(results.success_rate >= 80 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Фатальна помилка тестування:', error);
            process.exit(1);
        });
}

module.exports = { runArrivalServiceTests, ArrivalServiceMigrationTest };