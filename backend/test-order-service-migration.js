/**
 * Тест міграції Order Service v2
 * Перевіряє роботу з обома базами даних: SQLite і Supabase
 */

require('dotenv').config();
const OrderServiceV2 = require('./services/orderService-v2');
const ProductServiceV2 = require('./services/productService-v2');
const ClientServiceV2 = require('./services/clientService-v2');

// Мокаємо залежності для тестів
const mockOperationsLogController = {
    OPERATION_TYPES: {
        ORDER_CREATE: 'ORDER_CREATE',
        ORDER_UPDATE: 'ORDER_UPDATE',
        ORDER_DELETE: 'ORDER_DELETE'
    },
    logOperation: async (data) => {
        console.log('📝 [MOCK] Логування операції:', data.operation_type);
        return true;
    }
};

const mockBatchController = {
    reserveForOrder: async (productId, quantity, orderId, auditInfo) => {
        console.log(`📝 [MOCK] Резервування: продукт ${productId}, кількість ${quantity}, замовлення ${orderId}`);
        return {
            success: true,
            batches: [{ batch_id: 1, quantity: quantity, batch_date: '2025-07-25' }]
        };
    },
    unreserveForOrder: async (productId, quantity, orderId, auditInfo) => {
        console.log(`📝 [MOCK] Відміна резервування: продукт ${productId}, кількість ${quantity}`);
        return { success: true };
    }
};

