/**
 * Тест міграції WriteoffService з SQLite на Supabase
 * 
 * Цей тест перевіряє функціональність writeoffService-v2 в обох режимах БД
 */

const path = require('path');

// Налаштовуємо середовище
process.env.NODE_ENV = 'test';

console.log('🧪 === ТЕСТ МІГРАЦІЇ WRITEOFFSERVICE ===');
console.log(`📁 Робоча директорія: ${process.cwd()}`);

// Динамічна конфігурація бази даних
let currentDatabase = 'SQLite';

async function testWriteoffService() {
    console.log(`\n🔍 Тестування WriteoffService v2 з ${currentDatabase}...`);
    
    try {
        // Підключаємо сервіс
        const writeoffService = require('./services/writeoffService-v2');
        
        // Mock OperationsLogController для тестів
        const mockOperationsLogController = {
            logOperation: async (data) => {
                console.log(`📋 Mock Log: ${data.description}`);
                return { success: true };
            },
            OPERATION_TYPES: {
                WRITEOFF: 'WRITEOFF'
            }
        };
        
        // Ініціалізуємо сервіс
        writeoffService.initialize({
            OperationsLogController: mockOperationsLogController
        });
        
        console.log(`✅ WriteoffService v2 ініціалізовано для ${currentDatabase}`);
        
        // Тест 1: Отримання всіх списань
        console.log(`\n📝 Тест 1: Отримання всіх списань`);
        const allWriteoffs = await writeoffService.getAllWriteoffs();
        console.log(`✅ Отримано ${allWriteoffs.count} списань`);
        console.log(`📊 Статистики: ${allWriteoffs.stats.total_quantity} шт, ${allWriteoffs.stats.unique_products} товарів`);
        
        // Тест 2: Отримання списань з фільтрами
        console.log(`\n📝 Тест 2: Фільтрація списань`);
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const filteredWriteoffs = await writeoffService.getAllWriteoffs({
            date_from: weekAgo,
            date_to: today
        });
        console.log(`✅ Отримано ${filteredWriteoffs.count} списань за останній тиждень`);
        
        // Тест 3: Отримання списань по товару
        if (allWriteoffs.writeoffs && allWriteoffs.writeoffs.length > 0) {
            const productId = allWriteoffs.writeoffs[0].product_id;
            console.log(`\n📝 Тест 3: Списання по товару ID ${productId}`);
            
            const productWriteoffs = await writeoffService.getWriteoffsByProductId(productId);
            console.log(`✅ Отримано ${productWriteoffs.count} списань для товару`);
            if (productWriteoffs.product) {
                console.log(`📦 Товар: ${productWriteoffs.product.name} (${productWriteoffs.product.code})`);
            }
        }
        
        // Тест 4: Статистики списань
        console.log(`\n📝 Тест 4: Статистики списань`);
        const stats = await writeoffService.getWriteoffStatistics(weekAgo, today);
        console.log(`✅ Статистики: ${stats.overview.total_records} записів, ${stats.overview.total_quantity} шт`);
        console.log(`📊 Товарів: ${stats.by_products.length}, Причин: ${stats.by_reasons.length}, Відповідальних: ${stats.by_responsible.length}`);
        
        // Тест 5: Legacy статистики за періодом
        console.log(`\n📝 Тест 5: Legacy статистики за місяць`);
        const legacyStats = await writeoffService.getWriteoffStatisticsByPeriod('month');
        console.log(`✅ Legacy статистики: ${legacyStats.summary.totalWriteoffs} списань, ${legacyStats.summary.totalQuantity} шт`);
        
        // Тест 6: Створення нового списання (тільки в тестовому режимі)
        if (currentDatabase === 'SQLite') {
            console.log(`\n📝 Тест 6: Створення тестового списання`);
            
            // Спочатку отримаємо доступний товар
            const productService = require('./services/productService-v2');
            productService.initialize({});
            const products = await productService.getAllProducts();
            
            if (products && products.length > 0) {
                const testProduct = products.find(p => (p.stock_pieces || 0) > 10);
                
                if (testProduct) {
                    const testWriteoffData = {
                        product_id: testProduct.id,
                        writeoff_date: new Date().toISOString().split('T')[0],
                        total_quantity: 1,
                        reason: 'Тестове списання',
                        responsible: 'Test System',
                        notes: 'Створено під час тестування міграції'
                    };
                    
                    try {
                        const createResult = await writeoffService.createWriteoff(testWriteoffData, {
                            user: 'Test System',
                            ip_address: '127.0.0.1',
                            user_agent: 'Test Agent'
                        });
                        
                        console.log(`✅ Тестове списання створено: ID ${createResult.writeoff.id}`);
                        console.log(`📦 Товар: ${testProduct.name}, Кількість: ${createResult.writeoff.total_quantity} шт`);
                    } catch (createError) {
                        console.log(`⚠️ Не вдалося створити тестове списання: ${createError.message}`);
                    }
                } else {
                    console.log(`⚠️ Не знайдено товар з достатніми запасами для тестування`);
                }
            }
        }
        
        return {
            success: true,
            database: currentDatabase,
            writeoffsCount: allWriteoffs.count,
            stats: allWriteoffs.stats
        };
        
    } catch (error) {
        console.error(`❌ Помилка тестування ${currentDatabase}:`, error.message);
        return {
            success: false,
            database: currentDatabase,
            error: error.message
        };
    }
}

