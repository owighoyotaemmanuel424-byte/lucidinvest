import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/same-origin";
import { createPasswordResetToken } from "@/lib/password-reset";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

const GENERIC_MESSAGE = "If that email belongs to an account, a reset link is on its way. The link expires in one hour.";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "This action must be started from the sign-in page." }, { status: 403, headers: noStore });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Account recovery is not configured on this deployment." }, { status: 503, headers: noStore });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    }
    const data = body as Record<string, unknown>;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: noStore });
    }

    const ipLimit = rateLimit(clientKey(request, "forgot-ip"), 10, 900);
    const emailLimit = rateLimit(clientKey(request, "forgot-email", email), 3, 900);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many recovery attempts. Try again later." },
        { status: 429, headers: { ...noStore, "Retry-After": String(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)) } },
      );
    }

    const issued = await createPasswordResetToken(email);

    // No mail provider is wired into this deployment. An operator can surface the
    // link by opting in explicitly; it is never returned to the browser.
    if (issued && process.env.RESET_LINK_LOG === "1") {
      console.info(`Password reset link for ${email}: /reset-password?token=${issued.token}`);
    }

    // Always the same answer, whether or not the address exists.
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE }, { headers: noStore });
  } catch (error) {
    console.error("Password reset request failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to start account recovery right now." }, { status: 500, headers: noStore });
  }
}
