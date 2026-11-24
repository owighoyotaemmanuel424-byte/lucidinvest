import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { splitSqlStatements } from "@/lib/sql-split";

/**
 * Applies the repository's additive SQL migrations that the connected database
 * has not recorded yet.
 *
 * Deploying application code that expects newer columns (for example the
 * two-factor columns added in 0007) before the database has been upgraded used
 * to make every sign-in fail. Running the pending scripts once, at startup,
 * keeps the code and schema in step. Every migration is idempotent and only
 * creates or adds objects; none deletes or rewrites customer records.
 *
 * Set AUTO_MIGRATE=0 to disable this and apply migrations manually instead.
 */

let inFlight: Promise<void> | null = null;
let complete = false;

export function ensureDatabaseSchema(): Promise<void> {
  if (complete) return Promise.resolve();
  if (!inFlight) {
    inFlight = applyPendingMigrations()
      .then(() => {
        complete = true;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function applyPendingMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || process.env.AUTO_MIGRATE === "0") return;

  const sql = neon(databaseUrl);
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql`SELECT version FROM schema_migrations`;
  const applied = new Set(
    (Array.isArray(appliedRows) ? appliedRows : [])
      .map((row) => (row && typeof row === "object" ? String((row as { version?: unknown }).version ?? "") : ""))
      .filter(Boolean),
  );

  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const source = await readFile(path.join(directory, file), "utf8");
    const statements = splitSqlStatements(source);

    for (const [index, statement] of statements.entries()) {
      try {
        await sql.query(statement);
      } catch (error) {
        // pgcrypto is optional on PostgreSQL 13+ (gen_random_uuid is built in),
        // so a role without extension rights should not block the upgrade.
        if (/^\s*(?:--[^\n]*\n\s*)*CREATE\s+EXTENSION/i.test(statement)) {
          console.warn(`Skipped optional statement in ${file}:`, error instanceof Error ? error.message : error);
          continue;
        }
        throw new Error(
          `${file} failed at statement ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    await sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT (version) DO NOTHING`;
    applied.add(version);
    console.info(`Applied database migration ${version}`);
  }
}
