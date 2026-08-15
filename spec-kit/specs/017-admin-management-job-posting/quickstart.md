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
