#!/bin/bash

# Pizza System Project Cleanup Script
# Cleans up migration files after successful Supabase migration
# Date: 2025-07-26

set -e  # Exit on any error

echo "🧹 Pizza System - Початок очищення проекту після міграції..."
echo "📅 $(date)"
echo ""

# Перевірка поточної директорії
if [[ ! -f "CLAUDE.md" ]]; then
    echo "❌ Помилка: Запустіть скрипт з кореневої папки проекту /var/www/pizza-system/"
    exit 1
fi

echo "✅ Поточна директорія: $(pwd)"
echo ""

# 1. Створити архівні папки
echo "📁 Створення архівної структури..."
mkdir -p archive/migration-history
mkdir -p archive/migration-scripts  
mkdir -p archive/sqlite-legacy/queries
mkdir -p archive/sqlite-legacy/services
mkdir -p archive/migration-tests
mkdir -p archive/temp-files
echo "✅ Архівні папки створено"
echo ""

# 2. Перемістити історичні документи
echo "📋 Переміщення історичних документів..."
if [[ -f "SUPABASE_CODE_MIGRATION_PLAN.md" ]]; then
    mv SUPABASE_CODE_MIGRATION_PLAN.md archive/migration-history/
    echo "  ✅ SUPABASE_CODE_MIGRATION_PLAN.md"
fi

if [[ -f "SUPABASE_CODE_MIGRATION_STATUS.md" ]]; then
    mv SUPABASE_CODE_MIGRATION_STATUS.md archive/migration-history/
    echo "  ✅ SUPABASE_CODE_MIGRATION_STATUS.md"
fi

if [[ -f "NEXT_AGENT_CODE_MIGRATION_INSTRUCTIONS.md" ]]; then
    mv NEXT_AGENT_CODE_MIGRATION_INSTRUCTIONS.md archive/migration-history/
    echo "  ✅ NEXT_AGENT_CODE_MIGRATION_INSTRUCTIONS.md"
fi

if [[ -f "plan_migration.md" ]]; then
    mv plan_migration.md archive/migration-history/
    echo "  ✅ plan_migration.md"
fi

if [[ -f "status_migration.md" ]]; then
    mv status_migration.md archive/migration-history/
    echo "  ✅ status_migration.md"
fi

# Backend документи
cd backend

if [[ -f "MIGRATION_RULES_AND_PITFALLS.md" ]]; then
    mv MIGRATION_RULES_AND_PITFALLS.md ../archive/migration-history/
    echo "  ✅ MIGRATION_RULES_AND_PITFALLS.md"
fi

if [[ -f "NEXT_AGENT_INSTRUCTIONS.md" ]]; then
    mv NEXT_AGENT_INSTRUCTIONS.md ../archive/migration-history/
    echo "  ✅ NEXT_AGENT_INSTRUCTIONS.md"
fi

if [[ -f "QUICK_MIGRATION_CHECKLIST.md" ]]; then
    mv QUICK_MIGRATION_CHECKLIST.md ../archive/migration-history/
    echo "  ✅ QUICK_MIGRATION_CHECKLIST.md"
fi

if [[ -f "SUPABASE_INSTRUCTIONS.md" ]]; then
    mv SUPABASE_INSTRUCTIONS.md ../archive/migration-history/
    echo "  ✅ SUPABASE_INSTRUCTIONS.md"
fi

if [[ -f "TABLE_DEPENDENCIES_ANALYSIS.md" ]]; then
    mv TABLE_DEPENDENCIES_ANALYSIS.md ../archive/migration-history/
    echo "  ✅ TABLE_DEPENDENCIES_ANALYSIS.md"
fi

cd ..
echo ""

# 3. Перемістити міграційні скрипти
echo "🔧 Переміщення міграційних скриптів..."
cd backend

# Міграційні скрипти
for file in add-*-migration.js; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/migration-scripts/
        echo "  ✅ $file"
    fi
done

for file in batch-system-migration.js create-production-batches.js create-users-tables-migration.js \
           fix-production-batches.js migrate.js migration-status.js production-planning-migration.js \
           run-operations-log-migration.js; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/migration-scripts/
        echo "  ✅ $file"
    fi
done

if [[ -f "scripts/cleanup-sqlite-code.js" ]]; then
    mv scripts/cleanup-sqlite-code.js ../archive/migration-scripts/
    echo "  ✅ cleanup-sqlite-code.js"
fi

cd ..
echo ""

# 4. Перемістити SQLite legacy файли
echo "💾 Переміщення SQLite legacy файлів..."
cd backend

# Основні SQLite файли
for file in database.js old-app.js app-original.js pizza_inventory.db pizza_inventory.db.backup \
           sessions.db sessions.db.backup adminer_db.db sqlite_adminer.php database-hybrid.js.backup; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/sqlite-legacy/
        echo "  ✅ $file"
    fi
done

# config/database.js
if [[ -f "config/database.js" ]]; then
    mv config/database.js ../archive/sqlite-legacy/
    echo "  ✅ config/database.js"
fi

# SQLite queries
if [[ -d "queries/sqlite" ]]; then
    mv queries/sqlite ../archive/sqlite-legacy/queries/
    echo "  ✅ queries/sqlite/"
fi

# v1 сервіси (старі SQLite версії)
for file in services/authService.js services/clientService.js services/movementService.js \
           services/orderService.js services/productService.js services/productionService.js \
           services/userService.js services/writeoffService.js; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/sqlite-legacy/services/
        echo "  ✅ $file"
    fi
done

cd ..

