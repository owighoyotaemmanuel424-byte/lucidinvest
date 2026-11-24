import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  MAX_AMOUNT_MINOR,
  MIN_AMOUNT_MINOR,
  decimalToMinor,
  formatMinor,
  minorToDecimal,
  parseAmountToMinor,
} from "@/lib/money";
import type {
  AdminWalletRequest,
  TradingAccount,
  Wallet,
  WalletOverview,
  WalletRequest,
  WalletRequestKind,
  WalletTransaction,
  WalletTransactionKind,
  WalletTransactionPage,
  WalletTransferReceipt,
} from "@/lib/wallet-types";

/**
 * Wallet services.
 *
 * Two rules hold everywhere in this module:
 *
 * 1. Amounts are validated as integer minor units and written to Postgres as
 *    exact decimal strings, so no balance is ever computed in floating point.
 * 2. Money only enters or leaves a wallet through a ledger entry. Deposits and
 *    withdrawals are requests until staff process them; an internal transfer is
 *    a single statement that posts the wallet debit and the account credit (or
 *    neither), guarded by the wallet's available balance.
 */

export type WalletOutcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PENDING_REQUESTS = 5;
const MAX_NOTE_LENGTH = 200;

const KIND_PREFIX: Record<WalletTransactionKind, string> = {
  deposit: "DEP-%",
  withdrawal: "WDR-%",
  transfer: "TRF-%",
  investment: "INV-%",
  other: "%",
};

const FILTERABLE_KINDS: WalletTransactionKind[] = ["deposit", "withdrawal", "transfer", "investment"];
const FILTERABLE_STATUSES = ["pending", "posted", "reversed", "failed"] as const;

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function reference(prefix: string) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function normaliseNote(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length > MAX_NOTE_LENGTH) return "invalid";
  return cleaned;
}

function mapWallet(row: Record<string, unknown>): Wallet {
  return {
    id: String(row.id),
    walletNumber: String(row.wallet_number),
    currency: String(row.currency).trim(),
    status: String(row.status),
    balance: row.balance === undefined || row.balance === null ? "0" : String(row.balance),
    createdAt: String(row.created_at),
  };
}

function mapAccount(row: Record<string, unknown>): TradingAccount {
  const accountType = String(row.account_type);
  return {
    id: String(row.id),
    accountNumber: row.account_number === null || row.account_number === undefined ? null : String(row.account_number),
    accountType,
    mode: accountType === "demo" ? "demo" : "real",
    currency: String(row.currency).trim(),
    status: String(row.status),
    balance: row.balance === undefined || row.balance === null ? "0" : String(row.balance),
    createdAt: String(row.created_at),
  };
}

function mapRequest(row: Record<string, unknown>): WalletRequest {
  return {
    id: String(row.id),
    kind: row.kind === "withdrawal" ? "withdrawal" : "deposit",
    amount: String(row.amount),
    currency: String(row.currency).trim(),
    status: String(row.status),
    reference: String(row.reference),
    note: row.note === null || row.note === undefined ? null : String(row.note),
    createdAt: String(row.created_at),
    processedAt: row.processed_at === null || row.processed_at === undefined ? null : String(row.processed_at),
  };
}

/**
 * Returns the customer's wallet for a currency, issuing one on first use.
 * Wallets start with no balance: the row alone never represents money.
 */
export async function ensureWallet(userId: string, currency = "USD") {
  const sql = getSql();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const walletNumber = `W${String(randomInt(0, 100_000_000)).padStart(8, "0")}${currency}`;
    const inserted = rows<Record<string, unknown>>(await sql`
      INSERT INTO wallets (user_id, wallet_number, currency)
      VALUES (${userId}, ${walletNumber}, ${currency})
      ON CONFLICT DO NOTHING
      RETURNING id, wallet_number, trim(currency) AS currency, status, created_at
    `);
    if (inserted[0]) return mapWallet(inserted[0]);

    const existing = rows<Record<string, unknown>>(await sql`
      SELECT id, wallet_number, trim(currency) AS currency, status, created_at
      FROM wallets
      WHERE user_id = ${userId} AND currency = ${currency}
      LIMIT 1
    `);
    if (existing[0]) return mapWallet(existing[0]);
  }

  throw new Error("Could not provision a wallet");
}

