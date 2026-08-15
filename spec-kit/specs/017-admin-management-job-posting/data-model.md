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
- `CLOSED`

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
| `publicJobPostingId` | Identifier or null | Unique optional foreign key to the existing derivative `JobPosting` search/publication projection |
| `closedAt` | Timestamp or null | Authoritative managed closure time; null while the managed job is open |
| `closedByUserId` | String or null | Required qualifying Recruiter actor when `closedAt` is set |
| `version` | Integer | Optimistic concurrency version; increments on every aggregate mutation |
| `adoptedAt` | Timestamp | First entry into review authority |
| `createdAt` | Timestamp | Immutable creation time |
| `updatedAt` | Timestamp | Last authoritative mutation time |

### Constraints

- Unique `jobId`.
- `latestSequence >= 1`.
- A partial unique constraint permits at most one `PENDING_REVIEW` version for an aggregate, independently of the aggregate pointer.
- Pending and approved references must belong to the same aggregate.
- A pending reference must point to `PENDING_REVIEW`; an approved reference must point to `APPROVED`.
- `closedAt` and `closedByUserId` are both null or both set; closure increments the aggregate version, writes history/audit, and is idempotent.
- A public projection reference is required whenever `approvedVersionId` is present and must identify the `JobPosting` row transactionally derived from that same approved version, even when closure, expiry, or removal currently suppresses discovery.
- Public projection uses only `approvedVersionId`; mutable JSON status cannot override it.
- The aggregate relation is the primary projection identity. Initial adoption may bind an existing `JobPosting` only when its unique stable slug, company, and mapped public content match the imported baseline and no other aggregate owns it; otherwise adoption is integrity-blocked for explicit reconciliation.
- If an active legacy baseline has no relational row and its stable slug is unused, adoption creates and links its exact `JobPosting`/skill projection in the baseline transaction before permitting the first material JSON edit.

## JobPostReviewVersion

One immutable submitted content snapshot plus its assignment and terminal outcome.

| Field | Type | Rules |
|------|------|-------|
| `id` | Opaque identifier | Primary key |
| `reviewAggregateId` | Identifier | Required internal aggregate foreign key; never exposed as API `reviewId` |
| `sequence` | Integer | Positive, unique within aggregate |
| `snapshot` | JSON | Complete allow-listed normalized job content; immutable after insert |
| `snapshotSchemaVersion` | String | Required allow-listed parser/projection version |
| `snapshotSha256` | String | 64 lowercase hexadecimal characters |
| `state` | JobPostReviewState | Starts `PENDING_REVIEW`; one terminal transition |
| `submittedByUserId` | String or null | Required User foreign key for ordinary submissions; null only for an imported baseline whose historical author cannot be proven |
| `submittedMembershipId` | String or null | Required qualifying Company Membership foreign key for ordinary submissions; null only for an imported baseline |
| `submissionIdempotencyKey` | String or null | Required 16-128 character actor-scoped key for ordinary submissions; null only for imported baseline |
| `submissionRequestHash` | String or null | Required SHA-256 binding of job ID, expected working version, and content identity for ordinary submissions |
| `submittedAt` | Timestamp | Required immutable event time |
| `assignedAdminUserId` | String or null | Current eligible assignee while pending |
| `assignedAt` | Timestamp or null | Required when assigned |
| `decidedByAdminUserId` | String or null | Required only for terminal decision |
| `decidedAt` | Timestamp or null | Required only for terminal decision |
| `publishedAt` | Timestamp or null | Required for an approved version; null for pending/rejected; imported baseline preserves a valid matched relational `JobPosting.publishedAt` or uses adoption time, never a mutable JSON timestamp |
| `reasonCode` | JobPostReviewReasonCode or null | Required only for rejection |
| `publicExplanation` | String or null | Normalized 20-1,000 characters; required only for rejection |
| `decisionCorrelationId` | String or null | Unique decision audit correlation for terminal state |
| `importedBaseline` | Boolean | True only for a grandfathered prior public snapshot |
| `createdAt` | Timestamp | Immutable insert time |
| `updatedAt` | Timestamp | Assignment/decision update time; snapshot fields remain immutable |

### Constraints

- Unique `(reviewAggregateId, sequence)`, `(reviewAggregateId, snapshotSha256)`, and `(submittedByUserId, submissionIdempotencyKey)`; imported null values do not collide.
- Replaying an idempotency key requires the stored `submissionRequestHash` to match exactly; changed reuse fails without mutation.
- `PENDING_REVIEW`: no decision actor/time/reason; assignment actor/time are both null or both present.
- `APPROVED`: rejection fields null and `publishedAt` required. A normal approval requires decision actor/time/correlation and uses the decision time as initial publication/public-update time. An imported baseline requires import time/correlation but keeps the decision actor null so it cannot be mistaken for an Administrator decision.
- `REJECTED`: decision actor/time/correlation, reason code, and explanation required.
- `importedBaseline` versions are `APPROVED`, have an import history event, and do not claim an Administrator decision.
- Snapshot, schema version, hash, submitter, membership, idempotency identity/binding, and submission/import time are immutable. The server-owned stable job ID, slug, and company ID are included as identity facts, while snapshot content excludes client-authored ownership, status, approval feedback, verification display, statistics, and lifecycle/publication timestamps.

## JobCatalogueWriteLease

Coordinates JSON working-catalogue writes across application processes while PostgreSQL remains available.

| Field | Type | Rules |
|------|------|-------|
| `catalogueKey` | String | Primary key; digest of the configured canonical catalogue path, never the raw path |
| `ownerTokenHash` | String | Digest of an ephemeral writer token |
| `leaseExpiresAt` | Timestamp | Short hard expiry supporting stale recovery |
| `expectedCatalogueSha256` | String | Checksum the owner must observe before replacement |
| `version` | Integer | Monotonically increasing optimistic fencing token for claim/recovery |
| `updatedAt` | Timestamp | Last claim/renew/release evidence time |

