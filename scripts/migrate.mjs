#!/usr/bin/env node
/**
 * Applies the repository's additive SQL migrations that the target database has
 * not recorded in `schema_migrations`.
 *
 * This is a deliberate deployment step (`npm run migrate`, also run by
 * `vercel-build` before `next build`), never part of a web request. Every script
 * is idempotent and only creates or adds objects; none deletes or rewrites
 * customer records. If a script fails, the command exits non-zero so a
 * deployment cannot ship code ahead of its schema.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const MIGRATION_FILE = /^\d{4}_.+\.sql$/;
const CREATE_EXTENSION = /^\s*(?:--[^\n]*\n\s*)*CREATE\s+EXTENSION/i;

/**
 * Splits a PostgreSQL script into individual statements so each one can be sent
 * over the Neon HTTP driver, which accepts a single statement per query.
 * Semicolons inside comments, quoted strings, quoted identifiers and
 * dollar-quoted bodies (`$$ ... $$`, `$tag$ ... $tag$`) do not end a statement.
 */
export function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let index = 0;
  let dollarTag = null;

  const push = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = "";
  };

  while (index < source.length) {
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += source[index];
        index += 1;
      }
      continue;
    }

    const char = source[index];
    const next = source[index + 1];

    if (char === "-" && next === "-") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end + 1;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      current += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        current += inner;
        index += 1;
        if (inner === quote) {
          if (source[index] === quote) {
            current += quote;
            index += 1;
            continue;
          }
          break;
        }
      }
      continue;
    }

    if (char === "$") {
      const match = /^\$[A-Za-z_0-9]*\$/.exec(source.slice(index));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (char === ";") {
      push();
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  push();
  return statements;
}

export async function applyMigrations({
  databaseUrl = process.env.DATABASE_URL,
  directory = path.join(process.cwd(), "migrations"),
  log = console,
} = {}) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set; cannot apply database migrations.");
  }

  const sql = neon(databaseUrl);
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const rows = await sql`SELECT version FROM schema_migrations`;
  const applied = new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => (row && typeof row === "object" ? String(row.version ?? "") : ""))
      .filter(Boolean),
  );

  const files = (await readdir(directory)).filter((file) => MIGRATION_FILE.test(file)).sort();
  let appliedCount = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const statements = splitSqlStatements(await readFile(path.join(directory, file), "utf8"));
    for (const [index, statement] of statements.entries()) {
      try {
        await sql.query(statement);
      } catch (error) {
        // pgcrypto is optional on PostgreSQL 13+ (gen_random_uuid is built in),
        // so a role without extension rights should not block the upgrade.
        if (CREATE_EXTENSION.test(statement)) {
          log.warn(`Skipped an optional statement in ${file}: ${error instanceof Error ? error.message : error}`);
          continue;
        }
        throw new Error(
          `${file} failed at statement ${index + 1}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    await sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT (version) DO NOTHING`;
    applied.add(version);
    appliedCount += 1;
    log.info(`Applied database migration ${version}`);
  }

  log.info(appliedCount === 0 ? "Database schema is up to date." : `Applied ${appliedCount} migration(s).`);
  return appliedCount;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  applyMigrations().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
