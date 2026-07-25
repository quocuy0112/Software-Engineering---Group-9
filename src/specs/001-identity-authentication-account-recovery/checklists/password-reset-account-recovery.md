# Password Reset Hardening and Account Recovery Readiness

This checklist records the approved policy and focused implementation evidence
for the reset and full-recovery increments.

## Normal password-reset saga

- [x] Normal reset updates the password through Better Auth and preserves the
  Better Auth-owned TOTP secret and every unused backup code.
- [x] The durable operation claims one HMAC-digested reset token, records an
  audit intent, updates the password, revokes all sessions, invalidates
  authentication challenges, enqueues one idempotent notification, emits the
  final audit event, and finalizes.
- [x] The saga is explicitly fail-closed across provider boundaries; it does
  not claim one cross-provider database transaction.
- [x] Retries resume the same operation, concurrent submissions have one
  claimant, SmartHire effects are idempotent, ambiguous password-provider
  results converge safely, and login remains blocked until mandatory cleanup
  and finalization are durable.
- [x] Normal reset requires a new login and, when 2FA remains enabled, the
  existing TOTP or an unused backup code.
- [x] Normal-reset T197 scope and T198-T203 implementation, failure-injection,
  concurrency, and integration evidence are complete. The
  `FullAccountRecoveryOperation` scope is completed by T204-T211 below.

## Full account-recovery MVP policy

- [x] The workflow is separate from normal reset and is only for loss of the
  password, TOTP access, and backup codes.
- [x] Requests distinguish malformed input, unknown or ineligible accounts, and
  eligible accounts; verified-email confirmation is required;
  confirmation, completion, and cancellation proofs are HMAC-digested and
  single-use.
- [x] Confirmation creates one durable operation, revokes sessions and
  challenges, starts a 24-hour security hold, and blocks password and
  second-factor login while pending.
- [x] A one-time cancellation proof can cancel an incomplete operation and
  queues a notification; cancellation restores ordinary credential login
  policy while already-revoked sessions remain revoked.
- [x] After the hold, completion changes the Better Auth password and disables
  old TOTP and backup codes only in the full-recovery completion step, then
  records durable audit/notification state, revokes sessions/challenges, and
  requires a new login without automatic authentication.
- [x] UI and notification copy explicitly disclose that email-only recovery is
  lower assurance than using the original password and second factor.
- [x] T204-T210 implementation, controlled-clock, integration, and E2E
  evidence complete.

## Evidence

- Normal-reset T197-T203 evidence remains historical/superseded where it
  predates this reconciliation; the focused regression run below passed
  without changing normal-reset 2FA-preservation semantics.
- PostgreSQL migration `005_full_account_recovery` is applied after migration
  `004_password_reset_recovery_operations` (004 was not edited). Prisma
  validation/status and fresh-database, drift, and connectivity verification
  all passed.
- Historical focused recovery Vitest: 10 files, 25 tests passed, including
  the then-current generic request/rate limiting, fragment-proof routes, exact hold, cancellation
  and completion concurrency, login/protected-route blocking, failure
  injection, notification idempotency, secret safety, and PostgreSQL
  constraints.
- Current focused normal-reset regression: 10 files, 37 tests passed, plus
  Better Auth compatibility: 4 files, 16 tests passed.
- Recovery concurrency: cancellation raced with two contenders (one winner,
  one replay loser); completion raced with two contenders (one claimant and
  one non-success loser); completion and cancellation notifications each have
  one durable idempotency identity.
- Recovery failure injection: 3 scenarios passed: audit-intent failure before
  password mutation, hold session-revocation failure with retry, and
  password-update failure with retry-safe durable state.
- Historical Playwright recovery: desktop Chromium 1/1 passed and mobile-320 1/1
  passed in separate reproducible production-stack runs. The workflow covers
  the then-current generic request, verified-email confirmation, lower-assurance
  notice, exact-clock hold advancement, login blocking, one-time cancellation,
  post-hold completion, old-factor failure, new-password login, no automatic
  session, fragment-only proofs, and 320 px overflow checks.
- These historical runs predate the eligibility-aware request amendment and
  are not evidence for the current success/error differentiation.
- Secret/storage inspection found no raw reset/recovery proof, password,
  cookie, TOTP secret/code, or backup code in operation, outbox, audit, or
  captured output.

- [x] T211 records only newly executed, truthful reset/recovery evidence; old
  Vitest, Playwright, integration, and performance results remain explicitly
  historical or superseded.