### Constraints

- At most one unexpired owner for one catalogue key.
- Claims and stale recovery are compare-and-swap operations that increment the fencing token; a stale token can never authorize a later commit or replace.
- A writer must release or let the lease expire after atomic replacement; failure cannot authorize a second writer before expiry.
- Preflight rejects mutations when the host lacks the sole writer designation, the configured path is not durable/writable, or its checksum differs from the lease expectation.
- Submission holds the same lease/checksum boundary from the exact JSON read through commit of the pending-version transaction. That transaction locks and revalidates the unexpired owner token, fencing version, and checksum before creating pending state; only after commit may another claimant proceed, and that claimant must reauthorize and observe the pending write lock before changing JSON.
- First active-edit adoption validates the same fencing facts in its baseline/projection transaction. The following atomic JSON replacement performs a final unexpired-owner/fencing/checksum compare; loss of the lease abandons the replacement while leaving the imported baseline safe.

## Existing JobPosting Publication Projection

The existing relational `JobPosting` and `JobPostingSkill` rows remain the canonical indexed search projection. They are not the Recruiter working source for this feature.

- Approval deterministically maps the exact approved snapshot into structured title, summary, description, responsibilities, requirements, benefits, education, headcount, age, location, employment type, experience level, work arrangement, salary, deadline, normalized search document, and skills.
- Submission rejects any content whose existing free-form JSON labels cannot map to the allow-listed relational enums without guessing.
- `approvedAt`, `publishedAt`, and the public `updatedAt` are server-owned decision facts.
- Pending/rejected versions never update `JobPosting` or `JobPostingSkill`.
- For an aggregate without a projection link, approval may create one row and set `publicJobPostingId` in the same transaction only when the stable slug is unused. A slug owned by another company or aggregate blocks submission/approval without overwriting it.
- Reapproval replaces the same aggregate-linked projection transactionally; no duplicate public job is created.
- Skill names use the existing deterministic normalized-name identity; projection upserts missing `Skill` rows, then replaces ordered `JobPostingSkill` links in the approval transaction.
- Managed closure updates the projection to `CLOSED` transactionally and preserves review snapshots/history.
- Closure while a replacement is pending hides the job immediately but does not manufacture a review decision. The pending version remains reviewable; a later approval may replace the approved snapshot/projection content but preserves `closedAt` and `JobPosting.status = CLOSED`, so it cannot silently reopen publication.
- Canonical detail may join the approved snapshot for public fields not materialized in `JobPosting`, but it never reads the mutable JSON working status for visibility.

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

All three kinds use category `MODERATION`; review-request and rejection events use `MEDIUM` severity, and approval uses `LOW` severity.

Administrator request alerts and Recruiter outcomes both use the externally addressable Job Review Version ID as context. The destination reauthorizes that version and resolves its aggregate/job internally; aggregate IDs never occupy an API `reviewId` or notification context.

## Existing AdminCommandReceipt Use

Claim, reassignment, approval, and rejection reuse the existing `AdminCommandReceipt` transaction boundary rather than adding a second command store.

- `actorSubjectDigest` plus the 16-128 character idempotency key remains the unique replay identity.
- `commandKind`, external Job Review Version ID, path action, expected aggregate version, and the fully normalized discriminated body all contribute to `normalizedBodyDigest`.
- Exact replay returns the stored safe result. Reuse with a changed review, path action, expected version, target assignee, decision, reason, explanation, or private-note digest fails as a conflict without mutation.
- The receipt, review mutation, public projection when approving, history, audit, and outcome notification commit in one PostgreSQL transaction.

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

Unmanaged JSON active
  -> pre-edit adoption transaction -> imported Review Version APPROVED + exact public projection
  -> material edit -> JSON working draft while imported baseline remains public
  -> submit -> new Review Version PENDING_REVIEW

PENDING_REVIEW (unassigned)
  -> claim -> PENDING_REVIEW (assigned)
  -> reassignment -> PENDING_REVIEW (new assignee)
  -> approve -> APPROVED + transactional JobPosting/skill projection
  -> reject -> REJECTED

REJECTED
  -> revise JSON working copy
  -> resubmit -> new Review Version PENDING_REVIEW

APPROVED
  -> material JSON edit -> distinct working draft while approved snapshot remains public
  -> submit -> new Review Version PENDING_REVIEW
  -> prior approved version remains public until replacement approval

OPEN managed aggregate (with or without a pending replacement)
  -> close -> aggregate closedAt + JobPosting CLOSED + history/audit
  -> later pending approval may update reviewed content but preserves CLOSED visibility
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
- Queue returns bounded title/company summary only after Administrator authorization; detail returns the validated snapshot and safe joined context. Notification copy remains generic and contains neither title nor company name.
- Private notes are visible only in detail and never in notification list copy.

### Public/Candidate

- If no aggregate exists, preserve legacy eligibility behavior.
- If aggregate exists, expose only the approved snapshot and only while ordinary active/deadline/company gates pass.
- Canonical search/filter/pagination use the aggregate-linked `JobPosting` projection; canonical detail may enrich it from the same approved snapshot.
- No pending/rejected/existence/reason/assignment information is disclosed.

## Retention and Deletion

- Review versions, decisions, history, and required audit evidence follow the existing job/company authorized history lifetime.
- Notification rows retain the existing 90-day visible retention.
- Closing or removing a job does not erase review history.
- Account or membership changes do not rewrite historical actor references; projections remain least-privilege.
- Destructive cleanup is outside this feature and must not precede an approved retention policy.
