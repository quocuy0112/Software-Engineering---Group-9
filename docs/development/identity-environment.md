# Identity local environment

The identity feature uses one full-stack Next.js workspace at `web`. Local infrastructure is intentionally portable: Node.js 24.18.0, npm 11.16.0, and Docker Compose are required; host PostgreSQL, host `psql`, and Resend credentials are not.

Run from the repository root:

```bash
npm run env:init
npm run db:up
npm ci
npm run env:check
npm run dev
```

`env:init` creates `.env`, `web/.env.local`, and `web/.local/mail` without overwriting existing files or printing generated secrets. The generated database password is URL-encoded in `DATABASE_URL` and `DIRECT_URL`.

Local URLs and adapters:

- Application: http://localhost:3001
- PostgreSQL: `localhost:55432`, bound to loopback only
- Email: file capture at `web/.local/mail`
- Session cookie: `smarthire.session`, `Secure=false`, `SameSite=Lax`
- Pre-auth cookie: `smarthire.pre-auth`, `Secure=false`, `SameSite=Lax`

Stop PostgreSQL with `npm run db:down`. Run `npm run db:reset` only to remove the named volume and recreate an empty local database. Never commit environment files, captured mail, private keys, logs, coverage, or test artifacts.

After installation, initialize the schema and verify a fresh temporary database:

```bash
npm run db:migrate
npm run db:verify
```

The verifier uses Prisma plus PostgreSQL tools inside the Compose container; it does not require host PostgreSQL or host `psql`.
## Transactional email worker

The normal `npm run dev` command supervises both the web application and the due EmailOutbox worker. Use `npm run dev:web` and `npm run email:worker` separately for troubleshooting. `EMAIL_ADAPTER` is the only selector: `capture` is default, `smtp` is local/demo opt-in, and `resend` is production-oriented. Never commit provider credentials. Retryable jobs use bounded backoff; expired worker leases recover automatically; DEAD jobs require secret-safe operational review.

When debugging delivery, query only `status`, `attempts`, `nextAttemptAt`, `leaseExpiresAt`, and `safeErrorCode`; do not print payloads, tokens, recipients, or environment values. `PENDING` and due `RETRYABLE` rows resume when the worker starts. An expired `PROCESSING` lease is reclaimed automatically after an interrupted worker. A `DEAD` row is terminal and is never redelivered; correct the safe error's operational cause and enqueue an approved replacement rather than mutating the terminal record. Ctrl+C on root `npm run dev` stops both supervised processes; each split command can also be stopped independently.
