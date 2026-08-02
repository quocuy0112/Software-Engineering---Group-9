# Feature 003 Migration Results

**Recorded**: 2026-08-02  
**Result**: BLOCKED for executable PostgreSQL verification

## Migration Shape

- Feature 003 now owns exactly one reviewed migration directory:
  `web/prisma/migrations/008_job_board_advanced_search/`.
- The exact decimal retained-CV constraint (`1..5,000,000` bytes) and all Job
  Board tables/invariants/indexes are consolidated into that migration because
  Feature 003 has not yet been merged or applied outside disposable development.
- Feature 004 correctly remains a separate migration directory,
  `008_cv_upload_parse_review`. Equal numeric prefixes are not a second Job Board
  migration; Prisma orders the distinct complete directory names.
- No Feature 001, 002, or 004 migration was edited for this consolidation.

## Static Validation

- `npm run db:validate`: PASS.
- Prisma models retain raw GIN `gin_trgm_ops` declarations for normalized title,
  normalized location, and normalized search document.
- Source/contracts and SQL consistently enforce the decimal `5,000,000`-byte cap.

## Executable Verification Blocker

The required clean, Feature 002-upgraded, and Feature 004-upgraded PostgreSQL
migration chains were not executed in this environment because Docker is not
installed or available on `PATH`. T062 and T068 therefore remain open.

## Untracked Generated Migration Warning

The pre-existing untracked directory
`web/prisma/migrations/20260802113056_snarthire/` was preserved and not edited.
Its SQL drops all three reviewed JobPosting trigram indexes and renames unrelated
Feature 001 indexes. It must not be committed or applied as-is. The safe follow-up
is to remove/regenerate that local migration after confirming it is disposable,
or manually retain only separately reviewed, genuinely required changes.

## Gate Conclusion

Static schema/migration review passes, but production or merged-branch migration
approval remains BLOCKED until the executable PostgreSQL chains pass and the
untracked conflicting migration is resolved by its owner.
