# Deployment and Neon PostgreSQL

LucidInvest remains a Next.js application on Vercel. Neon PostgreSQL is the persistent database. Browser code must never connect directly to Neon.

## 1. Configure Neon

1. In Neon, inspect the existing database and take a verified backup/export before schema changes.
2. In Vercel → Project → Settings → Environment Variables, configure `DATABASE_URL` for the intended environments. Use the pooled PostgreSQL connection string with SSL.
3. Generate a unique authentication secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and set it as `AUTH_SECRET` in Vercel. Use at least 32 characters. Do not reuse database credentials or commit either secret.
4. Redeploy after setting environment variables.

## 2. Apply schema migrations safely

The initial schema `migrations/0001_initial.sql` was designed for a new or explicitly verified empty database. Do not run it against a production database without first reviewing its schema/data and verifying a backup.

The authentication migration `migrations/0002_authentication.sql` is additive: it adds nullable password hashes and a session table. Review it and apply it to the intended Neon database after a verified backup. Existing user records are preserved. Existing users without a password hash cannot sign in with a password until a separately verified reset/onboarding process is provided.

## 3. Authentication routes

- `/register`: customer registration.
- `/login`: customer login.
- `/dashboard`: server-side session-protected landing page.
- `POST /api/auth/logout`: revokes the current database session and clears the HttpOnly cookie.
- `GET /api/auth/session`: returns the current user without exposing credentials.

Passwords are hashed with Node.js scrypt. Session tokens are random, stored as SHA-256 digests in the database, and delivered in signed HttpOnly cookies. Cookie transport is Secure in production and SameSite=Lax. Authentication still requires a production security review, including rate limiting/abuse controls, password reset, email verification policy, CSRF review for any future state-changing cookie-authenticated endpoints, and end-to-end tests. Do not claim these features are complete unless they are implemented and verified.

## 4. Production verification checklist

1. Confirm `DATABASE_URL` and `AUTH_SECRET` are set for the correct Vercel environment without printing their values.
2. Confirm the migration is applied to the intended Neon database.
3. Test valid registration, duplicate email, invalid input, valid login, invalid login, session persistence, logout, and unauthenticated dashboard redirect.
4. Verify existing records remain intact and that no real-money functionality is exposed by these changes.
5. Review deployment build and runtime logs for errors; never include secrets in diagnostic output.
