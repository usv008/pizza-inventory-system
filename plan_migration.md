# 🗄️ Детальний план міграції з SQLite на Supabase

## 📋 Загальна інформація

**Supabase підключення**:
- URL: `https://wncukuajzygzyasofyoe.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTQxOTEsImV4cCI6MjA2NDA5MDE5MX0.KG6dnuxlnnX_haXI7LEvJNc8wTXX2GT_cd07DlYALJ4`
- Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUxNDE5MSwiZXhwIjoyMDY0MDkwMTkxfQ.arten1xRuJicEJEY7mHuet7eQqjuTb24VLwTtcB91yM`

**Всього таблиць для міграції**: **19 таблиць**

**Статус**: 🔄 В процесі розробки

---

## 📊 Етапи міграції (покроковий план)

### 🔧 ЕТАП 0: Підготовка інфраструктури

#### ✅ Крок 0.1: Тестування з'єднання з Supabase
```javascript
// Створити файл test-supabase-connection.js
// Перевірити доступ до бази
```
**Статус**: ⏳ Очікує виконання

#### ⏳ Крок 0.2: Встановити Supabase клієнт
```bash
npm install @supabase/supabase-js
```
**Статус**: ⏳ Очікує виконання

---

### 🏗️ ЕТАП 1: Базові довідникові таблиці

#### **Крок 1: products (Товари)** - ПРИОРИТЕТ 1 🔴
**Залежності**: Немає (база для всіх інших таблиць)
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    weight DECIMAL(10,2) NOT NULL,
    barcode TEXT UNIQUE,
    pieces_per_box INTEGER NOT NULL DEFAULT 1,
    stock_pieces INTEGER DEFAULT 0,
    stock_boxes INTEGER DEFAULT 0,
    min_stock_pieces INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
```

**Тестові дані**:
```sql
INSERT INTO products (name, code, weight, barcode, pieces_per_box, stock_pieces, stock_boxes, min_stock_pieces) 
VALUES 
('Піца Маргарита', 'PM001', 350, '4820000001234', 12, 144, 12, 24),
('Піца Пепероні', 'PP002', 380, '4820000001241', 12, 96, 8, 36),
('Піца Гавайська', 'PH003', 400, '4820000001258', 10, 50, 5, 20),
('Піца Чотири Сири', 'PC004', 420, '4820000001265', 8, 32, 4, 16);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Вставка тестових даних
- [ ] Перевірка унікальних обмежень
- [ ] Тестування індексів

---

#### **Крок 2: clients (Клієнти)** - ПРИОРИТЕТ 1 🔴
**Залежності**: Немає
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_active ON clients(is_active);
```

**Тестові дані**:
```sql
INSERT INTO clients (name, contact_person, phone, email, address) 
VALUES ('Тестовий клієнт', 'Іван Петренко', '+380501234567', 'test@example.com', 'м. Київ');
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Вставка тестових даних
- [ ] Перевірка soft delete (is_active)

---

### 🔐 ЕТАП 2: Система користувачів і безпеки

#### **Крок 3: users (Користувачі)** - ПРИОРИТЕТ 1 🔴
**Залежності**: Немає (self-referencing)
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    permissions JSONB DEFAULT '{}'::jsonb,
    first_login BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);
```

