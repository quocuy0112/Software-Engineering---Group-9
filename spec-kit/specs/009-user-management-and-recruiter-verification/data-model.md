# Data Model: Admin User Management and Recruiter Verification

**Feature**: `009-user-management-and-recruiter-verification`  
**Date**: 2026-08-12  
**Authority**: Existing PostgreSQL schema from Features 001–007 plus additive
migration `022_admin_user_management_refinement`.

This document distinguishes persistent authorities from composed read models.
Names in `camelCase` are Prisma fields; cross-module snake-case names are shown
where the specification requires them.

## Persistent Authorities

### UserAccount (existing)

| Field | Rule |
|---|---|
| `id` | Stable opaque account reference; primary key |
| `name` | Display name; never used as identity/uniqueness authority |
| `email`, `normalizedEmail` | Unique protected address and normalized search key; only masked email is projected |
| `state` | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, or `DELETED`; Group 1/3 actions use only ACTIVE/SUSPENDED |
| `version` | Optimistic concurrency integer; incremented by account commands |
| `stateChangedAt` | Authoritative account-state change time |
| `createdAt` | Registration time and stable directory primary order |
| `deletedAt` | Separate terminal retention lifecycle; never restored by Group 3 |

Relations used by Feature 009:

- exactly one base `CandidateIdentity` for a normal registered account;
- zero or more `CompanyMembership` records;
- zero or one current `PlatformAdministratorGrant` per user;
- zero or more `RecruiterVerificationRequest`, `Session`, and audit/email work
  records.

New/verified indexes:

- `(state, createdAt DESC, id ASC)` for lifecycle/date/stable paging;
- trigram GIN on `name` and `normalizedEmail` for bounded case-insensitive
  directory discovery after safe normalization;
- existing `(state, id)` remains valid for account-state checks.

### CandidateIdentity, CandidateCv, and JobApplication (existing)

`CandidateIdentity.userId` is the base identity and joins to:

- `CandidateCv(candidateUserId)`: Group 1 `cvCount` counts all stored CV records,
  including archived records, because the specification requests total CVs;
- `JobApplication(candidateUserId)`: every record is a submitted application;
  the schema has no application draft row, so `submittedApplicationCount` is the
  total joined row count.

Existing indexes:

- `CandidateCv(candidateUserId, confirmedAt, archivedAt)`;
- `JobApplication(candidateUserId, submittedAt DESC)`.

### Company and CompanyMembership (existing)

Company authority requires:

```text
CompanyMembership.status == ACTIVE
AND Company.verificationState == ACTIVE
```

`CompanyMembership` fields used are `id`, `companyId`, `userId`, `role`,
`status`, `version`, `stateChangedAt`, and `priorApprovedRole`. The unique
`(companyId, userId)` key prevents duplicate authority.

An account can be SUSPENDED while its membership remains ACTIVE. The membership
still classifies the account as Recruiter-enabled for Group 1, but authentication
and company access remain ineffective because account state is not ACTIVE.

### JobPosting (existing)

Group 1 displays exactly these five current-status counts:

| Persistence state | Projection field |
|---|---|
| `ACTIVE` | `activeJobCount` |
| `PENDING_REVIEW` | `pendingReviewJobCount` |
| `REJECTED` | `rejectedJobCount` |
| `DRAFT` | `draftJobCount` |
| `CLOSED` | `closedJobCount` |

`EXPIRED` and `REMOVED` are valid persistence states but are not displayed or
folded into another count. Jobs are grouped by `companyId` across the account's
distinct qualifying company memberships. Existing `(companyId, status, id)`
supports the aggregate.

### RecruiterVerificationRequest (existing plus additive field)

