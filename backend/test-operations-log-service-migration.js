// test-operations-log-service-migration.js - Тести міграції OperationsLogService

const operationsLogService = require('./services/operationsLogService-v2');

/**
 * Комплексні тести для OperationsLogService-v2
 * Тестує роботу з логуванням операцій в обох БД (SQLite та Supabase)
 */
class OperationsLogServiceMigrationTest {
    constructor() {
        this.testResults = [];
        this.testLogIds = [];
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
        this.log('🚀 Початок тестування OperationsLogService-v2', 'info');
        this.log(`📊 База даних: ${operationsLogService.useSupabase ? 'Supabase' : 'SQLite'}`, 'info');

        try {
            // Основні тести функціональності
            await this.testLogOperation();
            await this.testGetLogs();
            await this.testGetOperationsStats();
            await this.testGetEntityOperations();
            
            // Тести helper методів
            await this.testOrderOperationLogging();
            await this.testProductOperationLogging();
            
            // Тести валідації
            await this.testValidation();

            // Підсумок тестування
            this.generateTestReport();
            
        } catch (error) {
            this.log(`❌ Критична помилка тестування: ${error.message}`, 'error');
        }
    }

    async testLogOperation() {
        try {
            this.log('🧪 Тестування logOperation()...', 'info');
            
            const logData = {
                operation_type: 'CREATE_PRODUCT',
                operation_id: 999,
                entity_type: 'product',
                entity_id: 999,
                old_data: null,
                new_data: { id: 999, name: 'Тестовий товар', code: 'TEST999' },
                description: 'Створено тестовий товар для перевірки логування',
                user_name: 'test-user',
                ip_address: '127.0.0.1',
                user_agent: 'Test Agent 1.0'
            };
            
            const logId = await operationsLogService.logOperation(logData);
            
            if (!logId || typeof logId !== 'number') {
                throw new Error('Некоректний ID логу');
            }
            
            this.testLogIds.push(logId);
            this.log(`✅ logOperation: створено лог з ID ${logId}`, 'success');
            
        } catch (error) {
            this.log(`❌ logOperation: ${error.message}`, 'error');
        }
    }

    async testGetLogs() {
        try {
            this.log('🧪 Тестування getLogs()...', 'info');
            
            // Тест без фільтрів
            const allLogs = await operationsLogService.getLogs({ limit: 10 });
            
            if (!allLogs.success || !Array.isArray(allLogs.logs)) {
                throw new Error('Некоректна структура відповіді');
            }
            
            this.log(`✅ getLogs (всі): отримано ${allLogs.logs.length} логів`, 'success');
            
            // Тест з фільтрами
            const filteredLogs = await operationsLogService.getLogs({
                operation_type: 'CREATE_PRODUCT',
                entity_type: 'product',
                user_name: 'test-user',
                limit: 5
            });
            
            if (!filteredLogs.success || !Array.isArray(filteredLogs.logs)) {
                throw new Error('Некоректна структура фільтрованих логів');
            }
            
            this.log(`✅ getLogs (фільтровані): знайдено ${filteredLogs.logs.length} логів`, 'success');
            
        } catch (error) {
            this.log(`❌ getLogs: ${error.message}`, 'error');
        }
    }

    async testGetOperationsStats() {
        try {
            this.log('🧪 Тестування getOperationsStats()...', 'info');
            
            const stats = await operationsLogService.getOperationsStats(7); // За тиждень
            
            if (!stats.success || !stats.statistics) {
                throw new Error('Некоректна структура статистики');
            }
            
            const requiredFields = ['period_days', 'daily_stats', 'summary', 'total_operations'];
            for (const field of requiredFields) {
                if (!(field in stats.statistics)) {
                    throw new Error(`Відсутнє поле ${field} в статистиці`);
                }
            }
            
            this.log(`✅ getOperationsStats: ${stats.statistics.total_operations} операцій за 7 днів`, 'success');
            this.log(`✅ Категорій операцій: ${stats.statistics.summary.length}`, 'success');
            
        } catch (error) {
            this.log(`❌ getOperationsStats: ${error.message}`, 'error');
        }
    }

    async testGetEntityOperations() {
        try {
            this.log('🧪 Тестування getEntityOperations()...', 'info');
            
            const result = await operationsLogService.getEntityOperations('product', 999, 10);
            
            if (!result.success || !Array.isArray(result.operations)) {
                throw new Error('Некоректна структура операцій сутності');
            }
            
            const requiredFields = ['entity_type', 'entity_id', 'count'];
            for (const field of requiredFields) {
                if (!(field in result)) {
                    throw new Error(`Відсутнє поле ${field} в результаті`);
                }
            }
            
            this.log(`✅ getEntityOperations: знайдено ${result.operations.length} операцій для товару 999`, 'success');
            
        } catch (error) {
            this.log(`❌ getEntityOperations: ${error.message}`, 'error');
        }
    }

    async testOrderOperationLogging() {
        try {
            this.log('🧪 Тестування logOrderOperation()...', 'info');
            
            const order = {
                id: 999,
                order_number: 'ORD-999-TEST',
                client_name: 'Тестовий клієнт',
                total_quantity: 100,
                status: 'NEW'
            };
            
            const logId = await operationsLogService.logOrderOperation(
                operationsLogService.constructor.OPERATION_TYPES.CREATE_ORDER,
                order,
                'test-user'
            );
            
            if (!logId) {
                throw new Error('Не отримано ID логу замовлення');
            }
            
            this.testLogIds.push(logId);
            this.log(`✅ logOrderOperation: створено лог замовлення з ID ${logId}`, 'success');
            
        } catch (error) {
            this.log(`❌ logOrderOperation: ${error.message}`, 'error');
        }
    }

