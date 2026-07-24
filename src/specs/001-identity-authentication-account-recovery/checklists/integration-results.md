# Phase 15 integration results (historical / superseded)

Recorded after the Phase 15 contract and PostgreSQL integration gates.
These results are retained as historical evidence only. They are not current
PASS claims for the reconciled Home, Profile, reset-saga, or full-recovery
scope; future evidence tasks must rerun the affected checks.

| Gate | Result | Evidence |
| --- | --- | --- |
| Contract suite | HISTORICAL PASS (superseded) | `npm run test:contract --workspace @smarthire/web`: 4 files, 12 tests |
| PostgreSQL integration suite | HISTORICAL PASS (superseded) | `npm run test:integration --workspace @smarthire/web`: 21 files, 72 tests |
| PostgreSQL readiness | HISTORICAL PASS (superseded) | `docker compose exec -T postgres pg_isready` accepted connections |
| Prisma validation/status | HISTORICAL PASS (superseded) | schema valid; 3 migrations applied; database up to date |
| Migration drift | HISTORICAL PASS (superseded) | `npm run db:verify` fresh migration, drift, and connectivity verification |
| Secret output gate | HISTORICAL PASS (superseded) | contract and integration assertions reject raw credentials/tokens/codes; test output contains no secret values |

The security integration boundary also proves cross-origin writes, unsafe
redirects, changing forwarded headers, rate-limit bypass attempts, and
management routes that do not trust browser-supplied `x-forwarded-for`.

## Focused recovery evidence (2026-07-23)

These are newly executed results for T204-T211 and are current for this
increment.

| Gate | Result | Evidence |
| --- | --- | --- |
| Recovery Vitest | PASS | 10 files, 25 tests: request/confirmation, hold, cancellation/completion races, login/protected-route blocking, route/email contracts, failure injection, secret safety, and PostgreSQL constraints |
| Reset regression | PASS | 10 focused files, 37 tests; normal reset still preserves Better Auth TOTP and unused backup codes |
| Better Auth compatibility | PASS | 4 files, 16 tests |
| Prisma schema/status | PASS | schema valid; 5 migrations applied; database up to date |
| Fresh migration/drift/connectivity | PASS | `npm run db:verify --workspace apps/web` passed against fresh PostgreSQL |
| Secret output/storage gate | PASS | raw proofs, passwords, cookies, TOTP values, and backup codes absent from persisted recovery evidence and captured output |

The controlled-clock tests advance the hold with explicit timestamps; no test
waits for 24 real hours. Cancellation has one winner and one replay loser;
completion has one claimant and one non-success loser. Failure injection covers
audit intent, hold session revocation, and password update retry safety.

## Final validation evidence (2026-07-24)

This validation supersedes the focused recovery totals above. It was executed
after the Better Auth internal sign-in rate-limit compatibility repair and the
session-revocation adapter repair, against PostgreSQL 16.12.

| Gate | Result | Evidence |
| --- | --- | --- |
| Better Auth compatibility | PASS | `npm run test:compatibility --workspace apps/web`: 4 files, 16 tests |
| Unit suite | PASS | `npm run test:unit --workspace apps/web`: 25 files, 113 tests |
| PostgreSQL integration suite | PASS | `npm run test:integration --workspace apps/web`: 28 files, 99 tests |
| Full Vitest | PASS | `npm run test --workspace apps/web -- --run`: 77 files, 280 tests |
| Prisma schema/status | PASS | schema valid; 5 migrations applied; database up to date |
| Fresh migration/drift/connectivity | PASS | `npm run db:verify --workspace apps/web` passed against fresh PostgreSQL |
| Static validation | PASS | lint, typecheck, production build, and `git diff --check` passed |
| Dependency audit | PASS | npm audit: Critical 0, High 0, Moderate 0, Low 0 |
| Secret/generated-file review | PASS | no configured secret value or secret file is tracked; three generic-pattern findings were reviewed test-only invalid literals; no unapproved validation artifact remains |

The validated compatibility baseline is Better Auth 1.6.13, Next.js 16.2.11,
Prisma 7.9.0, and PostCSS 8.5.22. No migration was added or modified during
validation.
