const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Writeoff Service - поступова міграція з SQLite на Supabase
 * Підтримує як legacy SQLite queries, так і нові Supabase operations
 */

let legacyWriteoffService = null;
let supabaseWriteoffService = null;
let migrationConfig = {
    // Configuration flags для поступової міграції
    USE_SUPABASE_READ: process.env.USE_SUPABASE_WRITEOFF_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_WRITEOFF_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false', // Default true
    LOG_OPERATIONS: process.env.LOG_HYBRID_OPERATIONS === 'true' || true
};

class HybridWriteoffService {
    constructor() {
        this.initialized = false;
    }

    // Ініціалізація сервісів
    initialize(dependencies) {
        // Ініціалізуємо legacy service (існуючий SQLite)
        if (dependencies.legacyWriteoffService) {
            legacyWriteoffService = dependencies.legacyWriteoffService;
            // Передаємо всі потрібні залежності для legacy service
            const legacyDeps = {
                writeoffQueries: dependencies.writeoffQueries,
                productQueries: dependencies.productQueries,
                OperationsLogController: dependencies.OperationsLogController
            };
            legacyWriteoffService.initialize(legacyDeps);
        }

        // Ініціалізуємо Supabase service
        if (dependencies.supabaseWriteoffService) {
            supabaseWriteoffService = dependencies.supabaseWriteoffService;
            // Для Supabase service потрібен тільки OperationsLogController
            const supabaseDeps = {
                OperationsLogController: dependencies.OperationsLogController
            };
            supabaseWriteoffService.initialize(supabaseDeps);
        }

        this.initialized = true;
        this.logOperation('initialize', 'Hybrid Writeoff Service initialized', {
            useSupabaseRead: migrationConfig.USE_SUPABASE_READ,
            useSupabaseWrite: migrationConfig.USE_SUPABASE_WRITE,
            fallbackToLegacy: migrationConfig.FALLBACK_TO_LEGACY
        });
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('HybridWriteoffService не ініціалізовано');
        }
    }

    /**
     * Логування операцій міграції
     */
    logOperation(operation, message, details = {}) {
        if (migrationConfig.LOG_OPERATIONS) {
            console.log(`[HYBRID-WRITEOFF] ${operation}: ${message}`, details);
        }
    }

    /**
     * Wrapper для виконання операції з fallback логікою
     */
    async executeWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
        const useSupabase = operation.includes('read') || operation.includes('get') || operation.includes('search')
            ? migrationConfig.USE_SUPABASE_READ 
            : migrationConfig.USE_SUPABASE_WRITE;

        this.logOperation(operation, `Executing ${operation}`, { 
            useSupabase, 
            args: args.map(arg => typeof arg === 'object' ? '[object]' : arg) 
        });

        if (useSupabase && supabaseWriteoffService) {
            try {
                const result = await supabaseFunc(...args);
                this.logOperation(operation, `Supabase success for ${operation}`);
                return result;
            } catch (error) {
                this.logOperation(operation, `Supabase error for ${operation}: ${error.message}`);
                
                if (migrationConfig.FALLBACK_TO_LEGACY && legacyWriteoffService) {
                    this.logOperation(operation, `Falling back to legacy for ${operation}`);
                    try {
                        const result = await legacyFunc(...args);
                        this.logOperation(operation, `Legacy fallback success for ${operation}`);
                        return result;
                    } catch (legacyError) {
                        this.logOperation(operation, `Legacy fallback also failed for ${operation}: ${legacyError.message}`);
                        throw legacyError;
                    }
                } else {
                    throw error;
                }
            }
        } else if (legacyWriteoffService) {
            this.logOperation(operation, `Using legacy for ${operation}`);
            return await legacyFunc(...args);
        } else {
            throw new DatabaseError('Ні Supabase, ні legacy writeoff service недоступні');
        }
    }

    /**
     * Отримати всі списання
     */
    async getAllWriteoffs() {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getAllWriteoffs',
            () => supabaseWriteoffService?.getAllWriteoffs(),
            () => legacyWriteoffService?.getAllWriteoffs()
        );
    }

    /**
     * Отримати списання за ID
     */
    async getWriteoffById(writeoffId) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getWriteoffById',
            () => supabaseWriteoffService?.getWriteoffById(writeoffId),
            () => legacyWriteoffService?.getWriteoffById(writeoffId),
            writeoffId
        );
    }

    /**
     * Створити нове списання
     */
    async createWriteoff(writeoffData, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'createWriteoff',
            () => supabaseWriteoffService?.createWriteoff(writeoffData, auditInfo),
            () => legacyWriteoffService?.createWriteoff(writeoffData, auditInfo),
            writeoffData,
            auditInfo
        );
    }

    /**
     * Оновити списання
     */
    async updateWriteoff(writeoffId, writeoffData, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'updateWriteoff',
            () => supabaseWriteoffService?.updateWriteoff(writeoffId, writeoffData, auditInfo),
            () => legacyWriteoffService?.updateWriteoff(writeoffId, writeoffData, auditInfo),
            writeoffId,
            writeoffData,
            auditInfo
        );
    }

    /**
     * Видалити списання
     */
    async deleteWriteoff(writeoffId, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'deleteWriteoff',
            () => supabaseWriteoffService?.deleteWriteoff(writeoffId, auditInfo),
            () => legacyWriteoffService?.deleteWriteoff(writeoffId, auditInfo),
            writeoffId,
            auditInfo
        );
    }

    /**
     * Пошук списань
     */
    async searchWriteoffs(searchParams = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'searchWriteoffs',
            () => supabaseWriteoffService?.searchWriteoffs(searchParams),
            () => legacyWriteoffService?.searchWriteoffs(searchParams),
            searchParams
        );
    }

    /**
     * Отримати статистику списань
     */
    async getWriteoffStats(dateRange = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getWriteoffStats',
            () => supabaseWriteoffService?.getWriteoffStats(dateRange),
            () => legacyWriteoffService?.getWriteoffStats(dateRange),
            dateRange
        );
    }

    /**
     * Dual-write operation: записати в обидві БД для синхронізації
     */
    async dualWriteWriteoff(operation, ...args) {
        const results = { supabase: null, legacy: null, errors: [] };

        // Спробувати Supabase
        if (supabaseWriteoffService) {
            try {
                results.supabase = await supabaseWriteoffService[operation](...args);
                this.logOperation('dualWrite', `Supabase ${operation} success`);
            } catch (error) {
                results.errors.push({ service: 'supabase', error: error.message });
                this.logOperation('dualWrite', `Supabase ${operation} failed: ${error.message}`);
            }
        }

        // Спробувати Legacy
        if (legacyWriteoffService) {
            try {
                results.legacy = await legacyWriteoffService[operation](...args);
                this.logOperation('dualWrite', `Legacy ${operation} success`);
            } catch (error) {
                results.errors.push({ service: 'legacy', error: error.message });
                this.logOperation('dualWrite', `Legacy ${operation} failed: ${error.message}`);
            }
        }

        // Повернути успішний результат або кинути помилку
        if (results.supabase || results.legacy) {
            return results.supabase || results.legacy;
        } else {
            const errorMsg = `Dual-write ${operation} failed in both services: ${JSON.stringify(results.errors)}`;
            this.logOperation('dualWrite', errorMsg);
            throw new DatabaseError(errorMsg);
        }
    }

    /**
     * Migration utilities
     */
    getMigrationStatus() {
        return {
            config: migrationConfig,
            services: {
                legacy: !!legacyWriteoffService,
                supabase: !!supabaseWriteoffService
            },
            timestamp: new Date().toISOString()
        };
    }

    updateMigrationConfig(newConfig) {
        migrationConfig = { ...migrationConfig, ...newConfig };
        this.logOperation('configUpdate', 'Migration config updated', migrationConfig);
    }

    /**
     * Test connectivity to both services
     */
    async testConnectivity() {
        const results = { legacy: false, supabase: false, errors: [] };

        // Test legacy
        if (legacyWriteoffService) {
            try {
                await legacyWriteoffService.getAllWriteoffs();
                results.legacy = true;
            } catch (error) {
                results.errors.push({ service: 'legacy', error: error.message });
            }
        }

        // Test Supabase
        if (supabaseWriteoffService) {
            try {
                await supabaseWriteoffService.getAllWriteoffs();
                results.supabase = true;
            } catch (error) {
                results.errors.push({ service: 'supabase', error: error.message });
            }
        }

        return results;
    }

    /**
     * Emergency fallback to legacy only
     */
    emergencyFallbackToLegacy() {
        this.logOperation('emergency', 'Emergency fallback to legacy activated');
        migrationConfig.USE_SUPABASE_READ = false;
        migrationConfig.USE_SUPABASE_WRITE = false;
        migrationConfig.FALLBACK_TO_LEGACY = true;
    }

    /**
     * Enable full Supabase mode
     */
    enableFullSupabaseMode() {
        this.logOperation('migration', 'Full Supabase mode activated');
        migrationConfig.USE_SUPABASE_READ = true;
        migrationConfig.USE_SUPABASE_WRITE = true;
        migrationConfig.FALLBACK_TO_LEGACY = false;
    }
}

module.exports = HybridWriteoffService; 