| Field | Cross-module name/rule |
|---|---|
| `id` | Stable request reference |
| `applicantUserId` | `recruiter_id`; base Candidate account |
| `submittedCompanyName` | `company_name` |
| `normalizedTaxIdentifier` | `tax_code`; exactly 10 ASCII digits |
| `currentEvidenceId` | Resolves `license_file_url` as a private internal reference; never returned as a URL |
| `state` | `status`; lifecycle below |
| `requestedRole` | OWNER/HR_MANAGER/RECRUITER/HIRING_MANAGER |
| `targetCompanyId`, `prerequisiteId` | Optional existing-company path |
| `currentSubmissionVersion` | Positive current evidence version |
| `resubmissionCount` | Integer 0–3 |
| `assignedAdminUserId` | Nullable read-only workload metadata |
| `adminComment` | **New nullable field**, mapped as `admin_comment`; required normalized 10–500 characters for every new REJECTED outcome |
| decision actor/time | Derived from latest committed `VerificationDecisionHistory` as `reviewed_by`/`reviewed_at` |
| `version` | Optimistic concurrency version |
| milestone timestamps | Changes, delay, expiry, cancellation, decision, and continuous viewer outage |

Validation/integrity:

- exactly one active request per applicant and normalized tax code across
  PENDING_CHECKS/PENDING_REVIEW/CHANGES_REQUESTED/RESUBMITTED;
- every new REJECTED row has non-null valid `adminComment`; legacy null rows are
  allowed only when they predate migration 022 and are immutable;
- assignment mutation remains outside Feature 009;
- applicant account state is a decision-eligibility overlay, not a request
  state.

### BusinessLicenseEvidence (existing)

Fields: request/version, declared/detected type, byte size, encrypted storage
locator metadata, four safety states, review time, inaccessibility/deletion/
supersession timestamps, processing lease, and timestamps.

Reviewable means all of:

```text
current request evidence ID and submission version
malwareStatus == PASS
typeStatus == PASS
structureStatus == PASS
previewStatus == PASS
contentInaccessibleAt IS NULL
deletedAt IS NULL
supersededAt IS NULL
```

Retention:

| Outcome | Access/deletion |
|---|---|
| Superseded, REJECTED, CANCELLED, EXPIRED | Inaccessible immediately; delete due within 24 hours |
| APPROVED while Company ACTIVE | Protected access may continue |
| APPROVED after company becomes non-ACTIVE or evidence is superseded | Inaccessible immediately; delete due within 30 days |

### CompanyAccessPrerequisite (existing)

Valid existing-company approval requires exact applicant, company, request, and
role scope; kind INVITATION or OWNER_APPROVAL; state AVAILABLE; not expired,
revoked, or used. It changes to USED atomically with membership approval.

### VerificationDecisionHistory (existing)

Persists request/submission version, actor Admin, prior/result state, APPROVE/
REJECT (legacy REQUEST_CHANGES remains readable), rejection category or approved
role, result, correlation, and time. It intentionally contains no rejection-
reason text, raw evidence, rationale, credential, or session identifier.

### VerificationNotificationEvent (additive Group 2 authority)

One row represents one applicant-visible verification outcome. It is the sole
idempotency authority for the outcome and owns two delivery states rather than
creating separate competing notification records:

