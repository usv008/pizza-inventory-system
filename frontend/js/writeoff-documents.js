/**
 * Writeoff Documents JavaScript
 * Manages group writeoff functionality
 */

// Global variables
let documentItems = [];
let itemCounter = 0;
let allProducts = [];

// Make functions globally available
window.addDocumentItem = addDocumentItem;
window.removeDocumentItem = removeDocumentItem;
window.clearDocumentForm = clearDocumentForm;
window.viewDocumentDetails = viewDocumentDetails;
window.closeDocumentDetailsModal = closeDocumentDetailsModal;
window.applyDocumentsFilter = applyDocumentsFilter;
window.clearDocumentsFilter = clearDocumentsFilter;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('inventory.html')) {
        initializeWriteoffDocuments();
        
        // Register tab handler for writeoff-documents tab
        if (!window._tabHandlers) {
            window._tabHandlers = {};
        }
        window._tabHandlers['writeoff-documents'] = function() {
            console.log('📄 Writeoff documents tab activated');
            loadWriteoffDocuments();
        };
    }
});

/**
 * Initialize writeoff documents functionality
 */
async function initializeWriteoffDocuments() {
    console.log('🚀 Initializing writeoff documents...');
    console.log('📍 Current location:', window.location.pathname);
    console.log('📍 DOM ready state:', document.readyState);
    
    try {
        // Load products for selects
        await loadProductsForDocuments();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const docDateInput = document.getElementById('doc-date');
        if (docDateInput) {
            docDateInput.value = today;
            // Update document number preview when date changes
            docDateInput.addEventListener('change', updateDocumentNumberPreview);
            updateDocumentNumberPreview();
        }
        
        // Add first item by default
        addDocumentItem();
        
        // Setup form submission
        const form = document.getElementById('writeoff-document-form');
        if (form) {
            form.addEventListener('submit', handleDocumentSubmit);
        }
        
        // Load initial history
        await loadWriteoffDocuments();
        
        console.log('✅ Writeoff documents initialized');
        
    } catch (error) {
        console.error('❌ Error initializing writeoff documents:', error);
    }
}

/**
 * Load products for document items
 */
async function loadProductsForDocuments() {
    try {
        console.log('📦 Завантажую товари для документів...');
        const result = await window.apiHelper.get('/products');
        // Обробляємо формат відповіді
        allProducts = result.success ? result.data : result;
        console.log(`✅ Завантажено ${allProducts.length} товарів`);
    } catch (error) {
        console.error('❌ Помилка завантаження товарів:', error);
        showUserError('Помилка завантаження товарів: ' + error.message);
    }
}

/**
 * Add new document item
 */
function addDocumentItem() {
    itemCounter++;
    const itemId = `item-${itemCounter}`;
    
    const itemHtml = `
        <div class="document-item" id="${itemId}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: #f9f9f9;">
            <div class="form-grid">
                <div class="form-group">
                    <label for="${itemId}-product">Товар *</label>
                    <select id="${itemId}-product" name="product_id" required onchange="loadItemBatches('${itemId}')">
                        <option value="">Оберіть товар...</option>
                        ${allProducts.map(product => 
                            `<option value="${product.id}">${product.name} (${product.code})</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="${itemId}-batch">Партія *</label>
                    <select id="${itemId}-batch" name="batch_id" required disabled onchange="updateItemBatchInfo('${itemId}')">
                        <option value="">Спочатку оберіть товар</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="${itemId}-quantity">Кількість (шт) *</label>
                    <input type="number" id="${itemId}-quantity" name="quantity" min="1" required oninput="validateItemQuantity('${itemId}')">
                    <small id="${itemId}-available" style="color: #7f8c8d; display: block; margin-top: 0.25rem;"></small>
                </div>
                <div class="form-group">
                    <label for="${itemId}-notes">Примітки до позиції</label>
                    <input type="text" id="${itemId}-notes" name="notes" placeholder="Додаткова інформація...">
                </div>
                <div class="form-group" style="display: flex; align-items: end;">
                    <button type="button" class="btn btn-danger" onclick="removeDocumentItem('${itemId}')" style="margin-bottom: 0;">🗑️ Видалити</button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('document-items');
    container.insertAdjacentHTML('beforeend', itemHtml);
    
    console.log(`➕ Added document item: ${itemId}`);
}

