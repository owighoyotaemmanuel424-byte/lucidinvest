import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/same-origin";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401, headers: noStore });
    const rows = await getSql()`
      SELECT two_factor_enabled, two_factor_secret FROM app_users WHERE id = ${user.id} LIMIT 1
    `;
    const row = (Array.isArray(rows) ? rows[0] : null) as { two_factor_enabled?: boolean; two_factor_secret?: string | null } | null;
    return NextResponse.json(
      {
        enabled: Boolean(row?.two_factor_enabled),
        pendingSetup: Boolean(row?.two_factor_secret) && !row?.two_factor_enabled,
      },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "Unable to read two-factor status." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401, headers: noStore });
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "This action must be started from your dashboard." }, { status: 403, headers: noStore });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    }
    const data = body as Record<string, unknown>;
    const action = typeof data.action === "string" ? data.action : "";
    const sql = getSql();

    if (action === "setup") {
      const existing = await sql`
        SELECT two_factor_enabled FROM app_users WHERE id = ${user.id} LIMIT 1
      `;
      const row = (Array.isArray(existing) ? existing[0] : null) as { two_factor_enabled?: boolean } | null;
      if (row?.two_factor_enabled) {
        return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 409, headers: noStore });
      }

      const secret = generateTotpSecret();
      await sql`UPDATE app_users SET two_factor_secret = ${secret} WHERE id = ${user.id}`;
      return NextResponse.json(
        { secret, otpauthUrl: otpauthUrl(secret, user.email) },
        { headers: noStore },
      );
    }

    if (action === "enable") {
      const code = typeof data.code === "string" ? data.code.trim() : "";
      const found = await sql`SELECT two_factor_secret FROM app_users WHERE id = ${user.id} LIMIT 1`;
      const secret = (Array.isArray(found) ? found[0] : null) as { two_factor_secret?: string | null } | null;
      if (!secret?.two_factor_secret) {
        return NextResponse.json({ error: "Start setup before enabling two-factor authentication." }, { status: 409, headers: noStore });
      }
      if (!verifyTotp(secret.two_factor_secret, code)) {
        return NextResponse.json({ error: "That code is not valid. Check your authenticator app and try again." }, { status: 400, headers: noStore });
      }
      await sql`
        WITH target AS (
          UPDATE app_users SET two_factor_enabled = true WHERE id = ${user.id} RETURNING id
        ), audited AS (
          INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
          SELECT ${user.id}, 'auth.2fa_enabled', 'app_user', target.id::text FROM target RETURNING id
        )
        SELECT id FROM target
      `;
      return NextResponse.json({ enabled: true }, { headers: noStore });
    }

    if (action === "disable") {
      const password = typeof data.password === "string" ? data.password : "";
      const found = await sql`SELECT password_hash FROM app_users WHERE id = ${user.id} LIMIT 1`;
      const hash = (Array.isArray(found) ? found[0] : null) as { password_hash?: string | null } | null;
      if (!hash?.password_hash || !(await verifyPassword(password, hash.password_hash))) {
        return NextResponse.json({ error: "Your password is incorrect." }, { status: 401, headers: noStore });
      }
      await sql`
        WITH target AS (
          UPDATE app_users SET two_factor_enabled = false, two_factor_secret = NULL
          WHERE id = ${user.id} RETURNING id
        ), audited AS (
          INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
          SELECT ${user.id}, 'auth.2fa_disabled', 'app_user', target.id::text FROM target RETURNING id
        )
        SELECT id FROM target
      `;
      return NextResponse.json({ enabled: false }, { headers: noStore });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: noStore });
  } catch (error) {
    console.error("Two-factor action failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to complete that action right now." }, { status: 500, headers: noStore });
  }
}
