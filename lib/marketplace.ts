import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { decimalToMinor, minorToDecimal } from "@/lib/money";

/**
 * Investment marketplace: market instruments and quotes, the product catalogue,
 * market orders and holdings.
 *
 * Rules that hold throughout this module:
 *  - Prices and quantities are read from Postgres as decimal strings; the
 *    notional is calculated with BigInt scaled integers, never floating point.
 *  - Orders are recorded as pending and only become holdings when an authorised
 *    staff member fills them. A fill re-checks cash or holding quantity inside
 *    the same statement that posts a balanced ledger transaction.
 *  - Every demo quote carries is_demo so the UI can label simulated data.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCALE = 100_000_000n; // 8 decimal places, matching NUMERIC(24, 8)
const MAX_NOTIONAL_MINOR = 10_000_000_000; // 100,000,000.00

export type AssetClass = "stock" | "etf" | "bond" | "mutual_fund" | "crypto";
export type ProductCategory = "stocks" | "etfs" | "bonds" | "mutual_funds" | "crypto" | "portfolio";

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  exchange: string | null;
  sector: string | null;
  description: string;
  expenseRatio: string | null;
  couponRate: string | null;
  maturityDate: string | null;
  isDemo: boolean;
  status: string;
  price: string | null;
  changePercent: string | null;
  asOf: string | null;
};

export type PricePoint = { price: string; asOf: string; isDemo: boolean };

export type Product = {
  id: string;
  name: string;
  description: string;
  summary: string;
  currency: string;
  minimumAmount: string;
  status: string;
  category: ProductCategory;
  riskLevel: string;
  durationDays: number | null;
  feeBps: number;
  managementFeeBps: number;
  expenseRatio: string | null;
  couponRate: string | null;
  yieldRate: string | null;
  maturityDate: string | null;
  allocation: Record<string, number>;
  isDemo: boolean;
  termsVersion: string | null;
  createdAt: string;
};

export type Holding = {
  id: string;
  instrumentId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  quantity: string;
  averageCost: string;
  price: string;
  marketValue: string;
  costBasis: string;
  unrealised: string;
  changePercent: string;
  isDemo: boolean;
  accountNumber: string | null;
};

export type MarketOrder = {
  id: string;
  reference: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  notional: string;
  currency: string;
  status: string;
  instrumentSymbol: string;
  instrumentName: string;
  accountNumber: string | null;
  createdAt: string;
  filledAt: string | null;
  customerName?: string;
  customerEmail?: string;
};

export type PortfolioSummary = {
  currency: string;
  cash: string;
  invested: string;
  marketValue: string;
  costBasis: string;
  unrealised: string;
  todayChange: string;
  totalValue: string;
  holdings: Holding[];
  allocation: { label: string; value: string; percent: number }[];
  history: { asOf: string; totalValue: string; isDemo: boolean }[];
  pendingOrders: MarketOrder[];
  activeInvestments: number;
  hasDemoData: boolean;
};

export type MarketplaceOutcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

type DbRow = Record<string, unknown>;

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function reference(prefix: string) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function mapInstrument(row: DbRow): Instrument {
  return {
    id: String(row.id),
    symbol: String(row.symbol),
    name: String(row.name),
    assetClass: String(row.asset_class) as AssetClass,
    currency: String(row.currency).trim(),
    exchange: nullableText(row.exchange),
    sector: nullableText(row.sector),
    description: text(row.description),
    expenseRatio: nullableText(row.expense_ratio),
    couponRate: nullableText(row.coupon_rate),
    maturityDate: nullableText(row.maturity_date),
    isDemo: Boolean(row.is_demo),
    status: String(row.status),
    price: nullableText(row.price),
    changePercent: nullableText(row.change_percent),
    asOf: nullableText(row.as_of),
  };
}

function mapProduct(row: DbRow): Product {
  let allocation: Record<string, number> = {};
  if (row.allocation && typeof row.allocation === "object" && !Array.isArray(row.allocation)) {
    allocation = row.allocation as Record<string, number>;
  } else if (typeof row.allocation === "string") {
    try {
      const parsed: unknown = JSON.parse(row.allocation);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) allocation = parsed as Record<string, number>;
    } catch {
      allocation = {};
    }
  }
  return {
    id: String(row.id),
    name: String(row.name),
    description: text(row.description),
    summary: text(row.summary),
    currency: String(row.currency).trim(),
    minimumAmount: String(row.minimum_amount),
    status: String(row.status),
    category: String(row.category) as ProductCategory,
    riskLevel: String(row.risk_level),
    durationDays: row.duration_days === null || row.duration_days === undefined ? null : Number(row.duration_days),
    feeBps: Number(row.fee_bps ?? 0),
    managementFeeBps: Number(row.management_fee_bps ?? 0),
    expenseRatio: nullableText(row.expense_ratio),
    couponRate: nullableText(row.coupon_rate),
    yieldRate: nullableText(row.yield_rate),
    maturityDate: nullableText(row.maturity_date),
    allocation,
    isDemo: Boolean(row.is_demo),
    termsVersion: nullableText(row.terms_version),
    createdAt: String(row.created_at),
  };
}

const INSTRUMENT_SELECT = `
  SELECT i.*, trim(i.currency) AS currency, p.price::text AS price, p.change_percent::text AS change_percent, p.as_of
  FROM market_instruments i
  LEFT JOIN LATERAL (
    SELECT price, change_percent, as_of FROM market_prices
    WHERE instrument_id = i.id ORDER BY as_of DESC LIMIT 1
  ) p ON true
`;

export async function listInstruments(assetClass?: AssetClass | null): Promise<Instrument[]> {
  const sql = getSql();
  const found = assetClass
    ? await sql.query(`${INSTRUMENT_SELECT} WHERE i.asset_class = $1 AND i.status = 'active' ORDER BY i.symbol ASC`, [assetClass])
    : await sql.query(`${INSTRUMENT_SELECT} WHERE i.status = 'active' ORDER BY i.asset_class ASC, i.symbol ASC`, []);
  return rows<DbRow>(found).map(mapInstrument);
}

export async function getInstrument(id: string): Promise<{ instrument: Instrument; history: PricePoint[] } | null> {
  if (!UUID.test(id)) return null;
  const sql = getSql();
  const found = rows<DbRow>(await sql.query(`${INSTRUMENT_SELECT} WHERE i.id = $1 LIMIT 1`, [id]));
  const row = found[0];
  if (!row) return null;
  const history = rows<{ price: string; as_of: string; is_demo: boolean }>(await sql`
    SELECT price::text AS price, as_of, is_demo FROM market_prices
    WHERE instrument_id = ${id} ORDER BY as_of ASC LIMIT 60
  `);
  return {
    instrument: mapInstrument(row),
    history: history.map((point) => ({ price: point.price, asOf: String(point.as_of), isDemo: point.is_demo })),
  };
}

export async function listProducts(options: { includeInactive?: boolean; category?: string | null } = {}): Promise<Product[]> {
  const sql = getSql();
  const includeInactive = options.includeInactive === true;
  const category = options.category ?? null;
  const found = await sql`
    SELECT * FROM investment_products
    WHERE (${includeInactive}::boolean OR status = 'active')
      AND (${category}::text IS NULL OR category = ${category})
    ORDER BY category ASC, name ASC
  `;
  return rows<DbRow>(found).map(mapProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  if (!UUID.test(id)) return null;
  const sql = getSql();
  const found = rows<DbRow>(await sql`SELECT * FROM investment_products WHERE id = ${id} LIMIT 1`);
  return found[0] ? mapProduct(found[0]) : null;
}

/** Multiplies two decimal strings exactly and returns the notional in minor units. */
export function notionalMinor(price: string, quantity: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value).trim());
    if (!match) return null;
    return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"));
  };
  const priceScaled = parse(price);
  const quantityScaled = parse(quantity);
  if (priceScaled === null || quantityScaled === null || quantityScaled <= 0n) return null;
  const product = priceScaled * quantityScaled; // scaled by 1e16
  const minor = (product * 100n + SCALE * SCALE / 2n) / (SCALE * SCALE);
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const value = Number(minor);
  return value > MAX_NOTIONAL_MINOR ? null : value;
}

