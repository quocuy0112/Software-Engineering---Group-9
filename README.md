# SmartHire

SmartHire is a modular full-stack Next.js application. The Spec Kit governance and feature artifacts remain under `src/`; application code lives in the single npm workspace `apps/web`.

## Local onboarding

Required tools: Git, Node.js 24.18.0 with npm 11.16.0, and Docker with Docker Compose. PostgreSQL and `psql` do not need to be installed on the host, and Resend is optional for local development.

```bash
git clone <repository-url>
cd Software-Engineering---Group-9
npm run env:init
npm run db:up
npm ci
npm run env:check
npm run dev
```

Open the application at http://localhost:3000. PostgreSQL listens only on `localhost:55432`; Docker stores its data in the named `smarthire_postgres_data` volume. Captured local email is written beneath `apps/web/.local/mail`.

Use `npm run db:down` to stop local PostgreSQL while retaining its data. Use `npm run db:reset` only when you intentionally want to delete and recreate local database data.

Never commit `.env`, `apps/web/.env.local`, anything under `apps/web/.local`, captured email, private keys, logs, coverage, or test output. The checked-in `.env.example` files contain placeholders only.

## Common checks

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run build
```

Prisma commands are reserved for T015 and later. No Prisma schema or migration is part of the current scaffold.
