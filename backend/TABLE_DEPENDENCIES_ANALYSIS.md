# 📊 Аналіз залежностей таблиць Pizza System

## 🎯 Мета
Визначити правильний порядок створення таблиць з урахуванням foreign key залежностей.

## 📋 Всі таблиці з database.js

### 🔥 КРИТИЧНІ ТАБЛИЦІ (мають бути першими)

#### 1. `users` - SELF-REFERENCING 
```sql
created_by INTEGER REFERENCES users(id)
```
**Проблема**: Посилається сама на себе!
**Рішення**: Створити першою, admin без created_by

#### 2. `products` - НЕЗАЛЕЖНА
**Залежності**: Немає
**Використовується в**: stock_movements, order_items, writeoffs, production, production_batches

#### 3. `clients` - НЕЗАЛЕЖНА  
**Залежності**: Немає
**Використовується в**: orders

### 🔗 ОСНОВНІ ТАБЛИЦІ (з FK залежностями)

#### 4. `production_settings` - НЕЗАЛЕЖНА
**Залежності**: Немає
**Особливість**: Singleton таблиця (1 запис)

#### 5. `production` - ЗАЛЕЖИТЬ ВІД products
```sql
product_id INTEGER REFERENCES products(id)
```

#### 6. `production_batches` - ЗАЛЕЖИТЬ ВІД products + production
```sql  
product_id INTEGER REFERENCES products(id)
production_id INTEGER REFERENCES production(id)
```

#### 7. `stock_movements` - ЗАЛЕЖИТЬ ВІД products, production_batches, users
```sql
product_id INTEGER REFERENCES products(id)
batch_id BIGINT REFERENCES production_batches(id)  # Додано пізніше
created_by_user_id BIGINT REFERENCES users(id)     # Додано пізніше
```

#### 8. `orders` - ЗАЛЕЖИТЬ ВІД clients, users
```sql
client_id INTEGER REFERENCES clients(id)
created_by_user_id BIGINT REFERENCES users(id)     # Додано пізніше
```

#### 9. `order_items` - ЗАЛЕЖИТЬ ВІД orders, products
```sql
order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE
product_id INTEGER REFERENCES products(id)
```

#### 10. `writeoffs` - ЗАЛЕЖИТЬ ВІД products, users
```sql
product_id INTEGER REFERENCES products(id)
created_by_user_id BIGINT REFERENCES users(id)     # Додано пізніше
```

### 📅 ПЛАНУВАННЯ ВИРОБНИЦТВА

#### 11. `production_plans` - ЗАЛЕЖИТЬ ВІД users
```sql
created_by_user_id BIGINT REFERENCES users(id)     # Додано пізніше
```

#### 12. `production_plan_items` - ЗАЛЕЖИТЬ ВІД production_plans, products, orders
```sql
plan_id INTEGER REFERENCES production_plans(id) ON DELETE CASCADE
product_id INTEGER REFERENCES products(id)
order_id INTEGER REFERENCES orders(id)
```

### 🔐 СИСТЕМА АУТЕНТИФІКАЦІЇ

#### 13. `user_sessions` - ЗАЛЕЖИТЬ ВІД users
```sql
user_id INTEGER REFERENCES users(id)
```

#### 14. `user_audit` - ЗАЛЕЖИТЬ ВІД users
```sql
user_id INTEGER REFERENCES users(id)
```

#### 15. `security_events` - ЗАЛЕЖИТЬ ВІД users  
```sql
user_id INTEGER REFERENCES users(id)
```

#### 16. `api_audit_log` - ЗАЛЕЖИТЬ ВІД users
```sql
user_id INTEGER REFERENCES users(id)
```

### 📦 ДОДАТКОВІ ТАБЛИЦІ (з міграцій)

#### 17. `arrivals` - ЗАЛЕЖИТЬ ВІД users
```sql
created_by_user_id BIGINT REFERENCES users(id)
```

#### 18. `arrivals_items` - ЗАЛЕЖИТЬ ВІД arrivals, products
```sql
arrival_id BIGINT REFERENCES arrivals(id) ON DELETE CASCADE
product_id BIGINT REFERENCES products(id)
```

#### 19. `operations_log` - ЗАЛЕЖИТЬ ВІД users
```sql
user_id BIGINT REFERENCES users(id)
```

## 🎯 ПРАВИЛЬНИЙ ПОРЯДОК СТВОРЕННЯ

### ГРУПА 1: Базові незалежні таблиці
```
001_create_users_table.sql          # ПЕРШОЮ! (self-referencing)
002_create_products_table.sql       # Базова для товарів
003_create_clients_table.sql        # Базова для клієнтів  
004_create_production_settings_table.sql # Singleton конфігурація
```

### ГРУПА 2: Виробництво та партії  
```
005_create_production_table.sql     # Залежить від products
006_create_production_batches_table.sql # Залежить від products + production
```

### ГРУПА 3: Рухи запасів
```
007_create_stock_movements_table.sql # Залежить від products + production_batches + users
```

### ГРУПА 4: Замовлення
```
008_create_orders_table.sql         # Залежить від clients + users
009_create_order_items_table.sql    # Залежить від orders + products
```

### ГРУПА 5: Списання
```
010_create_writeoffs_table.sql      # Залежить від products + users
```

### ГРУПА 6: Планування виробництва
```
011_create_production_plans_table.sql     # Залежить від users
012_create_production_plan_items_table.sql # Залежить від production_plans + products + orders
```

### ГРУПА 7: Аутентифікація та аудит
```
013_create_user_sessions_table.sql   # Залежить від users
014_create_user_audit_table.sql     # Залежить від users  
015_create_security_events_table.sql # Залежить від users
016_create_api_audit_log_table.sql  # Залежить від users
```

### ГРУПА 8: Надходження
```
017_create_arrivals_table.sql       # Залежить від users
018_create_arrivals_items_table.sql # Залежить від arrivals + products
```

### ГРУПА 9: Операційні логи
```
019_create_operations_log_table.sql # Залежить від users
```

## 🚨 КРИТИЧНІ МОМЕНТИ

### 1. Self-referencing в users
- Створити першу з `created_by` як nullable
- Заповнити admin користувача з `created_by = NULL` або `created_by = 1`

### 2. Додаткові поля в існуючих таблицях
Багато таблиць мають додаткові поля `created_by_user_id`, яких немає в початковій схемі:
- stock_movements
- orders  
- writeoffs
- production_plans
- arrivals
- operations_log

### 3. production_batches  
Ця таблиця взагалі відсутня в початковій схемі, але активно використовується в коді.

## ✅ ВИСНОВКИ

1. **users** має бути ПЕРШОЮ таблицею
2. Поточний порядок потрібно переробити
3. Додати відсутні таблиці з міграцій
4. Врахувати всі user_id посилання для аудиту

**НАСТУПНИЙ КРОК**: Переробити порядок створення таблиць