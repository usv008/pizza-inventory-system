# 📋 Інструкції для наступного агента - Міграція коду Pizza System

**Дата**: 2025-07-25  
**Поточний стан**: ЕТАП 2.2 - Міграція clientService  
**Прогрес**: 24% (4/17 завдань завершено)

---

## 🎯 ЩО ВЖЕ ЗРОБЛЕНО

### ✅ ЕТАП 1: Створення Supabase адаптера (ЗАВЕРШЕНО 100%)

**Створені файли**:
- `backend/database-supabase.js` - Supabase клієнт
- `backend/adapters/DatabaseAdapter.js` - універсальний адаптер SQLite/Supabase
- `backend/config/database.js` - конфігурація переключення БД
- `backend/.env` - змінні середовища
- `backend/test-supabase-client.js` - тест Supabase
- `backend/test-database-adapter.js` - тест адаптера
- `backend/test-database-config.js` - тест конфігурації

**Результат**: Готова інфраструктура для паралельної роботи з SQLite та Supabase.

### ✅ ЕТАП 2.1: Міграція productService (ЗАВЕРШЕНО)

**Створені файли**:
- `backend/queries/supabase/productQueries.js` - Supabase запити для продуктів
- `backend/services/productService-v2.js` - універсальний productService
- `backend/test-product-service-migration.js` - тест міграції

**Результат**: productService працює з обома БД, 15/15 тестів пройдено.

---

## 🔄 ПОТОЧНЕ ЗАВДАННЯ: ЕТАП 2.2 - Міграція clientService

### Що потрібно зробити:

#### 1. Створити Supabase queries для клієнтів
```bash
# Створити файл:
backend/queries/supabase/clientQueries.js
```

**Зразок структури** (використовуй як template productQueries.js):
- `getAll()` - отримати всіх клієнтів
- `getById(id)` - отримати клієнта за ID
- `getByName(name)` - пошук за назвою
- `create(clientData)` - створити клієнта
- `update(id, clientData)` - оновити клієнта
- `delete(id)` - видалити клієнта
- `search(query)` - пошук клієнтів

#### 2. Адаптувати clientService
```bash
# Створити файл:
backend/services/clientService-v2.js
```

**Використай як зразок**: `backend/services/productService-v2.js`

**Ключові особливості**:
- Використовуй `createDatabaseAdapter()` замість прямих запитів
- Обробляй JSONB поле `contact_info` (якщо є)
- Зберігай операційне логування (якщо підключено)
- Додай error handling для унікальних полів

#### 3. Створити тест міграції
```bash
# Створити файл:
backend/test-client-service-migration.js
```

**Структура тесту**:
- Тест в SQLite режимі
- Тест в Supabase режимі  
- Порівняння результатів
- Перевірка всіх CRUD операцій

### Як працювати з переключенням БД:

```javascript
// В тестах
const { switchDatabaseMode } = require('./config/database');

// Переключити на SQLite
switchDatabaseMode(false);

// Переключити на Supabase  
switchDatabaseMode(true);
```

### Важливі файли для вивчення:

1. **Існуючий clientService**: `backend/services/clientService.js`
2. **Зразок міграції**: `backend/services/productService-v2.js` 
3. **Зразок queries**: `backend/queries/supabase/productQueries.js`
4. **Зразок тесту**: `backend/test-product-service-migration.js`

---

## 📁 Структура таблиці clients в Supabase

```sql
CREATE TABLE public.clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company_type TEXT DEFAULT 'ТОВ',
    address TEXT,
    phone TEXT,
    email TEXT,
    contact_info JSONB,          -- Важливо: JSONB поле
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.users(id)
);
```

### Особливості роботи з clients:

1. **JSONB поле contact_info** - зберігає контактну інформацію
2. **Soft delete** через `is_active` 
3. **Audit поля** - created_by_user_id
4. **Decimal поля** - discount_percent, credit_limit

---

## 🧪 Як тестувати:

### 1. Запустити тест:
```bash
cd backend
node test-client-service-migration.js
```

### 2. Очікувані результати:
- ✅ SQLite: X клієнтів
- ✅ Supabase: X клієнтів  
- ✅ Переключення працює
- ✅ CRUD операції працюють
- ✅ JSONB поля обробляються

### 3. Оновити статус:
Після завершення онови файл `SUPABASE_CODE_MIGRATION_STATUS.md`:
- Позначити завдання 2.2 як ✅ Завершено
- Оновити загальний прогрес
- Додати запис в журнал дій

---

## 📋 НАСТУПНІ ЗАВДАННЯ ПІСЛЯ clientService

### ЕТАП 2.3: userService + authService (складніше)
- Особливості: self-referencing FK, хешування паролів, сесії
- Файли: userService.js, authService.js
- Таблиці: users, user_sessions, user_audit

### ЕТАП 3: Складні сервіси
- movementService (центральний для запасів)
- orderService (складний, багато залежностей)
- productionService (виробництво)
- writeoffService (списання)

---

## 🚨 Важливі нотатки

### Переключення БД:
```javascript
// В .env файлі:
USE_SUPABASE=false   # SQLite режим
USE_SUPABASE=true    # Supabase режим
```

### Структура адаптера:
```javascript
const adapter = createDatabaseAdapter();

// SELECT
const records = await adapter
    .table('clients')
    .select('*', { 
        where: { is_active: true },
        orderBy: { column: 'name', direction: 'asc' },
        limit: 10 
    });

// INSERT
const result = await adapter
    .table('clients')
    .insert(clientData);

// UPDATE
await adapter
    .table('clients')
    .update(updateData, { id });

// DELETE
await adapter
    .table('clients')
    .delete({ id });

// Закрити з'єднання (SQLite)
adapter.close();
```

### Error Handling:
```javascript
const { NotFoundError, DatabaseError, UniqueConstraintError } = require('../middleware/errors/AppError');

// Використовуй AppError класи для сумісності
if (!client) {
    throw new NotFoundError('Клієнт');
}
```

---

## 🎯 Критерії успіху ЕТАПУ 2.2

- [ ] clientQueries.js створено та протестовано
- [ ] clientService-v2.js працює з обома БД
- [ ] Тест міграції проходить успішно
- [ ] JSONB поля обробляються правильно
- [ ] Error handling працює
- [ ] Статус оновлено

**Очікуваний час**: 2-3 години  
**Після завершення**: Прогрес буде 30% (5/17 завдань)

---

## 📞 Якщо виникають проблеми

### Перевірити з'єднання:
```bash
node test-supabase-client.js
```

### Перевірити адаптер:
```bash  
node test-database-adapter.js
```

### Дебаг переключення:
```bash
node test-database-config.js
```

---

**Успіхів з міграцією! 🚀**

*Файл автоматично оновлюється після кожного завершеного етапу*