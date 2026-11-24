import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { decimalToMinor } from "@/lib/money";
import { audit } from "@/lib/marketplace";

/**
 * KYC, notifications, support and referrals.
 *
 * KYC submissions are reviewed by staff; a rejection carries a reason and can be
 * resubmitted. Document bytes are stored in Postgres and served only through an
 * authorised route. Notifications are per-customer records; a broadcast creates
 * one row per active customer so read state is personal.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export type KycDocument = {
  id: string;
  kind: string;
  fileName: string;
  status: string;
  createdAt: string;
  hasFile: boolean;
};

export type KycSubmission = {
  id: string;
  legalName: string;
  dateOfBirth: string | null;
  country: string;
  addressLine: string;
  city: string | null;
  sourceOfFunds: string | null;
  status: string;
  riskRating: string;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  documents: KycDocument[];
  customerName?: string;
  customerEmail?: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  body: string;
  isStaff: boolean;
  authorName: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  reference: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
  messages?: SupportMessage[];
};

export type Referral = {
  id: string;
  referredEmail: string;
  code: string;
  status: string;
  rewardAmount: string;
  createdAt: string;
  convertedAt: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const cleaned = text(value);
  return cleaned.length ? cleaned : null;
}

function clean(value: unknown, max: number) {
  const cleaned = text(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return cleaned.slice(0, max);
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

function mapKycDocument(row: Record<string, unknown>): KycDocument {
  return {
    id: String(row.id),
    kind: String(row.kind),
    fileName: String(row.file_name),
    status: String(row.status),
    createdAt: String(row.created_at),
    hasFile: Boolean(row.has_file),
  };
}

function mapKyc(row: Record<string, unknown>, documents: KycDocument[] = []): KycSubmission {
  return {
    id: String(row.id),
    legalName: String(row.legal_name),
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : null,
    country: String(row.country),
    addressLine: String(row.address_line),
    city: nullable(row.city),
    sourceOfFunds: nullable(row.source_of_funds),
    status: String(row.status),
    riskRating: String(row.risk_rating),
    reviewerNotes: nullable(row.reviewer_notes),
    rejectionReason: nullable(row.rejection_reason),
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    documents,
    ...(row.full_name ? { customerName: String(row.full_name), customerEmail: String(row.email) } : {}),
  };
}

async function documentsFor(submissionId: string) {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT d.id, d.kind, d.file_name, d.status, d.created_at,
           (b.document_id IS NOT NULL) AS has_file
    FROM kyc_documents d
    LEFT JOIN kyc_document_blobs b ON b.document_id = d.id
    WHERE d.submission_id = ${submissionId}
    ORDER BY d.created_at ASC
  `);
  return found.map(mapKycDocument);
}

export async function getKycForUser(userId: string): Promise<KycSubmission | null> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT * FROM kyc_submissions WHERE user_id = ${userId} LIMIT 1
  `);
  const row = found[0];
  if (!row) return null;
  return mapKyc(row, await documentsFor(String(row.id)));
}

export async function submitKyc(userId: string, input: Record<string, unknown>): Promise<Outcome<KycSubmission>> {
  const legalName = clean(input.legalName, 120);
  const country = clean(input.country, 80);
  const addressLine = clean(input.addressLine, 200);
  const city = clean(input.city, 80);
  const sourceOfFunds = clean(input.sourceOfFunds, 200);
  const rawDob = text(input.dateOfBirth);

  if (legalName.length < 3) return { ok: false, status: 400, error: "Enter your full legal name." };
  if (country.length < 2) return { ok: false, status: 400, error: "Enter your country of residence." };
  if (addressLine.length < 5) return { ok: false, status: 400, error: "Enter your residential address." };
  if (rawDob && !/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
    return { ok: false, status: 400, error: "Enter your date of birth as YYYY-MM-DD." };
  }
  if (rawDob) {
    const dob = new Date(`${rawDob}T00:00:00Z`);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(age) || age < 18 || age > 120) {
      return { ok: false, status: 400, error: "You must be at least 18 years old to open an investment account." };
    }
  }

  const sql = getSql();
  const existing = rows<{ status: string }>(await sql`
    SELECT status FROM kyc_submissions WHERE user_id = ${userId} LIMIT 1
  `);
  if (existing[0]?.status === "pending") {
    return { ok: false, status: 409, error: "Your verification is already with our compliance team." };
  }
  if (existing[0]?.status === "approved") {
    return { ok: false, status: 409, error: "Your identity is already verified." };
  }

  const saved = rows<Record<string, unknown>>(await sql`
    INSERT INTO kyc_submissions (user_id, legal_name, date_of_birth, country, address_line, city, source_of_funds)
    VALUES (${userId}, ${legalName}, ${rawDob || null}::date, ${country}, ${addressLine}, ${city || null}, ${sourceOfFunds || null})
    ON CONFLICT (user_id) DO UPDATE
    SET legal_name = EXCLUDED.legal_name, date_of_birth = EXCLUDED.date_of_birth,
        country = EXCLUDED.country, address_line = EXCLUDED.address_line, city = EXCLUDED.city,
        source_of_funds = EXCLUDED.source_of_funds, status = 'pending', reviewer_notes = NULL,
        rejection_reason = NULL, submitted_at = now(), reviewed_at = NULL, reviewed_by = NULL
    RETURNING *
  `);
  const row = saved[0];
  if (!row) return { ok: false, status: 503, error: "We could not save that submission. Please try again." };

  await audit(userId, "kyc.submitted", "kyc_submission", String(row.id), { country });
  await notifyUser(userId, "Verification submitted", "Our compliance team will review your documents and update you here.", "info", "/dashboard/profile");
  return { ok: true, value: mapKyc(row, await documentsFor(String(row.id))) };
}

export async function uploadKycDocument(userId: string, form: FormData): Promise<Outcome<KycDocument>> {
  const sql = getSql();
  const submission = rows<{ id: string; status: string }>(await sql`
    SELECT id, status FROM kyc_submissions WHERE user_id = ${userId} LIMIT 1
  `);
  const current = submission[0];
  if (!current) return { ok: false, status: 409, error: "Submit your verification details before uploading documents." };
  if (current.status === "approved") return { ok: false, status: 409, error: "Your verification is already approved." };

  const kind = text(form.get("kind"));
  if (!["identity", "address", "source_of_funds"].includes(kind)) {
    return { ok: false, status: 400, error: "Choose identity, address or source of funds." };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, status: 400, error: "Choose a document to upload." };
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return { ok: false, status: 400, error: "Documents must be 5 MB or smaller." };
  }
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return { ok: false, status: 400, error: "Upload a PDF, JPEG or PNG document." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  const fileName = clean(file.name, 180) || "document";

  const created = rows<{ id: string; kind: string; file_name: string; status: string; created_at: string }>(await sql`
    INSERT INTO kyc_documents (submission_id, kind, file_name, storage_ref)
    VALUES (${current.id}, ${kind}, ${fileName}, ${"kyc:" + digest.slice(0, 16)})
    RETURNING id, kind, file_name, status, created_at
  `);
  const document = created[0];
  if (!document) return { ok: false, status: 503, error: "We could not store that document. Please try again." };

  await sql`
    INSERT INTO kyc_document_blobs (document_id, content, mime_type, sha256, size_bytes)
    VALUES (${document.id}, decode(${bytes.toString("hex")}, 'hex'), ${file.type}, ${digest}, ${bytes.length})
  `;

  await audit(userId, "kyc.document_uploaded", "kyc_document", String(document.id), { kind, size: String(bytes.length) });
  return {
    ok: true,
    value: {
      id: String(document.id),
      kind: String(document.kind),
      fileName: String(document.file_name),
      status: String(document.status),
      createdAt: String(document.created_at),
      hasFile: true,
    },
  };
}

export async function getKycDocumentForDownload(
  actor: { id: string; role: string },
  documentId: string,
): Promise<{ content: Buffer; mimeType: string; fileName: string } | null> {
  if (!UUID.test(documentId)) return null;
  const sql = getSql();
  const found = rows<{ content: string; mime_type: string; file_name: string; owner_id: string }>(await sql`
    SELECT encode(b.content, 'base64') AS content, b.mime_type, d.file_name, s.user_id AS owner_id
    FROM kyc_documents d
    JOIN kyc_document_blobs b ON b.document_id = d.id
    JOIN kyc_submissions s ON s.id = d.submission_id
    WHERE d.id = ${documentId}
    LIMIT 1
  `);
  const row = found[0];
  if (!row) return null;
  const isStaff = actor.role === "admin" || actor.role === "compliance";
  if (!isStaff && row.owner_id !== actor.id) return null;
  return {
    content: Buffer.from(row.content, "base64"),
    mimeType: row.mime_type,
    fileName: row.file_name,
  };
}

export async function listKycSubmissions(): Promise<KycSubmission[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT s.*, u.full_name, u.email
    FROM kyc_submissions s JOIN app_users u ON u.id = s.user_id
    ORDER BY CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END, s.submitted_at DESC
    LIMIT 200
  `);
  const result: KycSubmission[] = [];
  for (const row of found) {
    result.push(mapKyc(row, await documentsFor(String(row.id))));
  }
  return result;
}

export async function reviewKyc(
  actorUserId: string,
  submissionId: string,
  input: Record<string, unknown>,
): Promise<Outcome<{ status: string }>> {
  if (!UUID.test(submissionId)) return { ok: false, status: 400, error: "Unknown submission." };
  const status = text(input.status).toLowerCase();
  if (status !== "approved" && status !== "rejected") {
    return { ok: false, status: 400, error: "Choose approved or rejected." };
  }
  const risk = text(input.riskRating).toLowerCase();
  const riskRating = ["low", "medium", "high"].includes(risk) ? risk : "medium";
  const reason = clean(input.rejectionReason, 400);
  if (status === "rejected" && reason.length < 5) {
    return { ok: false, status: 400, error: "Give a rejection reason the customer can act on." };
  }
  const notes = clean(input.reviewerNotes, 1000);

  const sql = getSql();
  const updated = rows<{ id: string; user_id: string }>(await sql`
    WITH target AS (
      UPDATE kyc_submissions
      SET status = ${status}, risk_rating = ${riskRating}, reviewer_notes = ${notes || null},
          rejection_reason = ${status === "rejected" ? reason : null},
          reviewed_at = now(), reviewed_by = ${actorUserId}
      WHERE id = ${submissionId} AND status = 'pending'
      RETURNING id, user_id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, ${status === "approved" ? "kyc.approved" : "kyc.rejected"},
             'kyc_submission', target.id::text,
             jsonb_build_object('riskRating', ${riskRating}::text)
      FROM target RETURNING id
    ), told AS (
      INSERT INTO notifications (user_id, title, body, kind, action_url)
      SELECT target.user_id,
             ${status === "approved" ? "Identity verified" : "Verification needs attention"},
             ${status === "approved"
               ? "Your identity verification has been approved. You can now use the full platform."
               : "Our compliance team could not approve this submission. Review the reason and resubmit."},
             ${status === "approved" ? "success" : "warning"},
             '/dashboard/profile'
      FROM target RETURNING id
    )
    SELECT id::text AS id, user_id::text AS user_id FROM target
  `);
  if (!updated[0]) return { ok: false, status: 409, error: "That submission has already been reviewed." };
  return { ok: true, value: { status } };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  kind: "info" | "success" | "warning" | "security" = "info",
  actionUrl: string | null = null,
) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO notifications (user_id, title, body, kind, action_url)
      VALUES (${userId}, ${title}, ${body}, ${kind}, ${actionUrl})
    `;
  } catch (error) {
    console.error("Notification write failed", error instanceof Error ? error.message : "unknown error");
  }
}

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT id, title, body, kind, action_url, read_at, created_at
    FROM notifications WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `);
  return found.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    kind: String(row.kind),
    actionUrl: nullable(row.action_url),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function unreadNotificationCount(userId: string) {
  const sql = getSql();
  const found = rows<{ total: number }>(await sql`
    SELECT count(*)::int AS total FROM notifications WHERE user_id = ${userId} AND read_at IS NULL
  `);
  return Number(found[0]?.total ?? 0);
}

export async function markNotificationsRead(userId: string, id?: string) {
  const sql = getSql();
  if (id && UUID.test(id)) {
    await sql`UPDATE notifications SET read_at = now() WHERE id = ${id} AND user_id = ${userId} AND read_at IS NULL`;
  } else {
    await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
  }
}

export async function broadcastNotification(
  actorUserId: string,
  input: Record<string, unknown>,
): Promise<Outcome<{ recipients: number }>> {
  const title = clean(input.title, 140);
  const body = clean(input.body, 1000);
  if (title.length < 3) return { ok: false, status: 400, error: "Enter a notification title." };
  if (body.length < 3) return { ok: false, status: 400, error: "Enter a notification message." };

  const sql = getSql();
  const inserted = rows<{ total: number }>(await sql`
    WITH recipients AS (
      SELECT id FROM app_users WHERE role = 'customer' AND status = 'active'
    ), created AS (
      INSERT INTO notifications (user_id, title, body, kind, action_url)
      SELECT id, ${title}, ${body}, 'info', NULL FROM recipients
      RETURNING id
    )
    SELECT count(*)::int AS total FROM created
  `);
  await audit(actorUserId, "notification.broadcast", "notification", "broadcast", { title });
  return { ok: true, value: { recipients: Number(inserted[0]?.total ?? 0) } };
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

function mapTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    reference: String(row.reference),
    subject: String(row.subject),
    category: String(row.category),
    message: String(row.message),
    status: String(row.status),
    priority: String(row.priority),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.full_name ? { customerName: String(row.full_name), customerEmail: String(row.email) } : {}),
  };
}

export async function listTickets(userId: string): Promise<SupportTicket[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT * FROM support_tickets WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 50
  `);
  return found.map(mapTicket);
}

export async function listAllTickets(): Promise<SupportTicket[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT t.*, u.full_name, u.email
    FROM support_tickets t JOIN app_users u ON u.id = t.user_id
    ORDER BY CASE WHEN t.status IN ('open','in_progress') THEN 0 ELSE 1 END, t.updated_at DESC
    LIMIT 200
  `);
  return found.map(mapTicket);
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT m.id, m.body, m.is_staff, m.created_at, u.full_name
    FROM support_ticket_messages m LEFT JOIN app_users u ON u.id = m.author_user_id
    WHERE m.ticket_id = ${ticketId} ORDER BY m.created_at ASC
  `);
  return found.map((row) => ({
    id: String(row.id),
    body: String(row.body),
    isStaff: Boolean(row.is_staff),
    authorName: nullable(row.full_name),
    createdAt: String(row.created_at),
  }));
}

export async function createTicket(userId: string, input: Record<string, unknown>): Promise<Outcome<SupportTicket>> {
  const subject = clean(input.subject, 160);
  const message = clean(input.message, 4000);
  const category = ["general", "account", "deposit", "withdrawal", "investment", "security"].includes(text(input.category))
    ? text(input.category)
    : "general";
  if (subject.length < 4) return { ok: false, status: 400, error: "Enter a subject for your request." };
  if (message.length < 20) return { ok: false, status: 400, error: "Describe your request in at least 20 characters." };

  const sql = getSql();
  const reference = `TKT-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const created = rows<Record<string, unknown>>(await sql`
    WITH ticket AS (
      INSERT INTO support_tickets (user_id, reference, subject, category, message)
      VALUES (${userId}, ${reference}, ${subject}, ${category}, ${message})
      RETURNING *
    ), first_message AS (
      INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_staff)
      SELECT id, ${userId}, ${message}, false FROM ticket
      RETURNING id
    )
    SELECT * FROM ticket
  `);
  const row = created[0];
  if (!row) return { ok: false, status: 503, error: "We could not open that ticket. Please try again." };
  await audit(userId, "support.ticket_opened", "support_ticket", String(row.id), { category, reference });
  return { ok: true, value: mapTicket(row) };
}

export async function replyToTicket(
  actor: { id: string; role: string },
  ticketId: string,
  input: Record<string, unknown>,
): Promise<Outcome<{ status: string }>> {
  if (!UUID.test(ticketId)) return { ok: false, status: 400, error: "Unknown ticket." };
  const body = clean(input.body, 4000);
  if (body.length < 2) return { ok: false, status: 400, error: "Enter a reply." };
  const isStaff = actor.role === "admin" || actor.role === "compliance";
  const requestedStatus = text(input.status).toLowerCase();
  const status = isStaff && ["open", "in_progress", "resolved", "closed"].includes(requestedStatus)
    ? requestedStatus
    : null;

  const sql = getSql();
  const ticket = rows<{ id: string; user_id: string; status: string }>(await sql`
    SELECT id, user_id, status FROM support_tickets WHERE id = ${ticketId} LIMIT 1
  `);
  const current = ticket[0];
  if (!current) return { ok: false, status: 404, error: "That ticket was not found." };
  if (!isStaff && current.user_id !== actor.id) return { ok: false, status: 404, error: "That ticket was not found." };
  if (current.status === "closed" && !isStaff) {
    return { ok: false, status: 409, error: "This ticket is closed. Open a new request if you need more help." };
  }

  await sql`
    WITH posted AS (
      INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_staff)
      VALUES (${ticketId}, ${actor.id}, ${body}, ${isStaff})
      RETURNING id
    ), touched AS (
      UPDATE support_tickets
      SET updated_at = now(),
          status = COALESCE(${status}, status)
      WHERE id = ${ticketId}
      RETURNING user_id
    )
    SELECT id FROM posted
  `;

  if (isStaff) {
    await notifyUser(
      current.user_id,
      "Support replied to your ticket",
      body.slice(0, 160),
      "info",
      "/dashboard/support",
    );
    await audit(actor.id, "support.replied", "support_ticket", ticketId, { status: status ?? current.status });
  }
  return { ok: true, value: { status: status ?? current.status } };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export async function ensureReferralCode(userId: string) {
  const sql = getSql();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `LI${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const inserted = rows<{ code: string }>(await sql`
      INSERT INTO referral_codes (user_id, code) VALUES (${userId}, ${code})
      ON CONFLICT (user_id) DO NOTHING
      RETURNING code
    `);
    if (inserted[0]) return inserted[0].code;
    const existing = rows<{ code: string }>(await sql`
      SELECT code FROM referral_codes WHERE user_id = ${userId} LIMIT 1
    `);
    if (existing[0]) return existing[0].code;
  }
  throw new Error("Could not issue a referral code");
}

export async function listReferrals(userId: string): Promise<Referral[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT id, referred_email, code, status, reward_amount::text AS reward_amount, created_at, converted_at
    FROM referrals WHERE referrer_user_id = ${userId} ORDER BY created_at DESC LIMIT 100
  `);
  return found.map((row) => ({
    id: String(row.id),
    referredEmail: String(row.referred_email),
    code: String(row.code),
    status: String(row.status),
    rewardAmount: String(row.reward_amount),
    createdAt: String(row.created_at),
    convertedAt: row.converted_at ? String(row.converted_at) : null,
  }));
}

export async function createReferral(userId: string, input: Record<string, unknown>): Promise<Outcome<Referral>> {
  const email = text(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }
  const code = await ensureReferralCode(userId);
  const sql = getSql();
  const inserted = rows<Record<string, unknown>>(await sql`
    INSERT INTO referrals (referrer_user_id, referred_email, code)
    VALUES (${userId}, ${email}, ${code})
    ON CONFLICT (referrer_user_id, referred_email) DO NOTHING
    RETURNING id, referred_email, code, status, reward_amount::text AS reward_amount, created_at, converted_at
  `);
  const row = inserted[0];
  if (!row) return { ok: false, status: 409, error: "You have already invited that address." };
  await audit(userId, "referral.invited", "referral", String(row.id), { email });
  return {
    ok: true,
    value: {
      id: String(row.id),
      referredEmail: String(row.referred_email),
      code: String(row.code),
      status: String(row.status),
      rewardAmount: String(row.reward_amount),
      createdAt: String(row.created_at),
      convertedAt: null,
    },
  };
}

export async function attachReferral(referredUserId: string, email: string, code: string) {
  if (!code || !/^LI[A-Z0-9]{6,12}$/i.test(code)) return;
  try {
    const sql = getSql();
    await sql`
      UPDATE referrals r
      SET referred_user_id = ${referredUserId}, status = 'converted', converted_at = now()
      FROM referral_codes c
      WHERE c.code = upper(${code}) AND c.user_id = r.referrer_user_id
        AND lower(r.referred_email) = lower(${email}) AND r.status = 'pending'
    `;
  } catch (error) {
    console.error("Referral attach failed", error instanceof Error ? error.message : "unknown error");
  }
}

// ---------------------------------------------------------------------------
// Admin referral overview
// ---------------------------------------------------------------------------

export async function listAllReferrals(limit = 200) {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT r.id, r.referred_email, r.code, r.status, r.reward_amount::text AS reward_amount,
           r.created_at, r.converted_at, u.full_name AS referrer_name, u.email AS referrer_email
    FROM referrals r JOIN app_users u ON u.id = r.referrer_user_id
    ORDER BY r.created_at DESC LIMIT ${limit}
  `);
  return found.map((row) => ({
    id: String(row.id),
    referredEmail: String(row.referred_email),
    code: String(row.code),
    status: String(row.status),
    rewardAmount: String(row.reward_amount),
    createdAt: String(row.created_at),
    convertedAt: row.converted_at ? String(row.converted_at) : null,
    referrerName: String(row.referrer_name),
    referrerEmail: String(row.referrer_email),
  }));
}

export async function getSecurityOverview(userId: string) {
  const sql = getSql();
  const profile = rows<{ two_factor_enabled: boolean }>(await sql`
    SELECT two_factor_enabled FROM app_users WHERE id = ${userId} LIMIT 1
  `);
  const logins = rows<Record<string, unknown>>(await sql`
    SELECT id::text AS id, email, ip, success, reason, created_at
    FROM login_events WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 20
  `);
  return {
    twoFactorEnabled: Boolean(profile[0]?.two_factor_enabled),
    logins: logins.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      ip: row.ip ? String(row.ip) : null,
      success: Boolean(row.success),
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at),
    })),
  };
}

/** Spendable balance snapshot used by the admin overview. */
export async function verifiedBalances() {
  const sql = getSql();
  const found = rows<{ wallet: string; accounts: string }>(await sql`
    SELECT
      COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.wallet_id IS NOT NULL), 0)::text AS wallet,
      COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.account_id IS NOT NULL), 0)::text AS accounts
  `);
  return {
    wallet: decimalToMinor(found[0]?.wallet) ?? 0,
    accounts: decimalToMinor(found[0]?.accounts) ?? 0,
  };
}
