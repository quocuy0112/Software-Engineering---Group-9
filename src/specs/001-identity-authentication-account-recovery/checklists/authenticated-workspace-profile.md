# Authenticated Workspace and Profile Integration Readiness

This checklist validates requirement quality and implementation readiness. It
does not claim application completion or human usability-study evidence.

## Scope and traceability

- [x] The phase is limited to root authentication, public auth navigation, the authenticated shell, Dashboard, Profile Overview/Security/Sessions, legacy redirects, responsiveness, accessibility, and regression tests.
- [x] Candidate, Recruiter, Job, Application, Notification, Admin, analytics, and other recruitment-domain functionality remain excluded.
- [x] FR-069 through FR-071 and FR-073 through FR-074 plus SC-019 through SC-022 map to T187 through T196; normal-reset preservation FR-072 is covered by T197-T203.
- [x] Existing completed task IDs are preserved and T160 remains unchecked.

## Architecture and security

- [x] Better Auth remains the exclusive opaque browser-session and TOTP/backup-code owner.
- [x] `/` is the public SmartHire Home (with optional authenticated controls), `/home` server-redirects to `/`, and `/dashboard` plus Profile access are server-authorized with ACTIVE account-state enforcement and no client authentication flash.
- [x] The workspace client receives only a safe display projection plus the existing ephemeral logout CSRF proof.
- [x] Provisional pre-auth challenge state cannot authorize Dashboard or Profile.
- [x] A correct current password is explicitly defined as renewed proof for an old but otherwise valid ACTIVE session.
- [x] Better Auth replacement Set-Cookie forwarding is specified for enrollment verification and disablement with no-store handling.
- [x] Enabled 2FA state prevents accidental enrollment-start requests and secret rotation.
- [x] Legacy redirects discard query strings and do not forward secret-bearing parameters.

## Accessibility and testability

- [x] Profile Overview, Security, and Sessions are directly addressable with programmatic active state and browser history behavior.
- [x] Desktop and 320 CSS-pixel mobile navigation, focus visibility, keyboard operation, reduced motion, and overflow are executable acceptance criteria.
- [x] Password visibility defines eye/eye-off visual state, descriptive accessible name, aria-pressed, paste, autocomplete, and password-manager preservation.
- [x] Focused component, architecture, contract, integration, redirect, and real-browser tests precede completion.
- [x] Full validation includes environment, migration, typecheck, lint, all automated test layers, both Playwright viewports, production build, diff-check, and secret/storage scans.
- [x] No human completion-rate or usability evidence is fabricated by this phase.
