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
    const firstRow = Array.isArray(rows) ? rows[0] : undefined;
    const checkedAt = firstRow && !Array.isArray(firstRow) && typeof firstRow === "object" && "checked_at" in firstRow
      ? firstRow.checked_at
      : null;
    return NextResponse.json(
      { ok: true, database: "connected", checkedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
