# 🧹 План очищення проекту після міграції на Supabase

**Дата**: 2025-07-26  
**Статус**: Готовий до виконання  
**Міграція завершена**: ✅ 100%

---

## 🎯 Мета очищення

Після успішної міграції на Supabase потрібно:
1. Видалити тимчасові файли міграції
2. Архівувати історичні документи
3. Видалити застарілі SQLite файли
4. Очистити тестові файли
5. Залишити тільки production-ready код

---

## 📂 План створення архівних папок

### 1. Створити структуру архіву
```bash
mkdir -p /var/www/pizza-system/archive
mkdir -p /var/www/pizza-system/archive/migration-history
mkdir -p /var/www/pizza-system/archive/migration-scripts
mkdir -p /var/www/pizza-system/archive/sqlite-legacy
mkdir -p /var/www/pizza-system/archive/migration-tests
mkdir -p /var/www/pizza-system/archive/temp-files
```

---

## 🗂️ Файли для архівування (ПЕРЕМІЩЕННЯ)

### 📋 Історія міграції → `/archive/migration-history/`
```
✅ ПЕРЕМІСТИТИ:
/SUPABASE_CODE_MIGRATION_PLAN.md              → /archive/migration-history/
/SUPABASE_CODE_MIGRATION_STATUS.md            → /archive/migration-history/
/NEXT_AGENT_CODE_MIGRATION_INSTRUCTIONS.md    → /archive/migration-history/
/plan_migration.md                            → /archive/migration-history/
/status_migration.md                          → /archive/migration-history/
/backend/MIGRATION_RULES_AND_PITFALLS.md     → /archive/migration-history/
/backend/NEXT_AGENT_INSTRUCTIONS.md          → /archive/migration-history/
/backend/QUICK_MIGRATION_CHECKLIST.md        → /archive/migration-history/
/backend/SUPABASE_INSTRUCTIONS.md            → /archive/migration-history/
/backend/TABLE_DEPENDENCIES_ANALYSIS.md      → /archive/migration-history/
```

### 🔧 Скрипти міграції → `/archive/migration-scripts/`
```
✅ ПЕРЕМІСТИТИ:
/backend/add-allocated-batches-column.js          → /archive/migration-scripts/
/backend/add-arrivals-table-migration.js          → /archive/migration-scripts/
/backend/add-user-id-to-existing-tables-migration.js → /archive/migration-scripts/
/backend/batch-system-migration.js                → /archive/migration-scripts/
/backend/create-production-batches.js             → /archive/migration-scripts/
/backend/create-users-tables-migration.js         → /archive/migration-scripts/
/backend/fix-production-batches.js                → /archive/migration-scripts/
/backend/migrate.js                               → /archive/migration-scripts/
/backend/migration-status.js                     → /archive/migration-scripts/
/backend/production-planning-migration.js         → /archive/migration-scripts/
/backend/run-operations-log-migration.js         → /archive/migration-scripts/
/backend/scripts/cleanup-sqlite-code.js          → /archive/migration-scripts/
```

### 💾 SQLite Legacy файли → `/archive/sqlite-legacy/`
```
✅ ПЕРЕМІСТИТИ:
/backend/database.js                    → /archive/sqlite-legacy/
/backend/config/database.js            → /archive/sqlite-legacy/
/backend/old-app.js                     → /archive/sqlite-legacy/
/backend/app-original.js                → /archive/sqlite-legacy/
/backend/pizza_inventory.db            → /archive/sqlite-legacy/
/backend/pizza_inventory.db.backup     → /archive/sqlite-legacy/
/backend/sessions.db                    → /archive/sqlite-legacy/
/backend/sessions.db.backup            → /archive/sqlite-legacy/
/backend/adminer_db.db                  → /archive/sqlite-legacy/
/sessions.db.backup                     → /archive/sqlite-legacy/
/backend/sqlite_adminer.php             → /archive/sqlite-legacy/
/backend/database-hybrid.js.backup     → /archive/sqlite-legacy/
/backend/queries/sqlite/                → /archive/sqlite-legacy/queries/
/backend/services/*Service.js (v1)     → /archive/sqlite-legacy/services/
```

### 🧪 Тестові файли міграції → `/archive/migration-tests/`
```
✅ ПЕРЕМІСТИТИ:
/backend/test-*-migration.js (всі файли test-*-migration.js)
/backend/test-database-adapter.js
/backend/test-database-config.js
/backend/test-supabase-client.js
/backend/test-supabase-session-store.js
/backend/test-db.js
```

### 🗃️ Тимчасові файли → `/archive/temp-files/`
```
✅ ПЕРЕМІСТИТИ:
/backend/check-sessions-columns.js
/backend/check-sessions-table.js
/backend/cleanup-test-sessions.js
/backend/create-http-sessions-table.js
/backend/create-http-sessions.sql
/backend/create-sessions-via-supabase-api.js
/backend/execute-sql-migration.js
/backend/migrations/001_create_http_sessions.sql (дублікат)
/backend/temp_query.sql
/backend/db_viewer.log
/backend/server.log
/backend/supabase_cookies.txt
/backend/cookies.txt
/backend/utils/batchReservationHelper.js.backup
/frontend/inventory.html.backup
/frontend/js/auth.js.backup
```

---

## 🗑️ Файли для ВИДАЛЕННЯ

