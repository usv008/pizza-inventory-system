// middleware/userContextMiddleware.js - User Context Middleware for operations tracking

/**
 * Middleware to add user context to request object for operations logging
 * This ensures all operations have proper user attribution
 */
const userContextMiddleware = (req, res, next) => {
    try {
        // Add user context to request for logging
        req.userContext = {
            user_id: req.session?.user?.id || null,
            username: req.session?.user?.username || 'system',
            role: req.session?.user?.role || null,
            session_id: req.session?.id || null
        };
        
        // Helper function for logging operations with user context
        req.logOperation = async (operationType, details = {}, entityType = null, entityId = null) => {
            const OperationsLogController = require('../controllers/operations-log-controller');
            
            // Add user context to details
            const enrichedDetails = {
                ...details,
                performed_by: req.userContext.username,
                session_id: req.userContext.session_id,
                timestamp: new Date().toISOString()
            };
            
            return await OperationsLogController.logOperation(
                operationType,
                enrichedDetails,
                req.userContext.user_id,
                entityType,
                entityId
            );
        };
        
        // Debug logging for development
        if (process.env.NODE_ENV === 'development') {
            console.log(`🔐 User Context: ${req.userContext.username} (${req.method} ${req.path})`);
        }
        
        next();
    } catch (error) {
        console.error('❌ Error in userContextMiddleware:', error);
        // Don't block the request if context fails
        req.userContext = { user_id: null, username: 'system', role: null };
        req.logOperation = async () => ({ success: false, error: 'Context middleware failed' });
        next();
    }
};

module.exports = userContextMiddleware; 