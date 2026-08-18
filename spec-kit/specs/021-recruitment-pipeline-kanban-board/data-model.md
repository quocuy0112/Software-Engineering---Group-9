# Data Model: Recruitment Pipeline Kanban Board

Feature 019 adds no persistent entity and no migration. The board is a least-privilege projection of existing PostgreSQL state; all writes update the existing application aggregate.

## Persisted Entities

### Company

**Existing model**: `Company` in `web/prisma/schema.prisma`

Relevant fields:

- `id`: canonical tenant identity.
- `verificationState`: must be `ACTIVE` for board access.
- `verifiedAt`: must be non-null.
- `verificationInactiveAt`: must be null.
- `memberships`: company-scoped user authority.
- `jobPostings`: canonical persisted jobs.
- `jobPostReviewAggregates`: catalogue/public-job mappings.

### CompanyMembership

**Existing model**: `CompanyMembership`

Relevant fields:

- `companyId`, `userId`: unique membership identity.
- `role`: `OWNER | HR_MANAGER | RECRUITER | HIRING_MANAGER`.
- `status`: must be `ACTIVE`.
- `version`, `stateChangedAt`, `removedAt`: authority lifecycle evidence.

Feature permission rules:

| Role | Read board | Ordinary move | Reject | Offer Declined | Confirm Hired |
|------|------------|---------------|--------|----------------|---------------|
| OWNER | Yes | Yes | Yes | Yes | Yes |
| HR_MANAGER | Yes | Yes | Yes | Yes | Yes |
| RECRUITER | Yes | Yes | Yes | Yes | Yes |
| HIRING_MANAGER | Yes | Yes | Yes | Yes | Yes |

The membership's user must also be an active, non-deleted `UserAccount`.

### JobPosting

**Existing model**: `JobPosting`

Relevant fields:

- `id`: canonical foreign-key identity used by `JobApplication.jobPostingId`.
- `companyId`: tenant owner.
- `title`: board context and notification copy.
- `status`: canonical lifecycle. Feature 019 permits `ACTIVE` and `CLOSED` pipelines.
- `closedAt`, `removedAt`: distinguish closed from unavailable/removed.
- `applications`: applications grouped by stage.

### JobPostReviewAggregate

**Existing model**: `JobPostReviewAggregate`

Relevant fields:

- `jobId`: stable JSON catalogue/Recruiter route reference.
- `companyId`: authoritative owning company.
- `publicJobPostingId`: unique link to canonical `JobPosting.id`.
- `closedAt`: review-managed closure evidence.

This relation is the authoritative compatibility mapping when a Recruiter-selected catalogue `jobId` is not itself a `JobPosting.id`.

### JobApplication

**Existing model**: `JobApplication`

Relevant fields:

- `id`: application/card identity.
- `candidateUserId`: relation to `CandidateIdentity` and display-safe user data.
- `jobPostingId`: canonical job relation.
- `stage`: one canonical recruitment stage.
- `stageVersion`: optimistic concurrency token, initially 1 and incremented once per committed transition.
- `lastStageChangedAt`: last committed stage timestamp.
- `submittedAt`: deterministic within-column ordering context.
- `profileSnapshot`, `cvSnapshot`, `jobSnapshot`: existing application submission snapshots; not returned wholesale on cards.
- `selectedCvId`, application documents, and cover-letter relation: existing authorized detail/document surfaces.
- `scoringStatus`, `currentScoringResultId`: optional score enrichment, separate from `stage`.

Relationships:

```text
Company 1 -> many JobPosting
JobPosting 1 -> many JobApplication
CandidateIdentity/UserAccount 1 -> many JobApplication

Company 1 -> many CompanyMembership -> 1 UserAccount

JobPostReviewAggregate.jobId (catalogue reference)
  -> JobPostReviewAggregate.publicJobPostingId
  -> JobPosting.id
  -> JobApplication.jobPostingId
```

### ApplicationStageEvent

**Existing model**: `ApplicationStageEvent`

Relevant fields:

- `applicationId`.
- `fromStage`, `toStage`.
- `actorUserId`, `actorType=RECRUITER`.
- `reasonCode`, `reasonLabelSnapshot`.
- `internalNoteEncrypted`: existing optional recruiter-private rejection note; never returned to candidates or notification channels.
- `occurredAt`, `applicationVersion`.
- `idempotencyKey`.
- `metadata`: stores bounded safe command metadata including version, source, and request-binding digest.
- `candidateVisibleReason`, `candidateVisible`: existing candidate history projection controls.

Existing constraints:

- unique `(applicationId, applicationVersion)` prevents two history results for one resulting version;
- unique `(applicationId, idempotencyKey)` prevents repeating one logical command.

### AuditEvent

**Existing model**: `AuditEvent`

Each committed transition records actor/session, action, target application, success result, timestamp, correlation ID, previous/new stage, resulting application version, and a safe reason code where applicable. Candidate identity, private note text, and raw idempotency keys are excluded.

### InAppNotification and EmailOutbox