/**
 * Remove document item
 */
function removeDocumentItem(itemId) {
    const itemElement = document.getElementById(itemId);
    if (itemElement) {
        itemElement.remove();
        console.log(`🗑️ Removed document item: ${itemId}`);
    }
    
    // Ensure at least one item remains
    const remainingItems = document.querySelectorAll('.document-item');
    if (remainingItems.length === 0) {
        addDocumentItem();
    }
}

/**
 * Load batches for selected product in item
 */
async function loadItemBatches(itemId) {
    const productSelect = document.getElementById(`${itemId}-product`);
    const batchSelect = document.getElementById(`${itemId}-batch`);
    const availableSpan = document.getElementById(`${itemId}-available`);
    const quantityInput = document.getElementById(`${itemId}-quantity`);
    
    if (!productSelect || !batchSelect || !availableSpan) return;
    
    const productId = productSelect.value;
    if (!productId) {
        batchSelect.innerHTML = '<option value="">Спочатку оберіть товар</option>';
        batchSelect.disabled = true;
        availableSpan.textContent = '';
        quantityInput.value = '';
        quantityInput.max = '';
        return;
    }
    
    try {
        batchSelect.innerHTML = '<option value="">Завантаження партій...</option>';
        batchSelect.disabled = true;
        availableSpan.textContent = 'Завантаження...';
        
        console.log(`🔄 Завантажую партії для товару ${productId}...`);
        const batches = await window.apiHelper.get(`/products/${productId}/batches?includeExpired=true`);
        console.log(`✅ Завантажено ${batches.length} партій`);
        const activeBatches = batches.filter(b => b.available_quantity > 0);
        
        batchSelect.innerHTML = '<option value="">Оберіть партію...</option>';
        
        if (activeBatches.length === 0) {
            batchSelect.innerHTML = '<option value="">Немає доступних партій</option>';
            batchSelect.disabled = true;
            availableSpan.textContent = 'Немає доступних партій';
            availableSpan.style.color = '#dc3545';
            return;
        }
        
        activeBatches.sort((a, b) => {
            if (a.is_expired && !b.is_expired) return -1;
            if (!a.is_expired && b.is_expired) return 1;
            if (a.is_expiring && !b.is_expiring) return -1;
            if (!a.is_expiring && b.is_expiring) return 1;
            return new Date(a.batch_date) - new Date(b.batch_date);
        });
        
        activeBatches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch.id;
            const batchDate = new Date(batch.batch_date).toLocaleDateString('uk-UA');
            
            if (batch.is_expired || batch.days_to_expiry <= 0) {
                option.textContent = `${batchDate} - ${batch.available_quantity} шт ❌ ПРОСТРОЧЕНА`;
                option.style.color = '#e74c3c';
                option.style.fontWeight = 'bold';
            } else if (batch.is_expiring || batch.days_to_expiry <= 7) {
                option.textContent = `${batchDate} - ${batch.available_quantity} шт ⚠️ ${Math.ceil(batch.days_to_expiry)} дн.`;
                option.style.color = '#f39c12';
                option.style.fontWeight = 'bold';
            } else {
                option.textContent = `${batchDate} - ${batch.available_quantity} шт ✅ Активна`;
                option.style.color = '#27ae60';
            }
            
            option.setAttribute('data-available', batch.available_quantity);
            option.setAttribute('data-batch-date', batch.batch_date);
            option.setAttribute('data-status', batch.batch_status || (batch.is_expired ? 'EXPIRED' : batch.is_expiring ? 'EXPIRING' : 'ACTIVE'));
            
            batchSelect.appendChild(option);
        });
        
        batchSelect.disabled = false;
        availableSpan.textContent = '';
        
    } catch (error) {
        console.error('❌ Помилка завантаження партій:', error);
        batchSelect.innerHTML = '<option value="">Помилка завантаження партій</option>';
        batchSelect.disabled = true;
        availableSpan.textContent = 'Помилка завантаження партій';
        availableSpan.style.color = '#dc3545';
        showMessage('Помилка завантаження партій: ' + error.message, 'error');
    }
}

/**
 * Update batch info when batch is selected
 */
