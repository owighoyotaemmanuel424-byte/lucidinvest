# LucidInvest

LucidInvest is a Next.js application deployed on Vercel with Neon PostgreSQL.

## Authentication

- Registration: `POST /api/auth/register` and page `/register`.
- Login: `POST /api/auth/login` and page `/login`.
- Current session: `GET /api/auth/session`.
- Logout: `POST /api/auth/logout`.
- Customer landing page: `/dashboard` (requires a valid session).

Authentication uses Node.js scrypt password hashes and an HttpOnly, SameSite=Lax, signed session cookie backed by the `auth_sessions` table. Set `DATABASE_URL` and a unique `AUTH_SECRET` (at least 32 characters) in Vercel; never commit either secret. Before enabling auth, review and apply `migrations/0002_authentication.sql` after backing up and inspecting the existing Neon schema. The migration is additive and preserves existing records. Existing accounts without a password hash need a verified password-reset/onboarding process before they can use password login.

## Admin console

`/admin` is an audited operations console for staff (overview, customers, accounts, investments, wallet requests and contact enquiries). It is gated to the `admin` role: signed-out visits are redirected to `/login` by middleware and signed-in non-admins are redirected to `/dashboard`. Customers with the admin role also get an "Admin console" link in the dashboard sidebar.

### First-time admin setup

1. Add an `ADMIN_SETUP_KEY` secret in Vercel: at least 16 characters, unique to this deployment. Never commit it.
2. Register or sign in with the account that should own the console.
3. Visit `/admin/setup`, enter the setup key and that account's password.

Setup only runs while no admin exists. Once one does, the page explains that setup is complete and `POST /api/admin/setup` answers 409. The promotion is a single conditional `UPDATE`, so two simultaneous claims cannot both succeed, and it is recorded in `audit_events` as `admin.bootstrap`. Without `ADMIN_SETUP_KEY` the page stays locked, so the console cannot be claimed by whoever registers first.

Further admins are promoted by an existing admin after review, directly in the database:

```sql
UPDATE app_users SET role = 'admin' WHERE email = 'someone@example.com';
```

There is no self-service route to become an admin, and every console action writes its `audit_events` row.

## Neon PostgreSQL

The server-side database integration uses Neon’s serverless PostgreSQL driver. Browser code must never connect directly to Neon.

- Connection health: `GET /api/health`
- Contact submissions are persisted in `contact_enquiries` once the initial migration is applied.
- These auth routes never post a ledger entry or change a balance.
- Do not commit credentials or seed fake customer balances.

### Customer accounts, investments and transactions

- `POST /api/account/accounts` opens an account for the signed-in customer from a type and currency, issues a random unique account number and stores it as `pending` for review.
- `POST /api/account/investments` records an investment request against one of that customer's accounts, validated against the published catalogue in `investment_products` (active product, matching currency, product minimum, at most two decimal places).
- `/dashboard/accounts`, `/dashboard/investments` and `/dashboard/transactions` are rendered from Neon: accounts, positions, submitted requests still in review, and posted ledger entries.
- Both write routes reject requests whose `Origin`/`Referer` host does not match the deployment host (403), on top of the HttpOnly `SameSite=Lax` session cookie.
- The overview's portfolio principal counts only `active` positions and its hint shows how many requests are still pending review.
- These requests write `customer_accounts`, `investments` and `audit_events` rows only. They never post a ledger entry, set a balance or move money in either direction. One open account per type and currency is allowed (up to ten), and a customer can hold at most ten pending investment requests.
- `migrations/0003_investment_catalogue.sql` publishes the starting product catalogue. It creates no customer records, balances or ledger entries; review the product names, currencies and minimums before applying it.

### Wallet and trading accounts

