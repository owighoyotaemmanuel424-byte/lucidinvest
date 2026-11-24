-- Additive migration: investment marketplace, wealth management, KYC, support,
-- notifications, referrals, staff roles and audit-related security records.
--
-- Nothing here deletes or rewrites existing customer records. Every new column is
-- nullable or has a safe default, and every new table is created with IF NOT
-- EXISTS so the migration can be re-run after inspection.
--
-- Money stays NUMERIC(24, 8). The existing wallets / wallet_requests /
-- ledger_transactions / ledger_entries tables remain the single source of truth
-- for cash: `deposits` and `withdrawals` are read-only views over wallet_requests
-- rather than duplicate money tables.

-- ---------------------------------------------------------------------------
-- Investment product catalogue
-- ---------------------------------------------------------------------------

ALTER TABLE investment_products
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'portfolio',
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS fee_bps INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS management_fee_bps INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_ratio NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS coupon_rate NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS yield_rate NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS maturity_date DATE,
  ADD COLUMN IF NOT EXISTS allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_products_category_check') THEN
    ALTER TABLE investment_products ADD CONSTRAINT investment_products_category_check
      CHECK (category IN ('stocks', 'etfs', 'bonds', 'mutual_funds', 'crypto', 'portfolio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_products_risk_check') THEN
    ALTER TABLE investment_products ADD CONSTRAINT investment_products_risk_check
      CHECK (risk_level IN ('low', 'medium', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_products_duration_check') THEN
    ALTER TABLE investment_products ADD CONSTRAINT investment_products_duration_check
      CHECK (duration_days IS NULL OR duration_days > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS investment_products_category_status_idx
  ON investment_products(category, status);

-- ---------------------------------------------------------------------------
-- Market data (explicitly demo-flagged unless a real feed is configured)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('stock', 'etf', 'bond', 'mutual_fund', 'crypto')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  exchange TEXT,
  sector TEXT,
  description TEXT NOT NULL DEFAULT '',
  expense_ratio NUMERIC(6, 4),
  coupon_rate NUMERIC(6, 4),
  maturity_date DATE,
  is_demo BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_instruments_asset_class_idx
  ON market_instruments(asset_class, status);

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES market_instruments(id) ON DELETE CASCADE,
  price NUMERIC(24, 8) NOT NULL CHECK (price > 0),
  change_percent NUMERIC(10, 4) NOT NULL DEFAULT 0,
  as_of TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS market_prices_instrument_as_of_idx
  ON market_prices(instrument_id, as_of DESC);

-- ---------------------------------------------------------------------------
-- Market orders and holdings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  instrument_id UUID NOT NULL REFERENCES market_instruments(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
  price NUMERIC(24, 8) NOT NULL CHECK (price > 0),
  notional NUMERIC(24, 8) NOT NULL CHECK (notional > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
  reference TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filled_at TIMESTAMPTZ,
  processed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS investment_orders_user_created_idx
  ON investment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS investment_orders_status_created_idx
  ON investment_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  instrument_id UUID NOT NULL REFERENCES market_instruments(id) ON DELETE RESTRICT,
  quantity NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  average_cost NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id, instrument_id)
);
CREATE INDEX IF NOT EXISTS investment_holdings_user_idx
  ON investment_holdings(user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- KYC and compliance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  date_of_birth DATE,
  country TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT,
  source_of_funds TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  risk_rating TEXT NOT NULL DEFAULT 'medium' CHECK (risk_rating IN ('low', 'medium', 'high')),
  reviewer_notes TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS kyc_submissions_status_idx
  ON kyc_submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('identity', 'address', 'source_of_funds')),
  file_name TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kyc_documents_submission_idx
  ON kyc_documents(submission_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Staff roles and permissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS admin_role_id UUID REFERENCES admin_roles(id) ON DELETE SET NULL;

INSERT INTO admin_permissions (code, label, category) VALUES
  ('customers.read', 'View customer records', 'customers'),
  ('customers.write', 'Change customer status and restrictions', 'customers'),
  ('investments.read', 'View investments and orders', 'investments'),
  ('investments.write', 'Approve investments and orders', 'investments'),
  ('products.write', 'Publish and suspend investment products', 'products'),
  ('wallet.read', 'View deposits and withdrawals', 'wallet'),
  ('wallet.write', 'Approve deposits and withdrawals', 'wallet'),
  ('kyc.read', 'View KYC submissions', 'compliance'),
  ('kyc.write', 'Review KYC submissions', 'compliance'),
  ('support.read', 'View support tickets', 'support'),
  ('support.write', 'Reply to and resolve support tickets', 'support'),
  ('reports.read', 'Download platform reports', 'reporting'),
  ('staff.write', 'Manage staff and roles', 'staff'),
  ('settings.write', 'Change platform settings', 'settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_roles (name, description, permissions)
VALUES ('Super Administrator', 'Full access to every administrative capability.',
        '["customers.read","customers.write","investments.read","investments.write","products.write","wallet.read","wallet.write","kyc.read","kyc.write","support.read","support.write","reports.read","staff.write","settings.write"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_roles (name, description, permissions)
VALUES ('Finance Officer', 'Reviews deposits, withdrawals and platform reporting.',
        '["customers.read","wallet.read","wallet.write","reports.read"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_roles (name, description, permissions)
VALUES ('Compliance Officer', 'Reviews identity verification and AML risk.',
        '["customers.read","kyc.read","kyc.write","investments.read","reports.read"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_roles (name, description, permissions)
VALUES ('Support Agent', 'Handles customer support tickets and notifications.',
        '["customers.read","support.read","support.write"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notifications, support, portfolio history, referrals, login history, settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'success', 'warning', 'security')),
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx
  ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets(status, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
  ON support_ticket_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  as_of DATE NOT NULL,
  total_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  invested_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  cash_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  returns_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, as_of, currency)
);
CREATE INDEX IF NOT EXISTS portfolio_snapshots_user_as_of_idx
  ON portfolio_snapshots(user_id, as_of DESC);

CREATE TABLE IF NOT EXISTS referral_codes (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded', 'cancelled')),
  reward_amount NUMERIC(24, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  UNIQUE (referrer_user_id, referred_email)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_created_idx
  ON referrals(referrer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS login_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_events_user_created_idx
  ON login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_email_created_idx
  ON login_events(email, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL
);

INSERT INTO platform_settings (key, value) VALUES
  ('platform', '{"name":"LucidInvest","supportEmail":"support@lucidinvest.com","demoLabel":"Simulated demo data","maintenanceMode":false}'::jsonb),
  ('trading', '{"ordersRequireReview":true,"maxOrderNotional":100000,"allowSell":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Two-factor authentication state and read-only deposits/withdrawals views
-- ---------------------------------------------------------------------------

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW deposits AS
  SELECT r.id, r.user_id, r.wallet_id, r.amount, r.currency, r.status, r.reference,
         r.note, r.created_at, r.processed_at, r.processed_by
  FROM wallet_requests r
  WHERE r.kind = 'deposit';

CREATE OR REPLACE VIEW withdrawals AS
  SELECT r.id, r.user_id, r.wallet_id, r.amount, r.currency, r.status, r.reference,
         r.note, r.created_at, r.processed_at, r.processed_by
  FROM wallet_requests r
  WHERE r.kind = 'withdrawal';

INSERT INTO schema_migrations (version) VALUES ('0007_platform')
ON CONFLICT (version) DO NOTHING;
