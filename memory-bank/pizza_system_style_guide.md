# 🎨 Style Guide - Pizza Inventory Management System

## 📋 Загальна філософія дизайну

**Modern Business Application** - сучасний, професійний, зручний у використанні інтерфейс для виробничого обліку з акцентом на ефективність та читабельність.

**Принципи:**
- **Функціональність понад красою** - кожен елемент має практичне призначення
- **Консистентність** - однакові елементи виглядають та поводяться однаково
- **Ієрархія інформації** - важливе виділяється, другорядне відходить на задній план
- **Responsive-first** - дизайн працює на всіх пристроях
- **Accessibility** - доступність для всіх користувачів

---

## 🎨 Колірна палітра

### Основні кольори
```css
:root {
  --primary: #3498db;      /* Синій - основні дії, посилання */
  --success: #27ae60;      /* Зелений - успіх, позитивні дії */
  --warning: #f39c12;      /* Помаранчевий - попередження */
  --danger: #e74c3c;       /* Червоний - помилки, видалення */
  --info: #17a2b8;         /* Блакитний - інформація */
  --secondary: #6c757d;    /* Сірий - вторинні елементи */
}
```

### Нейтральні кольори
```css
:root {
  --background: #f5f6fa;   /* Світло-сірий фон */
  --surface: #ffffff;      /* Білий - картки, модальні вікна */
  --text-primary: #2c3e50; /* Темно-сірий - основний текст */
  --text-secondary: #7f8c8d; /* Сірий - допоміжний текст */
  --border: #e9ecef;       /* Світло-сірий - межі */
  --shadow: rgba(0,0,0,0.1); /* Тіні */
}
```

