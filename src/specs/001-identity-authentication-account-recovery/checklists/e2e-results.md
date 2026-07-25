# Phase 16 end-to-end results (historical / superseded)

Recorded on 2026-07-22 against the local PostgreSQL 16.12 Compose service, the capture email adapter, Next.js 16.2.9, Better Auth 1.6.11, and Chromium from Playwright 1.57.0.
These Playwright results are historical and superseded. They are not current
PASS claims for the reconciled public Home, protected Profile routes, reset
saga, or full account-recovery policy; T195/T210/T211 must produce new evidence.

| Profile | Command | Result |
| --- | --- | --- |
| Desktop Chromium | `npm run test:e2e --workspace @smarthire/web -- --project=desktop-chromium` | HISTORICAL PASS (superseded): 15/15 |
| Mobile 320 px | `npm run test:e2e --workspace @smarthire/web -- --project=mobile-320` | HISTORICAL PASS (superseded): 15/15 |
| Combined evidence | Both commands above, serialized against the same local stack | HISTORICAL PASS (superseded): 30/30 |

The historical flows cover registration and generic duplicate handling; verification, reuse, resend, and provider failure; verified/unverified/invalid/throttled login; safe redirects; the sole opaque session cookie; sanitized session listing, selected revocation, five-session eviction, logout, and immediate protected-page rejection; one-time password reset, all-session revocation, change notification, reset-link reuse rejection, and new-password login; deterministic TOTP enrollment and backup-code login; public/workspace navigation; database/email recovery fixtures; reduced motion; keyboard operation; labelled controls; and horizontal-overflow checks at 320 CSS px.

The negative-login scenarios intentionally cause Better Auth to report synthetic unknown test addresses to the local server stream. No password, cookie, session token, verification/reset URL, TOTP secret/code, backup code, SMTP credential, or provider response appeared in the captured output.

These automated results do not claim human completion-rate success. SC-001 and SC-012 remain governed by the separate usability-study protocol.

## Focused full-recovery evidence (2026-07-23)

The approved recovery workflow was run against a production Next.js build,
local PostgreSQL, and the capture email adapter. Each profile was run as a
separate reproducible stack invocation to keep the server-side rate-limit
subject isolated.

| Profile | Command | Result |
| --- | --- | --- |
| Desktop Chromium | `playwright test tests/e2e/auth/full-account-recovery.spec.ts --project=desktop-chromium` | PASS: 1/1 |
| Mobile 320 px | `playwright test tests/e2e/auth/full-account-recovery.spec.ts --project=mobile-320` | PASS: 1/1 |

This historical focused flow proved the then-current generic request handling,
verified-email confirmation,
fragment-only proofs, the lower-assurance notice, exact-clock hold advancement,
login/protected-route blocking, one-time cancellation and replay rejection,
post-hold completion, old TOTP/backup-code failure, new-password login, no
automatic session, cookie clearing, notification/audit state, and no
horizontal overflow at 320 CSS px. The combined same-stack invocation was not
used as evidence because its second serialized profile can share the local
rate-limit subject; the isolated profile runs above are the reproducible
current results.

These runs predate the eligibility-aware request amendment and are not evidence
for the current success/error differentiation.

## Final browser validation (2026-07-24)

The final runs used a production Next.js build, PostgreSQL 16.12, the capture
email adapter, Chromium, and `workers=1`. The browser stack was restarted
between focused groups so rate-limit state could not leak across evidence
groups.

| Group | Result |
| --- | --- |
| Public authentication | PASS: 7/7 |
| Password reset | PASS: 2/2 |
| Full account recovery | PASS: 1/1 |
| TOTP and backup codes | PASS: 2/2 |
| Session lifecycle | PASS: 1/1 |
| Home, Dashboard, and Profile | PASS: 1/1 |
| Mobile 320 px | PASS: 16/16 |
| Full Playwright suite | PASS: 32/32 (16 desktop, 16 mobile) |

The reset flow now reaches Better Auth through the SmartHire-owned durable
login limiter without being rejected by a second internal Better Auth IP
limiter. Direct access to the Better Auth sign-in endpoint retains its default
3-requests-per-10-seconds protection. The full browser suite proves a reset
password can log in, recovery login blocking remains fail closed, normal reset
preserves 2FA, and workspace/mobile behavior has no integration regression.
