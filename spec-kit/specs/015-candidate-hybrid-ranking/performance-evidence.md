# Feature 015 performance evidence

Date: 2026-08-15

## Synthetic ranked-list harness

Command:

```powershell
npm run perf:scoring --workspace @smarthire/web
```

Result from the final verification pass:

| Field | Value |
| --- | --- |
| Dataset | 10,000 synthetic candidates |
| Samples | 20 |
| Warm-up | 0 |
| Concurrency | 1 |
| Percentile method | Nearest-rank |
| Provider | Synthetic, no network |
| Database | Not configured |
| Error rate | 0 |
| P50 | 2.5000 ms |
| P95 | 3.7853 ms |
| P99 / max | 6.1912 ms |

This proves the deterministic projection/filter harness and its percentile reporting. It does not claim database, queue, or provider latency.

## Contract and migration checks

- `npm run scoring:contracts --workspace @smarthire/web`: pass; verified the typed ranking page, detail state union, operation state, all four missing/processing labels, formula fields, compliance statement, and manual-priority contract.
- `npm run db:migrations:check --workspace @smarthire/web`: pass; the candidate-hybrid-ranking migration is the final ordered migration.
- `npm run applications:scoring --workspace @smarthire/web`: safe skip with `DATABASE_URL_NOT_CONFIGURED`.
- `npm run scoring:retention --workspace @smarthire/web`: safe skip with `DATABASE_URL_NOT_CONFIGURED`.

## Remaining production-like evidence

The PostgreSQL 10,000-row fixture, worker throughput, AI P95, rescore continuity under live writes, notification outbox delivery, and Playwright ranking/decision flow require the project database, worker runtime, and test adapters. They were not fabricated from the synthetic result.
