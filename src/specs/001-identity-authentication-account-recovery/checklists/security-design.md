# Security Design Checklist: Identity, Authentication, and Account Recovery

**Purpose**: Gate implementation and review of the P0 identity plan

- [x] Constitution permits App Router Route Handlers and exactly one opaque database-backed browser-session mechanism
- [x] Better Auth exclusively owns the opaque PostgreSQL Session and only browser authentication cookie
- [x] No custom browser JWT, Better Auth JWT-plugin replacement, second session cookie, or duplicate Session owner exists
- [x] Server validates Better Auth session, account state, idle/absolute limits, and revocation on every protected request
- [x] Production uses Secure `__Host-smarthire.session` with Path=/ and no Domain plus Secure `__Secure-smarthire.pre-auth`; development without HTTPS uses unprefixed names and never emits an insecure prefixed cookie
- [x] Current logout, listing, selected revocation, reset revocation, five-session cap, and cleanup responsibilities are explicit
- [x] Account states and terminal Deleted behavior are modeled; administrator state-change commands remain future User Management scope
- [x] Verification/reset/challenge tokens are random, digested, single-use, and expiring
- [x] Better Auth exclusively owns TOTP and backup-code behavior; pinned-version storage protection and atomic-use tests are implementation gates
- [x] Password, rate-limit, generic anti-enumeration, redirect, origin/CSRF, and redaction policies are defined
- [x] Resend failures are isolated through an idempotent outbox and local development is non-network
- [x] Local setup generates secrets without printing or overwriting them; environment and capture artifacts are gitignored
- [x] Local HTTP uses only unprefixed cookies with `Secure=false`; prefixed production cookies remain Secure-only
- [x] Append-only audit, concurrency/transactions, constraints/indexes, migrations, cleanup, recovery, and rollback are planned
- [x] Security, accessibility, contract, integration, E2E, and measured performance tests are planned
- [x] Transactional email uses one server-only adapter selector, leased PostgreSQL `SKIP LOCKED` claims, bounded retry/DEAD transitions, unique terminal audit, secret-safe errors, and a supervised worker with verified no-orphan teardown
- [x] Normal password reset is an idempotent fail-closed saga with one token claimant, durable audit intent/finalization, Better Auth password update, session/challenge cleanup, idempotent notification enqueue, 2FA preservation, retry/concurrency policy, and a login block while mandatory cleanup is incomplete
- [x] Full account recovery is explicitly separate, enumeration-safe, verified-email based, HMAC-proof protected, held for 24 hours, cancellable once, login-blocking while pending, and the only path that disables old 2FA/backup codes after the hold; email-only recovery is documented as lower assurance

## Implementation gate

Any unchecked item blocks `/speckit-implement`. Failure of Better Auth 1.6.13 TOTP/backup-code protection, atomic-use, session-hook ordering, or reset-revocation tests blocks implementation pending an approved extension/ADR. It must never produce duplicate authentication ownership.

## Final automated review (2026-07-24)

- [x] Dependency compatibility: 4 files, 16 tests passed.
- [x] Unit: 25 files, 113 tests; integration: 28 files, 99 tests; full Vitest: 77 files, 280 tests.
- [x] Focused desktop Playwright groups passed; mobile-320 passed 16/16; full Playwright passed 32/32 with workers=1.
- [x] Prisma schema validation, 5-migration status, fresh migration, drift, and connectivity verification passed against PostgreSQL 16.12.
- [x] Lint, typecheck, production build, and `git diff --check` passed.
- [x] `npm audit --json`: 0 critical, 0 high, 0 moderate, 0 low.
- [x] Generated/client and tracked-secret scans contain no unapproved or secret-bearing files.

T160 remains the sole unchecked human usability-study task.

## Prior automated review (2026-07-22, historical / superseded)

The following results are retained for historical traceability only. They are
not current PASS claims and are superseded by the reconciled route, reset-saga,
and deferred full-recovery scope; future evidence tasks must rerun them.

- [x] HISTORICAL: Full Vitest suite: 66 files, 241 tests passed.
- [x] HISTORICAL: Better Auth/dependency compatibility: 4 files, 15 tests passed after the final manifest update.
- [x] HISTORICAL: Desktop and 320px mobile Playwright: 30/30 passed.
- [x] HISTORICAL: Fresh migration, drift, and Prisma connectivity verification passed against PostgreSQL 16.12.
- [x] HISTORICAL: Configured-secret value scan found no match in tracked text files.
- [x] HISTORICAL: Runtime scan found no OIDC-provider, MCP, or JWT-plugin surface.
- [x] HISTORICAL: npm audit: 0 critical, 3 high dependency nodes, 4 moderate, 0 low; the scoped Better Auth and sharp/Next exposure decisions are recorded in `npm-security-exception.md`.
- [x] HISTORICAL: Production build, lint, type-check, and the 100-run/page performance gate passed.

The historical automated release-gate results were recorded as passing under
the documented temporary dependency exceptions. They are not current evidence
for this reconciled increment. Human usability thresholds remain a separate
post-implementation gate and are not claimed here.

## Focused recovery implementation review (2026-07-23)

- [x] Current recovery Vitest and reset-regression evidence is recorded in
  `integration-results.md`; current compatibility is 4 files/16 tests.
- [x] Migration `005_full_account_recovery` passed Prisma validation/status and
  fresh-database, drift, and connectivity verification; migration 004 remains
  unchanged.
- [x] Desktop and mobile-320 focused recovery Playwright each passed 1/1 in
  isolated production-stack runs; the same-stack combined run is not promoted.
- [x] Recovery proofs are random, fragment-only, HMAC-digested, single-use,
  expiry-constrained, sealed for email delivery, and absent from logs/audit.
- [x] Full recovery is the only path that disables Better Auth 2FA and
  invalidates backup codes; normal password reset preservation remains covered
  by the focused regression suite.
- [x] Partial cleanup keeps a durable operation state and failure code, and
  login/protected-route gates remain fail-closed until cancellation or
  completion.
