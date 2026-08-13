# Implementation Plan: Admin User Management and Recruiter Verification

**Branch**: `009-user-management-and-recruiter-verification` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Clarified Group 1, Group 2, and Group 3 specifications indexed by
`spec-kit/specs/009-user-management-and-recruiter-verification/spec.md`.

## Summary

Extend the existing Feature 006 Platform Administrator console rather than
create a second administration application. Group 1 enriches the existing
account list with exact Candidate/Recruiter classification, registration-date
filters, bounded per-account Candidate and company-scoped job activity
aggregates, and a dedicated account-detail projection. Group 2 narrows employer
verification to Approve/Reject, exposes the clarified queue/detail/evidence
contract, stores the applicant-visible rejection reason, blocks decisions while
the applicant account is suspended, and preserves the existing evidence,
company-membership, audit, outbox, and worker infrastructure. Group 3 tightens
the existing account command transaction so Suspend/Restore cannot target a
current Platform Administrator, preserves job/application state, projects
moderation history from the existing append-only audit stream, and sends exactly
one mandatory security email per committed action.

The existing Better Auth opaque-cookie session, designated administrator
session, 15-minute step-up proof, React Admin console, PostgreSQL database,
Prisma repositories, private evidence store, email outbox, and admin worker
remain authoritative. One bounded migration adds the missing persisted
rejection reason and directory indexes; it does not create a second account,
verification, moderation-log, or notification authority.

