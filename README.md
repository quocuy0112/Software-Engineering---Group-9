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

### Optional Gmail SMTP for local delivery

Capture remains the generated default. To send transactional mail through Gmail, edit only the untracked `apps/web/.env.local` and set:

    EMAIL_DRIVER=smtp
    EMAIL_ADAPTER=smtp
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USERNAME=developer@gmail.com
    SMTP_PASSWORD=<Google App Password>
    SMTP_FROM="SmartHire <developer@gmail.com>"
    SMTP_SECURE=false
    SMTP_USE_TLS=true

Use the complete Gmail address and a Google App Password, not the normal account password. Port 587 requires STARTTLS with `secure=false`; port 465 is supported with `SMTP_PORT=465`, `SMTP_SECURE=true`, and `SMTP_USE_TLS=false`. Restart `npm run dev` after changing the adapter. SMTP variables are server-only and must never be committed or renamed with a `NEXT_PUBLIC_` prefix.

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

Initialize or verify a developer database from committed migrations with:

```bash
npm run db:migrate
npm run db:verify
```

`db:verify` proves that an empty PostgreSQL database can be initialized from committed migrations and that Prisma can connect without host PostgreSQL or host `psql`.
