# 🎯 ПЛАН: ГРУПОВЕ СПИСАННЯ ТОВАРІВ (ДОКУМЕНТИ СПИСАННЯ)

## **Complexity Level: 3 (Intermediate Feature)**

**Мета:** 📋 Впровадити функціонал групового списання товарів аналогічно до документів приходу

**Поточний стан:** ❌ Списання тільки по одному товару за раз
**Цільовий стан:** ✅ Документи списання з множинними позиціями

---

## 📊 **АНАЛІЗ ПОТОЧНОГО СТАНУ**

### **Поточна архітектура списання:**
```
writeoffs
├── id (primary key)
├── product_id (single product)
├── writeoff_date
├── total_quantity
├── reason
├── responsible
├── notes
└── created_at
```

### **Цільова архітектура (як в arrivals):**
```
writeoff_documents                    writeoff_items
├── id (primary key)                  ├── id (primary key)
├── document_number                   ├── document_id (FK)
├── writeoff_date                     ├── product_id
├── reason                            ├── quantity
├── responsible                       ├── batch_date
├── notes                             ├── notes
├── created_by                        └── created_at
├── created_at
└── updated_at
```

---

## �� **ПЛАН РЕАЛІЗАЦІЇ**

### **ФАЗА 1: АНАЛІЗ ТА ПЛАНУВАННЯ АРХІТЕКТУРИ**

#### **1.1 Створення нових таблиць**
**Файл:** `backend/migrations/create-writeoff-documents.sql`
```sql
-- Таблиця документів списання
CREATE TABLE IF NOT EXISTS writeoff_documents (
    id BIGSERIAL PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,
    writeoff_date DATE NOT NULL,
    reason TEXT NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблиця позицій документів списання
CREATE TABLE IF NOT EXISTS writeoff_items (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES writeoff_documents(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    batch_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_date ON writeoff_documents(writeoff_date);
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_responsible ON writeoff_documents(responsible);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_document ON writeoff_items(document_id);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_product ON writeoff_items(product_id);
```

#### **1.2 Міграція існуючих даних**
**Файл:** `backend/migrations/migrate-writeoffs-to-documents.js`
```javascript
const migrateWriteoffsToDocuments = async () => {
    // 1. Створити документи з існуючих списань
    // 2. Перенести дані в writeoff_items
    // 3. Зберегти зворотну сумісність
};
```

### **ФАЗА 2: BACKEND РОЗРОБКА**

#### **2.1 Оновлення supabase-database.js**
**Додати нові queries:**
```javascript
const writeoffDocumentQueries = {
    getAll: async (filters = {}) => {
        // Аналогічно до arrivalQueries.getAll
        let query = supabase
            .from('writeoff_documents')
            .select(`
                *,
                writeoff_items (
                    id,
                    product_id,
                    quantity,
                    batch_date,
                    notes,
                    products (id, name, code)
                )
            `)
            .order('writeoff_date', { ascending: false });
        
        // Застосування фільтрів
        return data || [];
    },

    getById: async (id) => {
        // Отримання документу з позиціями
    },

    create: async (documentData) => {
        // Створення документу з автогенерацією номера
        const document_number = `WO-${writeoff_date.replace(/-/g, '')}-${String(count).padStart(3, '0')}`;
    },

    createItem: async (documentId, itemData) => {
        // Створення позиції документу
    },

    updateProductStock: async (productId, quantityChange) => {
        // Оновлення залишків (зменшення)
    },

    createMovement: async (movementData) => {
        // Створення руху товару (OUT)
    },

    updateBatch: async (batchData) => {
        // Оновлення партії (зменшення available_quantity)
    }
};
```

#### **2.2 Створення writeoff-document-service.js**
**Файл:** `backend/services/writeoffDocumentService.js`
```javascript
const WriteoffDocumentService = {
    getAllDocuments: async (filters = {}) => {
        // Отримання всіх документів з фільтрацією
    },

    getDocumentById: async (id) => {
        // Отримання документу за ID
    },

    createDocument: async (documentData, requestInfo = {}) => {
        // Створення документу з позиціями
        // 1. Валідація даних
        // 2. Створення документу
        // 3. Створення позицій
        // 4. Оновлення залишків
        // 5. Створення рухів
        // 6. Оновлення партій
        // 7. Логування операції
    },

    validateDocumentData: (documentData) => {
        // Валідація структури документу
    },

    processWriteoffItems: async (documentId, items) => {
        // Обробка позицій документу
    }
};
```

