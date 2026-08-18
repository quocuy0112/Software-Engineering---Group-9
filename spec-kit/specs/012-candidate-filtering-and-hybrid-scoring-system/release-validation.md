# Feature 012 release validation

Date: 2026-08-15

## Implemented and verified

The Group 1 submission/document flow remains the canonical application and document boundary. The new ranking work composes the existing CV and cover-letter viewers rather than introducing a second document path.

| Check | Result |
| --- | --- |
| `npm run typecheck --workspace @smarthire/web` | Pass |
| `npm run lint --workspace @smarthire/web` | Pass |
| `npm run test:applications --workspace @smarthire/web` | Pass: 6 files, 10 tests |
| `npm run applications:contracts --workspace @smarthire/web` | Pass |
| `npm run db:migrations:check --workspace @smarthire/web` | Pass: 37 migrations, `001_identity_foundation` through `037_candidate_hybrid_ranking` |
| `npm run applications:migration:verify --workspace @smarthire/web` | Safe skip: `DATABASE_URL_NOT_CONFIGURED` |
| `npm run perf:applications --workspace @smarthire/web` | Pass: synthetic 10,000-row harness, 20 samples, no external services, 0% errors |
| `npm run build --workspace @smarthire/web` | Pass with deterministic local build configuration |

The build compiled, completed TypeScript, generated all static pages, and emitted the existing `pdfjs-dist` and dynamic-filesystem warnings. A build with no environment configuration fails at the existing server-environment guard before page-data collection; it is not a code compilation failure.

## Environment and limitations

- PostgreSQL, Docker, external AI, and the full browser E2E fixture were not available in this workspace, so migration application, live retention deadlines, live document storage, notification delivery, and production-like E2E remain pending environment checks.
- The performance result is a deterministic synthetic harness result. It is not a substitute for the documented PostgreSQL/worker/provider fixture.
- No real candidate data was used.
