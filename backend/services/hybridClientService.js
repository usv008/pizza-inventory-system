const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Client Service - поступова міграція з SQLite на Supabase
 * Підтримує як legacy SQLite queries, так і нові Supabase operations
 */

let legacyClientService = null;
let supabaseClientService = null;
let migrationConfig = {
    // Configuration flags для поступової міграції
    USE_SUPABASE_READ: process.env.USE_SUPABASE_CLIENT_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_CLIENT_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false', // Default true
    LOG_OPERATIONS: process.env.LOG_HYBRID_OPERATIONS === 'true' || true
};

class HybridClientService {
    constructor() {
        this.initialized = false;
    }

    // Ініціалізація сервісів
    initialize(dependencies) {
        // Ініціалізуємо legacy service (існуючий SQLite)
        if (dependencies.legacyClientService) {
            legacyClientService = dependencies.legacyClientService;
            // Передаємо всі потрібні залежності для legacy service
            const legacyDeps = {
                clientQueries: dependencies.clientQueries,
                OperationsLogController: dependencies.OperationsLogController
            };
            legacyClientService.initialize(legacyDeps);
        }

        // Ініціалізуємо Supabase service
        if (dependencies.supabaseClientService) {
            supabaseClientService = dependencies.supabaseClientService;
            // Для Supabase service потрібен тільки OperationsLogController
            const supabaseDeps = {
                OperationsLogController: dependencies.OperationsLogController
            };
            supabaseClientService.initialize(supabaseDeps);
        }

        this.initialized = true;
        this.logOperation('initialize', 'Hybrid Client Service initialized', {
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
            throw new DatabaseError('HybridClientService не ініціалізовано');
        }
    }

    /**
     * Логування операцій міграції
     */
    logOperation(operation, message, details = {}) {
        if (migrationConfig.LOG_OPERATIONS) {
            console.log(`[HYBRID-CLIENT] ${operation}: ${message}`, details);
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

        if (useSupabase && supabaseClientService) {
            try {
                const result = await supabaseFunc(...args);
                this.logOperation(operation, `Supabase success for ${operation}`);
                return result;
            } catch (error) {
                this.logOperation(operation, `Supabase error for ${operation}: ${error.message}`);
                
                if (migrationConfig.FALLBACK_TO_LEGACY && legacyClientService) {
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
        } else if (legacyClientService) {
            this.logOperation(operation, `Using legacy for ${operation}`);
            return await legacyFunc(...args);
        } else {
            throw new DatabaseError('Ні Supabase, ні legacy client service недоступні');
        }
    }

    /**
     * Отримати всіх клієнтів
     */
    async getAllClients() {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getAllClients',
            () => supabaseClientService?.getAllClients(),
            () => legacyClientService?.getAllClients()
        );
    }

    /**
     * Отримати клієнта за ID
     */
    async getClientById(clientId) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getClientById',
            () => supabaseClientService?.getClientById(clientId),
            () => legacyClientService?.getClientById(clientId),
            clientId
        );
    }

    /**
     * Створити нового клієнта
     */
    async createClient(clientData, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'createClient',
            () => supabaseClientService?.createClient(clientData, auditInfo),
            () => legacyClientService?.createClient(clientData, auditInfo),
            clientData,
            auditInfo
        );
    }

    /**
     * Оновити клієнта
     */
    async updateClient(clientId, clientData, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'updateClient',
            () => supabaseClientService?.updateClient(clientId, clientData, auditInfo),
            () => legacyClientService?.updateClient(clientId, clientData, auditInfo),
            clientId,
            clientData,
            auditInfo
        );
    }

    /**
     * Деактивувати клієнта
     */
    async deactivateClient(clientId, auditInfo = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'deactivateClient',
            () => supabaseClientService?.deactivateClient(clientId, auditInfo),
            () => legacyClientService?.deactivateClient(clientId, auditInfo),
            clientId,
            auditInfo
        );
    }

    /**
     * Пошук клієнтів
     */
    async searchClients(searchParams = {}) {
        this._checkInitialization();
        return await this.executeWithFallback(
            'searchClients',
            () => supabaseClientService?.searchClients(searchParams),
            () => legacyClientService?.searchClients(searchParams),
            searchParams
        );
    }

    /**
     * Отримати статистику клієнтів
     */
    async getClientStats() {
        this._checkInitialization();
        return await this.executeWithFallback(
            'getClientStats',
            () => supabaseClientService?.getClientStats(),
            () => legacyClientService?.getClientStats()
        );
    }

    /**
     * Dual-write operation: записати в обидві БД для синхронізації
     */
    async dualWriteClient(operation, ...args) {
        const results = { supabase: null, legacy: null, errors: [] };

        // Спробувати Supabase
        if (supabaseClientService) {
            try {
                results.supabase = await supabaseClientService[operation](...args);
                this.logOperation('dualWrite', `Supabase ${operation} success`);
            } catch (error) {
                results.errors.push({ service: 'supabase', error: error.message });
                this.logOperation('dualWrite', `Supabase ${operation} failed: ${error.message}`);
            }
        }

        // Спробувати Legacy
        if (legacyClientService) {
            try {
                results.legacy = await legacyClientService[operation](...args);
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
                legacy: !!legacyClientService,
                supabase: !!supabaseClientService
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
        if (legacyClientService) {
            try {
                await legacyClientService.getAllClients();
                results.legacy = true;
            } catch (error) {
                results.errors.push({ service: 'legacy', error: error.message });
            }
        }

        // Test Supabase
        if (supabaseClientService) {
            try {
                await supabaseClientService.getAllClients();
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

module.exports = HybridClientService; 