export async function getWalletOverview(userId: string): Promise<WalletOverview> {
  const sql = getSql();
  const wallet = await ensureWallet(userId);

  const [walletRows, accountRows, requestRows] = await Promise.all([
    sql`
      SELECT w.id, w.wallet_number, trim(w.currency) AS currency, w.status, w.created_at,
             COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.wallet_id = w.id), 0)::text AS balance
      FROM wallets w
      WHERE w.id = ${wallet.id}
      LIMIT 1
    `,
    sql`
      SELECT a.id, a.account_number, a.account_type, trim(a.currency) AS currency, a.status, a.created_at,
             COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.account_id = a.id), 0)::text AS balance
      FROM customer_accounts a
      WHERE a.user_id = ${userId}
      ORDER BY a.created_at DESC
    `,
    sql`
      SELECT r.id, r.kind, r.amount::text AS amount, trim(r.currency) AS currency, r.status,
             r.reference, r.note, r.created_at, r.processed_at
      FROM wallet_requests r
      WHERE r.user_id = ${userId} AND r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 20
    `,
  ]);

  const accounts = rows<Record<string, unknown>>(accountRows).map(mapAccount);
  const liveWallet = rows<Record<string, unknown>>(walletRows)[0];

  return {
    wallet: liveWallet ? mapWallet(liveWallet) : wallet,
    realAccounts: accounts.filter((account) => account.mode === "real"),
    demoAccounts: accounts.filter((account) => account.mode === "demo"),
    pendingRequests: rows<Record<string, unknown>>(requestRows).map(mapRequest),
  };
}

export type WalletTransactionQuery = {
  page?: number;
  pageSize?: number;
  kind?: string | null;
  status?: string | null;
};

export async function getWalletTransactions(
  userId: string,
  options: WalletTransactionQuery = {},
): Promise<WalletTransactionPage> {
  const sql = getSql();

  const requestedPage = Math.max(1, Math.trunc(options.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize ?? 20) || 20));
  const kind = FILTERABLE_KINDS.find((entry) => entry === options.kind) ?? null;
  const status = FILTERABLE_STATUSES.find((entry) => entry === options.status) ?? null;
  const prefix = kind ? KIND_PREFIX[kind] : "%";

  const [entryRows, countRows] = await Promise.all([
    sql`
      SELECT e.id, e.amount::text AS amount, trim(e.currency) AS currency, e.created_at,
             t.description, t.reference, t.status, t.posted_at,
             a.account_number, w.wallet_number,
             CASE
               WHEN COALESCE(t.reference, '') LIKE 'DEP-%' THEN 'deposit'
               WHEN COALESCE(t.reference, '') LIKE 'WDR-%' THEN 'withdrawal'
               WHEN COALESCE(t.reference, '') LIKE 'TRF-%' THEN 'transfer'
               WHEN COALESCE(t.reference, '') LIKE 'INV-%' THEN 'investment'
               ELSE 'other'
             END AS kind
      FROM ledger_entries e
      JOIN ledger_transactions t ON t.id = e.transaction_id
      LEFT JOIN customer_accounts a ON a.id = e.account_id
      LEFT JOIN wallets w ON w.id = e.wallet_id
      WHERE (a.user_id = ${userId} OR w.user_id = ${userId})
        AND COALESCE(t.reference, '') LIKE ${prefix}
        AND (${status}::text IS NULL OR t.status = ${status})
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${pageSize} OFFSET ${(requestedPage - 1) * pageSize}
    `,
    sql`
      SELECT count(*)::int AS total
      FROM ledger_entries e
      JOIN ledger_transactions t ON t.id = e.transaction_id
      LEFT JOIN customer_accounts a ON a.id = e.account_id
      LEFT JOIN wallets w ON w.id = e.wallet_id
      WHERE (a.user_id = ${userId} OR w.user_id = ${userId})
        AND COALESCE(t.reference, '') LIKE ${prefix}
        AND (${status}::text IS NULL OR t.status = ${status})
    `,
  ]);

  const total = Number(rows<{ total: number }>(countRows)[0]?.total ?? 0);
  const entries = rows<Record<string, unknown>>(entryRows).map<WalletTransaction>((row) => ({
    id: String(row.id),
    kind: (row.kind as WalletTransactionKind) ?? "other",
    amount: String(row.amount),
    currency: String(row.currency).trim(),
    description: String(row.description),
    reference: row.reference === null || row.reference === undefined ? null : String(row.reference),
    status: String(row.status),
    postedAt: row.posted_at === null || row.posted_at === undefined ? null : String(row.posted_at),
    createdAt: String(row.created_at),
    accountNumber: row.account_number === null || row.account_number === undefined ? null : String(row.account_number),
    walletNumber: row.wallet_number === null || row.wallet_number === undefined ? null : String(row.wallet_number),
  }));

  return {
    entries,
    page: requestedPage,
    pageSize,
    total,
    hasMore: requestedPage * pageSize < total,
  };
}

