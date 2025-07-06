const { AppError } = require('./errors/AppError');
const responseFormatter = require('./responseFormatter');

/**
 * Глобальний Error Handler Middleware
 * Обробляє всі помилки в додатку
 */
function globalErrorHandler(error, req, res, next) {
  // Log error for monitoring
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle known operational errors
  if (error.isOperational) {
    return res.status(error.statusCode).json(
      responseFormatter.formatError(error.code, error.message, error.details)
    );
  }

  // Handle SQLite specific errors
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(400).json(
      responseFormatter.formatError('UNIQUE_CONSTRAINT', 'Ресурс з такими даними вже існує')
    );
  }

  if (error.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json(
      responseFormatter.formatError('CONSTRAINT_ERROR', 'Порушення обмежень бази даних')
    );
  }

  // Handle JSON parse errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json(
      responseFormatter.formatError('JSON_PARSE_ERROR', 'Некоректний формат JSON в запиті')
    );
  }

  // Handle programming errors (don't leak details in production)
  console.error('PROGRAMMING ERROR - NEEDS ATTENTION:', error);
  
  return res.status(500).json(
    responseFormatter.formatError(
      'INTERNAL_SERVER_ERROR', 
      'Внутрішня помилка сервера'
    )
  );
}

/**
 * Middleware для обробки 404 помилок
 */
function notFoundHandler(req, res, next) {
  res.status(404).json(
    responseFormatter.formatError(
      'NOT_FOUND',
      `Маршрут ${req.originalUrl} не знайдено`
    )
  );
}

module.exports = {
  globalErrorHandler,
  notFoundHandler
}; 