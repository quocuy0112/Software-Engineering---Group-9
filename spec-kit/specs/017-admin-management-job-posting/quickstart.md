# Quickstart: Validate Administrator Job-Post Review and Approval

**Branch**: `017-admin-management-job-posting`

This guide is a pre-implementation validation contract. Run it after the tasks in `tasks.md` are implemented.

## Prerequisites

- Node.js 24.18.x
- PostgreSQL reachable through the existing SmartHire environment configuration
- Exactly one designated catalogue-writer host with one durable working-catalogue path; every other host configured read-only for Recruiter job mutations
- Dependencies installed in `web/`
- One active verified company with two active hiring-authority Recruiters
- Three users with active Platform Administrator grants and one revoked/expired control
- JSON fixtures for draft, active legacy, pending legacy, rejected legacy, malformed, and tampered jobs

## Static and Schema Gates

From `web/`:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrations:check
npm.cmd run typecheck
npm.cmd run lint
node --conditions=react-server --import tsx scripts/check-json-job-catalogue-writer.mjs
```

Expected:

- Review tables, enum values, unique identities, indexes, and notification context validate.
- No new Pages Router endpoint, second session mechanism, or direct JSON file access outside the catalogue repository exists.
- Catalogue preflight proves this host has the sole writer designation, the configured path is durable/writable, lease acquisition is exclusive across local processes, and checksum continuity holds; a read-only or invalid host rejects mutations.

## Migration and Legacy Adoption

```powershell
node --conditions=react-server --import tsx scripts/migrate-json-job-reviews.mjs --dry-run
node --conditions=react-server --import tsx scripts/verify-job-post-review-migration.mjs
```

Expected:

- Dry run reports pending/rejected candidates without writing.
- Rerunning adoption creates no duplicate aggregate/version/notification.
- Unresolved company or submitter mappings are reported and never guessed.
- Existing relational projections are linked only when stable slug, company, exact mapped baseline content, and unowned identity all match; collisions are reported and never overwritten.
- Existing unmanaged active jobs retain their legacy public behavior.

## Recruiter Submission

1. Sign in on the Recruiter origin as an active hiring-authority member.
2. Save an incomplete draft and confirm submission is blocked with field feedback.
3. Complete the draft and submit it twice, including one concurrent attempt.
4. Confirm one pending version, one content hash, one sequence, and a read-only pending editor state.
5. Confirm the pending job is neutral/unavailable through public search and direct detail.
6. Revoke the Recruiter's membership and confirm later protected reads/submissions are denied without revealing another tenant.

Expected:

- JSON remains valid and recoverable.
- PostgreSQL contains exactly one pending version and matching audit evidence.
- Each active Administrator receives one safe alert; inactive controls receive none.

## Administrator Discovery and Claim

### Recorded User Story 1 evidence (2026-08-15)

- Foundation commit: `1cf616d feat: add job post review foundation`.
- `npm.cmd run typecheck`: passed.
- Focused ESLint for the submission route, review services, Recruiter UI, and tests: passed.
- Focused Vitest command for submission contract, isolation, concurrency/failure boundaries, notification producer, Recruiter persistence/UI/accessibility, and architecture: 10 files passed, 22 tests passed.
- Database-connected migration, writer preflight, and end-to-end checks remain release gates and were not represented as locally passed by these isolated tests.

### Recorded User Story 2 evidence (2026-08-15)

- `npm.cmd run typecheck`: passed.
- Focused ESLint for the protected queue/detail/command routes, review service and repository, Administrator UI, shared contracts, and US2 tests: passed.
- US2 Vitest command for query/command contracts, notification/query/assignment integration boundaries, isolation, UI, and accessibility: 8 files passed, 8 tests passed.
- Expanded job-review regression command covering the foundation, Recruiter submission, Administrator discovery, notification producer/privacy, accessibility, and architecture boundaries: 21 files passed, 36 tests passed.
- The final review also added strict bounded queue parsing, contract-aligned state/assignment/company/age/submission-version filters, a common `calculatedAt`, transaction-time grant/session revalidation, inactive-account assignment recovery, reassignment private-note persistence, and the complete eligibility/diff/evidence UI projection.
- Database-connected concurrency, five-second notification freshness, browser end-to-end, and performance checks remain release gates and are not represented as locally passed by these isolated suites.

1. Open each active Administrator console and wait at most five seconds.
2. Confirm the unread count and generic alert contain no title, company name, submitter identity, reason, evidence, or note.
3. Open the alert and confirm it reaches the exact protected review.
4. Race claims from two Administrators.
5. Attempt a claim/read with the revoked Administrator.
6. Send a body command discriminator that does not match the path action.

Expected:

- One assignee wins; the loser receives current state/version.
- The opened recipient's notification is read without changing another recipient's row.
- Revoked authority receives a neutral denial.
- Action/body mismatch returns validation failure with no claim, assignment, history, or audit-success mutation.

## Complete Review and Decision

### Recorded User Story 3 evidence (2026-08-15)

- `npm.cmd run typecheck`: passed.
- Full-project `npm.cmd run lint -- --no-cache` and focused US3 ESLint: passed.
- `npm.cmd run test:job-post-reviews`: 30 files passed, 43 tests passed.
- Canonical job detail/search contract plus job-board/review architecture regression: 4 files passed, 13 tests passed.
- Migration sequence validation passed with 37 migrations and `036_job_post_review_authority` as the latest numbered migration.
- TDD evidence: the nine new US3 files initially failed 10/10 tests before decision policy, transaction, public authority, observability, and UI implementation; the same scope later passed 9 files and 10 tests.
- PostgreSQL-backed job integration tests, browser end-to-end, and decision concurrency/performance probes remain release gates: the configured database at `localhost:55432` was unavailable (`P1001`) during this run.
- Commit evidence is the English `feat: add administrator job post decisions` entry in Git history.

1. Open the assigned review and inspect every submitted field, company eligibility summary, submitter membership summary, prior-approved diff, and history.
2. Confirm protected evidence is linked through the existing viewer and not copied into review data.
3. Attempt approve without assignment, with a stale expected version, after company deactivation, after deadline expiry, and as a revoked Administrator.
4. Approve an eligible exact version twice with the same idempotency key and once with a conflicting key/body.
5. Reject a separate fixture without a reason, with unsafe/oversized text, and then with a valid reason/explanation plus private note.

Expected:

- Only one valid decision occurs.
- Blocked attempts are audited and never publish content.
- Approval atomically creates or replaces one aggregate-linked `JobPosting`/skill projection, and canonical `/jobs` search plus direct detail expose exactly the reviewed snapshot with server-owned publication facts.
- Pending/rejected versions create no public projection; a pending replacement leaves the last approved projection and public detail unchanged.
- Rejection stays non-public; Recruiter feedback excludes the private note.

## Active Edit and Resubmission

### Recorded User Story 4 evidence (2026-08-15)

- `npm.cmd run typecheck`: passed after restoring the recruiter workspace `company` projection on the editor, management, and route-view paths.
- Focused Vitest command for outcome notification, resubmission, isolation, UI, and accessibility: 5 files passed, 155 tests passed.
- The remaining Phase 7 release gates were not run in this pass.

1. Materially edit an active legacy job and confirm the pre-edit content is captured as an imported approved baseline with an exact linked/created public projection before the JSON working record changes.
2. Simulate failure of that first JSON edit and confirm the imported baseline remains unchanged and public; retry the edit successfully.
3. Submit the edit, approve it, and confirm the public content changes atomically to the new snapshot.
4. Revise and resubmit a rejected job.
5. While another replacement is pending, close the managed job and confirm both canonical search and direct detail stop exposing it; approve that pending version and confirm content/history update but the job remains closed.

Expected:

- Each submit creates a new sequence; prior snapshots and decisions remain immutable.
- No unreviewed edit appears publicly.
- Reapproval reuses the same aggregate-linked public identity instead of creating a duplicate job.
- Imported baseline history is clearly distinguished from an Administrator decision.

## Failure and Integrity Recovery

Exercise:

- JSON write failure before submission transaction;
- missing/duplicate writer designation, unwritable/non-durable catalogue path, or competing PostgreSQL writer lease;
- database/notification failure during submission;
- malformed or missing JSON after snapshot creation;
- JSON status tampering after approval;
- lost HTTP response and command replay;
- zero eligible Administrators;
- assignment authority revoked mid-review.

Expected:

- Zero unapproved public content.
- No partial critical review/audit/notification transaction.
- Approved snapshot remains available independently of mutable JSON state when ordinary visibility gates pass.
- Integrity blocks and unavailable queues are operationally discoverable with safe retry/reconciliation paths.

## Focused Automated Suites

```powershell
npx.cmd vitest run tests/backend/unit/job-post-reviews tests/backend/contract/job-post-reviews tests/backend/integration/job-post-reviews tests/backend/integration/notifications/notification-event-producers.test.ts tests/frontend/components/recruiter-workspace/job-post-review-submission.test.tsx tests/frontend/components/recruiter-workspace/job-post-review-outcome.test.tsx tests/frontend/components/admin-management/job-post-review-discovery.test.tsx tests/frontend/components/admin-management/job-post-review-decision.test.tsx tests/frontend/accessibility/job-post-reviews tests/frontend/accessibility/admin-management tests/security/job-post-reviews tests/security/notifications/job-post-review-notification-privacy.test.ts tests/architecture/job-post-review-boundaries.test.ts tests/performance/job-post-reviews --passWithNoTests
npx.cmd playwright test tests/system/e2e/job-post-reviews
```

Then run regressions:

```powershell
npm.cmd run test:notifications
npm.cmd run test:admin-management
npm.cmd run test:job-board
npm.cmd run test:business-verification
npm.cmd run build
```

## Performance Evidence

```powershell
node --conditions=react-server --import tsx scripts/measure-job-post-review-performance.mjs
```

The output must document environment, fixture counts, warm-up, measured sample size, duration, concurrency, nearest-rank P50/P95/P99/max, error rate, and database/file conditions. Release gates:

- notification-to-visible alert P95 <= 5 seconds;
- queue/detail/claim/decision visible feedback P95 <= 2 seconds;
- authorization, privacy, idempotency, audit, approved-snapshot visibility, and tenant isolation pass 100% of tested cases.

## Release Stop Conditions

Do not release when any of the following remains:

- any Critical, High, Medium, or Low Spec Kit analysis finding;
- any unreviewed managed content visible publicly;
- duplicate pending versions, assignments, decisions, or notifications;
- missing audit evidence or private-note leakage;
- unresolved schema/migration verification failure;
- serious/critical accessibility finding;
- undocumented performance conditions or threshold failure;
- regression failure in job, notification, Administrator, or verification workflows.

## Phase 7 Release-Gate Evidence (2026-08-16)

- Added migration adoption safety, notification privacy, authorization-matrix, and architecture-boundary coverage. Focused release-gate command: 5 files passed, 18 tests passed.
- `npm.cmd run typecheck`: passed.
- Focused ESLint for the added release-gate suites and performance harness: passed.
- `npm.cmd run db:migrations:check`: passed with 37 migrations; latest is `036_job_post_review_authority`.
- Performance self-test: Node `v24.18.0` on `win32`, 120 managed jobs, 36 pending reviews, 3 active Administrators, 3 warm-up runs, 9 measured samples, concurrency 3. Notification visible P95 432 ms, queue visible P95 160 ms, decision visible P95 910 ms; integrity/privacy/audit success rates were 100%.
- The performance result is deterministic self-test evidence with `managedDb: false`; a database-backed measurement remains required before release.
- PostgreSQL-backed migration/adoption verification was not run because the configured local database was unavailable in this workspace.
- Playwright review workflow/recovery was not run because the configured web server attempts to build Docker worker images and the Docker daemon is unavailable.
- Moderated usability execution was not run; the fixed protocol and raw-results template are present, but participant evidence remains pending.
- Static final-diff audit for the feature-owned boundaries found no review-specific direct JSON writes outside the catalogue repository, second session owner, automated decision path, or notification log fields containing snapshots/private notes; the focused architecture/privacy suites passed.
- `npm.cmd run db:validate`: passed. `npm.cmd run db:generate`: passed with Prisma Client 7.9.0.
- `npm.cmd run build`: passed with Next.js 16.3.0. The build emitted two existing dynamic-filesystem tracing warnings for the JSON catalogue and business-evidence storage paths; no build error occurred.
- The notification OpenAPI parity regression initially exposed a missing `JOB_POST_REVIEW` context enum; the contract was updated and the targeted parity/privacy command passed with 2 files and 6 tests. The remaining notification regression failures are PostgreSQL-backed setup/cleanup failures against unavailable `localhost:55432`.
- T112 harness execution was performed with the deterministic self-test dataset and threshold output recorded above; a live database-backed run remains required for release evidence.
- Regression status: job-board completed 33 passing and 9 skipped tests, with 6 PostgreSQL fixture failures. Administrator management timed out at 150 seconds after multiple PostgreSQL-backed integration failures. These are environment blockers, not assertion failures in the release-gate tests.
- Live regression rerun after applying migration 036: job-board passed 39 files/136 tests; business-verification passed 25 files/61 tests; notification passed 23 files/58 tests; full job-post review passed 39 files/213 tests; full lint passed.
- Adoption/verification rerun against PostgreSQL completed twice with identical output: 3 unresolved historical rows, zero adopted rows, zero invalid pointers, zero invalid hashes, zero invalid lifecycle rows, and zero missing terminal notifications. No database rows were written by the dry-runs.
- Prisma migration deployment applied `036_job_post_review_authority` successfully. `prisma migrate status` still reports pre-existing history drift because the database contains applied migration `20260815023247_smarthire`, which is absent from this checkout; this was not modified or removed.
- Serialized Administrator regression passed 72 files/187 tests using one Vitest fork and the live PostgreSQL database.
- The job-review Playwright server now starts successfully with Docker workers. The four workflow/recovery cases redirect to `/login` because no authenticated Recruiter/Administrator review fixtures are provisioned; they are not counted as passed.

## Verification Required To Close Remaining Tasks

- T108 requires two representative participants, one Recruiter and one Administrator, to execute the fixed usability protocol and provide first-attempt completion times, errors, and raw notes.
- T109-T111 require PostgreSQL reachable at `localhost:55432` or an equivalent `DATABASE_URL`, applied migrations, isolated legacy JSON fixtures, and permission to run adoption/verification twice without destructive cleanup.
- T110 is complete: the full notification, Administrator, job-board, and business-verification regression suites completed against the live database; the Recruiter workspace coverage is included in the full job-post review suite.
- T113 requires a running application plus Docker-backed worker services, provisioned Better Auth sessions, responsive browser access, and axe/keyboard validation fixtures.
- T115 requires explicit approval to create the final English Git commit; it has not been performed automatically.
