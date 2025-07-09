const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Сервіс для роботи з клієнтами
 * Надає бізнес-логіку для операцій з клієнтами включаючи аудит
 */
class ClientService {
    constructor() {
        this.clientQueries = null;
        this.OperationsLogController = null;
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        this.clientQueries = dependencies.clientQueries;
        this.OperationsLogController = dependencies.OperationsLogController;
        this.initialized = true;
        console.log('✅ ClientService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized || !this.clientQueries) {
            throw new DatabaseError('ClientService не ініціалізовано або БД недоступна');
        }
    }

    /**
     * Отримати всіх активних клієнтів
     */
    async getAllClients() {
        this._checkInitialization();
        
        try {
            const clients = await this.clientQueries.getAll();
            
            console.log(`📋 Отримано ${clients.length} клієнтів`);
            return clients;
        } catch (error) {
            console.error('❌ Помилка отримання клієнтів:', error);
            throw new DatabaseError(`Помилка отримання клієнтів: ${error.message}`);
        }
    }

    /**
     * Отримати клієнта за ID
     */
    async getClientById(clientId) {
        this._checkInitialization();
        
        try {
            const client = await this.clientQueries.getById(clientId);
            
            if (client) {
                console.log(`📋 Отримано клієнта: ${client.name} (ID: ${clientId})`);
            } else {
                console.log(`⚠️ Клієнта з ID ${clientId} не знайдено`);
            }
            
            return client;
        } catch (error) {
            console.error(`❌ Помилка отримання клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка отримання клієнта: ${error.message}`);
        }
    }

    /**
     * Створити нового клієнта
     */
    async createClient(clientData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Перевіряємо унікальність назви клієнта
            const existingClient = await this._findClientByName(clientData.name);
            if (existingClient) {
                throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
            }

            const result = await this.clientQueries.create(clientData);
            
            console.log(`✅ Створено клієнта: ${clientData.name} (ID: ${result.id})`);

            // Логуємо операцію
            await this._logClientOperation('CREATE_CLIENT', result.id, {
                operation_id: result.id,
                entity_type: 'client',
                entity_id: result.id,
                new_data: clientData,
                description: `Створено клієнта "${clientData.name}"`,
                ...auditInfo
            });

            return result;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка створення клієнта:', error);
            throw new DatabaseError(`Помилка створення клієнта: ${error.message}`);
        }
    }

    /**
     * Оновити клієнта
     */
    async updateClient(clientId, clientData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо старі дані для логування
            const oldClient = await this.clientQueries.getById(clientId);
            if (!oldClient) {
                throw new NotFoundError('Клієнта не знайдено');
            }

            // Перевіряємо унікальність назви (якщо змінилась)
            if (clientData.name !== oldClient.name) {
                const existingClient = await this._findClientByName(clientData.name);
                if (existingClient && existingClient.id !== clientId) {
                    throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
                }
            }

            const result = await this.clientQueries.update(clientId, clientData);
            
            if (result.changes === 0) {
                throw new NotFoundError('Клієнта не знайдено або не оновлено');
            }

            console.log(`✅ Оновлено клієнта: ${clientData.name} (ID: ${clientId})`);

            // Логуємо операцію
            await this._logClientOperation('UPDATE_CLIENT', clientId, {
                operation_id: clientId,
                entity_type: 'client',
                entity_id: clientId,
                old_data: oldClient,
                new_data: clientData,
                description: `Оновлено клієнта "${clientData.name}"`,
                ...auditInfo
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка оновлення клієнта: ${error.message}`);
        }
    }

    /**
     * Деактивувати клієнта (soft delete)
     */
    async deactivateClient(clientId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо дані клієнта для логування
            const client = await this.clientQueries.getById(clientId);
            if (!client) {
                throw new NotFoundError('Клієнта не знайдено');
            }

            const result = await this.clientQueries.deactivate(clientId);
            
            if (result.changes === 0) {
                throw new NotFoundError('Клієнта не знайдено або вже деактивовано');
            }

            console.log(`🗑️ Деактивовано клієнта: ${client.name} (ID: ${clientId})`);

            // Логуємо операцію
            await this._logClientOperation('DEACTIVATE_CLIENT', clientId, {
                operation_id: clientId,
                entity_type: 'client',
                entity_id: clientId,
                old_data: client,
                description: `Деактивовано клієнта "${client.name}"`,
                ...auditInfo
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка деактивації клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка деактивації клієнта: ${error.message}`);
        }
    }

    /**
     * Пошук клієнтів за параметрами
     */
    async searchClients(searchParams = {}) {
        this._checkInitialization();
        
        try {
            const { name, phone, email } = searchParams;
            
            // Отримуємо всіх клієнтів та фільтруємо
            const allClients = await this.clientQueries.getAll();
            let filteredClients = allClients;
            
            if (name) {
                filteredClients = filteredClients.filter(client => 
                    client.name && client.name.toLowerCase().includes(name.toLowerCase())
                );
            }
            
            if (phone) {
                filteredClients = filteredClients.filter(client => 
                    client.phone && client.phone.includes(phone)
                );
            }
            
            if (email) {
                filteredClients = filteredClients.filter(client => 
                    client.email && client.email.toLowerCase().includes(email.toLowerCase())
                );
            }
            
            console.log(`🔍 Пошук клієнтів: знайдено ${filteredClients.length} результатів`);
            return filteredClients;
        } catch (error) {
            console.error('❌ Помилка пошуку клієнтів:', error);
            throw new DatabaseError(`Помилка пошуку клієнтів: ${error.message}`);
        }
    }

    /**
     * Приватний метод: знайти клієнта за назвою
     */
    async _findClientByName(name) {
        try {
            const clients = await this.clientQueries.getAll();
            return clients.find(client => client.name === name);
        } catch (error) {
            console.warn('Попередження при пошуку клієнта за назвою:', error.message);
            return null;
        }
    }

    /**
     * Приватний метод: логування операцій з клієнтами
     */
    async _logClientOperation(operationType, clientId, logData) {
        if (!this.OperationsLogController) {
            console.warn('⚠️ OperationsLogController недоступний для логування');
            return;
        }

        try {
            await this.OperationsLogController.logOperation({
                operation_type: operationType,
                ...logData
            });
        } catch (logError) {
            console.error(`❌ Помилка логування операції ${operationType} для клієнта ${clientId}:`, logError);
            // Не кидаємо помилку, щоб не зламати основну операцію
        }
    }

    /**
     * Отримати статистику клієнтів
     */
    async getClientStats() {
        this._checkInitialization();
        
        try {
            const allClients = await this.clientQueries.getAll();
            const activeClients = allClients.filter(c => c.is_active);
            
            const stats = {
                total: allClients.length,
                active: activeClients.length,
                inactive: allClients.length - activeClients.length,
                clients_with_phone: activeClients.filter(c => c.phone && c.phone.trim()).length,
                clients_with_email: activeClients.filter(c => c.email && c.email.trim()).length,
                clients_with_address: activeClients.filter(c => c.address && c.address.trim()).length
            };
            
            console.log(`📊 Статистика клієнтів: ${stats.active} активних з ${stats.total}`);
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики клієнтів:', error);
            throw new DatabaseError(`Помилка отримання статистики: ${error.message}`);
        }
    }
}

// Експортуємо клас
module.exports = ClientService; 