**Тестові дані**:
```sql
INSERT INTO users (id, username, password_hash, role, permissions, first_login, active) 
VALUES (1, 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ДИРЕКТОР', '{}'::jsonb, FALSE, TRUE);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Вставка адміністратора
- [ ] Перевірка self-referencing FK
- [ ] Тестування JSONB permissions

---

#### **Крок 4: user_sessions (Сесії)** - ПРИОРИТЕТ 2 🟡
**Залежності**: users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- Індекси
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(active);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування FK до users
- [ ] Перевірка INET типу для IP

---

### 📈 ЕТАП 3: Основні операційні таблиці

#### **Крок 5: orders (Замовлення)** - ПРИОРИТЕТ 1 🔴
**Залежності**: clients, users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    client_id BIGINT REFERENCES clients(id),
    client_name TEXT NOT NULL,
    client_contact TEXT,
    order_date DATE NOT NULL,
    delivery_date DATE,
    status TEXT DEFAULT 'NEW',
    total_quantity INTEGER DEFAULT 0,
    total_boxes INTEGER DEFAULT 0,
    notes TEXT,
    created_by TEXT DEFAULT 'system',
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client_id ON orders(client_id);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування FK до clients та users
- [ ] Перевірка унікального order_number

---

#### **Крок 6: order_items (Позиції замовлень)** - ПРИОРИТЕТ 1 🔴
**Залежності**: orders, products
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    pieces INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    produced_quantity INTEGER DEFAULT 0,
    notes TEXT,
    allocated_batches JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування CASCADE DELETE
- [ ] Перевірка JSONB allocated_batches

---

### 🏭 ЕТАП 4: Виробничі таблиці

#### **Крок 7: production (Виробництво)** - ПРИОРИТЕТ 2 🟡
**Залежності**: products, users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE production (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    production_date DATE NOT NULL,
    production_time TIME,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    responsible TEXT DEFAULT 'system',
    notes TEXT,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_production_product_id ON production(product_id);
CREATE INDEX idx_production_date ON production(production_date);
CREATE INDEX idx_production_expiry ON production(expiry_date);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування TIME типу
- [ ] Перевірка FK constraints

---

#### **Крок 8: production_batches (Партії)** - ПРИОРИТЕТ 2 🟡
**Залежності**: products, production
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE production_batches (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_date DATE NOT NULL,
    production_date DATE NOT NULL,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    expiry_date DATE NOT NULL,
    production_id BIGINT REFERENCES production(id),
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, batch_date)
);

-- Індекси
CREATE INDEX idx_production_batches_product_batch ON production_batches(product_id, batch_date);
CREATE INDEX idx_production_batches_expiry_status ON production_batches(expiry_date, status);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Перевірка UNIQUE constraint
- [ ] Тестування FIFO логіки

---

### 📦 ЕТАП 5: Управління запасами

#### **Крок 9: stock_movements (Рухи запасів)** - ПРИОРИТЕТ 1 🔴
**Залежності**: products, production_batches, users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    movement_type TEXT NOT NULL,
    pieces INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    reason TEXT,
    user_name TEXT DEFAULT 'system',
    batch_id BIGINT REFERENCES production_batches(id),
    batch_date DATE,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування всіх FK
- [ ] Перевірка індексів для продуктивності

---

#### **Крок 10: writeoffs (Списання)** - ПРИОРИТЕТ 2 🟡
**Залежності**: products, users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE writeoffs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    writeoff_date DATE NOT NULL,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índекси
CREATE INDEX idx_writeoffs_product ON writeoffs(product_id);
CREATE INDEX idx_writeoffs_date ON writeoffs(writeoff_date);
```

**Тестування**: 
- [ ] Створення таблиці
- [ ] Тестування FK до products
- [ ] Перевірка обов'язкових полів

---

### 📋 ЕТАП 6: Планування виробництва

#### **Крок 11: production_plans (Плани виробництва)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users
**Статус**: ⏳ Очікує виконання

