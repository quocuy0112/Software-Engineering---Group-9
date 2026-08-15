# Data Model: Administrator Job-Post Review and Approval

**Date**: 2026-08-15

## Overview

The existing JSON job record remains the Recruiter working copy. The models below add PostgreSQL authority for every adopted review lifecycle and retain immutable submitted/approved content. Logical names may be shortened during Prisma implementation only if contract terminology remains unchanged.

## Enumerations

### JobPostReviewState

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`

### JobPostReviewReasonCode

- `INCOMPLETE_OR_UNCLEAR`
- `MISLEADING_CONTENT`
- `COMPENSATION_OR_LOCATION_UNCLEAR`
- `DISCRIMINATORY_OR_PROHIBITED`
- `COMPANY_OR_ROLE_MISMATCH`
- `DUPLICATE_OR_SPAM`
- `EXPIRED_OR_INVALID_DEADLINE`
- `POLICY_OR_LEGAL_RISK`
- `OTHER_ACTION_REQUIRED`

### JobPostReviewHistoryAction

- `SUBMITTED`
- `CLAIMED`
- `REASSIGNED`
- `APPROVED`
- `REJECTED`
- `RESUBMITTED`
- `LEGACY_BASELINE_IMPORTED`

## JobPostReviewAggregate

One row adopts one stable JSON job identifier into review authority.

| Field | Type | Rules |
|------|------|-------|
| `id` | Opaque identifier | Primary key; never derived from job title |
| `jobId` | String | Unique stable JSON catalogue identifier |
| `companyId` | String | Required foreign key to the authoritative verified Company |
| `latestSequence` | Integer | Starts at 1; increments for every submitted version |
| `pendingVersionId` | Identifier or null | At most one; references a pending version owned by this aggregate |
| `approvedVersionId` | Identifier or null | At most one current approved public snapshot owned by this aggregate |
| `version` | Integer | Optimistic concurrency version; increments on every aggregate mutation |
| `adoptedAt` | Timestamp | First entry into review authority |
| `createdAt` | Timestamp | Immutable creation time |
| `updatedAt` | Timestamp | Last authoritative mutation time |

### Constraints

- Unique `jobId`.
- `latestSequence >= 1`.
- Pending and approved references must belong to the same aggregate.
- A pending reference must point to `PENDING_REVIEW`; an approved reference must point to `APPROVED`.
- Public projection uses only `approvedVersionId`; mutable JSON status cannot override it.

## JobPostReviewVersion

One immutable submitted content snapshot plus its assignment and terminal outcome.

| Field | Type | Rules |
|------|------|-------|
| `id` | Opaque identifier | Primary key |
| `reviewId` | Identifier | Required aggregate foreign key |
| `sequence` | Integer | Positive, unique within aggregate |
| `snapshot` | JSON | Complete allow-listed normalized job content; immutable after insert |
| `snapshotSchemaVersion` | String | Required allow-listed parser/projection version |
| `snapshotSha256` | String | 64 lowercase hexadecimal characters |
| `state` | JobPostReviewState | Starts `PENDING_REVIEW`; one terminal transition |
| `submittedByUserId` | String or null | Required User foreign key for ordinary submissions; null only for an imported baseline whose historical author cannot be proven |
| `submittedMembershipId` | String or null | Required qualifying Company Membership foreign key for ordinary submissions; null only for an imported baseline |
| `submittedAt` | Timestamp | Required immutable event time |
| `assignedAdminUserId` | String or null | Current eligible assignee while pending |
| `assignedAt` | Timestamp or null | Required when assigned |
| `decidedByAdminUserId` | String or null | Required only for terminal decision |
| `decidedAt` | Timestamp or null | Required only for terminal decision |
| `reasonCode` | JobPostReviewReasonCode or null | Required only for rejection |
| `publicExplanation` | String or null | Normalized 20-1,000 characters; required only for rejection |
| `decisionCorrelationId` | String or null | Unique decision audit correlation for terminal state |
| `importedBaseline` | Boolean | True only for a grandfathered prior public snapshot |
| `createdAt` | Timestamp | Immutable insert time |
| `updatedAt` | Timestamp | Assignment/decision update time; snapshot fields remain immutable |

### Constraints

- Unique `(reviewId, sequence)` and `(reviewId, snapshotSha256)`.
- `PENDING_REVIEW`: no decision actor/time/reason; assignment actor/time are both null or both present.
- `APPROVED`: rejection fields null. A normal approval requires decision actor/time/correlation. An imported baseline requires import time/correlation but keeps the decision actor null so it cannot be mistaken for an Administrator decision.
- `REJECTED`: decision actor/time/correlation, reason code, and explanation required.
- `importedBaseline` versions are `APPROVED`, have an import history event, and do not claim an Administrator decision.
- Snapshot, schema version, hash, submitter, membership, and submission/import time are immutable.

## JobPostReviewHistory

Append-only user-facing/admin-facing lifecycle history. The general `AuditEvent` remains the broader security/operations trail.

| Field | Type | Rules |
|------|------|-------|
| `id` | Opaque identifier | Primary key |
| `reviewVersionId` | Identifier | Required version foreign key |
| `action` | JobPostReviewHistoryAction | Required |
| `actorUserId` | String or null | Null only for controlled import/system integrity events |
| `priorState` | JobPostReviewState or null | Null for first submission/import |
| `resultingState` | JobPostReviewState | Required |
| `priorAssigneeUserId` | String or null | Bounded assignment context |
| `resultingAssigneeUserId` | String or null | Bounded assignment context |
| `resultingAggregateVersion` | Integer | Required optimistic version after success |
| `correlationId` | String | Required link to audit/command evidence |
| `occurredAt` | Timestamp | Required server time |

### Constraints

- Append-only; no update/delete through application commands.
- Unique `(reviewVersionId, resultingAggregateVersion, action)`.
- Does not store snapshot content, rejection explanation, or private note.

## JobPostReviewPrivateNote

Optional Administrator-only note for a rejection or reassignment investigation.

| Field | Type | Rules |
|------|------|-------|
| `id` | Opaque identifier | Primary key |
| `reviewVersionId` | Identifier | Required version foreign key |
| `authorAdminUserId` | String | Required active Administrator at creation |
| `normalizedText` | String | 1-2,000 characters; markup/control-free |
| `createdAt` | Timestamp | Immutable |

### Constraints

- Never returned to Recruiter/public/notification projections.
- Append-only and covered by Administrator authorization.

## Existing InAppNotification Extension

Add kinds:

- `JOB_POST_REVIEW_REQUESTED_ADMIN`
- `JOB_POST_APPROVED`
- `JOB_POST_REJECTED`

Add context type:

- `JOB_POST_REVIEW`

Administrator request alerts use the review version ID as context. Recruiter outcomes use the aggregate ID so current tenant authorization can resolve the current safe workspace destination.

## Existing AuditEvent Use

Each command writes one audit event with:

- actor type/user/session/grant as applicable;
- action such as `job_post_review.submitted`, `.claimed`, `.reassigned`, `.approved`, `.rejected`, or `.approval_blocked`;
- opaque review/version target;
- success, denied, conflict, or failure result;
- correlation ID and occurred time;
- bounded context: prior/resulting state, aggregate version, reason code, and safe failure code.

Audit context excludes snapshot content, title, company name, explanation, private note, evidence, contact data, and raw JSON paths.

## State Transitions

```text
Unmanaged JSON draft
  -> submit -> Review Version PENDING_REVIEW

