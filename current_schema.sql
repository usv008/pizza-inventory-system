CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                weight REAL NOT NULL,
                barcode TEXT UNIQUE,
                pieces_per_box INTEGER NOT NULL DEFAULT 1,
                stock_pieces INTEGER DEFAULT 0,
                stock_boxes INTEGER DEFAULT 0,
                min_stock_pieces INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                movement_type TEXT NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
                pieces INTEGER NOT NULL,
                boxes INTEGER NOT NULL,
                reason TEXT,
                user TEXT DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, batch_id INTEGER, batch_date DATE, created_by_user_id INTEGER,
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
CREATE TABLE production (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                production_date DATE NOT NULL,
                total_quantity INTEGER NOT NULL,
                boxes_quantity INTEGER NOT NULL,
                pieces_quantity INTEGER NOT NULL,
                expiry_date DATE NOT NULL,
                responsible TEXT DEFAULT 'system',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, production_time TEXT, created_by_user_id INTEGER,
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
CREATE TABLE writeoffs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                writeoff_date DATE NOT NULL,
                total_quantity INTEGER NOT NULL,
                boxes_quantity INTEGER NOT NULL,
                pieces_quantity INTEGER NOT NULL,
                reason TEXT NOT NULL,
                responsible TEXT NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by_user_id INTEGER,
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                client_name TEXT NOT NULL,
                client_contact TEXT,
                order_date DATE NOT NULL,
                delivery_date DATE,
                status TEXT DEFAULT 'NEW', -- NEW, CONFIRMED, IN_PRODUCTION, READY, SHIPPED, COMPLETED
                total_quantity INTEGER DEFAULT 0,
                total_boxes INTEGER DEFAULT 0,
                notes TEXT,
                created_by TEXT DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            , client_id INTEGER, created_by_user_id INTEGER);
CREATE TABLE order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                boxes INTEGER NOT NULL,
                pieces INTEGER NOT NULL,
                reserved_quantity INTEGER DEFAULT 0,
                produced_quantity INTEGER DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, allocated_batches TEXT,
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
CREATE TABLE clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
CREATE TABLE production_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_date DATE NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        total_planned INTEGER DEFAULT 0,
        total_produced INTEGER DEFAULT 0,
        created_by TEXT DEFAULT 'system',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER);
CREATE TABLE production_plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_needed INTEGER NOT NULL,
        quantity_planned INTEGER NOT NULL,
        quantity_produced INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'MEDIUM',
        reason TEXT DEFAULT 'OTHER',
        order_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES production_plans (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (order_id) REFERENCES orders (id)
    );
CREATE TABLE production_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_capacity INTEGER DEFAULT 500,
        working_hours INTEGER DEFAULT 8,
        min_batch_size INTEGER DEFAULT 10,
        cost_per_unit REAL DEFAULT 0,
        settings_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE INDEX idx_production_plans_date ON production_plans (plan_date);
CREATE INDEX idx_plan_items_plan_id ON production_plan_items (plan_id);
CREATE TABLE production_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        production_date DATE NOT NULL,
        total_quantity INTEGER NOT NULL,
        available_quantity INTEGER NOT NULL,
        reserved_quantity INTEGER DEFAULT 0,
        expiry_date DATE NOT NULL,
        production_id INTEGER,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, notes TEXT, used_quantity INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (production_id) REFERENCES production (id),
        UNIQUE(product_id, batch_date)
    );
CREATE INDEX idx_batches_product_date ON production_batches(product_id, batch_date);
CREATE INDEX idx_batches_expiry ON production_batches(expiry_date, status);
CREATE TABLE arrivals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        arrival_number TEXT UNIQUE NOT NULL,
        arrival_date DATE NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , created_by_user_id INTEGER);
CREATE TABLE arrivals_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        arrival_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (arrival_id) REFERENCES arrivals (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
    );
CREATE TABLE operations_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,  -- 'CREATE_ORDER', 'UPDATE_ORDER', 'PRODUCTION', 'WRITEOFF', 'ARRIVAL', etc.
        operation_id INTEGER,          -- ID відповідної операції (order_id, production_id, etc.)
        entity_type TEXT NOT NULL,     -- 'order', 'product', 'production', 'writeoff', 'arrival'
        entity_id INTEGER,             -- ID сутності на яку впливає операція
        old_data TEXT,                 -- JSON з старими даними (для UPDATE операцій)
        new_data TEXT,                 -- JSON з новими даними
        description TEXT NOT NULL,     -- Опис операції для відображення
        user_name TEXT NOT NULL,       -- Хто виконав операцію
        ip_address TEXT,               -- IP адреса користувача
        user_agent TEXT,               -- Browser info
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , user_id INTEGER);
CREATE INDEX idx_operations_log_type ON operations_log(operation_type);
CREATE INDEX idx_operations_log_entity ON operations_log(entity_type, entity_id);
CREATE INDEX idx_operations_log_date ON operations_log(created_at);
CREATE INDEX idx_operations_log_user ON operations_log(user_name);
CREATE INDEX idx_production_batches_product_date 
            ON production_batches (product_id, batch_date);
CREATE INDEX idx_production_batches_expiry 
            ON production_batches (expiry_date, status);
CREATE INDEX idx_production_batches_available 
            ON production_batches (product_id, available_quantity, status);
CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        password_hash TEXT NULL,
        role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
        permissions TEXT NOT NULL DEFAULT '{}',
        first_login INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users (id)
    );
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
CREATE TABLE user_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resource_type TEXT, resource_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
CREATE TABLE api_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        status_code INTEGER,
        duration INTEGER,
        success INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
CREATE TABLE security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        user_id INTEGER,
        ip_address TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_api_audit_user_id ON api_audit_log(user_id);
CREATE INDEX idx_api_audit_timestamp ON api_audit_log(timestamp);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_orders_created_by_user_id ON orders(created_by_user_id);
CREATE INDEX idx_operations_log_user_id ON operations_log(user_id);
CREATE INDEX idx_stock_movements_created_by_user_id ON stock_movements(created_by_user_id);
CREATE INDEX idx_arrivals_created_by_user_id ON arrivals(created_by_user_id);
CREATE INDEX idx_production_created_by_user_id ON production(created_by_user_id);
CREATE INDEX idx_writeoffs_created_by_user_id ON writeoffs(created_by_user_id);
CREATE INDEX idx_production_plans_created_by_user_id ON production_plans(created_by_user_id);
