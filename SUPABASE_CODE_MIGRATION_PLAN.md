# 🔄 План міграції коду Pizza System з SQLite на Supabase

**Дата створення**: 2025-07-25  
**Статус**: 📋 Планування  
**Попередній етап**: ✅ Міграція схеми БД завершена (19/19 таблиць)

---

## 🎯 Загальна стратегія

### Поетапний підхід:
1. **ЕТАП 1**: Створення адаптера Supabase (паралельно з SQLite)
2. **ЕТАП 2**: Міграція сервісів по одному з тестуванням
3. **ЕТАП 3**: Міграція даних з SQLite в Supabase
4. **ЕТАП 4**: Повне переключення та видалення SQLite коду

### Принципи міграції:
- ✅ Зворотна сумісність під час переходу
- ✅ Поетапне тестування кожного сервісу
- ✅ Збереження існуючого API інтерфейсу
- ✅ Мінімальний простій системи

---

## 📊 Аналіз поточного стану

### Файли з SQLite залежностями:
```
/var/www/pizza-system/backend/
├── database.js                    🔴 Основне з'єднання SQLite
├── app-new.js                     🔴 SQLiteStore для сесій
├── services/                      
│   ├── productService.js          🟡 Використовує productQueries
│   ├── clientService.js           🟡 Використовує clientQueries  
│   ├── orderService.js            🟡 Використовує orderQueries
│   ├── productionService.js       🟡 Використовує productionQueries
│   ├── writeoffService.js         🟡 Використовує writeoffQueries
│   ├── movementService.js         🟡 Використовує movementQueries
│   ├── authService.js             🟡 Використовує userQueries
│   └── userService.js             🟡 Використовує userQueries
└── migration/*.js                 🔴 Всі міграційні скрипти SQLite
```

### Архітектура сервісів:
- **Сервіси**: Бізнес-логіка (потребують адаптації)
- **Query об'єкти**: Прямі SQL запити (потребують заміни)
- **Контролери**: HTTP обробка (без змін)
- **Роутери**: Маршрутизація (без змін)

---

## 🚀 ЕТАП 1: Створення Supabase адаптера

### 1.1 Створити Supabase клієнт
```javascript
// backend/database-supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
```

### 1.2 Створити .env файл
```env
# Supabase Configuration
SUPABASE_URL=https://wncukuajzygzyasofyoe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Legacy SQLite (для паралельної роботи)
SQLITE_DB_PATH=./pizza_inventory.db
USE_SUPABASE=false
```

### 1.3 Створити адаптер для запитів
```javascript
// backend/adapters/DatabaseAdapter.js
class DatabaseAdapter {
    constructor(useSupabase = false) {
        this.useSupabase = useSupabase;
        
        if (useSupabase) {
            this.client = require('../database-supabase').supabase;
        } else {
            this.client = require('../database').db;
        }
    }
    
    async query(sql, params) {
        if (this.useSupabase) {
            return this.executeSupabaseQuery(sql, params);
        } else {
            return this.executeSQLiteQuery(sql, params);
        }
    }
}
```

---

## 🔧 ЕТАП 2: Міграція сервісів (по черзі)

### Пріоритет міграції:
1. **productService** (базовий, мало залежностей)
2. **clientService** (базовый)
3. **userService + authService** (автентифікація)
4. **movementService** (центральний для запасів)
5. **orderService** (складний, багато залежностей)
6. **productionService** (складний)
7. **writeoffService** (останній)

### 2.1 Міграція productService

#### 2.1.1 Створити Supabase queries
```javascript
// backend/queries/supabase/productQueries.js
const { supabase } = require('../../database-supabase');

const productQueries = {
    async getAll() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');
            
        if (error) throw error;
        return data;
    },
    
    async getById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    },
    
    async create(product) {
        const { data, error } = await supabase
            .from('products')
            .insert(product)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    async update(id, product) {
        const { data, error } = await supabase
            .from('products')
            .update(product)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    async delete(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
};

module.exports = productQueries;
```

#### 2.1.2 Створити конфігурацію з переключенням
```javascript
// backend/config/database.js
const useSupabase = process.env.USE_SUPABASE === 'true';

let productQueries;
if (useSupabase) {
    productQueries = require('../queries/supabase/productQueries');
} else {
    productQueries = require('../queries/sqlite/productQueries');
}

module.exports = {
    productQueries,
    useSupabase
};
```