type WalletFunds = { balanceMinor: number | null; heldMinor: number | null; status: string };

async function readWalletFunds(walletId: string): Promise<WalletFunds> {
  const sql = getSql();
  const found = rows<{ balance: string; held: string; status: string }>(await sql`
    SELECT COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.wallet_id = w.id), 0)::text AS balance,
           COALESCE((
             SELECT sum(r.amount) FROM wallet_requests r
             WHERE r.wallet_id = w.id AND r.status = 'pending' AND r.kind = 'withdrawal'
           ), 0)::text AS held,
           w.status
    FROM wallets w
    WHERE w.id = ${walletId}
    LIMIT 1
  `);
  const row = found[0];
  return {
    balanceMinor: decimalToMinor(row?.balance),
    heldMinor: decimalToMinor(row?.held),
    status: String(row?.status ?? ""),
  };
}

async function pendingRequestCount(userId: string) {
  const sql = getSql();
  const found = rows<{ total: number }>(await sql`
    SELECT count(*)::int AS total
    FROM wallet_requests
    WHERE user_id = ${userId} AND status = 'pending'
  `);
  return Number(found[0]?.total ?? 0);
}

function amountForDisplay(minor: number, currency: string) {
  return formatMinor(minor, currency);
}

/** Records a deposit instruction. Nothing is credited until staff confirm receipt. */
export async function requestDeposit(
  userId: string,
  input: Record<string, unknown>,
): Promise<WalletOutcome<WalletRequest>> {
  const sql = getSql();
  const wallet = await ensureWallet(userId);
  const currency = wallet.currency;

  if (wallet.status !== "active") {
    return { ok: false, status: 409, error: "This wallet cannot receive a deposit while it is not active." };
  }

  const amount = parseAmountToMinor(input.amount);
  if (amount === null) {
    return { ok: false, status: 400, error: "Enter an amount like 250.00, with at most two decimal places." };
  }
  if (amount < MIN_AMOUNT_MINOR) {
    return { ok: false, status: 400, error: `The minimum deposit is ${amountForDisplay(MIN_AMOUNT_MINOR, currency)}.` };
  }
  if (amount > MAX_AMOUNT_MINOR) {
    return { ok: false, status: 400, error: "Enter an amount below 100,000,000 or contact our team." };
  }

  const note = normaliseNote(input.note);
  if (note === "invalid") {
    return { ok: false, status: 400, error: `Keep the payment reference under ${MAX_NOTE_LENGTH} characters.` };
  }

  if ((await pendingRequestCount(userId)) >= MAX_PENDING_REQUESTS) {
    return {
      ok: false,
      status: 409,
      error: `You already have ${MAX_PENDING_REQUESTS} requests awaiting review. Contact us to progress them.`,
    };
  }

  const requestReference = reference("DEP");
  const inserted = rows<Record<string, unknown>>(await sql`
    INSERT INTO wallet_requests (user_id, wallet_id, kind, amount, currency, reference, note)
    VALUES (${userId}, ${wallet.id}, 'deposit', ${minorToDecimal(amount)}::numeric, ${currency}, ${requestReference}, ${note})
    RETURNING id, kind, amount::text AS amount, trim(currency) AS currency, status, reference, note, created_at, processed_at
  `);
  const request = inserted[0];
  if (!request) return { ok: false, status: 503, error: "We could not record that request. Please try again." };

  await recordAudit(userId, "wallet.deposit_requested", "wallet_request", String(request.id), {
    amount: minorToDecimal(amount),
    currency,
    walletNumber: wallet.walletNumber,
  });

  return { ok: true, value: mapRequest(request) };
}

