#!/usr/bin/env node

/**
 * Тест міграції productService
 * Порівнює роботу SQLite та Supabase версій
 */

require('dotenv').config();
const productServiceV2 = require('./services/productService-v2');
const { switchDatabaseMode } = require('./config/database');

async function testProductServiceMigration() {
    console.log('🧪 Тестування міграції productService...\n');
    
    try {
        // Тест 1: SQLite режим
        console.log('1️⃣ Тест productService в SQLite режимі...');
        switchDatabaseMode(false);
        await testProductOperations('SQLite');
        
        // Тест 2: Supabase режим
        console.log('\n2️⃣ Тест productService в Supabase режимі...');
        switchDatabaseMode(true);
        await testProductOperations('Supabase');
        
        // Тест 3: Порівняння результатів
        console.log('\n3️⃣ Порівняння результатів...');
        await compareResults();
        
        console.log('\n🎉 Тестування міграції productService завершено успішно!');
        
    } catch (error) {
        console.error('❌ Помилка тестування міграції:', error);
        throw error;
    }
}

async function testProductOperations(modeName) {
    try {
        console.log(`   📊 ${modeName}: Тест getAllProducts...`);
        const allProducts = await productServiceV2.getAllProducts();
        console.log(`   ✅ ${modeName}: Отримано ${allProducts.length} продуктів`);
        
        if (allProducts.length > 0) {
            const firstProduct = allProducts[0];
            console.log(`      Перший продукт: ${firstProduct.name} (${firstProduct.code})`);
            
            // Тест getProductById
            console.log(`   🔍 ${modeName}: Тест getProductById...`);
            const productById = await productServiceV2.getProductById(firstProduct.id);
            console.log(`   ✅ ${modeName}: Отримано продукт: ${productById.name}`);
            
            // Тест getProductByCode
            console.log(`   🔎 ${modeName}: Тест getProductByCode...`);
            const productByCode = await productServiceV2.getProductByCode(firstProduct.code);
            console.log(`   ✅ ${modeName}: Знайдено продукт за кодом: ${productByCode ? productByCode.name : 'не знайдено'}`);
        }
        
        // Тест пошуку
        console.log(`   🔍 ${modeName}: Тест searchProducts...`);
        const searchResults = await productServiceV2.searchProducts('Піца');
        console.log(`   ✅ ${modeName}: Знайдено ${searchResults.length} продуктів за запитом "Піца"`);
        
        return {
            mode: modeName,
            totalProducts: allProducts.length,
            searchResults: searchResults.length,
            firstProduct: allProducts[0] || null
        };
        
    } catch (error) {
        console.error(`   ❌ ${modeName}: Помилка операцій - ${error.message}`);
        throw error;
    }
}

async function compareResults() {
    try {
        // Отримати результати з SQLite
        switchDatabaseMode(false);
        const sqliteProducts = await productServiceV2.getAllProducts();
        
        // Отримати результати з Supabase
        switchDatabaseMode(true);
        const supabaseProducts = await productServiceV2.getAllProducts();
        
        console.log(`   SQLite: ${sqliteProducts.length} продуктів`);
        console.log(`   Supabase: ${supabaseProducts.length} продуктів`);
        
        // Порівняти кількість
        if (sqliteProducts.length === supabaseProducts.length) {
            console.log('   ✅ Кількість продуктів однакова');
        } else {
            console.log('   ⚠️  Кількість продуктів відрізняється');
        }
        
        // Порівняти структуру перших записів
        if (sqliteProducts.length > 0 && supabaseProducts.length > 0) {
            const sqliteFirst = sqliteProducts[0];
            const supabaseFirst = supabaseProducts.find(p => p.code === sqliteFirst.code);
            
            if (supabaseFirst) {
                console.log('   ✅ Знайдено відповідний продукт в обох БД');
                console.log(`      SQLite: ${sqliteFirst.name} - ${sqliteFirst.stock_pieces} шт`);
                console.log(`      Supabase: ${supabaseFirst.name} - ${supabaseFirst.stock_pieces} шт`);
                
                // Порівняти ключові поля
                const fieldsToCompare = ['name', 'code', 'weight', 'pieces_per_box'];
                let fieldsMatch = true;
                
                for (const field of fieldsToCompare) {
                    if (sqliteFirst[field] !== supabaseFirst[field]) {
                        console.log(`      ⚠️  Поле ${field} відрізняється: "${sqliteFirst[field]}" vs "${supabaseFirst[field]}"`);
                        fieldsMatch = false;
                    }
                }
                
                if (fieldsMatch) {
                    console.log('   ✅ Ключові поля співпадають');
                }
            } else {
                console.log('   ⚠️  Не знайдено відповідний продукт в Supabase');
            }
        }
        
    } catch (error) {
        console.error('   ❌ Помилка порівняння результатів:', error.message);
        throw error;
    }
}

// Запуск тестів
if (require.main === module) {
    testProductServiceMigration()
        .then(() => {
            console.log('\n📋 Міграція productService протестована');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testProductServiceMigration };