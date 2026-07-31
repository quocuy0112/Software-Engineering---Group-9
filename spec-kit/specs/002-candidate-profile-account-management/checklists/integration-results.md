# Integration and Non-Browser Regression Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Final full-suite evidence

Command:

`npm.cmd test`

Result: **122 test files passed, 513 tests passed**.

The final run covers unit, contract, PostgreSQL integration/concurrency,
architecture, compatibility, component/accessibility, email-worker, audit,
authorization, and regression suites for Feature 001 and Feature 002.

## Cross-feature findings resolved before the final pass

The first release-wide run correctly exposed two regressions that focused
Feature 002 gates did not:

1. The immutable EmailOutbox trigger prevented legacy `ON DELETE SET NULL`
   cleanup. A forward migration now allows relation detachment only while
   continuing to reject envelope mutation/retargeting. Its focused database
   regression passes.
2. Idempotent outbox comparison used order-sensitive `JSON.stringify` against
   PostgreSQL `jsonb`. It now uses structural deep equality, with a multi-key
   payload regression. Account-recovery/outbox focused evidence passes 4 files
   and 20 tests.
3. Password-change notification wording was aligned with the existing
   secret-free email regression.

After those corrections, the complete suite passed in one run.

## Forbidden-output result

Feature 002 redaction, proof/recipient confinement, raw-network protection,
client storage, architecture, and secret/privacy regression tests are included
in the 513-test pass. The final run emitted no password, proof, full
verification URL, plaintext protected recipient, cookie/session/CSRF value,
raw network header/address, profile request body, or raw provider/database
error finding.
