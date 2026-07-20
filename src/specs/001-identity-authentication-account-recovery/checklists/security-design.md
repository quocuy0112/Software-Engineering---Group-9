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

## Implementation gate

Any unchecked item blocks `/speckit-implement`. Failure of Better Auth 1.6.11 TOTP/backup-code protection, atomic-use, session-hook ordering, or reset-revocation tests blocks implementation pending an approved extension/ADR. It must never produce duplicate authentication ownership.
