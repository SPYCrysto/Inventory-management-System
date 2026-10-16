# Inventra — Enterprise Cloud Inventory Management System

A production-ready inventory management platform with a customizable SaaS interface, multi-warehouse support, audit logging, and secure PostgreSQL persistence via **Supabase**.

## Technology Stack

- **Frontend**: React 18, Vite, React Router 6, Vanilla CSS design system (Dark/Light/System theme)
- **Backend**: Node.js, Express, Supabase JavaScript Client
- **Online Database & Auth**: Supabase (PostgreSQL + Row-Level Security)
- **Testing**: Vitest + Supertest
- **Deployment**: Vercel Serverless Function (`api/index.js`) + Single Page Application

---

## Architecture Layout

```
api/index.js          Vercel Serverless Function entry (wraps Express)
server/               Express backend
  app.js              Main Express application configuration
  db.js               Supabase connection and health probe
  supabase.js         Supabase Client initialization
  models/             Supabase data models (Product, Movement, Supplier, Order)
  routes/             REST endpoints (products, alerts, movements, stats, suppliers, orders, health)
src/                  React Vite Frontend
  context/            AuthContext (Supabase Auth & RBAC: Admin, Manager, Staff)
  pages/              Dashboard, Products, Categories, StockOperations, Stock, Orders, Suppliers, Alerts, Reports, Team, Todos, Settings
  theme.jsx           Theme provider (dark, light, system, accent color, currency)
  ui.jsx              Design system components (Card, Button, Badge, Modal, Input, Icons)
  extensions.jsx      Command Palette (Ctrl+K), Barcode Scanner, Quick Search
  api.js              Axios client for backend REST API
supabase/             PostgreSQL migrations and schema
  schema.sql          Unified SQL DDL script for all 12 tables and RLS policies
  migrations/         Timestamped migration files
tests/
  api.test.js         Vitest integration test suite
vercel.json           Serverless function rewrites and SPA fallback
```

---

## 1. Supabase Database Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard:
   👉 `https://supabase.com/dashboard/project/<your-project-ref>/sql`
3. Paste and run the complete DDL script from `supabase/schema.sql`.
   This creates:
   - `organizations` — multi-tenant workspaces.
   - `profiles` — user accounts linked to Supabase Auth.
   - `organization_members` — role assignments (`admin`, `manager`, `staff`).
   - `categories` — catalog classification with product counters.
   - `products` — product information, SKUs, barcodes, pricing, reorder thresholds.
   - `suppliers` — supplier profiles, contact details, payment terms.
   - `product_suppliers` — multi-vendor supplier-product mapping.
   - `stock_movements` — immutable audit log of every stock change.
   - `purchase_orders` — purchase & sales orders with GST calculations.
   - `purchase_order_items` — line items and partial receipt tracking.
   - `notifications` — in-app notifications.
   - `audit_logs` — administrative change logs.
   - `todos` — cloud sync compatibility table.
   - Row Level Security (RLS) policies allowing secure client and backend access.

---

## 2. Environment Configuration

Copy `.env.example` to `.env`:

```env
PORT=5000
NODE_ENV=development

# Supabase Backend & Client Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_KEY=sb_publishable_<your-publishable-key>
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-publishable-key>
```

---

## 3. Local Development

```bash
# Install dependencies
npm install

# Run Vite dev server and Express API concurrently
npm run dev

# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

---

## 4. Run Automated Tests

```bash
# Run Vitest test suite
npm test

# Build production bundle
npm run build
```

---

## 5. Vercel Deployment

1. Import the repository in [Vercel](https://vercel.com/new).
2. Set Root Directory to `inventory-system`.
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Click **Deploy**. Vercel will build the Vite assets and deploy `api/index.js` as an edge serverless function.