function updateItemBatchInfo(itemId) {
    const batchSelect = document.getElementById(`${itemId}-batch`);
    const availableSpan = document.getElementById(`${itemId}-available`);
    const quantityInput = document.getElementById(`${itemId}-quantity`);
    
    if (!batchSelect || !availableSpan || !quantityInput) return;
    
    const selectedOption = batchSelect.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        const available = selectedOption.getAttribute('data-available');
        availableSpan.textContent = `Доступно в партії: ${available} шт`;
        availableSpan.style.color = '#28a745';
        
        // Встановлюємо максимальну кількість
        quantityInput.max = available;
        
        // Очищуємо кількість щоб користувач ввів нову
        quantityInput.value = '';
    } else {
        availableSpan.textContent = '';
        quantityInput.max = '';
        quantityInput.value = '';
    }
}

/**
 * Validate item quantity against available stock
 */
function validateItemQuantity(itemId) {
    const quantityInput = document.getElementById(`${itemId}-quantity`);
    const availableSpan = document.getElementById(`${itemId}-available`);
    
    if (!quantityInput || !availableSpan) return;
    
    const max = parseInt(quantityInput.max);
    const value = parseInt(quantityInput.value);
    
    if (max && value > max) {
        quantityInput.setCustomValidity(`Максимальна кількість: ${max} шт`);
        availableSpan.textContent = `❌ Перевищено доступну кількість (${max} шт)`;
        availableSpan.style.color = '#e74c3c';
    } else {
        quantityInput.setCustomValidity('');
        if (max) {
            availableSpan.textContent = `Доступно в партії: ${max} шт`;
            availableSpan.style.color = '#28a745';
        }
    }
}

/**
 * Update document number preview
 */