#### 2.1.3 Тестування міграції
```javascript
// backend/tests/services/test-product-service-migration.js
describe('Product Service Migration', () => {
    test('SQLite vs Supabase consistency', async () => {
        // Отримати продукти з SQLite
        const sqliteProducts = await productServiceSQLite.getAllProducts();
        
        // Отримати продукти з Supabase  
        const supabaseProducts = await productServiceSupabase.getAllProducts();
        
        // Порівняти результати
        expect(supabaseProducts).toEqual(sqliteProducts);
    });
});
```

### 2.2 Міграція інших сервісів
Повторити схожі кроки для кожного сервісу:
- Створити Supabase queries
- Адаптувати сервісну логіку
- Протестувати паралельно з SQLite
- Переключити USE_SUPABASE=true для сервісу

---

## 📦 ЕТАП 3: Міграція даних

### 3.1 Створити скрипт міграції даних
```javascript
// backend/scripts/migrate-data-to-supabase.js
const sqlite3 = require('sqlite3').verbose();
const { supabase } = require('../database-supabase');

class DataMigrator {
    constructor() {
        this.sqliteDb = new sqlite3.Database('./pizza_inventory.db');
        this.supabaseClient = supabase;
        this.migrationLog = [];
    }
    
    async migrateTable(tableName) {
        console.log(`🔄 Migrating ${tableName}...`);
        
        // 1. Отримати дані з SQLite
        const sqliteData = await this.getSQLiteData(tableName);
        
        // 2. Перетворити дані для PostgreSQL
        const transformedData = this.transformData(tableName, sqliteData);
        
        // 3. Вставити в Supabase
        const result = await this.insertToSupabase(tableName, transformedData);
        
        this.migrationLog.push({
            table: tableName,
            records: transformedData.length,
            success: result.success,
            errors: result.errors
        });
        
        console.log(`✅ ${tableName}: ${transformedData.length} records migrated`);
    }
    
    async migrateAllData() {
        const tables = [
            'users',        // ПЕРША (інші посилаються на неї)
            'products',
            'clients', 
            'production_settings',
            'production',
            'production_batches',
            'orders',
            'order_items',
            'stock_movements',
            'writeoffs'
            // ... інші таблиці
        ];
        
        for (const table of tables) {
            await this.migrateTable(table);
        }
        
        this.generateMigrationReport();
    }
}
```

### 3.2 Трансформація даних
```javascript
transformData(tableName, sqliteData) {
    switch(tableName) {
        case 'products':
            return sqliteData.map(row => ({
                ...row,
                properties: row.properties ? JSON.parse(row.properties) : null,
                created_at: new Date(row.created_at).toISOString(),
                updated_at: new Date(row.updated_at).toISOString()
            }));
            
        case 'orders':
            return sqliteData.map(row => ({
                ...row,
                delivery_info: row.delivery_info ? JSON.parse(row.delivery_info) : null,
                created_at: new Date(row.created_at).toISOString()
            }));
            
        default:
            return sqliteData;
    }
}
```

### 3.3 Верифікація міграції
```javascript
// backend/scripts/verify-migration.js
class MigrationVerifier {
    async verifyTable(tableName) {
        const sqliteCount = await this.getSQLiteCount(tableName);
        const supabaseCount = await this.getSupabaseCount(tableName);
        
        console.log(`${tableName}: SQLite=${sqliteCount}, Supabase=${supabaseCount}`);
        
        if (sqliteCount !== supabaseCount) {
            console.error(`❌ Count mismatch in ${tableName}`);
            return false;
        }
        
        return true;
    }
    
    async verifyAllTables() {
        const tables = ['users', 'products', 'clients', /* ... */];
        const results = await Promise.all(
            tables.map(table => this.verifyTable(table))
        );
        
        const allValid = results.every(r => r === true);
        console.log(allValid ? '✅ All tables verified' : '❌ Verification failed');
        return allValid;
    }
}
```

---

## 🔄 ЕТАП 4: Повне переключення

### 4.1 Оновити конфігурацію
```javascript
// backend/.env
USE_SUPABASE=true
MIGRATE_SESSIONS_TO_SUPABASE=true
```

### 4.2 Замінити SQLiteStore на Supabase сесії
```javascript
// backend/app-new.js
const session = require('express-session');

// Замінити SQLiteStore на Supabase session store
const SupabaseStore = require('./middleware/SupabaseSessionStore');

app.use(session({
    store: new SupabaseStore({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_KEY,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 години
    }
}));
```

