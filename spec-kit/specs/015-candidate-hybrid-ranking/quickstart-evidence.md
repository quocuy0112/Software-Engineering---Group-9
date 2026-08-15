# Feature 015 quickstart evidence

Date: 2026-08-15

## Completed locally

- Shared scoring contracts, deterministic automatic matching, hybrid formula, provider boundary/redaction, ranking route, four typed non-score states, rescore/retry/priority/decision route scaffolding, and the recruiter ranking UI are implemented.
- `npm run typecheck --workspace @smarthire/web`: pass.
- `npm run lint --workspace @smarthire/web`: pass.
- `npm run test:scoring --workspace @smarthire/web`: pass: 8 files, 18 tests.
- `npm run test:applications --workspace @smarthire/web`: pass: 6 files, 10 tests.
- `npm run scoring:contracts --workspace @smarthire/web`: pass.
- `npm run db:migrations:check --workspace @smarthire/web`: pass.
- `npm run perf:scoring --workspace @smarthire/web`: pass for the synthetic 10,000-row harness.
- `npm run scoring:retention --workspace @smarthire/web`: safe skip because `DATABASE_URL` is not configured.
- `npm run build --workspace @smarthire/web`: pass with deterministic local environment values.

## UI coverage

The ranking page and shared drawer/modal components cover the specified list, score filter, pagination, rescore, automatic-match, AI-assessment, CV/cover-letter, deterministic fallback, retry, manual-priority, interview, and rejection states. Scores carry explicit labels/icons, the human-decision notice is persistent, and the Group 1 document viewers are reused.

## Not run without infrastructure

The PostgreSQL migration application, live worker lease/recovery probes, provider-backed AI calls, notification delivery, full retention erasure/legal-hold execution, and Playwright E2E scenarios require the project infrastructure and fixtures. The implementation records safe no-database skips rather than treating those checks as passed.
