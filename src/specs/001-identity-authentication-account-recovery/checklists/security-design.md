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

## Implementation gate

Any unchecked item blocks `/speckit-implement`. Failure of Better Auth 1.6.11 TOTP/backup-code protection, atomic-use, session-hook ordering, or reset-revocation tests blocks implementation pending an approved extension/ADR. It must never produce duplicate authentication ownership.

## Final automated review (2026-07-22)

- [x] Full Vitest suite: 66 files, 241 tests passed.
- [x] Better Auth/dependency compatibility: 4 files, 15 tests passed after the final manifest update.
- [x] Desktop and 320px mobile Playwright: 30/30 passed.
- [x] Fresh migration, drift, and Prisma connectivity verification passed against PostgreSQL 16.12.
- [x] Configured-secret value scan found no match in tracked text files.
- [x] Runtime scan found no OIDC-provider, MCP, or JWT-plugin surface.
- [x] npm audit: 0 critical, 3 high dependency nodes, 4 moderate, 0 low; the scoped Better Auth and sharp/Next exposure decisions are recorded in `npm-security-exception.md`.
- [x] Production build, lint, type-check, and the 100-run/page performance gate passed.

Automated release gates pass under the documented temporary dependency exceptions. Human usability thresholds remain a separate post-implementation gate and are not claimed here.
