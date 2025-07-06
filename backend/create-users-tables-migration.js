const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pizza_pizza_inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('🔐 Створення таблиць для системи користувачів...');

    // Основна таблиця користувачів
    db.run(`CREATE TABLE IF NOT EXISTS users (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці users:', err);
        } else {
            console.log('✅ Таблиця users створена успішно');
        }
    });

    // Таблиця сесій користувачів
    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці user_sessions:', err);
        } else {
            console.log('✅ Таблиця user_sessions створена успішно');
        }
    });

    // Таблиця аудиту користувачів
    db.run(`CREATE TABLE IF NOT EXISTS user_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці user_audit:', err);
        } else {
            console.log('✅ Таблиця user_audit створена успішно');
        }
    });

    // Таблиця аудиту API викликів
    db.run(`CREATE TABLE IF NOT EXISTS api_audit_log (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці api_audit_log:', err);
        } else {
            console.log('✅ Таблиця api_audit_log створена успішно');
        }
    });

    // Таблиця подій безпеки
    db.run(`CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        user_id INTEGER,
        ip_address TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Помилка створення таблиці security_events:', err);
        } else {
            console.log('✅ Таблиця security_events створена успішно');
        }
    });

    // Створення індексів для продуктивності
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_users_username:', err);
        else console.log('✅ Індекс idx_users_username створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_users_email:', err);
        else console.log('✅ Індекс idx_users_email створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_users_role:', err);
        else console.log('✅ Індекс idx_users_role створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_users_active:', err);
        else console.log('✅ Індекс idx_users_active створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_user_sessions_user_id:', err);
        else console.log('✅ Індекс idx_user_sessions_user_id створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_user_sessions_expires:', err);
        else console.log('✅ Індекс idx_user_sessions_expires створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_api_audit_user_id ON api_audit_log(user_id)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_api_audit_user_id:', err);
        else console.log('✅ Індекс idx_api_audit_user_id створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_api_audit_timestamp ON api_audit_log(timestamp)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_api_audit_timestamp:', err);
        else console.log('✅ Індекс idx_api_audit_timestamp створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_security_events_type:', err);
        else console.log('✅ Індекс idx_security_events_type створено');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp)`, (err) => {
        if (err) console.error('❌ Помилка створення індексу idx_security_events_timestamp:', err);
        else console.log('✅ Індекс idx_security_events_timestamp створено');
    });

    // Додавання початкового адміністратора
    db.run(`INSERT OR IGNORE INTO users 
        (username, email, role, permissions, first_login, active, password_hash) 
        VALUES 
        ('admin', 'admin@pizza.com', 'ДИРЕКТОР', '{"admin": {"all_rights": true}}', 1, 1, NULL)`, 
    (err) => {
        if (err) {
            console.error('❌ Помилка створення адміністратора:', err);
        } else {
            console.log('✅ Користувач admin створений (пароль буде встановлений при першому вході)');
        }
    });

    console.log('🎉 Міграція користувачів завершена!');
    db.close();
}); 