async function updateDocumentNumberPreview() {
    const dateInput = document.getElementById('doc-date');
    const previewInput = document.getElementById('doc-number-preview');
    
    if (!dateInput || !previewInput) return;
    
    const date = dateInput.value;
    if (!date) {
        previewInput.value = '';
        return;
    }
    
    try {
        previewInput.value = 'Генерація...';
        
        console.log(`🔄 Запитую попередній номер для дати ${date}`);
        const result = await window.apiHelper.get(`/writeoff-documents/preview-number?date=${date}`);
        
        if (result.success) {
            previewInput.value = result.data.document_number;
            console.log('✅ Отриманий номер:', result.data.document_number);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Помилка генерації номеру:', error);
        previewInput.value = 'Помилка генерації';
    }
}

/**
 * Clear document form
 */
function clearDocumentForm() {
    // Clear header fields
    document.getElementById('doc-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('doc-responsible').value = '';
    document.getElementById('doc-reason').value = '';
    document.getElementById('doc-notes').value = '';
    
    // Clear all items and add one fresh item
    const container = document.getElementById('document-items');
    container.innerHTML = '';
    
    // Reset global variables
    documentItems = [];
    itemCounter = 0;
    
    // Add fresh item
    addDocumentItem();
    
    // Update document number preview
    updateDocumentNumberPreview();
    
    console.log('🔄 Document form cleared');
}

/**
 * Collect document data from form
 */
function collectDocumentData() {
    try {
        // Collect header data
        const dateEl = document.getElementById('doc-date');
        const responsibleEl = document.getElementById('doc-responsible');
        const reasonEl = document.getElementById('doc-reason');
        const notesEl = document.getElementById('doc-notes');
        
        if (!dateEl || !responsibleEl || !reasonEl || !notesEl) {
            throw new Error('Не знайдено елементи форми документу');
        }
        
        const documentData = {
            writeoff_date: dateEl.value,
            responsible: responsibleEl.value,
            reason: reasonEl.value,
            notes: notesEl.value || ''
        };
        
        // Collect items data
        const items = [];
        const itemElements = document.querySelectorAll('.document-item');
        
        itemElements.forEach((itemElement) => {
            const productSelect = itemElement.querySelector('select[name="product_id"]');
            const batchSelect = itemElement.querySelector('select[name="batch_id"]');
            const quantityInput = itemElement.querySelector('input[name="quantity"]');
            const notesInput = itemElement.querySelector('input[name="notes"]');
            
            if (productSelect && batchSelect && quantityInput && 
                productSelect.value && batchSelect.value && quantityInput.value) {
                
                // Отримуємо дату партії з обраної опції
                const selectedBatchOption = batchSelect.selectedOptions[0];
                const batchDate = selectedBatchOption ? selectedBatchOption.getAttribute('data-batch-date') : null;
                
                items.push({
                    product_id: parseInt(productSelect.value),
                    batch_id: parseInt(batchSelect.value),
                    batch_date: batchDate,
                    quantity: parseInt(quantityInput.value),
                    notes: notesInput ? notesInput.value || '' : ''
                });
            }
        });
        
        return { documentData, items };
        
    } catch (error) {
        console.error('❌ Error collecting document data:', error);
        throw new Error('Помилка збору даних форми: ' + error.message);
    }
}

/**
 * Validate document data
 */
function validateDocumentData(documentData, items) {
    const errors = [];
    
    // Validate header
    if (!documentData.writeoff_date) {
        errors.push('Дата списання обов\'язкова');
    }
    
    if (!documentData.responsible || documentData.responsible.trim().length < 2) {
        errors.push('Відповідальний обов\'язковий (мінімум 2 символи)');
    }
    
    if (!documentData.reason) {
        errors.push('Причина списання обов\'язкова');
    }
    
    // Validate items
    if (items.length === 0) {
        errors.push('Додайте хоча б одну позицію до документу');
    }
    
    items.forEach((item, index) => {
        if (!item.product_id) {
            errors.push(`Позиція ${index + 1}: оберіть товар`);
        }
        
        if (!item.batch_id) {
            errors.push(`Позиція ${index + 1}: оберіть партію`);
        }
        
        if (!item.quantity || item.quantity <= 0) {
            errors.push(`Позиція ${index + 1}: кількість повинна бути більше 0`);
        }
        
        // Additional validation will be done on the server side for batch availability
    });
    
    return errors;
}

/**
 * Handle document form submission
 */
async function handleDocumentSubmit(event) {
    event.preventDefault();
    
    try {
        console.log('📄 Відправляю документ списання...');
        
        const { documentData, items } = collectDocumentData();
        
        const errors = validateDocumentData(documentData, items);
        if (errors.length > 0) {
            showUserError('Помилки валідації:\n• ' + errors.join('\n• '));
            return;
        }
        
        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = '⏳ Створення документу...';
        submitButton.disabled = true;
        
        const result = await window.apiHelper.post('/writeoff-documents', { documentData, items });
        
        if (result.success) {
            showUserSuccess(result.message || 'Документ списання створено успішно!');
            clearDocumentForm();
            await loadWriteoffDocuments();
            console.log('✅ Документ створено та історію оновлено');
        } else {
            throw new Error(result.error || 'Помилка створення документу');
        }
        
    } catch (error) {
        console.error('❌ Помилка створення документу:', error);
        showUserError('Помилка створення документу: ' + error.message);
    } finally {
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }
}

/**
 * Load writeoff documents history
 */
async function loadWriteoffDocuments() {
    try {
        const loadingEl = document.getElementById('writeoff-documents-loading');
        const contentEl = document.getElementById('writeoff-documents-content');
        const tbody = document.getElementById('writeoff-documents-tbody');
        
        if (!loadingEl || !contentEl || !tbody) {
            console.log('⚠️ Елементи історії документів не знайдено, пропускаємо завантаження');
            return;
        }
        
        console.log('📋 Завантажую документи списання...');
        
        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';
        
        const result = await window.apiHelper.get('/writeoff-documents');
        console.log('✅ Завантажено документів:', result.data.length);
        
        if (result.success) {
            displayWriteoffDocuments(result.data);
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Помилка завантаження документів:', error);
        const loadingEl = document.getElementById('writeoff-documents-loading');
        if (loadingEl) {
            loadingEl.innerHTML = 'Помилка завантаження документів списання';
        }
    }
}

/**
 * Display writeoff documents in table
 */
function displayWriteoffDocuments(documents) {
    const tbody = document.getElementById('writeoff-documents-tbody');
    if (!tbody) return;
    
    if (!documents || documents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">Немає документів списання</td></tr>';
        return;
    }
    
    tbody.innerHTML = documents.map(doc => {
        const itemsCount = doc.writeoff_items ? doc.writeoff_items.length : 0;
        const totalQuantity = doc.writeoff_items ? 
            doc.writeoff_items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        
        const isLegacy = doc.is_legacy;
        const documentNumber = isLegacy ? `${doc.document_number} (старий)` : doc.document_number;
        
        return `
            <tr ${isLegacy ? 'style="opacity: 0.7;"' : ''}>
                <td>${documentNumber}</td>
                <td>${formatDate(doc.writeoff_date)}</td>
                <td>${doc.reason}</td>
                <td>${doc.responsible}</td>
                <td>${itemsCount}</td>
                <td>${totalQuantity} шт</td>
                <td>
                    <button class="btn btn-sm" onclick="viewDocumentDetails('${doc.id}')" title="Переглянути деталі">
                        👁️ Деталі
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log(`✅ Displayed ${documents.length} writeoff documents`);
}

/**
 * View document details
 */
async function viewDocumentDetails(documentId) {
    try {
        console.log(`👁️ Завантажую деталі документу: ${documentId}`);
        
        // Handle legacy documents
        if (documentId.startsWith('old_')) {
            showUserSuccess('Це старий запис списання. Деталі доступні в розділі "Списання".');
            return;
        }
        
        const result = await window.apiHelper.get(`/writeoff-documents/${documentId}`);
        
        if (result.success) {
            displayDocumentDetailsModal(result.data);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Помилка завантаження деталей:', error);
        showUserError('Помилка завантаження деталей документу: ' + error.message);
    }
}

/**
 * Display document details in modal
 */
function displayDocumentDetailsModal(document) {
    try {
        console.log('📄 Displaying document details:', document);
        
        const modalHtml = `
            <div class="modal" id="document-details-modal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px;">
                    <span class="close" onclick="closeDocumentDetailsModal()">&times;</span>
                    <h2>📄 Документ списання ${document.document_number}</h2>
                    
                    <div style="margin-bottom: 2rem;">
                        <strong>Дата:</strong> ${formatDate(document.writeoff_date)}<br>
                        <strong>Відповідальний:</strong> ${document.responsible}<br>
                        <strong>Причина:</strong> ${document.reason}<br>
                        <strong>Примітки:</strong> ${document.notes || 'Немає'}
                    </div>
                    
                    <h3>Позиції документу:</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Код</th>
                                <th>Кількість</th>
                                <th>Партія</th>
                                <th>Примітки</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${document.writeoff_items.map(item => `
                                <tr>
                                    <td>${item.products.name}</td>
                                    <td>${item.products.code}</td>
                                    <td>${item.quantity} шт</td>
                                    <td>${item.batch_date ? formatDate(item.batch_date) : 'Не вказано'}</td>
                                    <td>${item.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 2rem; text-align: right;">
                        <button class="btn" onclick="closeDocumentDetailsModal()">Закрити</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('document-details-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        if (document.body) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } else {
            console.error('❌ document.body is not available');
        }
        
    } catch (error) {
        console.error('❌ Error displaying document details modal:', error);
        showUserError('Помилка відображення деталей документу: ' + error.message);
    }
}

/**
 * Close document details modal
 */
function closeDocumentDetailsModal() {
    try {
        const modal = document.getElementById('document-details-modal');
        if (modal) {
            modal.remove();
            console.log('✅ Document details modal closed');
        }
    } catch (error) {
        console.error('❌ Error closing modal:', error);
    }
}

/**
 * Apply documents filter
 */
function applyDocumentsFilter() {
    // This would filter the loaded documents
    console.log('🔍 Applying documents filter...');
    loadWriteoffDocuments(); // For now, just reload
}

/**
 * Clear documents filter
 */
function clearDocumentsFilter() {
    document.getElementById('docs-filter-date-from').value = '';
    document.getElementById('docs-filter-date-to').value = '';
    document.getElementById('docs-filter-responsible').value = '';
    loadWriteoffDocuments();
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA');
}

// Export functions for global access
window.addDocumentItem = addDocumentItem;
window.removeDocumentItem = removeDocumentItem;
window.clearDocumentForm = clearDocumentForm;
window.viewDocumentDetails = viewDocumentDetails;
window.closeDocumentDetailsModal = closeDocumentDetailsModal;
window.applyDocumentsFilter = applyDocumentsFilter;
window.clearDocumentsFilter = clearDocumentsFilter;
window.loadWriteoffDocuments = loadWriteoffDocuments; 