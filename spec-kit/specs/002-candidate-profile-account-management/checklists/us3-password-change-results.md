# US3 Password Change Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Contract, policy, compatibility, PostgreSQL, and accessibility evidence

Command:

`npm.cmd test --workspace @smarthire/web -- --run tests/backend/contract/password-change.contract.test.ts tests/backend/unit/account/password-change-policy.test.ts tests/backend/unit/account/password-change-attempt-policy.test.ts tests/backend/compatibility/better-auth-password-change.test.ts tests/backend/integration/account/password-change-attempt-window.test.ts tests/backend/integration/account/password-change-operation.test.ts tests/backend/integration/account/password-change-security-effects.test.ts tests/frontend/accessibility/password-change.accessibility.test.tsx`

Result: **8 files passed, 30 tests passed**.

This run covers strict request/result contracts, Unicode code-point password
policy, only-wrong-current counting, rolling lock boundaries, Better Auth
1.6.25 compatibility, durable failure-injection milestones, initiating-session
continuity, zero-other-session verification, exactly-once protected mail/audit,
redaction, keyboard behavior, persistent/live feedback, and 320px-safe layout.

## Browser evidence

| Project            | Result                 | Coverage                                                                                                                                           |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-chromium` | PASS - 1 test in 22.1s | Five-failure lock, controlled expiry, successful change, current-session continuity, other-session rejection, old/new login, and confirmation mail |
| `mobile-320`       | PASS - 1 test in 21.8s | Same serial two-session journey at a 320px viewport                                                                                                |

The completed-response measurement observed the other authenticated session
become unusable within the required two-second polling window. Browser
execution also corrected two deterministic test-fixture defects: an ambiguous
accessible-name locator and a PostgreSQL reserved-word alias.

US3 is independently functional after the Foundation. No completed success is
returned while another required session remains usable.
