# Deployment and Neon PostgreSQL

LucidInvest remains a Next.js application on Vercel. Neon PostgreSQL is the persistent database. Browser code must never connect directly to Neon.

## 1. Create and configure Neon

1. Create a Neon project and select a region near the Vercel deployment.
2. Copy the pooled PostgreSQL connection string for runtime use and require SSL (sslmode=require).
3. In Vercel → Project → Settings → Environment Variables, add DATABASE_URL for Preview and Production only when each environment is ready.
4. Keep the value server-only. Never prefix it with NEXT_PUBLIC_. Never commit credentials, logs containing secrets, or .env.local.

## 2. Apply the initial schema safely

Review migrations/0001_initial.sql before applying it. Apply it in the Neon SQL Editor against a new or explicitly verified empty database. Do not apply it to an existing database until its current schema/data have been inspected and a backup/export is verified. IF NOT EXISTS is not a substitute for reviewing an existing schema.

The schema establishes users, customer accounts, investment products, investments, a double-entry ledger foundation, audit events, contact enquiries, and migration tracking. It does not import or fabricate customer records, passwords, account balances, or investments.

## 3. Verify the connection

After setting DATABASE_URL and applying the migration, deploy the app and visit /api/health. A successful response indicates database=connected. A missing or unreachable database returns HTTP 503 without exposing credentials or raw database errors.

The contact form writes enquiries to contact_enquiries; it does not send email. It returns an error rather than pretending to save if the database is unavailable.

## 4. Financial and authentication safety

- No sign-in, registration, deposit, withdrawal, trade, investment purchase, or balance-changing endpoint is enabled by this database foundation.
- The repository did not contain an established authentication/session system during this implementation. Before adding account access, implement and test server-side authentication, sessions, role checks, and account-ownership checks. Never trust client-side roles.
- Do not expose ledger writes until a reviewed service enforces idempotency, atomic transactions, balanced debit/credit entries, concurrency controls, audit records, and reconciliation.
- Keep demo and production data separate. Test migrations on a non-production Neon branch first. Back up and verify production data before any migration. Never seed fake balances or sample production users.

## Local development

Copy .env.example to .env.local, replace the placeholder with a Neon connection string, then run npm install and npm run dev. Do not commit .env.local.
