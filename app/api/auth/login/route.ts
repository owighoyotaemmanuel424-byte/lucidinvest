import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (!email || email.length > 254 || !password || password.length > 128) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const rows = await getSql()`
      SELECT id, email, full_name, role, status, password_hash
      FROM app_users WHERE email = ${email} LIMIT 1
    `;
    const user = Array.isArray(rows) ? rows[0] : undefined;
    const validRow = user && !Array.isArray(user) && typeof user === "object" && "password_hash" in user;
    const passwordHash = validRow ? (user as { password_hash: unknown }).password_hash : null;
    const matches = typeof passwordHash === "string" ? await verifyPassword(password, passwordHash) : false;
    if (!validRow || !matches || (user as { status?: string }).status !== "active") {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    await createSession(String((user as { id: string }).id));
    const account = user as { id: string; email: string; full_name: string; role: string };
    return NextResponse.json({ user: { id: account.id, email: account.email, name: account.full_name, role: account.role } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Login failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