### Використання кольорів
- **Синій (#3498db)** - кнопки збереження, основні дії, активні елементи
- **Зелений (#27ae60)** - успішні операції, доступні товари, позитивні індикатори
- **Помаранчевий (#f39c12)** - попередження, терміни що закінчуються, увага
- **Червоний (#e74c3c)** - помилки, видалення, критичні стани
- **Сірий (#6c757d)** - скасування, вторинні дії, неактивні елементи

---

## 📝 Типографіка

### Шрифти
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
```

### Розміри тексту
```css
--font-size-xs: 0.75rem;    /* 12px - дрібні підписи */
--font-size-sm: 0.875rem;   /* 14px - допоміжний текст */
--font-size-base: 1rem;     /* 16px - основний текст */
--font-size-lg: 1.125rem;   /* 18px - підзаголовки */
--font-size-xl: 1.25rem;    /* 20px - заголовки секцій */
--font-size-2xl: 1.5rem;    /* 24px - заголовки сторінок */
--font-size-3xl: 2rem;      /* 32px - великі заголовки */
```

### Ієрархія заголовків
```css
h1 { font-size: 2rem; font-weight: 700; color: var(--text-primary); }
h2 { font-size: 1.5rem; font-weight: 600; color: var(--text-primary); }
h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
.section-title { font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 1rem; }
```

---

## 🧱 Компоненти UI

### Кнопки

#### Основні стилі
```css
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
```

#### Варіанти кнопок
```css
.btn-primary { background: var(--primary); color: white; }
.btn-success { background: var(--success); color: white; }
.btn-warning { background: var(--warning); color: white; }
.btn-danger { background: var(--danger); color: white; }
.btn-secondary { background: var(--secondary); color: white; }
```

#### Розміри кнопок
```css
.btn-small { padding: 0.5rem 1rem; font-size: 0.875rem; }
.btn-large { padding: 1rem 2rem; font-size: 1.125rem; }
```

#### Правила використання
- **Первинна дія** - `.btn-primary` або `.btn-success`
- **Деструктивна дія** - `.btn-danger`
- **Скасування** - `.btn-secondary`
- **Попередження** - `.btn-warning`
- Завжди додавайте **emoji** для кращого розпізнавання: `💾 Зберегти`, `❌ Скасувати`

### Форми

#### Структура форми
```html
<form>
  <div class="form-grid">
    <div class="form-group">
      <label for="field" class="required">Назва поля</label>
      <input type="text" id="field" name="field" placeholder="Підказка...">
      <small>Допоміжний текст</small>
    </div>
  </div>
</form>
```

#### Стилі форм
```css
.form-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem; 
}
.form-group { margin-bottom: 1rem; }
.form-group label { font-weight: bold; margin-bottom: 0.5rem; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border);
  border-radius: 6px;
  transition: all 0.3s ease;
}
```

#### Стани валідації
```css
.form-group.has-error input { border-color: var(--danger); }
.form-group.has-success input { border-color: var(--success); }
```

### Картки

#### Базова картка
```css
.card {
  background: var(--surface);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px var(--shadow);
  transition: all 0.3s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px var(--shadow);
}
```

### Таблиці

#### Структура
```html
<table class="table">
  <thead>
    <tr>
      <th>Заголовок</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Дані</td>
    </tr>
  </tbody>
</table>
```

#### Стилі
```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px var(--shadow);
}
.table th { 
  background: var(--background); 
  padding: 1rem; 
  text-align: left;
  font-weight: 600;
}
.table td { 
  padding: 1rem; 
  border-bottom: 1px solid var(--border); 
}
```

### Модальні вікна

#### Структура
```html
<div class="modal">
  <div class="modal-content modal-large">
    <div class="modal-header">
      <h2>Заголовок</h2>
      <span class="modal-close">&times;</span>
    </div>
    <div class="modal-body">
      <!-- Контент -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-success">Зберегти</button>
      <button class="btn btn-secondary">Скасувати</button>
    </div>
  </div>
</div>
```

---

## 📐 Відступи та розміри

### Система відступів (8px базова одиниця)
```css
--spacing-xs: 0.25rem;  /* 4px */
--spacing-sm: 0.5rem;   /* 8px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
--spacing-2xl: 3rem;    /* 48px */
```

### Правила відступів
- **Між елементами форми** - `1rem`
- **Між секціями** - `2rem`
- **Padding в картках** - `1.5rem`
- **Padding в кнопках** - `0.75rem 1.5rem`
- **Gap в grid** - `1rem`

### Радіуси закруглення
```css
--radius-sm: 4px;   /* Маленькі елементи */
--radius-md: 6px;   /* Кнопки, поля */
--radius-lg: 8px;   /* Картки, модальні вікна */
--radius-xl: 12px;  /* Великі контейнери */
```

---

## 🎭 Анімації та переходи

### Базові переходи
```css
transition: all 0.3s ease;
```

### Hover ефекти
```css
.interactive-element:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px var(--shadow);
}
```

### Анімації завантаження
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.loading { animation: pulse 2s infinite; }
```

---

## 📱 Адаптивний дизайн

### Breakpoints
```css
/* Mobile first подхід */
@media (min-width: 768px) { /* Планшети */ }
@media (min-width: 1024px) { /* Десктоп */ }
@media (min-width: 1280px) { /* Великі екрани */ }
```

### Адаптивні правила
- **Mobile-first** підхід
- **Картковий вигляд** таблиць на мобільних
- **Стек колонок** форм на маленьких екранах
- **Touch-friendly** кнопки (мінімум 44px)

---

## 🏷️ Іконки та емодзі

### Система іконок
Використовуємо **емодзі** для простоти та консистентності:

```
📋 Списки, замовлення
📦 Товари, партії
👥 Клієнти
🏭 Виробництво
📊 Статистика, звіти
⚙️ Налаштування
✅ Успіх, підтвердження
❌ Помилка, скасування
⚠️ Попередження
💾 Збереження
🗑️ Видалення
✏️ Редагування
👁️ Перегляд
🔍 Пошук
➕ Додавання
```

---

## 🎯 Стани та індикатори

### Статуси замовлень
```css
.status-new { background: #e3f2fd; color: #1976d2; }
.status-confirmed { background: #f3e5f5; color: #7b1fa2; }
.status-in_production { background: #fff3e0; color: #f57c00; }
.status-ready { background: #e8f5e8; color: #388e3c; }
.status-shipped { background: #e1f5fe; color: #0288d1; }
.status-completed { background: #e8f5e8; color: #2e7d32; }
```

### Індикатори доступності
```css
.available { color: var(--success); }
.low-stock { color: var(--warning); }
.out-of-stock { color: var(--danger); }
.expiring { background: #fff3cd; color: #856404; }
```

---

## ✅ Чек-лист для нових сторінок

### HTML структура
- [ ] Використовує семантичні теги
- [ ] Має правильну ієрархію заголовків
- [ ] Включає meta viewport для мобільних
- [ ] Підключає всі необхідні CSS файли

### CSS стилі
- [ ] Використовує CSS змінні для кольорів
- [ ] Має mobile-first медіа-запити
- [ ] Включає hover та focus стани
- [ ] Використовує систему відступів 8px

### JavaScript функціональність
- [ ] Має обробку помилок
- [ ] Використовує async/await
- [ ] Включає loading стани
- [ ] Має валідацію форм

### UX/UI
- [ ] Консистентні кнопки з емодзі
- [ ] Правильні кольори для дій
- [ ] Адаптивний дизайн
- [ ] Анімації переходів

---

## 🔧 Приклади коду

### Типова сторінка
```html
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Назва сторінки - Pizza Inventory</title>
    <link rel="stylesheet" href="/styles/main.css">
    <link rel="stylesheet" href="/styles/forms.css">
</head>
<body>
    <div class="container">
        <h1>🎯 Заголовок сторінки</h1>
        
        <div class="card">
            <!-- Контент -->
        </div>
    </div>
    
    <script src="/js/error-handler.js"></script>
    <script src="/js/navigation.js"></script>
</body>
</html>
```

### Типова форма
```html
<form class="modern-form">
    <div class="section-title">📝 Основна інформація</div>
    
    <div class="form-grid">
        <div class="form-group">
            <label for="name" class="required">Назва</label>
            <input type="text" id="name" name="name" required 
                   placeholder="Введіть назву...">
            <small>Допоміжний текст</small>
        </div>
    </div>
    
    <div class="form-actions">
        <button type="submit" class="btn btn-success">💾 Зберегти</button>
        <button type="button" class="btn btn-secondary">❌ Скасувати</button>
    </div>
</form>
```

---

## 🎨 Фінальні рекомендації

1. **Консистентність** - завжди використовуйте однакові патерни
2. **Функціональність** - кожен елемент має чітке призначення  
3. **Доступність** - дизайн працює для всіх користувачів
4. **Продуктивність** - мінімум JS, максимум CSS
5. **Масштабованість** - легко додавати нові компоненти

**Пам'ятайте:** це система для роботи, не арт-проект. Приоритет - зручність та ефективність користувачів! 🚀