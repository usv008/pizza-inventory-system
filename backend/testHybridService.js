/**
 * Test Script for Hybrid Product Service
 * Тестування hybrid сервісу і migration фаз
 */

const hybridProductService = require('./services/hybridProductService');
const legacyProductService = require('./services/productService');
const supabaseProductService = require('./services/supabaseProductService');

async function runHybridTests() {
    console.log('🧪 Запуск тестів Hybrid Product Service...');
    
    try {
        // Initialize services
        hybridProductService.initialize({
            legacyProductService,
            supabaseProductService
        });
        
        // Test connectivity
        console.log('\n1. Testing connectivity...');
        const connectivity = await hybridProductService.testConnectivity();
        console.log('Connectivity results:', connectivity);
        
        // Test migration status
        console.log('\n2. Migration status...');
        const status = hybridProductService.getMigrationStatus();
        console.log('Migration status:', status);
        
        // Test basic operations
        console.log('\n3. Testing getAllProducts...');
        const products = await hybridProductService.getAllProducts();
        console.log(`Found ${products.length} products`);
        
        if (products.length > 0) {
            console.log('\n4. Testing getProductById...');
            const product = await hybridProductService.getProductById(products[0].id);
            console.log('Product details:', product?.name);
        }
        
        console.log('\n✅ Всі тести пройшли успішно!');
        
    } catch (error) {
        console.error('❌ Помилка в тестах:', error);
    }
}

// Run tests if called directly
if (require.main === module) {
    runHybridTests();
}

module.exports = { runHybridTests };