| Field | Rule |
|---|---|
| `id`, `idempotencyKey` | unique event identity derived from request, submission version, event kind, and resulting state |
| `verificationRequestId`, `eventKind` | request relation plus `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, `VERIFICATION_DELAYED`, or `VERIFICATION_EXPIRED` |
| `resultingStatus`, `eventTime` | committed lifecycle result and immutable decision/milestone time |
| `payloadRef` | allowlisted applicant-visible state, category/reason when applicable, and next action only |
| `emailStatus`, `inAppStatus` | independently retryable `QUEUED`, `DELIVERED`, or `FAILED` channel state |
| `emailOutboxId`, `inAppNotificationRef` | nullable delivery-child references; neither is an authority for the event |
| `createdAt`, `updatedAt` | timestamps |

The event, request transition, decision/audit rows, and any email outbox child
are committed in the same PostgreSQL transaction. The in-app delivery worker
uses the event idempotency key and `inAppNotificationRef` to create at most one
user-visible item; retries update the same event/channel state. Email keeps the
existing `EmailOutbox` provider policy. A delivery failure or worker delay never
rolls back the committed verification result. Private notes, administrator
identity, evidence references, internal safety signals, storage locations, and
company-private facts are excluded from both channels.

### VerificationPrivateNote (existing)

Optional normalized administrator-only text up to 2,000 characters. It is never
sent to the applicant or copied to audit/ordinary telemetry.

### PlatformAdministratorGrant (existing)

`state == ACTIVE` and `expiresAt` null/future means current Platform
Administrator authority. Both Group 3 actions are unavailable while such a
grant exists. Feature 009 never mutates this entity. The blocked command writes
one allowlisted DENIED `AuditEvent` plus its stable `AdminCommandReceipt`, but
changes no account/session/challenge and creates no rationale or notification.

### AuditEvent (existing; moderation-log authority)

Append-only privileged event with actor, action, target, result, timestamp,
correlation, and allowlisted context. Group 3 projects only:

- `admin.account_suspended`;
- canonical new `admin.account_restored`;
- legacy `admin.account_reinstated` mapped to Restore display; and
- corresponding denied/failed attempts where recorded.

The specification's `AccountModerationLog` is this projection, not a new table.

### PrivilegedActionRationale (existing)

Encrypted normalized 10–500-character text correlated to AuditEvent. It becomes
inaccessible exactly 365 calendar days after the action and is physically
deleted within the next 24 hours. It never enters audit, email, URL, analytics,
or ordinary logs.

### SecurityNotificationWork and EmailOutbox (existing)

One Group 3 security email uses:

- `SecurityNotificationWork`: correlation, target, canonical kind
  ACCOUNT_SUSPENDED or ACCOUNT_RESTORED, allowlisted payload, state, attempts,
  schedule/deadline/failure, and optional linked outbox;
- `EmailOutbox`: recipient reference/encrypted destination, template/payload,
  unique idempotency key, delivery status, provider-safe result.

No in-app notification entity is created. Email is mandatory and ignores the
user's optional product-email preference. Historical ACCOUNT_REINSTATED rows
remain readable through a presentation mapper.

The allowlisted payload contains action, resulting state, occurrence time,
non-sensitive reason category, next action, and support/dispute destination.
It excludes the encrypted rationale, administrator identity, session data,
internal correlation, and raw audit context.

### AdminCommandReceipt (existing)

Unique `(actorSubjectDigest, idempotencyKey)` with command/target/body digest,
result, resulting version, correlation, and timestamps. Reuse with another body
or target fails; replay of an unknown transport outcome returns the same result.

## Read Models

### AccountDirectoryItem

- account reference, display name, masked email;
- types: Candidate always, Recruiter when qualifying authority exists;
- account state and registration time;
- Candidate counts: CVs and submitted applications;
- Recruiter counts: Active, Pending Review, Rejected, Draft, Closed;
- `calculatedAt` supplied in list envelope.

The row has no raw email, private profile data, tax/evidence, session, rationale,
or administrator grant detail.

### AccountAdminDetail

Adds to common account fields:

- Candidate activity summary;
- Recruiter authority list with company reference/name, role, membership state;
- job-status aggregate;
- `stateVersion`, `stateChangedAt`, action eligibility;
- AccountModerationLog projection and security-email delivery projection.

The existing session-security projection remains a separate explicit read and
is not silently embedded into this detail.

### VerificationQueueItem

- request/applicant/company/tax code/requested role;
- lifecycle state plus applicant eligibility ACTIVE_APPLICANT or
  APPLICANT_SUSPENDED;
- current submission version/resubmission count;
- assigned Admin reference or Unassigned;
- original submission time/age;
- review-details action only.

### VerificationReviewDetail

Composes request, applicant eligibility/display, company/prerequisite match,
current qualified evidence metadata/actions, inaccessible version history,
decision history, protected notes, `adminComment` when permitted, version, and
action eligibility. It never returns storage locator/encryption fields.

### AccountModerationLogItem

- action SUSPEND or RESTORE;
- prior/result state;
- non-sensitive reason category;
- actor and target references;
- SUCCESS/DENIED/FAILURE;
- timestamp and correlation reference.

Rationale is fetched separately with current authority plus fresh proof.

## State Transitions

### Verification lifecycle

```text
PENDING_CHECKS -> PENDING_REVIEW | CANCELLED | EXPIRED
PENDING_REVIEW -> APPROVED | REJECTED | CANCELLED | EXPIRED
CHANGES_REQUESTED -> RESUBMITTED | CANCELLED | EXPIRED   # historical/shared compatibility
RESUBMITTED -> PENDING_CHECKS                            # uninterrupted accepted replacement

