# End-to-end browser results

Recorded on 2026-07-31 against the local PostgreSQL Compose service, capture
email adapter, Node.js 24.18.0, Next.js 16.2.11, Better Auth 1.6.25, and
Playwright 1.57.0. Playwright ran with one worker so the shared database,
mailbox, rate limits, and session state remained deterministic.

## Release matrix

| Profile                     | Command                | Result                     |
| --------------------------- | ---------------------- | -------------------------- |
| Desktop Chromium            | `npm.cmd run test:e2e` | PASS: 20/20                |
| Mobile 320 px               | `npm.cmd run test:e2e` | PASS: 20/20                |
| Combined clean-start matrix | `npm.cmd run test:e2e` | PASS: 40/40 in 5.5 minutes |

The four Feature 002 journeys passed in each profile:

- professional profile: maximum representative sections, stale-write
  rejection, owner isolation, and inert rich-text/XSS payloads;
- account identity and email change: inert identity text, proof-bound
  verification, recipient separation, and session continuity;
- password change: recent-auth failure lock, expiry, credential replacement,
  and revocation of other sessions only; and
- account preferences: defaults, validation, persistence, and owner scoping.

The same uninterrupted run also passed all Feature 001 registration,
verification, login, session-cap, logout, password-reset, full-recovery, TOTP,
backup-code, navigation, responsive, and public-home regressions.

## Compatibility corrections verified

Focused reruns established the following before the full matrix:

| Focus                                                     | Result                                                   |
| --------------------------------------------------------- | -------------------------------------------------------- |
| Full account recovery, both profiles                      | PASS: 2/2                                                |
| TOTP and backup-code flows, both profiles                 | PASS: 4/4                                                |
| Login/session, throttling, navigation, and recovery group | PASS after the two corrected recovery message assertions |

Long stateful E2E scenarios clear only their own HMAC-addressed successful-login
test bucket after a proven successful login. This fixture isolation does not
change production policy or failure-path coverage; the dedicated login journey
still proves five failures are accepted and the sixth is throttled.

The four Better Auth `Invalid password` warnings in the server output correspond
to intentional negative-password assertions. No password, session/pre-auth
cookie, proof URL, TOTP secret/code, backup code, SMTP credential, or provider
payload appeared in the captured output.

These automated results do not claim representative-user first-attempt
completion. That evidence is owned by T137.
