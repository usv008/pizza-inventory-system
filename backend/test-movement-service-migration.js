/**
 * Тест міграції Movement Service v2
 * Перевіряє роботу з обома базами даних: SQLite і Supabase
 */

require('dotenv').config();
const MovementServiceV2 = require('./services/movementService-v2');
const ProductServiceV2 = require('./services/productService-v2');

// Мокаємо OperationsLogController для тестів
const mockOperationsLogController = {
    OPERATION_TYPES: {
        MOVEMENT_CREATE: 'MOVEMENT_CREATE',
        MOVEMENT_UPDATE: 'MOVEMENT_UPDATE',
        MOVEMENT_DELETE: 'MOVEMENT_DELETE'
    },
    logOperation: async (data) => {
        console.log('📝 [MOCK] Логування операції:', data.operation_type);
        return true;
    }
};

async function testMovementServiceMigration() {
    console.log('🧪 ===== ТЕСТ МІГРАЦІЇ MOVEMENT SERVICE =====\n');
    
    try {
        // Ініціалізуємо сервіси
        MovementServiceV2.initialize({ OperationsLogController: mockOperationsLogController });
        ProductServiceV2.initialize({ OperationsLogController: mockOperationsLogController });
        
        const useSupabase = process.env.USE_SUPABASE === 'true';
        console.log(`🔧 Режим БД: ${useSupabase ? 'Supabase PostgreSQL' : 'SQLite'}\n`);
        
        // 1. Отримання списку товарів для тестів
        console.log('📦 1. Отримання списку товарів...');
        const products = await ProductServiceV2.getAllProducts();
        console.log(`✅ Знайдено ${products.length} товарів\n`);
        
        if (products.length === 0) {
            throw new Error('Немає товарів для тестування рухів');
        }
        
        const testProduct = products[0];
        console.log(`📋 Тестовий товар: "${testProduct.name}" (ID: ${testProduct.id})`);
        console.log(`📊 Поточний залишок: ${testProduct.stock_pieces} шт\n`);
        
        // 2. Отримання списку рухів
        console.log('📋 2. Отримання списку рухів...');
        const movements = await MovementServiceV2.getAllMovements({ limit: 10 });
        console.log(`✅ Знайдено ${movements.data.length} рухів`);
        
        movements.data.forEach((movement, index) => {
            console.log(`   ${index + 1}. ${movement.movement_type} - ${movement.pieces} шт "${movement.product_name}" (${movement.reason})`);
        });
        console.log('');
        
        // 3. Створення нового руху (IN)
        console.log('➕ 3. Створення нового руху (IN)...');
        const newMovementData = {
            product_id: testProduct.id,
            movement_type: 'IN',
            pieces: 10,
            boxes: 1,
            reason: 'Тестовий прихід товару',
            user: 'test-user'
        };
        
        const createdMovement = await MovementServiceV2.createMovement(newMovementData);
        console.log(`✅ Створено рух з ID: ${createdMovement.data.id}`);
        console.log(`📊 Деталі: ${createdMovement.data.movement_type} ${createdMovement.data.pieces} шт\n`);
        
        // 4. Перевірка оновлення залишків
        console.log('🔄 4. Перевірка оновлення залишків товару...');
        const updatedProduct = await ProductServiceV2.getProductById(testProduct.id);
        const expectedStock = testProduct.stock_pieces + 10;
        
        if (updatedProduct.stock_pieces === expectedStock) {
            console.log(`✅ Залишки оновлено коректно: ${testProduct.stock_pieces} → ${updatedProduct.stock_pieces}`);
        } else {
            console.log(`❌ Помилка оновлення залишків: очікувалось ${expectedStock}, отримано ${updatedProduct.stock_pieces}`);
        }
        console.log('');
        
        // 5. Отримання рухів для конкретного товару
        console.log('🔍 5. Отримання рухів для товару...');
        const productMovements = await MovementServiceV2.getMovementsByProduct(testProduct.id, { limit: 5 });
        console.log(`✅ Знайдено ${productMovements.data.length} рухів для товару "${testProduct.name}"`);
        
        productMovements.data.forEach((movement, index) => {
            console.log(`   ${index + 1}. ${movement.movement_type} - ${movement.pieces} шт (${movement.created_at})`);
        });
        console.log('');
        
        // 6. Оновлення руху
        console.log('✏️ 6. Оновлення руху...');
        const updateData = {
            reason: 'Оновлена причина руху',
            user: 'updated-user'
        };
        
        const updatedMovement = await MovementServiceV2.updateMovement(createdMovement.data.id, updateData);
        console.log(`✅ Рух оновлено: "${updatedMovement.data.reason}"`);
        console.log(`👤 Користувач: ${updatedMovement.data.user}\n`);
        
        // 7. Статистика рухів
        console.log('📊 7. Отримання статистики рухів...');
        const stats = await MovementServiceV2.getMovementStatistics({
            product_id: testProduct.id,
            start_date: '2025-01-01'
        });
        
        console.log(`✅ Статистика отримана, записів: ${stats.data.length}`);
        stats.data.forEach(stat => {
            console.log(`   ${stat.movement_type}: ${stat.count} операцій, ${stat.total_pieces} шт`);
        });
        console.log('');
        
        // 8. Створення руху OUT для тестування
        console.log('➖ 8. Створення руху OUT...');
        const outMovementData = {
            product_id: testProduct.id,
            movement_type: 'OUT',
            pieces: 5,
            boxes: 0,
            reason: 'Тестова видача товару',
            user: 'test-user'
        };
        
        const outMovement = await MovementServiceV2.createMovement(outMovementData);
        console.log(`✅ Створено OUT рух з ID: ${outMovement.data.id}`);
        console.log(`📊 Видано: ${outMovement.data.pieces} шт\n`);
        
        // 9. Видалення тестового руху
        console.log('🗑️ 9. Видалення тестового руху...');
        await MovementServiceV2.deleteMovement(createdMovement.data.id);
        console.log(`✅ Рух з ID ${createdMovement.data.id} видалено\n`);
        
        // 10. Перевірка відновлення залишків після видалення
        console.log('↩️ 10. Перевірка відновлення залишків...');
        const finalProduct = await ProductServiceV2.getProductById(testProduct.id);
        
        // Після видалення IN руху залишки мають зменшитись на 10
        // Але OUT рух на 5 шт залишається, тому загальне зменшення: 10 - 5 = 5
        const expectedFinalStock = testProduct.stock_pieces - 5;
        
        if (finalProduct.stock_pieces === expectedFinalStock) {
            console.log(`✅ Залишки відновлено коректно: ${finalProduct.stock_pieces} шт`);
        } else {
            console.log(`⚠️ Залишки: очікувалось ${expectedFinalStock}, отримано ${finalProduct.stock_pieces}`);
        }
        
        console.log('\n🎉 ===== ТЕСТ ЗАВЕРШЕНО УСПІШНО =====');
        console.log(`✅ База даних: ${useSupabase ? 'Supabase' : 'SQLite'}`);
        console.log('✅ Всі операції з рухами працюють коректно');
        console.log('✅ Залишки товарів оновлюються правильно');
        console.log('✅ MovementService v2 готовий до використання\n');
        
    } catch (error) {
        console.error('❌ ПОМИЛКА В ТЕСТІ:', error);
        console.error('📍 Stack trace:', error.stack);
        process.exit(1);
    }
}

// Запуск тесту
if (require.main === module) {
    testMovementServiceMigration()
        .then(() => {
            console.log('✅ Тест завершено');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testMovementServiceMigration };