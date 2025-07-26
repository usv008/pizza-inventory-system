# Pizza Inventory System — Site Brief

## Overview

The Pizza Inventory System is a web-based application designed for managing the inventory, production, and order tracking of frozen pizzas. It provides batch-level tracking, expiry management, and real-time statistics for efficient warehouse and production operations. The system is built with a modular backend and a modern frontend, supporting both manual and automated workflows.

---

## Key Features

- **Batch Tracking:**
  - Each pizza product is tracked by batches (партії), with expiry dates, production dates, and available quantities.
  - Expiry warnings and status indicators for expiring/expired batches.

- **Inventory Management:**
  - Real-time display of available stock, boxes, and batches for each product.
  - Automatic calculation of boxes and pieces per product.

- **Statistics Dashboard:**
  - Summary cards for total pizza types, stock, boxes, and active batches.
  - Auto-refresh and manual refresh for up-to-date data.

- **User Authentication:**
  - Auth system for admin and user roles (with public read-only access to main stats).

- **Production & Write-off:**
  - Support for production creation, batch write-offs, and operations logging.

- **Responsive UI:**
  - Mobile-friendly, modern design with clear visual cues for inventory status.

---

## Project Structure

- **Root Directory:**
  - Migration scripts, SQL setup files, and documentation.
  - `start-server.sh` and `stop-server.sh` for server management.

- **backend/**
  - Node.js backend with controllers, middleware, database access, and migrations.
  - Controllers for arrivals, batches, write-offs, and operations log.
  - Uses SQLite and Supabase for data storage and migration.

- **frontend/**
  - HTML/CSS/JS for the main UI (index.html, admin.html, inventory.html, etc.).
  - Modular JS for error handling, authentication, navigation, and UI logic.
  - Responsive design with custom styles and assets.

- **memory-bank/** and **cursor-memory-bank/**
  - Documentation, style guides, planning, and optimization notes.

- **public/**
  - Static assets (images, fonts, etc.).

---

## Main Technologies

- **Frontend:**
  - HTML5, CSS3, Vanilla JS (modular, no heavy frameworks)
  - Responsive and accessible design

- **Backend:**
  - Node.js (Express-style controllers)
  - SQLite for local storage, Supabase for cloud sync/migration

- **Other:**
  - Shell scripts for server management
  - Markdown for documentation and planning

---

## Core Workflows

1. **Inventory Overview:**
   - Users see a dashboard of all pizza products with current stock, boxes, and batch details.
   - Expiry warnings are shown for batches nearing or past expiry.

2. **Batch Management:**
   - Admins can add new batches, write off expired/used stock, and view batch history.

3. **Statistics & Reporting:**
   - Real-time stats update automatically and on demand.
   - Operations log tracks all inventory changes.

4. **Authentication:**
   - Public users can view inventory; admins can manage data.

---

## Notable Files

- `frontend/index.html` — Main dashboard UI
- `backend/database.js` — Core DB logic
- `backend/controllers/` — Business logic for inventory, batches, write-offs
- `backend/middleware/` — Auth, error handling, session management
- `create-arrivals-tables.sql`, `create-operations-log-supabase.sql` — DB migrations
- `memory-bank/` — Project documentation and planning

---

## Usage

- Start the server with `start-server.sh`.
- Access the dashboard at the root URL (typically `http://localhost:3000/`).
- Use the admin panel for advanced inventory and batch management.

---

## Documentation

- See `memory-bank/` and `cursor-memory-bank/` for detailed planning, style guides, and technical notes.
- `MOBILE_SETUP.md` and `MOBILE_ACCESS_CORRECT.md` for mobile usage instructions.

---

## Authors & Maintenance

- Designed for warehouse and production staff, with admin features for managers.
- Modular and extensible for future features (e.g., order management, analytics).

---

## License

- Internal use. See project documentation for details.