**Existing models**: `InAppNotification`, `EmailOutbox`

- In-app notification: `APPLICATION_STAGE_CHANGED`, candidate recipient, application context, deduplication key based on application/resulting stage version.
- Email outbox: `APPLICATION_STAGE_CHANGED`, existing template `application-stage-changed.v1`, idempotency key based on application/resulting stage version.
- Ordinary email honors `AccountPreferences.applicationUpdatesEmail`.
- Hired always creates the email outbox record regardless of that optional preference.
- Delivery status/retry fields are independent from recruitment state.

## Read Projections (Not Persisted)

### ResolvedRecruiterJobContext

Server-only authorization result:

- `requestedJobId`: selector/route reference.
- `jobPostingId`: canonical persisted job identity.
- `companyId`.
- `jobTitle`.
- `jobStatus`: `ACTIVE | CLOSED`.
- `membershipRole`.
- `canView`, `canMoveStages`, `canReject`, `canRecordOfferDeclined`, `canConfirmHired`.

Invariant: exactly one canonical job and one company-scoped active membership must satisfy the context. The canonical ID is never inferred by title or unscoped slug.

### PipelineBoardMetadata

- selected job display context and lifecycle.
- role capability projection for UI rendering only.
- all nine `{ stage, label, count }` values, including zero-count stages.
- `observedAt` for refresh/reconciliation context.

Invariant: sum of counts equals the number of applications visible under the same repository predicate used by stage pages.

### PipelineApplicationCard

Minimum card projection:

- `applicationId`.
- `candidate.displayName`, nullable safe `avatarUrl`.
- `submittedAt`.
- `stage`, `stageVersion`.
- `documents.cvAvailable`, `documents.coverLetterAvailable` for existing authorized detail actions.
- nullable `score` with state, final value, and band only when already available.
- `allowedDestinations`: server-calculated canonical destinations, empty for read-only roles.

Excluded: contact details, full profile/CV/cover letter, raw score evidence, private notes, internal reason text, audit context, company-private data, and notification payloads.

### PipelineStagePage

- `stage`.
- `items`: at most requested limit, maximum 100.
- `nextCursor`: signed cursor or null.
- `observedAt`.

Cursor binding includes schema version, canonical `jobPostingId`, stage, `submittedAt`, and application ID. A cursor cannot be replayed for another job/stage.

### ApplicationStageCommand

Logical command fields:

- selected job reference (path).
- application ID (path).
- actor/session (server session).
- required idempotency key (header).
- `targetStage`.
- `expectedStageVersion`.
- `confirmed` when required.
- `reasonCode` when required.
- optional `internalNote` only for Rejected.

Request binding digest includes all normalized logical fields. The digest, not raw private note or key, is retained in stage-event metadata.

### ApplicationStageCommandOutcome

- `applicationId`.
- `fromStage`, resulting `stage`.
- resulting `stageVersion`.
- `lastStageChangedAt`.
- `stageEventId`.
- `replayed`: whether this response reused an already committed exact result.
- updated `allowedDestinations` for the authorized actor.

An authorized stale-conflict response may include only current stage/version needed for recovery. Neutral unavailable responses do not reveal application existence or state.

## Canonical State Machine

| From | Allowed destinations |
|------|----------------------|
| APPLIED | VIEWED, SHORTLISTED, INTERVIEWING, OFFERED, REJECTED, WAITLISTED |
| VIEWED | SHORTLISTED, INTERVIEWING, OFFERED, REJECTED, WAITLISTED |
| SHORTLISTED | INTERVIEWING, OFFERED, REJECTED, WAITLISTED |
| INTERVIEWING | OFFERED, REJECTED, WAITLISTED |
| OFFERED | HIRED, OFFER_DECLINED, REJECTED, WAITLISTED |
| WAITLISTED | VIEWED, SHORTLISTED, INTERVIEWING, OFFERED, REJECTED |
| HIRED | none |
| OFFER_DECLINED | none |
| REJECTED | none |

Additional validation:

- Same-stage commands are invalid.
- Rejected requires `confirmed: true` and exactly one of the six existing rejection reason codes.
- Offer Declined requires `confirmed: true`, an existing-domain bounded reason, and source Offered.
- Hired requires `confirmed: true`, an eligible role, and source Offered. Candidate acceptance is not queried.
- Ordinary moves do not require confirmation unless a later authoritative domain rule already requires one.
- Every command compares `expectedStageVersion`; only one command for a given version can commit.
- Stage changes never update scoring fields or scoring history.

## Lifecycle and Failure Rules

- `ACTIVE` and `CLOSED` jobs retain authorized board access and valid decisions.
- Removed, missing, ambiguous, unmapped, company-mismatched, or unauthorized jobs are unavailable.
- Exact retry with the same binding returns the existing event/outcome.
- Same key with changed binding conflicts without mutation.
- Stale version conflicts without history, audit success, or notification.
- Invalid, cancelled, unauthorized, or failed commands create no successful transition event.
- Email provider failure changes outbox delivery state only; committed application/history/audit/in-app state remains intact.