- `GET /api/wallet/overview` returns the customer's wallet (number, currency, ledger balance), their real and demo accounts with balances, and any pending deposit/withdrawal requests.
- `GET /api/wallet/transactions?page=1&pageSize=20&kind=deposit|withdrawal|transfer|investment&status=posted|pending|reversed|failed` returns a page of ledger entries across the wallet and the customer's own accounts.
- `POST /api/wallet/deposits` and `POST /api/wallet/withdrawals` record a `pending` row in `wallet_requests`. Nothing is credited or debited until staff confirm it, and a pending withdrawal reserves its amount against the wallet balance. A withdrawal requires a note describing the payout details.
- `POST /api/wallet/transfers` moves wallet funds into one of the customer's own real accounts. One statement re-checks the available balance and posts the wallet debit, the account credit, the ledger transaction and the audit event, so the two sides can never land alone.
- `PATCH /api/admin/wallet-requests/:id` approves (`posted`) or rejects (`rejected`) a request. Approval updates the request, posts the single wallet entry and writes the audit row in one statement; a withdrawal whose balance no longer covers it is refused rather than overdrawing the wallet.
- Money is integer minor units in the API and UI (`lib/money.ts`) and `NUMERIC(24, 8)` in Postgres. Amounts accept at most two decimal places and the dashboard never does floating-point maths on a balance.
- `migrations/0006_wallet.sql` adds `wallets`, `wallet_requests` and a nullable `ledger_entries.wallet_id`, with a check that each entry belongs to exactly one account **or** wallet. No wallet is created with a balance and no payment provider is connected, so a deposit or withdrawal only becomes balance when staff post it.
- Demo accounts are listed separately and are never funded from the wallet; they are not connected to the live ledger.

### Password recovery and security

- `POST /api/auth/forgot-password` issues a single-use token when the address belongs to an active account and always answers with the same message. Only the SHA-256 digest of the token is stored (`password_reset_tokens`), it expires after one hour and earlier unused links are closed out.
- `POST /api/auth/reset-password` consumes the token once, stores a new scrypt hash and revokes every existing session for the account in one statement.
- `/forgot-password` and `/reset-password?token=…` are the customer-facing pages; the sign-in form links to them.
- `POST /api/auth/change-password` verifies the current password, stores the new one and signs out every other session. `/dashboard/security` hosts the form.
- No mail provider is configured in this repository. Without one, the reset link has to be delivered by your support process: set `RESET_LINK_LOG=1` on a controlled environment to print the link to the server log, and never enable it in a shared production log.

### Customer cancellations

`POST /api/account/investments/:id/cancel` withdraws the signed-in customer's own `pending` request (ownership and the pending status are part of the update). The request moves to `cancelled` and an audit row is written; a request that has already been reviewed cannot be cancelled.

## Admin operations

The console at `/admin` is gated by `requireAdmin()` in the layout and again in every route handler, and all writes require a same-origin request and write an `audit_events` row:

- `PATCH /api/admin/customers/:id` sets `active`, `suspended` or `closed` on a customer record (never on staff accounts or your own account).
- `PATCH /api/admin/accounts/:id` approves a `pending` account (`active`) or rejects it (`closed`).
- `PATCH /api/admin/investments/:id` approves (`active`) or rejects (`rejected`) a pending request. Approval flips the status, posts one `ledger_transactions` row and its `ledger_entries` entry, and writes the audit event in a single SQL statement, so a double approval cannot post twice.
- `PATCH /api/admin/enquiries/:id` moves an enquiry through `new → reviewing → resolved` (or `spam`).

Wallet deposits and withdrawals are confirmed from the Wallet requests tab, and each confirmation posts its wallet ledger entry in the same statement. Balance edits, reversals and trading remain unavailable.

## Content pages and articles

- `/index-3` renders the `home3` section suite and `/index-4` the `home4` suite, each with its own header and footer style; `/` remains the default landing page.
- Every article lives in `lib/blog.ts`. The four listing pages and the `/blog-N/[slug]` detail routes read from it, detail routes emit their own metadata and unknown slugs are a real 404 (`dynamicParams = false`). `/blog-single` is a 307 redirect to `/blog-1`.
- `components/elements/ContactForm.tsx` sends name, email, phone, subject and message to `POST /api/contact`, which validates all five and stores them in `contact_enquiries` (`phone` added by `migrations/0005_contact_phone.sql`).
- The newsletter form on `/coming-soon` stores enquiries with `subject: 'Coming Soon Notification'`.

