// frontend/js/auth.js - Модуль управління аутентифікацією

class AuthManager {
    constructor() {
        this.apiUrl = '/api';
        this.currentUser = null;
        this.checkInterval = null;
        this.sessionCheckInterval = 5 * 60 * 1000; // 5 хвилин
    }

    // Перевірка поточної сесії
    async checkSession() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/me`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.user) {
                    this.currentUser = data.data.user;
                    return true;
                }
            }
            
            this.currentUser = null;
            return false;
            
        } catch (error) {
            if (typeof logError === 'function') {
                logError('Session check failed', 'SESSION_CHECK_ERROR', error);
            }
            this.currentUser = null;
            return false;
        }
    }

    // Перевірка чи користувач авторизований
    async isAuthenticated() {
        return await this.checkSession();
    }

    // Отримання поточного користувача
    getCurrentUser() {
        return this.currentUser;
    }

    // Перевірка дозволів користувача
    hasPermission(permission) {
        if (!this.currentUser || !this.currentUser.permissions) {
            return false;
        }

        // Розбираємо дозвіл на частини (наприклад, "admin.all_rights")
        const parts = permission.split('.');
        let current = this.currentUser.permissions;

        for (const part of parts) {
            if (current && typeof current === 'object' && current[part] !== undefined) {
                current = current[part];
            } else {
                return false;
            }
        }

        return Boolean(current);
    }

    // Перевірка ролі користувача
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    // Перевірка чи користувач - адміністратор
    isAdmin() {
        // Будь-який користувач з роллю ДИРЕКТОР має всі права адміністратора
        return this.hasRole('ДИРЕКТОР') || this.hasPermission('admin.all_rights');
    }

    // Перевірка чи користувач - директор (новий метод для ясності)
    isDirector() {
        return this.hasRole('ДИРЕКТОР');
    }

    // Вихід з системи
    async logout() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            // Очищуємо локальні дані незалежно від результату
            this.currentUser = null;
            this.stopSessionCheck();

            if (response.ok) {
                // Перенаправляємо на сторінку входу
                window.location.href = '/login.html';
            } else {
                // Навіть якщо запит не вдався, перенаправляємо
                window.location.href = '/login.html';
            }

        } catch (error) {
            if (typeof logError === 'function') {
                logError('Logout failed', 'LOGOUT_ERROR', error);
            }
            
            // Форсований вихід
            this.currentUser = null;
            this.stopSessionCheck();
            window.location.href = '/login.html';
        }
    }

    // Захист сторінки - перенаправлення на логін якщо не авторизований
    async requireAuth() {
        const isAuth = await this.isAuthenticated();
        if (!isAuth) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // Захист сторінки з перевіркою дозволів
    async requirePermission(permission) {
        const isAuth = await this.requireAuth();
        if (!isAuth) return false;

        if (!this.hasPermission(permission)) {
            this.showAccessDenied();
            return false;
        }
        return true;
    }

    // Захист сторінки з перевіркою ролі
    async requireRole(role) {
        const isAuth = await this.requireAuth();
        if (!isAuth) return false;

        if (!this.hasRole(role)) {
            this.showAccessDenied();
            return false;
        }
        return true;
    }

    // Захист адміністративних сторінок
    async requireAdmin() {
        const isAuth = await this.requireAuth();
        if (!isAuth) return false;

        if (!this.isAdmin()) {
            this.showAccessDenied();
            return false;
        }
        return true;
    }

    // Показ повідомлення про відмову в доступі
    showAccessDenied() {
        const message = 'У вас немає прав доступу до цієї сторінки';
        
        if (typeof showUserError === 'function') {
            showUserError(message);
        } else {
            alert(message);
        }
        
        // Перенаправляємо на головну сторінку
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }

    // Запуск автоматичної перевірки сесії
    startSessionCheck() {
        this.stopSessionCheck(); // Спочатку зупиняємо попередню перевірку
        
        this.checkInterval = setInterval(async () => {
            const isAuth = await this.checkSession();
            if (!isAuth) {
                // Сесія закінчилась, перенаправляємо на логін
                if (typeof showUserError === 'function') {
                    showUserError('Сесія закінчилась. Перенаправлення на сторінку входу...');
                }
                
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        }, this.sessionCheckInterval);
    }

    // Зупинка автоматичної перевірки сесії
    stopSessionCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Ініціалізація системи аутентифікації
    async init() {
        // Перевіряємо поточну сесію
        await this.checkSession();
        
        // Запускаємо автоматичну перевірку сесії
        this.startSessionCheck();
        
        return this.currentUser !== null;
    }

    // Отримання інформації про користувача для UI
    getUserInfo() {
        if (!this.currentUser) {
            return null;
        }

        return {
            id: this.currentUser.id,
            username: this.currentUser.username,
            email: this.currentUser.email,
            role: this.currentUser.role,
            roleLabel: this.getRoleLabel(this.currentUser.role),
            permissions: this.currentUser.permissions,
            isAdmin: this.isAdmin()
        };
    }

    // Отримання назви ролі українською
    getRoleLabel(role) {
        const roleLabels = {
            'ДИРЕКТОР': 'Директор',
            'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ': 'Завідуючий виробництвом',
            'БУХГАЛТЕР': 'Бухгалтер',
            'ПАКУВАЛЬНИК': 'Пакувальник',
            'КОМІРНИК': 'Комірник',
            'МЕНЕДЖЕР_З_ПРОДАЖІВ': 'Менеджер з продажів'
        };
        
        return roleLabels[role] || role;
    }

    // Створення елементу користувача для навігації
    createUserElement() {
        const userInfo = this.getUserInfo();
        if (!userInfo) return null;

        const userElement = document.createElement('div');
        userElement.className = 'user-info';
        userElement.innerHTML = `
            <div class="user-menu">
                <button class="user-button" onclick="toggleUserMenu()">
                    👤 ${userInfo.username} (${userInfo.roleLabel})
                </button>
                <div class="user-dropdown" id="user-dropdown">
                    <a href="#" onclick="showUserProfile()">👤 Профіль</a>
                    <a href="#" onclick="changePassword()">🔑 Змінити пароль</a>
                    ${userInfo.isAdmin ? '<a href="/admin/users.html">👥 Користувачі</a>' : ''}
                    <a href="#" onclick="authManager.logout()">🚪 Вийти</a>
                </div>
            </div>
        `;

        return userElement;
    }
}

// Глобальні функції для роботи з меню користувача
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function showUserProfile() {
    const userInfo = authManager.getUserInfo();
    if (userInfo) {
        alert(`Профіль користувача:\n\nІм'я: ${userInfo.username}\nEmail: ${userInfo.email || 'Не вказано'}\nРоль: ${userInfo.roleLabel}`);
    }
    toggleUserMenu();
}

