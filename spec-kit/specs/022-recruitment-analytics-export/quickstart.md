# Quickstart: Recruitment Analytics & Data Export Validation

## Prerequisites

- PostgreSQL test database configured for the `web` workspace.
- Node.js 24.x and project dependencies installed.
- Test identities: one active Platform Administrator; two verified companies; active Employer memberships in each; one suspended membership; Candidates with and without published screening results.
- Fixtures spanning the platform time-zone boundary, posting lifecycle changes, qualified/repeated/owner/bot views, all nine canonical application stages, and at least one 10,000-application posting.
- Private export storage configured for the test environment; external email/AI calls disabled or stubbed because this feature reads existing score results and sends no AI request.

## Artifact Review

Before implementation validation, review:

- [Specification](./spec.md)
- [Implementation plan](./plan.md)
- [Data model](./data-model.md)
- [HTTP contract](./contracts/recruitment-analytics-export.openapi.yaml)

## Setup and Static Checks

Run from `web/`:

```powershell
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
```

Apply the feature migration in the disposable test database, then run the feature migration verifier. The verifier must prove view uniqueness, lifecycle baseline/version ordering, export lease/idempotency rules, expiry indexes, and safe rollback/disable behavior.

## Scenario 1: Administrator Growth Dashboard

1. Sign in with the active Administrator grant.
2. Request daily, weekly, monthly, and custom ranges in `Asia/Ho_Chi_Minh`.
3. Compare registrations, bucket-end active postings, cohort application success, and applications per submitting Candidate with fixture calculations.
4. Confirm the displayed range, grouping, time zone, cutoff, metric definitions, zero states, and table equivalents.
5. Request a range beginning before `analyticsAvailableFrom` and confirm rejection identifies the earliest supported date without estimated history.
6. Repeat with an ordinary user and confirm a neutral denial with no aggregate leakage.

Expected: all buckets use `[from,to)`, active postings reflect state at each bucket end, Hired status is reconstructed at the report cutoff, and all metrics share one cutoff.

## Scenario 2: Employer Posting Performance

1. Open the authorized company's job report.
2. Confirm repeated same-day visitor loads count once while next-day loads may count again; owner previews and bot fixtures do not count.
3. Verify views, submissions, conversion, zero-view not-applicable behavior, and all nine current funnel stages.
4. Switch to the second company or suspended membership and attempt the first company's report.

Expected: no cross-company result is disclosed; the funnel contains each application exactly once and is labeled as a current cutoff snapshot.

## Scenario 3: CSV and XLSX Export Parity

1. Request CSV with an idempotency key; replay the same request and confirm one business export.
2. Request XLSX at the same data cutoff.
3. Change a Candidate's live profile after submission, then open both files and compare headers, application identities, contact-snapshot names/email/phone, statuses, score availability/values, row counts, and metadata.
4. Include Vietnamese diacritics, commas, quotes, line breaks, and values beginning—with and without whitespace/tabs—with `=`, `+`, `-`, and `@`.

Expected: both files contain the same canonical rows; formula-like text is inert; no address or extra profile data appears; missing scores are explicitly unavailable; 10,000 rows complete within the target at P95.

## Scenario 4: Export Revocation and Expiry

1. Start an export, revoke the requester's membership before generation completes, and let the worker claim it.
2. Restore authority, generate a successful export, and download it before expiry.
3. Revoke authority and retry; then test again at exactly 24 hours after completion.
4. Run cleanup twice.

Expected: worker/download authorization is freshly checked; revoked/expired artifacts are unavailable; cleanup is idempotent; no partial file is served; only privacy-safe audit metadata remains.

## Scenario 5: Administrator Activity (P2)

1. Seed login, logout, posting-created/deleted, application-submitted, stage-transition, and export events across roles/dates.
2. Filter by range, role, and action; verify cursor paging and posting/application aggregates.
3. Test deleted/anonymized actors and targets, 24-month expiry, active legal hold, and hold release.

Expected: history stays understandable without restoring personal content; unauthorized users see nothing; held records survive only within authorized scope.

## Automated Verification

Run the focused commands introduced by implementation:

```powershell
npm run test:recruitment-analytics
npm run test:recruitment-analytics:e2e
npm run perf:recruitment-analytics
npm run recruitment-analytics:migration:verify
```

Then run `npm test` and `npm run build`. Performance evidence must record environment, dataset, concurrency, sample size, duration, percentile method, p50/p95/p99/max, error rate, and storage/external-service conditions.

## Moderated Usability Validation

Run the fixed Administrator and Employer scenarios with a documented representative participant cohort. Measure first-attempt success for applying a date filter, interpreting metric definitions, and obtaining the intended report/export. The pass threshold is at least 90%; retain aggregate results only and no participant recruitment data in ordinary test artifacts.

## Pass Conditions

- All specification acceptance scenarios and contract/security tests pass.
- Dashboard/report results match independent fixture calculations exactly.
- CSV/XLSX required fields and rows have 100% parity.
- Every cross-tenant, revoked, expired, and non-Administrator access case is denied without disclosure.
- Dashboard/report/export P95 goals and error-rate target pass under documented representative conditions.
- Accessibility checks confirm keyboard operation, labels, focus, status announcements, text/table chart alternatives, and non-color meaning.