export function parseQuantity(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const normalised = `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(8, "0").slice(0, 8)}`;
  return Number(normalised) > 0 ? normalised : null;
}

async function latestPrice(instrumentId: string) {
  const sql = getSql();
  const found = rows<{ price: string; currency: string; name: string; symbol: string; status: string }>(await sql`
    SELECT p.price::text AS price, trim(i.currency) AS currency, i.name, i.symbol, i.status
    FROM market_instruments i
    JOIN LATERAL (
      SELECT price FROM market_prices WHERE instrument_id = i.id ORDER BY as_of DESC LIMIT 1
    ) p ON true
    WHERE i.id = ${instrumentId}
    LIMIT 1
  `);
  return found[0] ?? null;
}

export async function placeOrder(
  userId: string,
  input: DbRow,
): Promise<MarketplaceOutcome<MarketOrder>> {
  const sql = getSql();
  const instrumentId = text(input.instrumentId);
  const accountId = text(input.accountId);
  const side = text(input.side).toLowerCase();
  const quantity = parseQuantity(input.quantity);

  if (!UUID.test(instrumentId)) return { ok: false, status: 400, error: "Choose an instrument to trade." };
  if (!UUID.test(accountId)) return { ok: false, status: 400, error: "Choose one of your accounts." };
  if (side !== "buy" && side !== "sell") return { ok: false, status: 400, error: "Choose buy or sell." };
  if (!quantity) return { ok: false, status: 400, error: "Enter a quantity greater than zero, up to eight decimal places." };

  const quote = await latestPrice(instrumentId);
  if (!quote || quote.status !== "active") return { ok: false, status: 400, error: "That instrument is not available." };
  const notional = notionalMinor(quote.price, quantity);
  if (notional === null) {
    return { ok: false, status: 400, error: "That order value is outside the permitted range." };
  }

  const accounts = rows<{ id: string; currency: string; status: string; account_type: string }>(await sql`
    SELECT id, trim(currency) AS currency, status, account_type FROM customer_accounts
    WHERE id = ${accountId} AND user_id = ${userId} LIMIT 1
  `);
  const account = accounts[0];
  if (!account) return { ok: false, status: 404, error: "That account was not found on your profile." };
  if (account.account_type === "demo") {
    return { ok: false, status: 409, error: "Market orders use live records and are not available on demo accounts." };
  }
  if (account.status !== "active") {
    return { ok: false, status: 409, error: "That account must be active before it can place an order." };
  }
  if (account.currency !== quote.currency) {
    return { ok: false, status: 400, error: `That instrument trades in ${quote.currency}; choose an account in the same currency.` };
  }

  if (side === "buy") {
    const funds = rows<{ balance: string; reserved: string }>(await sql`
      SELECT COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.account_id = ${accountId}), 0)::text AS balance,
             COALESCE((SELECT sum(o.notional) FROM investment_orders o
                       WHERE o.account_id = ${accountId} AND o.status = 'pending' AND o.side = 'buy'), 0)::text AS reserved
    `);
    const balance = decimalToMinor(funds[0]?.balance) ?? 0;
    const reserved = decimalToMinor(funds[0]?.reserved) ?? 0;
    if (notional > balance - reserved) {
      return {
        ok: false,
        status: 409,
        error: `This order needs ${minorToDecimal(notional)} ${account.currency}, but only ${minorToDecimal(
          Math.max(0, balance - reserved),
        )} is available once pending orders are reserved.`,
      };
    }
  } else {
    const held = rows<{ quantity: string }>(await sql`
      SELECT quantity::text AS quantity FROM investment_holdings
      WHERE user_id = ${userId} AND account_id = ${accountId} AND instrument_id = ${instrumentId}
      LIMIT 1
    `);
    const available = Number(held[0]?.quantity ?? 0);
    if (!(available >= Number(quantity))) {
      return { ok: false, status: 409, error: "You do not hold enough of this instrument to sell that quantity." };
    }
  }

  const orderReference = reference("ORD");
  const inserted = rows<DbRow>(await sql`
    INSERT INTO investment_orders (user_id, account_id, instrument_id, side, quantity, price, notional, reference, note)
    VALUES (${userId}, ${accountId}, ${instrumentId}, ${side}, ${quantity}::numeric, ${quote.price}::numeric,
            ${minorToDecimal(notional)}::numeric, ${orderReference}, ${nullableText(input.note)}, ${quote.currency})
    RETURNING id, reference, side, quantity::text AS quantity, price::text AS price, notional::text AS notional,
              trim(currency) AS currency, status, created_at, filled_at
  `);
  const order = inserted[0];
  if (!order) return { ok: false, status: 503, error: "We could not record that order. Please try again." };

  await audit(userId, "order.placed", "investment_order", String(order.id), {
    side,
    symbol: quote.symbol,
    quantity,
    notional: minorToDecimal(notional),
    currency: quote.currency,
  });

  return {
    ok: true,
    value: {
      id: String(order.id),
      reference: String(order.reference),
      side: side as "buy" | "sell",
      quantity: String(order.quantity),
      price: quote.price,
      notional: String(order.notional),
      currency: quote.currency,
      status: String(order.status),
      instrumentSymbol: quote.symbol,
      instrumentName: quote.name,
      accountNumber: null,
      createdAt: String(order.created_at),
      filledAt: null,
    },
  };
}

