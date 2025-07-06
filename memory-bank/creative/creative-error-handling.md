🎨🎨🎨 ENTERING CREATIVE PHASE: ERROR HANDLING DESIGN 🎨🎨🎨

## PROBLEM STATEMENT
Поточний error handling в app.js є неузгодженим та розкиданим по різних частинах коду. Кожен route handler має власну логіку обробки помилок, що призводить до:
- Дублювання error handling logic
- Неконсистентні error messages
- Різні HTTP status codes для схожих помилок  
- Складність debugging та monitoring
- Відсутність централізованого logging

## CURRENT ERROR HANDLING ANALYSIS

### Існуючі patterns обробки помилок:
```javascript
// Pattern 1: Try-catch в кожному route handler
app.post(/api/products, async (req, res) => {
  try {
    // business logic
  } catch (error) {
    console.error(Product creation error:, error);
    res.status(500).json({ error: Помилка сервера });
  }
});

// Pattern 2: Specific error handling  
if (error.code === SQLITE_CONSTRAINT_UNIQUE) {
  res.status(400).json({ error: Товар з таким кодом вже існує });
} else {
  res.status(500).json({ error: Помилка сервера });
}

// Pattern 3: Validation errors
if (!validation.isValid) {
  return res.status(400).json({ 
    error: Помилки валідації, 
    details: validation.errors 
  });
}
```

### Проблеми поточного підходу:
1. **Дублювання коду**: Однакова error logic в кожному handler
2. **Неконсистентні messages**: Різні формулювання для схожих помилок
3. **Відсутність категоризації**: Немає чіткої системи error types
4. **Складність debugging**: Помилки не мають unique identifiers
5. **Відсутність monitoring**: Немає централізованого error tracking

## OPTIONS ANALYSIS

### Option 1: Express Error Middleware
**Description**: Використати вбудований Express error handling middleware
**Pros**:
- Стандартний Express pattern
- Централізована обробка всіх помилок
- Automatic error propagation з next(error)
- Простота імплементації
**Cons**:
- Обмежені можливості кастомізації
- Складно додати custom error types
- Менше контролю над error flow
**Complexity**: Low
**Implementation Time**: 1-2 дні

### Option 2: Custom Error Classes + Middleware
**Description**: Створити custom error classes з централізованим middleware
**Pros**:
- Повний контроль над error types
- Можливість додавати metadata до помилок
- Легко розширювати нові error types
- Кращий debugging з stack traces
**Cons**:
- Більше boilerplate коду
- Складніша імплементація
- Потребує рефакторинг існуючого коду
**Complexity**: Medium
**Implementation Time**: 3-4 дні

### Option 3: Result Pattern (Either/Maybe)
**Description**: Використати functional programming Result pattern
**Pros**:
- Explicit error handling без exceptions
- Type safety (якщо використовувати TypeScript)
- Compositional error handling
- Функціональний підхід
**Cons**:
- Unfamiliar pattern для більшості JS developers
- Великий refactoring existing codebase
- Over-engineering для простої системи
**Complexity**: High  
**Implementation Time**: 6-7 днів

### Option 4: Hybrid: Error Classes + Express Middleware + Logging
**Description**: Комбінація custom errors з Express middleware та logging
**Pros**:
- Best of both worlds - кастомізація + стандарти
- Централізоване logging та monitoring
- Легко додавати нові error types
- Backward compatibility з existing handlers
**Cons**:
- Трохи більша складність
- Потребує планування error hierarchy
**Complexity**: Medium
**Implementation Time**: 3-4 дні

🎨 CREATIVE CHECKPOINT: Error Handling Options Defined

## ANALYSIS OF EXISTING ERROR TYPES

### Типи помилок виявлені в системі:
1. **Database Constraint Errors**: SQLITE_CONSTRAINT_UNIQUE
2. **Validation Errors**: Неправильні або відсутні поля
3. **Not Found Errors**: Ресурс не знайдено (404)
4. **Server Errors**: Загальні помилки сервера (500)  
5. **Bad Request**: Неправильні параметри (400)
6. **Service Unavailable**: База даних недоступна (503)

