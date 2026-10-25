import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, database: "not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const rows = await getSql()`SELECT current_timestamp AS checked_at`;
    return NextResponse.json(
      { ok: true, database: "connected", checkedAt: rows[0]?.checked_at ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
