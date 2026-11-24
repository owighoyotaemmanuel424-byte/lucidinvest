import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { ensureDatabaseSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKER = "schema-fix-2";

type ColumnRow = { table_name: string; column_name: string };
type VersionRow = { version: string };

/**
 * Read-only deployment diagnostics: reports whether the connected database has
 * the columns the current release expects. It exposes no customer data, no
 * credentials and no query parameters.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ marker: MARKER, configured: false, error: "DATABASE_URL is not set" }, { headers });
  }

  let error: string | null = null;
  try {
    await ensureDatabaseSchema();
  } catch (caught) {
    error = (caught instanceof Error ? caught.message : "unknown error").slice(0, 400);
  }

  try {
    const sql = neon(databaseUrl);
    const versions = (await sql`SELECT version FROM schema_migrations ORDER BY version`) as VersionRow[];
    const columns = (await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'app_users' AND column_name IN ('two_factor_enabled', 'two_factor_secret', 'last_login_at'))
          OR (table_name = 'contact_enquiries' AND column_name = 'phone'))
    `) as ColumnRow[];

    return NextResponse.json(
      {
        marker: MARKER,
        configured: true,
        autoMigrate: process.env.AUTO_MIGRATE !== "0",
        versions: versions.map((row) => row.version),
        columns: columns.map((row) => `${row.table_name}.${row.column_name}`).sort(),
        error,
      },
      { headers },
    );
  } catch (caught) {
    return NextResponse.json(
      {
        marker: MARKER,
        configured: true,
        error: error ?? (caught instanceof Error ? caught.message.slice(0, 400) : "unknown error"),
      },
      { status: 500, headers },
    );
  }
}
