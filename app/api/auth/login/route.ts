import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return (forwarded.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim().slice(0, 80) || null;
}

async function recordLogin(
  userId: string | null,
  email: string,
  request: NextRequest,
  success: boolean,
  reason: string | null,
) {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO login_events (user_id, email, ip, user_agent, success, reason)
      VALUES (${userId}, ${email}, ${requestIp(request)}, ${(request.headers.get("user-agent") ?? "").slice(0, 250)}, ${success}, ${reason})
    `;
  } catch (error) {
    console.error("Login event write failed", error instanceof Error ? error.message : "unknown error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    const data = body as Record<string, unknown>;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";
    const code = typeof data.code === "string" ? data.code.trim() : "";

    if (!email || email.length > 254 || !password || password.length > 128) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: noStore });
    }

    const ipLimit = rateLimit(clientKey(request, "login-ip"), 25, 900);
    const accountLimit = rateLimit(clientKey(request, "login-account", email), 8, 900);
    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retry = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again shortly." },
        { status: 429, headers: { ...noStore, "Retry-After": String(retry) } },
      );
    }

    if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      return NextResponse.json(
        { error: "Authentication is not configured on this deployment." },
        { status: 503, headers: noStore },
      );
    }

    const rows = await getSql()`
      SELECT id, email, full_name, role, status, password_hash, two_factor_enabled, two_factor_secret
      FROM app_users WHERE lower(email) = ${email} LIMIT 1
    `;
    const raw = Array.isArray(rows) ? rows[0] : undefined;
    const validRow = raw && !Array.isArray(raw) && typeof raw === "object";
    const user = validRow ? (raw as {
      id: string;
      email: string;
      full_name: string;
      role: string;
      status: string;
      password_hash: unknown;
      two_factor_enabled: boolean;
      two_factor_secret: string | null;
    }) : null;
    const matches =
      user && typeof user.password_hash === "string" ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !matches || user.status !== "active") {
      await recordLogin(user?.id ?? null, email, request, false, user ? "invalid-credentials" : "unknown-account");
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: noStore });
    }

    if (user.two_factor_enabled) {
      if (!code) {
        return NextResponse.json(
          { error: "Enter the code from your authenticator app.", twoFactorRequired: true },
          { status: 401, headers: noStore },
        );
      }
      if (!user.two_factor_secret || !verifyTotp(user.two_factor_secret, code)) {
        await recordLogin(user.id, email, request, false, "invalid-2fa");
        return NextResponse.json(
          { error: "That verification code is not valid. Try the current code.", twoFactorRequired: true },
          { status: 401, headers: noStore },
        );
      }
    }

    await createSession(user.id);
    await getSql()`UPDATE app_users SET last_login_at = now() WHERE id = ${user.id}`;
    await recordLogin(user.id, email, request, true, null);

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.full_name, role: user.role } },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Login failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500, headers: noStore });
  }
}
