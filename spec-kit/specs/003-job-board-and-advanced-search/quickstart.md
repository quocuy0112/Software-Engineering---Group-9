# Quickstart: Validate Job Board and Advanced Search

This guide validates Feature 003 end to end. It is a run guide, not implementation code. The architecture under test is:

```text
Browser / Server Component
  -> Next.js App Router Route Handler or in-process service
  -> Job service
  -> Prisma repository / audit / rate-limit / notification-work boundary
  -> PostgreSQL 16.12
```

Better Auth 1.6.25 remains the exclusive browser-session owner. No hosted search, AI, CV-storage, or notification provider is required for routine validation.

## Prerequisites

- Node.js `24.18.x`, npm `11.16.x`, Docker, and Docker Compose.
- Root `package-lock.json` and existing installed dependencies; this feature adds no runtime package.
- PostgreSQL 16.12 through Compose on `localhost:55432`.
- Feature 001 identity and Feature 002 candidate profile migrations/runtime.
- Two disposable verified/active candidate accounts and isolated company/job/CV fixtures created by the focused test harness.
- Controlled Clock and documented performance environment.

Do not commit `.env`, `web/.env.local`, private CV fixture content, captured mail, logs, coverage, or test output. Do not use `npm run db:reset` during routine validation because it deletes the local PostgreSQL volume.

## Setup

From the repository root:

```bash
npm ci
npm run env:init
npm run db:up
npm run env:check
npm run db:migrate
npm run db:verify
npm run dev
```

Open `http://localhost:3001/jobs`. Focused Playwright setup creates and removes its own approved, closed, expired, private, pending, removed, and deadline-bound job fixtures plus confirmed/unconfirmed CV fixtures.

## Migration Gate

1. Run `npm run db:verify` against an empty temporary database and a Feature 002-upgraded database.
2. Confirm migration `008_job_board_advanced_search` is additive and no applied migration was edited.
3. Confirm `pg_trgm`, normalized search indexes, status/time indexes, composite saved/application unique constraints, nullable unresolved-report uniqueness, and answer/question ordering constraints.
4. Confirm salary both-or-neither/range constraints, CV PDF/DOCX/5-MB checks, application initial-stage check, and notification idempotency.
5. Confirm production migration contains no company/job/candidate/CV seed rows.
6. Confirm the reviewed roll-forward/recovery procedure in `plan.md` and preserve a database backup before applying to non-disposable data.

## Static and Contract Gates

```bash
npm run format --workspace @smarthire/web
npm run typecheck
npm run lint
npm run test:contract --workspace @smarthire/web
npm run build
```

Expected evidence:

- `contracts/openapi.yaml` parses as OpenAPI 3.1 and matches the Zod transport schemas.
- All job endpoints use App Router Route Handlers and contain no direct Prisma business query.
- Public serializers contain no recruiter contact, company membership/document, moderation reason, report, application, CV, or audit fields.
- Protected request schemas reject `userId`, `candidateUserId`, `accountId`, `sessionId`, and unknown fields.
- Frontend job modules do not import Prisma, server sessions, audit repositories, storage keys, or secrets.
- No search/action state, application draft, CV data, session, or CSRF proof is written to browser storage.

## Automated Validation

Run focused Feature 003 tests while iterating:

```bash
npm run test:job-board --workspace @smarthire/web
npm run test:e2e --workspace @smarthire/web -- tests/system/e2e/job-board
```

Run the release sequence:

```bash
npm run env:check
npm run db:validate
npm run db:verify
npm run format --workspace @smarthire/web
npm run typecheck
npm run lint
npm test
npm run test:e2e --workspace @smarthire/web -- --project=desktop-chromium
npm run test:e2e --workspace @smarthire/web -- --project=mobile-320
npm run build
npm run perf:job-board
```

PostgreSQL integration tests, not mocks or SQLite, are required for trigram search, partial/unique constraints, transaction rollback, rate limits, and concurrent mutation evidence.

## Walkthrough 1: Browse and Search

1. Seed jobs whose titles/locations/skills differ only by case and Vietnamese diacritics plus active, future, closed, expired, pending, rejected, and removed states.
2. Open `/jobs` without signing in. Confirm only active approved jobs in their publication/application window appear.
3. Search `lap trinh vien`, `LẬP TRÌNH VIÊN`, and spacing/case variants. Confirm identical IDs while public display retains original text.
4. Combine location, employment type, experience level, work arrangement, salary/currency/period, skill, and posting-date filters. Confirm AND semantics and an updated safe URL.
5. Exercise relevance, newest, and salary sorting; confirm stable ID tie-breaks, null-salary placement, next cursor, no duplicate IDs, and total count.
6. Submit inverted salary, malformed enum/cursor, overlong terms, unsupported currency, and excessive arrays. Confirm field errors preserve other valid criteria and no query error leaks.
7. Confirm empty results differ from `503`, include Clear/change actions, and are announced accessibly.
8. Close/remove a job between cursor requests. Confirm it is not reintroduced as active and remaining results stay usable.

## Walkthrough 2: Job Details and Login Return

1. Open a canonical active job URL and verify the complete approved public job/company projection and available visitor actions.
2. Open previously public closed and expired jobs. Confirm their status is textual/non-color and Apply is unavailable.
3. Open unknown, draft, pending, rejected, removed, and never-public identifiers. Confirm the same neutral unavailable view and no moderation/state leak.
4. Select Save, Report, and Apply as a visitor. Confirm login receives only a validated internal `/jobs/...` return destination and returns safely after authentication.
5. Compare two users. Confirm saved/applied action state is scoped to the current session and never publicly cached across users.

