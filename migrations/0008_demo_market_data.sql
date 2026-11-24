-- Additive migration: clearly-labelled simulated market data for the marketplace.
--
-- These are demonstration quotes only. Every instrument and price row carries
-- is_demo = true and the UI labels them as simulated. No performance, forecast or
-- return figure is implied. Apply only after reviewing the symbol list.
-- No customer, balance or ledger record is touched.

INSERT INTO market_instruments
  (id, symbol, name, asset_class, currency, exchange, sector, description, expense_ratio, coupon_rate, maturity_date, is_demo)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'LCID', 'Lucid Global Holdings', 'stock', 'USD', 'NYSE', 'Financials',
   'Diversified investment holding company. Listing shown for demonstration trading.', NULL, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000002', 'NVTX', 'Novatex Systems', 'stock', 'USD', 'NASDAQ', 'Technology',
   'Enterprise software and data infrastructure company.', NULL, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000003', 'HLTH', 'Halcyon Health', 'stock', 'USD', 'NYSE', 'Healthcare',
   'Healthcare services and diagnostics group.', NULL, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000004', 'ENRG', 'Meridian Energy', 'stock', 'USD', 'NYSE', 'Energy',
   'Renewable generation and grid infrastructure operator.', NULL, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000011', 'GLBE', 'Global Balanced ETF', 'etf', 'USD', 'NYSE Arca', 'Multi-asset',
   'Broad multi-asset exchange-traded fund tracking a global balanced index.', 0.1800, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000012', 'TECH', 'Innovation Leaders ETF', 'etf', 'USD', 'NASDAQ', 'Technology',
   'Exchange-traded fund of large-cap technology and innovation companies.', 0.2500, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000013', 'DIVI', 'Dividend Income ETF', 'etf', 'USD', 'NYSE Arca', 'Equities',
   'Exchange-traded fund focused on established dividend-paying companies.', 0.1500, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000021', 'UST10', 'US Treasury 10-Year Note', 'bond', 'USD', 'OTC', 'Government',
   'United States government note. Indicative pricing for demonstration.', NULL, 0.0425, '2036-11-15', true),
  ('a1000000-0000-4000-8000-000000000022', 'UKGT5', 'UK Gilt 5-Year', 'bond', 'GBP', 'LSE', 'Government',
   'United Kingdom government gilt with a five-year maturity.', NULL, 0.0400, '2031-09-30', true),
  ('a1000000-0000-4000-8000-000000000023', 'CORP5', 'Investment Grade Corporate 5-Year', 'bond', 'USD', 'OTC', 'Corporate',
   'Investment-grade corporate bond basket with a five-year maturity.', NULL, 0.0525, '2031-06-15', true),
  ('a1000000-0000-4000-8000-000000000031', 'GMF', 'Global Macro Fund', 'mutual_fund', 'USD', 'OTC', 'Multi-asset',
   'Diversified macro fund with daily subscriptions and redemptions.', 0.8500, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000032', 'INC', 'Strategic Income Fund', 'mutual_fund', 'USD', 'OTC', 'Fixed income',
   'Income-oriented fund of government and investment-grade credit.', 0.6500, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000041', 'BTC', 'Bitcoin', 'crypto', 'USD', 'Digital asset venues', 'Digital assets',
   'Bitcoin reference pricing, shown for demonstration only. Trading requires an authorised venue.', NULL, NULL, NULL, true),
  ('a1000000-0000-4000-8000-000000000042', 'ETH', 'Ethereum', 'crypto', 'USD', 'Digital asset venues', 'Digital assets',
   'Ethereum reference pricing, shown for demonstration only. Trading requires an authorised venue.', NULL, NULL, NULL, true)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO market_prices (instrument_id, price, change_percent, as_of, is_demo)
SELECT i.id, quote.price, quote.change_percent, now(), true
FROM market_instruments i
JOIN (VALUES
  ('LCID', 42.18000000, 1.2400),
  ('NVTX', 128.55000000, -0.4200),
  ('HLTH', 74.32000000, 0.6800),
  ('ENRG', 31.96000000, 2.1500),
  ('GLBE', 58.41000000, 0.3100),
  ('TECH', 96.78000000, -0.8700),
  ('DIVI', 44.25000000, 0.5200),
  ('UST10', 98.64000000, -0.1100),
  ('UKGT5', 96.21000000, 0.0900),
  ('CORP5', 99.13000000, -0.0500),
  ('GMF', 24.87000000, 0.4400),
  ('INC', 18.63000000, 0.1700),
  ('BTC', 61250.00000000, 3.4200),
  ('ETH', 2840.50000000, 2.1800)
) AS quote(symbol, price, change_percent) ON quote.symbol = i.symbol
WHERE NOT EXISTS (SELECT 1 FROM market_prices p WHERE p.instrument_id = i.id);

-- Additional plan-style products across the catalogue categories. Descriptions
-- describe the mandate only; no return is promised or implied.
INSERT INTO investment_products
  (id, name, description, summary, currency, minimum_amount, status, terms_version,
   category, risk_level, duration_days, fee_bps, management_fee_bps, expense_ratio, is_demo)
VALUES
  ('7b1d3c52-9a4e-4c1f-8a52-5f0b7c61d201', 'Global Bond Income Plan',
   'Diversified allocation to government and investment-grade corporate bonds with a defined maturity.',
   'Fixed income mandate for capital preservation and scheduled income.', 'USD', 2500.00, 'active', '2026-01',
   'bonds', 'low', NULL, 25, 50, 0.6000, false),
  ('7b1d3c52-9a4e-4c1f-8a52-5f0b7c61d202', 'Core Equity Index Plan',
   'Rules-based allocation to broad developed-market equity indices.',
   'Low-cost equity index mandate for long-term growth.', 'USD', 5000.00, 'active', '2026-01',
   'etfs', 'medium', NULL, 15, 30, 0.1200, false),
  ('7b1d3c52-9a4e-4c1f-8a52-5f0b7c61d203', 'Diversified Multi-Asset Plan',
   'Balanced allocation across equities, fixed income and cash, rebalanced by mandate.',
   'Diversified portfolio for medium-term objectives.', 'USD', 10000.00, 'active', '2026-01',
   'portfolio', 'medium', NULL, 30, 85, 0.7500, false),
  ('7b1d3c52-9a4e-4c1f-8a52-5f0b7c61d204', 'Private Wealth Mandate',
   'Discretionary mandate for high-net-worth clients, reviewed with an adviser.',
   'Personalised wealth management with periodic reviews.', 'USD', 100000.00, 'active', '2026-01',
   'portfolio', 'high', NULL, 50, 100, 0.8500, false),
  ('7b1d3c52-9a4e-4c1f-8a52-5f0b7c61d205', 'Term Deposit Plan (12 months)',
   'Fixed-term cash management product with a stated contractual rate at subscription.',
   'Twelve-month term plan. Rate, fees and maturity are disclosed before subscription.', 'USD', 1000.00, 'active', '2026-01',
   'bonds', 'low', 365, 0, 0, NULL, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('0008_demo_market_data')
ON CONFLICT (version) DO NOTHING;