### 4.3 Створити SupabaseSessionStore
```javascript
// backend/middleware/SupabaseSessionStore.js
const { Store } = require('express-session');
const { createClient } = require('@supabase/supabase-js');

class SupabaseSessionStore extends Store {
    constructor(options) {
        super(options);
        this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
        this.tableName = options.tableName || 'user_sessions';
    }
    
    async get(sessionId, callback) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('session_data')
                .eq('session_id', sessionId)
                .single();
                
            if (error || !data) {
                return callback(null, null);
            }
            
            callback(null, JSON.parse(data.session_data));
        } catch (err) {
            callback(err);
        }
    }
    
    async set(sessionId, session, callback) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .upsert({
                    session_id: sessionId,
                    session_data: JSON.stringify(session),
                    expires_at: new Date(Date.now() + (session.cookie?.maxAge || 86400000))
                });
                
            callback(error);
        } catch (err) {
            callback(err);
        }
    }
    
    async destroy(sessionId, callback) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('session_id', sessionId);
                
            callback(error);
        } catch (err) {
            callback(err);
        }
    }
}

module.exports = SupabaseSessionStore;
```

---

## 🧪 ЕТАП 5: Тестування та валідація

### 5.1 Functional тести
```javascript
// backend/tests/integration/full-system-test.js
describe('Full System Integration with Supabase', () => {
    test('Complete product workflow', async () => {
        // 1. Створити продукт
        const product = await request(app)
            .post('/api/products')
            .send({ name: 'Test Pizza', code: 'TP001' });
            
        // 2. Створити замовлення
        const order = await request(app)
            .post('/api/orders')
            .send({ client_id: 1, items: [{ product_id: product.id, quantity: 5 }] });
            
        // 3. Провести виробництво
        const production = await request(app)
            .post('/api/production')
            .send({ product_id: product.id, quantity: 10 });
            
        // 4. Перевірити рухи запасів
        const movements = await request(app)
            .get('/api/movements')
            .query({ product_id: product.id });
            
        expect(movements.body.length).toBeGreaterThan(0);
    });
});
```

### 5.2 Performance тести
```javascript
// backend/tests/performance/supabase-performance.js
describe('Supabase Performance', () => {
    test('Query performance comparison', async () => {
        const start = Date.now();
        
        await Promise.all([
            productService.getAllProducts(),
            orderService.getAllOrders(),
            movementService.getRecentMovements()
        ]);
        
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(2000); // 2 секунди
    });
});
```

---

## 📋 План виконання (покрокові завдання)

### Тиждень 1: Підготовка (2-3 дні)
- [ ] 1.1 Створити Supabase клієнт та .env
- [ ] 1.2 Створити DatabaseAdapter
- [ ] 1.3 Налаштувати переключення SQLite/Supabase

### Тиждень 2: Міграція базових сервісів (4-5 днів)
- [ ] 2.1 Мігрувати productService + тести
- [ ] 2.2 Мігрувати clientService + тести  
- [ ] 2.3 Мігрувати userService + authService + тести

### Тиждень 3: Міграція складних сервісів (4-5 днів)  
- [ ] 3.1 Мігрувати movementService + тести
- [ ] 3.2 Мігрувати orderService + тести
- [ ] 3.3 Мігрувати productionService + тести
- [ ] 3.4 Мігрувати writeoffService + тести

### Тиждень 4: Міграція даних та переключення (3-4 дні)
- [ ] 4.1 Створити та протестувати скрипт міграції даних
- [ ] 4.2 Виконати міграцію даних в тестовому режимі
- [ ] 4.3 Створити SupabaseSessionStore
- [ ] 4.4 Повне переключення на Supabase

### Тиждень 5: Тестування та оптимізація (2-3 дні)
- [ ] 5.1 Functional та integration тести
- [ ] 5.2 Performance тести та оптимізація
- [ ] 5.3 Видалення SQLite коду та cleanup

---

## ⚠️ Ризики та плани відновлення

### Основні ризики:
1. **Втрата даних** - Резервна копія SQLite перед міграцією
2. **Простій системи** - Поетапна міграція з rollback планом
3. **Performance проблеми** - Benchmark тести на кожному етапі
4. **API несумісність** - Збереження точного API інтерфейсу

### План відновлення:
```bash
# Швидке повернення до SQLite
export USE_SUPABASE=false
systemctl restart pizza-system
```

---

## 🎯 Критерії успіху

### Функціональні:
- ✅ Всі існуючі API працюють без змін
- ✅ Всі дані перенесені без втрат
- ✅ Автентифікація та авторизація працюють
- ✅ Всі тести проходять успішно

### Performance:
- ✅ Час відповіді API < 500ms (95 перцентиль)
- ✅ Немає memory leaks
- ✅ Concurrent users підтримка (як раніше)

### Технічні:
- ✅ Код чистий та підтримуваний
- ✅ Error handling покращений
- ✅ Логування та моніторинг налаштовані
- ✅ SQLite код повністю видалений

---

*Створено автоматично на основі аналізу поточної кодової бази Pizza System*