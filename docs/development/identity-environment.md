# Identity local environment

The identity feature uses one full-stack Next.js workspace at `apps/web`. Local infrastructure is intentionally portable: Node.js 24.18.0, npm 11.16.0, and Docker Compose are required; host PostgreSQL, host `psql`, and Resend credentials are not.

Run from the repository root:

```bash
npm run env:init
npm run db:up
npm ci
npm run env:check
npm run dev
```

`env:init` creates `.env`, `apps/web/.env.local`, and `apps/web/.local/mail` without overwriting existing files or printing generated secrets. The generated database password is URL-encoded in `DATABASE_URL` and `DIRECT_URL`.

Local URLs and adapters:

- Application: http://localhost:3000
- PostgreSQL: `localhost:55432`, bound to loopback only
- Email: file capture at `apps/web/.local/mail`
- Session cookie: `smarthire.session`, `Secure=false`, `SameSite=Lax`
- Pre-auth cookie: `smarthire.pre-auth`, `Secure=false`, `SameSite=Lax`

Stop PostgreSQL with `npm run db:down`. Run `npm run db:reset` only to remove the named volume and recreate an empty local database. Never commit environment files, captured mail, private keys, logs, coverage, or test artifacts.

After installation, initialize the schema and verify a fresh temporary database:

```bash
npm run db:migrate
npm run db:verify
```

The verifier uses Prisma plus PostgreSQL tools inside the Compose container; it does not require host PostgreSQL or host `psql`.
