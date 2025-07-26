// test-batch-service-migration.js - Тести міграції BatchService

const batchService = require('./services/batchService-v2');

/**
 * Комплексні тести для BatchService-v2
 * Тестує роботу з партіями товарів в обох БД (SQLite та Supabase)
 */
class BatchServiceMigrationTest {
    constructor() {
        this.testResults = [];
        this.testProductId = null;
        this.testBatchId = null;
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
        this.log('🚀 Початок тестування BatchService-v2', 'info');
        this.log(`📊 База даних: ${batchService.useSupabase ? 'Supabase' : 'SQLite'}`, 'info');

        try {
            // Основні тести функціональності
            await this.testGetAllBatchesGrouped();
            await this.testGetExpiringBatches();
            
            // Знаходимо тестовий товар з партіями
            await this.findTestProduct();
            
            if (this.testProductId) {
                await this.testGetBatchesByProduct();
                await this.testGetProductAvailability();
                await this.testReservationLogic();
            }

            // Підсумок тестування
            this.generateTestReport();
            
        } catch (error) {
            this.log(`❌ Критична помилка тестування: ${error.message}`, 'error');
        }
    }

    async testGetAllBatchesGrouped() {
        try {
            this.log('🧪 Тестування getAllBatchesGrouped()...', 'info');
            
            const result = await batchService.getAllBatchesGrouped();
            
            // Перевірка структури відповіді
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!Array.isArray(result.products)) {
                throw new Error('products не є масивом');
            }
            
            if (!result.stats || typeof result.stats !== 'object') {
                throw new Error('Відсутня або некоректна статистика');
            }
            
            this.log(`✅ getAllBatchesGrouped: ${result.products.length} товарів з партіями`, 'success');
            
            // Детальна перевірка структури продуктів
            if (result.products.length > 0) {
                const firstProduct = result.products[0];
                const requiredFields = ['product_id', 'product_name', 'total_available', 'batches'];
                
                for (const field of requiredFields) {
                    if (!(field in firstProduct)) {
                        throw new Error(`Відсутнє поле ${field} в структурі продукту`);
                    }
                }
                
                this.log(`✅ Структура продукту коректна`, 'success');
            }
            
        } catch (error) {
            this.log(`❌ getAllBatchesGrouped: ${error.message}`, 'error');
        }
    }

    async testGetExpiringBatches() {
        try {
            this.log('🧪 Тестування getExpiringBatches()...', 'info');
            
            const result = await batchService.getExpiringBatches(30); // 30 днів
            
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!Array.isArray(result.batches)) {
                throw new Error('batches не є масивом');
            }
            
            if (!result.urgency_breakdown || typeof result.urgency_breakdown !== 'object') {
                throw new Error('Відсутня структура urgency_breakdown');
            }
            
            this.log(`✅ getExpiringBatches: ${result.count} партій закінчуються в найближчі 30 днів`, 'success');
            
            // Перевірка urgency breakdown
            const { critical, high, medium } = result.urgency_breakdown;
            if (typeof critical !== 'number' || typeof high !== 'number' || typeof medium !== 'number') {
                throw new Error('Некоректна структура urgency_breakdown');
            }
            
            this.log(`✅ Розподіл за терміновістю: критичні=${critical}, високі=${high}, середні=${medium}`, 'success');
            
        } catch (error) {
            this.log(`❌ getExpiringBatches: ${error.message}`, 'error');
        }
    }

    async findTestProduct() {
        try {
            this.log('🔍 Пошук тестового товару з партіями...', 'info');
            
            const groupedResult = await batchService.getAllBatchesGrouped();
            
            if (groupedResult.products.length === 0) {
                this.log('⚠️ Немає товарів з партіями для тестування', 'info');
                return;
            }
            
            // Знаходимо товар з найбільшою кількістю партій
            const productWithMostBatches = groupedResult.products.reduce((max, product) => 
                (product.batches_count || 0) > (max.batches_count || 0) ? product : max
            );
            
            this.testProductId = productWithMostBatches.product_id;
            this.log(`✅ Обрано тестовий товар: ${productWithMostBatches.product_name} (ID: ${this.testProductId}, партій: ${productWithMostBatches.batches_count})`, 'success');
            
        } catch (error) {
            this.log(`❌ Помилка пошуку тестового товару: ${error.message}`, 'error');
        }
    }

    async testGetBatchesByProduct() {
        try {
            this.log(`🧪 Тестування getBatchesByProduct(${this.testProductId})...`, 'info');
            
            const result = await batchService.getBatchesByProduct(this.testProductId, false);
            
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            if (!Array.isArray(result.batches)) {
                throw new Error('batches не є масивом');
            }
            
            if (result.product_id !== this.testProductId) {
                throw new Error('Некоректний product_id у відповіді');
            }
            
            this.log(`✅ getBatchesByProduct: ${result.count} активних партій`, 'success');
            
            // Зберігаємо ID першої партії для подальших тестів
            if (result.batches.length > 0) {
                this.testBatchId = result.batches[0].id;
                this.log(`✅ Знайдено тестову партію: ${this.testBatchId}`, 'success');
                
                // Перевірка структури партії
                const batch = result.batches[0];
                const requiredFields = ['id', 'product_id', 'available_quantity', 'batch_date', 'expiry_date'];
                
                for (const field of requiredFields) {
                    if (!(field in batch)) {
                        throw new Error(`Відсутнє поле ${field} в структурі партії`);
                    }
                }
                
                this.log(`✅ Структура партії коректна`, 'success');
            }
            
        } catch (error) {
            this.log(`❌ getBatchesByProduct: ${error.message}`, 'error');
        }
    }

    async testGetProductAvailability() {
        try {
            this.log(`🧪 Тестування getProductAvailability(${this.testProductId})...`, 'info');
            
            const result = await batchService.getProductAvailability(this.testProductId);
            
            if (!result.success) {
                throw new Error('Невуспішна відповідь');
            }
            
            const requiredFields = [
                'product_id', 'product_name', 'total_available', 
                'active_batches', 'stock_status', 'has_sufficient_stock'
            ];
            
            for (const field of requiredFields) {
                if (!(field in result)) {
                    throw new Error(`Відсутнє поле ${field} в availability`);
                }
            }
            
            if (result.product_id !== this.testProductId) {
                throw new Error('Некоректний product_id у відповіді');
            }
            
            this.log(`✅ getProductAvailability: ${result.total_available} шт доступно, статус: ${result.stock_status}`, 'success');
            
        } catch (error) {
            this.log(`❌ getProductAvailability: ${error.message}`, 'error');
        }
    }

    async testReservationLogic() {
        try {
            this.log('🧪 Тестування логіки резервування партій...', 'info');
            
            // Тест 1: Автоматичне резервування для товару (FIFO)
            const reserveResult = await batchService.reserveBatchesForProduct(
                this.testProductId, 
                5, // 5 штук
                { user: 'test-user' }
            );
            
            if (!reserveResult.success) {
                throw new Error('Помилка автоматичного резервування');
            }
            
            this.log(`✅ Автоматичне резервування: ${reserveResult.quantity_reserved} шт зарезервовано, дефіцит: ${reserveResult.shortage}`, 'success');
            
            // Тест 2: Резервування для замовлення (множина товарів)
            const orderItems = [
                { product_id: this.testProductId, quantity: 3 }
            ];
            
            const orderReserveResult = await batchService.reserveBatchesForOrderItems(
                999, // тестовий order_id
                orderItems,
                { user: 'test-user' }
            );
            
            if (!orderReserveResult.success) {
                throw new Error('Помилка резервування для замовлення');
            }
            
            this.log(`✅ Резервування замовлення: ${orderReserveResult.total_reserved} шт зарезервовано`, 'success');
            
            // Тест 3: Звільнення резервів
            // Симулюємо allocated_batches з попереднього резервування
            const mockOrderItems = orderReserveResult.reservations.map(res => ({
                id: 1,
                product_id: res.product_id,
                allocated_batches: JSON.stringify(res.allocated_batches || [])
            }));
            
            const unreserveResult = await batchService.unreserveBatchesForOrder(
                999,
                mockOrderItems,
                { user: 'test-user' }
            );
            
            if (!unreserveResult.success) {
                throw new Error('Помилка звільнення резервів');
            }
            
            this.log(`✅ Звільнення резервів: ${unreserveResult.released_quantity} шт звільнено`, 'success');
            
        } catch (error) {
            this.log(`❌ Тестування резервування: ${error.message}`, 'error');
        }
    }

    generateTestReport() {
        this.log('\n📋 ЗВІТ ТЕСТУВАННЯ BATCHSERVICE-V2', 'info');
        this.log('=' * 50, 'info');
        
        const successCount = this.testResults.filter(r => r.success).length;
        const totalCount = this.testResults.length;
        const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
        
        this.log(`📊 Результати: ${successCount}/${totalCount} тестів пройдено (${successRate}%)`, 'info');
        this.log(`🗃️ База даних: ${batchService.useSupabase ? 'Supabase PostgreSQL' : 'SQLite'}`, 'info');
        
        if (this.testProductId) {
            this.log(`🧪 Тестовий товар: ID ${this.testProductId}`, 'info');
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
            this.log('BatchService-v2 готовий до використання з обраною БД', 'info');
        } else if (successRate >= 60) {
            this.log('\n⚠️ ТЕСТУВАННЯ ЗАВЕРШЕНО З ПОПЕРЕДЖЕННЯМИ', 'info');
            this.log('Основна функціональність працює, але є проблеми', 'info');
        } else {
            this.log('\n❌ ТЕСТУВАННЯ ПРОВАЛЕНО!', 'error');
            this.log('Критичні помилки в BatchService-v2, потребує виправлення', 'error');
        }
        
        this.log('\n💡 Рекомендації:', 'info');
        this.log('1. Перевірте конфігурацію USE_SUPABASE в .env', 'info');
        this.log('2. Переконайтеся що є тестові дані в обраній БД', 'info');
        this.log('3. Якщо тести провалилися - перевірте connection та схему БД', 'info');
        
        return {
            success_rate: successRate,
            total_tests: totalCount,
            successful_tests: successCount,
            database_type: batchService.useSupabase ? 'Supabase' : 'SQLite'
        };
    }
}

// Запуск тестів
async function runBatchServiceTests() {
    const tester = new BatchServiceMigrationTest();
    const results = await tester.runAllTests();
    
    // Повертаємо результати для використання в CI/CD
    return results;
}

// Якщо файл запущено напряму
if (require.main === module) {
    runBatchServiceTests()
        .then(results => {
            console.log('\n🏁 Тестування завершено!');
            process.exit(results.success_rate >= 80 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Фатальна помилка тестування:', error);
            process.exit(1);
        });
}

module.exports = { runBatchServiceTests, BatchServiceMigrationTest };