## Walkthrough 3: Save and Remove

1. Sign in as candidate A and save one active job from the list. Confirm one relationship and consistent list/detail controls.
2. Repeat and race saves. Confirm one row and successful authoritative saved state.
3. Remove and race removals. Confirm no row and successful authoritative unsaved state.
4. Inject persistence failure and confirm prior state remains visible after reconciliation with a retry action.
5. Revoke/expire the session and submit a stale protected action. Confirm no write, safe login path, and no other-user row changes.
6. Make a saved job unavailable and verify only a neutral historical reference remains when returned by a later saved-jobs group.

## Walkthrough 4: Report

1. Submit each supported reason. Confirm `OTHER`, `MISLEADING`, and `DISCRIMINATORY` require 20-2,000 characters and all text is stored/rendered as bounded plain text.
2. Repeat the same unresolved job/reason concern. Confirm one private row and neutral duplicate confirmation.
3. Submit another permitted reason for the same job. Confirm it is distinct.
4. Exceed five accepted attempts in 15 minutes. Confirm safe `429`, `Retry-After`, and a privacy-minimized abuse audit without report content.
5. Inject a transaction failure. Confirm no false success, partial report, or success audit.
6. Confirm report alone leaves JobPosting unchanged and reporter/content are absent from public and company job APIs.

## Walkthrough 5: Apply

1. Candidate A must have name, headline, location, one confirmed PDF/DOCX CV <= 5 MB, and no existing application. Open Apply and verify only A's confirmed unarchived CVs.
2. Submit all required TEXT/BOOLEAN/SINGLE_CHOICE answers, optional cover letter, and active consent.
3. Confirm exactly one application with stage `APPLIED`, candidate/job/CV linkage, bounded v1 snapshots, question snapshots/answers, consent evidence, successful audit, and two pending notification-work rows.
4. Repeat the identical idempotency key and body. Confirm the existing successful application with no duplicate audit/notification work.
5. Reuse the key with another CV/answer/cover/consent. Confirm `409` and no mutation.
6. Race different keys for the same candidate/job. Confirm exactly one application is authoritative.
7. Test missing profile fields, no confirmed CV, foreign/archived/oversized CV, missing/unknown/duplicate answers, invalid choice, missing consent, and stale consent. Confirm field-safe failures with no application.
8. Close the job or pass its deadline immediately before commit. Confirm no application or false success.
9. Inject failures after each intended transaction milestone. Confirm application, answers, audit, and notification work all roll back together.
10. Simulate unavailable notification delivery after commit. Confirm application remains valid and work stays retryable.

## Authorization and Privacy Matrix

For every protected read/mutation:

- use visitor, active Candidate, suspended/deleted account, revoked/expired session, and candidate B against candidate A resources;
- omit/alter Origin, Fetch Metadata, and `X-CSRF-Token` on protected writes;
- inject ownership/session fields and foreign job/CV/question/application IDs;
- repeat concurrent requests;
- inspect responses, ordinary logs, audit, analytics, and notifications for raw search text, report detail, answers, cover letter, profile/CV snapshot, object key, checksum, cookie/token, CSRF proof, raw headers/IP, or provider/database errors.

No unauthorized mutation or sensitive disclosure is acceptable.

## Accessibility and Responsive Evidence

At desktop and 320 CSS pixels verify:

- semantic landmarks/headings, result counts, fieldsets/legends, labels, descriptions, and stable focus order;
- keyboard-only filters, clear-all, result links, save, report dialog, CV selection, answers, consent, submit, cancel, retry, and dialog close;
- focus moves to the error summary/first invalid field and returns to the invoking control;
- busy controls expose state and prevent accidental duplicate submits;
- loading, empty, validation, success, closed, expired, unavailable, saved, reported, and applied states do not rely on color;
- failed requests preserve safe form values and avoid horizontal overflow.

## Performance Evidence

Build first, then run `npm run perf:job-board`. The harness uses PostgreSQL 16.12 and records CPU, memory, database latency, browser/build, cold/warm state, dataset, sample size, percentile method, and external-service conditions.

Dataset: 100,000 historical/public postings, at least 10,000 active, representative Vietnamese text, skills, locations and filter distributions, candidate action relationships, and 20 questions per selected job. Measure at least 100 warm samples for browse, normalized keyword, maximum supported filter combination, next-cursor, active detail, neutral detail, save/remove, report validation, and application form/commit.

The command fails if p95 search/filter or detail exceeds two seconds, public page load exceeds three seconds, protected interaction result exceeds two seconds excluding external delivery, any result page exceeds 50, or duplicate IDs/actions appear.

## Troubleshooting

- **No jobs appear**: inspect only status/approval/publication/deadline aggregate counts; do not log private posting records.
- **Vietnamese search differs**: compare the normalization unit fixture and persisted normalized fields; repair via reviewed roll-forward rather than altering an applied migration.
- **Protected action returns 403**: reload the authoritative page/session-bound CSRF proof and confirm same-origin headers; never weaken the boundary.
- **Apply returns conflict**: retain the same session, Idempotency-Key, and unchanged submission for a retry. A changed submission requires a new key but cannot bypass the one-application rule.
- **Integration tests leave fixtures**: rerun their scoped teardown/reconciliation; do not delete broad database, workspace, or captured-data paths.
