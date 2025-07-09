-- Pizza System Database Migration to PostgreSQL
-- Converted from SQLite schema to PostgreSQL
-- Migration: 01_create_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100),
    unit VARCHAR(50),
    cost_per_unit DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    current_stock DECIMAL(10,2) DEFAULT 0,
    min_stock_level DECIMAL(10,2) DEFAULT 0,
    max_stock_level DECIMAL(10,2),
    supplier VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment'
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reason VARCHAR(255),
    reference_type VARCHAR(50), -- 'production', 'order', 'arrival', 'writeoff', 'adjustment'
    reference_id BIGINT,
    performed_by BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE,
    client_id BIGINT REFERENCES clients(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    total_amount DECIMAL(10,2),
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order items table  
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- Production plans table
CREATE TABLE IF NOT EXISTS production_plans (
    id BIGSERIAL PRIMARY KEY,
    plan_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'completed', 'cancelled'
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Production plan items table
CREATE TABLE IF NOT EXISTS production_plan_items (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    planned_quantity DECIMAL(10,2) NOT NULL,
    produced_quantity DECIMAL(10,2) DEFAULT 0,
    notes TEXT
);

-- Production table
CREATE TABLE IF NOT EXISTS production (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity_produced DECIMAL(10,2) NOT NULL,
    production_cost DECIMAL(10,2),
    batch_number VARCHAR(100),
    quality_status VARCHAR(50) DEFAULT 'good', -- 'good', 'defective', 'returned'
    plan_id BIGINT REFERENCES production_plans(id),
    produced_by BIGINT,
    notes TEXT,
    production_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Production batches table
CREATE TABLE IF NOT EXISTS production_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    production_date DATE NOT NULL,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'recalled'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Arrivals table
CREATE TABLE IF NOT EXISTS arrivals (
    id BIGSERIAL PRIMARY KEY,
    arrival_number VARCHAR(100) UNIQUE,
    supplier VARCHAR(255),
    arrival_date DATE NOT NULL,
    total_cost DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'received', 'cancelled'
    notes TEXT,
    received_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Arrival items table
CREATE TABLE IF NOT EXISTS arrival_items (
    id BIGSERIAL PRIMARY KEY,
    arrival_id BIGINT NOT NULL REFERENCES arrivals(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- Writeoffs table
CREATE TABLE IF NOT EXISTS writeoffs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    cost_impact DECIMAL(10,2),
    approved_by BIGINT,
    notes TEXT,
    writeoff_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Users table (will integrate with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    supabase_id UUID UNIQUE, -- Reference to auth.users in Supabase
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'manager', 'employee', 'viewer', 'accountant', 'user'
    permissions JSONB, -- Store custom permissions
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User sessions table (for dual auth support)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    supabase_session_id VARCHAR(255),
    auth_type VARCHAR(20) DEFAULT 'legacy', -- 'legacy', 'supabase'
    expires_at TIMESTAMPTZ NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User audit table
CREATE TABLE IF NOT EXISTS user_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Operations log table
CREATE TABLE IF NOT EXISTS operations_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type VARCHAR(100) NOT NULL,
    operation_description TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id),
    affected_table VARCHAR(100),
    affected_record_id BIGINT,
    status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'warning'
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- API audit log table  
CREATE TABLE IF NOT EXISTS api_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL, -- 'login_attempt', 'login_success', 'login_failure', 'logout', 'permission_denied'
    user_id BIGINT REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Production settings table
CREATE TABLE IF NOT EXISTS production_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_production_product_id ON production(product_id);
CREATE INDEX IF NOT EXISTS idx_production_date ON production(production_date);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_audit_user_id ON user_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_created_at ON user_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_log_user_id ON operations_log(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at);



-- Add triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_plans_updated_at BEFORE UPDATE ON production_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arrivals_updated_at BEFORE UPDATE ON arrivals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 