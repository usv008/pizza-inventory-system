# 🎨 SIMPLE MIGRATION DESIGN

## 🎯 ЦІЛІ CREATIVE PHASE
**Головна мета:** Максимально просто перейти з SQLite на Supabase
**Принцип:** Не вигадувати зайвого, йти за планом

## 🔧 НЕОБХІДНІ ДОСЛІДЖЕННЯ

### 1. ТІЛЬКИ КРИТИЧНІ ПОЛЯ
Додати до Supabase ТІЛЬКИ ті поля SQLite, що реально використовуються:

**stock_movements** (критично - таблиця порожня):
```sql
ALTER TABLE stock_movements ADD COLUMN pieces INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN user TEXT DEFAULT 'system';
```

**products** (поля для сумісності):
```sql
ALTER TABLE products ADD COLUMN stock_pieces INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_boxes INTEGER DEFAULT 0;
```

### 2. RLS ВІДКЛЮЧЕННЯ
```sql
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

### 3. ПРОСТИЙ MAPPING СЕРВІС
Один простий файл для поле mapping:

```javascript
// utils/fieldMapper.js
const mapProductToSupabase = (sqliteProduct) => ({
  ...sqliteProduct,
  current_stock: sqliteProduct.stock_pieces,
  is_active: sqliteProduct.active || true
});

const mapProductFromSupabase = (supabaseProduct) => ({
  ...supabaseProduct,
  stock_pieces: supabaseProduct.current_stock,
  active: supabaseProduct.is_active
});
```

## 🚀 IMPLEMENTATION GUIDELINES

### Крок 1: Виправити schema (5 хв)
- Додати критичні поля в Supabase
- Відключити RLS

### Крок 2: Оновити MovementService (10 хв)
- Замінити SQLite запити на Supabase
- Додати basic mapping

### Крок 3: Тестування (5 хв)
- Перевірити stock movements
- Базові CRUD операції

## ✅ VERIFICATION
- [ ] stock_movements працює з Supabase
- [ ] Дані записуються без помилок RLS
- [ ] Базова функціональність збережена

---
**ТВОРЧА ФАЗА ЗАВЕРШЕНА**
**Результат:** Простий план міграції без зайвих ускладнень
