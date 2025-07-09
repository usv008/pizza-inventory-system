require('dotenv').config();
const MovementService = require('./services/movementService');

// Mock dependencies 
const mockDependencies = {
    OperationsLogController: {
        logOperation: async (data) => {
            console.log('📝 Mock OperationsLog:', data.operation);
            return { success: true };
        }
    }
};

async function testMovementService() {
    console.log('🔧 Testing migrated MovementService...\n');
    
    try {
        // Initialize service
        MovementService.initialize(mockDependencies);
        
        // Test 1: Read existing movements
        console.log('📖 Test 1: Reading existing movements...');
        const movements = await MovementService.getAllMovements({ limit: 5 });
        console.log('✅ Read result:', movements.success ? 'SUCCESS' : 'FAILED');
        console.log('📊 Found movements:', movements.data?.length || 0);
        if (movements.data?.length > 0) {
            console.log('�� Sample movement:', movements.data[0]);
        }
        
        // Test 2: Create new movement
        console.log('\n📝 Test 2: Creating new movement...');
        const newMovement = {
            product_id: 1,
            movement_type: 'IN',
            quantity: 20,
            pieces: 100,
            boxes: 10,
            reason: 'MovementService migration test',
            user: 'test_user'
        };
        
        const createResult = await MovementService.createMovement(newMovement, {
            user_id: 1,
            ip_address: '127.0.0.1'
        });
        
        console.log('✅ Create result:', createResult.success ? 'SUCCESS' : 'FAILED');
        if (createResult.success) {
            console.log('📋 Created movement ID:', createResult.data.id);
            
            // Test 3: Read movements again to verify creation
            console.log('\n📖 Test 3: Verifying creation...');
            const updatedMovements = await MovementService.getAllMovements({ limit: 3 });
            console.log('📊 Total movements now:', updatedMovements.data?.length || 0);
        }
        
        // Test 4: Get statistics
        console.log('\n📊 Test 4: Getting movement statistics...');
        const stats = await MovementService.getMovementStatistics();
        console.log('✅ Stats result:', stats.success ? 'SUCCESS' : 'FAILED');
        if (stats.success) {
            console.log('📋 Statistics:', stats.data);
        }
        
        console.log('\n🎯 MovementService migration test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Stack:', error.stack);
    }
}

testMovementService().catch(console.error);
