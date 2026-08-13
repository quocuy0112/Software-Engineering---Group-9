# Quickstart — Admin User Management and Recruiter Verification

## Purpose

This runbook validates the planned Feature 009 implementation against its three
peer specifications. Execute the gates in order: Group 1, Group 2, Group 3, then
cross-module regression. Do not use production accounts, evidence, email, or
credentials.

Commands marked **planned** become available during implementation; their names
are part of this plan's tooling contract and must be added to the root and web
workspace package scripts.

## 1. Local prerequisites

- Node.js 24.18.x and npm 11.16.x.
- Docker with Compose v2.
- PostgreSQL 16.12.
- The repository's pinned ClamAV image with official signatures no older than
  24 hours. The scanner remains Unix-socket-only and fail-closed.
- Local capture email adapter; never use a real SMTP recipient for this run.
- Synthetic image/PDF business-license fixtures only.

Initialize ignored local configuration and verify the environment:

```powershell
npm ci
npm run env:init
npm run env:check
docker compose up -d --build postgres clamav admin-worker
docker compose ps postgres clamav admin-worker
```

If ClamAV reports signatures older than 24 hours, stop and wait for an official
mirror refresh or repair the approved mirror path. Do not raise the freshness
limit, enable scanner TCP, skip evidence qualification, or edit timestamps.

## 2. Database and contract setup

Apply and verify the planned migration after implementation:

```powershell
npm run db:validate
npm run db:deploy
npm run db:migrations:check
npm run db:verify
npm run admin:moderation:migration:verify
```

Migration `022_admin_user_management_refinement` must:

- add nullable `RecruiterVerificationRequest.adminComment`;
- preserve all existing account, identity, company, membership, job,
  application, verification, evidence, decision, session, audit, rationale,
  notification, and outbox rows;
- add only the reviewed directory indexes; and
- leave historical rejected reasons explicitly unavailable when no
  authoritative value exists.

Validate documentation contracts before application tests:

```powershell
npm run admin:contracts
npm run typecheck
npm run lint
```

The contract check must parse
`contracts/admin-user-verification.openapi.yaml`, resolve every local `$ref`,
reject duplicate operation IDs, and confirm no current Request Changes route or
provider command appears in the Feature 009 surface.

## 3. Deterministic fixture matrix

Create synthetic fixtures through test factories/seed helpers, not direct UI
editing. Use a fixed UTC clock and include at least:

| Fixture | Required state |
|---|---|
| `candidate_active` | Active account, 2 CV records, 3 submitted applications |
| `candidate_suspended` | Suspended account with existing application and no current session |
| `recruiter_active` | Active account with qualifying authority in two Active verified companies |
| `recruiter_jobs` | Active 2, Pending Review 1, Rejected 1, Draft 1, Closed 1, plus ExPIRED/Removed controls |
| `recruiter_suspended` | Suspended account whose existing public job remains independently visible |
| `platform_admin_target` | Active unexpired Platform Administrator grant; must be protected from Suspend and Restore |
| `verification_ready` | Active applicant, Pending Review, current qualified clean evidence, current prerequisite |
| `verification_suspended` | Suspended applicant, Pending Review, deadline still advancing |
| `verification_stale` | Pending Review whose evidence/prerequisite/version changes between read and decision |
| `verification_legacy` | Historical Changes Requested/Resubmitted and Rejected row without stored reason |

All names, emails, company names, tax codes, and document contents must be
synthetic. Fixtures must include at least 10,000 generated accounts for the
directory performance run without reusing the correctness database.

## 4. Group 1 gate — Account directory

Run the planned focused suite:

```powershell
npm run test:admin-user-verification -- --group=1
npm run perf:admin-user-verification -- --group=1
```

Verify repository and API behavior:

1. Combined, Candidates-only, and Recruiters-only filters use the current
   qualifying-authority classifier; suspended accounts retain their type.
2. Keyword matches account reference, display name, and email case-insensitively; date endpoints are
   inclusive and invalid ranges return safe field errors.
3. Lifecycle status, combined filters, page reset, 25/50/100 page sizes, total,
   and fixed `registeredAt DESC, id ASC` ordering are deterministic.
4. Candidate counts equal all CV records and submitted applications.
5. Recruiter counts use distinct qualifying companies and show exactly Active,
   Pending Review, Rejected, Draft, and Closed. Expired/Removed are excluded.
6. Page reads use bounded bulk aggregates. Query-count assertions detect N+1;
   a failed aggregate produces unavailable, never a fabricated zero.
7. Detail fields match list definitions, add authority entries/history/action
   eligibility, and reveal no CV/application content or session data.
8. Loading, empty, recoverable error, stale/refetch, desktop, and narrow/mobile
   states pass keyboard and axe checks.

On the 10,000-account dataset, record p95 response/render measurements and the
reviewed `EXPLAIN (ANALYZE, BUFFERS)` output. The implementation must meet the
success criteria in the Group 1 spec before Group 2 begins.

## 5. Group 2 gate — Recruiter verification

Run:

```powershell
npm run test:admin-user-verification -- --group=2
npm run test:admin-user-verification:e2e -- --group=2
npm run perf:admin-user-verification -- --group=2
```

Verify queue and review behavior:

1. Default queue contains qualified Pending Review requests for Active
   applicants only, oldest first. Suspended-only and Any filters locate the
   suspended fixture without changing its request lifecycle.