/** Records a withdrawal instruction against the wallet's available balance. */
export async function requestWithdrawal(
  userId: string,
  input: Record<string, unknown>,
): Promise<WalletOutcome<WalletRequest>> {
  const sql = getSql();
  const wallet = await ensureWallet(userId);
  const currency = wallet.currency;

  if (wallet.status !== "active") {
    return { ok: false, status: 409, error: "This wallet cannot send a withdrawal while it is not active." };
  }

  const amount = parseAmountToMinor(input.amount);
  if (amount === null) {
    return { ok: false, status: 400, error: "Enter an amount like 250.00, with at most two decimal places." };
  }
  if (amount < MIN_AMOUNT_MINOR) {
    return { ok: false, status: 400, error: `The minimum withdrawal is ${amountForDisplay(MIN_AMOUNT_MINOR, currency)}.` };
  }

  const note = normaliseNote(input.note);
  if (note === "invalid" || note === null) {
    return { ok: false, status: 400, error: "Add the payout details our team should use, up to 200 characters." };
  }

  const funds = await readWalletFunds(wallet.id);
  const available = (funds.balanceMinor ?? 0) - (funds.heldMinor ?? 0);
  if (amount > available) {
    return {
      ok: false,
      status: 409,
      error: `Only ${amountForDisplay(Math.max(available, 0), currency)} is available to withdraw once pending requests are reserved.`,
    };
  }

  if ((await pendingRequestCount(userId)) >= MAX_PENDING_REQUESTS) {
    return {
      ok: false,
      status: 409,
      error: `You already have ${MAX_PENDING_REQUESTS} requests awaiting review. Contact us to progress them.`,
    };
  }

  const requestReference = reference("WDR");
  const inserted = rows<Record<string, unknown>>(await sql`
    INSERT INTO wallet_requests (user_id, wallet_id, kind, amount, currency, reference, note)
    VALUES (${userId}, ${wallet.id}, 'withdrawal', ${minorToDecimal(amount)}::numeric, ${currency}, ${requestReference}, ${note})
    RETURNING id, kind, amount::text AS amount, trim(currency) AS currency, status, reference, note, created_at, processed_at
  `);
  const request = inserted[0];
  if (!request) return { ok: false, status: 503, error: "We could not record that request. Please try again." };

  await recordAudit(userId, "wallet.withdrawal_requested", "wallet_request", String(request.id), {
    amount: minorToDecimal(amount),
    currency,
    walletNumber: wallet.walletNumber,
  });

  return { ok: true, value: mapRequest(request) };
}

/**
 * Moves money from the wallet into one of the customer's own real accounts.
 * The debit and credit are posted in one statement that also re-checks the
 * balance, so a concurrent withdrawal cannot overdraw the wallet.
 */
