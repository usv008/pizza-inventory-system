-- PIZZA SYSTEM - SUPABASE SCHEMA
-- Конвертація з SQLite в PostgreSQL

-- Таблиця товарів
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    weight REAL NOT NULL,
    barcode TEXT UNIQUE,
    pieces_per_box INTEGER NOT NULL DEFAULT 1,
    stock_pieces INTEGER DEFAULT 0,
    stock_boxes INTEGER DEFAULT 0,
    min_stock_pieces INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця рухів складу
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    movement_type TEXT NOT NULL,
    pieces INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    reason TEXT,
    "user" TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця клієнтів
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця замовлень
CREATE TABLE IF NOT EXISTS orders (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця позицій замовлень
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    pieces INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    produced_quantity INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця списань
CREATE TABLE IF NOT EXISTS writeoffs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    writeoff_date DATE NOT NULL,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця виробництва
CREATE TABLE IF NOT EXISTS production (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    production_date DATE NOT NULL,
    production_time TEXT,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    responsible TEXT DEFAULT 'system',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця планів виробництва
CREATE TABLE IF NOT EXISTS production_plans (
    id BIGSERIAL PRIMARY KEY,
    plan_date DATE NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    total_planned INTEGER DEFAULT 0,
    total_produced INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця позицій планів виробництва
CREATE TABLE IF NOT EXISTS production_plan_items (
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

-- Таблиця налаштувань виробництва
CREATE TABLE IF NOT EXISTS production_settings (
    id BIGSERIAL PRIMARY KEY,
    daily_capacity INTEGER DEFAULT 500,
    working_hours INTEGER DEFAULT 8,
    min_batch_size INTEGER DEFAULT 10,
    cost_per_unit REAL DEFAULT 0,
    settings_json TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця користувачів
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    permissions TEXT DEFAULT '{}',
    first_login INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця сесій користувачів
CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    active INTEGER DEFAULT 1
);

-- Таблиця аудиту користувачів
CREATE TABLE IF NOT EXISTS user_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id BIGINT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для покращення продуктивності
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_writeoffs_product_id ON writeoffs(product_id);
CREATE INDEX IF NOT EXISTS idx_production_product_id ON production(product_id);
CREATE INDEX IF NOT EXISTS idx_production_production_date ON production(production_date);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_user_id ON user_audit(user_id);