## Investment marketplace and wealth platform

The platform now extends the existing Neon/raw-SQL architecture. There is no Prisma in this repository; all schema changes are additive SQL migrations reviewed against the existing tables.

### Migrations

Apply in order after inspecting the target database and taking a backup:

1. `0001`–`0006` as before.
2. `0007_platform.sql` adds product configuration, market instruments and prices, orders and holdings, KYC submissions and documents, staff roles and permissions, notifications, support tickets, portfolio snapshots, referrals, login events and platform settings. `deposits` and `withdrawals` are read-only views over `wallet_requests`; the wallet ledger remains the single source of truth for cash.
3. `0008_demo_market_data.sql` publishes clearly simulated instruments and quotes (`is_demo = true`) plus additional plan products. Remove it if you do not want demonstration data.
4. `0009_ledger_double_entry.sql` adds a chart of accounts with platform clearing accounts and a deferred check that any transaction referenced `ORD-` balances to zero.
5. `0010_kyc_blobs.sql` adds private KYC document storage (bytes in Postgres, served only through an authorised route).

### Customer dashboard

`/dashboard` now shows total portfolio value, available balance, total invested, unrealised returns, today's change, active investments and pending transactions, with a performance chart, allocation donut and recent ledger activity. Additional pages: `/dashboard/portfolio`, `plans`, `markets`, `buy`, `sell`, `deposit`, `withdraw`, `statements`, `referrals`, `notifications`, `support`. KYC is managed from `/dashboard/profile`; 2FA, sessions and login history from `/dashboard/security`.

### Trading and settlement

- `POST /api/account/orders` records a pending buy or sell at the latest recorded quote. Notional is computed with BigInt-scaled decimals, never floating point.
- Buys are validated against the account balance less other pending buys; sells against the holding quantity.
- `PATCH /api/admin/orders/:id` fills or rejects. Filling posts a balanced transaction (customer cash account and `PLATFORM_CLEARING`) and updates the holding in the same statement.
- A deferred constraint trigger rejects any unbalanced transaction with an `ORD-` reference.
- No live exchange feed is connected. Simulated quotes are flagged in the database and labelled throughout the UI. `DEMO_MODE=true` adds an explicit demo banner.

### KYC, support, notifications and referrals

- KYC submission, private document upload (`PDF/JPEG/PNG`, max 5 MB) and an authorised download route. Customers can resubmit after a rejection; staff review with a risk rating and rejection reason.
- Support tickets carry a threaded conversation; staff replies notify the customer and are audited.
- Notifications are per-customer records; administrators can broadcast to active customers.
- Referral codes are issued per customer and invitations convert when the address registers with the code.

### Administrator portal

`/admin` now covers overview, customers (with per-customer detail), investor accounts, investments, investment products, deposits, withdrawals, transactions, orders, KYC verification, portfolio management, market data, referrals, support tickets, notifications, reports, staff management, roles and permissions, audit logs and platform settings. Every write re-checks the staff role and, where configured, the role's permission set. Balance edits remain unavailable; money moves only through reviewed ledger postings.

### Reports and security

- `GET /api/reports/:kind?format=csv|pdf` serves customer statements and, for administrators, activity and compliance reports. PDF is generated without an added dependency.
- Login is rate-limited, records every attempt in `login_events`, and supports TOTP two-factor authentication (enabled from `/dashboard/security`).
- Session handling, same-origin checks and scrypt hashing from the existing implementation are unchanged. All new write routes require a live session and a same-origin request.

### Environment

`DATABASE_URL` and `AUTH_SECRET` are still required. Optional: `ADMIN_SETUP_KEY` for the one-time admin claim and `DEMO_MODE=true` for simulated activity. See `.env.example`.

## Local development

```sh
npm install
cp .env.example .env.local
npm run dev
```
