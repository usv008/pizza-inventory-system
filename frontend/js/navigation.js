// frontend/js/navigation.js - Виправлений компонент навігації

class PizzaNavigation {
    constructor() {
        this.navItems = [
            { 
                href: '/', 
                icon: '🏠', 
                text: 'Головна',
                id: 'home'
            },
            { 
                href: '/admin.html', 
                icon: '⚙️', 
                text: 'Товари',
                id: 'admin'
            },
            { 
                href: '/inventory.html', 
                icon: '📦', 
                text: 'Запаси',
                id: 'inventory'
            },
            { 
                href: '/orders.html', 
                icon: '📋', 
                text: 'Замовлення',
                id: 'orders'
            },
            { 
                href: '/operations.html', 
                icon: '📊', 
                text: 'Операції',
                id: 'operations'
            }
            // Видалено production-planning
        ];
        this.initialized = false;
    }

    // Створюємо HTML структуру навігації
    createNavHTML(currentPage = '') {
        const navItemsHTML = this.navItems.map(item => {
            const isActive = this.isCurrentPage(item.href, currentPage) ? 'active' : '';
            return `<a href="${item.href}" class="${isActive}">${item.icon} ${item.text}</a>`;
        }).join('');

        return `
            <div class="header">
                <nav class="nav">
                    <h1>🍕 Pizza Inventory System</h1>
                    <div class="nav-links">
                        ${navItemsHTML}
                        <a href="#" onclick="refreshPage()">🔄 Оновити</a>
                        <div id="user-nav-placeholder"></div>
                    </div>
                </nav>
            </div>
        `;
    }

    // Визначаємо поточну сторінку
    isCurrentPage(href, currentPage) {
        if (currentPage) {
            return currentPage === href;
        }
        
        const currentPath = window.location.pathname;
        
        if (href === '/' && (currentPath === '/' || currentPath === '/index.html')) {
            return true;
        }
        
        return currentPath === href;
    }

    // Ініціалізуємо навігацію на сторінці
    async init(currentPage = '') {
        if (this.initialized) {
            return; // Запобігаємо подвійній ініціалізації
        }

        try {
            // Підключаємо стилі навігації
            this.loadNavigationStyles();
            
            // Створюємо та вставляємо навігацію
            const navHTML = this.createNavHTML(currentPage);
            
            // Перевіряємо чи навігація вже існує
            if (document.querySelector('.header')) {
                return; // Тиха перевірка без логування
            }
            
            // Вставляємо на початок body
            document.body.insertAdjacentHTML('afterbegin', navHTML);
            
            // Додаємо відступ до основного контенту
            this.adjustContentMargin();
            
            // Ініціалізуємо аутентифікацію та додаємо користувача в навігацію
            await this.initAuth();
            
            this.initialized = true;
            
        } catch (error) {
            if (typeof logError === 'function') {
                logError('Failed to initialize navigation', 'NAVIGATION_INIT_ERROR', error);
            } else {
                console.error('Navigation init error:', error);
            }
            
            if (typeof showUserError === 'function') {
                showUserError('Помилка завантаження навігації');
            } else {
                console.warn('Navigation error: Помилка завантаження навігації');
            }
        }
    }

    // Ініціалізація аутентифікації
    async initAuth() {
        console.log('🔧 initAuth() called');
        
        // Перевіряємо чи доступний authManager
        if (typeof authManager !== 'undefined') {
            console.log('✅ authManager is available');
            try {
                // Чекаємо завершення ініціалізації authManager
                console.log('🔄 Calling authManager.init()...');
                const isAuthenticated = await authManager.init();
                console.log('Auth initialization completed, isAuthenticated:', isAuthenticated);
                
                if (isAuthenticated) {
                    console.log('✅ User is authenticated, adding admin nav items...');
                    // Додаємо адміністративні пункти меню для директорів
                    this.addAdminNavItems();
                    
                    // Додаємо користувача в навігацію
                    this.addUserToNavigation();
                } else {
                    console.log('❌ User not authenticated, skipping admin nav items');
                }
            } catch (error) {
                console.log('❌ Auth initialization failed:', error);
            }
        } else {
            console.log('❌ authManager not available');
        }
    }

    // Додавання адміністративних пунктів навігації
    addAdminNavItems() {
        console.log('🔧 addAdminNavItems called');
        console.log('authManager defined:', typeof authManager !== 'undefined');
        
        if (typeof authManager !== 'undefined') {
            const currentUser = authManager.getCurrentUser();
            console.log('currentUser:', currentUser);
            
            // Перевіряємо чи користувач завантажений
            if (!currentUser) {
                console.log('❌ User not loaded yet, skipping admin nav items');
                return;
            }
            
            console.log('✅ User loaded, checking if director...');
            console.log('User role:', currentUser.role);
            
            // Перевіряємо чи користувач директор
            const isDirector = authManager.isDirector();
            console.log('isDirector result:', isDirector);
            
            // Кнопка "Користувачі" доступна тільки для директорів
            if (isDirector) {
                console.log('✅ User is director, adding users button...');
                
                // Додаємо кнопку "Користувачі" для директорів
                const usersItem = {
                    href: '/admin/users.html',
                    icon: '👥',
                    text: 'Користувачі',
                    id: 'users'
                };
                
                // Перевіряємо чи пункт ще не додано
                const exists = this.navItems.some(item => item.id === 'users');
                console.log('Users item exists:', exists);
                
                if (!exists) {
                    // Додаємо перед кнопкою "Оновити"
                    this.navItems.push(usersItem);
                    console.log('✅ Added users item to navigation for director');
                    console.log('Current navItems:', this.navItems);
                    
                    // Оновлюємо навігацію
                    this.updateNavigation();
                } else {
                    console.log('ℹ️ Users item already exists in navigation');
                }
            } else {
                console.log('❌ User is not director, removing users button if exists...');
                
                // Видаляємо кнопку якщо користувач не директор
                const existingIndex = this.navItems.findIndex(item => item.id === 'users');
                if (existingIndex !== -1) {
                    this.navItems.splice(existingIndex, 1);
                    console.log('✅ Removed users item from navigation - user is not director');
                    this.updateNavigation();
                } else {
                    console.log('ℹ️ Users item not found to remove');
                }
            }
        } else {
            console.log('❌ authManager not available in addAdminNavItems');
        }
    }