2. Company, exact tax code, lifecycle/date-or-age, applicant, assignment,
   pagination, resubmission count, and freshness behave as specified.
3. List responses contain no evidence locator, capability, internal safety
   response, or protected note.
4. Detail presents company/tax code, applicant eligibility, prerequisite,
   version and decision histories, notes, and safe current evidence metadata.
5. Image and PDF viewers enforce current capability, no-store, media type,
   keyboard operation, accessibility, and safe unavailable/error recovery.

Verify decisions:

1. Approval on `verification_ready` atomically creates/reuses the company as
   specified, grants exactly one qualifying membership, marks the request
   Approved, preserves Candidate identity, writes decision/audit, and creates
   exactly one dual-channel verification outcome with one email and one in-app
   delivery work item.
2. Rejection refuses missing category or a normalized reason outside 10–500
   characters. A valid rejection stores `adminComment`, marks all evidence
   immediately inaccessible, schedules deletion within 24 hours, writes
   decision/audit, and creates the same single outcome with email and in-app
   delivery states containing only allowlisted applicant-visible content.
3. There is no current Request Changes control, provider command, or route;
   legacy Changes Requested/Resubmitted history remains readable.
4. Duplicate/replayed idempotency keys return one business outcome. Concurrent
   reviewers, stale version, changed evidence, expired/revoked prerequisite,
   duplicate authority, or applicant suspension cannot partially approve or
   reject.
5. `verification_suspended` returns the safe non-actionable result. Restoration
   causes a refetch and enables decisions only if every original condition is
   still current; deadlines and retention never reset.

Use fake-clock worker tests to prove rejected/cancelled/expired/superseded
evidence is deleted within 24 hours and Approved evidence follows the Active
company-verification plus 30-day rule. Worker replay must be idempotent and must
not grant authority.

## 6. Group 3 gate — Suspension and restoration

Run:

```powershell
npm run test:admin-user-verification -- --group=3
npm run test:admin-user-verification:e2e -- --group=3
npm run perf:admin-user-verification -- --group=3
```

Verify command behavior:

1. Suspend requires an Active eligible account, category, 10–500-character
   normalized reason, expected version, fresh proof, CSRF, and idempotency key.
2. Within one business outcome it sets Suspended, revokes all sessions,
   consumes unfinished challenges, appends allowlisted audit, stores encrypted
   365-day rationale, and queues exactly one mandatory security email.
3. Restore requires Suspended and performs the equivalent audit/rationale/email
   outcome, sets Active, and creates no session.
4. Every current Platform Administrator target—including the actor—is blocked
   for both commands. The denied outcome is audited while account state,
   sessions, rationale, and notification work remain unchanged.
5. Same-key replay is stable; concurrent/stale commands cannot produce duplicate
   events or state transitions.

Run failure injection at every write boundary: account update, session revoke,
challenge consumption, audit, rationale, security-notification work, and outbox.
A database failure must roll back the entire business outcome. Email delivery
failure occurs after commit, remains observable/retryable, and never rolls back
or duplicates account state.

Verify user and independent-workflow effects:

1. Within the specified enforcement window, suspended logins and Candidate/
   Recruiter commands are denied with the support/dispute route.
2. Existing public jobs retain their posting/moderation visibility.
3. Existing applications remain company records; another authorized Recruiter
   can continue allowed processing under the application workflow's own rules.
4. CVs, applications, jobs, memberships, verification state, and scores are not
   mutated by suspension or restoration.
5. Security notification is email-only and mandatory. Capture output contains
   allowed action/result/time/reason-category/support information, not plaintext
   protected rationale or internal identifiers.
6. History renders new `ACCOUNT_RESTORED` and historical
   `ACCOUNT_REINSTATED` consistently as Restore. Rationale reveal requires
   fresh proof and becomes unavailable/deleted on the 365-day/24-hour schedule.

## 7. Cross-module regression

Run existing suites after all group gates pass:

```powershell
npm run test:admin-management
npm run test:admin-management:e2e
npm run test:job-board
npm run test:cv-import
npm run test:e2e
npm run build
```

The regression set must specifically cover:

- Candidate Become/Reapply as Recruiter field names, statuses, rejection reason,
  and email/next-action triggers;
- exclusive admin/public session lifecycle and immediate authority revocation;
- company-scoped Recruiter entitlement and application processing;
- public job visibility and posting/moderation lifecycles;
- evidence private-storage/scanner boundaries and retention workers; and
- immutable audit/outbox compatibility for historical Restore naming.

## 8. Release evidence and recovery

Store only sanitized, non-production evidence in the repository-approved local
evidence directory. The release bundle must include:

- contract/schema/checksum results;
- migration count comparisons and query plans;
- per-group unit/integration/E2E/accessibility results;
- concurrency and failure-injection outcomes;
- performance percentiles and dataset description;
- privacy/URL/cache/telemetry inspection;
- retention fake-clock results; and
- cross-module regression results.

Recovery is forward-only. If rollout fails, disable the new UI entry points and
workers as planned, preserve all committed audit/outbox/history data, correct the
application or add a forward migration, and replay only idempotent work. Never
delete audit rows, rewrite delivered emails, restore evidence past its retention
policy, or roll back by dropping populated columns/indexes without a separately
reviewed recovery migration.
