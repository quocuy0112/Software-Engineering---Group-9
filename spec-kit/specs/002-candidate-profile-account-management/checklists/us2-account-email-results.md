# US2 Account Identity and Email Change Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Test-first evidence

- T061-T069 were authored and observed failing before the US2 production
  implementation existed.
- Contract, normalization, persistence, concurrency, verification, delivery,
  accessibility, and browser behavior were implemented in dependency order.
- Browser execution exposed and drove fixes for an ambiguous full-name
  locator, the UI's full-name length constraint, and same-document fragment
  navigation during proof reuse.

## Contract, unit, PostgreSQL integration, delivery, and frontend evidence

Command:

`npm.cmd test -- --run tests/backend/contract/account-identity-email-change.contract.test.ts tests/backend/unit/account/identity-email-change-validation.test.ts tests/backend/integration/account/account-identity.test.ts tests/backend/integration/account/email-change-request.test.ts tests/backend/integration/account/email-change-concurrency.test.ts tests/backend/integration/account/email-change-verification.test.ts tests/backend/integration/email/email-change-delivery.test.ts tests/frontend/accessibility/account-identity-email-change.accessibility.test.tsx`

Result: **8 files passed, 34 tests passed**.

This run covers strict identity and email-change contracts, NFKC/plain-text
normalization, owner isolation, safe pending projections, idempotent request
binding, supersession, normalized-address claim races, 30-minute proof edges,
single-use verification, protected recipient delivery, proof confinement,
redaction, keyboard operation, live feedback, failure recovery, and 320px-safe
styles.

## Browser evidence

| Project            | Result                 | Coverage                                                                                                                                       |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-chromium` | PASS - 1 test in 30.0s | Inert stored identity payloads, old/new mail and login behavior, supersession, proof binding, reuse, malformed proof, and cross-account safety |
| `mobile-320`       | PASS - 1 test in 32.2s | Same serial security journey at a 320px viewport                                                                                               |

Both projects used the pinned Playwright Chromium build and capture email
adapter. The verification proof was removed from the fragment before explicit
confirmation, and every reusable/invalid proof failure reached the fresh-request
action without echoing proof material.

## Static and production evidence

| Command                 | Result                                               |
| ----------------------- | ---------------------------------------------------- |
| `npm.cmd run typecheck` | PASS                                                 |
| `npm.cmd run build`     | PASS - Next.js production build and route generation |

US2 is independently functional after the Foundation and does not require US1,
US3, or US4.