function changePassword() {
    showChangePasswordModal();
    toggleUserMenu();
}

// Показ модального вікна зміни пароля
function showChangePasswordModal() {
    // Створюємо модальне вікно якщо воно не існує
    let modal = document.getElementById('change-password-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-password-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔑 Зміна пароля</h2>
                    <span class="close" onclick="closeChangePasswordModal()">&times;</span>
                </div>
                
                <form id="change-password-form">
                    <div id="change-password-error" class="error-message" style="display: none;"></div>
                    <div id="change-password-success" class="success-message" style="display: none;"></div>
                    
                    <div class="form-group">
                        <label for="current-password">Поточний пароль *</label>
                        <input type="password" id="current-password" name="currentPassword" required autocomplete="current-password">
                    </div>
                    
                    <div class="form-group">
                        <label for="new-password">Новий пароль *</label>
                        <input type="password" id="new-password" name="newPassword" required autocomplete="new-password" minlength="6">
                        <small>Мінімум 6 символів</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="confirm-password">Підтвердіть новий пароль *</label>
                        <input type="password" id="confirm-password" name="confirmPassword" required autocomplete="new-password">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeChangePasswordModal()">❌ Скасувати</button>
                        <button type="submit" class="btn btn-success" id="change-password-btn">🔑 Змінити пароль</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Додаємо обробник форми
        document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    }
    
    // Очищуємо форму та показуємо модальне вікно
    document.getElementById('change-password-form').reset();
    hideChangePasswordMessages();
    modal.style.display = 'block';
}

// Закриття модального вікна зміни пароля
function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обробка форми зміни пароля
async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Валідація
    if (newPassword !== confirmPassword) {
        showChangePasswordError('Паролі не співпадають');
        return;
    }
    
    if (newPassword.length < 6) {
        showChangePasswordError('Новий пароль повинен містити мінімум 6 символів');
        return;
    }
    
    if (currentPassword === newPassword) {
        showChangePasswordError('Новий пароль повинен відрізнятися від поточного');
        return;
    }
    
    try {
        setChangePasswordLoading(true);
        hideChangePasswordMessages();
        
        const response = await fetch(`${authManager.apiUrl}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showChangePasswordSuccess('Пароль успішно змінено');
            
            // Автоматично закриваємо модальне вікно через 2 секунди
            setTimeout(() => {
                closeChangePasswordModal();
            }, 2000);
            
        } else {
            let errorMessage = 'Помилка зміни пароля';
            
            if (data.error) {
                switch (data.error.code) {
                    case 'INVALID_CURRENT_PASSWORD':
                        errorMessage = 'Неправильний поточний пароль';
                        break;
                    case 'WEAK_PASSWORD':
                        errorMessage = 'Пароль занадто слабкий';
                        break;
                    case 'VALIDATION_ERROR':
                        errorMessage = data.error.message || 'Помилка валідації';
                        break;
                    default:
                        errorMessage = data.error.message || 'Помилка зміни пароля';
                }
            }
            
            showChangePasswordError(errorMessage);
        }
        
    } catch (error) {
        showChangePasswordError('Помилка з\'єднання з сервером');
        
        if (typeof logError === 'function') {
            logError('Change password request failed', 'CHANGE_PASSWORD_ERROR', error);
        }
    } finally {
        setChangePasswordLoading(false);
    }
}

// Показ помилки зміни пароля
function showChangePasswordError(message) {
    const errorDiv = document.getElementById('change-password-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Показ успіху зміни пароля
function showChangePasswordSuccess(message) {
    const successDiv = document.getElementById('change-password-success');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

// Приховування повідомлень
function hideChangePasswordMessages() {
    const errorDiv = document.getElementById('change-password-error');
    const successDiv = document.getElementById('change-password-success');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
}

// Встановлення стану завантаження
function setChangePasswordLoading(isLoading) {
    const btn = document.getElementById('change-password-btn');
    const form = document.getElementById('change-password-form');
    
    if (btn && form) {
        if (isLoading) {
            btn.disabled = true;
            btn.textContent = 'Зміна пароля...';
            form.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            btn.innerHTML = '🔑 Змінити пароль';
            form.style.opacity = '1';
        }
    }
}

// Закриття меню при кліку поза ним
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('user-dropdown');
    
    if (userMenu && dropdown && !userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Створюємо глобальний екземпляр
const authManager = new AuthManager();

// Експортуємо для використання
window.AuthManager = AuthManager;
window.authManager = authManager; 