-- Additive migration: chart of accounts for system postings and a balance check
-- on marketplace transactions.
--
-- Existing customer records and ledger rows are untouched. New market-order
-- fills post two entries that sum to zero: the customer's cash account and a
-- platform clearing account. A deferred check only enforces balance for
-- transactions referenced with ORD-, so legacy single-owner rows stay valid.

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'asset' CHECK (kind IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, currency)
);

INSERT INTO ledger_accounts (code, name, kind, currency) VALUES
  ('PLATFORM_CLEARING', 'Platform clearing account', 'liability', 'USD'),
  ('PLATFORM_CLEARING', 'Platform clearing account', 'liability', 'EUR'),
  ('PLATFORM_CLEARING', 'Platform clearing account', 'liability', 'GBP')
ON CONFLICT (code, currency) DO NOTHING;

ALTER TABLE investment_orders ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS ledger_account_id UUID REFERENCES ledger_accounts(id) ON DELETE RESTRICT;
ALTER TABLE ledger_entries ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_single_owner;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_single_owner') THEN
    ALTER TABLE ledger_entries
      ADD CONSTRAINT ledger_entries_single_owner
      CHECK (
        (CASE WHEN account_id IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN wallet_id IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN ledger_account_id IS NULL THEN 0 ELSE 1 END) = 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ledger_entries_ledger_account_created_idx
  ON ledger_entries(ledger_account_id, created_at DESC);

CREATE OR REPLACE FUNCTION assert_market_transaction_balanced() RETURNS trigger AS $$
DECLARE
  imbalance NUMERIC;
BEGIN
  IF EXISTS (
    SELECT 1 FROM ledger_transactions t
    WHERE t.id = NEW.transaction_id AND COALESCE(t.reference, '') LIKE 'ORD-%'
  ) THEN
    SELECT COALESCE(sum(e.amount), 0) INTO imbalance
    FROM ledger_entries e
    WHERE e.transaction_id = NEW.transaction_id;
    IF imbalance <> 0 THEN
      RAISE EXCEPTION 'Market transaction % is not balanced (imbalance %)', NEW.transaction_id, imbalance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_balanced_check ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entries_balanced_check
  AFTER INSERT OR UPDATE ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_market_transaction_balanced();

INSERT INTO schema_migrations (version) VALUES ('0009_ledger_double_entry')
ON CONFLICT (version) DO NOTHING;
