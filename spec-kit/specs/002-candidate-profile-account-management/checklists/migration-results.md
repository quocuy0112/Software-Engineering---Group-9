# Migration Results

Date: 2026-07-31  
Feature: `002-candidate-profile-account-management`  
Result: **PASS**

## Clean database and Feature 001 upgrade

Command:

`npm.cmd run db:verify`

The verifier creates only the named temporary databases
`smarthire_migration_verify`, `smarthire_migration_upgrade_verify`, and
`smarthire_migration_shadow`, and removes them in `finally` cleanup.

Final result:

- clean deployment of all nine migrations: PASS;
- Prisma migration status and migration-to-schema drift: PASS;
- Prisma connectivity: PASS;
- Feature 001 baseline migrations 001-006 applied and recorded before upgrade:
  PASS;
- two pre-existing CandidateIdentity rows seeded before Feature 002: PASS;
- Feature 002 upgrade created exactly two CandidateProfile rows: PASS;
- missing CandidateProfile rows after backfill: zero;
- mandatory `account_security=true` database constraint rejection: PASS.

## Schema, client, and constraint evidence

| Command                                                                                                             | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run db:validate`                                                                                           | PASS - Prisma schema valid                                                                                                                                                 |
| `npm.cmd run db:generate --workspace @smarthire/web`                                                                | PASS - Prisma Client 7.9.0 regenerated                                                                                                                                     |
| `npm.cmd run db:status --workspace @smarthire/web`                                                                  | PASS - schema current                                                                                                                                                      |
| `npm.cmd test --workspace @smarthire/web -- --run tests/backend/integration/db/profile-account-constraints.test.ts` | PASS, including backfill, one-to-one ownership, ordering/caps, skill uniqueness, pending-email uniqueness, rollback, immutable outbox intent, and FK cleanup compatibility |

Generated Better Auth-owned `user`, `account`, and `session` fields remain
provider-owned. Feature 002 adds relations only and introduces no second
credential or session table.

## Forward-fix and recovery evidence

Migration `007_candidate_profile_account_management` remains unchanged after it
was applied. Full-suite validation found that its immutable outbox trigger
blocked the pre-existing `ON DELETE SET NULL` retention behavior. The reviewed
forward migration
`20260731191000_preserve_outbox_on_fk_cleanup` permits only non-null-to-null
relation detachment while continuing to reject recipient, payload, template,
idempotency, or relation retargeting.

Deployment recovery remains forward-only:

1. take a PostgreSQL backup before applying Feature 002;
2. stop application writes if a migration gate fails;
3. preserve all profile/account/outbox/audit data;
4. deploy a reviewed corrective migration and re-run this clean/upgrade gate;
5. restore the tested backup only if a safe forward correction cannot be
   completed before writes resume.

No applied Feature 001 migration or the protected unrelated
`20260731025418_test_ready` migration was edited.
