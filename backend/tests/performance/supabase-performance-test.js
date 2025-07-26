const { performance } = require('perf_hooks');
require('dotenv').config();

// Import all v2 services for testing
const productService = require('../../services/productService-v2');
const clientService = require('../../services/clientService-v2');
const orderService = require('../../services/orderService-v2');
const movementService = require('../../services/movementService-v2');
const productionService = require('../../services/productionService-v2');
const writeoffService = require('../../services/writeoffService-v2');
const authService = require('../../services/authService-v2');

/**
 * Performance testing suite for Supabase migration
 * Tests response times and throughput after SQLite → Supabase migration
 */
class SupabasePerformanceTester {
    constructor() {
        this.results = {};
        this.thresholds = {
            read: 500,    // 500ms for read operations
            write: 1000,  // 1000ms for write operations
            bulk: 2000    // 2000ms for bulk operations
        };
        this.totalOperations = 0;
        this.successfulOperations = 0;
    }
    
    /**
     * Initialize services for testing
     */
    async initialize() {
        console.log('🔧 Initializing services for performance testing...\n');
        
        try {
            // Mock operations log to avoid circular dependencies
            const mockOperationsLog = {
                logProductOperation: async () => {},
                logClientOperation: async () => {},
                logOrderOperation: async () => {},
                logMovementOperation: async () => {},
                logProductionOperation: async () => {},
                logWriteoffOperation: async () => {}
            };
            
            // Initialize all v2 services
            productService.initialize({ OperationsLogController: mockOperationsLog });
            clientService.initialize({ OperationsLogController: mockOperationsLog });
            orderService.initialize({ OperationsLogController: mockOperationsLog });
            movementService.initialize({ OperationsLogController: mockOperationsLog });
            productionService.initialize({ OperationsLogController: mockOperationsLog });
            writeoffService.initialize({ OperationsLogController: mockOperationsLog });
            authService.initialize({});
            
            console.log('✅ All services initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Measure execution time of an async function
     */
    async measureTime(name, fn) {
        this.totalOperations++;
        const start = performance.now();
        
        try {
            const result = await fn();
            const end = performance.now();
            const duration = Math.round(end - start);
            
            this.results[name] = {
                duration,
                success: true,
                result: Array.isArray(result) ? `${result.length} items` : 'success'
            };
            
            this.successfulOperations++;
            
            const threshold = this.getThreshold(name);
            const status = duration <= threshold ? '🚀' : '⚠️';
            console.log(`${status} ${name}: ${duration}ms`);
            
            return { success: true, duration, result };
        } catch (error) {
            const end = performance.now();
            const duration = Math.round(end - start);
            
            this.results[name] = {
                duration,
                success: false,
                error: error.message
            };
            
            console.log(`❌ ${name}: FAILED (${duration}ms) - ${error.message}`);
            return { success: false, duration, error };
        }
    }
    
    /**
     * Test product service performance
     */
    async testProductService() {
        console.log('📦 Testing Product Service Performance...');
        
        await this.measureTime('products_getAll', async () => {
            return await productService.getAllProducts();
        });
        
        await this.measureTime('products_getById', async () => {
            const products = await productService.getAllProducts();
            if (products.length > 0) {
                return await productService.getProductById(products[0].id);
            }
            return { message: 'No products found' };
        });
        
        await this.measureTime('products_search', async () => {
            return await productService.searchProducts('піца');
        });
        
        // Test concurrent reads
        await this.measureTime('products_concurrent_reads', async () => {
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(productService.getAllProducts());
            }
            return await Promise.all(promises);
        });
        
        console.log('');
    }
    
    /**
     * Test client service performance
     */
    async testClientService() {
        console.log('👥 Testing Client Service Performance...');
        
        await this.measureTime('clients_getAll', async () => {
            return await clientService.getAllClients();
        });
        
        await this.measureTime('clients_search', async () => {
            return await clientService.searchClients('test');
        });
        
        await this.measureTime('clients_getActive', async () => {
            return await clientService.getActiveClients();
        });
        
        console.log('');
    }
    
    /**
     * Test order service performance
     */
    async testOrderService() {
        console.log('📋 Testing Order Service Performance...');
        
        await this.measureTime('orders_getAll', async () => {
            return await orderService.getAllOrders();
        });
        
        await this.measureTime('orders_getRecent', async () => {
            return await orderService.getRecentOrders(10);
        });
        
        await this.measureTime('orders_statistics', async () => {
            return await orderService.getOrderStatistics();
        });
        
        await this.measureTime('orders_byStatus', async () => {
            return await orderService.getOrdersByStatus('pending');
        });
        
        console.log('');
    }
    
    /**
     * Test movement service performance
     */
    async testMovementService() {
        console.log('📊 Testing Movement Service Performance...');
        
        await this.measureTime('movements_getAll', async () => {
            return await movementService.getAllMovements();
        });
        
        await this.measureTime('movements_getRecent', async () => {
            return await movementService.getRecentMovements(20);
        });
        
        await this.measureTime('movements_statistics', async () => {
            return await movementService.getMovementStatistics();
        });
        
        await this.measureTime('movements_byType', async () => {
            return await movementService.getMovementsByType('production');
        });
        
        console.log('');
    }
    
    /**
     * Test production service performance
     */
    async testProductionService() {
        console.log('🏭 Testing Production Service Performance...');
        
        await this.measureTime('production_getAll', async () => {
            return await productionService.getAllProduction();
        });
        
        await this.measureTime('production_statistics', async () => {
            return await productionService.getProductionStatistics();
        });
        
        await this.measureTime('production_getRecent', async () => {
            return await productionService.getRecentProduction(10);
        });
        
        console.log('');
    }
    
    /**
     * Test writeoff service performance
     */
    async testWriteoffService() {
        console.log('🗑️ Testing Writeoff Service Performance...');
        
        await this.measureTime('writeoffs_getAll', async () => {
            return await writeoffService.getAllWriteoffs();
        });
        
        await this.measureTime('writeoffs_statistics', async () => {
            return await writeoffService.getWriteoffStatistics();
        });
        
        await this.measureTime('writeoffs_getRecent', async () => {
            return await writeoffService.getRecentWriteoffs(10);
        });
        
        console.log('');
    }
    
    /**
     * Test auth service performance
     */
    async testAuthService() {
        console.log('🔐 Testing Auth Service Performance...');
        
        await this.measureTime('users_getAll', async () => {
            return await authService.getAllUsers();
        });
        
        await this.measureTime('users_getActive', async () => {
            return await authService.getActiveUsers();
        });
        
        await this.measureTime('users_getRoles', async () => {
            return await authService.getUserRoles();
        });
        
        console.log('');
    }
    
    /**
     * Test concurrent operations across services
     */
    async testConcurrentOperations() {
        console.log('🔄 Testing Concurrent Operations...');
        
        await this.measureTime('concurrent_mixed_operations', async () => {
            const promises = [
                productService.getAllProducts(),
                clientService.getAllClients(),
                orderService.getAllOrders(),
                movementService.getRecentMovements(10),
                authService.getAllUsers()
            ];
            
            return await Promise.all(promises);
        });
        
        await this.measureTime('concurrent_statistics', async () => {
            const promises = [
                orderService.getOrderStatistics(),
                movementService.getMovementStatistics(),
                productionService.getProductionStatistics(),
                writeoffService.getWriteoffStatistics()
            ];
            
            return await Promise.all(promises);
        });
        
        console.log('');
    }
    
    /**
     * Test system stress with rapid operations
     */
    async testStressOperations() {
        console.log('💪 Testing Stress Operations...');
        
        await this.measureTime('stress_rapid_product_queries', async () => {
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(productService.getAllProducts());
            }
            return await Promise.all(promises);
        });
        
        await this.measureTime('stress_mixed_rapid_queries', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    productService.getAllProducts(),
                    clientService.getAllClients(),
                    orderService.getAllOrders()
                );
            }
            return await Promise.all(promises);
        });
        
        console.log('');
    }
    
    /**
     * Run all performance tests
     */
    async runAllTests() {
        console.log('🚀 Starting Supabase Performance Tests...\n');
        console.log('🎯 Performance Thresholds:');
        console.log(`   Read operations: ${this.thresholds.read}ms`);
        console.log(`   Write operations: ${this.thresholds.write}ms`);
        console.log(`   Bulk operations: ${this.thresholds.bulk}ms\n`);
        
        const initSuccess = await this.initialize();
        if (!initSuccess) {
            console.error('❌ Cannot run tests - initialization failed');
            return false;
        }
        
        const testStart = performance.now();
        
        // Run all test suites
        await this.testProductService();
        await this.testClientService();
        await this.testOrderService();
        await this.testMovementService();
        await this.testProductionService();
        await this.testWriteoffService();
        await this.testAuthService();
        await this.testConcurrentOperations();
        await this.testStressOperations();
        
        const testEnd = performance.now();
        const totalTestTime = Math.round(testEnd - testStart);
        
        this.generateReport(totalTestTime);
        return this.successfulOperations === this.totalOperations;
    }
    
    /**
     * Generate comprehensive performance report
     */
    generateReport(totalTestTime) {
        console.log('\n📊 SUPABASE PERFORMANCE REPORT');
        console.log('=' * 60);
        
        // Categorize results
        const categories = {
            'Read Operations': [],
            'Statistics Operations': [],
            'Concurrent Operations': [],
            'Stress Operations': []
        };
        
        Object.entries(this.results).forEach(([name, result]) => {
            if (name.includes('statistics')) {
                categories['Statistics Operations'].push({ name, ...result });
            } else if (name.includes('concurrent') || name.includes('stress')) {
                if (name.includes('stress')) {
                    categories['Stress Operations'].push({ name, ...result });
                } else {
                    categories['Concurrent Operations'].push({ name, ...result });
                }
            } else {
                categories['Read Operations'].push({ name, ...result });
            }
        });
        
        // Print categorized results
        Object.entries(categories).forEach(([category, tests]) => {
            if (tests.length === 0) return;
            
            console.log(`\n📋 ${category}:`);
            console.log('-'.repeat(50));
            
            tests.forEach(test => {
                const status = test.success ? '✅' : '❌';
                const threshold = this.getThreshold(test.name);
                const performance = test.success && test.duration <= threshold ? '🚀' : '⚠️';
                
                console.log(`${status} ${performance} ${test.name}`);
                console.log(`   Duration: ${test.duration}ms (threshold: ${threshold}ms)`);
                
                if (!test.success) {
                    console.log(`   Error: ${test.error}`);
                } else if (test.result) {
                    console.log(`   Result: ${test.result}`);
                }
                console.log('');
            });
        });
        
        // Overall statistics
        const averageTime = Math.round(
            Object.values(this.results)
                .filter(r => r.success)
                .reduce((sum, r) => sum + r.duration, 0) / this.successfulOperations
        );
        
        const fastOperations = Object.values(this.results).filter(r => 
            r.success && r.duration <= this.getThreshold('')
        ).length;
        
        const slowOperations = Object.entries(this.results).filter(([name, result]) => 
            result.success && result.duration > this.getThreshold(name)
        );
        
        console.log('\n📈 OVERALL STATISTICS:');
        console.log('-'.repeat(50));
        console.log(`Total Tests: ${this.totalOperations}`);
        console.log(`Successful: ${this.successfulOperations} (${Math.round(this.successfulOperations/this.totalOperations*100)}%)`);
        console.log(`Fast Operations: ${fastOperations} (${Math.round(fastOperations/this.successfulOperations*100)}%)`);
        console.log(`Average Response Time: ${averageTime}ms`);
        console.log(`Total Test Duration: ${totalTestTime}ms`);
        
        // Performance grade
        const performanceScore = Math.round((fastOperations / this.successfulOperations) * 100);
        let grade, recommendation;
        
        if (performanceScore >= 90) {
            grade = '🏆 A+ (Excellent)';
            recommendation = 'Performance is excellent! System ready for production.';
        } else if (performanceScore >= 80) {
            grade = '🥇 A (Good)';
            recommendation = 'Good performance. Monitor slow operations.';
        } else if (performanceScore >= 70) {
            grade = '🥈 B (Acceptable)';
            recommendation = 'Acceptable performance. Consider optimization.';
        } else if (performanceScore >= 60) {
            grade = '🥉 C (Needs Improvement)';
            recommendation = 'Performance needs improvement. Optimize slow operations.';
        } else {
            grade = '❌ D (Poor)';
            recommendation = 'Poor performance. Immediate optimization required.';
        }
        
        console.log(`Performance Grade: ${grade} (${performanceScore}%)`);
        
        // Detailed recommendations
        console.log('\n💡 PERFORMANCE ANALYSIS:');
        console.log('-'.repeat(50));
        console.log(recommendation);
        
        if (slowOperations.length > 0) {
            console.log('\n⚠️ Operations exceeding thresholds:');
            slowOperations.forEach(([name, result]) => {
                const threshold = this.getThreshold(name);
                const excess = result.duration - threshold;
                console.log(`   • ${name}: ${result.duration}ms (+${excess}ms over ${threshold}ms)`);
            });
            
            console.log('\n🔧 Optimization recommendations:');
            console.log('   • Review database indexes for slow queries');
            console.log('   • Implement query result caching for frequently accessed data');
            console.log('   • Consider database connection pooling');
            console.log('   • Add pagination for large datasets');
            console.log('   • Monitor Supabase dashboard for query performance');
        } else {
            console.log('\n✅ All operations meet performance thresholds!');
            console.log('   • System is well optimized for current load');
            console.log('   • Ready for production deployment');
            console.log('   • Consider load testing with higher concurrency');
        }
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('-'.repeat(50));
        if (performanceScore >= 80) {
            console.log('✅ Performance testing completed successfully');
            console.log('✅ System ready for production use');
            console.log('📊 Consider setting up monitoring for production metrics');
        } else {
            console.log('⚠️ Address slow operations before production deployment');
            console.log('🔧 Run optimization and re-test');
            console.log('📊 Set up performance monitoring');
        }
        
        console.log('\n✅ Supabase migration performance testing completed!');
    }
    
    /**
     * Get performance threshold for operation type
     */
    getThreshold(operationName) {
        if (operationName.includes('stress') || operationName.includes('concurrent')) {
            return this.thresholds.bulk;
        } else if (operationName.includes('create') || operationName.includes('update') || operationName.includes('delete')) {
            return this.thresholds.write;
        } else {
            return this.thresholds.read;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SupabasePerformanceTester();
    tester.runAllTests().then(success => {
        console.log(`\nTest suite ${success ? 'PASSED' : 'FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { SupabasePerformanceTester };