export async function transferToAccount(
  userId: string,
  input: Record<string, unknown>,
): Promise<WalletOutcome<WalletTransferReceipt>> {
  const sql = getSql();
  const wallet = await ensureWallet(userId);

  if (wallet.status !== "active") {
    return { ok: false, status: 409, error: "This wallet cannot send a transfer while it is not active." };
  }

  const accountId = text(input.accountId);
  if (!UUID.test(accountId)) {
    return { ok: false, status: 400, error: "Choose one of your accounts to fund." };
  }

  const amount = parseAmountToMinor(input.amount);
  if (amount === null) {
    return { ok: false, status: 400, error: "Enter an amount like 250.00, with at most two decimal places." };
  }
  if (amount < MIN_AMOUNT_MINOR) {
    return { ok: false, status: 400, error: `The minimum transfer is ${amountForDisplay(MIN_AMOUNT_MINOR, wallet.currency)}.` };
  }
  if (amount > MAX_AMOUNT_MINOR) {
    return { ok: false, status: 400, error: "Enter an amount below 100,000,000 or contact our team." };
  }

  const accounts = rows<{ id: string; account_number: string | null; account_type: string; currency: string; status: string }>(await sql`
    SELECT id, account_number, account_type, trim(currency) AS currency, status
    FROM customer_accounts
    WHERE id = ${accountId} AND user_id = ${userId}
    LIMIT 1
  `);
  const account = accounts[0];
  if (!account) return { ok: false, status: 404, error: "That account was not found on your profile." };
  if (account.account_type === "demo") {
    return { ok: false, status: 409, error: "Demo accounts use virtual funds and are not funded from your wallet." };
  }
  if (account.status === "closed" || account.status === "frozen") {
    return { ok: false, status: 409, error: "That account cannot receive funds while it is not open." };
  }
  if (account.currency !== wallet.currency) {
    return {
      ok: false,
      status: 400,
      error: `That account is in ${account.currency}. Your wallet holds ${wallet.currency}, so choose an account in the same currency.`,
    };
  }

  // Pending withdrawals already reserve part of the balance, so a transfer may
  // only spend what is left after them.
  const funds = await readWalletFunds(wallet.id);
  const available = (funds.balanceMinor ?? 0) - (funds.heldMinor ?? 0);
  if (amount > available) {
    return {
      ok: false,
      status: 409,
      error: `Only ${amountForDisplay(Math.max(available, 0), wallet.currency)} is available once pending withdrawals are reserved.`,
    };
  }

  const transferReference = reference("TRF");
  const transferId = `wallet-transfer:${randomUUID()}`;
  const posted = rows<{ booked: number; transaction_id: string | null }>(await sql`
    WITH target AS (
      SELECT a.id, a.account_number
      FROM customer_accounts a
      WHERE a.id = ${accountId} AND a.user_id = ${userId}
    ), funds AS (
      SELECT COALESCE(sum(e.amount), 0)
             - COALESCE((
                 SELECT sum(r.amount) FROM wallet_requests r
                 WHERE r.wallet_id = ${wallet.id} AND r.status = 'pending' AND r.kind = 'withdrawal'
               ), 0) AS available
      FROM ledger_entries e
      WHERE e.wallet_id = ${wallet.id}
    ), guard AS (
      SELECT target.id AS account_id, target.account_number
      FROM target, funds
      WHERE funds.available >= ${minorToDecimal(amount)}::numeric
    ), booked AS (
      INSERT INTO ledger_transactions (idempotency_key, status, description, reference, created_by, posted_at)
      SELECT ${transferId}, 'posted',
             'Transfer to trading account', ${transferReference}, ${userId}, now()
      FROM guard
      RETURNING id
    ), debit AS (
      INSERT INTO ledger_entries (transaction_id, wallet_id, amount, currency)
      SELECT booked.id, ${wallet.id}, ${minorToDecimal(-amount)}::numeric, ${wallet.currency}
      FROM booked
      RETURNING id
    ), credit AS (
      INSERT INTO ledger_entries (transaction_id, account_id, amount, currency)
      SELECT booked.id, guard.account_id, ${minorToDecimal(amount)}::numeric, ${wallet.currency}
      FROM booked, guard
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${userId}, 'wallet.transferred', 'ledger_transaction', booked.id::text,
             jsonb_build_object(
               'amount', ${minorToDecimal(amount)}::text,
               'currency', ${wallet.currency}::text,
               'accountNumber', guard.account_number,
               'walletNumber', ${wallet.walletNumber}::text,
               'direction', 'wallet_to_account'
             )
      FROM booked, guard
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM booked) AS booked,
           (SELECT id::text FROM booked) AS transaction_id
  `);

  const result = posted[0];
  if (!result || Number(result.booked) === 0) {
    return { ok: false, status: 409, error: "Your wallet balance changed while sending. Review it and try again." };
  }

  return {
    ok: true,
    value: {
      transactionId: String(result.transaction_id),
      reference: transferReference,
      amount: minorToDecimal(amount),
      currency: wallet.currency,
      accountNumber: account.account_number,
    },
  };
}

