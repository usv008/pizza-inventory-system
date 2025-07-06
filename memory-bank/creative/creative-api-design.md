🎨🎨🎨 ENTERING CREATIVE PHASE: API DESIGN 🎨🎨🎨

## PROBLEM STATEMENT
Поточні API endpoints в app.js мають неузгоджену структуру responses, різні patterns для error handling та дублювання logic між схожими операціями. Потрібно створити уніфіковану API структуру що забезпечить:
- Консистентні response formats
- Стандартизовані error codes та messages
- RESTful naming conventions
- Централізовану валідацію
- Легке тестування та документування

## CURRENT API ANALYSIS

### Існуючі endpoints (47 total):
```
Products API:
- GET /api/pizzas (legacy compatibility)
- GET /api/products
- GET /api/products/:id  
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id
- POST /api/products/:id/stock

Production API:
- GET /api/production
- POST /api/production  
- GET /api/production/product/:id

Orders API:
- GET /api/orders
- POST /api/orders
- GET /api/orders/:id
- PUT /api/orders/:id
- GET /api/orders/:id/edit

Writeoffs API:
- GET /api/writeoffs
- POST /api/writeoffs

Movements API:
- GET /api/movements

Clients API:
- GET /api/clients
- POST /api/clients
```

### Проблеми поточної API структури:
1. **Неконсистентні responses**: Різні формати success/error messages
2. **Відсутність стандартизації**: Немає єдиного підходу до pagination/filtering
3. **Error handling варіюється**: Різні HTTP status codes для схожих помилок
4. **Legacy endpoints**: /api/pizzas для backward compatibility
5. **Відсутність API versioning**: Ускладнює майбутні зміни

## OPTIONS ANALYSIS

### Option 1: REST API with JSON:API Specification
**Description**: Впровадити повну JSON:API specification (jsonapi.org)
**Pros**:
- Стандартизований industry format
- Автоматичні relationships та включення
- Pagination та filtering out-of-the-box
- Широка підтримка клієнтів
**Cons**:
- Складно імплементувати для existing клієнтів
- Over-engineering для простої системи
- Breaking changes для frontend
**Complexity**: High
**Implementation Time**: 6-7 днів

### Option 2: Простий REST з Стандартизованими Responses
**Description**: Зберегти REST endpoints з уніфікованою структурою responses
**Pros**:
- Мінімальні зміни для existing frontend
- Просто імплементувати
- Зрозуміло для команди
- Backward compatibility можлива
**Cons**:
- Менше стандартизації ніж JSON:API
- Потребує власні conventions
- Ручна імплементація pagination
**Complexity**: Low
**Implementation Time**: 2-3 дні

### Option 3: GraphQL API
**Description**: Замінити REST на GraphQL endpoint
**Pros**:
- Flexible queries від клієнта
- Strongly typed schema
- Automatic documentation
- Efficient data fetching
**Cons**:
- Повна переробка frontend
- Складність для простої CRUD системи
- Learning curve для команди
**Complexity**: Very High
**Implementation Time**: 10+ днів

### Option 4: Enhanced REST з API Versioning
**Description**: Покращити існуючий REST з versioning та стандартизацією
**Pros**:
- Smooth migration path
- Версіонування дозволяє поступові зміни
- Зберігає existing functionality
- Можна додавати нові features поступово
**Cons**:
- Додаткова складність versioning logic
- Потенційне дублювання коду між версіями
**Complexity**: Medium
**Implementation Time**: 4-5 днів

🎨 CREATIVE CHECKPOINT: API Options Defined

## ANALYSIS OF EXISTING RESPONSE PATTERNS

### Current Response Formats:
1. **Success responses**:
   - Simple data: `res.json(data)` 
   - Created resources: `res.status(201).json({ message: "...", id: ... })`
   - Updated resources: `res.json({ message: "..." })`

2. **Error responses**:
   - Validation errors: `res.status(400).json({ error: "...", details: [...] })`
   - Not found: `res.status(404).json({ error: "..." })`
   - Server errors: `res.status(500).json({ error: "..." })`

### Inconsistencies виявлені:
- Немає стандартного success wrapper
- Error format варіюється (іноді details, іноді ні)
- Відсутні metadata (pagination, timestamps)
- Немає request tracking (correlation IDs)

🎨 CREATIVE CHECKPOINT: Response Analysis Complete

## DECISION AND RATIONALE

**ОБРАНИЙ ПІДХІД: Option 2 - Простий REST з Стандартизованими Responses**

### Обґрунтування рішення:
1. **Мінімальні breaking changes** для існуючого frontend
2. **Швидка імплементація** - найменша складність
3. **Збереження RESTful принципів** без over-engineering
4. **Backward compatibility** - можна поступово мігрувати endpoints

### Чому НЕ інші варіанти:
- **JSON:API/GraphQL**: Over-engineering для Pizza System
- **Versioning**: Додаткова складність без поточної потреби
- Система ще не достатньо велика для enterprise patterns

## IMPLEMENTATION GUIDELINES

### Стандартизована Response Structure:

#### Success Responses:
```javascript
// GET requests (collections)
{
  "success": true,
  "data": [...],
  "meta": {
    "count": 25,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// GET requests (single resource)  
{
  "success": true,
  "data": { id: 1, name: "..." },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// POST/PUT/DELETE requests
{
  "success": true,
  "message": "Товар створено успішно",
  "data": { id: 123 },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Error Responses:
```javascript  
// Validation errors
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Помилки валідації",
    "details": [
      { "field": "name", "message": "Обов'язкове поле" }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// Not found errors
{
  "success": false,
  "error": {
    "code": "NOT_FOUND", 
    "message": "Товар не знайдено"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// Server errors
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Помилка сервера"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Response Helper Functions:
```javascript
// middleware/responseFormatter.js
function formatSuccess(data, message = null, meta = {}) {
  return {
    success: true,
    ...(message && { message }),
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

function formatError(code, message, details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}
```

### Legacy Compatibility Strategy:
1. **Зберегти /api/pizzas** endpoint з старим форматом
2. **Поступово оновити** frontend для нового формату
3. **Dual format period** - підтримувати обидва формати
4. **Eventual migration** - видалити legacy після переходу frontend

🎨🎨🎨 EXITING CREATIVE PHASE - API DESIGN DECISION MADE 🎨🎨🎨
