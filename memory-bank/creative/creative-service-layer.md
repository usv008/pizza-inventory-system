🎨🎨🎨 ENTERING CREATIVE PHASE: SERVICE LAYER DESIGN 🎨🎨🎨

## PROBLEM STATEMENT
Поточний app.js містить 1890 рядків з прямими database queries та бізнес-логікою змішаною з HTTP роутами. Потрібно спроектувати Service Layer, який буде:
- Інкапсулювати всю бізнес-логіку
- Забезпечувати чистий інтерфейс для роутів
- Дозволяти незалежне тестування
- Підтримувати повторне використання коду

## ПОТОЧНА СИТУАЦІЯ
Аналіз app.js показує наступні patterns бізнес-логіки:
- Прямі SQL queries в роутах
- Валідація даних в endpoint handlers  
- Бізнес-правила розкидані по різних функціях
- Дублювання логіки між схожими операціями

## OPTIONS ANALYSIS

### Option 1: Simple Service Classes
**Description**: Створити клас для кожного модуля (ProductService, OrderService, тощо)
**Pros**:
- Простота реалізації
- Знайомий OOP pattern
- Легко тестувати
- Чітке розділення відповідальності
**Cons**:
- Може призвести до великих класів
- Складніше для functional programming підходу
- Потребує більше boilerplate коду
**Complexity**: Low
**Implementation Time**: 2-3 дні

### Option 2: Functional Service Modules  
**Description**: Використовувати функціональні модулі з експортованими функціями
**Pros**:
- Менше boilerplate коду
- Природно для Node.js/JavaScript
- Легше композувати функції
- Кращий tree-shaking
**Cons**:
- Менш структурований підхід
- Складніше керувати залежностями
- Потенційні проблеми з shared state
**Complexity**: Medium  
**Implementation Time**: 3-4 дні

### Option 3: Repository + Service Pattern
**Description**: Розділити на Repository (data access) + Service (business logic) layers
**Pros**:
- Четке розділення data access та business logic
- Легко тестувати з mock repositories
- Enterprise-grade pattern
- Підготовка до майбутніх змін БД
**Cons**:
- Більша складність
- Більше файлів та abstraction layers
- Over-engineering для поточного розміру
**Complexity**: High
**Implementation Time**: 5-6 днів

### Option 4: Hybrid: Service Functions + Database Helpers
**Description**: Функціональні сервіси з централізованими database helpers
**Pros**:
- Баланс між простотою та структурністю
- Легко міграювати з поточного коду
- Менше архітектурних змін
- Швидка імплементація
**Cons**:
- Менше формальної структури
- Потенційне дублювання DB логіки
- Складніше для великої команди
**Complexity**: Low-Medium
**Implementation Time**: 2-3 дні

## ANALYSIS CRITERIA
- **Швидкість міграції**: Наскільки швидко можна мігрувати існуючий код
- **Тестованість**: Наскільки легко писати unit/integration тести  
- **Підтримуваність**: Наскільки легко додавати нові features
- **Масштабованість**: Наскільки архітектура витримає зростання системи

🎨 CREATIVE CHECKPOINT: Options Defined

Проаналізував 4 підходи до Service Layer дизайну. Кожен має свої переваги для різних аспектів системи.

## ANALYSIS OF EXISTING BUSINESS LOGIC PATTERNS

### Типові операції в кожному route handler:
1. **Валідація входних даних** - validateProductData()
2. **Database operations** - productQueries.create/update/delete
3. **Audit logging** - OperationsLogController.logProductOperation()
4. **Error handling** - try/catch з різними SQL error codes
5. **Response formatting** - стандартизовані JSON responses

### Дублювана логіка що потребує централізації:
- Валідація параметрів (ID parsing, required fields)
- Audit logging patterns (before/after state tracking)
- Error handling (SQL constraints, 404s, 500s)
- Response formatting (success/error messages)

🎨 CREATIVE CHECKPOINT: Existing Code Analysis Complete

## DECISION AND RATIONALE

**ОБРАНИЙ ПІДХІД: Option 4 - Hybrid: Service Functions + Database Helpers**

### Обґрунтування рішення:
1. **Швидкість міграції (⭐⭐⭐)**: Існуючий код легко адаптувати
2. **Тестованість (⭐⭐⭐)**: Функції легко тестувати з mock dependencies  
3. **Підтримуваність (⭐⭐⭐)**: Зрозуміла структура для команди
4. **Збереження існуючого коду**: Мінімальні зміни в database.js та controllers

### Чому НЕ інші варіанти:
- **Option 1 (Classes)**: Over-engineering для функціональної природи existing codebase
- **Option 2 (Pure Functions)**: Складно керувати shared dependencies (database, logging)
- **Option 3 (Repository Pattern)**: Занадто складно для поточного розміру системи

## IMPLEMENTATION GUIDELINES

### Service Layer Architecture:
```
services/
├── productService.js      # Product CRUD + business rules
├── productionService.js   # Production planning logic
├── orderService.js        # Order processing + batch allocation  
├── auditService.js        # Centralized logging logic
└── validationService.js   # Shared validation helpers
```

### Service Function Pattern:
```javascript
// productService.js
const auditService = require(./auditService);
const validationService = require(./validationService);

async function createProduct(productData, userContext) {
  // 1. Validate input
  const validation = validationService.validateProduct(productData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // 2. Business logic
  const result = await productQueries.create(validation.validatedData);
  
  // 3. Audit logging  
  await auditService.logProductOperation(
    CREATE_PRODUCT, 
    result, 
    userContext
  );
  
  return result;
}

module.exports = { createProduct, updateProduct, deleteProduct };
```

### Route Handler Pattern:
```javascript
// routes/products.js
const productService = require(../services/productService);
const errorHandler = require(../middleware/errorHandler);

router.post(/products, async (req, res, next) => {
  try {
    const result = await productService.createProduct(req.body, req.user);
    res.status(201).json({ 
      message: Товар створено успішно, 
      id: result.id 
    });
  } catch (error) {
    next(error); // Delegate to centralized error handler
  }
});
```

### Централізовані компоненти:
1. **auditService.js** - Логування всіх операцій
2. **validationService.js** - Загальні validation functions
3. **errorHandler.js** - Middleware для обробки помилок
4. **responseFormatter.js** - Стандартизовані response formats

🎨🎨🎨 EXITING CREATIVE PHASE - SERVICE LAYER DECISION MADE 🎨🎨🎨
