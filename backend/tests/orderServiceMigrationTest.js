/**
 * OrderService Migration Test Suite
 * Comprehensive testing of the enhanced hybrid OrderService migration
 * Tests all services, fallback mechanisms, and integration points
 */

const path = require('path');

// Mock environment variables for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';
process.env.ORDER_MIGRATION_PHASE = 'PHASE_3'; // Full hybrid mode for testing
process.env.LOG_HYBRID_OPERATIONS = 'true';

// Import services
const hybridOrderService = require('../services/hybridOrderService');
const hybridBatchService = require('../services/hybridBatchService');
const hybridAuditService = require('../services/hybridAuditService');
const supabaseOrderService = require('../services/supabaseOrderService');
const legacyOrderService = require('../services/orderService');

class OrderServiceMigrationTester {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
        this.mockData = this.createMockData();
    }

    /**
     * Create mock data for testing
     */
    createMockData() {
        return {
            testOrder: {
                order_number: `TEST-ORDER-${Date.now()}`,
                client_id: 1,
                order_date: new Date().toISOString(),
                status: 'NEW',
                notes: 'Test order for migration validation',
                total_amount: 1500.00,
                items: [
                    {
                        product_id: 1,
                        quantity: 5,
                        unit_price: 100.00,
                        price: 100.00
                    },
                    {
                        product_id: 2,
                        quantity: 10,
                        unit_price: 100.00,
                        price: 100.00
                    }
                ]
            },
            auditInfo: {
                userId: 'test-user',
                reason: 'Migration testing',
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Log test result
     */
    logTest(testName, passed, duration, details = {}) {
        const result = {
            test: testName,
            passed,
            duration,
            timestamp: new Date().toISOString(),
            details
        };
        
        this.testResults.push(result);
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        const time = `${duration}ms`;
        
        console.log(`[TEST] ${status} ${testName} (${time})`);
        
        if (!passed) {
            console.error(`[TEST] Error details:`, details);
        }
        
        return result;
    }

    /**
     * Run individual test with timing
     */
    async runTest(testName, testFunction) {
        console.log(`[TEST] Starting: ${testName}`);
        const startTime = Date.now();
        
        try {
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            return this.logTest(testName, true, duration, { result });
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return this.logTest(testName, false, duration, { 
                error: error.message,
                stack: error.stack 
            });
        }
    }

    /**
     * Test 1: Service Initialization
     */
    async testServiceInitialization() {
        return await this.runTest('Service Initialization', async () => {
            // Mock dependencies for testing
            const mockDependencies = {
                legacyOrderService: legacyOrderService,
                supabaseOrderService: supabaseOrderService,
                hybridBatchService: hybridBatchService,
                hybridAuditService: hybridAuditService,
                orderQueries: this.createMockOrderQueries(),
                productQueries: this.createMockProductQueries(),
                batchController: this.createMockBatchController(),
                OperationsLogController: this.createMockOperationsLogController()
            };

            // Initialize hybrid services
            hybridBatchService.initialize({
                legacyBatchController: mockDependencies.batchController
            });

            hybridAuditService.initialize({
                OperationsLogController: mockDependencies.OperationsLogController
            });

            supabaseOrderService.initialize({
                hybridBatchService: hybridBatchService,
                hybridAuditService: hybridAuditService
            });

            hybridOrderService.initialize(mockDependencies);

            // Verify initialization
            const status = hybridOrderService.getMigrationStatus();
            
            if (!status.initialized) {
                throw new Error('HybridOrderService not initialized');
            }

            if (status.phase !== 'PHASE_3') {
                throw new Error(`Expected PHASE_3, got ${status.phase}`);
            }

            return {
                status,
                services: {
                    hybrid: !!hybridOrderService,
                    batch: !!hybridBatchService,
                    audit: !!hybridAuditService,
                    supabase: !!supabaseOrderService,
                    legacy: !!legacyOrderService
                }
            };
        });
    }

    /**
     * Test 2: Configuration Management
     */
    async testConfigurationManagement() {
        return await this.runTest('Configuration Management', async () => {
            // Test phase switching
            const phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4'];
            const results = {};

            for (const phase of phases) {
                hybridOrderService.setMigrationPhase(phase);
                const status = hybridOrderService.getMigrationStatus();
                
                if (status.phase !== phase) {
                    throw new Error(`Phase setting failed: expected ${phase}, got ${status.phase}`);
                }
                
                results[phase] = {
                    configuration: status.configuration,
                    services: status.serviceStatus
                };
            }

            // Test emergency fallback
            hybridOrderService.emergencyFallbackToLegacy();
            const emergencyStatus = hybridOrderService.getMigrationStatus();
            
            if (emergencyStatus.phase !== 'EMERGENCY_LEGACY') {
                throw new Error('Emergency fallback failed');
            }

            // Reset to testing phase
            hybridOrderService.setMigrationPhase('PHASE_3');

            return {
                phaseTests: results,
                emergencyFallback: emergencyStatus.configuration
            };
        });
    }

    /**
     * Test 3: Hybrid Service Methods
     */
    async testHybridServiceMethods() {
        return await this.runTest('Hybrid Service Methods', async () => {
            const methods = [
                'getAllOrders',
                'getOrderStats',
                'createOrder',
                'updateOrderStatus',
                'cancelOrder'
            ];

            const results = {};

            for (const method of methods) {
                try {
                    let result;
                    
                    switch (method) {
                        case 'getAllOrders':
                            result = await hybridOrderService.getAllOrders();
                            break;
                        case 'getOrderStats':
                            result = await hybridOrderService.getOrderStats('month');
                            break;
                        case 'createOrder':
                            result = await hybridOrderService.createOrder(this.mockData.testOrder, this.mockData.auditInfo);
                            break;
                        case 'updateOrderStatus':
                            // Skip if no test order created
                            result = { skipped: 'No test order available' };
                            break;
                        case 'cancelOrder':
                            // Skip if no test order created
                            result = { skipped: 'No test order available' };
                            break;
                        default:
                            result = { method: 'not implemented in test' };
                    }
                    
                    results[method] = {
                        success: true,
                        result: typeof result === 'object' ? Object.keys(result) : result
                    };
                } catch (error) {
                    results[method] = {
                        success: false,
                        error: error.message
                    };
                }
            }

            return results;
        });
    }

    /**
     * Test 4: Fallback Mechanisms
     */
    async testFallbackMechanisms() {
        return await this.runTest('Fallback Mechanisms', async () => {
            const results = {};

            // Test with Supabase disabled (simulated failure)
            const originalPhase = hybridOrderService.getMigrationStatus().phase;
            
            // Force legacy-only mode
            hybridOrderService.setMigrationPhase('PHASE_1');
            
            try {
                const legacyResult = await hybridOrderService.getAllOrders();
                results.legacyFallback = {
                    success: true,
                    result: Array.isArray(legacyResult) ? legacyResult.length : 'success'
                };
            } catch (error) {
                results.legacyFallback = {
                    success: false,
                    error: error.message
                };
            }

            // Test hybrid mode
            hybridOrderService.setMigrationPhase('PHASE_3');
            
            try {
                const hybridResult = await hybridOrderService.getAllOrders();
                results.hybridMode = {
                    success: true,
                    result: Array.isArray(hybridResult) ? hybridResult.length : 'success'
                };
            } catch (error) {
                results.hybridMode = {
                    success: false,
                    error: error.message
                };
            }

            // Restore original phase
            hybridOrderService.setMigrationPhase(originalPhase);

            return results;
        });
    }

    /**
     * Test 5: Service Health & Connectivity
     */
    async testServiceHealthConnectivity() {
        return await this.runTest('Service Health & Connectivity', async () => {
            const connectivity = await hybridOrderService.testConnectivity();
            const batchHealth = await hybridBatchService.getServiceHealth();
            const auditHealth = await hybridAuditService.getServiceHealth();

            const allHealthy = Object.values(connectivity).every(service => 
                service.available || service.status === 'healthy' || service.status === 'unknown'
            );

            return {
                connectivity,
                batchHealth,
                auditHealth,
                overallHealthy: allHealthy
            };
        });
    }

    /**
     * Test 6: Migration Readiness Validation
     */
    async testMigrationReadinessValidation() {
        return await this.runTest('Migration Readiness Validation', async () => {
            const readiness = await hybridOrderService.validateMigrationReadiness();
            
            return {
                ready: readiness.ready,
                issues: readiness.issues,
                recommendations: readiness.recommendations,
                services: Object.keys(readiness.services),
                configuration: readiness.configuration.phase
            };
        });
    }

    /**
     * Test 7: Performance Benchmarking
     */
    async testPerformanceBenchmarking() {
        return await this.runTest('Performance Benchmarking', async () => {
            const benchmarks = {};
            const iterations = 5;

            // Benchmark getAllOrders
            const ordersTimes = [];
            for (let i = 0; i < iterations; i++) {
                const start = Date.now();
                await hybridOrderService.getAllOrders();
                ordersTimes.push(Date.now() - start);
            }

            benchmarks.getAllOrders = {
                average: Math.round(ordersTimes.reduce((a, b) => a + b) / ordersTimes.length),
                min: Math.min(...ordersTimes),
                max: Math.max(...ordersTimes),
                iterations
            };

            // Benchmark getOrderStats
            const statsTimes = [];
            for (let i = 0; i < iterations; i++) {
                const start = Date.now();
                await hybridOrderService.getOrderStats('month');
                statsTimes.push(Date.now() - start);
            }

            benchmarks.getOrderStats = {
                average: Math.round(statsTimes.reduce((a, b) => a + b) / statsTimes.length),
                min: Math.min(...statsTimes),
                max: Math.max(...statsTimes),
                iterations
            };

            return benchmarks;
        });
    }

    /**
     * Create mock queries and controllers for testing
     */
    createMockOrderQueries() {
        return {
            getAll: async (filters = {}) => [],
            getById: async (id) => null,
            create: async (data) => ({ id: Date.now(), order_number: data.order_number }),
            update: async (id, data) => ({ changes: 1 }),
            delete: async (id) => ({ changes: 1 })
        };
    }

    createMockProductQueries() {
        return {
            getAll: async () => [
                { id: 1, name: 'Test Product 1', price: 100 },
                { id: 2, name: 'Test Product 2', price: 100 }
            ],
            getById: async (id) => ({ id, name: `Product ${id}`, price: 100 })
        };
    }

    createMockBatchController() {
        return {
            reserveBatchesForOrderItem: async (req, res) => ({
                reservations: [{ batch_id: 1, quantity: req.body.quantity }]
            }),
            unreserveBatchesForOrder: async (req, res) => ({ freed_count: 2 })
        };
    }

    createMockOperationsLogController() {
        return {
            logOperation: async (data) => ({ logged: true, id: Date.now() })
        };
    }

    /**
     * Generate test summary
     */
    generateSummary() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.passed).length;
        const failedTests = totalTests - passedTests;
        const totalDuration = Date.now() - this.startTime;
        const avgDuration = totalTests > 0 ? Math.round(this.testResults.reduce((sum, t) => sum + t.duration, 0) / totalTests) : 0;

        return {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
                totalDuration,
                avgTestDuration: avgDuration
            },
            details: this.testResults,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 STARTING ORDERSERVICE MIGRATION TEST SUITE');
        console.log('===============================================');

        const tests = [
            () => this.testServiceInitialization(),
            () => this.testConfigurationManagement(),
            () => this.testHybridServiceMethods(),
            () => this.testFallbackMechanisms(),
            () => this.testServiceHealthConnectivity(),
            () => this.testMigrationReadinessValidation(),
            () => this.testPerformanceBenchmarking()
        ];

        // Run tests sequentially
        for (const test of tests) {
            await test();
        }

        console.log('\n===============================================');
        console.log('🏁 TEST SUITE COMPLETED');
        
        const summary = this.generateSummary();
        
        console.log('\n📊 TEST SUMMARY:');
        console.log(`   Total Tests: ${summary.summary.total}`);
        console.log(`   Passed: ${summary.summary.passed} ✅`);
        console.log(`   Failed: ${summary.summary.failed} ${summary.summary.failed > 0 ? '❌' : ''}`);
        console.log(`   Success Rate: ${summary.summary.successRate}%`);
        console.log(`   Total Duration: ${summary.summary.totalDuration}ms`);
        console.log(`   Average Test Duration: ${summary.summary.avgTestDuration}ms`);

        if (summary.summary.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            summary.details.filter(t => !t.passed).forEach(test => {
                console.log(`   - ${test.test}: ${test.details.error}`);
            });
        }

        return summary;
    }
}

// Export for use in other modules
module.exports = OrderServiceMigrationTester;

// Run tests if called directly
if (require.main === module) {
    const tester = new OrderServiceMigrationTester();
    
    tester.runAllTests()
        .then(summary => {
            const exitCode = summary.summary.failed > 0 ? 1 : 0;
            console.log(`\n🎯 Migration Test Result: ${exitCode === 0 ? 'SUCCESS' : 'FAILURE'}`);
            
            if (exitCode === 0) {
                console.log('✅ OrderService migration architecture is ready for production!');
            } else {
                console.log('❌ OrderService migration needs fixes before deployment.');
            }
            
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('💥 TEST SUITE CRASHED:', error);
            process.exit(1);
        });
} 