#### **2.3 Створення writeoff-document-controller.js**
**Файл:** `backend/controllers/writeoffDocumentController.js`
```javascript
const WriteoffDocumentController = {
    getAllDocuments: async (req, res, next) => {
        // GET /api/writeoff-documents
    },

    getDocumentById: async (req, res, next) => {
        // GET /api/writeoff-documents/:id
    },

    createDocument: async (req, res, next) => {
        // POST /api/writeoff-documents
        const { writeoff_date, reason, responsible, items } = req.body;
        
        // Валідація
        if (!writeoff_date || !reason || !responsible || !items || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Заповніть всі обов\'язкові поля та додайте позиції' 
            });
        }

        // Створення документу
        const result = await WriteoffDocumentService.createDocument(documentData, requestInfo);
        
        res.status(201).json({
            success: true,
            message: `Документ списання ${result.data.document_number} створено успішно`,
            data: result.data
        });
    }
};
```

#### **2.4 Створення routes**
**Файл:** `backend/routes/writeoff-document-routes.js`
```javascript
const router = express.Router();

// Отримати всі документи списання
router.get('/', writeoffDocumentController.getAllDocuments);

// Отримати документ за ID
router.get('/:id', writeoffDocumentController.getDocumentById);

// Створити документ списання
router.post('/', writeoffDocumentController.createDocument);

module.exports = router;
```

### **ФАЗА 3: FRONTEND РОЗРОБКА**

#### **3.1 Оновлення inventory.html**
**Замінити поточну форму списання:**
```html
<div id="writeoff" class="tab-content">
    <div class="section-title">Документ списання</div>
    
    <div class="form-hint">
        💡 Створіть документ списання з декількома позиціями. 
        Для кожної позиції буде автоматично обрана найстаріша партія (FIFO).
    </div>
    
    <form id="writeoff-document-form">
        <!-- Заголовок документу -->
        <div class="document-header">
            <div class="form-grid">
                <div class="form-group">
                    <label for="writeoff-date">Дата списання *</label>
                    <input type="date" id="writeoff-date" name="writeoff_date" required>
                </div>
                <div class="form-group">
                    <label for="writeoff-reason">Причина списання *</label>
                    <select id="writeoff-reason" name="reason" required>
                        <option value="">Оберіть причину...</option>
                        <option value="Закінчення терміну придатності">Закінчення терміну придатності</option>
                        <option value="Пошкодження упаковки">Пошкодження упаковки</option>
                        <option value="Брак виробництва">Брак виробництва</option>
                        <option value="Втрата товарного вигляду">Втрата товарного вигляду</option>
                        <option value="Представницькі витрати">Представницькі витрати</option>
                        <option value="Дегустація">Дегустація</option>
                        <option value="Інше">Інше</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="writeoff-responsible">Відповідальний *</label>
                    <input type="text" id="writeoff-responsible" name="responsible" required>
                </div>
            </div>
        </div>

        <!-- Позиції документу -->
        <div class="writeoff-items-section">
            <div class="writeoff-items-header">
                <h3>📋 Позиції для списання</h3>
                <button type="button" id="add-writeoff-item" class="add-item-btn">
                    ➕ Додати позицію
                </button>
            </div>

            <div class="writeoff-items-container">
                <table id="writeoff-items-table">
                    <thead>
                        <tr>
                            <th>Товар *</th>
                            <th>Кількість *</th>
                            <th>Партія</th>
                            <th>Примітка</th>
                            <th style="width: 60px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="writeoff-items-empty">
                            <td colspan="5">
                                Додайте позиції для списання<br>
                                <small style="color: #adb5bd;">Натисніть "Додати позицію" щоб почати</small>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Дії -->
        <div class="form-actions">
            <button type="submit" class="btn btn-danger">
                ❌ Створити документ списання
            </button>
            <button type="button" class="btn" onclick="clearWriteoffDocumentForm()">
                🔄 Очистити
            </button>
        </div>
    </form>

    <!-- Повідомлення -->
    <div id="writeoff-document-success" style="display:none;"></div>
    <div id="writeoff-document-error" style="display:none;"></div>

    <!-- Історія документів списання -->
    <div class="section-title" style="margin-top: 3rem;">Історія списань</div>
    
    <div class="form-grid" style="margin-bottom: 1rem;">
        <div class="form-group">
            <label for="writeoff-filter-date-from">Дата від</label>
            <input type="date" id="writeoff-filter-date-from">
        </div>
        <div class="form-group">
            <label for="writeoff-filter-date-to">Дата до</label>
            <input type="date" id="writeoff-filter-date-to">
        </div>
        <div class="form-group">
            <label for="writeoff-filter-responsible">Відповідальний</label>
            <input type="text" id="writeoff-filter-responsible">
        </div>
    </div>
    
    <div style="margin-bottom: 1rem;">
        <button class="btn" onclick="applyWriteoffFilter()">🔍 Застосувати фільтр</button>
        <button class="btn" onclick="clearWriteoffFilter()">🗑️ Очистити фільтр</button>
        <button class="btn" onclick="exportWriteoffs()">📊 Експорт CSV</button>
    </div>
    
    <div id="writeoff-documents-loading" class="loading">Завантаження...</div>
    <div id="writeoff-documents-content" style="display: none;">
        <div id="writeoff-documents-summary" style="background: #f8f9fa; padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">
            <strong>Підсумок:</strong>
            <span id="writeoff-documents-count">0</span> документів, 
            <span id="writeoff-total-items">0</span> позицій, 
            Загальна кількість: <span id="writeoff-total-quantity" style="color: #e74c3c;">-0 шт</span>
        </div>
        
        <table class="table" id="writeoff-documents-table">
            <thead>
                <tr>
                    <th>№ Документу</th>
                    <th>Дата</th>
                    <th>Причина</th>
                    <th>Позиції</th>
                    <th>Загальна к-ть</th>
                    <th>Відповідальний</th>
                    <th>Дії</th>
                </tr>
            </thead>
            <tbody id="writeoff-documents-tbody">
            </tbody>
        </table>
    </div>
</div>
```

