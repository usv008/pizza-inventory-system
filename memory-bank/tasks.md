# PIZZA SYSTEM - SUPABASE DATABASE MIGRATION
**Complexity Level:** 2 (Simple Enhancement)  
**Current Mode:** VAN (Analysis & Planning)  
**Status:** 🔄 Аналізуємо поточну систему для міграції на Supabase

## 🎯 ЗАДАЧА
Максимально просто переключити базу даних з SQLite на Supabase без додаткових лишніх фіч. Просто зробити копію БД та переключити всі маршрути з SQL на Supabase.

## 📋 ПОТОЧНИЙ СТАН СИСТЕМИ

### Database Structure (SQLite)
```
📂 backend/
├── pizza_inventory.db (440KB) - основна БД
├── database.js (60KB, 1380 lines) - конфігурація та запити
├── services/ - 8 сервісів з бізнес-логікою
└── routes/ - API маршрути
```

### Основні таблиці в БД:
1. **products** - товари (піца)
2. **stock_movements** - рухи складу  
3. **clients** - клієнти
4. **orders** - замовлення
5. **order_items** - позиції замовлень
6. **writeoffs** - списання
7. **production** - виробництво
8. **production_plans** - плани виробництва
9. **production_plan_items** - позиції планів
10. **production_settings** - налаштування
11. **users** - користувачі (нова система авторизації)
12. **user_sessions** - сесії користувачів
13. **user_audit** - аудит дій користувачів

### Сервіси (Services Layer):
- **authService.js** - авторизація
- **userService.js** - користувачі  
- **productService.js** - товари
- **clientService.js** - клієнти
- **orderService.js** - замовлення
- **productionService.js** - виробництво
- **writeoffService.js** - списання
- **movementService.js** - рухи складу
- **permissionService.js** - дозволи

## 🔄 ПЛАН МІГРАЦІЇ НА SUPABASE

### Етап 1: Підготовка Supabase проекту
- [ ] Створити Supabase проект
- [ ] Отримати URL і API ключі
- [ ] Налаштувати змінні середовища

### Етап 2: Експорт даних з SQLite  
- [ ] Створити скрипт експорту даних з pizza_inventory.db
- [ ] Зберегти дані у JSON/CSV форматі
- [ ] Перевірити цілісність експортованих даних

### Етап 3: Створення схеми в Supabase
- [ ] Створити таблиці в Supabase (копія SQLite схеми)
- [ ] Налаштувати зв'язки між таблицями
- [ ] Встановити індекси та обмеження

### Етап 4: Імпорт даних в Supabase
- [ ] Завантажити експортовані дані в Supabase
- [ ] Перевірити цілісність імпортованих даних
- [ ] Протестувати основні запити

### Етап 5: Оновлення backend коду
- [ ] Встановити @supabase/supabase-js
- [ ] Замінити database.js на supabase client
- [ ] Оновити всі сервіси для роботи з Supabase
- [ ] Оновити API маршрути

### Етап 6: Тестування
- [ ] Протестувати всі API endpoints
- [ ] Перевірити frontend функціональність
- [ ] Провести повне тестування системи

### Етап 7: Деплой
- [ ] Створити backup поточної системи
- [ ] Деплой нової версії з Supabase
- [ ] Перевірка в продакшені

## 📝 ТЕХНІЧНІ ДЕТАЛІ

### Поточна архітектура:
```javascript
// Поточний database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pizza_inventory.db');

// Приклад запиту
function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM products', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
```

### Цільова архітектура:
```javascript
// Новий supabase client
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Приклад запиту
async function getAllProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*');
    
    if (error) throw error;
    return data;
}
```

## 🎲 ГОТОВНІСТЬ ДО СТАРТУ
Поточна система повністю функціональна:
- ✅ Всі 8 модулів працюють (100%)
- ✅ База даних стабільна
- ✅ API endpoints протестовані  
- ✅ Frontend інтегрований
- ✅ Система авторизації працює

**Готові розпочати міграцію на Supabase!** 🚀

## 📊 ПРОГРЕС МІГРАЦІЇ

### ✅ Етап 1: Підготовка Supabase (ЗАВЕРШЕНО)
- ✅ Створено проект: pizza-system-supa
- ✅ Отримано URL та API ключі
- ✅ Створено .env файл з конфігурацією
- ✅ Встановлено @supabase/supabase-js та dotenv
- ✅ Тестування підключення - успішно!

### ✅ Етап 2: Експорт даних з SQLite (ЗАВЕРШЕНО)
- ✅ Створено скрипт export-sqlite-data.js
- ✅ Експортовано 479 записів з 13 таблиць:
  - products: 15 записів
  - stock_movements: 115 записів
  - clients: 12 записів
  - orders: 31 записів
  - order_items: 82 записів
  - writeoffs: 50 записів
  - production: 48 записів
  - production_plans: 3 записів
  - production_plan_items: 6 записів
  - production_settings: 1 записів
  - users: 15 записів
  - user_sessions: 0 записів
  - user_audit: 101 записів
- ✅ Дані збережено у sqlite-export.json

### 🔄 Етап 3: Створення схеми в Supabase (В ПРОЦЕСІ)
- ✅ Створено SQL файл schema.sql з повною схемою
- ✅ Конвертовано SQLite структуру в PostgreSQL
- ✅ Додано індекси для продуктивності
- ⏳ **ПОТРІБНО**: Виконати schema.sql через Supabase Dashboard

### ⏳ Наступні етапи:
4. Імпорт даних в Supabase
5. Оновлення backend коду
6. Тестування
7. Деплой

## 📝 ІНСТРУКЦІЇ ДЛЯ СТВОРЕННЯ СХЕМИ

**Крок 1**: Перейди на https://supabase.com/dashboard/project/wncukuajzygzyasofyoe
**Крок 2**: Відкрий SQL Editor
**Крок 3**: Скопіюй вміст файлу `backend/schema.sql` та виконай
**Крок 4**: Перевір що всі 13 таблиць створено успішно

Після створення схеми зможемо продовжити з імпорту даних!
