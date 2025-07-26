# 🚨 Правила міграції SQLite → Supabase PostgreSQL

**Створено**: 2025-07-25 після аналізу помилок реальної міграції  
**Мета**: Уникнути помилок при міграції інших сервісів

---

## 🎯 Критичні відмінності типів даних

### 1. Boolean поля

| SQLite | Supabase | Проблема | Рішення |
|--------|----------|----------|---------|
| `INTEGER (1/0)` | `BOOLEAN (true/false)` | Frontend фільтрація ламається | Підтримувати обидва формати |

**Приклад проблеми**:
```javascript
// ❌ Працює тільки з SQLite
users.filter(user => user.active === 1)

// ✅ Працює з обома БД
users.filter(user => user.active === 1 || user.active === true)
```

### 2. JSON/JSONB поля

| SQLite | Supabase | Проблема | Рішення |
|--------|----------|----------|---------|
| `TEXT` потребує `JSON.parse()` | `JSONB` повертає об'єкт | `JSON.parse()` ламає об'єкт | Перевіряти тип перед парсінгом |

**Приклад проблеми**:
```javascript
// ❌ Ламається в Supabase
permissions: JSON.parse(user.permissions || '{}')

// ✅ Універсальне рішення
permissions: typeof user.permissions === 'string' 
  ? JSON.parse(user.permissions || '{}') 
  : (user.permissions || {})
```

### 3. Дати та час

| SQLite | Supabase | Різниця |
|--------|----------|---------|
| `DATETIME` як TEXT | `TIMESTAMP WITH TIME ZONE` | Формат та timezone |

---

## 🔧 Обов'язковий чеклист міграції сервісу

### Етап 1: Backend сервіс

- [ ] **Створити queries файл для Supabase**
  - Змінити типи полів (INTEGER→BOOLEAN, TEXT→JSONB)
  - Адаптувати SQL запити до PostgreSQL синтаксису
  
- [ ] **Створити v2 сервіс з підтримкою обох БД**
  - Використовувати DatabaseAdapter
  - Додати перевірки типів для JSON/JSONB
  - Підтримувати обидва формати boolean
  
- [ ] **Протестувати з обома БД**
  - Запустити в SQLite режимі
  - Переключити на Supabase
  - Порівняти результати

### Етап 2: API endpoints

- [ ] **Перевірити формат відповідей**
  - Boolean поля мають правильний тип
  - JSON поля коректно обробляються
  - Дати в правильному форматі

- [ ] **Протестувати з cURL**
  - `USE_SUPABASE=false` → тест SQLite
  - `USE_SUPABASE=true` → тест Supabase
  - Порівняти структуру відповідей

### Етап 3: Frontend адаптація

- [ ] **Знайти всі місця використання полів**
  - Пошук по `user.active`, `item.enabled`, etc.
  - Перевірити фільтрацію та умови
  
- [ ] **Адаптувати boolean логіку**
  - Замінити `=== 1` на `=== 1 || === true`
  - Замінити `=== 0` на `=== 0 || === false`
  
- [ ] **Перевірити JSON обробку**
  - Видалити зайві `JSON.parse()` якщо backend вже повертає об'єкт

---

## 🚨 Найчастіші помилки

### 1. "Unexpected token o in JSON at position 1"
**Причина**: Спроба `JSON.parse()` на об'єкті з Supabase  
**Рішення**: Перевіряти `typeof` перед парсінгом

### 2. "Отримано X користувачів, з них 0 активних"
**Причина**: Frontend фільтрує за `=== 1`, а Supabase повертає `true`  
**Рішення**: Підтримувати обидва формати в фільтрації

### 3. Порожні dropdown/списки
**Причина**: Змінився формат boolean полів  
**Рішення**: Оновити frontend логіку

---

## 📋 Обов'язкові перевірки для кожного сервісу

### В Backend коді

```javascript
// ✅ Правильна обробка JSON/JSONB
const permissions = typeof user.permissions === 'string' 
  ? JSON.parse(user.permissions || '{}') 
  : (user.permissions || {});

// ✅ Правильна обробка boolean
const useSupabase = process.env.USE_SUPABASE === 'true';
const activeValue = useSupabase ? true : 1;
const isActive = user.active === activeValue;
```

### В Frontend коді

```javascript
// ✅ Універсальна фільтрація boolean
const activeItems = items.filter(item => 
  item.active === 1 || item.active === true
);

// ✅ Безпечна перевірка boolean
const isActive = !!(item.active === 1 || item.active === true);
```

---

## 🔄 Алгоритм тестування міграції

1. **Створити тестові дані в обох БД**
2. **Запустити в SQLite режимі → зберегти результати**
3. **Переключити на Supabase → порівняти результати**
4. **Тестувати frontend → перевірити UI**
5. **Тестувати API endpoints → перевірити структуру відповідей**

---

## 📝 Чеклист для наступного агента

Перед роботою з новим сервісом:

- [ ] Прочитати цей документ повністю
- [ ] Визначити всі boolean поля в сервісі
- [ ] Знайти всі JSON поля в сервісі  
- [ ] Перевірити frontend використання цих полів
- [ ] Протестувати в обох режимах БД
- [ ] Оновити цей документ новими знахідками

---

**🎯 Головне правило**: ЗАВЖДИ тестувати з обома БД і перевіряти frontend!

---

*Цей документ оновлюється після кожної міграції сервісу*