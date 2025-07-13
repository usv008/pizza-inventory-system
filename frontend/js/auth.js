// frontend/js/auth.js - Модуль управління аутентифікацією (localStorage версія)

class AuthManager {
    constructor() {
        // FIX: Use dynamic API URL instead of hardcoded localhost
        this.apiUrl = window.location.origin + '/api';
        this.currentUser = null;
        this.storageKey = 'pizza_user';
    }

    // Перевірка поточної "сесії" через localStorage
    async checkSession() {
        try {
            const userData = localStorage.getItem(this.storageKey);
            
            if (userData) {
                const user = JSON.parse(userData);
                // Перевіряємо чи користувач ще активний в системі
                const response = await fetch(`${this.apiUrl}/auth/users`, {
                    credentials: 'include' // KEY FIX: Send session cookies
                });
                
                if (response.ok) {
                    const apiData = await response.json();
                    // Handle both array format and wrapper format
                    const users = Array.isArray(apiData) ? apiData : (apiData.data || []);
                    const activeUser = users.find(u => 
                        u.username === user.username && u.active === 1
                    );
                        
                    if (activeUser) {
                        this.currentUser = {
                            id: activeUser.id,
                            username: activeUser.username,
                            role: activeUser.role,
                            email: activeUser.email,
                            loginTime: user.loginTime
                        };
                        return true;
                    }
                }
            }
            
            // Якщо користувача немає або він неактивний - очищуємо localStorage
            this.currentUser = null;
            localStorage.removeItem(this.storageKey);
            return false;
            
        } catch (error) {
            console.error('Session check failed:', error);
            this.currentUser = null;
            localStorage.removeItem(this.storageKey);
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

    // Перевірка ролі користувача
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    // Перевірка чи користувач - адміністратор
    isAdmin() {
        return this.hasRole('ДИРЕКТОР');
    }

    // Перевірка чи користувач - директор
    isDirector() {
        const result = this.hasRole('ДИРЕКТОР');
        console.log('isDirector check:', {
            currentUser: this.currentUser,
            role: this.currentUser?.role,
            hasDirectorRole: result
        });
        return result;
    }

    // Вихід з системи
    async logout() {
        try {
            // Очищуємо локальні дані
            this.currentUser = null;
            localStorage.removeItem(this.storageKey);

            // Перенаправляємо на сторінку входу
            window.location.href = '/login.html';

        } catch (error) {
            console.error('Logout failed:', error);
            
            // Форсований вихід
            this.currentUser = null;
            localStorage.removeItem(this.storageKey);
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

    // Ініціалізація менеджера авторизації
    async init() {
        // Перевіряємо поточну сесію при ініціалізації
        await this.checkSession();
        
        // Додаємо інформацію про користувача в навігацію
        this.updateUserDisplay();
        
        return this.currentUser !== null;
    }

    // Оновлення відображення користувача в навігації
    updateUserDisplay() {
        const userInfo = document.getElementById('user-info');
        if (userInfo && this.currentUser) {
            userInfo.innerHTML = `
                <div class="user-menu">
                    <button class="user-button" onclick="toggleUserMenu()">
                        👤 ${this.currentUser.username} ▼
                    </button>
                    <div class="user-dropdown" id="user-dropdown">
                        <a href="#" onclick="showProfileModal(); return false;">
                            👤 Профіль
                        </a>
                        <a href="#" onclick="showChangePasswordModal(); return false;">
                            🔑 Змінити пароль
                        </a>
                        <a href="#" onclick="authManager.logout(); return false;">
                            🚪 Вихід
                        </a>
                    </div>
                </div>
            `;
        }
        
        // Оновлюємо навігацію для директорів
        if (typeof window.navigation !== 'undefined') {
            window.navigation.addAdminNavItems();
        }
    }

    // Отримання інформації про користувача для відображення
    getUserInfo() {
        if (!this.currentUser) {
            return null;
        }
        
        return {
            username: this.currentUser.username,
            role: this.currentUser.role,
            email: this.currentUser.email,
            loginTime: this.currentUser.loginTime
        };
    }

    // Отримання читабельної назви ролі
    getRoleLabel(role) {
        const roleLabels = {
            'ДИРЕКТОР': 'Директор',
            'БУХГАЛТЕР': 'Бухгалтер', 
            'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ': 'Завідуючий виробництвом',
            'ПРАЦІВНИК_СКЛАДУ': 'Працівник складу'
        };
        
        return roleLabels[role] || role;
    }

    // Створення елементу користувача для навігації
    createUserElement() {
        if (!this.currentUser) {
            return null;
        }

        const userElement = document.createElement('div');
        userElement.className = 'user-menu';
        userElement.innerHTML = `
            <button class="user-button" onclick="toggleUserMenu()">
                👤 ${this.currentUser.username} ▼
            </button>
            <div class="user-dropdown" id="user-dropdown">
                <a href="#" onclick="showProfileModal(); return false;">
                    👤 Профіль
                </a>
                <a href="#" onclick="showChangePasswordModal(); return false;">
                    🔑 Змінити пароль
                </a>
                <a href="#" onclick="authManager.logout(); return false;">
                    🚪 Вихід
                </a>
            </div>
        `;
        
        return userElement;
    }
}

// Створюємо глобальний екземпляр менеджера авторизації
const authManager = new AuthManager();
window.authManager = authManager;

// Автоматична ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', function() {
    authManager.init();
});

// Функції для сумісності з існуючим кодом
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function showUserProfile() {
    if (authManager.currentUser) {
        // Закриваємо dropdown
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
        
        // Показуємо модальне вікно профілю
        showProfileModal();
    }
}

function changePassword() {
    // Закриваємо dropdown
    const dropdown = document.getElementById('user-dropdown-content');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    // Показуємо модальне вікно зміни пароля
    showChangePasswordModal();
}

// Функція для показу профілю користувача
function showProfileModal() {
    const user = authManager.currentUser;
    if (!user) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>👤 Профіль користувача</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="profile-info">
                    <div class="form-group">
                        <label>Користувач:</label>
                        <span class="profile-value">${user.username}</span>
                    </div>
                    <div class="form-group">
                        <label>Роль:</label>
                        <span class="profile-value">${authManager.getRoleLabel(user.role)}</span>
                    </div>
                    ${user.email ? `
                        <div class="form-group">
                            <label>Email:</label>
                            <span class="profile-value">${user.email}</span>
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label>Час входу:</label>
                        <span class="profile-value">${new Date(user.loginTime).toLocaleString('uk-UA')}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="changePassword()">🔑 Змінити пароль</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">❌ Закрити</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// Функція для зміни пароля
function showChangePasswordModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔑 Зміна пароля</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <form id="change-password-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="current-password">Поточний пароль *</label>
                        <input type="password" id="current-password" name="current-password" required>
                    </div>
                    <div class="form-group">
                        <label for="new-password">Новий пароль *</label>
                        <input type="password" id="new-password" name="new-password" required minlength="6">
                        <small>Мінімум 6 символів</small>
                    </div>
                    <div class="form-group">
                        <label for="confirm-password">Підтвердити пароль *</label>
                        <input type="password" id="confirm-password" name="confirm-password" required>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-success">💾 Зберегти</button>
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">❌ Скасувати</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Обробка форми
    document.getElementById('change-password-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            alert('Паролі не співпадають');
            return;
        }
        
        try {
            // Відправляємо запит на зміну пароля
            const response = await fetch(`${authManager.apiUrl}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert('✅ Пароль успішно змінено!');
                modal.remove();
            } else {
                alert('❌ Помилка: ' + (result.error?.details || result.error?.message || 'Невідома помилка'));
            }
        } catch (error) {
            console.error('Error changing password:', error);
            alert('❌ Помилка з\'єднання з сервером');
        }
    });
}

// Закриття dropdown при кліку поза ним
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown');
    const userButton = document.querySelector('.user-button');
    
    if (dropdown && userButton && !userButton.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});
