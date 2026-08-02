# Feature 004 Migration Verification Results

**Recorded:** 2026-08-02  
**Local result:** **PASS**  
**Production backup/restore evidence:** **NOT VERIFIED BY THIS RUN**

## Environment and Isolation

- PostgreSQL image/runtime: `postgres:16.12`.
- Fresh test database: `cv_phase8_migration_20260802_01`.
- Both `DATABASE_URL` and `DIRECT_URL` were overridden to that exact database.
- Commands were run from `web/` with `TZ=UTC` for the test process.
- The database was created immediately before the run and dropped by the
  command's `finally` block. The shared development database `smarthire` was not
  reset, rolled back, or targeted.

## Fresh-Database Gate

| Check | Exact result |
| ----- | ------------ |
| `npm run db:validate` | Prisma schema valid |
| `npm run db:generate` | Prisma Client 7.9.0 generated successfully |
| `prisma migrate deploy` | Migrations 001 through 008 applied successfully in order |
| `npm run db:status` | 8 migrations found; schema up to date |
| Feature 004 PostgreSQL constraint suite | 1 file passed; 8/8 tests passed; 2.64s Vitest duration |

The constraint suite verified the exact enums; aggregate account/Profile foreign
keys; byte, state, quota, retention, and receipt checks; negative/over-cap quota
rejection; partial claim/cleanup/one-active-parse indexes; append-only consent,
retry, confirmation, and terminal-attempt behavior; exact latest live external
consent lookup; and forward-only migration documentation.

## Clean and Forward-Upgrade Verifier

`npm run db:verify` completed in 239.6 seconds and reported:

1. fresh migration, drift, and Prisma connectivity verification passed;
2. the existing Feature 001/Profile backfill upgrade and constraint verification
   passed; and
3. Feature 004 migration over migrations 001–007 passed with existing Profile
   data preserved, no eager quota backfill, no drift, the one-active-parse
   partial index present, the consent append-only trigger present, and exactly
   one completed 008 migration record.

The verifier uses only its named disposable verification/shadow/upgrade
databases and removes them in `finally`. It was extended to establish the full
001–007 schema first, insert a revision-7 existing Profile, apply 008, and prove
that the headline/revision remain unchanged.

## Rollback-Safety Review

- Migrations 001–007 remain immutable; migration 008 is additive and
  forward-only.
- Migration 008 documents rollback safety and contains no drop of the Better
  Auth `user`/`Session` or existing `CandidateProfile` structures.
- Operational rollback means disabling new upload and parse dispatch while the
  cleanup/reconciliation owner continues until retained content is purged.
- An applied 008 migration must not be deleted, edited, marked rolled back, or
  reversed by resetting a database. A defect is corrected through a reviewed
  forward migration after taking the owning environment's backup.
- Storage objects must be deleted through retention/cleanup ownership rather
  than independently during application rollback, preserving quota and audit
  consistency.

This local gate does not prove a production backup exists or that a restore has
been rehearsed against production infrastructure. Trusted production backup,
restore, and forward-fix evidence remains a release-control input to the final
quality gate.
