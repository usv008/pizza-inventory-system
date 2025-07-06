# PIZZA SYSTEM - TECHNICAL CONTEXT

## ПОТОЧНА ТЕХНОЛОГІЧНА СИТУАЦІЯ

### Існуюча архітектура
- **Моноліт**: app.js (1890 рядків)
- **Pattern**: All-in-one файл з роутами + логікою + валідацією
- **Database**: SQLite3 з прямими queries в роутах

### Технологічний стек
- **Runtime**: Node.js v18.20.8  
- **Framework**: Express.js v5.1.0
- **Database**: SQLite3 v5.1.7
- **Frontend**: Vanilla HTML/CSS/JS
- **Documents**: PDFKit, Docxtemplater

### Валідовані технології для рефакторингу
✅ **Express Router Pattern**: Підтверджено
✅ **Module System**: CommonJS експорт/імпорт
✅ **Service Layer**: Можливо реалізувати  
✅ **Modular Architecture**: Технічно можливо

## ЦІЛЬОВА АРХІТЕКТУРА

### Модульна структура
```
backend/
├── app.js (новий, ~100 рядків)
├── routes/           # HTTP endpoints
│   ├── products.js
│   ├── production.js  
│   ├── orders.js
│   └── ...
├── services/         # Business logic
│   ├── productService.js
│   ├── orderService.js
│   └── ...
├── validators/       # Data validation
├── middleware/       # Common middleware  
└── utils/           # Helper functions
```

### Patterns для впровадження
- **Router Pattern**: `express.Router()` для кожного модуля
- **Service Layer**: Інкапсуляція бізнес-логіки  
- **Validator Pattern**: Централізована валідація
- **Error Handling**: Єдиний middleware для обробки помилок

## МІГРАЦІЙНА СТРАТЕГІЯ
1. **Proof of Concept**: Products module (найпростіший)
2. **Pattern Replication**: Застосування до інших модулів
3. **Gradual Migration**: Поступове прибирання старого коду
4. **Testing**: Верифікація функціональності на кожному кроці