Implementation follows the requested order: complete and independently verify
Group 1, then Group 2, then Group 3.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`, React `19.2.3`

**Primary Dependencies**: Existing Next.js `16.3.0` App Router, React Admin
`5.15.1`, MUI `7.3.11`, Better Auth `1.6.25`, Zod `4.3.6`, Prisma and
`@prisma/adapter-pg` `7.9.0`, PostgreSQL driver `8.16.3`, TanStack Query
`5.101.4`, `pdfjs-dist` `6.2.108`, existing private-storage/scanner/email
adapters, Tailwind CSS `4.1.18`, and existing SmartHire tokens; no new package

**Storage**: Existing PostgreSQL `16.12` plus the existing purpose-specific
encrypted business-evidence namespace. Migration `022` adds an optional
`adminComment` persistence field with future-write invariants and directory
query indexes. `AuditEvent`, `PrivilegedActionRationale`,
`SecurityNotificationWork`, and `EmailOutbox` remain the only audit, rationale,
security-email work, and delivery authorities.

**Testing**: Existing Vitest `4.1.10`, Testing Library `16.3.1`, Playwright
`1.57.0`, axe-core `4.12.1`, Prisma migration/integration tests, Zod/OpenAPI
parity checks, fake-clock worker tests, security/privacy canaries, architecture
tests, performance harnesses, and existing Feature 006/007 regressions

**Target Platform**: Existing Linux-hosted full-stack Next.js application at
port 3001; data-dense React Admin console on the exact Admin origin with
desktop/tablet/narrow-screen support down to 320 CSS px and 200% text zoom

**Project Type**: Existing full-stack Next.js modular monolith plus the existing
admin worker and email worker processes

**Performance Goals**: Initial authenticated pages P95 `<=3s`; Group 1 confirmed
search/filter and Group 2 queue/filter/detail navigation P95 `<=2s`; Group 3
detail/history navigation P95 `<=2s`; committed suspension invalidates all
existing sessions/challenges for protected use within 2 seconds. The fixed
release-equivalent protocols use the exact datasets, warm-ups, 200 measured
samples, 10 concurrent administrator sessions, nearest-rank P95, and error
limits in the three group specifications. Authorization, tenant isolation,
transaction integrity, evidence safety/privacy, and retention/deletion
deadlines remain 100-percent gates.

**Constraints**: One Better Auth browser session only; exact Admin-origin gate
before protected data; server authorization on every read/write; 15-minute
step-up for evidence and privileged actions; no client-persistent protected
records; pessimistic versioned commands; one active verified company membership
is the Recruiter authority unit; no Group 2 Request changes action; no
Suspend/Restore against a current Platform Administrator; no automatic job,
application, membership, verification-state, or score mutation from account
suspension; mandatory security email and no Group 3 in-app notification

**Scale/Scope**: At least 10,000 directory accounts, 1,000 open/historical
verification requests, 100 rows maximum per list page, five displayed job
status aggregates, three independently verifiable functional groups, existing
admin/evidence/email workers, and no unbounded per-row reads

## Constitution Check

*GATE evaluated before Phase 0 and re-checked after Phase 1 design.*

| Principle | Plan evidence | Status |
|---|---|---|
| I. Human-Controlled Recruitment | Verification approval/rejection, account suspension/restoration, and later application transitions remain explicit authorized human actions. No AI decision or automatic Candidate disadvantage is added. | Pass |
| II. Security, Privacy, Tenant Isolation | The exact Admin origin, exclusive Better Auth cookie session, current administrator grant/designated session, fresh step-up, private evidence capability, masked identity fields, verified company membership, and server-side tenant checks are reused. Protected data is excluded from URLs, persistent browser state, analytics, ordinary logs, and applicant/security-email payloads except their allowlisted fields. | Pass |
| III. Deterministic Core and Explainable AI | Directory classification, aggregates, verification eligibility, state transitions, retention, notification schedules, and suspension effects are deterministic. No AI or external semantic provider is introduced. | Pass |
| IV. State, Audit, Data Integrity | PostgreSQL remains authoritative; critical commands use version checks, idempotency receipts, transactions, audit, rationale, and outbox/work records. Moderation history is derived from `AuditEvent`, avoiding a competing log. Existing application and posting states are never rewritten by suspension. | Pass |
| V. Scope Discipline and Complete P0 Workflows | The plan covers only the three approved P0 groups in sequence. Session revocation, membership administration, moderation reports, account deletion, dispute adjudication, analytics, export, bulk actions, and AI classification remain outside this feature. | Pass |
| VI. Measurable Quality and Accessible Experience | Exact list/detail/viewer/dialog states, keyboard/focus behavior, non-color labels, responsive layouts, fixed performance protocols, 20-participant usability protocols, accessibility scans, and hard privacy/integrity/deletion gates are mapped to verification artifacts. | Pass |
| VII. Maintainable and Provider-Independent Architecture | Existing Next.js Route Handlers, Zod contracts, service/transaction boundaries, Prisma repositories, React Admin provider, private-storage port, notification dispatcher, and worker loops are extended. No dependency, provider coupling, alternate route mechanism, or browser-session mechanism is added. | Pass |

No gate violation blocks research or design.

## Exclusive Browser Session Lifecycle

Better Auth `1.6.25` remains SmartHire's single browser-session owner. Feature
009 neither creates nor stores another token.

- The existing email/password plus TOTP flow creates an opaque PostgreSQL-backed
  session only after the ordinary account checks succeed.
- The opaque credential remains only in the configured `HttpOnly`, production
  `Secure`, `SameSite=Lax`, `Path=/` cookie. It never enters React Admin memory,
  TanStack Query data, Zustand, `localStorage`, or `sessionStorage`.
- The existing Admin-origin request boundary validates the current ACTIVE
  account, ACTIVE/unexpired Platform Administrator grant, designated session,
  ordinary/absolute/idle expiry, and replacement state before any feature read.
- Evidence preview/download and every Approve, Reject, Suspend, Restore, or
  protected-rationale read additionally require proof no older than 15 minutes.
- Suspend commits account state plus revocation of every session and unfinished
  authentication challenge in one transaction. Every later protected request
  revalidates account state; stale pages and in-flight commands cannot bypass it.
- Restore permits a new authentication only. No old session, challenge,
  separately restricted membership, or moderated content is revived.
- Logout, administrator-session replacement, password reset/recovery, and
  ordinary session caps retain their existing Feature 006 behavior and audit.

## Architecture and Data Flow

```text
React Admin console (memory store, no optimistic privileged writes)
  |
  v
