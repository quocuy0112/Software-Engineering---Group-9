# Phase 15 integration results

Recorded after the Phase 15 contract and PostgreSQL integration gates.

| Gate | Result | Evidence |
| --- | --- | --- |
| Contract suite | PASS | `npm run test:contract --workspace @smarthire/web`: 4 files, 12 tests |
| PostgreSQL integration suite | PASS | `npm run test:integration --workspace @smarthire/web`: 21 files, 72 tests |
| PostgreSQL readiness | PASS | `docker compose exec -T postgres pg_isready` accepted connections |
| Prisma validation/status | PASS | schema valid; 3 migrations applied; database up to date |
| Migration drift | PASS | `npm run db:verify` fresh migration, drift, and connectivity verification |
| Secret output gate | PASS | contract and integration assertions reject raw credentials/tokens/codes; test output contains no secret values |

The security integration boundary also proves cross-origin writes, unsafe
redirects, changing forwarded headers, rate-limit bypass attempts, and
management routes that do not trust browser-supplied `x-forwarded-for`.
