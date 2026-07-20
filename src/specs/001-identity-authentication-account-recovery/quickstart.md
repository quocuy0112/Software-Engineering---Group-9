# Quickstart: Validate Identity, Authentication, and Account Recovery

This is a validation guide, not implementation code. It proves the approved stories through the App Router Route Handler → Service → Repository/Data Access → PostgreSQL design and the single Better Auth browser-session mechanism.

## Prerequisites

- Node.js `24.18.x` selected by the root `.nvmrc` or `.node-version`, with npm run from the repository root.
- Docker Desktop or another compatible Docker Compose runtime. This is the only required local infrastructure dependency.
- Exact pins: Next.js 16.2.9, Better Auth and its Prisma adapter 1.6.11, Prisma/client 7.7.0, Resend 6.17.2, Nodemailer 9.0.3, and @types/nodemailer 8.0.1; all resolve from the root lockfile.
- No host PostgreSQL or `psql` installation. PostgreSQL 16.12 runs in Compose on host port `55432` with a health check and persistent named volume.
- Local `EMAIL_ADAPTER=capture`; no network email, Resend installation, or Resend API key is required for routine setup and validation.
- SMTP is an optional per-developer local adapter. Gmail uses a complete account address plus Google App Password; generated environments never contain SMTP credentials.
- A controlled clock and parallel-test support.

## Local Setup

From the repository root:

```bash
git clone <repository-url>
cd Software-Engineering---Group-9
npm run env:init
npm run db:up
npm ci
npm run env:check
npm run dev
```

The planned `npm run dev` command starts both the Next.js application and due-outbox worker through a cross-platform supervisor. Use `npm run dev:web` and `npm run email:worker` separately only for debugging. The worker must be running before expecting capture, SMTP, or Resend delivery; registration and resend responses intentionally return after the outbox commit and do not wait for mail.

Open http://localhost:3000. PostgreSQL is published only at `localhost:55432`, and captured email is stored in `apps/web/.local/mail`. Use `npm run db:down` to stop PostgreSQL without deleting data; use `npm run db:reset` only to delete the local named volume and start clean.

`env:init` invokes `scripts/setup-local.mjs`; it generates PostgreSQL and Better Auth secrets without printing them, does not overwrite existing files, creates root `.env` and `apps/web/.env.local`, and creates the gitignored file-email capture directory. If either environment file already exists, preserve it and report only the skipped path, never its contents.

`env:check` invokes `scripts/check-environment.mjs`; it checks Node `24.18.x`, npm `11.16.x`, the root npm workspace and sole root lockfile, Docker Compose availability, required environment files, Compose configuration, and capture-directory writability without exposing secrets.

Initialize and verify Prisma connectivity and committed migrations with:

```bash
npm run db:migrate
npm run db:verify
```

The verifier initializes an empty temporary PostgreSQL database from committed migrations, checks status and drift, proves Prisma connectivity, and removes its temporary databases without requiring host PostgreSQL or host `psql`.

Do not commit `.env`, `apps/web/.env.local`, captured email, private keys, logs, coverage, or test output. Host PostgreSQL and host `psql` are not required, and Resend remains optional for local startup.

If direct database inspection is needed, run the PostgreSQL client inside the container with `docker compose exec`; host `psql` is never a prerequisite. Do not use `docker compose down -v` during routine work because the named volume is the local persistence mechanism.

## Static and Compatibility Gates

1. Install only from the root lockfile; fail if the resolved Better Auth/schema CLI, Prisma/client, Next.js, Resend, or T002-approved React Email versions differ from their pins.
2. Wait for the Compose PostgreSQL health check, then prove application connectivity using the Prisma-backed `db:check` workspace script.
3. From `apps/web/`, generate the Better Auth 1.6.11 Prisma schema and diff it against `apps/web/prisma/schema.prisma`. Confirm there is one each of user/account/session/verification/two-factor ownership and no custom browser JWT/session table.
4. Create and apply reviewed Prisma Migrate SQL under `apps/web/prisma/migrations/`; never edit/reset an applied production migration.
5. Validate `src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml` as OpenAPI 3.1 and lint all `apps/web/src/app/api/**/route.ts` handlers against the no-direct-Prisma layering rule.

## Automated Validation

Run root npm workspace scripts for type checking, linting, unit tests, OpenAPI contract tests, Compose PostgreSQL integration tests, component/accessibility tests, production build, and browser E2E tests. All application commands target `apps/web/`, Prisma commands execute from that workspace, and the only lockfile remains at the repository root. Expected results:

- no Pages Router API Route or FastAPI application backend exists;
- no browser JWT, Better Auth JWT plugin, second browser-session cookie, duplicate `Session`, or `tokenDigest` substitution for Better Auth `Session.token` exists;
- no output includes passwords, cookies/session tokens, token URLs, TOTP secrets/codes, backup codes, or raw rate-limit subjects;
- Sonner is not the sole error channel, and no authentication page imports Lenis.

## Critical Walkthrough

