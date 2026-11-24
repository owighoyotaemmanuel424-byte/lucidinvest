import "server-only";
import { getSql } from "@/lib/db";

/**
 * Staff operations for the admin console.
 *
 * Every function here changes one record and writes its audit row in the same
 * SQL statement, so a state change can never land without a matching audit
 * event. Approving an investment additionally posts its ledger transaction and
 * entry in that same statement.
 *
 * These functions deliberately cannot create deposits, withdrawals or trading.
 * The only money-like record produced is the subscription entry booked when a
 * pending investment request is approved.
 */

export type OpsResult =
  | { ok: true; status: string; extra?: Record<string, string> }
  | { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CUSTOMER_STATUSES = ["active", "suspended", "closed"] as const;
const ENQUIRY_STATUSES = ["new", "reviewing", "resolved", "spam"] as const;

/** Enquiries may only move forward through the review workflow. */
const ENQUIRY_TRANSITIONS: Record<string, string[]> = {
  new: ["reviewing", "spam"],
  reviewing: ["resolved", "spam"],
  spam: ["reviewing"],
  resolved: [],
};

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}

function validId(value: string) {
  return UUID.test(value);
}

export async function setCustomerStatus(
  actorUserId: string,
  customerId: string,
  rawStatus: unknown,
): Promise<OpsResult> {
  if (!validId(customerId)) return { ok: false, status: 400, error: "Unknown customer." };
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (!CUSTOMER_STATUSES.includes(status as (typeof CUSTOMER_STATUSES)[number])) {
    return { ok: false, status: 400, error: "Choose active, suspended or closed." };
  }
  if (customerId === actorUserId) {
    return { ok: false, status: 409, error: "You cannot change the status of your own account here." };
  }

  const sql = getSql();
  const result = rows<{ updated: number }>(await sql`
    WITH target AS (
      UPDATE app_users
      SET status = ${status}, updated_at = now()
      WHERE id = ${customerId} AND role = 'customer'
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'customer.status_changed', 'app_user', target.id::text,
             jsonb_build_object('status', ${status}::text)
      FROM target
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS updated
  `);

  if (Number(result[0]?.updated ?? 0) === 0) {
    return { ok: false, status: 404, error: "That customer record was not found." };
  }
  return { ok: true, status };
}

export async function setAccountStatus(
  actorUserId: string,
  accountId: string,
  rawStatus: unknown,
): Promise<OpsResult> {
  if (!validId(accountId)) return { ok: false, status: 400, error: "Unknown account." };
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (status !== "active" && status !== "closed") {
    return { ok: false, status: 400, error: "A pending account can only be approved or closed." };
  }

  const sql = getSql();
  const result = rows<{ updated: number }>(await sql`
    WITH target AS (
      UPDATE customer_accounts
      SET status = ${status}
      WHERE id = ${accountId} AND status = 'pending'
      RETURNING id, account_type, currency
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId},
             CASE WHEN ${status} = 'active' THEN 'account.approved' ELSE 'account.rejected' END,
             'customer_account', target.id::text,
             jsonb_build_object('status', ${status}::text, 'accountType', target.account_type, 'currency', trim(target.currency))
      FROM target
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS updated
  `);

  if (Number(result[0]?.updated ?? 0) === 0) {
    return { ok: false, status: 409, error: "That account is not awaiting review." };
  }
  return { ok: true, status };
}

