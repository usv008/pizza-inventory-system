// frontend/js/error-handler.js - Утиліти для обробки помилок

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // Максимум помилок в пам'яті
    }

    // Безпечний пошук DOM елементів
    safeQuerySelector(selector, context = document) {
        try {
            const element = context.querySelector(selector);
            if (!element) {
                this.logError(`Element not found: ${selector}`, 'DOM_NOT_FOUND');
                return null;
            }
            return element;
        } catch (error) {
            this.logError(`Invalid selector: ${selector}`, 'INVALID_SELECTOR', error);
            return null;
        }
    }

    // Безпечний пошук множинних елементів
    safeQuerySelectorAll(selector, context = document) {
        try {
            return context.querySelectorAll(selector);
        } catch (error) {
            this.logError(`Invalid selector: ${selector}`, 'INVALID_SELECTOR', error);
            return [];
        }
    }

    // Показ помилки користувачу
    showUserError(message, type = 'error', duration = 5000) {
        // Створюємо алерт елемент
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
            background-color: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            border-radius: 4px;
            padding: 12px 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        alertDiv.textContent = message;

        // Додаємо CSS анімацію якщо немає
        this.addErrorStyles();

        // Вставляємо в DOM
        document.body.appendChild(alertDiv);

        // Автоматичне видалення
        setTimeout(() => {
            alertDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 300);
        }, duration);

        // Логуємо помилку тільки якщо це не success
        if (type !== 'success') {
        this.logError(message, 'USER_ERROR');
        }
    }

    // Логування помилок
    logError(message, type = 'GENERAL', originalError = null) {
        const errorObj = {
            timestamp: new Date().toISOString(),
            message,
            type,
            originalError: originalError ? originalError.toString() : null,
            stack: originalError ? originalError.stack : new Error().stack,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Додаємо до масиву
        this.errors.push(errorObj);
        
        // Обмежуємо розмір масиву
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Логуємо в консоль
        console.error(`[${type}] ${message}`, originalError || '');

        // Відправляємо на сервер (опціонально)
        this.sendErrorToServer(errorObj);
    }

    // Відправка помилки на сервер (базова версія)
    sendErrorToServer(errorObj) {
        // Тільки критичні помилки відправляємо на сервер
        const criticalTypes = ['API_ERROR', 'DATABASE_ERROR', 'CRITICAL_ERROR'];
        
        if (criticalTypes.includes(errorObj.type)) {
            try {
                fetch('/api/log-error', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(errorObj)
                }).catch(() => {
                    // Ігноруємо помилки логування
                });
            } catch (e) {
                // Ігноруємо помилки логування
            }
        }
    }

    // Додавання стилів для алертів
    addErrorStyles() {
        if (document.getElementById('error-handler-styles')) return;

        const style = document.createElement('style');
        style.id = 'error-handler-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Отримання всіх помилок
    getErrors() {
        return [...this.errors];
    }

    // Очищення помилок
    clearErrors() {
        this.errors = [];
    }

    // Wrapper для async операцій
    async safeAsync(asyncFn, errorMessage = 'Operation failed') {
        try {
            return await asyncFn();
        } catch (error) {
            this.logError(errorMessage, 'ASYNC_ERROR', error);
            this.showUserError(errorMessage);
            throw error;
        }
    }
}

// Створюємо глобальний екземпляр
window.errorHandler = new ErrorHandler();

// Глобальний обробник неперехоплених помилок
window.addEventListener('error', (event) => {
    window.errorHandler.logError(
        event.message, 
        'UNCAUGHT_ERROR', 
        event.error
    );
});

// Обробник неперехоплених Promise відхилень
window.addEventListener('unhandledrejection', (event) => {
    window.errorHandler.logError(
        'Unhandled Promise rejection: ' + event.reason, 
        'UNHANDLED_PROMISE'
    );
});

// Експорт для використання
window.safeQuerySelector = window.errorHandler.safeQuerySelector.bind(window.errorHandler);
window.showUserError = window.errorHandler.showUserError.bind(window.errorHandler);
window.logError = window.errorHandler.logError.bind(window.errorHandler);