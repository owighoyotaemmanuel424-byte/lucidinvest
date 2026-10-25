import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const fullName = typeof data.fullName === "string" ? data.fullName.trim().replace(/\s+/g, " ") : "";
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";

    if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: "Enter your full name (2–100 characters)." }, { status: 400 });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12 || password.length > 128) return NextResponse.json({ error: "Password must be 12–128 characters." }, { status: 400 });
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) return NextResponse.json({ error: "Authentication is not configured on this deployment." }, { status: 503 });

    const passwordHash = await hashPassword(password);
    const rows = await getSql()`
      INSERT INTO app_users (email, full_name, password_hash, role, status)
      VALUES (${email}, ${fullName}, ${passwordHash}, 'customer', 'active')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, full_name, role, status
    `;
    const user = Array.isArray(rows) ? rows[0] : undefined;
    if (!user || Array.isArray(user) || typeof user !== "object" || !("id" in user)) {
      return NextResponse.json({ error: "An account with this email may already exist." }, { status: 409 });
    }
    await createSession(String(user.id));
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.full_name, role: user.role } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Registration failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