    async testProductOperationLogging() {
        try {
            this.log('🧪 Тестування logProductOperation()...', 'info');
            
            const product = {
                id: 999,
                name: 'Тестовий товар v2',
                code: 'TEST999',
                stock_pieces: 150
            };
            
            const oldProduct = {
                id: 999,
                name: 'Тестовий товар',
                code: 'TEST999',
                stock_pieces: 100
            };
            
            const logId = await operationsLogService.logProductOperation(
                operationsLogService.constructor.OPERATION_TYPES.UPDATE_STOCK,
                product,
                'test-user',
                oldProduct
            );
            
            if (!logId) {
                throw new Error('Не отримано ID логу товару');
            }
            
            this.testLogIds.push(logId);
            this.log(`✅ logProductOperation: створено лог товару з ID ${logId}`, 'success');
            
        } catch (error) {
            this.log(`❌ logProductOperation: ${error.message}`, 'error');
        }
    }

    async testValidation() {
        try {
            this.log('🧪 Тестування валідації...', 'info');
            
            // Тест з некоректними даними
            try {
                await operationsLogService.logOperation({
                    operation_type: '', // Порожній тип
                    entity_type: 'product',
                    description: 'Тест',
                    user_name: 'test-user'
                });
                throw new Error('Валідація не спрацювала для порожнього operation_type');
            } catch (error) {
                if (error.message.includes('Обов\'язкові поля')) {
                    this.log('✅ Валідація: некоректні дані відхилені', 'success');
                } else {
                    throw error;
                }
            }
            
            // Тест без опису
            try {
                await operationsLogService.logOperation({
                    operation_type: 'CREATE_PRODUCT',
                    entity_type: 'product',
                    entity_id: 999,
                    description: '', // Порожній опис
                    user_name: 'test-user'
                });
                throw new Error('Валідація не спрацювала для порожнього description');
            } catch (error) {
                if (error.message.includes('Обов\'язкові поля')) {
                    this.log('✅ Валідація: порожній опис відхилений', 'success');
                } else {
                    throw error;
                }
            }
            
        } catch (error) {
            this.log(`❌ Тестування валідації: ${error.message}`, 'error');
        }
    }

    generateTestReport() {
        this.log('\\n📋 ЗВІТ ТЕСТУВАННЯ OPERATIONSLOGSERVICE-V2', 'info');
        this.log('=' * 60, 'info');
        
        const successCount = this.testResults.filter(r => r.success).length;
        const totalCount = this.testResults.length;
        const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
        
        this.log(`📊 Результати: ${successCount}/${totalCount} тестів пройдено (${successRate}%)`, 'info');
        this.log(`🗃️ База даних: ${operationsLogService.useSupabase ? 'Supabase PostgreSQL' : 'SQLite'}`, 'info');
        
        if (this.testLogIds.length > 0) {
            this.log(`🧪 Створено тестових логів: ${this.testLogIds.length}`, 'info');
            this.log(`🆔 IDs логів: ${this.testLogIds.join(', ')}`, 'info');
        }
        
        // Детальні результати
        this.log('\\n📝 Детальні результати:', 'info');
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            this.log(`${index + 1}. ${status} ${result.message}`, 'info');
        });
        
        // Підсумок
        if (successRate >= 80) {
            this.log('\\n🎉 ТЕСТУВАННЯ ЗАВЕРШЕНО УСПІШНО!', 'success');
            this.log('OperationsLogService-v2 готовий до використання з обраною БД', 'info');
        } else if (successRate >= 60) {
            this.log('\\n⚠️ ТЕСТУВАННЯ ЗАВЕРШЕНО З ПОПЕРЕДЖЕННЯМИ', 'info');
            this.log('Основна функціональність працює, але є проблеми', 'info');
        } else {
            this.log('\\n❌ ТЕСТУВАННЯ ПРОВАЛЕНО!', 'error');
            this.log('Критичні помилки в OperationsLogService-v2, потребує виправлення', 'error');
        }
        
        this.log('\\n💡 Рекомендації:', 'info');
        this.log('1. Перевірте конфігурацію USE_SUPABASE в .env', 'info');
        this.log('2. Переконайтеся що таблиця operations_log існує в обраній БД', 'info');
        this.log('3. Якщо тести провалилися - перевірте connection та схему БД', 'info');
        this.log('4. Тестові логи можна видалити з БД після тестування', 'info');
        
        return {
            success_rate: successRate,
            total_tests: totalCount,
            successful_tests: successCount,
            database_type: operationsLogService.useSupabase ? 'Supabase' : 'SQLite',
            test_log_ids: this.testLogIds
        };
    }
}

// Запуск тестів
async function runOperationsLogServiceTests() {
    const tester = new OperationsLogServiceMigrationTest();
    const results = await tester.runAllTests();
    
    // Повертаємо результати для використання в CI/CD
    return results;
}

// Якщо файл запущено напряму
if (require.main === module) {
    runOperationsLogServiceTests()
        .then(results => {
            console.log('\\n🏁 Тестування завершено!');
            process.exit(results.success_rate >= 80 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Фатальна помилка тестування:', error);
            process.exit(1);
        });
}

module.exports = { runOperationsLogServiceTests, OperationsLogServiceMigrationTest };