APPROVED | REJECTED | CANCELLED | EXPIRED -> terminal
```

Feature 009 Admin UI creates only PENDING_REVIEW -> APPROVED or REJECTED.
SUSPENDED applicant state blocks both but creates no lifecycle transition and
pauses no deadline.

### Account lifecycle

```text
ACTIVE --Suspend--> SUSPENDED
SUSPENDED --Restore--> ACTIVE
```

Both actions require a target with no current Platform Administrator grant.
The protected-target branch produces a DENIED audit/receipt outcome only.
DELETED remains terminal elsewhere. Restore creates no session.

### Security-email delivery

```text
PENDING -> RETRYING -> DELIVERED
PENDING/RETRYING -> MANUAL_INTERVENTION_REQUIRED
```

Attempts are due immediately, then +1m, +5m, +30m, +2h after preceding failure;
permanent failure, failed attempt 5, or 24 hours without delivery ends automatic
delivery. Account state never rolls back.

## Relationships

```text
UserAccount 1---1 CandidateIdentity
CandidateIdentity 1---* CandidateCv
CandidateIdentity 1---* JobApplication *---1 JobPosting

UserAccount 1---* CompanyMembership *---1 Company 1---* JobPosting
UserAccount 1---0..1 PlatformAdministratorGrant
UserAccount 1---* RecruiterVerificationRequest

RecruiterVerificationRequest 1---* BusinessLicenseEvidence
RecruiterVerificationRequest 1---* VerificationDecisionHistory
RecruiterVerificationRequest 1---* VerificationPrivateNote
RecruiterVerificationRequest 0..1---1 CompanyAccessPrerequisite
RecruiterVerificationRequest *---0..1 Company

AuditEvent 1---0..1 PrivilegedActionRationale        # correlation only
AuditEvent 1---0..1 SecurityNotificationWork         # correlation only
SecurityNotificationWork 0..1---1 EmailOutbox
```

## Migration and Integrity Gates

1. Add nullable `adminComment` without rewriting existing requests.
2. Add account discovery indexes concurrently/safely per repository migration
   conventions; enable/use existing PostgreSQL trigram capability.
3. Deploy application validation/transaction logic before accepting any new
   REJECTED write; after deployment, every new rejection must have valid text.
4. Treat legacy null reasons as `LEGACY_REASON_UNAVAILABLE`; do not synthesize
   or copy text from ordinary logs/audit.
5. Verify representative query plans for All/Candidate/Recruiter, date/state,
   keyword, and 100-row aggregate detail without N+1 reads.
6. Compare before/after counts for UserAccount, CandidateCv, JobApplication,
   JobPosting, CompanyMembership, RecruiterVerificationRequest,
   BusinessLicenseEvidence, AuditEvent, PrivilegedActionRationale,
   SecurityNotificationWork, and EmailOutbox.
7. Prove the migration changes no account/request/evidence/membership/job/
   application state, stage, score, session, audit event, recipient, document
   locator, or encryption field.
8. Rollback application code may ignore the additive nullable field/indexes;
   never delete or reverse audit/outbox/evidence cleanup records as rollback.