PENDING_REVIEW (unassigned)
  -> claim -> PENDING_REVIEW (assigned)
  -> reassignment -> PENDING_REVIEW (new assignee)
  -> approve -> APPROVED
  -> reject -> REJECTED

REJECTED
  -> revise JSON working copy
  -> resubmit -> new Review Version PENDING_REVIEW

APPROVED
  -> material edit -> new Review Version PENDING_REVIEW
  -> prior approved version remains public until replacement approval
```

No terminal version returns to pending. Resubmission always creates a new sequence.

## Projection Rules

### Recruiter

- Require current active qualifying membership in the aggregate company.
- Working content comes from the JSON catalogue.
- Lifecycle, assignment visibility, public reason/explanation, and read-only state come from review authority.
- Never expose Administrator identity, private note, other recipients, or unrestricted audit context.

### Administrator

- Require current active Platform Administrator grant for every request.
- Queue returns bounded summary only; detail returns validated snapshot and safe joined context.
- Private notes are visible only in detail and never in notification list copy.

### Public/Candidate

- If no aggregate exists, preserve legacy eligibility behavior.
- If aggregate exists, expose only the approved snapshot and only while ordinary active/deadline/company gates pass.
- No pending/rejected/existence/reason/assignment information is disclosed.

## Retention and Deletion

- Review versions, decisions, history, and required audit evidence follow the existing job/company authorized history lifetime.
- Notification rows retain the existing 90-day visible retention.
- Closing or removing a job does not erase review history.
- Account or membership changes do not rewrite historical actor references; projections remain least-privilege.
- Destructive cleanup is outside this feature and must not precede an approved retention policy.
