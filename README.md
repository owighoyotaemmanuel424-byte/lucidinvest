# LucidInvest

LucidInvest is a Next.js application deployed on Vercel.

## Neon PostgreSQL

The server-side database integration uses Neon’s serverless PostgreSQL driver. Configure DATABASE_URL in Vercel and apply the reviewed SQL migration in migrations/0001_initial.sql to a new or verified empty Neon database. See DEPLOYMENT.md for setup and production-safety requirements.

- Connection health: GET /api/health
- Contact submissions are persisted in contact_enquiries once the migration is applied.
- No authentication or real-money operation is enabled by this database foundation.
- Do not commit credentials or seed fake customer balances.

## Local development

npm install
cp .env.example .env.local
npm run dev