### ❌ Повне видалення (без архівування)
```
ВИДАЛИТИ:
/backend/adminer.php                    # Веб-інтерфейс SQLite
/sqliteviewer.py                       # Python SQLite viewer
/keySsh                                # SSH ключі (не потрібні в проекті)
/keySsh.pub
/logs/                                 # Логи PM2 (можна регенерувати)
/backend/node_modules/                 # Залежності (npm install)
/node_modules/                         # Залежності (npm install)
/Знімок екрана *.png                   # Скріншоти
/projectbrief.md                       # Початковий brief (не актуальний)
/sitebrief.md                          # Початковий brief (не актуальний)
```

---

## ✅ Файли які ЗАЛИШАЄМО (Production code)

### 🏗️ Основний код
```
ЗАЛИШИТИ:
/CLAUDE.md                             # Інструкції для Claude
/backend/app-new.js                    # Основний сервер
/backend/database-supabase.js          # Supabase підключення
/backend/adapters/DatabaseAdapter.js   # Адаптер БД
/backend/middleware/                   # Всі middleware
/backend/routes/                       # Всі роути
/backend/services/*Service-v2.js       # Supabase сервіси
/backend/validators/                   # Валідатори
/backend/queries/supabase/             # Supabase запити
/backend/migrations/supabase/          # Supabase міграції
/backend/tests/supabase/               # Supabase тести
/backend/tests/performance/            # Performance тести
/backend/templates/                    # Шаблони
/backend/public/                       # Статичні файли
/backend/fonts/                        # Шрифти
/frontend/                             # Frontend код
/package.json                          # Залежності
/package-lock.json                     # Locked залежності
```

---

## 🚀 Скрипт автоматичного очищення

### Створити скрипт очищення
```bash
#!/bin/bash
# cleanup-project.sh

echo "🧹 Початок очищення проекту..."

# 1. Створити архівні папки
mkdir -p archive/{migration-history,migration-scripts,sqlite-legacy,migration-tests,temp-files}

# 2. Перемістити історичні файли
echo "📋 Переміщення історичних файлів..."
mv SUPABASE_CODE_MIGRATION_PLAN.md archive/migration-history/
mv SUPABASE_CODE_MIGRATION_STATUS.md archive/migration-history/
mv NEXT_AGENT_CODE_MIGRATION_INSTRUCTIONS.md archive/migration-history/
mv plan_migration.md archive/migration-history/
mv status_migration.md archive/migration-history/

# 3. Перемістити міграційні скрипти
echo "🔧 Переміщення міграційних скриптів..."
mv backend/MIGRATION_RULES_AND_PITFALLS.md archive/migration-history/
mv backend/add-*-migration.js archive/migration-scripts/
mv backend/batch-system-migration.js archive/migration-scripts/
mv backend/migrate.js archive/migration-scripts/

# 4. Перемістити SQLite файли
echo "💾 Переміщення SQLite legacy файлів..."
mv backend/database.js archive/sqlite-legacy/
mv backend/pizza_inventory.db* archive/sqlite-legacy/
mv backend/sessions.db* archive/sqlite-legacy/
mv backend/queries/sqlite/ archive/sqlite-legacy/queries/

# 5. Перемістити тестові файли
echo "🧪 Переміщення тестових файлів..."
mv backend/test-*-migration.js archive/migration-tests/
mv backend/test-database-*.js archive/migration-tests/
mv backend/test-supabase-*.js archive/migration-tests/

# 6. Видалити непотрібні файли
echo "🗑️ Видалення непотрібних файлів..."
rm -f backend/adminer.php
rm -f sqliteviewer.py
rm -f keySsh*
rm -rf logs/
rm -f *.png
rm -f projectbrief.md sitebrief.md

echo "✅ Очищення завершено!"
echo "📁 Архівні файли збережено в ./archive/"
```

---

## 📋 Чеклист виконання

### Перед очищенням:
- [ ] ✅ Міграція на Supabase завершена (100%)
- [ ] ✅ Система стабільно працює
- [ ] ✅ Всі тести проходять
- [ ] ✅ Backup важливих файлів створено

### Очищення:
- [ ] Створити папку `/archive/`
- [ ] Перемістити історичні документи
- [ ] Перемістити міграційні скрипти
- [ ] Перемістити SQLite legacy файли
- [ ] Перемістити тестові файли міграції
- [ ] Видалити тимчасові файли
- [ ] Видалити непотрібні інструменти

### Після очищення:
- [ ] Перевірити працездатність системи
- [ ] Оновити .gitignore
- [ ] Створити README.md для архіву
- [ ] Commit змін в git

---

## 📊 Очікувані результати

### До очищення:
- **Файлів**: ~200+
- **Розмір**: ~50MB+
- **SQLite файлів**: 28

### Після очищення:
- **Production файлів**: ~100
- **Архівних файлів**: ~50  
- **Видалених файлів**: ~50
- **Зменшення розміру**: ~70%

---

## ⚠️ ВАЖЛИВІ ЗАСТЕРЕЖЕННЯ

1. **BACKUP**: Перед виконанням створити повний backup проекту
2. **ТЕСТУВАННЯ**: Після очищення перевірити всі функції системи
3. **GIT**: Зберегти історію в git перед видаленням файлів
4. **ДОКУМЕНТАЦІЯ**: Зберегти важливі документи в архіві

---

**Підготовлено**: Claude Code Assistant  
**Дата**: 2025-07-26  
**Статус**: Готовий до виконання