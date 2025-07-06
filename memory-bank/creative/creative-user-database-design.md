# 🎨🎨🎨 ENTERING CREATIVE PHASE: DATABASE DESIGN

## Component Description
Розробка схеми бази даних для системи управління користувачами піца-системи з підтримкою ролей, прав доступу та безпеки.

## Requirements & Constraints

### Функціональні вимоги:
- Збереження користувацьких даних (username, email, phone, password_hash)
- Система ролей (Директор, Завідуючий виробництвом, Бухгалтер, Пакувальник, Комірник, Менеджер з продажів)
- Гнучка система прав доступу (чекбокси)
- Першочергове створення пароля
- Відслідковування операцій (user_id в існуючих таблицях)
- Управління сесіями

### Технічні обмеження:
- Використання SQLite3 (існуючий)
- Сумісність з поточною схемою БД
- Безпека паролів (bcrypt)
- Мінімальний downtime при міграції

## Multiple Options Analysis

### Option 1: Централізована таблиця users з JSON permissions
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NULL,
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    permissions TEXT NOT NULL DEFAULT '{}', -- JSON для чекбоксів
    first_login INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users (id)
);
```

**Pros:**
- Простота реалізації
- Швидкий доступ до даних користувача
- Гнучкість в налаштуванні прав (JSON)
- Мінімальна кількість JOIN операцій

**Cons:**
- Складність валідації JSON права
- Неможливість використання foreign keys для прав
- Складність звітності по правам
- Проблеми з міграцією при зміні структури прав

### Option 2: Нормалізована структура (users, roles, permissions, user_permissions)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NULL,
    role_id INTEGER NOT NULL,
    first_login INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (role_id) REFERENCES roles (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);
```

**Pros:**
- Повна нормалізація, підтримка foreign keys
- Легка звітність та аналіз прав
- Простота додавання нових прав
- Гнучкість в управлінні ролями

**Cons:**
- Складність запитів (багато JOIN)
- Більша кількість таблиць
- Складність початкового налаштування
- Потенційна повільність при перевірці прав

### Option 3: Гібридний підхід (role-based + individual permissions)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NULL,
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    additional_permissions TEXT DEFAULT '{}', -- JSON для індивідуальних прав
    first_login INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE role_permissions (
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    PRIMARY KEY (role, permission)
);

CREATE TABLE permissions (
    name TEXT PRIMARY KEY,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Pros:**
- Збалансованість між простотою та гнучкістю
- Швидкий доступ до базових прав через роль
- Можливість додавання індивідуальних прав
- Простота запитів для стандартних ролей

**Cons:**
- Дублювання логіки (роль + додаткові права)
- Складність валідації конфліктів прав
- Потенційна плутанина в управлінні

## Recommended Approach

**Обрано: Option 1 - Централізована таблиця users з JSON permissions**

### Обґрунтування:
1. **Простота реалізації** - найменша кількість змін у поточній архітектурі
2. **Продуктивність** - мінімум JOIN операцій при перевірці прав
3. **Гнучкість** - легко додавати нові права без зміни схеми
4. **Зворотня сумісність** - легко адаптувати існуючі сервіси

### Схема майбутньої міграції:
Якщо система розростеться, можна буде мігрувати на Option 2 з мінімальними змінами в API.

## Implementation Guidelines

### 1. Структура таблиць
```sql
-- Основна таблиця користувачів
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NULL, -- NULL для першого входу
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    permissions TEXT NOT NULL DEFAULT '{}', -- JSON для чекбоксів
    first_login INTEGER DEFAULT 1, -- 1 = перший вхід
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Таблиця сесій
CREATE TABLE user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Таблиця аудиту користувачів
CREATE TABLE user_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE'
    details TEXT, -- JSON з деталями
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### 2. Структура JSON permissions
```json
{
  "orders": {
    "read": true,
    "write": true,
    "create": true,
    "delete": false
  },
  "production": {
    "read": true,
    "write": true
  },
  "writeoffs": {
    "read": true,
    "write": true
  },
  "arrivals": {
    "read": true,
    "write": false
  },
  "products": {
    "create": false
  },
  "operations": {
    "delete": false
  },
  "admin": {
    "all_rights": false
  }
}
```

### 3. Предзавантажені ролі та права
```sql
-- Початкові права для кожної ролі
INSERT INTO users (username, email, role, permissions) VALUES 
('admin', 'admin@pizza.com', 'ДИРЕКТОР', '{"admin": {"all_rights": true}}'),
('manager', 'manager@pizza.com', 'ЗАВІДУЮЧИЙ_ВИРОБНИЦТВОМ', 
 '{"production": {"read": true, "write": true}, "writeoffs": {"read": true, "write": true}, "arrivals": {"read": true, "write": true}}');
```

### 4. Індекси для продуктивності
```sql
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

### 5. Міграція існуючих таблиць
```sql
-- Додати user_id до всіх існуючих таблиць операцій
ALTER TABLE orders ADD COLUMN created_by INTEGER;
ALTER TABLE production_batches ADD COLUMN created_by INTEGER;
ALTER TABLE writeoffs ADD COLUMN created_by INTEGER;
ALTER TABLE arrivals ADD COLUMN created_by INTEGER;
ALTER TABLE movements ADD COLUMN created_by INTEGER;

-- Додати foreign keys (можливо потрібно пересоздать таблицю в SQLite)
-- SQLite не підтримує ADD CONSTRAINT, тому потрібен більш складний підхід
```

## Verification Checkpoint

### Перевірка відповідності вимогам:
- [x] Підтримка всіх ролей піцерії
- [x] Гнучкі права доступу через JSON
- [x] Безпека паролів (hash поле)
- [x] Першочергове створення пароля (first_login)
- [x] Аудит та відслідковування
- [x] Управління сесіями
- [x] Зворотня сумісність з існуючою архітектурою

### Технічна реалізованість:
- [x] Сумісність з SQLite3
- [x] Мінімальні зміни в поточній архітектурі
- [x] Підтримка існуючих операцій
- [x] Простота розширення

### Оцінка ризиків:
- **Низький ризик** - використання знайомих технологій
- **Середній ризик** - міграція існуючих даних
- **Контроль ризиків** - поетапне впровадження

# 🎨🎨🎨 EXITING CREATIVE PHASE: DATABASE DESIGN
