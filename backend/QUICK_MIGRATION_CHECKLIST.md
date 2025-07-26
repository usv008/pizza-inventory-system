# ⚡ Швидкий чеклист міграції SQLite → Supabase

**Використовувати перед міграцією кожного сервісу**

## 🔍 Перед початком

- [ ] Прочитати `MIGRATION_RULES_AND_PITFALLS.md`
- [ ] Знайти всі boolean поля в сервісі (`active`, `enabled`, `first_login`)
- [ ] Знайти всі JSON поля (`permissions`, `metadata`, `config`)
- [ ] Знайти frontend використання цих полів

## ⚙️ Backend міграція

- [ ] Створити `queries/supabase/[service]Queries.js`
  - `INTEGER` → `BOOLEAN` 
  - `TEXT` JSON → `JSONB`
- [ ] Створити `services/[service]-v2.js`
  - Використати DatabaseAdapter
  - Додати перевірки типів для JSON
- [ ] Створити тести
- [ ] Запустити з `USE_SUPABASE=false`
- [ ] Запустити з `USE_SUPABASE=true`

## 🎨 Frontend міграція

- [ ] Знайти `item.field === 1` → замінити на `=== 1 || === true`
- [ ] Знайти `JSON.parse(item.field)` → додати перевірку типу
- [ ] Протестувати UI компоненти

## ✅ Фінальна перевірка

- [ ] API endpoints працюють в обох режимах
- [ ] Frontend показує дані коректно
- [ ] Оновити статус міграції
- [ ] Додати нові помилки в MIGRATION_RULES_AND_PITFALLS.md

---

**⚠️ ВАЖЛИВО**: Завжди тестувати з обома БД!