🎨 CREATIVE CHECKPOINT: Error Types Analysis Complete

## DECISION AND RATIONALE

**ОБРАНИЙ ПІДХІД: Option 4 - Hybrid: Error Classes + Express Middleware + Logging**

### Обґрунтування рішення:
1. **Баланс складності та функціональності** - не over-engineering, але достатньо потужний
2. **Легка міграція** - можна поступово заміняти існуючі try-catch блоки
3. **Централізоване logging** - всі помилки в одному місці для monitoring
4. **Розширюваність** - легко додавати нові error types

### Чому НЕ інші варіанти:
- **Express-only middleware**: Занадто обмежений для custom needs
- **Result Pattern**: Over-engineering для JavaScript codebase
- **Pure custom classes**: Втрачаємо Express integrations

## IMPLEMENTATION GUIDELINES

### Error Class Hierarchy:
```javascript
// middleware/errors/AppError.js
class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Operational vs Programming errors
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(details) {
    super(Помилки валідації, 400, VALIDATION_ERROR, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} не знайдено`, 404, NOT_FOUND);
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 500, DATABASE_ERROR);
    this.originalError = originalError;
  }
}

class UniqueConstraintError extends AppError {
  constructor(field) {
    super(`${field} вже існує`, 400, UNIQUE_CONSTRAINT);
  }
}
```

### Global Error Handler Middleware:
```javascript
// middleware/errorHandler.js
const AppError = require(./errors/AppError);
const responseFormatter = require(./responseFormatter);

function globalErrorHandler(error, req, res, next) {
  // Log error for monitoring
  console.error(Error occurred:, {
    error: error.message,
    stack: error.stack,
    code: error.code,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle known operational errors
  if (error.isOperational) {
    return res.status(error.statusCode).json(
      responseFormatter.formatError(error.code, error.message, error.details)
    );
  }

  // Handle database-specific errors
  if (error.code === SQLITE_CONSTRAINT_UNIQUE) {
    return res.status(400).json(
      responseFormatter.formatError(UNIQUE_CONSTRAINT, Ресурс вже існує)
    );
  }

  // Handle unknown errors (programming errors)
  console.error(Programming error:, error);
  
  return res.status(500).json(
    responseFormatter.formatError(
      INTERNAL_ERROR, 
      process.env.NODE_ENV === development ? error.message : Помилка сервера
    )
  );
}

module.exports = globalErrorHandler;
```

### Usage in Service Layer:
```javascript
// services/productService.js
const { ValidationError, NotFoundError } = require(../middleware/errors);

async function createProduct(productData) {
  const validation = validationService.validateProduct(productData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  try {
    return await productQueries.create(validation.validatedData);
  } catch (error) {
    if (error.code === SQLITE_CONSTRAINT_UNIQUE) {
      throw new UniqueConstraintError(товар з таким кодом);
    }
    throw new DatabaseError(Помилка створення товару, error);
  }
}
```

### Route Handler Pattern:
```javascript
// routes/products.js  
router.post(/products, async (req, res, next) => {
  try {
    const result = await productService.createProduct(req.body);
    res.status(201).json(
      responseFormatter.formatSuccess(result, Товар створено успішно)
    );
  } catch (error) {
    next(error); // Pass to global error handler
  }
});
```

### Migration Strategy:
1. **Створити error classes та middleware**
2. **Додати global error handler в app.js**
3. **Поступово замінювати try-catch в route handlers**
4. **Оновити service layer для використання custom errors**
5. **Тестувати кожен модуль після міграції**

🎨��🎨 EXITING CREATIVE PHASE - ERROR HANDLING DECISION MADE 🎨🎨🎨

## ✅ ALL CREATIVE PHASES COMPLETED

🎨 **Service Layer Design**: Hybrid функціональний підхід ✅
🎨 **API Design**: Стандартизовані REST responses ✅  
🎨 **Error Handling Design**: Custom Error Classes + Express Middleware ✅

**CREATIVE MODE ЗАВЕРШЕНО** - Готовий до переходу в IMPLEMENT MODE
