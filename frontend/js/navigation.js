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
    init(currentPage = '') {
        if (this.initialized) {
            return; // Запобігаємо подвійній ініціалізації
        }

        try {
            // Підключаємо стилі навігації
            this.loadNavigationStyles();
            
            // Створюємо та вставляємо навігацію
            const navHTML = this.createNavHTML(currentPage);
            
            // Перевіряємо чи навігація вже існує
            if (safeQuerySelector('.header')) {
                logError('Navigation already exists', 'NAVIGATION_DUPLICATE');
                return;
            }
            
            // Вставляємо на початок body
            document.body.insertAdjacentHTML('afterbegin', navHTML);
            
            // Додаємо відступ до основного контенту
            this.adjustContentMargin();
            
            this.initialized = true;
            
        } catch (error) {
            logError('Failed to initialize navigation', 'NAVIGATION_INIT_ERROR', error);
            showUserError('Помилка завантаження навігації');
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
                    logError(`Failed to load CSS: ${filename}`, 'CSS_LOAD_ERROR');
                };
                
                document.head.appendChild(link);
            }
        });
    }

    // Додаємо відступ до основного контенту
    adjustContentMargin() {
        const firstElement = safeQuerySelector('.header + *');
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
        logError('Failed to refresh page', 'REFRESH_ERROR', error);
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
        nav.init();
        
    } catch (error) {
        logError('Auto navigation initialization failed', 'AUTO_NAV_ERROR', error);
    }
});