Next.js App Router /api/admin/** Route Handlers
  |
  +-- exact Admin-origin + Better Auth/admin grant/designated session boundary
  +-- Zod query/body/header validation
  |
  v
Feature services / command transactions
  |-- Group 1: directory/detail projection services
  |-- Group 2: verification review + approval/rejection transactions
  `-- Group 3: account lifecycle transaction + history projection
  |
  v
Repository ports / Prisma implementations
  |-- PostgreSQL authoritative records
  |-- private business-evidence storage capability
  `-- AuditEvent / rationale / notification work / EmailOutbox

Admin worker
  |-- evidence safety and retention
  |-- verification delay/expiry reconciliation
  |-- verification decision email/in-app notification reconciliation
  |-- rationale cleanup
  `-- security-email work reconciliation

Email worker -> replaceable email provider
```

Only repository implementations import Prisma. Route handlers perform transport
work only; services own deterministic read rules; command transactions own
locks, current-state checks, idempotency, atomic writes, and audit/outbox effects.

## Group 1 Design — User Account Directory

### Read projection

Replace the current membership-oriented account row with an explicit
`AccountDirectoryItem` projection. The base account query accepts only ACTIVE
or SUSPENDED accounts, locks ordering to `createdAt DESC, id ASC`, and applies
keyword (account reference, display name, or email), account-type, inclusive
registration date, lifecycle status, page, and page-size filters on the server.

Recruiter-enabled means at least one ACTIVE membership in a company whose
verification state is ACTIVE. Account suspension does not remove this
classification. Candidate-only means no such current authority. Platform
Administrator grant is not an account type and is projected only as a protected
action-eligibility fact in account detail.

After selecting at most 100 account IDs for a page, repositories issue bounded
bulk aggregate queries—not one query per row—for:

- all `CandidateCv` records and all submitted `JobApplication` records by
  Candidate identity;
- ACTIVE, PENDING_REVIEW, REJECTED, DRAFT, and CLOSED `JobPosting` counts across
  the account's distinct ACTIVE memberships in ACTIVE verified companies; and
- per-company authority entries for detail.

`EXPIRED` and `REMOVED` postings remain outside the five displayed counts and
are never silently folded into another status. Detail reuses the same aggregate
definitions, adds account lifecycle/version/freshness, and composes Group 3
action eligibility/history without exposing sessions unless the existing
separate security view is explicitly opened.

### Query and index strategy

Migration `022_admin_user_management_refinement` adds case-insensitive trigram
indexes for account name/normalized email and a lifecycle/registration stable-
order index. Existing Candidate CV, application, membership, and company-job
indexes support page-bounded aggregate queries; migration verification uses
`EXPLAIN` against the representative dataset and adds only a missing covering
index proven necessary by that evidence.

No aggregate summary table or cache is introduced. Counts remain current reads
from authoritative records, with a visible `calculatedAt` timestamp and an
explicit unavailable/error result rather than fabricated zero.

## Group 2 Design — Business Verification Approval

### Queue and review projection

Extend the existing `verification-requests` React Admin resource and repository:

- default to qualified PENDING_REVIEW requests whose applicant account is
  ACTIVE;
- add the Active applicant / Applicant suspended / Any operational filter while
  keeping account eligibility separate from verification lifecycle state;
- retain state/date-or-age/company/exact-tax-code/applicant/read-only-assignment
  filters and stable oldest-first ordering;
- expose exact queue fields, resubmission count, account eligibility, and
  current calculation time without evidence capability or internal check data;
- compose detail from applicant, target-company/prerequisite, current evidence,
  version history, decision history, protected notes, and applicant eligibility.

`assignedAdminUserId` remains nullable read-only workload metadata. Feature 009
adds no Claim, Unassign, or Reassign command.

### Decision eligibility and transaction

Approve and Reject share one transaction-local eligibility loader. At the
decision boundary it locks/rechecks:

1. request state/version is the reviewed PENDING_REVIEW version;
2. applicant account is ACTIVE;
3. current evidence ID/version exists, all four safety checks PASS, content is
   accessible, and no deletion/supersession condition applies;
4. current administrator authority/designated session/fresh proof remain valid;
5. for existing companies, the exact relationship prerequisite remains current,
   scoped, unused, unrevoked, and unexpired; and
6. no duplicate ACTIVE authority already exists.

Approval reuses the existing company/membership/request/decision/audit/outbox
transaction and preserves Candidate identity. Both approval and rejection write
their decision/audit rows plus exactly one idempotent
`VerificationNotificationEvent` as part of that same business outcome.
Rejection validates one category,
10–500-character normalized applicant-visible reason, and optional protected
note; it persists the reason as `RecruiterVerificationRequest.adminComment`,
marks every request evidence version inaccessible with deletion due within 24
hours. The event is the single outcome authority
and creates one email outbox child and one in-app notification work item, each
with its own retryable delivery state. Approval and rejection return both
channel states; delivery failure or delay never rolls back the committed
decision and no protected fields enter either channel. Group 3 remains
email-only through `SecurityNotificationWork`.

The old Request changes control and generated provider command are removed from
the Group 2 UI/contract. Existing CHANGES_REQUESTED and RESUBMITTED records stay
readable lifecycle/history states, and Candidate-side resubmission compatibility
remains intact.

### Suspension overlay and retention

Account suspension changes no verification lifecycle field and pauses no
deadline. The default queue excludes the request, the operational suspended
filter can locate it, and decision endpoints fail current-state validation.
After restoration, the request becomes actionable only if it is still qualified
PENDING_REVIEW; expiration, evidence deletion, or invalidity is never reset.

Superseded evidence and evidence for REJECTED, CANCELLED, or EXPIRED requests
becomes inaccessible immediately and is physically deleted within 24 hours.
APPROVED evidence remains available only while the associated company
verification is ACTIVE, then becomes inaccessible immediately and is deleted
within 30 days. Worker reconciliation is idempotent and cannot change authority.

## Group 3 Design — Account Suspension and Restoration

### Eligibility and atomic commands

The existing account command transaction is tightened for both Suspend and
Restore. After acquiring the command/idempotency boundary it locks the target
account and reads current unexpired ACTIVE Platform Administrator grants. Any
such grant returns the same safe `ACTION_BLOCKED` outcome, including for the
acting administrator. Feature 009 never revokes that authority; the separate
operator workflow must complete first.

The protected-target branch commits an allowlisted DENIED `AuditEvent` and the
stable command-receipt outcome, then returns the safe block. It changes no
account/session/challenge, creates no rationale or security-email work, and
does not expose grant detail. If that denial cannot be audited, the command
still performs no target mutation and returns the correlation-safe failure.

Suspend requires ACTIVE plus expected version, atomically changes SUSPENDED,
revokes all sessions, consumes unfinished challenges, appends the allowlisted
audit event, creates the encrypted 365-day rationale, and enqueues exactly one
mandatory security-email work item. Restore requires SUSPENDED plus expected
version and atomically changes ACTIVE, appends the audit/rationale, and enqueues
one mandatory restore email; it creates no session.

The new canonical event is `ACCOUNT_RESTORED`. Existing historical
`ACCOUNT_REINSTATED` notification/audit rows remain readable through a
compatibility mapping and are not rewritten. The UI and feature contract use
Restore consistently.

### Effects and independent workflows

Current account state is enforced in shared authentication and command
boundaries. Candidate/recruiter commands initiated by the suspended account
fail, while unauthenticated public job browsing remains available. Suspension
does not mutate Candidate profile/CV data, applications, memberships, jobs,
verification state, or scoring.

Existing applications remain company-owned recruitment records. Other
authorized recruiters may continue viewing and performing allowed stage/actions
under the application workflow's own tenant, transition, audit, and notification
rules. Existing jobs retain their own company/posting/moderation visibility.

### History, rationale, and email

`AccountModerationLog` is an API/read-model projection over allowlisted
`AuditEvent` rows for account Suspend/Restore success, denial, and failure. No
second log table is created. The projection returns actor reference, target,
action, prior/resulting state, category, result, time, and correlation only.

Rationale remains encrypted in `PrivilegedActionRationale`, requires current
authority and fresh proof, becomes inaccessible at 365 calendar days, and is
deleted within the following 24 hours. `SecurityNotificationWork` remains an
email-only durable work record linked to `EmailOutbox`; no in-app notification
record is created. The suspended-login result independently derives account
state and support/dispute destination so it remains correct during email delay
or permanent failure.

The allowlisted security-email payload contains the action, resulting state,
occurrence time, non-sensitive reason category, next action, and support/dispute
destination. It never contains the protected rationale, administrator identity,
session data, internal correlation, or raw audit context.

## Contracts and Provider Design

The formal HTTP delta is [admin-user-verification.openapi.yaml](./contracts/admin-user-verification.openapi.yaml).
The React Admin/UI behavior is [admin-console-contract.md](./contracts/admin-console-contract.md).

The provider continues to use same-origin relative URLs, `credentials: include`,
`cache: no-store`, AbortSignal propagation, memory-only React Admin store/query
cache, Zod response validation, and cache purge before authority-loss
navigation. Generic create/update/delete and bulk actions remain unsupported.

Privileged commands include CSRF proof, `Idempotency-Key`, and `If-Match`; they
use pessimistic mutation mode and refetch authoritative detail after success.
The approved UI routes contain no account email, tax code, evidence, rationale,
session, or storage reference.

## Migration and Backward Compatibility

Create migration `022_admin_user_management_refinement`:

1. Add nullable `adminComment` to `RecruiterVerificationRequest`; all new
   REJECTED transitions enforce normalized 10–500 characters in the Zod/service
   boundary and transaction. Existing REJECTED rows without an authoritative
   stored reason remain immutable legacy rows exposed as reason unavailable;
   no text is fabricated or recovered from ordinary logs.
2. Add the account lifecycle/registration and trigram indexes selected in
   `data-model.md`; validate plans on at least 10,000 representative accounts.
3. Add no account moderation table, notification channel table, aggregate table,
   role column, global recruiter flag, or alternate session record.
4. Do not rewrite immutable audit events or delivered email rows. Map historical
   `admin.account_reinstated`/`ACCOUNT_REINSTATED` to the canonical Restore
   presentation while new events use Restore naming.
5. Migration verification compares account/request/evidence/membership/job/
   application counts and confirms no lifecycle, authority, stage, score,
   session, document locator, or audit context changes.

## Requirement Coverage

| Specification | Design coverage | Primary verification |
|---|---|---|
| Group 1 `FR-001`–`FR-025` | Bounded directory/detail projections, exact classification/filters/counts, masked identity, freshness, responsive read-only UI | Repository integration, contract/provider, component/accessibility, performance/usability, zero-write regression |
| Group 1 `AC-001`–`AC-011`, `SC-001`–`SC-009` | Fixed data/order/page/count definitions and release protocols | Quickstart Group 1 matrix and machine-readable release evidence |
| Group 2 `G2-FR-001`–`G2-FR-031` | Qualified queue/detail/viewer, applicant overlay, transaction-local decision gates, company authority, rejection reason, retention, audit/outbox, no Request changes | State-machine/unit, migration, repository/transaction, worker fake-clock, contract/UI, privacy/concurrency tests |
| Group 2 `G2-AC-001`–`G2-AC-013`, `G2-SC-001`–`G2-SC-012` | Exact lifecycle/evidence/decision/recovery behavior and fixed validation protocols | Quickstart Group 2 matrix, evidence qualification run, performance/usability/privacy evidence |
| Group 3 `G3-FR-001`–`G3-FR-030` | Admin-target block, atomic state/session/audit/rationale/email outcome, independent resource preservation, history, retries, accessibility | Command integration/failure injection, auth/application/job regressions, provider/component/accessibility, worker and retention tests |
| Group 3 `G3-AC-001`–`G3-AC-012`, `G3-SC-001`–`G3-SC-011` | Exact suspend/restore effects, email-only delivery, cross-workflow behavior, fixed release protocols | Quickstart Group 3 matrix, 2-second enforcement, performance/usability/privacy evidence |

Every future task must name at least one requirement/acceptance/success range and
must preserve the Group 1 → Group 2 → Group 3 implementation order.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/009-user-management-and-recruiter-verification/
|-- spec.md
|-- spec-group-1-user-account-directory.md
|-- spec-group-2-business-verification-approval.md
|-- spec-group-3-account-suspension-restoration.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- checklists/
|   `-- requirements.md
`-- contracts/
    |-- admin-user-verification.openapi.yaml
    `-- admin-console-contract.md
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/022_admin_user_management_refinement/migration.sql
|-- src/
|   |-- app/api/admin/
|   |   |-- accounts/route.ts
|   |   |-- accounts/[accountId]/route.ts
|   |   |-- accounts/[accountId]/suspend/route.ts
|   |   |-- accounts/[accountId]/restore/route.ts
|   |   |-- actions/[correlationId]/rationale/route.ts
|   |   |-- verification-requests/route.ts
|   |   `-- verification-requests/[requestId]/
|   |       |-- route.ts
|   |       |-- evidence/[evidenceId]/{preview,download}/route.ts
|   |       |-- approve/route.ts
|   |       `-- reject/route.ts
|   |-- backend/admin/
|   |   |-- accounts/
|   |   |   |-- account-directory-service.ts
|   |   |   |-- account-detail-service.ts
|   |   |   |-- admin-account-service.ts
|   |   |   `-- admin-account-command-transaction.ts
|   |   |-- verification/
|   |   |   |-- verification-review-service.ts
|   |   |   |-- verification-decision-eligibility.ts
|   |   |   `-- verification-approval-transaction.ts
|   |   |-- notifications/{notification-events,account-security-templates,security-notification-dispatcher}.tsx
|   |   `-- workers/{evidence-retention-loop,verification-lifecycle-loop,verification-notification-loop,security-notification-loop}.ts
|   |-- backend/repositories/admin/
|   |   |-- prisma-account-directory-repository.ts
|   |   |-- prisma-admin-account-repository.ts
|   |   |-- prisma-verification-repository.ts
|   |   `-- prisma-security-notification-repository.ts
|   |-- shared/contracts/admin/{resources,verification,commands,generated,index}.ts
|   `-- frontend/features/admin/
|       |-- accounts/{account-list,account-detail-show,account-state-dialog,notification-delivery-status,privileged-rationale-detail}.tsx
|       |-- verification/{verification-request-list,verification-review-show,protected-evidence-viewer,verification-decision-panel}.tsx
|       `-- app/{admin-app,data-provider}.tsx
|-- tests/
|   |-- fixtures/admin-user-verification/
|   |-- backend/{unit,contract,integration}/admin-user-verification/
|   |-- frontend/{components,accessibility}/admin-user-verification/
|   |-- architecture/admin-user-verification-boundaries.test.ts
|   |-- security/admin-user-verification/
|   |-- performance/admin-user-verification/
|   |-- usability/admin-user-verification/
|   `-- system/e2e/admin-user-verification/
`-- scripts/measure-admin-user-verification-performance.mjs
```

### Task path manifest

The source tree above uses directory-level grouping for readability. The exact implementation, contract, test, documentation, migration, and tooling paths referenced by `tasks.md` are listed here so the plan remains an authoritative path boundary; no path outside this manifest is in scope.

```text

web/tests/security/admin-user-verification/suspended-account-enforcement.test.ts
web/tests/security/admin-user-verification/verification-evidence-privacy.test.ts
web/tests/system/e2e/admin-user-verification/
web/tests/system/e2e/admin-user-verification/account-directory.spec.ts
web/tests/system/e2e/admin-user-verification/account-moderation-history.spec.ts
web/tests/system/e2e/admin-user-verification/account-restore.spec.ts
web/tests/system/e2e/admin-user-verification/account-suspend.spec.ts
web/tests/system/e2e/admin-user-verification/cross-module-regression.spec.ts
web/tests/system/e2e/admin-user-verification/quickstart-validation.spec.ts
web/tests/system/e2e/admin-user-verification/release-suite.spec.ts
web/tests/system/e2e/admin-user-verification/suspended-user-experience.spec.ts
web/tests/system/e2e/admin-user-verification/verification-approval.spec.ts
web/tests/system/e2e/admin-user-verification/verification-rejection.spec.ts
web/tests/usability/admin-user-verification/group-1-release-evidence.test.ts
web/tests/usability/admin-user-verification/group-2-release-evidence.test.ts
web/tests/usability/admin-user-verification/group-3-restore-evidence.test.ts
web/tests/usability/admin-user-verification/release-usability.test.ts
web/tests/backend/unit/admin-user-verification/account-moderation-history.test.ts
web/tests/backend/unit/admin-user-verification/verification-decision-eligibility.test.ts
web/tests/backend/unit/admin-user-verification/verification-rejection-validation.test.ts
web/tests/contract/admin-user-verification/account-detail.contract.test.ts
web/tests/contract/admin-user-verification/account-directory.contract.test.ts
web/tests/contract/admin-user-verification/account-moderation.contract.test.ts
web/tests/contract/admin-user-verification/verification-queue.contract.test.ts
web/tests/contract/admin-user-verification/verification-review.contract.test.ts
web/tests/fixtures/admin-user-verification
web/tests/fixtures/admin-user-verification/documents/
web/tests/fixtures/admin-user-verification/index.ts
web/tests/fixtures/admin-user-verification/test-harness.ts
web/tests/frontend/{components,accessibility}/admin-user-verification
web/tests/frontend/components/admin-user-verification/recruiter-account-detail.test.tsx
web/tests/performance/admin-user-verification/account-directory.perf.test.ts
web/tests/performance/admin-user-verification/account-moderation.perf.test.ts
web/tests/performance/admin-user-verification/release-performance.test.ts
web/tests/security/admin-user-verification/account-directory-privacy.test.ts
web/tests/security/admin-user-verification/protected-admin-target.test.ts
web/tests/security/admin-user-verification/release-privacy.test.ts
web/src/shared/contracts/admin/index.ts
web/src/shared/contracts/admin/resources.ts
web/src/shared/contracts/admin/verification.ts
web/tests/{architecture,security,performance,usability}
web/tests/accessibility/admin-user-verification/account-directory.a11y.test.tsx
web/tests/architecture/admin-user-verification-boundaries.test.ts
web/tests/backend/{unit,contract,integration}/admin-user-verification
web/tests/backend/integration/admin-user-verification/account-directory-query.test.ts
web/tests/backend/integration/admin-user-verification/account-moderation-integrity.test.ts
web/tests/backend/integration/admin-user-verification/account-restore-command.test.ts
web/tests/backend/integration/admin-user-verification/account-suspend-command.test.ts
web/tests/backend/integration/admin-user-verification/candidate-activity-aggregate.test.ts
web/tests/backend/integration/admin-user-verification/recruiter-job-aggregate.test.ts
web/tests/backend/integration/admin-user-verification/security-notification-worker.test.ts
web/tests/backend/integration/admin-user-verification/suspended-cross-workflow.test.ts
web/tests/backend/integration/admin-user-verification/verification-approval-transaction.test.ts
web/tests/backend/integration/admin-user-verification/verification-queue-query.test.ts
web/tests/backend/integration/admin-user-verification/verification-recovery.test.ts
web/tests/backend/integration/admin-user-verification/verification-rejection-reapply.test.ts
web/tests/backend/integration/admin-user-verification/verification-retention-worker.test.ts
web/src/backend/auth/account-state-enforcement.ts
web/src/backend/auth/session-revocation-service.ts
web/src/backend/candidate/recruiter-verification/verification-application-service.ts
web/src/backend/recruitment/application-access-service.ts
web/src/backend/repositories/admin/prisma-account-directory-repository.ts
web/src/backend/repositories/admin/prisma-verification-repository.ts
web/src/frontend/features/admin
web/src/frontend/features/admin/accounts/account-detail-show.tsx
web/src/frontend/features/admin/accounts/account-list.tsx
web/src/frontend/features/admin/accounts/account-state-dialog.tsx
web/src/frontend/features/admin/accounts/notification-delivery-status.tsx
web/src/frontend/features/admin/accounts/privileged-rationale-detail.tsx
web/src/frontend/features/admin/app/data-provider.tsx
web/src/frontend/features/admin/verification/protected-evidence-viewer.tsx
web/src/frontend/features/admin/verification/verification-decision-panel.tsx
web/src/frontend/features/admin/verification/verification-request-list.tsx
web/src/frontend/features/admin/verification/verification-review-show.tsx
web/src/frontend/features/auth/suspended-account-screen.tsx
web/src/shared/contracts/admin/commands.ts
web/src/shared/contracts/admin/generated/index.ts
web/src/app/api/auth/suspended-state/route.ts
web/src/backend/admin/accounts
web/src/backend/admin/accounts/account-detail-service.ts
web/src/backend/admin/accounts/account-directory-service.ts
web/src/backend/admin/accounts/admin-account-command-transaction.ts
web/src/backend/admin/accounts/admin-account-service.ts
web/src/backend/admin/admin-command-boundary.ts
web/src/backend/admin/admin-protected-data-ports.ts
web/src/backend/admin/admin-request-boundary.ts
web/src/backend/admin/notifications/account-security-templates.tsx
web/src/backend/admin/notifications/notification-events.ts
web/src/backend/admin/notifications/security-notification-dispatcher.ts
web/src/backend/admin/verification
web/src/backend/admin/verification/verification-approval-transaction.ts
web/src/backend/admin/verification/verification-decision-eligibility.ts
web/src/backend/admin/verification/verification-review-service.ts
web/src/backend/admin/workers/evidence-retention-loop.ts
web/src/backend/admin/workers/rationale-retention-loop.ts
web/src/backend/admin/workers/security-notification-loop.ts
web/src/backend/admin/workers/verification-lifecycle-loop.ts
web/src/backend/admin/workers/verification-notification-loop.ts
spec-kit/specs/009-user-management-and-recruiter-verification/contracts/
spec-kit/specs/009-user-management-and-recruiter-verification/contracts/admin-user-verification.openapi.yaml
spec-kit/specs/009-user-management-and-recruiter-verification/plan.md
spec-kit/specs/009-user-management-and-recruiter-verification/quickstart.md
spec-kit/specs/009-user-management-and-recruiter-verification/tasks.md
web/package.json
web/prisma/migrations/022_admin_user_management_refinement/migration.sql
web/prisma/schema.prisma
web/scripts/validate-admin-user-verification-contracts.mjs
web/scripts/verify-admin-user-management-migration.mjs
web/src/app/api/admin/accounts/[accountId]/restore/route.ts
web/src/app/api/admin/accounts/[accountId]/route.ts
web/src/app/api/admin/accounts/[accountId]/suspend/route.ts
web/src/app/api/admin/accounts/route.ts
web/src/app/api/admin/actions/[correlationId]/rationale/route.ts
web/src/app/api/admin/verification-requests/[requestId]/approve/route.ts
web/src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/{preview,download}/route.ts
web/src/app/api/admin/verification-requests/[requestId]/reject/route.ts
web/src/app/api/admin/verification-requests/[requestId]/route.ts
web/src/app/api/admin/verification-requests/route.ts
web/src/app/api/admin/accounts/[accountId]/restore/route.ts
web/src/app/api/admin/accounts/[accountId]/route.ts
web/src/app/api/admin/accounts/[accountId]/suspend/route.ts
web/src/app/api/admin/actions/[correlationId]/rationale/route.ts
web/src/app/api/admin/verification-requests/[requestId]/approve/route.ts
web/src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/{preview,download}/route.ts
web/src/app/api/admin/verification-requests/[requestId]/reject/route.ts
```
**Structure Decision**: Extend the existing `web/` modular monolith and Feature
006 admin modules. Add focused directory/detail projection services and one
shared verification decision-eligibility boundary; keep all data access inside
Prisma repositories and all critical writes inside the existing command
transaction/idempotency pattern. Reuse the existing React Admin shell, workers,
private evidence storage, and email outbox. Do not create another app, worker,
database, session mechanism, group folder, or generic admin CRUD API.

## Verification Strategy

### Group 1 gate

- Unit tests cover email masking, account-type classification, date boundaries,
  exact five-status job mapping, zero/dash rules, and stable order.
- Repository tests cover 10,000-account filtering, ACTIVE-company membership
  authority, suspended Recruiter classification, multi-company dedupe, bounded
  bulk aggregates, page boundaries, and unavailable aggregate failure.
- Contract/UI tests cover exact row/detail allowlists, loading/updating/empty/
  error states, keyboard/focus, 320 px through desktop, and no write method.
- A database write-canary proves every Group 1 interaction changes no business,
  audit, notification, or moderation record.

### Group 2 gate

- Table-driven lifecycle tests cover all eight states, qualified evidence,
  suspension overlay, existing-company prerequisite, reapply, and no Request
  changes action.
- Transaction tests cover new/existing company approval, rejection reason
  persistence/email, all evidence versions, duplicate authority, stale/retry/
  concurrency, applicant suspension racing a decision, and injected failures at
  every write boundary.
- Viewer/security tests cover exact Admin origin, current authority/fresh proof,
  no-store byte responses, current-only qualified evidence, browser history,
  capability leakage, and 24-hour/30-day cleanup.
- Worker fake-clock tests prove 15m/24h/72h/30-day milestones, idempotent events,
  no deadline pause during suspension, and no authority on expiry.

### Group 3 gate

- Command tests cover Candidate-only, recruiter-enabled, acting/other current
  Platform Administrator targets, invalid state/input/proof, retries, concurrent
  actions, session/challenge invalidation, rationale/audit/email atomicity, and
  notification failure.
- Cross-module tests prove suspension changes no job/company/membership/
  application/stage/score/verification field, prevents commands from the
  suspended account, permits other authorized recruiters to process existing
  applications, and lets job visibility follow its own state.
- Login/browser tests prove old sessions/cached pages fail, suspended outcome and
  support path do not depend on email delivery, restore requires new login, and
  no Group 3 in-app notification exists.
- Rationale/email fake-clock tests prove 365 days + 24 hours and the exact five-
  attempt/24-hour manual-intervention rules.

### Cross-cutting release gates

- Zod/OpenAPI/generated-route parity and React Admin provider method coverage.
- Exact-host/auth/tenant matrices and privacy canaries for URLs, DOM, memory
  store, query cache, analytics, ordinary logs, audit, email, and evidence bytes.
- Axe zero serious/critical findings, keyboard-only completion, visible focus,
  non-color state labels, narrow-screen layouts, and 200% zoom.
- Fixed performance and usability protocols from each spec, with environment,
  dataset, timing boundaries, warm-ups, samples, concurrency, nearest-rank
  P50/P95/P99/max, error rate, and external conditions in machine-readable
  release evidence.
- Existing `test:admin-management`, `test:recruiter-header`, authentication,
  job-board, Candidate application-tracking, and recruiter application-stage
  suites remain green except deliberate Request-changes/Restore naming contract
  updates documented by this plan.

## Rollout and Recovery

1. Apply and verify migration `022`; deploy no UI until schema/index validation
   and legacy rejection-reason behavior pass.
2. Ship Group 1 contracts, repository/service projections, route/provider/UI,
   then pass its independent tests, performance, accessibility, privacy, and
   zero-write gate.
3. Ship Group 2 shared eligibility, repository/contracts/UI and command changes,
   evidence reconciliation, and migration backfill policy; pass the full Group 2
   gate before enabling Group 3 changes.
4. Ship Group 3 target-admin protection, canonical Restore presentation,
   history projection, security-email changes, suspended-login integration, and
   cross-workflow guards.
5. Run all cross-cutting and existing regression suites before release.
6. Roll back presentation/routes/services independently in reverse group order.
   If application code rolls back after migration, the additive nullable field
   and indexes remain safe. Never roll back by deleting audit, rationale,
   evidence, outbox, command receipt, or notification work records.

## Post-Design Constitution Re-check

Phase 1 design remains compliant. All privileged reads and writes retain the
exact Admin-origin plus exclusive Better Auth/designated-session boundary;
company authority remains verified-membership scoped; critical outcomes remain
transactional, versioned, idempotent, and auditable; evidence and rationale keep
purpose-specific access and deletion; security communication uses the existing
replaceable email boundary; suspension does not silently rewrite recruitment
data; no AI or automatic decision is introduced; and each UI/performance/
privacy/integrity claim has a fixed validation path. All seven gates remain
**Pass**.

## Complexity Tracking

No constitutional violation requires justification. The additive migration,
bounded aggregate repository, shared verification eligibility service, and
canonical Restore compatibility mapper are the minimum extensions needed to
close gaps between the clarified specification and Feature 006. They reuse
existing application, database, worker, provider, and session boundaries.
