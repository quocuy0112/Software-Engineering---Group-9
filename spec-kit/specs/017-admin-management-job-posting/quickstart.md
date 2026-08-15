# Quickstart: Validate Administrator Job-Post Review and Approval

**Branch**: `017-admin-management-job-posting`

This guide is a pre-implementation validation contract. Run it after the tasks in `tasks.md` are implemented.

## Prerequisites

- Node.js 24.18.x
- PostgreSQL reachable through the existing SmartHire environment configuration
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
```

Expected:

- Review tables, enum values, unique identities, indexes, and notification context validate.
- No new Pages Router endpoint, second session mechanism, or direct JSON file access outside the catalogue repository exists.

## Migration and Legacy Adoption

```powershell
node --conditions=react-server --import tsx scripts/migrate-json-job-reviews.mjs --dry-run
node --conditions=react-server --import tsx scripts/verify-job-post-review-migration.mjs
```

Expected:

- Dry run reports pending/rejected candidates without writing.
- Rerunning adoption creates no duplicate aggregate/version/notification.
- Unresolved company or submitter mappings are reported and never guessed.
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

1. Open each active Administrator console and wait at most five seconds.
2. Confirm the unread count and generic alert contain no title, company name, submitter identity, reason, evidence, or note.
3. Open the alert and confirm it reaches the exact protected review.
4. Race claims from two Administrators.
5. Attempt a claim/read with the revoked Administrator.

Expected:

- One assignee wins; the loser receives current state/version.
- The opened recipient's notification is read without changing another recipient's row.
- Revoked authority receives a neutral denial.

## Complete Review and Decision

1. Open the assigned review and inspect every submitted field, company eligibility summary, submitter membership summary, prior-approved diff, and history.
2. Confirm protected evidence is linked through the existing viewer and not copied into review data.
3. Attempt approve without assignment, with a stale expected version, after company deactivation, after deadline expiry, and as a revoked Administrator.
4. Approve an eligible exact version twice with the same idempotency key and once with a conflicting key/body.
5. Reject a separate fixture without a reason, with unsafe/oversized text, and then with a valid reason/explanation plus private note.

Expected:

- Only one valid decision occurs.
- Blocked attempts are audited and never publish content.
- Approval exposes exactly the reviewed snapshot.
- Rejection stays non-public; Recruiter feedback excludes the private note.

## Active Edit and Resubmission

1. Materially edit an active legacy job.
2. Confirm the original active content is captured as an imported approved baseline and remains public.
3. Submit the edit, approve it, and confirm the public content changes atomically to the new snapshot.
4. Revise and resubmit a rejected job.

Expected:

- Each submit creates a new sequence; prior snapshots and decisions remain immutable.
- No unreviewed edit appears publicly.
- Imported baseline history is clearly distinguished from an Administrator decision.

## Failure and Integrity Recovery

Exercise:

- JSON write failure before submission transaction;
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
npx.cmd vitest run tests/backend/unit/job-post-reviews tests/backend/contract/job-post-reviews tests/backend/integration/job-post-reviews tests/frontend/components/job-post-reviews tests/frontend/accessibility/job-post-reviews tests/security/job-post-reviews tests/architecture/job-post-review-boundaries.test.ts tests/performance/job-post-reviews --passWithNoTests
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
