# US4 Account Preferences Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Contract, unit, PostgreSQL, and accessibility evidence

Command:

`npm.cmd test --workspace @smarthire/web -- --run tests/backend/contract/account-preferences.contract.test.ts tests/backend/unit/account/account-preferences-validation.test.ts tests/backend/integration/account/account-preferences.test.ts tests/frontend/accessibility/account-preferences.accessibility.test.tsx`

Result: **4 files passed, 17 tests passed**.

This run covers exact virtual defaults without a read-time write, strict
complete-set validation, supported and legacy timezone behavior, owner-only
atomic persistence, database enforcement of mandatory account-security mail,
rollback, labelled controls, keyboard/focus behavior, persistent and ARIA-live
feedback, and 320px-safe layout.

## Browser evidence

| Project            | Result                 | Coverage                                                                                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-chromium` | PASS - 1 test in 21.1s | Default read, invalid timezone retention, valid save, cross-session persistence, mandatory security mail, and cross-account isolation |
| `mobile-320`       | PASS - 1 test in 23.3s | Same serial owner/cross-session journey at a 320px viewport                                                                           |

Browser execution confirmed the feature-owned persistent alert independently
of Next.js's route-announcer element and corrected the E2E locator to scope that
accessible state to the Account preferences region.

US4 is independently functional after the Foundation, with preferences
authoritative across sessions and account-security notifications always
enabled.