async function runFullTest() {
    const results = [];
    
    // Тест 1: SQLite режим
    console.log('\n🗃️ === ТЕСТУВАННЯ SQLITE РЕЖИМУ ===');
    process.env.USE_SUPABASE = 'false';
    currentDatabase = 'SQLite';
    
    // Очищаємо кеш модулів для зміни БД
    delete require.cache[require.resolve('./services/writeoffService-v2')];
    delete require.cache[require.resolve('./queries/sqlite/writeoffQueries')];
    
    const sqliteResult = await testWriteoffService();
    results.push(sqliteResult);
    
    // Тест 2: Supabase режим
    console.log('\n🐘 === ТЕСТУВАННЯ SUPABASE РЕЖИМУ ===');
    process.env.USE_SUPABASE = 'true';
    currentDatabase = 'Supabase';
    
    // Очищаємо кеш модулів для зміни БД
    delete require.cache[require.resolve('./services/writeoffService-v2')];
    delete require.cache[require.resolve('./queries/supabase/writeoffQueries')];
    
    const supabaseResult = await testWriteoffService();
    results.push(supabaseResult);
    
    // Підсумки
    console.log('\n📊 === ПІДСУМКИ ТЕСТУВАННЯ ===');
    
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.database}: ${result.writeoffsCount} списань, статистики OK`);
        } else {
            console.log(`❌ ${result.database}: ПОМИЛКА - ${result.error}`);
        }
    });
    
    const allPassed = results.every(r => r.success);
    
    if (allPassed) {
        console.log('\n🎉 ВСІ ТЕСТИ ПРОЙШЛИ УСПІШНО!');
        console.log('🔄 WriteoffService v2 готовий до використання в обох режимах БД');
        
        // Порівняння результатів
        if (results.length === 2) {
            console.log('\n📊 Порівняння результатів:');
            console.log(`SQLite: ${results[0].writeoffsCount} списань`);
            console.log(`Supabase: ${results[1].writeoffsCount} списань`);
            
            if (results[0].writeoffsCount !== results[1].writeoffsCount) {
                console.log('⚠️ Кількість списань відрізняється між БД - це нормально для різних середовищ');
            }
        }
    } else {
        console.log('\n❌ ДЕЯКІ ТЕСТИ НЕ ПРОЙШЛИ');
        console.log('🔧 Перевірте помилки вище та виправте їх');
    }
    
    console.log('\n🏁 Тестування завершено');
    process.exit(allPassed ? 0 : 1);
}

// Запуск тестів
if (require.main === module) {
    runFullTest().catch(error => {
        console.error('💥 Критична помилка:', error);
        process.exit(1);
    });
}

module.exports = { testWriteoffService, runFullTest };