**PostgreSQL DDL**:
```sql
CREATE TABLE production_plans (
    id BIGSERIAL PRIMARY KEY,
    plan_date DATE NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    total_planned INTEGER DEFAULT 0,
    total_produced INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    notes TEXT,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 12: production_plan_items (Позиції планів)** - ПРИОРИТЕТ 3 🟢
**Залежності**: production_plans, products, orders

**PostgreSQL DDL**:
```sql
CREATE TABLE production_plan_items (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity_needed INTEGER NOT NULL,
    quantity_planned INTEGER NOT NULL,
    quantity_produced INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'MEDIUM',
    reason TEXT DEFAULT 'OTHER',
    order_id BIGINT REFERENCES orders(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 13: production_settings (Налаштування виробництва)** - ПРИОРИТЕТ 3 🟢

**PostgreSQL DDL**:
```sql
CREATE TABLE production_settings (
    id BIGSERIAL PRIMARY KEY,
    daily_capacity INTEGER DEFAULT 500,
    working_hours INTEGER DEFAULT 8,
    min_batch_size INTEGER DEFAULT 10,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    settings_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Дефолтні налаштування
INSERT INTO production_settings (id, daily_capacity, working_hours, min_batch_size) 
VALUES (1, 500, 8, 10);
```

---

### 📦 ЕТАП 7: Управління надходженнями

#### **Крок 14: arrivals (Надходження)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users

**PostgreSQL DDL**:
```sql
CREATE TABLE arrivals (
    id BIGSERIAL PRIMARY KEY,
    arrival_number TEXT UNIQUE NOT NULL,
    arrival_date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT DEFAULT 'system',
    created_by_user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 15: arrivals_items (Позиції надходжень)** - ПРИОРИТЕТ 3 🟢
**Залежності**: arrivals, products

**PostgreSQL DDL**:
```sql
CREATE TABLE arrivals_items (
    id BIGSERIAL PRIMARY KEY,
    arrival_id BIGINT NOT NULL REFERENCES arrivals(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    batch_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 🔍 ЕТАП 8: Аудит і логування

#### **Крок 16: user_audit (Аудит користувачів)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users

**PostgreSQL DDL**:
```sql
CREATE TABLE user_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id BIGINT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 17: security_events (Події безпеки)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users

**PostgreSQL DDL**:
```sql
CREATE TABLE security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id),
    ip_address INET,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 18: api_audit_log (Лог API)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users

**PostgreSQL DDL**:
```sql
CREATE TABLE api_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status_code INTEGER,
    duration INTEGER,
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Крок 19: operations_log (Лог операцій)** - ПРИОРИТЕТ 3 🟢
**Залежності**: users

**PostgreSQL DDL**:
```sql
CREATE TABLE operations_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,
    operation_id BIGINT,
    entity_type TEXT NOT NULL,
    entity_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    description TEXT NOT NULL,
    user_name TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧪 План тестування для кожної таблиці

### Для кожного кроку:

1. **Створення таблиці** ✅ - SQL DDL у Supabase Dashboard
2. **Тестування вставки** ✅ - Додати 1-2 тестових записи
3. **Тестування зв'язків** ✅ - Перевірити FK constraints
4. **Тестування запитів** ✅ - Основні SELECT операції
5. **Тестування індексів** ✅ - Перевірити продуктивність
6. **Тестування RLS** ✅ - Налаштувати Row Level Security
7. **Код-тест** ✅ - Оновити відповідний сервіс для роботи з Supabase

---

## 📌 Ключові особливості міграції

### SQLite → PostgreSQL перетворення:

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` |
| `INTEGER` boolean | `BOOLEAN` |
| `TEXT` JSON | `JSONB` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| IP в TEXT | `INET` |
| `REAL` | `DECIMAL(10,2)` |

### Важливі нотатки:

1. **JSONB**: Для allocated_batches, permissions, details
2. **TIMESTAMPTZ**: Для всіх timestamp полів
3. **INET**: Для IP адрес
4. **CASCADE DELETE**: Для залежних записів
5. **UNIQUE constraints**: Збережені з SQLite
6. **Self-referencing FK**: users.created_by

---

## 🎯 Поточний статус

**Готово**: 
- ✅ Аналіз схеми SQLite
- ✅ План міграції
- ✅ DDL скрипти для PostgreSQL

**Наступні кроки**: 
1. 🔧 Тестування підключення до Supabase
2. 🏗️ Створення таблиці `products` 
3. 📊 Тестування першої таблиці

**Прогрес**: 0/19 таблиць створено

---

*Останнє оновлення: 22.07.2025*