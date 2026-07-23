# Phase 16 end-to-end results

Recorded on 2026-07-22 against the local PostgreSQL 16.12 Compose service, the capture email adapter, Next.js 16.2.9, Better Auth 1.6.11, and Chromium from Playwright 1.57.0.

| Profile | Command | Result |
| --- | --- | --- |
| Desktop Chromium | `npm run test:e2e --workspace @smarthire/web -- --project=desktop-chromium` | PASS: 15/15 |
| Mobile 320 px | `npm run test:e2e --workspace @smarthire/web -- --project=mobile-320` | PASS: 15/15 |
| Combined evidence | Both commands above, serialized against the same local stack | PASS: 30/30 |

The passing flows cover registration and generic duplicate handling; verification, reuse, resend, and provider failure; verified/unverified/invalid/throttled login; safe redirects; the sole opaque session cookie; sanitized session listing, selected revocation, five-session eviction, logout, and immediate protected-page rejection; one-time password reset, all-session revocation, change notification, reset-link reuse rejection, and new-password login; deterministic TOTP enrollment and backup-code login; public/workspace navigation; database/email recovery fixtures; reduced motion; keyboard operation; labelled controls; and horizontal-overflow checks at 320 CSS px.

The negative-login scenarios intentionally cause Better Auth to report synthetic unknown test addresses to the local server stream. No password, cookie, session token, verification/reset URL, TOTP secret/code, backup code, SMTP credential, or provider response appeared in the captured output.

These automated results do not claim human completion-rate success. SC-001 and SC-012 remain governed by the separate usability-study protocol.
