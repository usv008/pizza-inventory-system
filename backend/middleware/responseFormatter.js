/**
 * Стандартизований форматтер для API responses
 * Згідно з creative-api-design.md
 */

function formatSuccess(data, message = null, meta = {}) {
  const response = {
    success: true,
    data: data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  if (message) {
    response.message = message;
  }

  return response;
}

function formatError(code, message, details = null) {
  const response = {
    success: false,
    error: {
      code: code,
      message: message
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  if (details) {
    response.error.details = details;
  }

  return response;
}

function formatCollection(data, count = null) {
  return formatSuccess(data, null, {
    count: count || data.length
  });
}

function formatCreated(data, message = 'Ресурс створено успішно') {
  return formatSuccess(data, message);
}

function formatUpdated(data = null, message = 'Ресурс оновлено успішно') {
  return formatSuccess(data, message);
}

function formatDeleted(message = 'Ресурс видалено успішно') {
  return formatSuccess(null, message);
}

/**
 * Async route handler wrapper
 * Автоматично обробляє помилки та передає їх до error handler middleware
 */
function handleAsync(fn) {
  return (req, res, next) => {
    // Виконуємо async функцію та ловимо будь-які помилки
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Загальна функція форматування response (для зворотної сумісності)
 */
function formatResponse(data, message = null, meta = {}) {
  return formatSuccess(data, message, meta);
}

module.exports = {
  formatSuccess,
  formatError,
  formatResponse,
  formatCollection,
  formatCreated,
  formatUpdated,
  formatDeleted,
  handleAsync
}; 