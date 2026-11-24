import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/same-origin";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const TOKEN = /^[A-Za-z0-9_-]{20,}$/;

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "This action must be started from the reset page." }, { status: 403, headers: noStore });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Account recovery is not configured on this deployment." }, { status: 503, headers: noStore });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    }
    const data = body as Record<string, unknown>;
    const token = typeof data.token === "string" ? data.token.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";

    if (!TOKEN.test(token)) {
      return NextResponse.json({ error: "That reset link is invalid. Request a new one." }, { status: 400, headers: noStore });
    }
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json({ error: "Choose a password of 12–128 characters." }, { status: 400, headers: noStore });
    }

    const limit = rateLimit(clientKey(request, "reset-password"), 10, 900);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts. Try again later." },
        { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await resetPasswordWithToken(token, passwordHash);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    }

    return NextResponse.json(
      { ok: true, message: "Password updated. Sign in with your new password.", revokedSessions: result.revokedSessions },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Password reset failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to reset the password right now." }, { status: 500, headers: noStore });
  }
}
