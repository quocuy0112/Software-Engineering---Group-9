# Quickstart: Validate Identity, Authentication, and Account Recovery

This is a validation guide, not implementation code. It proves the approved stories through the App Router Route Handler → Service → Repository/Data Access → PostgreSQL design and the single Better Auth browser-session mechanism.

## Prerequisites

- Node.js 24 LTS and the repository-selected package manager.
- PostgreSQL in an isolated test environment; no SQLite or production data.
- Exact pins: Next.js 16.2.9, Better Auth and its Prisma adapter 1.6.11, Prisma/client 7.7.0, Resend 6.17.2; T002 must select and record exact compatible React Email pins before email work begins.
- Local `EMAIL_ADAPTER=capture`; no network email or real Resend key for routine validation.
- A controlled clock and parallel-test support.

## Setup and Static Gates

1. Copy the example environment file and provide test PostgreSQL URLs, one canonical Better Auth/application URL, Better Auth secret, token HMAC key, and capture email adapter.
2. Install from the lockfile; fail if the resolved Better Auth/schema CLI, Prisma/client, Next.js, or Resend versions differ from the pins.
3. Generate the Better Auth 1.6.11 Prisma schema and diff it against the committed models. Confirm there is one each of user/account/session/verification/two-factor ownership and no custom browser JWT/session table.
4. Create and apply reviewed Prisma Migrate SQL to the isolated database; never edit/reset an applied production migration.
5. Validate `contracts/openapi.yaml` as OpenAPI 3.1 and lint all `app/api/**/route.ts` handlers against the no-direct-Prisma layering rule.

## Automated Validation

Run the repository scripts created by regenerated tasks for type checking, linting, unit tests, OpenAPI contract tests, PostgreSQL integration tests, component/accessibility tests, production build, and browser E2E tests. Expected results:

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
