const authService = require('./authService');
const database = require('../database');

/**
 * Legacy Auth Service Wrapper
 * Адаптер для існуючої системи аутентифікації
 * Використовується в Dual Auth системі
 */
class LegacyAuthService {
  constructor() {
    this.authService = authService;
    this.initialized = false;
    this.initializeService();
  }

  /**
   * Ініціалізація Legacy Auth Service
   */
  async initializeService() {
    try {
      // Ініціалізуємо AuthService з існуючими залежностями
      const dependencies = {
        userQueries: database.userQueries,
        sessionQueries: database.sessionQueries,
        auditQueries: database.auditQueries
      };
      
      this.authService.initialize(dependencies);
      this.initialized = true;
      console.log('✅ Legacy Auth Service initialized');
    } catch (error) {
      console.error('🚨 Legacy Auth Service initialization error:', error.message);
    }
  }

  /**
   * Authenticate user using legacy session
   */
  async authenticate(req) {
    try {
      if (!this.initialized) {
        return null;
      }

      // Перевіряємо наявність session
      if (!req.session || !req.session.userId) {
        return null;
      }

      // Валідуємо сесію через існуючий AuthService
      const sessionValid = await this.authService.validateSession(req.sessionID);
      if (!sessionValid) {
        return null;
      }

      // Отримуємо дані користувача з сесії
      const userId = req.session.userId;
      const user = await this.getUserById(userId);
      
      if (!user || !user.is_active) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        full_name: user.full_name,
        is_active: user.is_active,
        sessionId: req.sessionID
      };
    } catch (error) {
      console.error('🚨 Legacy authentication error:', error.message);
      return null;
    }
  }

  /**
   * Login user with legacy system
   */
  async login(username, password, sessionInfo = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Legacy Auth Service not initialized');
      }

      const result = await this.authService.login(username, password, sessionInfo);
      return result;
    } catch (error) {
      console.error('🚨 Legacy login error:', error.message);
      throw error;
    }
  }

  /**
   * Logout user from legacy system
   */
  async logout(req, res) {
    try {
      if (!this.initialized) {
        return { success: false, error: 'Service not initialized' };
      }

      const sessionId = req.sessionID;
      const userId = req.session ? req.session.userId : null;

      if (sessionId && userId) {
        await this.authService.logout(sessionId, userId, {
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
      }

      // Знищуємо сесію
      req.session.destroy((err) => {
        if (err) {
          console.error('🚨 Session destroy error:', err);
        }
      });

      // Очищуємо cookie
      res.clearCookie('connect.sid');

      return { success: true, message: 'Logged out from legacy system' };
    } catch (error) {
      console.error('🚨 Legacy logout error:', error.message);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      if (!this.initialized || !database.userQueries) {
        return null;
      }

      const user = await database.userQueries.getById(userId);
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.username, // Legacy system uses username as full name
        role: user.role,
        permissions: JSON.parse(user.permissions || '{}'),
        is_active: user.active === 1,
        first_login: user.first_login,
        created_at: user.created_at,
        last_login: user.last_login
      };
    } catch (error) {
      console.error('🚨 Get user by ID error:', error.message);
      return null;
    }
  }

  /**
   * Update user record
   */
  async updateUser(userId, updates) {
    try {
      if (!this.initialized || !database.userQueries) {
        throw new Error('Service not initialized');
      }

      // Для legacy системи оновлюємо через прямий SQL запит
      const db = database.db;
      
      const updateFields = [];
      const updateValues = [];
      
      Object.keys(updates).forEach(key => {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      });
      
      updateValues.push(userId);
      
      const query = `UPDATE users SET ${updateFields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
      
      await new Promise((resolve, reject) => {
        db.run(query, updateValues, function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });

      console.log(`✅ Legacy user ${userId} updated`);
      return true;
    } catch (error) {
      console.error('🚨 Update user error:', error.message);
      throw error;
    }
  }

  /**
   * Get user count for statistics
   */
  async getUserCount() {
    try {
      if (!this.initialized || !database.userQueries) {
        return 0;
      }

      const users = await database.userQueries.getAll();
      return users.length;
    } catch (error) {
      console.error('🚨 Get user count error:', error.message);
      return 0;
    }
  }

  /**
   * Get all active users
   */
  async getActiveUsers() {
    try {
      if (!this.initialized) {
        return [];
      }

      return await this.authService.getActiveUsers();
    } catch (error) {
      console.error('🚨 Get active users error:', error.message);
      return [];
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword, sessionInfo = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }

      return await this.authService.changeOwnPassword(userId, currentPassword, newPassword, sessionInfo);
    } catch (error) {
      console.error('🚨 Change password error:', error.message);
      throw error;
    }
  }

  /**
   * Set first time password
   */
  async setFirstTimePassword(userId, password, sessionInfo = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }

      return await this.authService.setFirstTimePassword(userId, password, sessionInfo);
    } catch (error) {
      console.error('🚨 Set first time password error:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.initialized && database.db !== null;
  }

  /**
   * Get legacy system status
   */
  async getStatus() {
    try {
      const isAvailable = this.isAvailable();
      const userCount = isAvailable ? await this.getUserCount() : 0;
      
      return {
        available: isAvailable,
        userCount: userCount,
        system: 'legacy',
        database: 'sqlite'
      };
    } catch (error) {
      return {
        available: false,
        userCount: 0,
        system: 'legacy',
        database: 'sqlite',
        error: error.message
      };
    }
  }
}

module.exports = LegacyAuthService; 