#### **3.2 JavaScript для форми документів**
**Файл:** `frontend/js/writeoff-document.js`
```javascript
let writeoffItems = [];

const WriteoffDocument = {
    init() {
        this.setupEventListeners();
        this.setupDateFields();
        this.renderItems();
    },

    setupEventListeners() {
        // Обробники для форми
        document.getElementById('writeoff-document-form').addEventListener('submit', this.handleSubmit.bind(this));
        document.getElementById('add-writeoff-item').addEventListener('click', this.addItem.bind(this));
    },

    addItem() {
        writeoffItems.push({
            product_id: '',
            quantity: '',
            batch_date: '',
            notes: ''
        });
        this.renderItems();
    },

    removeItem(index) {
        writeoffItems.splice(index, 1);
        this.renderItems();
    },

    renderItems() {
        const tbody = document.querySelector('#writeoff-items-table tbody');
        
        if (writeoffItems.length === 0) {
            tbody.innerHTML = `
                <tr class="writeoff-items-empty">
                    <td colspan="5">
                        Додайте позиції для списання<br>
                        <small style="color: #adb5bd;">Натисніть "Додати позицію" щоб почати</small>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        writeoffItems.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <select class="writeoff-product" data-idx="${idx}" required>
                        <option value="">Оберіть товар...</option>
                    </select>
                </td>
                <td>
                    <input type="number" min="1" class="writeoff-quantity" 
                           value="${item.quantity || ''}" data-idx="${idx}"
                           placeholder="Кількість" required>
                </td>
                <td>
                    <input type="date" class="writeoff-batch-date" 
                           value="${item.batch_date || ''}" data-idx="${idx}">
                    <small class="batch-info">Автовибір найстарішої партії</small>
                </td>
                <td>
                    <input type="text" class="writeoff-notes" 
                           value="${item.notes || ''}" data-idx="${idx}"
                           placeholder="Примітка...">
                </td>
                <td>
                    <button type="button" class="remove-writeoff-item" data-idx="${idx}" 
                            title="Видалити позицію">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.loadProductsForSelects();
        this.attachItemEvents();
    },

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const documentData = {
            writeoff_date: formData.get('writeoff_date'),
            reason: formData.get('reason'),
            responsible: formData.get('responsible'),
            items: writeoffItems
        };

        try {
            const response = await fetch('/api/writeoff-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(documentData)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Документ списання ${result.data.document_number} створено успішно!`);
                this.clearForm();
                this.loadDocuments(); // Оновити історію
            } else {
                this.showError(result.error || 'Помилка створення документу');
            }
        } catch (error) {
            this.showError('Помилка зв\'язку з сервером');
        }
    },

    // Методи для історії документів
    async loadDocuments(filters = {}) {
        // Завантаження та відображення документів списання
    },

    displayDocuments(documents) {
        // Відображення документів в таблиці
    }
};

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    WriteoffDocument.init();
});
```

### **ФАЗА 4: МІГРАЦІЯ ТА ЗВОРОТНА СУМІСНІСТЬ**

#### **4.1 Поетапна міграція**
1. **Крок 1:** Створити нові таблиці
2. **Крок 2:** Мігрувати існуючі дані
3. **Крок 3:** Оновити API endpoints
4. **Крок 4:** Оновити frontend
5. **Крок 5:** Тестування

#### **4.2 Зворотна сумісність**
- Зберегти старі API endpoints для історії
- Поступово перевести на нові endpoints
- Підтримувати обидва підходи паралельно

### **ФАЗА 5: ТЕСТУВАННЯ**

#### **5.1 Backend тестування**
- Тестування API endpoints
- Валідація даних
- Перевірка транзакцій
- Тестування міграції

#### **5.2 Frontend тестування**
- Тестування форми документів
- Перевірка відображення історії
- Тестування фільтрації та експорту
- Мобільна версія

#### **5.3 Інтеграційне тестування**
- Повний цикл створення документу
- Перевірка оновлення залишків
- Тестування партій
- Перевірка логування

---

## ⏱️ **ЧАСОВІ РАМКИ**

### **Загальна оцінка: 12-16 годин**

- **ФАЗА 1:** Планування та міграція БД - 3-4 години
- **ФАЗА 2:** Backend розробка - 4-5 годин
- **ФАЗА 3:** Frontend розробка - 3-4 години
- **ФАЗА 4:** Міграція та сумісність - 1-2 години
- **ФАЗА 5:** Тестування - 1-2 години

### **Поетапне впровадження:**
- **Тиждень 1:** Фази 1-2 (Backend)
- **Тиждень 2:** Фази 3-4 (Frontend + Міграція)
- **Тиждень 3:** Фаза 5 (Тестування + Виправлення)

---

## 🎯 **КРИТЕРІЇ УСПІШНОСТІ**

### **Мінімальні вимоги:**
- ✅ Створення документів з множинними позиціями
- ✅ Автоматичне оновлення залишків товарів
- ✅ Автоматичне оновлення партій
- ✅ Історія документів списання
- ✅ Фільтрація та експорт

### **Додаткові можливості:**
- ✅ Автовибір найстарішої партії (FIFO)
- ✅ Валідація наявності товарів
- ✅ Детальна інформація про документи
- ✅ Зворотна сумісність зі старими записами

---

## 🔧 **ТЕХНІЧНІ РІШЕННЯ**

### **Генерація номерів документів:**
```javascript
// Формат: WO-YYYYMMDD-NNN
const generateDocumentNumber = (date) => {
    const dateStr = date.replace(/-/g, '');
    const count = await getDocumentCountForDate(date);
    return `WO-${dateStr}-${String(count + 1).padStart(3, '0')}`;
};
```

### **Автовибір партій (FIFO):**
```javascript
const selectBatchForWriteoff = async (productId, quantity) => {
    const batches = await getBatchesByProduct(productId);
    const sortedBatches = batches
        .filter(b => b.available_quantity > 0)
        .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date));
    
    return sortedBatches[0]; // Найстаріша партія
};
```

### **Транзакційна безпека:**
```javascript
const createWriteoffDocument = async (documentData) => {
    const transaction = await supabase.rpc('begin_transaction');
    
    try {
        // 1. Створити документ
        const document = await createDocument(documentData);
        
        // 2. Обробити позиції
        for (const item of documentData.items) {
            await processWriteoffItem(document.id, item);
        }
        
        await supabase.rpc('commit_transaction');
        return document;
    } catch (error) {
        await supabase.rpc('rollback_transaction');
        throw error;
    }
};
```

---

## 📋 **CHECKLIST РЕАЛІЗАЦІЇ**

### **Backend:**
- [ ] Створити міграційні скрипти
- [ ] Додати writeoffDocumentQueries
- [ ] Створити WriteoffDocumentService
- [ ] Створити WriteoffDocumentController
- [ ] Додати routes
- [ ] Інтегрувати в app-new.js
- [ ] Тестувати API endpoints

### **Frontend:**
- [ ] Оновити HTML структуру
- [ ] Створити writeoff-document.js
- [ ] Інтегрувати з inventory.html
- [ ] Додати CSS стилі
- [ ] Тестувати форму та історію
- [ ] Оптимізувати для мобільних

### **Міграція:**
- [ ] Створити backup існуючих даних
- [ ] Виконати міграцію БД
- [ ] Перевірити цілісність даних
- [ ] Налаштувати зворотну сумісність
- [ ] Провести повне тестування

---