    // Оновлення навігації після додавання нових пунктів
    updateNavigation() {
        const navLinksContainer = document.querySelector('.nav-links');
        if (navLinksContainer) {
            // Зберігаємо користувача та кнопку оновити
            const userPlaceholder = document.getElementById('user-nav-placeholder');
            const refreshButton = navLinksContainer.querySelector('a[onclick="refreshPage()"]');
            
            // Очищуємо контейнер
            navLinksContainer.innerHTML = '';
            
            // Додаємо всі пункти навігації
            this.navItems.forEach(item => {
                const isActive = this.isCurrentPage(item.href) ? 'active' : '';
                const link = document.createElement('a');
                link.href = item.href;
                link.className = isActive;
                link.innerHTML = `${item.icon} ${item.text}`;
                navLinksContainer.appendChild(link);
            });
            
            // Повертаємо кнопку оновити
            if (refreshButton) {
                navLinksContainer.appendChild(refreshButton);
            } else {
                const newRefreshButton = document.createElement('a');
                newRefreshButton.href = '#';
                newRefreshButton.onclick = refreshPage;
                newRefreshButton.innerHTML = '🔄 Оновити';
                navLinksContainer.appendChild(newRefreshButton);
            }
            
            // Повертаємо placeholder для користувача
            if (userPlaceholder) {
                navLinksContainer.appendChild(userPlaceholder);
            } else {
                const newPlaceholder = document.createElement('div');
                newPlaceholder.id = 'user-nav-placeholder';
                navLinksContainer.appendChild(newPlaceholder);
                
                // Додаємо користувача знову
                this.addUserToNavigation();
            }
        }
    }

    // Додавання користувача в навігацію
    addUserToNavigation() {
        const placeholder = document.getElementById('user-nav-placeholder');
        if (placeholder && typeof authManager !== 'undefined') {
            const userElement = authManager.createUserElement();
            if (userElement) {
                placeholder.appendChild(userElement);
            }
        }
    }

    // Підключаємо CSS файли
    loadNavigationStyles() {
        const stylesheets = [
            'main.css',
            'navigation.css', 
            'buttons.css',
            'forms.css',
            'tables.css',
            'modals-tabs.css',
            'batches.css',
            'arrivals.css'
        ];
        
        stylesheets.forEach(filename => {
            const id = filename.replace('.css', '') + '-styles';
            
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = `/styles/${filename}`;
                
                // Обробка помилок завантаження CSS
                link.onerror = () => {
                    if (typeof logError === 'function') {
                        logError(`Failed to load CSS: ${filename}`, 'CSS_LOAD_ERROR');
                    } else {
                        console.error(`Failed to load CSS: ${filename}`);
                    }
                };
                
                document.head.appendChild(link);
            }
        });
    }

    // Додаємо відступ до основного контенту
    adjustContentMargin() {
        const firstElement = document.querySelector('.header + *');
        if (firstElement && !firstElement.style.marginTop) {
            firstElement.style.marginTop = '0';
        }
    }

    // Додаємо новий пункт навігації
    addNavItem(href, icon, text, id, position = -1) {
        const newItem = { href, icon, text, id };
        
        if (position === -1 || position >= this.navItems.length) {
            this.navItems.push(newItem);
        } else {
            this.navItems.splice(position, 0, newItem);
        }
    }

    // Видаляємо пункт навігації
    removeNavItem(id) {
        this.navItems = this.navItems.filter(item => item.id !== id);
    }
}

// Покращена функція оновлення сторінки
function refreshPage() {
    try {
        // Спробуємо викликати специфічну функцію оновлення сторінки
        if (typeof window.refreshPageContent === 'function') {
            window.refreshPageContent();
        } else {
            // Fallback до перезагрузки
            window.location.reload();
        }
    } catch (error) {
        if (typeof logError === 'function') {
            logError('Failed to refresh page', 'REFRESH_ERROR', error);
        } else {
            console.error('Refresh page error:', error);
        }
        // Форсована перезагрузка у випадку помилки
        window.location.reload();
    }
}

// Експортуємо для використання
window.PizzaNavigation = PizzaNavigation;

// Безпечна автоматична ініціалізація
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Перевіряємо чи не заборонена автоініціалізація
        if (window.skipAutoNavigation) {
            return;
        }
        
        // Перевіряємо чи навігація вже існує
        if (document.querySelector('.header')) {
          return; // Тиха перевірка без логування
        }
        
        // Ініціалізуємо навігацію
        const nav = new PizzaNavigation();
        window.navigation = nav; // Експортуємо в глобальну область
        nav.init();
        
    } catch (error) {
        logError('Auto navigation initialization failed', 'AUTO_NAV_ERROR', error);
    }
});