-- ==============================================================================
-- Schema Definition: QR Print Kiosk (QRLY)
-- Migration: 0001_init.sql
-- ==============================================================================

-- Enable cryptographic extensions for UUID generation and hashing
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Shops Table
-- Stores print shop profiles, base pricing, multipliers, and owner associations
-- ------------------------------------------------------------------------------
create table shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bw_price_paise int not null default 200 check (bw_price_paise >= 0),
  color_price_paise int not null default 1000 check (color_price_paise >= 0),
  q_draft_mult numeric(4,2) not null default 1.00 check (q_draft_mult > 0),
  q_normal_mult numeric(4,2) not null default 1.00 check (q_normal_mult > 0),
  q_high_mult numeric(4,2) not null default 1.50 check (q_high_mult > 0),
  max_file_mb int not null default 25 check (max_file_mb > 0),
  order_expiry_minutes int not null default 30 check (order_expiry_minutes > 0),
  accepting_orders boolean not null default true,
  agent_key_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. Printers Table
-- Hardware printers associated with a shop, telemetry, and capabilities
-- ------------------------------------------------------------------------------
create table printers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  system_name text not null,
  supports_color boolean not null default true,
  supports_duplex boolean not null default true,
  status text not null default 'offline' check (status in ('online', 'offline', 'error')),
  status_detail text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. Shop Counters Table
-- Maintains per-shop daily rolling sequence for human-friendly token numbers
-- ------------------------------------------------------------------------------
create table shop_counters (
  shop_id uuid not null references shops(id) on delete cascade,
  day date not null,
  last_token int not null default 0,
  primary key (shop_id, day)
);

-- ------------------------------------------------------------------------------
-- 4. Orders Table
-- Core order entity tracking total amounts, Razorpay references, and states
-- ------------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  token_label text,
  guest_secret_hash text not null,
  status text not null default 'draft' check (
    status in ('draft', 'awaiting_payment', 'paid', 'queued', 'printing', 'done', 'failed', 'expired', 'refunded')
  ),
  total_paise int not null default 0 check (total_paise >= 0),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  paid_at timestamptz,
  expires_at timestamptz not null,
  files_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. Order Files Table
-- Individual documents within an order with user print options & price breakdown
-- ------------------------------------------------------------------------------
create table order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  original_name text not null,
  storage_path text,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0),
  page_count int not null check (page_count > 0),
  color_mode text not null default 'bw' check (color_mode in ('bw', 'color')),
  quality text not null default 'normal' check (quality in ('draft', 'normal', 'high')),
  copies int not null default 1 check (copies between 1 and 50),
  page_range text,
  selected_pages int not null check (selected_pages > 0),
  sides text not null default 'single' check (sides in ('single', 'double')),
  price_paise int not null default 0 check (price_paise >= 0),
  deleted_at timestamptz,
  delete_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 6. Print Jobs Table
-- Dispatch queue items consumed by local shop print agent
-- ------------------------------------------------------------------------------
create table print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_file_id uuid not null unique references order_files(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  printer_id uuid references printers(id) on delete set null,
  status text not null default 'queued' check (
    status in ('queued', 'claimed', 'printing', 'done', 'failed', 'cancelled')
  ),
  attempts int not null default 0,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  agent_local_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. Payment Events Table
-- Audit log and idempotency guard for Razorpay incoming webhooks
-- ------------------------------------------------------------------------------
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  razorpay_event_id text unique not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- Indexes for High Performance Queries
-- ------------------------------------------------------------------------------
create index idx_print_jobs_shop_status on print_jobs (shop_id, status, created_at);
create index idx_orders_shop_created on orders (shop_id, created_at desc);
create index idx_orders_status_expires on orders (status, expires_at);
create index idx_order_files_order_id on order_files (order_id);
create index idx_printers_shop_status on printers (shop_id, status);

-- ------------------------------------------------------------------------------
-- Stored Procedures & Atomic Functions
-- ------------------------------------------------------------------------------

-- Atomic job claim function:
-- Concurrently safe job claiming with lease timeout mechanism
create or replace function claim_next_job(
  p_shop uuid,
  p_printer uuid,
  p_lease_seconds int default 120
)
returns setof print_jobs language plpgsql as $$
begin
  return query
  update print_jobs j
     set status = 'claimed',
         printer_id = p_printer,
         claimed_at = now(),
         claim_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1,
         updated_at = now()
   where j.id = (
     select id from print_jobs
      where shop_id = p_shop
        and (status = 'queued' or (status = 'claimed' and claim_expires_at < now()))
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
end;
$$;

-- Atomic daily token generator:
-- Allocates sequential token per shop per day (e.g., A-001, A-002, ...)
create or replace function next_shop_token(p_shop_id uuid)
returns text language plpgsql as $$
declare
  v_today date := current_date;
  v_next_val int;
  v_prefix char(1) := 'A';
begin
  insert into shop_counters (shop_id, day, last_token)
  values (p_shop_id, v_today, 1)
  on conflict (shop_id, day)
  do update set last_token = shop_counters.last_token + 1
  returning last_token into v_next_val;

  return v_prefix || '-' || lpad(v_next_val::text, 3, '0');
end;
$$;

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
alter table shops enable row level security;
alter table printers enable row level security;
alter table shop_counters enable row level security;
alter table orders enable row level security;
alter table order_files enable row level security;
alter table print_jobs enable row level security;
alter table payment_events enable row level security;

-- Revoke all direct privileges from public anonymous key
revoke all on shops from anon;
revoke all on printers from anon;
revoke all on shop_counters from anon;
revoke all on orders from anon;
revoke all on order_files from anon;
revoke all on print_jobs from anon;
revoke all on payment_events from anon;

-- Shop Owner Policies (authenticated via Supabase Auth)
create policy "Owners manage own shop"
  on shops for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage own printers"
  on printers for all
  using (shop_id in (select id from shops where owner_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_id = auth.uid()));

create policy "Owners view own orders"
  on orders for select
  using (shop_id in (select id from shops where owner_id = auth.uid()));

create policy "Owners view own order files"
  on order_files for select
  using (order_id in (
    select o.id from orders o
    join shops s on o.shop_id = s.id
    where s.owner_id = auth.uid()
  ));

create policy "Owners manage own print jobs"
  on print_jobs for all
  using (shop_id in (select id from shops where owner_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_id = auth.uid()));