/** Staff review of a deposit or withdrawal request. Approving it posts the entry. */
export async function processWalletRequest(
  actorUserId: string,
  requestId: string,
  rawStatus: unknown,
): Promise<WalletOutcome<{ status: string; transactionId: string | null }>> {
  if (!UUID.test(requestId)) return { ok: false, status: 400, error: "Unknown request." };
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (status !== "posted" && status !== "rejected") {
    return { ok: false, status: 400, error: "Choose posted or rejected." };
  }

  const sql = getSql();
  const current = rows<{
    id: string;
    kind: WalletRequestKind;
    status: string;
    amount: string;
    currency: string;
    wallet_id: string;
    reference: string;
  }>(await sql`
    SELECT r.id, r.kind, r.status, r.amount::text AS amount, trim(r.currency) AS currency,
           r.wallet_id, r.reference
    FROM wallet_requests r
    WHERE r.id = ${requestId}
    LIMIT 1
  `);
  const request = current[0];
  if (!request) return { ok: false, status: 404, error: "That request was not found." };
  if (request.status !== "pending") {
    return { ok: false, status: 409, error: `That request was already ${request.status}.` };
  }

  if (status === "rejected") {
    const rejected = rows<{ updated: number }>(await sql`
      WITH target AS (
        UPDATE wallet_requests
        SET status = 'rejected', processed_at = now(), processed_by = ${actorUserId}
        WHERE id = ${requestId} AND status = 'pending'
        RETURNING id, kind, amount, currency
      ), audited AS (
        INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
        SELECT ${actorUserId}, 'wallet.request_rejected', 'wallet_request', target.id::text,
               jsonb_build_object('kind', target.kind, 'amount', target.amount::text, 'currency', trim(target.currency))
        FROM target
        RETURNING id
      )
      SELECT (SELECT count(*)::int FROM target) AS updated
    `);
    if (Number(rejected[0]?.updated ?? 0) === 0) {
      return { ok: false, status: 409, error: "That request changed while you were reviewing it. Reload and try again." };
    }
    return { ok: true, value: { status, transactionId: null } };
  }

  // Approve: status, ledger transaction, single wallet entry and audit land together.
  // A withdrawal additionally requires the balance to still cover it.
  const posted = rows<{ updated: number; transaction_id: string | null }>(await sql`
    WITH target AS (
      UPDATE wallet_requests r
      SET status = 'posted', processed_at = now(), processed_by = ${actorUserId}
      WHERE r.id = ${requestId}
        AND r.status = 'pending'
        AND (
          r.kind <> 'withdrawal'
          OR (SELECT COALESCE(sum(e.amount), 0) FROM ledger_entries e WHERE e.wallet_id = r.wallet_id)
             - COALESCE((
                 SELECT sum(o.amount) FROM wallet_requests o
                 WHERE o.wallet_id = r.wallet_id AND o.status = 'pending'
                   AND o.kind = 'withdrawal' AND o.id <> r.id
               ), 0)
             >= r.amount
        )
      RETURNING r.id, r.kind, r.amount, r.currency, r.wallet_id, r.reference
    ), booked AS (
      INSERT INTO ledger_transactions (idempotency_key, status, description, reference, created_by, posted_at)
      SELECT 'wallet-request:' || target.id::text, 'posted',
             CASE WHEN target.kind = 'deposit' THEN 'Wallet deposit confirmed' ELSE 'Withdrawal paid out' END,
             target.reference, ${actorUserId}, now()
      FROM target
      RETURNING id
    ), entry AS (
      INSERT INTO ledger_entries (transaction_id, wallet_id, amount, currency)
      SELECT booked.id, target.wallet_id,
             CASE WHEN target.kind = 'deposit' THEN target.amount ELSE -target.amount END,
             target.currency
      FROM booked, target
      RETURNING id
    ), clearing AS (
      INSERT INTO ledger_entries (transaction_id, ledger_account_id, amount, currency)
      SELECT booked.id, la.id,
             CASE WHEN target.kind = 'deposit' THEN -target.amount ELSE target.amount END,
             trim(target.currency)
      FROM booked, target
      JOIN ledger_accounts la ON la.code = 'PLATFORM_CLEARING' AND la.currency = target.currency
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'wallet.request_posted', 'wallet_request', target.id::text,
             jsonb_build_object(
               'kind', target.kind,
               'amount', target.amount::text,
               'currency', trim(target.currency),
               'transactionId', booked.id::text,
               'entryId', entry.id::text
             )
      FROM target, booked, entry
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS updated,
           (SELECT id::text FROM booked) AS transaction_id
  `);

  const result = posted[0];
  if (!result || Number(result.updated) === 0) {
    const after = rows<{ status: string }>(await sql`SELECT status FROM wallet_requests WHERE id = ${requestId}`);
    if (after[0]?.status && after[0].status !== "pending") {
      return { ok: false, status: 409, error: `That request was already ${after[0].status}.` };
    }
    return { ok: false, status: 409, error: "The wallet balance no longer covers this withdrawal. Reject it or reduce the amount." };
  }

  return { ok: true, value: { status, transactionId: String(result.transaction_id) } };
}

export async function getAdminWalletRequests(limit = 100): Promise<AdminWalletRequest[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT r.id, r.kind, r.amount::text AS amount, trim(r.currency) AS currency, r.status,
           r.reference, r.note, r.created_at, r.processed_at,
           u.full_name, u.email, w.wallet_number,
           COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.wallet_id = w.id), 0)::text AS wallet_balance
    FROM wallet_requests r
    JOIN app_users u ON u.id = r.user_id
    JOIN wallets w ON w.id = r.wallet_id
    ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT ${Math.min(200, Math.max(1, limit))}
  `);

  return found.map<AdminWalletRequest>((row) => ({
    ...mapRequest(row),
    customerName: String(row.full_name),
    customerEmail: String(row.email),
    walletNumber: String(row.wallet_number),
    walletBalance: String(row.wallet_balance),
  }));
}

async function recordAudit(
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
    // The request is already stored; a missing audit row must not fail it.
    console.error("Wallet audit write failed", error instanceof Error ? error.message : "unknown error");
  }
}
