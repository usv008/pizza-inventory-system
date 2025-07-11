let arrivalItems = [];

function renderArrivalItems() {
    const tbody = document.querySelector('#arrival-items-table tbody');
    
    // Якщо немає товарів, показуємо порожню таблицю
    if (arrivalItems.length === 0) {
        tbody.innerHTML = `
            <tr class="arrival-items-empty">
                <td colspan="5">
                    Додайте позиції до документу<br>
                    <small style="color: #adb5bd;">Натисніть "Додати позицію" щоб почати</small>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    arrivalItems.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <select class="arrival-product" data-idx="${idx}">
                    <option value="">Оберіть товар...</option>
                </select>
            </td>
            <td>
                <input type="number" min="1" class="arrival-quantity" 
                       value="${item.quantity || ''}" data-idx="${idx}"
                       placeholder="Кількість">
            </td>
            <td>
                <input type="date" class="arrival-batch-date" 
                       value="${item.batch_date || ''}" data-idx="${idx}">
            </td>
            <td>
                <input type="text" class="arrival-notes" 
                       value="${item.notes || ''}" data-idx="${idx}"
                       placeholder="Додаткова інформація...">
            </td>
            <td>
                <button type="button" class="remove-arrival-item" data-idx="${idx}" 
                        title="Видалити позицію">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Підтягнути продукти
    fetch('http://localhost:3000/api/products').then(r=>r.json()).then(result => {
        // Обробляємо новий формат API відповіді {success: true, data: [...]}
        const products = result.success ? result.data : result;
        
        document.querySelectorAll('.arrival-product').forEach(sel => {
            const idx = parseInt(sel.dataset.idx);
            
            sel.innerHTML = '<option value="">Оберіть товар...</option>' + 
                products.map(p => `<option value="${p.id}" ${arrivalItems[idx].product_id==p.id?'selected':''}>${p.name} (${p.code})</option>`).join('');
            
            if (arrivalItems[idx].product_id) {
                sel.value = arrivalItems[idx].product_id;
            }
            
            sel.onchange = e => { 
                arrivalItems[idx].product_id = e.target.value ? parseInt(e.target.value) : '';
            };
        });
    }).catch(error => {
        console.error('Помилка завантаження товарів:', error);
        
        // Показуємо помилку користувачу
        document.querySelectorAll('.arrival-product').forEach(sel => {
            sel.innerHTML = '<option value="">❌ Помилка завантаження товарів</option>';
            sel.disabled = true;
        });
        
        // Показуємо глобальну помилку якщо є функція
        if (typeof showUserError === 'function') {
            showUserError('Помилка завантаження товарів: ' + error.message);
        }
    });
    
    // Обробники для полів
    document.querySelectorAll('.arrival-quantity').forEach(inp => {
        inp.oninput = e => { 
            const idx = parseInt(inp.dataset.idx);
            arrivalItems[idx].quantity = e.target.value ? parseInt(e.target.value) : '';
        };
    });
    
    document.querySelectorAll('.arrival-batch-date').forEach(inp => {
        inp.oninput = e => { 
            const idx = parseInt(inp.dataset.idx);
            arrivalItems[idx].batch_date = e.target.value;
        };
    });
    
    document.querySelectorAll('.arrival-notes').forEach(inp => {
        inp.oninput = e => { 
            const idx = parseInt(inp.dataset.idx);
            arrivalItems[idx].notes = e.target.value;
        };
    });
    
    // Обробники для кнопок видалення
    document.querySelectorAll('.remove-arrival-item').forEach(btn => {
        btn.onclick = () => { 
            const idx = parseInt(btn.dataset.idx);
            
            // Анімація видалення
            btn.closest('tr').style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                arrivalItems.splice(idx, 1); 
                renderArrivalItems();
            }, 300);
        };
    });
}

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', function() {
    // Встановлюємо поточну дату
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('arrival-date');
    if (dateInput) {
        dateInput.value = today;
    }
    
    // Рендеримо порожню таблицю
    renderArrivalItems();
});

// Додавання нової позиції
document.getElementById('add-arrival-item').onclick = () => {
    arrivalItems.push({ product_id: '', quantity: '', batch_date: '', notes: '' });
    renderArrivalItems();
    
    // Скролимо до нової позиції
    setTimeout(() => {
        const table = document.getElementById('arrival-items-table');
        const lastRow = table.querySelector('tbody tr:last-child');
        if (lastRow) {
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
};

// Обробка форми
document.getElementById('arrival-form').onsubmit = e => {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.arrival-submit-btn');
    const originalText = submitBtn.innerHTML;
    
    // Показуємо завантаження
    submitBtn.innerHTML = '⏳ Збереження...';
    submitBtn.disabled = true;
    submitBtn.classList.add('arrival-loading');
    
    const arrival_date = document.getElementById('arrival-date').value;
    const reason = document.getElementById('arrival-reason').value;
    
    // Очищуємо попередні повідомлення
    document.getElementById('arrival-error').style.display = 'none';
    document.getElementById('arrival-success').style.display = 'none';
    
    if (!arrival_date || !reason || arrivalItems.length === 0) {
        showError('Заповніть всі обов\'язкові поля та додайте хоча б одну позицію');
        resetSubmitButton();
        return;
    }
    
    // Валідація позицій
    for (let i = 0; i < arrivalItems.length; i++) {
        const item = arrivalItems[i];
        
        if (!item.product_id || !item.quantity || !item.batch_date) {
            showError(`Заповніть всі обов\'язкові поля у позиції ${i + 1}`);
            resetSubmitButton();
            return;
        }
        
        if (typeof item.product_id !== 'number' || item.product_id <= 0) {
            showError(`Оберіть товар у позиції ${i + 1}`);
            resetSubmitButton();
            return;
        }
        
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            showError(`Введіть правильну кількість у позиції ${i + 1}`);
            resetSubmitButton();
            return;
        }
    }
    
    // Відправка на сервер
    fetch('http://localhost:3000/api/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arrival_date, reason, items: arrivalItems })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showSuccess(`Документ оприходування №${data.arrival_number || 'TEMP'} успішно створено!`);
            
            // Очищуємо форму
            document.getElementById('arrival-form').reset();
            document.getElementById('arrival-date').value = new Date().toISOString().split('T')[0];
            arrivalItems = [];
            renderArrivalItems();
        } else {
            // Показуємо детальну помилку для діагностики
            const errorMessage = data.error && typeof data.error === 'object' ? 
                data.error.message || data.error.details || JSON.stringify(data.error) :
                data.error || 'Помилка збереження документу';
            showError(`Помилка збереження: ${errorMessage}`);
        }
        resetSubmitButton();
    })
    .catch(error => {
        console.error('Помилка при збереженні:', error);
        showError('Помилка зв\'язку з сервером. Спробуйте ще раз.');
        resetSubmitButton();
    });
    
    function resetSubmitButton() {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('arrival-loading');
    }
    
    function showError(message) {
        const errorDiv = document.getElementById('arrival-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    function showSuccess(message) {
        const successDiv = document.getElementById('arrival-success');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// Обробник перемикання вкладки
if (window.setTabHandler) {
    window.setTabHandler('arrivals', () => {
        // Скидаємо форму
        document.getElementById('arrival-form').reset();
        
        // Встановлюємо поточну дату
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('arrival-date').value = today;
        
        // Очищуємо товари та повідомлення
        arrivalItems = [];
        renderArrivalItems();
        document.getElementById('arrival-success').style.display = 'none';
        document.getElementById('arrival-error').style.display = 'none';
    });
}

// Додаємо CSS анімацію для fadeOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.95); }
    }
`;
document.head.appendChild(style);