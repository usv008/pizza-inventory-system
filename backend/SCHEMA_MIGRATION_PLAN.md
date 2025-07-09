# 📋 ДЕТАЛЬНИЙ ПЛАН МІГРАЦІЇ СХЕМ

## 🎯 ПЛАН ПО ЕТАПАХ

### **ЕТАП 1: УНІФІКАЦІЯ СХЕМ (CREATIVE PHASE)**
**Тривалість:** 30-45 хвилин  
**Мета:** Створити unified schema для всіх таблиць

#### 1.1 PRODUCTS TABLE УНІФІКАЦІЯ
```sql
-- Додати до Supabase відсутні поля:
ALTER TABLE products ADD COLUMN weight REAL;
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN pieces_per_box INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN stock_pieces INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_boxes INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN min_stock_pieces INTEGER DEFAULT 0;

-- Створити mapping функції для дублюючих полів:
current_stock ↔ stock_pieces
min_stock_level ↔ min_stock_pieces
```

#### 1.2 STOCK_MOVEMENTS СТРУКТУРА
```sql
-- Додати відсутні поля:
ALTER TABLE stock_movements ADD COLUMN pieces INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN batch_id INTEGER;
ALTER TABLE stock_movements ADD COLUMN batch_date DATE;
ALTER TABLE stock_movements ADD COLUMN created_by_user_id INTEGER;
ALTER TABLE stock_movements ADD COLUMN user TEXT DEFAULT 'system';
```

#### 1.3 USERS TABLE УНІФІКАЦІЯ
```sql
-- Додати відсутні поля:
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN first_login INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN created_by INTEGER;
ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'supabase';
```

### **ЕТАП 2: DATA MAPPING LAYER (CREATIVE PHASE)**
**Тривалість:** 20-30 хвилин  
**Мета:** Створити адаптери для різних структур

#### 2.1 Створити mapping utilities:
```javascript
// utils/schemaMapper.js
const SQLiteToSupabaseMapper = {
  products: {
    stock_pieces: 'current_stock',
    min_stock_pieces: 'min_stock_level'
  },
  users: {
    active: 'is_active'
  }
}
```

#### 2.2 Адаптер сервіси:
```javascript
// services/adapters/productAdapter.js
class ProductAdapter {
  toSupabase(sqliteData) { /* mapping logic */ }
  fromSupabase(supabaseData) { /* reverse mapping */ }
}
```

### **ЕТАП 3: RLS НАЛАШТУВАННЯ (IMPLEMENT PHASE)**
**Тривалість:** 15 хвилин  
**Мета:** Розблокувати всі операції

```sql
-- Тимчасове вимкнення RLS для розробки:
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE writeoffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE production DISABLE ROW LEVEL SECURITY;
```

### **ЕТАП 4: ПОСТУПОВА МІГРАЦІЯ СЕРВІСІВ**
**Тривалість:** 2-3 години  
**Мета:** Мігрувати по одному сервісу

#### Фаза 1: Прості сервіси (30 хв)
- [ ] MovementService (готовий)
- [ ] ClientService  

#### Фаза 2: Середні сервіси (45 хв)
- [ ] UserService (складна schema)
- [ ] ProductService (подвійні поля)

#### Фаза 3: Складні сервіси (60 хв)  
- [ ] OrderService (зв'язки)
- [ ] ProductionService

### **ЕТАП 5: DATA MIGRATION (IMPLEMENT PHASE)**
**Тривалість:** 30-45 хвилин  
**Мета:** Перенести існуючі дані

#### 5.1 Backup існуючих даних Supabase
#### 5.2 Міграція по таблицях:
1. Products (16 записів Supabase + SQLite)
2. Users (14 записів Supabase + SQLite) 
3. Orders (30 записів Supabase + SQLite)
4. Stock_movements (0 записів + всі SQLite)
5. Production/Writeoffs

## 🎯 ПРІОРИТЕТИ

### **КРИТИЧНИЙ ШЛЯХ:**
1. ✅ RLS відключення (5 хв)
2. 🎨 Schema унніфікація (CREATIVE - 45 хв)
3. ⚡ MovementService міграція (IMPLEMENT - 15 хв)
4. 📊 Тестування базової функціональності (10 хв)

### **НАСТУПНІ КРОКИ:**
1. ProductService з unified mapping (30 хв)
2. UserService з dual auth support (30 хв)  
3. OrderService з відношеннями (45 хв)

## 🚨 РИЗИКИ ТА МІТІГАЦІЇ

### **Ризик 1: Втрата даних**
**Мітігація:** Backup перед кожним кроком

### **Ризик 2: Конфлікти схем**
**Мітігація:** Mapping layer з fallback logic

### **Ризик 3: Downtime**
**Мітігація:** Поступова міграція зі збереженням SQLite

## 🎯 SUCCESS METRICS

### **Етап 1 успішний якщо:**
- [ ] Всі таблиці мають unified structure
- [ ] RLS вимкнено і вставки працюють
- [ ] MovementService тестується успішно

### **Повна міграція успішна якщо:**
- [ ] Всі CRUD операції працюють через Supabase
- [ ] Дані перенесені без втрат  
- [ ] SQLite backup збережений
- [ ] Performance не погіршився

## 🚀 ГОТОВНІСТЬ ДО ВИКОНАННЯ

**Поточний статус:** ✅ Аналіз завершений  
**Наступний крок:** CREATIVE mode для schema design  
**Рекомендація:** Почати з RLS + MovementService  

**Команда для початку:**
```
CREATIVE
```
