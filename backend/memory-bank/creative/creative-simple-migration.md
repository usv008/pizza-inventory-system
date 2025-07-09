# 🎨 CREATIVE PHASE: SIMPLE DATABASE MIGRATION

## 📋 REQUIREMENTS & CONSTRAINTS
- ✅ Keep existing functionality unchanged  
- ✅ Minimal code changes
- ✅ Direct replacement approach
- ❌ No over-engineering

## 🔄 OPTIONS ANALYSIS

### **OPTION 1: Complex Hybrid (REJECTED)**
**Cons:** Over-engineered, against user requirements

### **OPTION 2: Simple Direct Migration (SELECTED)**
**Pros:** Simple, fast, follows user requirements
**Approach:** Replace SQLite with Supabase directly

## ✅ RECOMMENDED APPROACH

### **Implementation Guidelines:**

**Phase 1: Schema Fixes (10 min)**
```sql
ALTER TABLE stock_movements ADD COLUMN pieces INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN user TEXT DEFAULT 'system';
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
```

**Phase 2: Service Updates (15 min)**
- Replace database.js calls with supabase calls
- Update movementService.js first

**Phase 3: Simple Field Mapping (5 min)**
- Map stock_pieces ↔ current_stock where needed

## ✓ VERIFICATION
- [ ] MovementService works with Supabase
- [ ] No RLS errors  
- [ ] Basic functionality preserved

# 🎨🎨🎨 EXITING CREATIVE PHASE
**Decision:** Simple direct migration approach
**Next:** IMPLEMENT schema fixes and service replacements
