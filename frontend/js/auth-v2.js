// frontend/js/auth.js - Модуль управління аутентифікацією (localStorage версія)

class AuthManager {
    constructor() {
        this.apiUrl = 'http://localhost:3000/api';
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
                const response = await fetch(`${this.apiUrl}/auth/users`);
                
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
        return this.hasRole('ДИРЕКТОР');
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
                    <span class="user-name">👤 ${this.currentUser.username}</span>
                    <span class="user-role">(${this.currentUser.role})</span>
                    <button onclick="authManager.logout()" class="btn btn-secondary btn-small">Вихід</button>
                </div>
            `;
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
            <span class="user-name">👤 ${this.currentUser.username}</span>
            <span class="user-role">(${this.currentUser.role})</span>
            <button onclick="authManager.logout()" class="btn btn-secondary btn-small">Вихід</button>
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
    // Базова функція для сумісності
    console.log('User menu toggle');
}

function showUserProfile() {
    if (authManager.currentUser) {
        alert(`Користувач: ${authManager.currentUser.username}\nРоль: ${authManager.currentUser.role}`);
    }
}

function changePassword() {
    alert('Функція зміни пароля поки не реалізована');
}
