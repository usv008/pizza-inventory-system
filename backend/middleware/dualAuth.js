const authRouter = require('../supabase/authRouter');

/**
 * Dual Authentication Middleware
 * Підтримує як Supabase Auth, так і Legacy Express Sessions
 * Реалізація Gradual Migration approach з Creative Phase
 */
class DualAuthMiddleware {
  /**
   * Primary authentication middleware
   * Перевіряє обидві системи аутентифікації
   */
  static async authenticate(req, res, next) {
    try {
      // Спробуємо аутентифікувати користувача через Auth Router
      const user = await authRouter.authenticate(req);
      
      if (user) {
        req.user = user;
        req.authType = user.authType;
        req.authSystem = user.system;
        
        // Логування успішної аутентифікації
        console.log(`🔐 Authenticated: ${user.username} (${user.authType})`);
        
        return next();
      }

      // Якщо аутентифікація не вдалася
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
        authSystems: ['supabase', 'legacy']
      });
    } catch (error) {
      console.error('🚨 Dual Auth Middleware error:', error.message);
      
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Internal authentication error'
      });
    }
  }

  /**
   * Optional authentication middleware
   * Спробує аутентифікувати, але не блокує доступ
   */
  static async optionalAuth(req, res, next) {
    try {
      const user = await authRouter.authenticate(req);
      
      if (user) {
        req.user = user;
        req.authType = user.authType;
        req.authSystem = user.system;
        req.isAuthenticated = true;
        
        console.log(`🔐 Optional auth: ${user.username} (${user.authType})`);
      } else {
        req.user = null;
        req.authType = null;
        req.authSystem = null;
        req.isAuthenticated = false;
      }
      
      return next();
    } catch (error) {
      console.error('🚨 Optional Auth error:', error.message);
      
      // При помилці продовжуємо без аутентифікації
      req.user = null;
      req.authType = null;
      req.authSystem = null;
      req.isAuthenticated = false;
      
      return next();
    }
  }

  /**
   * Role-based authorization middleware
   * Перевіряє ролі користувача
   */
  static requireRole(...allowedRoles) {
    return async (req, res, next) => {
      try {
        // Спочатку перевіряємо аутентифікацію
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Please log in first'
          });
        }

        // Перевіряємо роль
        const userRole = req.user.role;
        
        if (!allowedRoles.includes(userRole)) {
          console.warn(`🚫 Access denied: ${req.user.username} (${userRole}) tried to access ${req.path}`);
          
          return res.status(403).json({
            error: 'Access denied',
            message: `Role '${userRole}' is not authorized for this resource`,
            requiredRoles: allowedRoles
          });
        }

        console.log(`✅ Role check passed: ${req.user.username} (${userRole})`);
        return next();
      } catch (error) {
        console.error('🚨 Role check error:', error.message);
        
        return res.status(500).json({
          error: 'Authorization error',
          message: 'Internal authorization error'
        });
      }
    };
  }

  /**
   * Permission-based authorization middleware
   * Перевіряє детальні права доступу
   */
  static requirePermission(permissionKey) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Please log in first'
          });
        }

        // Адміністратори мають доступ до всього
        if (req.user.role === 'admin') {
          return next();
        }

        // Перевіряємо конкретний дозвіл
        const userPermissions = req.user.permissions || {};
        
        if (!userPermissions[permissionKey]) {
          console.warn(`🚫 Permission denied: ${req.user.username} missing '${permissionKey}'`);
          
          return res.status(403).json({
            error: 'Permission denied',
            message: `Missing required permission: '${permissionKey}'`,
            userRole: req.user.role
          });
        }

        console.log(`✅ Permission check passed: ${req.user.username} has '${permissionKey}'`);
        return next();
      } catch (error) {
        console.error('🚨 Permission check error:', error.message);
        
        return res.status(500).json({
          error: 'Authorization error',
          message: 'Internal authorization error'
        });
      }
    };
  }

  /**
   * Supabase-only authentication middleware
   * Вимагає тільки Supabase аутентифікацію
   */
  static async requireSupabase(req, res, next) {
    try {
      const user = await authRouter.authenticate(req);
      
      if (!user || user.authType !== 'supabase') {
        return res.status(401).json({
          error: 'Supabase authentication required',
          message: 'This endpoint requires Supabase authentication',
          authType: user ? user.authType : 'none'
        });
      }

      req.user = user;
      req.authType = user.authType;
      req.authSystem = user.system;
      
      return next();
    } catch (error) {
      console.error('🚨 Supabase auth error:', error.message);
      
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Supabase authentication error'
      });
    }
  }

  /**
   * Legacy-only authentication middleware
   * Вимагає тільки Legacy аутентифікацію
   */
  static async requireLegacy(req, res, next) {
    try {
      const user = await authRouter.authenticate(req);
      
      if (!user || user.authType !== 'legacy') {
        return res.status(401).json({
          error: 'Legacy authentication required',
          message: 'This endpoint requires legacy session authentication',
          authType: user ? user.authType : 'none'
        });
      }

      req.user = user;
      req.authType = user.authType;
      req.authSystem = user.system;
      
      return next();
    } catch (error) {
      console.error('🚨 Legacy auth error:', error.message);
      
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Legacy authentication error'
      });
    }
  }

  /**
   * Migration status middleware
   * Додає інформацію про статус міграції
   */
  static async addMigrationInfo(req, res, next) {
    try {
      // Отримуємо статистику аутентифікації
      const authStats = await authRouter.getAuthStats();
      
      req.migrationInfo = {
        authMode: authRouter.getAuthMode(req),
        stats: authStats,
        supabaseAvailable: authRouter.supabaseAuth.isAvailable(),
        legacyAvailable: authRouter.legacyAuth.isAvailable()
      };
      
      return next();
    } catch (error) {
      console.error('🚨 Migration info error:', error.message);
      
      // Продовжуємо без migration info
      req.migrationInfo = {
        authMode: 'error',
        stats: { error: error.message },
        supabaseAvailable: false,
        legacyAvailable: false
      };
      
      return next();
    }
  }

  /**
   * Audit logging middleware
   * Логує всі аутентифіковані запити
   */
  static auditRequest(req, res, next) {
    if (req.user) {
      console.log(`📝 API Request: ${req.user.username} (${req.authType}) ${req.method} ${req.path}`);
      
      // Додаємо timestamp
      req.requestTimestamp = new Date().toISOString();
      
      // Логуємо IP та User-Agent
      req.clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        authType: req.authType
      };
    }
    
    return next();
  }
}

module.exports = DualAuthMiddleware; 