1. Register two concurrent requests with differently cased/spaced forms of the same email. Confirm one normalized `UserAccount`, one credential `AuthProviderAccount`, one Candidate identity, generic response behavior, audit, and one logical captured verification email.
2. Consume the verification token twice and after expiry. Confirm only the first valid attempt moves Pending Verification → Active and all failures are generic.
3. Log in without 2FA. In production HTTPS, confirm the only authentication cookie is `__Host-smarthire.session` with `Secure=true`, `HttpOnly=true`, `SameSite=Lax`, `Path=/`, and no `Domain`. In development without HTTPS, confirm the only authentication cookie is unprefixed `smarthire.session` with `Secure=false`; an insecure `__Host-` cookie must never be emitted. Its value maps to Better Auth `Session.token` and is server-validated.
4. Advance inactivity beyond 30 minutes and absolute age beyond 7 days independently. Confirm next-request rejection/revocation and audit; session refresh must never extend the absolute ceiling.
5. Create six concurrent sessions. Confirm at most five remain, deterministic least-recent eviction excludes the just-created current session, and listing exposes no raw token.
6. Enroll TOTP through Better Auth after required proof. Confirm no email OTP/trusted-device option, setup data is no-store, and Better Auth owns the TOTP/backup record.
7. Complete login with TOTP, then a backup code. Confirm Better Auth creates the same sole session mechanism only after factor completion. In production the challenge cookie is `__Secure-smarthire.pre-auth` with `Secure=true`; development without HTTPS uses unprefixed `smarthire.pre-auth` with `Secure=false`. Race two uses of one backup code; exactly one may succeed. Regeneration invalidates the old set.
8. Disable 2FA with one request object containing both `currentPassword` and `code`; verify missing either field fails validation.
9. Request password recovery for existing and absent emails. Confirm indistinguishable accepted responses/timing band. Reset once; confirm all Better Auth sessions and outstanding challenges/reset tokens are revoked and normal login is required.
10. List sanitized sessions, revoke a selected owned session, and sign out the current session. Confirm immediate next-request rejection and identical cookie clearing attributes.
11. Set a `UserAccount` to Suspended and Deleted using a fixture representing future User Management. Confirm authentication/protected access rejects and revokes sessions. Do not add administrator state-change endpoints to this feature.
12. Stop the capture worker/Resend adapter during relevant flows. Confirm core transactions remain correct, outbox retry/dead-letter behavior is observable, and generic responses do not disclose provider failures.

Captured local messages are files beneath the configured `EMAIL_CAPTURE_DIR`; inspect those files for demo links and expected HTML/text output. Switching to the optional Resend adapter is outside routine local startup and must not be necessary for any local acceptance scenario.

### Optional Gmail SMTP smoke test

Keep capture as the normal acceptance-test adapter. For an explicit Gmail delivery test, place the following only in the untracked `apps/web/.env.local`, run `npm run env:check`, and restart `npm run dev`:

    EMAIL_ADAPTER=smtp
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USERNAME=developer@gmail.com
    SMTP_PASSWORD=<Google App Password>
    SMTP_FROM="SmartHire <developer@gmail.com>"
    SMTP_SECURE=false
    SMTP_USE_TLS=true

Register a unique address and verify that the existing outbox worker sends the unchanged template. Gmail 587 requires STARTTLS (`secure=false`, `SMTP_USE_TLS=true`). Gmail 465 requires implicit TLS (`secure=true`). Never place SMTP credentials in examples, logs, captured fixtures, database rows, or tracked files.

`EMAIL_ADAPTER` is the only selector; remove `EMAIL_DRIVER` from existing untracked local environments. Validate that `SMTP_USERNAME` is a complete email address and that `SMTP_FROM` contains no CR, LF, or control character. For a split-process demonstration, run `npm run dev:web` and `npm run email:worker` in separate terminals, then stop either with Ctrl+C and verify graceful shutdown/recoverable leases.

## Better Auth Compatibility Gate

Before implementation is accepted, inspect and test Better Auth 1.6.11 primary schema/source behavior for:

- Prisma adapter model/field compatibility and opaque database sessions;
- TOTP secret and backup-code storage protection at rest;
- atomic backup-code removal under concurrent PostgreSQL requests;
- session list, selected revoke, all revoke, current sign-out, and cookie clearing;
- hook ordering for account-state rejection, idle/absolute checks, five-session enforcement, and audit;
- password-reset orchestration and all-session revocation failure semantics.

Any failed security requirement blocks implementation and requires a documented Better Auth extension/ADR. It must not be bypassed with a second session, JWT browser cookie, or duplicate TOTP/backup owner.

## Accessibility, Responsive, and Performance Evidence

- Keyboard-only test every screen at 320 CSS px and desktop widths; verify labels, focus, summary plus inline errors, persistent status, no color-only meaning, and reduced-motion behavior.
- Measure page load ≤3 seconds and identity actions ≤2 seconds using documented CPU/memory, browser/build, PostgreSQL version/latency, seeded row/session counts, cold/warm state, percentile/sample size, and capture-versus-Resend condition.
- Scan persisted data, logs, traces, captured mail metadata, and error payloads for prohibited secrets.
