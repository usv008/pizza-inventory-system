# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pizza System is a pizza inventory management system with authentication, batch tracking, production planning, and order management. Built with Node.js/Express backend and vanilla HTML/CSS/JavaScript frontend.

## Common Development Commands

### Backend Development
```bash
cd backend
npm install                    # Install dependencies
node app-new.js               # Start main application server
node db_viewer.js             # Start SQLite database viewer (port 8080)
node test-db.js               # Test database connection
```

### Database Operations
```bash
cd backend
node migrate.js                          # Run database migrations
node batch-system-migration.js           # Batch system migration
node production-planning-migration.js    # Production planning migration
node operations-log-migration.js         # Operations log migration
node create-users-tables-migration.js    # User authentication migration
```

### Frontend Development
- Frontend files are served statically from the `/frontend` directory
- Main entry point: `frontend/index.html`
- No build process required - uses vanilla JavaScript

## Architecture Overview

### Backend Structure
- **Entry Point**: `backend/app-new.js` (main application file)
- **Database**: SQLite database (`pizza_inventory.db`)
- **Architecture Pattern**: Service-Controller-Routes pattern

#### Core Modules
- **Routes** (`/routes/`): Express route handlers
- **Services** (`/services/`): Business logic layer
- **Controllers** (`/controllers/`): Request/response handling for complex operations
- **Middleware** (`/middleware/`): Authentication, error handling, validation
- **Validators** (`/validators/`): Input validation schemas

#### Key Services
- `authService.js` - Authentication and session management
- `userService.js` - User management
- `productService.js` - Product and inventory management
- `orderService.js` - Order processing
- `productionService.js` - Production batch management
- `clientService.js` - Customer management
- `movementService.js` - Inventory movement tracking
- `writeoffService.js` - Product write-off management

### Frontend Structure
- **Main Pages**: `index.html`, `inventory.html`, `orders.html`, `operations.html`, `admin.html`
- **Authentication**: `login.html` with session-based auth
- **Styles**: Modular CSS in `/styles/` directory
- **JavaScript**: Vanilla JS modules in `/js/` directory

### Database Schema
Key tables include:
- `products` - Product catalog with stock tracking
- `stock_movements` - Inventory movement history
- `orders` - Customer orders
- `production_batches` - Production planning and tracking
- `arrivals` - Incoming inventory
- `users` - User authentication and roles
- `sessions` - Express session storage

## Authentication System

The system uses session-based authentication with role-based permissions:
- **Middleware**: `authMiddleware.js` and `roleMiddleware.js`
- **Roles**: Different permission levels for various operations
- **Sessions**: SQLite-based session storage

## Development Patterns

### Error Handling
- Centralized error handling in `middleware/errorHandler.js`
- Custom `AppError` class for structured error responses
- Response formatting middleware for consistent API responses

### Validation
- Express-validator for input validation
- Dedicated validator files for each entity type
- Validation middleware integration in routes

### Database Access
- Direct SQLite3 queries (no ORM)
- Database connection in `database.js`
- Transaction support for complex operations

## Key Features

### Inventory Management
- Product catalog with barcode support
- Stock tracking (pieces and boxes)
- Movement logging with reasons
- Minimum stock alerts

### Production System
- Batch-based production planning
- Raw material allocation
- Production status tracking
- Automated stock updates

### Order Management
- Customer order processing
- PDF and DOCX report generation
- Order status tracking
- Batch reservation system

### Reporting
- PDF generation using PDFKit
- DOCX generation using docxtemplater
- Various operational reports

## Important Files

- `backend/app-new.js` - Main application entry point
- `backend/database.js` - Database initialization and connection
- `backend/old-app.js` - Legacy monolithic application (deprecated)
- `memory-bank/` - Project documentation and development notes
- `PLAN.md` - Development roadmap and refactoring plan

## Migration Notes

The project has been refactored from a monolithic structure (`old-app.js`) to a modular architecture. Key improvements include:
- Separation of concerns with services/controllers/routes
- Centralized error handling
- Authentication system implementation
- Code deduplication and standardization

Future development should focus on:
- Supabase migration (as indicated in recent commits)
- Enhanced security features
- CRM functionality
- Production line integration with scales/label printers

## SQLite → Supabase Migration Notes

**🚨 CRITICAL**: When migrating services from SQLite to Supabase, always check:

### Backend Migration Rules:
1. **Boolean fields**: SQLite uses `INTEGER (1/0)`, Supabase uses `BOOLEAN (true/false)`
2. **JSON fields**: SQLite returns TEXT (needs `JSON.parse()`), Supabase returns JSONB objects
3. **Always create v2 services** with DatabaseAdapter support for both databases
4. **Test with both databases** before switching production

### Frontend Compatibility:
1. **Boolean filtering**: Replace `item.active === 1` with `item.active === 1 || item.active === true`
2. **JSON handling**: Check `typeof` before `JSON.parse()`
3. **Test UI components** after backend changes

### Migration Workflow:
1. Read `backend/MIGRATION_RULES_AND_PITFALLS.md` before starting
2. Create Supabase queries file
3. Create v2 service with dual DB support
4. Update frontend code for data type differences
5. Test with `USE_SUPABASE=false` then `USE_SUPABASE=true`
6. Update migration status documentation

**Key Files for Migration:**
- `.env` - Database configuration (`USE_SUPABASE=true/false`)
- `backend/MIGRATION_RULES_AND_PITFALLS.md` - Detailed migration rules
- `SUPABASE_CODE_MIGRATION_STATUS.md` - Migration progress tracking