const ORDER_SELECT = `
  SELECT o.id, o.reference, o.side, o.quantity::text AS quantity, o.price::text AS price,
         o.notional::text AS notional, trim(o.currency) AS currency, o.status, o.created_at, o.filled_at,
         i.symbol, i.name, a.account_number, u.full_name, u.email
  FROM investment_orders o
  JOIN market_instruments i ON i.id = o.instrument_id
  JOIN customer_accounts a ON a.id = o.account_id
  JOIN app_users u ON u.id = o.user_id
`;

function mapOrder(row: DbRow): MarketOrder {
  return {
    id: String(row.id),
    reference: String(row.reference),
    side: row.side === "sell" ? "sell" : "buy",
    quantity: String(row.quantity),
    price: String(row.price),
    notional: String(row.notional),
    currency: String(row.currency).trim(),
    status: String(row.status),
    instrumentSymbol: String(row.symbol),
    instrumentName: String(row.name),
    accountNumber: nullableText(row.account_number),
    createdAt: String(row.created_at),
    filledAt: nullableText(row.filled_at),
    ...(row.full_name ? { customerName: String(row.full_name), customerEmail: String(row.email) } : {}),
  };
}

export async function listOrders(userId: string, limit = 50): Promise<MarketOrder[]> {
  const sql = getSql();
  const found = await sql.query(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT $2`, [userId, limit]);
  return rows<DbRow>(found).map(mapOrder);
}

export async function listAllOrders(limit = 200): Promise<MarketOrder[]> {
  const sql = getSql();
  const found = await sql.query(
    `${ORDER_SELECT} ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows<DbRow>(found).map(mapOrder);
}

export async function cancelOrder(userId: string, orderId: string): Promise<MarketplaceOutcome<null>> {
  if (!UUID.test(orderId)) return { ok: false, status: 400, error: "Unknown order." };
  const sql = getSql();
  const updated = rows<{ id: string }>(await sql`
    UPDATE investment_orders SET status = 'cancelled'
    WHERE id = ${orderId} AND user_id = ${userId} AND status = 'pending'
    RETURNING id
  `);
  if (!updated[0]) return { ok: false, status: 409, error: "That order is no longer awaiting review." };
  await audit(userId, "order.cancelled", "investment_order", orderId, {});
  return { ok: true, value: null };
}

/**
 * Staff decision on an order. A fill posts a balanced ledger transaction and
 * updates the holding; a rejection only closes the order. Both write an audit
 * event in the same statement as the status change.
 */
export async function decideOrder(
  actorUserId: string,
  orderId: string,
  rawDecision: unknown,
): Promise<MarketplaceOutcome<{ status: string }>> {
  if (!UUID.test(orderId)) return { ok: false, status: 400, error: "Unknown order." };
  const decision = text(rawDecision).toLowerCase();
  if (decision !== "filled" && decision !== "rejected") {
    return { ok: false, status: 400, error: "Choose filled or rejected." };
  }
  const sql = getSql();

  if (decision === "rejected") {
    const updated = rows<{ id: string }>(await sql`
      WITH target AS (
        UPDATE investment_orders SET status = 'rejected', processed_by = ${actorUserId}
        WHERE id = ${orderId} AND status = 'pending'
        RETURNING id
      ), audited AS (
        INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
        SELECT ${actorUserId}, 'order.rejected', 'investment_order', target.id::text FROM target RETURNING id
      )
      SELECT id::text AS id FROM target
    `);
    if (!updated[0]) return { ok: false, status: 409, error: "That order is not awaiting review." };
    return { ok: true, value: { status: "rejected" } };
  }

  const existing = rows<{ side: string }>(await sql`
    SELECT side FROM investment_orders WHERE id = ${orderId} AND status = 'pending' LIMIT 1
  `);
  const side = existing[0]?.side;
  if (!side) return { ok: false, status: 409, error: "That order is not awaiting review." };

  const filled = rows<{ filled: number; transaction_id: string | null }>(await sql`
    WITH target AS (
      UPDATE investment_orders o
      SET status = 'filled', filled_at = now(), processed_by = ${actorUserId}
      WHERE o.id = ${orderId} AND o.status = 'pending'
        AND (
          (
            o.side = 'buy'
            AND (SELECT COALESCE(sum(e.amount), 0) FROM ledger_entries e WHERE e.account_id = o.account_id)
                - COALESCE((SELECT sum(p.notional) FROM investment_orders p
                            WHERE p.account_id = o.account_id AND p.status = 'pending'
                              AND p.side = 'buy' AND p.id <> o.id), 0)
                >= o.notional
          )
          OR (
            o.side = 'sell'
            AND EXISTS (
              SELECT 1 FROM investment_holdings h
              WHERE h.user_id = o.user_id AND h.account_id = o.account_id
                AND h.instrument_id = o.instrument_id AND h.quantity >= o.quantity
            )
          )
        )
      RETURNING o.id, o.user_id, o.account_id, o.instrument_id, o.side,
                o.quantity, o.price, o.notional, o.currency
    ), booked AS (
      INSERT INTO ledger_transactions (idempotency_key, status, description, reference, created_by, posted_at)
      SELECT 'order-fill:' || target.id::text, 'posted',
             CASE WHEN target.side = 'buy' THEN 'Market buy settled' ELSE 'Market sell settled' END,
             'ORD-' || upper(substr(replace(target.id::text, '-', ''), 1, 8)),
             ${actorUserId}, now()
      FROM target
      RETURNING id
    ), cash_entry AS (
      INSERT INTO ledger_entries (transaction_id, account_id, amount, currency)
      SELECT booked.id, target.account_id,
             CASE WHEN target.side = 'buy' THEN -target.notional ELSE target.notional END,
             target.currency
      FROM booked, target
      RETURNING id
    ), clearing_entry AS (
      INSERT INTO ledger_entries (transaction_id, ledger_account_id, amount, currency)
      SELECT booked.id, la.id,
             CASE WHEN target.side = 'buy' THEN target.notional ELSE -target.notional END,
             target.currency
      FROM booked, target
      JOIN ledger_accounts la ON la.code = 'PLATFORM_CLEARING' AND la.currency = target.currency
      RETURNING id
    ), holding AS (
      INSERT INTO investment_holdings (user_id, account_id, instrument_id, quantity, average_cost)
      SELECT target.user_id, target.account_id, target.instrument_id, target.quantity, target.price
      FROM target WHERE target.side = 'buy'
      ON CONFLICT (user_id, account_id, instrument_id) DO UPDATE
      SET quantity = investment_holdings.quantity + EXCLUDED.quantity,
          average_cost = CASE
            WHEN investment_holdings.quantity + EXCLUDED.quantity = 0 THEN 0
            ELSE ((investment_holdings.average_cost * investment_holdings.quantity)
                  + (EXCLUDED.average_cost * EXCLUDED.quantity))
                 / (investment_holdings.quantity + EXCLUDED.quantity)
          END,
          updated_at = now()
      RETURNING id
    ), reduced AS (
      UPDATE investment_holdings h
      SET quantity = h.quantity - target.quantity, updated_at = now()
      FROM target
      WHERE target.side = 'sell' AND h.user_id = target.user_id
        AND h.account_id = target.account_id AND h.instrument_id = target.instrument_id
      RETURNING h.id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'order.filled', 'investment_order', target.id::text,
             jsonb_build_object('side', target.side, 'quantity', target.quantity::text,
                                'notional', target.notional::text,
                                'transactionId', booked.id::text)
      FROM target, booked
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS filled,
           (SELECT id::text FROM booked) AS transaction_id
  `);

  if (Number(filled[0]?.filled ?? 0) === 0) {
    return {
      ok: false,
      status: 409,
      error: side === "buy"
        ? "The account balance no longer covers this buy once pending orders are reserved."
        : "The holding no longer covers this sell. Reject the order or ask the customer to resubmit.",
    };
  }

  await sql`
    INSERT INTO notifications (user_id, title, body, kind, action_url)
    SELECT user_id, ${"Order " + orderId.slice(0, 8).toUpperCase() + " settled"},
           ${"Your market order was filled by our operations team. The cash movement is posted to your ledger."},
           'success', '/dashboard/portfolio'
    FROM investment_orders WHERE id = ${orderId}
  `;

  return { ok: true, value: { status: "filled" } };
}

export async function getHoldings(userId: string): Promise<Holding[]> {
  const sql = getSql();
  const found = rows<DbRow>(await sql`
    SELECT h.id, h.instrument_id, h.quantity::text AS quantity, h.average_cost::text AS average_cost,
           (h.average_cost * h.quantity)::text AS cost_basis,
           i.symbol, i.name, i.asset_class, trim(i.currency) AS currency, i.is_demo,
           p.price::text AS price, p.change_percent::text AS change_percent,
           (p.price * h.quantity)::text AS market_value,
           a.account_number
    FROM investment_holdings h
    JOIN market_instruments i ON i.id = h.instrument_id
    JOIN customer_accounts a ON a.id = h.account_id
    JOIN LATERAL (
      SELECT price, change_percent FROM market_prices
      WHERE instrument_id = i.id ORDER BY as_of DESC LIMIT 1
    ) p ON true
    WHERE h.user_id = ${userId} AND h.quantity > 0
    ORDER BY (p.price * h.quantity) DESC
  `);

  return found.map((row) => {
    const marketValue = decimalToMinor(String(row.market_value)) ?? 0;
    const costBasis = decimalToMinor(String(row.cost_basis)) ?? 0;
    return {
      id: String(row.id),
      instrumentId: String(row.instrument_id),
      symbol: String(row.symbol),
      name: String(row.name),
      assetClass: String(row.asset_class) as AssetClass,
      currency: String(row.currency).trim(),
      quantity: String(row.quantity),
      averageCost: String(row.average_cost),
      price: String(row.price),
      marketValue: minorToDecimal(marketValue),
      costBasis: minorToDecimal(costBasis),
      unrealised: minorToDecimal(marketValue - costBasis),
      changePercent: String(row.change_percent ?? "0"),
      isDemo: Boolean(row.is_demo),
      accountNumber: nullableText(row.account_number),
    };
  });
}

export async function getPortfolio(userId: string, currency = "USD"): Promise<PortfolioSummary> {
  const sql = getSql();
  const [holdings, pending, snapshots, investmentTotals, cashRows] = await Promise.all([
    getHoldings(userId),
    listOrders(userId, 20),
    rows<{ as_of: string; total_value: string; is_demo: boolean }>(await sql`
      SELECT as_of, total_value::text AS total_value, is_demo FROM portfolio_snapshots
      WHERE user_id = ${userId} AND trim(currency) = ${currency}
      ORDER BY as_of ASC LIMIT 90
    `),
    rows<{ total: string; count: number; demo: boolean }>(await sql`
      SELECT COALESCE(sum(principal), 0)::text AS total,
             count(*)::int AS count,
             COALESCE(bool_or(p.is_demo), false) AS demo
      FROM investments i JOIN investment_products p ON p.id = i.product_id
      WHERE i.user_id = ${userId} AND i.status = 'active' AND trim(i.currency) = ${currency}
    `),
    rows<{ balance: string }>(await sql`
      SELECT COALESCE(sum(e.amount), 0)::text AS balance
      FROM ledger_entries e JOIN wallets w ON w.id = e.wallet_id
      WHERE w.user_id = ${userId} AND trim(w.currency) = ${currency}
    `),
  ]);

  const own = holdings.filter((holding) => holding.currency === currency);
  const marketValue = own.reduce((total, holding) => total + (decimalToMinor(holding.marketValue) ?? 0), 0);
  const costBasis = own.reduce((total, holding) => total + (decimalToMinor(holding.costBasis) ?? 0), 0);
  const todayChange = own.reduce((total, holding) => {
    const value = decimalToMinor(holding.marketValue) ?? 0;
    const percent = Number(holding.changePercent) || 0;
    return total + Math.round((value * percent) / (100 + percent));
  }, 0);
  const invested = decimalToMinor(investmentTotals[0]?.total) ?? 0;
  const cash = decimalToMinor(cashRows[0]?.balance) ?? 0;
  const totalValue = cash + marketValue + invested;

  const groups = new Map<string, number>();
  for (const holding of own) {
    const key = holding.assetClass;
    groups.set(key, (groups.get(key) ?? 0) + (decimalToMinor(holding.marketValue) ?? 0));
  }
  if (invested > 0) groups.set("managed_plans", (groups.get("managed_plans") ?? 0) + invested);
  if (cash > 0) groups.set("cash", cash);

  return {
    currency,
    cash: minorToDecimal(cash),
    invested: minorToDecimal(invested),
    marketValue: minorToDecimal(marketValue),
    costBasis: minorToDecimal(costBasis),
    unrealised: minorToDecimal(marketValue - costBasis),
    todayChange: minorToDecimal(todayChange),
    totalValue: minorToDecimal(totalValue),
    holdings: own,
    allocation: Array.from(groups.entries())
      .map(([label, value]) => ({
        label,
        value: minorToDecimal(value),
        percent: totalValue > 0 ? Math.round((value / totalValue) * 1000) / 10 : 0,
      }))
      .sort((left, right) => right.percent - left.percent),
    history: snapshots.map((snapshot) => ({
      asOf: String(snapshot.as_of),
      totalValue: snapshot.total_value,
      isDemo: Boolean(snapshot.is_demo),
    })),
    pendingOrders: pending.filter((order) => order.status === "pending"),
    activeInvestments: Number(investmentTotals[0]?.count ?? 0),
    hasDemoData: own.some((holding) => holding.isDemo),
  };
}

/** Upserts today's snapshot so the portfolio chart has a real history. */
export async function recordPortfolioSnapshot(userId: string, currency = "USD") {
  const portfolio = await getPortfolio(userId, currency);
  const sql = getSql();
  const asOf = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO portfolio_snapshots (user_id, as_of, total_value, invested_value, cash_value, returns_value, currency, is_demo)
    VALUES (${userId}, ${asOf}, ${portfolio.totalValue}::numeric, ${portfolio.invested}::numeric,
            ${portfolio.cash}::numeric, ${portfolio.unrealised}::numeric, ${currency},
            ${portfolio.hasDemoData})
    ON CONFLICT (user_id, as_of, currency) DO UPDATE
    SET total_value = EXCLUDED.total_value, invested_value = EXCLUDED.invested_value,
        cash_value = EXCLUDED.cash_value, returns_value = EXCLUDED.returns_value,
        is_demo = EXCLUDED.is_demo, created_at = now()
  `;
}

export async function listInstrumentsForAdmin(limit = 200): Promise<Instrument[]> {
  const sql = getSql();
  const found = await sql.query(`${INSTRUMENT_SELECT} ORDER BY i.asset_class, i.symbol LIMIT $1`, [limit]);
  return rows<DbRow>(found).map(mapInstrument);
}

export async function upsertMarketPrice(
  actorUserId: string,
  input: DbRow,
): Promise<MarketplaceOutcome<{ instrumentId: string }>> {
  const instrumentId = text(input.instrumentId);
  if (!UUID.test(instrumentId)) return { ok: false, status: 400, error: "Choose an instrument." };
  const priceText = text(input.price).trim();
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(priceText) || Number(priceText) <= 0) {
    return { ok: false, status: 400, error: "Enter a price greater than zero, up to eight decimal places." };
  }
  const change = Number(input.changePercent ?? 0);
  const changePercent = Number.isFinite(change) && Math.abs(change) <= 100 ? change.toFixed(4) : "0";
  const isDemo = input.isDemo !== false;

  const sql = getSql();
  const inserted = rows<{ id: string }>(await sql`
    INSERT INTO market_prices (instrument_id, price, change_percent, is_demo)
    SELECT id, ${priceText}::numeric, ${changePercent}::numeric, ${isDemo}
    FROM market_instruments WHERE id = ${instrumentId}
    RETURNING id
  `);
  if (!inserted[0]) return { ok: false, status: 404, error: "That instrument was not found." };

  await audit(actorUserId, "market.price_recorded", "market_instrument", instrumentId, {
    price: priceText,
    isDemo: String(isDemo),
    changePercent,
  });
  return { ok: true, value: { instrumentId } };
}

export async function audit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, string>,
) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      VALUES (${actorUserId}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}::jsonb)
    `;
  } catch (error) {
    console.error("Audit write failed", error instanceof Error ? error.message : "unknown error");
  }
}
