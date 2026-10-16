-- ==============================================================================
-- INVENTRA PRODUCTION SUPABASE SCHEMA
-- Normalized schema for multi-tenant inventory management system
-- ==============================================================================

-- 1. Organizations (Multi-tenancy / workspace isolation)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default organization
insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default-org')
on conflict (id) do nothing;

-- 2. Profiles (Extended user details linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  full_name text default '',
  avatar_url text default '',
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_organization_id on public.profiles(organization_id);

-- 3. Organization Members (RBAC: Admin, Manager, Staff)
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);

-- 4. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_categories_org on public.categories(organization_id);

-- 5. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text not null,
  barcode text default '',
  description text default '',
  image_url text default '',
  category text not null default 'General',
  unit text not null default 'pcs',
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  min_stock_threshold integer not null default 10 check (min_stock_threshold >= 0),
  warehouse text not null default 'Main Hub (Bengaluru)',
  status text not null default 'active' check (status in ('active', 'damaged', 'archived')),
  supplier text not null default 'Standard Vendor',
  batch_number text default '',
  expiry_date timestamptz default null,
  serial_number text default '',
  reorder_quantity integer not null default 25 check (reorder_quantity >= 1),
  gst_rate integer not null default 18,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create index if not exists idx_products_org_sku on public.products(organization_id, sku);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_warehouse on public.products(warehouse);
create index if not exists idx_products_status on public.products(status);

-- 6. Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  contact_person text default '',
  phone text default '',
  email text default '',
  address text default '',
  city text not null default 'Mumbai',
  gstin text default '',
  payment_terms text not null default 'Net 30',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_suppliers_org_code on public.suppliers(organization_id, code);

-- 7. Product-Supplier relationships (optional multi-supplier linking)
create table if not exists public.product_suppliers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_sku text default '',
  unit_cost numeric(12, 2) default 0,
  is_primary boolean default false,
  created_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create index if not exists idx_product_suppliers_prod on public.product_suppliers(product_id);
create index if not exists idx_product_suppliers_supp on public.product_suppliers(supplier_id);

-- 8. Stock Movements (Immutable Inventory Audit Trail)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  sku text not null,
  warehouse text not null default 'Main Hub (Bengaluru)',
  previous_quantity integer not null default 0,
  delta integer not null,
  new_quantity integer not null check (new_quantity >= 0),
  reason text not null default 'Manual Adjustment',
  reference_id text default '',
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_prod on public.stock_movements(product_id);
create index if not exists idx_stock_movements_org on public.stock_movements(organization_id);
create index if not exists idx_stock_movements_created on public.stock_movements(created_at desc);

-- Also create view or table for legacy movements compatibility
create or replace view public.movements as
  select id, product_id, product_name, sku, delta, reason, new_quantity as running_balance, created_at
  from public.stock_movements;

-- 9. Purchase Orders
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  order_number text not null unique,
  type text not null default 'purchase' check (type in ('purchase', 'sales')),
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'fulfilled', 'cancelled')),
  party_name text not null default '',
  party_gstin text default '',
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  warehouse text not null default 'Main Hub (Bengaluru)',
  notes text default '',
  order_date timestamptz not null default now(),
  expected_date timestamptz,
  created_by uuid,
  invoice_number text default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_org on public.purchase_orders(organization_id);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_status on public.purchase_orders(status);
create index if not exists idx_purchase_orders_created on public.purchase_orders(created_at desc);

-- 10. Purchase Order Items (tracking line items, ordered and received quantities)
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text not null,
  ordered_quantity integer not null check (ordered_quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  tax_rate integer not null default 18,
  total_price numeric(12, 2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_po_items_order on public.purchase_order_items(purchase_order_id);
create index if not exists idx_po_items_prod on public.purchase_order_items(product_id);

-- 11. Notifications (In-app notification center)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  user_id uuid,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'alert', 'warning', 'success')),
  read boolean not null default false,
  link text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_org on public.notifications(organization_id);
create index if not exists idx_notifications_read on public.notifications(read);

-- 12. Audit Logs (Security & Compliance History)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text default '',
  details jsonb default '{}'::jsonb,
  ip_address text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org on public.audit_logs(organization_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- 13. Todos Table (Supabase Quickstart Compatibility)
create table if not exists public.todos (
  id bigint generated by default as identity primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.product_suppliers enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.todos enable row level security;

-- Open policies for anon & authenticated roles (allows frontend access with publishable key)
create policy "Allow all access to organizations" on public.organizations for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to profiles" on public.profiles for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to organization_members" on public.organization_members for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to categories" on public.categories for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to products" on public.products for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to suppliers" on public.suppliers for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to product_suppliers" on public.product_suppliers for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to stock_movements" on public.stock_movements for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to purchase_orders" on public.purchase_orders for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to purchase_order_items" on public.purchase_order_items for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to notifications" on public.notifications for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to audit_logs" on public.audit_logs for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to todos" on public.todos for all to anon, authenticated using (true) with check (true);

-- ==============================================================================
-- 14. SUPABASE STORAGE (Inventory Assets, Product Images & Invoices)
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-assets',
  'inventory-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update set public = true;

-- Storage Policies for Public Upload & Retrieval
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Access to inventory-assets'
  ) then
    create policy "Public Access to inventory-assets"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'inventory-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow Upload to inventory-assets'
  ) then
    create policy "Allow Upload to inventory-assets"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'inventory-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow Update to inventory-assets'
  ) then
    create policy "Allow Update to inventory-assets"
    on storage.objects for update
    to anon, authenticated
    using (bucket_id = 'inventory-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow Delete to inventory-assets'
  ) then
    create policy "Allow Delete to inventory-assets"
    on storage.objects for delete
    to anon, authenticated
    using (bucket_id = 'inventory-assets');
  end if;
end $$;

