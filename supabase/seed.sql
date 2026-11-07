-- ==============================================================================
-- Seed Data: QR Print Kiosk (QRLY)
-- Seed: seed.sql
-- ==============================================================================

-- Create a mock owner ID in auth.users if not running in managed cloud,
-- or use a deterministic UUID for local testing.
do $$
declare
  demo_owner_id uuid := 'a0000000-0000-0000-0000-000000000001';
  demo_shop_id uuid := 'b0000000-0000-0000-0000-000000000001';
  demo_printer_id uuid := 'c0000000-0000-0000-0000-000000000001';
  -- SHA-256 hash of "agk_test_secret_key_123"
  demo_agent_key_hash text := encode(digest('agk_test_secret_key_123', 'sha256'), 'hex');
begin
  -- Insert Demo Shop
  insert into shops (
    id,
    slug,
    name,
    owner_id,
    bw_price_paise,
    color_price_paise,
    q_draft_mult,
    q_normal_mult,
    q_high_mult,
    max_file_mb,
    order_expiry_minutes,
    accepting_orders,
    agent_key_hash
  )
  values (
    demo_shop_id,
    'quickprint',
    'QuickPrint Express Kiosk',
    demo_owner_id,
    200,    -- Rs 2.00
    1000,   -- Rs 10.00
    1.00,   -- Draft multiplier
    1.00,   -- Normal multiplier
    1.50,   -- High quality multiplier
    25,     -- 25 MB max per file
    30,     -- 30 min order expiry
    true,
    demo_agent_key_hash
  )
  on conflict (slug) do nothing;

  -- Insert Demo Printer
  insert into printers (
    id,
    shop_id,
    system_name,
    supports_color,
    supports_duplex,
    status,
    status_detail,
    last_seen_at
  )
  values (
    demo_printer_id,
    demo_shop_id,
    'ShopPrinter',
    true,
    true,
    'online',
    'Ready to print · Tray 1 full',
    now()
  )
  on conflict (id) do nothing;

end $$;

