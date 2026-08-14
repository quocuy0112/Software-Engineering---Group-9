# Quickstart: Protected Messaging Report Review

## Prerequisites

- PostgreSQL configured through the existing `web/.env` environment.
- One active platform administrator with valid sensitive-action proof.
- Two active users with a protected messaging conversation and at least one message.

## Setup

From `web/`:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run dev
```

## Manual Acceptance

1. Sign in as a participant, open the conversation, report one message, and confirm the UI says the report was queued for protected review.
2. Open `http://console.admin.localhost:3001/#/messaging-reports` as an administrator.
3. Verify the queue row contains metadata only and does not reveal message/report detail.
4. Open the report. Complete fresh sensitive proof if required.
5. Verify the page shows the participant detail and exactly the selected evidence message, with no surrounding conversation history.
6. Assign the report, add a private note, and refresh. Verify version/history/note update once.
7. Resolve or dismiss the report. Verify the terminal state and that repeat terminal actions are rejected.
8. Link a separately authorized enforcement correlation and verify it appears in immutable history without triggering enforcement.
9. Open an unknown report ID and verify the safe unavailable response contains no protected content.

## Focused Verification

From `web/` run the feature-specific Vitest files, then:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The release check also verifies OpenAPI/Zod parity, administrator authorization and sensitive proof, idempotent replay, stale conflict, evidence/conversation mismatch, no full conversation query, participant confirmation copy, and a 10,000-report P95 measurement at or below 2 seconds.

## Recorded Performance Evidence

On 2026-08-13, `tests/performance/admin-management/messaging-report-review.performance.test.ts` ran against local PostgreSQL with 10,000 messaging reports, 3 warm-up requests, 20 measured requests, concurrency 1, page size 100, and no external service dependency. Results: P50 44.31 ms, P95 47.09 ms, P99/max 47.16 ms, and 0% errors. This satisfies the P95 ≤2 second target for the documented local environment; deployment environments must repeat the same test before release.