export async function setInvestmentStatus(
  actorUserId: string,
  investmentId: string,
  rawStatus: unknown,
): Promise<OpsResult> {
  if (!validId(investmentId)) return { ok: false, status: 400, error: "Unknown investment." };
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (status !== "active" && status !== "rejected") {
    return { ok: false, status: 400, error: "A pending investment can only be approved or rejected." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, status: 503, error: "The database is not configured on this deployment." };
  }

  const sql = getSql();

  if (status === "rejected") {
    const rejected = rows<{ updated: number }>(await sql`
      WITH target AS (
        UPDATE investments
        SET status = 'rejected', updated_at = now()
        WHERE id = ${investmentId} AND status = 'pending'
        RETURNING id
      ), audited AS (
        INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
        SELECT ${actorUserId}, 'investment.rejected', 'investment', target.id::text
        FROM target
        RETURNING id
      )
      SELECT (SELECT count(*)::int FROM target) AS updated
    `);
    if (Number(rejected[0]?.updated ?? 0) === 0) {
      return { ok: false, status: 409, error: "That investment is not awaiting review." };
    }
    return { ok: true, status };
  }

  // Approve: flip the request to active and book its subscription entry in one
  // statement. The `status = 'pending'` guard makes a double approval a no-op.
  const approved = rows<{ updated: number; transaction_id: string | null; entry_id: string | null }>(await sql`
    WITH target AS (
      UPDATE investments
      SET status = 'active', updated_at = now()
      WHERE id = ${investmentId} AND status = 'pending'
      RETURNING id, account_id, principal, currency
    ), booked AS (
      INSERT INTO ledger_transactions (idempotency_key, status, description, reference, created_by, posted_at)
      SELECT 'investment-approval:' || target.id::text,
             'posted',
             'Investment subscription approved',
             'INV-' || upper(substr(replace(target.id::text, '-', ''), 1, 8)),
             ${actorUserId},
             now()
      FROM target
      RETURNING id
    ), posted_entry AS (
      INSERT INTO ledger_entries (transaction_id, account_id, amount, currency)
      SELECT booked.id, target.account_id, target.principal, target.currency
      FROM booked, target
      RETURNING id
    ), clearing_entry AS (
      INSERT INTO ledger_entries (transaction_id, ledger_account_id, amount, currency)
      SELECT booked.id, la.id, -target.principal, trim(target.currency)
      FROM booked, target
      JOIN ledger_accounts la ON la.code = 'PLATFORM_CLEARING' AND la.currency = target.currency
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'investment.approved', 'investment', target.id::text,
             jsonb_build_object(
               'principal', target.principal::text,
               'currency', trim(target.currency),
               'transactionId', booked.id::text,
               'entryId', posted_entry.id::text
             )
      FROM target, booked, posted_entry
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS updated,
           (SELECT id::text FROM booked) AS transaction_id,
           (SELECT id::text FROM posted_entry) AS entry_id
  `);

  const row = approved[0];
  if (Number(row?.updated ?? 0) === 0) {
    return { ok: false, status: 409, error: "That investment is not awaiting review." };
  }
  return {
    ok: true,
    status,
    extra: {
      transactionId: row?.transaction_id ?? "",
      entryId: row?.entry_id ?? "",
    },
  };
}

export async function setEnquiryStatus(
  actorUserId: string,
  enquiryId: string,
  rawStatus: unknown,
): Promise<OpsResult> {
  if (!validId(enquiryId)) return { ok: false, status: 400, error: "Unknown enquiry." };
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  if (!ENQUIRY_STATUSES.includes(status as (typeof ENQUIRY_STATUSES)[number])) {
    return { ok: false, status: 400, error: "Choose new, reviewing, resolved or spam." };
  }

  const sql = getSql();
  const current = rows<{ status: string }>(await sql`
    SELECT status FROM contact_enquiries WHERE id = ${enquiryId} LIMIT 1
  `);
  const existing = current[0]?.status;
  if (!existing) return { ok: false, status: 404, error: "That enquiry was not found." };
  if (existing === status) return { ok: true, status };
  if (!(ENQUIRY_TRANSITIONS[existing] ?? []).includes(status)) {
    return { ok: false, status: 409, error: `An enquiry that is ${existing} cannot move to ${status}.` };
  }

  const updated = rows<{ updated: number }>(await sql`
    WITH target AS (
      UPDATE contact_enquiries
      SET status = ${status}
      WHERE id = ${enquiryId} AND status = ${existing}
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'enquiry.status_changed', 'contact_enquiry', target.id::text,
             jsonb_build_object('from', ${existing}::text, 'to', ${status}::text)
      FROM target
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM target) AS updated
  `);

  if (Number(updated[0]?.updated ?? 0) === 0) {
    return { ok: false, status: 409, error: "That enquiry changed while you were reviewing it. Reload and try again." };
  }
  return { ok: true, status };
}