# Root SQLite файли
if [[ -f "sessions.db.backup" ]]; then
    mv sessions.db.backup archive/sqlite-legacy/
    echo "  ✅ sessions.db.backup (root)"
fi

echo ""

# 5. Перемістити тестові файли міграції
echo "🧪 Переміщення тестових файлів міграції..."
cd backend

for file in test-*-migration.js test-database-adapter.js test-database-config.js \
           test-supabase-client.js test-supabase-session-store.js test-db.js; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/migration-tests/
        echo "  ✅ $file"
    fi
done

cd ..
echo ""

# 6. Перемістити тимчасові файли
echo "🗃️ Переміщення тимчасових файлів..."
cd backend

for file in check-sessions-columns.js check-sessions-table.js cleanup-test-sessions.js \
           create-http-sessions-table.js create-http-sessions.sql create-sessions-via-supabase-api.js \
           execute-sql-migration.js temp_query.sql db_viewer.log server.log supabase_cookies.txt \
           cookies.txt; do
    if [[ -f "$file" ]]; then
        mv "$file" ../archive/temp-files/
        echo "  ✅ $file"
    fi
done

# Дублікат міграції
if [[ -f "migrations/001_create_http_sessions.sql" ]]; then
    mv migrations/001_create_http_sessions.sql ../archive/temp-files/
    echo "  ✅ migrations/001_create_http_sessions.sql (дублікат)"
fi

# Backup файли
if [[ -f "utils/batchReservationHelper.js.backup" ]]; then
    mv utils/batchReservationHelper.js.backup ../archive/temp-files/
    echo "  ✅ batchReservationHelper.js.backup"
fi

cd ..

# Frontend backup файли
if [[ -f "frontend/inventory.html.backup" ]]; then
    mv frontend/inventory.html.backup archive/temp-files/
    echo "  ✅ inventory.html.backup"
fi

if [[ -f "frontend/js/auth.js.backup" ]]; then
    mv frontend/js/auth.js.backup archive/temp-files/
    echo "  ✅ auth.js.backup"
fi

echo ""

# 7. Видалити непотрібні файли
echo "🗑️ Видалення непотрібних файлів..."

# Інструменти та утиліти
for file in sqliteviewer.py keySsh keySsh.pub backend/adminer.php; do
    if [[ -f "$file" ]]; then
        rm -f "$file"
        echo "  ❌ $file"
    fi
done

# Скріншоти
for file in *.png; do
    if [[ -f "$file" ]]; then
        rm -f "$file"
        echo "  ❌ $file"
    fi
done

# Логи PM2
if [[ -d "logs" ]]; then
    rm -rf logs/
    echo "  ❌ logs/"
fi

# Застарілі документи
for file in projectbrief.md sitebrief.md; do
    if [[ -f "$file" ]]; then
        rm -f "$file"
        echo "  ❌ $file"
    fi
done

echo ""

# 8. Створити README для архіву
echo "📝 Створення документації архіву..."
cat > archive/README.md << 'EOF'
# 📁 Pizza System - Архів міграції

**Дата міграції**: 2025-07-26  
**Статус**: ✅ Міграція завершена (SQLite → Supabase)

## 📂 Структура архіву

### 📋 migration-history/
Історичні документи міграції:
- Плани міграції
- Статуси виконання
- Інструкції та правила
- Аналіз залежностей

### 🔧 migration-scripts/
Скрипти міграції даних:
- SQLite міграційні скрипти
- Утиліти створення таблиць
- Скрипти трансформації даних

### 💾 sqlite-legacy/
Застарілі SQLite файли:
- Стара база даних (pizza_inventory.db)
- SQLite сервіси (v1)
- SQLite queries
- Конфігурації SQLite

### 🧪 migration-tests/
Тестові файли міграції:
- Тести порівняння SQLite vs Supabase
- Тести адаптерів
- Валідаційні скрипти

### 🗃️ temp-files/
Тимчасові файли:
- Експериментальні скрипти
- Backup файли
- Логи міграції

## ⚠️ Важливо

Ці файли збережено для історії проекту.
**НЕ ВИДАЛЯЙТЕ** - можуть знадобитися для відкату або аналізу.

Поточна система працює повністю на Supabase PostgreSQL.
EOF

echo "✅ README.md створено в archive/"
echo ""

# 9. Підсумок
echo "📊 Підсумок очищення:"
echo "  ✅ Історичні документи архівовано"
echo "  ✅ Міграційні скрипти архівовано"
echo "  ✅ SQLite файли архівовано"
echo "  ✅ Тестові файли архівовано"
echo "  ✅ Тимчасові файли архівовано"
echo "  ✅ Непотрібні файли видалено"
echo "  ✅ Документація архіву створена"
echo ""

echo "🎉 Очищення завершено успішно!"
echo "📁 Архівні файли збережено в: ./archive/"
echo ""

# Статистика
archive_files=$(find archive -type f | wc -l)
remaining_files=$(find . -maxdepth 3 -type f -not -path "./archive/*" -not -path "./node_modules/*" -not -path "./backend/node_modules/*" | wc -l)

echo "📈 Статистика:"
echo "  📁 Файлів в архіві: $archive_files"
echo "  🏗️ Production файлів: $remaining_files"
echo "  🧹 Проект очищено та готовий до production!"
echo ""

echo "🔧 Наступні кроки:"
echo "  1. Перевірте роботу системи: npm start"
echo "  2. Запустіть тести: npm test"
echo "  3. Commit змін в git"
echo "  4. Deploy в production"
echo ""

echo "✅ Скрипт очищення завершено: $(date)"