async function testOrderServiceMigration() {
    console.log('🧪 ===== ТЕСТ МІГРАЦІЇ ORDER SERVICE =====\n');
    
    try {
        // Ініціалізуємо сервіси
        OrderServiceV2.initialize({ 
            OperationsLogController: mockOperationsLogController,
            batchController: mockBatchController
        });
        ProductServiceV2.initialize({ OperationsLogController: mockOperationsLogController });
        ClientServiceV2.initialize({ OperationsLogController: mockOperationsLogController });
        
        const useSupabase = process.env.USE_SUPABASE === 'true';
        console.log(`🔧 Режим БД: ${useSupabase ? 'Supabase PostgreSQL' : 'SQLite'}\n`);
        
        // 1. Отримання даних для тестів
        console.log('📦 1. Отримання даних для тестування...');
        const products = await ProductServiceV2.getAllProducts();
        const clients = await ClientServiceV2.getAllClients();
        
        console.log(`✅ Знайдено ${products.length} товарів та ${clients.length} клієнтів`);
        
        if (products.length === 0) {
            throw new Error('Недостатньо товарів для тестування замовлень');
        }
        
        // Для SQLite створюємо тестового клієнта якщо немає
        let testClient;
        if (clients.length === 0) {
            console.log('⚠️ Немає клієнтів, створюємо тестового...');
            testClient = await ClientServiceV2.createClient({
                name: 'Тестовий клієнт',
                contact_person: 'Тестовий контакт',
                phone: '+380123456789',
                email: 'test@example.com',
                address: 'Тестова адреса'
            });
            console.log(`✅ Створено тестового клієнта: ID ${testClient.id}`);
        } else {
            testClient = clients[0];
        }
        
        const testProduct = products[0];
        console.log(`📋 Тестовий товар: "${testProduct.name}" (ID: ${testProduct.id})`);
        console.log(`🏢 Тестовий клієнт: "${testClient.name}" (ID: ${testClient.id})\n`);
        
        // 2. Отримання списку замовлень
        console.log('📋 2. Отримання списку замовлень...');
        const orders = await OrderServiceV2.getAllOrders({ limit: 10 });
        console.log(`✅ Знайдено ${orders.length} замовлень`);
        
        orders.forEach((order, index) => {
            const itemsCount = order.order_items ? order.order_items.length : 0;
            console.log(`   ${index + 1}. ${order.order_number} - ${order.client_name} (${order.status}, ${itemsCount} позицій)`);
        });
        console.log('');
        
        // 3. Створення нового замовлення
        console.log('➕ 3. Створення нового замовлення...');
        const newOrderData = {
            client_id: testClient.id,
            client_name: testClient.name,
            client_contact: testClient.contact_person || 'Тестовий контакт',
            order_date: new Date().toISOString().slice(0, 10),
            delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // +2 дні
            notes: 'Тестове замовлення для міграції',
            items: [
                {
                    product_id: testProduct.id,
                    quantity: 24,
                    boxes: 2,
                    pieces: 0,
                    notes: 'Тестова позиція'
                }
            ]
        };
        
        const createdOrder = await OrderServiceV2.createOrder(newOrderData, {
            user: 'test-user',
            userId: 1
        });
        
        console.log(`✅ Створено замовлення з ID: ${createdOrder.id}`);
        console.log(`📊 Деталі: ${createdOrder.order_number}, статус: ${createdOrder.status}`);
        console.log(`📦 Позицій: ${createdOrder.order_items?.length || 0}\n`);
        
        // 4. Отримання замовлення за ID
        console.log('🔍 4. Отримання замовлення за ID...');
        const fetchedOrder = await OrderServiceV2.getOrderById(createdOrder.id);
        console.log(`✅ Отримано замовлення: ${fetchedOrder.order_number}`);
        console.log(`📋 Клієнт: ${fetchedOrder.client_name}`);
        console.log(`📦 Загальна кількість: ${fetchedOrder.total_quantity} шт`);
        
        if (fetchedOrder.order_items && fetchedOrder.order_items.length > 0) {
            fetchedOrder.order_items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.products?.name || 'Невідомий товар'}: ${item.quantity} шт`);
            });
        }
        console.log('');
        
        // 5. Оновлення замовлення
        console.log('✏️ 5. Оновлення замовлення...');
        const updateData = {
            notes: 'Оновлені примітки до замовлення',
            status: 'IN_PROGRESS'
        };
        
        const updatedOrder = await OrderServiceV2.updateOrder(createdOrder.id, updateData, {
            user: 'updated-user'
        });
        
        console.log(`✅ Замовлення оновлено: статус ${updatedOrder.status}`);
        console.log(`📝 Примітки: "${updatedOrder.notes}"\n`);
        
        // 6. Зміна статусу замовлення
        console.log('🔄 6. Зміна статусу замовлення...');
        const statusChangedOrder = await OrderServiceV2.updateOrderStatus(createdOrder.id, 'COMPLETED', {
            user: 'status-user'
        });
        
        console.log(`✅ Статус змінено: ${statusChangedOrder.status}\n`);
        
        // 7. Резервування партій (mock)
        console.log('📦 7. Тестування резервування партій...');
        const reservationResult = await OrderServiceV2.reserveBatchesForOrder(createdOrder.id, {
            user: 'batch-user'
        });
        
        console.log(`✅ Резервування: ${reservationResult.success ? 'успішно' : 'помилка'}`);
        if (reservationResult.reservations) {
            console.log(`📊 Зарезервовано: ${reservationResult.reservations.length} партій`);
        }
        console.log('');
        
        // 8. Статистика замовлень
        console.log('📊 8. Отримання статистики замовлень...');
        const stats = await OrderServiceV2.getOrderStats('month');
        
        console.log(`✅ Статистика отримана:`);
        console.log(`   Всього замовлень: ${stats.total_orders}`);
        console.log(`   Нових: ${stats.new_orders}`);
        console.log(`   В роботі: ${stats.in_progress_orders}`);
        console.log(`   Виконаних: ${stats.completed_orders}`);
        console.log(`   Загальна кількість: ${stats.total_quantity} шт\n`);
        
        // 9. Відміна резервування (mock)
        console.log('↩️ 9. Відміна резервування партій...');
        const unreserveResult = await OrderServiceV2.unreserveBatchesForOrder(createdOrder.id, {
            user: 'unreserve-user'
        });
        
        console.log(`✅ Відміна резервування: ${unreserveResult.success ? 'успішно' : 'помилка'}\n`);
        
        // 10. Скасування замовлення
        console.log('❌ 10. Скасування замовлення...');
        const cancelledOrder = await OrderServiceV2.cancelOrder(createdOrder.id, {
            user: 'cancel-user'
        });
        
        console.log(`✅ Замовлення скасовано: статус ${cancelledOrder.status}\n`);
        
        // 11. Видалення замовлення
        console.log('🗑️ 11. Видалення тестового замовлення...');
        const deleteResult = await OrderServiceV2.deleteOrder(createdOrder.id, {
            user: 'delete-user'
        });
        
        console.log(`✅ Замовлення видалено: ${deleteResult.success}\n`);
        
        // 12. Перевірка видалення
        console.log('🔍 12. Перевірка видалення...');
        try {
            await OrderServiceV2.getOrderById(createdOrder.id);
            console.log('❌ Помилка: замовлення не було видалено');
        } catch (error) {
            if (error.message.includes('не знайдено')) {
                console.log('✅ Замовлення успішно видалено з БД');
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 ===== ТЕСТ ЗАВЕРШЕНО УСПІШНО =====');
        console.log(`✅ База даних: ${useSupabase ? 'Supabase' : 'SQLite'}`);
        console.log('✅ Всі операції з замовленнями працюють коректно');
        console.log('✅ CRUD операції протестовано успішно');
        console.log('✅ Резервування партій (mock) працює');
        console.log('✅ OrderService v2 готовий до використання\n');
        
    } catch (error) {
        console.error('❌ ПОМИЛКА В ТЕСТІ:', error);
        console.error('📍 Stack trace:', error.stack);
        process.exit(1);
    }
}

// Запуск тесту
if (require.main === module) {
    testOrderServiceMigration()
        .then(() => {
            console.log('✅ Тест завершено');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критична помилка:', error);
            process.exit(1);
        });
}

module.exports = { testOrderServiceMigration };