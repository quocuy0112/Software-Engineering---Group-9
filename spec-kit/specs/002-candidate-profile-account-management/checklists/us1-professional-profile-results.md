# US1 Professional Profile Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Test-first evidence

- T031-T039 were authored and observed failing before the US1 production
  implementation existed.
- Backend implementation was completed before the React profile editor.
- Browser execution exposed and drove fixes for empty collection IDs and
  cross-section refetch reconciliation; the final browser journeys pass.

## Contract, unit, PostgreSQL integration, and frontend evidence

Command:

`npm.cmd test -- --run tests/backend/contract/candidate-profile.contract.test.ts tests/backend/unit/profile/profile-validation.test.ts tests/backend/unit/profile/profile-plain-text.test.ts tests/backend/integration/profile/profile-authorization.test.ts tests/backend/integration/profile/profile-section-save.test.ts tests/backend/integration/profile/profile-concurrency.test.ts tests/frontend/components/profile-account/professional-profile-basics.test.tsx tests/frontend/accessibility/professional-profile.accessibility.test.tsx`

Result: **8 files passed, 46 tests passed**.

This run covers strict request/response contracts, phone/date/URL/cap
validation, plain-text sanitization, owner isolation, atomic section
replacement, stale-write behavior, concurrent normalized skill upserts,
explicit form saves, retained failure values, keyboard operation, ARIA
feedback, reduced motion, and 320px-safe styles.

## Browser evidence

| Project            | Result                 | Coverage                                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------- |
| `desktop-chromium` | PASS - 1 test in 22.5s | Complete profile, reload, stored XSS non-execution, stale write, cross-account denial |
| `mobile-320`       | PASS - 1 test in 21.8s | Same serial journey at a 320px viewport                                               |

Both projects used the pinned Playwright Chromium build and the capture email
adapter. Server and worker process trees exited after each run.

## Static and production evidence

| Command                 | Result                                               |
| ----------------------- | ---------------------------------------------------- |
| `npm.cmd run typecheck` | PASS                                                 |
| `npm.cmd run build`     | PASS - Next.js production build and route generation |

US1 is independently functional and deployable after the Foundation. US2,
US3, and US4 are not required for the professional-profile workflow.
