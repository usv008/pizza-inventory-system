-- Fixed SQL script - "user" is a reserved keyword in PostgreSQL
-- Need to use quotes around reserved keywords

-- Add missing SQLite fields to stock_movements
ALTER TABLE stock_movements ADD COLUMN pieces INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN "user" TEXT DEFAULT 'system';

-- Disable RLS for development
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
