// js/order-edit.js - JavaScript для редагування замовлень

class OrderEditor {
    constructor() {
        this.currentOrder = null;
        this.availableProducts = [];
        this.isEditing = false;
        this.eventListenersSetup = false; 
        this.formSubmitHandler = null;    
        this.addItemHandler = null;       
    }

    // Ініціалізація редактора
    async init() {
        console.log('OrderEditor initializing...');
        await this.loadProducts();
        this.setupEventListeners();
        console.log('OrderEditor initialized');
    }

    // Завантаження списку товарів
    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.availableProducts = await response.json();
            console.log('Products loaded:', this.availableProducts.length);
        } catch (error) {
            console.error('Помилка завантаження товарів:', error);
            this.showError('Помилка завантаження товарів: ' + error.message);
        }
    }

    // Налаштування обробників подій
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // ВИПРАВЛЕННЯ: Видаляємо старі обробники перед додаванням нових
        const self = this;
        
        // Обробник кліків для всього документу (тільки один раз)
        if (!this.eventListenersSetup) {
            document.body.addEventListener('click', function(e) {
                if (e.target.classList.contains('edit-order-btn')) {
                    console.log('=== EDIT BUTTON CLICKED ===');
                    const orderId = e.target.getAttribute('data-order-id');
                    console.log('Opening edit modal for order:', orderId);
                    self.openEditModal(orderId);
                }
            });
            
            this.eventListenersSetup = true;
            console.log('Global event listeners setup completed');
        }
    
        // Форма редагування
        const editForm = document.getElementById('editOrderForm');
        if (editForm) {
            // Видаляємо старий обробник якщо є
            editForm.removeEventListener('submit', this.formSubmitHandler);
            
            // Створюємо новий обробник
            this.formSubmitHandler = (e) => {
                e.preventDefault();
                this.saveOrder();
            };
            
            editForm.addEventListener('submit', this.formSubmitHandler);
            console.log('Form submit listener added');
        }
    
        // Кнопка додавання позиції
        const addItemBtn = document.getElementById('addOrderItemBtn');
        if (addItemBtn) {
            // Видаляємо старий обробник якщо є
            addItemBtn.removeEventListener('click', this.addItemHandler);
            
            // Створюємо новий обробник
            this.addItemHandler = () => {
                console.log('Add item button clicked');
                this.addOrderItem();
            };
            
            addItemBtn.addEventListener('click', this.addItemHandler);
            console.log('Add item button listener added');
        }
    }
    
    // Додати також метод для очищення обробників
    clearEventListeners() {
        const editForm = document.getElementById('editOrderForm');
        if (editForm && this.formSubmitHandler) {
            editForm.removeEventListener('submit', this.formSubmitHandler);
        }
        
        const addItemBtn = document.getElementById('addOrderItemBtn');
        if (addItemBtn && this.addItemHandler) {
            addItemBtn.removeEventListener('click', this.addItemHandler);
        }
    }

    // Відкриття модального вікна редагування
    async openEditModal(orderId) {
        console.log('=== openEditModal викликано ===');
        console.log('orderId:', orderId);
        
        try {
            this.isEditing = true;
            console.log('Відправляю запит до:', `/api/orders/${orderId}/edit`);
            
            // Завантажуємо дані замовлення
            const response = await fetch(`/api/orders/${orderId}/edit`);
            console.log('Відповідь отримано:', response);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Data received:', data);
            
            this.currentOrder = data.order;
            this.availableProducts = data.products || this.availableProducts;
            
            // Заповнюємо форму
            this.populateEditForm();
            
            // Показуємо модальне вікно
            this.openModal('editOrderModal');
            
        } catch (error) {
            console.error('Помилка відкриття форми редагування:', error);
            this.showError('Помилка завантаження замовлення: ' + error.message);
        }
    }

    // Заповнення форми даними замовлення
    populateEditForm() {
        console.log('Populating form with order:', this.currentOrder);
        
        if (!this.currentOrder) return;
    
        // Основні поля
        const orderNumberEl = document.getElementById('editOrderNumber');
        if (orderNumberEl) orderNumberEl.textContent = this.currentOrder.order_number;
        
        const clientNameEl = document.getElementById('editClientName');
        if (clientNameEl) clientNameEl.value = this.currentOrder.client_name || '';
        
        const clientContactEl = document.getElementById('editClientContact');
        if (clientContactEl) clientContactEl.value = this.currentOrder.client_contact || '';
        
        const deliveryDateEl = document.getElementById('editDeliveryDate');
        if (deliveryDateEl) deliveryDateEl.value = this.currentOrder.delivery_date || '';
        
        const statusEl = document.getElementById('editOrderStatus');
        if (statusEl) statusEl.value = this.currentOrder.status || 'NEW';
        
        const notesEl = document.getElementById('editOrderNotes');
        if (notesEl) notesEl.value = this.currentOrder.notes || '';
    
        // ВИПРАВЛЕННЯ: Повністю очищуємо контейнер позицій
        const itemsContainer = document.getElementById('editOrderItems');
        if (itemsContainer) {
            // Очищуємо контейнер
            itemsContainer.innerHTML = '';
            console.log('Items container cleared');
    
            // Додаємо позиції з замовлення
            if (this.currentOrder.items && this.currentOrder.items.length > 0) {
                console.log('Adding existing items:', this.currentOrder.items.length);
                this.currentOrder.items.forEach((item, index) => {
                    console.log(`Adding existing item ${index}:`, item);
                    this.addOrderItem(item);
                });
            } else {
                // Додаємо одну порожню позицію
                console.log('Adding empty item');
                this.addOrderItem();
            }
        }
    
        // Налаштовуємо обробники подій після додавання всіх позицій
        this.setupEventListeners();
    
        // Оновлюємо підсумки
        this.updateOrderTotals();
        
        console.log('Form populated successfully');
    }

    // Додавання позиції замовлення
    addOrderItem(existingItem = null, index = null) {
        const itemsContainer = document.getElementById('editOrderItems');
        if (!itemsContainer) return;
        
        // ВИПРАВЛЕННЯ: Правильно рахуємо індекс
        const itemIndex = itemsContainer.children.length;
        
        console.log('Adding order item with index:', itemIndex, 'existing:', existingItem);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item-row';
        itemDiv.dataset.index = itemIndex;
        
        // Генеруємо опції товарів
        const productOptions = this.availableProducts.map(product => {
            const isSelected = existingItem && existingItem.product_id == product.id;
            return `<option value="${product.id}" ${isSelected ? 'selected' : ''}>
                ${product.name} (${product.code})
            </option>`;
        }).join('');
    
        itemDiv.innerHTML = `
            <div class="item-row-content">
                <div class="form-group">
                    <label>Товар:</label>
                    <select name="items[${itemIndex}][product_id]" class="product-select" required>
                        <option value="">Оберіть товар</option>
                        ${productOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Кількість (шт):</label>
                    <input type="number" 
                           name="items[${itemIndex}][quantity]" 
                           class="quantity-input" 
                           min="1" 
                           value="${existingItem ? existingItem.quantity : ''}" 
                           required>
                </div>
                
                <div class="form-group">
                    <label>Коробки:</label>
                    <input type="number" 
                           class="boxes-display" 
                           readonly 
                           value="${existingItem ? Math.floor(existingItem.quantity / (existingItem.pieces_per_box || 1)) : 0}">
                </div>
                
                <div class="form-group">
                    <label>Примітки:</label>
                    <input type="text" 
                           name="items[${itemIndex}][notes]" 
                           value="${existingItem ? existingItem.notes || '' : ''}" 
                           placeholder="Примітки">
                </div>
                
                <div class="form-group">
                    <button type="button" class="btn btn-danger btn-small" onclick="orderEditor.removeOrderItem(this)">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        
        itemsContainer.appendChild(itemDiv);
        
        // ВИПРАВЛЕННЯ: Додаємо обробники подій тільки для нового елементу
        const select = itemDiv.querySelector('.product-select');
        const quantityInput = itemDiv.querySelector('.quantity-input');
        
        if (select) {
            select.addEventListener('change', () => {
                this.updateBoxesDisplay(select);
                this.updateOrderTotals();
            });
        }
        
        if (quantityInput) {
            quantityInput.addEventListener('input', () => {
                this.updateBoxesDisplay(select);
                this.updateOrderTotals();
            });
        }
        
        // Якщо це існуюча позиція, оновлюємо відображення коробок
        if (existingItem) {
            this.updateBoxesDisplay(select);
        }
        
        console.log('Order item added successfully');
    }

    // Видалення позиції замовлення
    removeOrderItem(button) {
        const itemRow = button.closest('.order-item-row');
        if (itemRow) {
            itemRow.remove();
            this.updateOrderTotals();
            this.reindexItems();
        }
    }

    // Переіндексація позицій після видалення
    reindexItems() {
        const itemRows = document.querySelectorAll('#editOrderItems .order-item-row');
        itemRows.forEach((row, index) => {
            row.dataset.index = index;
            const inputs = row.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (input.name) {
                    input.name = input.name.replace(/\[\d+\]/, `[${index}]`);
                }
            });
        });
    }

    // Обробка зміни товару
    onProductChange(selectElement) {
        this.updateBoxesDisplay(selectElement);
        this.updateOrderTotals();
    }

    // Оновлення відображення кількості коробок
    updateBoxesDisplay(productSelect) {
        const itemRow = productSelect.closest('.order-item-row');
        if (!itemRow) return;
        
        const quantityInput = itemRow.querySelector('.quantity-input');
        const boxesDisplay = itemRow.querySelector('.boxes-display');
        
        const productId = productSelect.value;
        const quantity = parseInt(quantityInput.value) || 0;
        
        if (productId && quantity > 0) {
            const product = this.availableProducts.find(p => p.id == productId);
            if (product) {
                const piecesPerBox = product.pieces_per_box || 1;
                const boxes = Math.floor(quantity / piecesPerBox);
                boxesDisplay.value = boxes;
            }
        } else {
            boxesDisplay.value = 0;
        }
    }

    // Оновлення підсумків замовлення
    updateOrderTotals() {
        const itemRows = document.querySelectorAll('#editOrderItems .order-item-row');
        let totalQuantity = 0;
        let totalBoxes = 0;
        
        itemRows.forEach(row => {
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput.value) || 0;
            totalQuantity += quantity;
            
            const boxesDisplay = row.querySelector('.boxes-display');
            const boxes = parseInt(boxesDisplay.value) || 0;
            totalBoxes += boxes;
        });
        
        // Оновлюємо відображення підсумків
        const totalQuantityEl = document.getElementById('editOrderTotalQuantity');
        const totalBoxesEl = document.getElementById('editOrderTotalBoxes');
        const totalItemsEl = document.getElementById('editOrderTotalItems');
        
        if (totalQuantityEl) totalQuantityEl.textContent = totalQuantity;
        if (totalBoxesEl) totalBoxesEl.textContent = totalBoxes;
        if (totalItemsEl) totalItemsEl.textContent = itemRows.length;
    }

    // Збереження замовлення
// Замінити метод saveOrder в order-edit.js
async saveOrder() {
    console.log('=== saveOrder method called ===');
    console.log('Current order:', this.currentOrder);
    
    try {
        if (!this.currentOrder) {
            console.log('No current order - throwing error');
            throw new Error('Немає активного замовлення для збереження');
        }

        console.log('Collecting form data...');
        
        // Збираємо основні дані з форми
        const orderData = {
            client_name: document.getElementById('editClientName')?.value || '',
            client_contact: document.getElementById('editClientContact')?.value || '',
            delivery_date: document.getElementById('editDeliveryDate')?.value || null,
            status: document.getElementById('editOrderStatus')?.value || 'NEW',
            notes: document.getElementById('editOrderNotes')?.value || '',
            items: []
        };
        
        console.log('Basic order data collected:', orderData);

        // Збираємо позиції замовлення
        const itemRows = document.querySelectorAll('#editOrderItems .order-item-row');
        console.log('Found item rows:', itemRows.length);
        
        itemRows.forEach((row, index) => {
            const productSelect = row.querySelector('.product-select');
            const quantityInput = row.querySelector('.quantity-input');
            const notesInput = row.querySelector('input[name*="[notes]"]');
            
            console.log(`Item ${index}:`, {
                productId: productSelect?.value,
                quantity: quantityInput?.value,
                notes: notesInput?.value
            });
            
            if (productSelect?.value && quantityInput?.value) {
                const item = {
                    product_id: parseInt(productSelect.value),
                    quantity: parseInt(quantityInput.value),
                    notes: notesInput?.value || ''
                };
                
                orderData.items.push(item);
                console.log(`Added item ${index}:`, item);
            }
        });

        console.log('Final order data:', orderData);

        // Валідація
        if (!orderData.client_name.trim()) {
            throw new Error('Назва клієнта обов\'язкова');
        }
        
        if (orderData.items.length === 0) {
            throw new Error('Замовлення повинно містити принаймні одну позицію');
        }

        console.log('Making PUT request to:', `/api/orders/${this.currentOrder.id}`);
        console.log('Request payload:', JSON.stringify(orderData, null, 2));

        // Відправляємо запит на оновлення
        const response = await fetch(`/api/orders/${this.currentOrder.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.log('Error data from server:', errorData);
            } catch (parseError) {
                console.log('Could not parse error response:', parseError);
            }
            
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Success response:', result);
        
        // Показуємо повідомлення про успіх
        this.showSuccess('Замовлення успішно оновлено!');
        
        // Закриваємо модальне вікно
        this.closeModal('editOrderModal');
        
        // Оновлюємо таблицю замовлень
        if (typeof loadOrders === 'function') {
            console.log('Calling loadOrders...');
            setTimeout(() => {
                loadOrders();
            }, 300);
        } else if (typeof window.refreshPageContent === 'function') {
            console.log('Calling refreshPageContent...');
            window.refreshPageContent();
        } else {
            console.log('Reloading page as fallback...');
            window.location.reload();
        }
        
        // Очищуємо стан редактора
        this.currentOrder = null;
        this.isEditing = false;
        
    } catch (error) {
        console.error('Помилка збереження замовлення:', error);
        this.showError('Помилка збереження замовлення: ' + error.message);
    }
}

    // Скасування редагування
    cancelEdit() {
        if (confirm('Ви впевнені, що хочете скасувати редагування? Всі незбережені зміни будуть втрачені.')) {
            this.closeModal('editOrderModal');
            this.currentOrder = null;
            this.isEditing = false;
        }
    }

    // Допоміжні функції для модальних вікон
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
    }

    // Функції для показу повідомлень
    showError(message) {
        if (typeof showUserError === 'function') {
            showUserError(message, 'error');
        } else if (typeof showAlert === 'function') {
            showAlert(message, 'error');
        } else {
            alert('Помилка: ' + message);
        }
    }

    showSuccess(message) {
        if (typeof showUserError === 'function') {
            showUserError(message, 'success');
        } else if (typeof showAlert === 'function') {
            showAlert(message, 'success');
        } else {
            alert(message);
        }
    }
}

// Створюємо глобальний екземпляр редактора
const orderEditor = new OrderEditor();

// Ініціалізуємо редактор після завантаження DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing orderEditor...');
    orderEditor.init();
});

// Функції для глобального використання
function openEditOrder(orderId) {
    orderEditor.openEditModal(orderId);
}

function cancelEditOrder() {
    orderEditor.cancelEdit();
}