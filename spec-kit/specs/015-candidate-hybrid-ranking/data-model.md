# Data Model: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

## Existing JobApplication (extended)

`JobApplication` remains the sole submission and pipeline aggregate defined by Group 1. No parallel application or stage record is introduced.

| Field | Rule |
|---|---|
| existing identity/candidate/job fields | Preserved unchanged; existing unique candidate-job authority remains |
| `stage` | Existing canonical enum; changed only by validated application decision commands |
| `stageVersion` | Existing optimistic-concurrency value; increments once per committed transition |
| `currentScoringResultId` | Nullable FK to one immutable published scoring aggregate; old pointer remains during rescore |
| `scoringGeneration` | Monotonic per application; compare-and-set publication fences stale workers |
| existing scalar scoring fields | Non-authoritative compatibility fields; never sufficient for reads/audit and not hand-edited |

Indexes add `(jobPostingId, currentScoringResultId, submittedAt DESC, id DESC)` without removing Group 1 `(jobPostingId, submittedAt DESC, id DESC)`.

## ApplicationScoringResult

Immutable published scoring aggregate.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `jobApplicationId` | Required FK to existing `JobApplication` |
| `generation` | Positive monotonic value unique per application |
| `operationId` | Required FK to initial/rescore/retry operation |
| `automaticMatchResultId` | Required immutable deterministic result |
| `aiAssessmentId` | Nullable only for deterministic fallback |
| `automaticScore` | Decimal 0–100 copied for projection integrity |
| `aiScore` | Nullable decimal 0–100; null unless AI succeeded |
| `finalScore` | Nullable decimal 0–100; exists iff AI score exists and lineage matches |
| `state` | `DETERMINISTIC_ONLY` or `SCORED`; persisted state is never `PENDING` |
| `formulaVersion` | Required approved formula identifier |
| `automaticWeight`, `aiWeight` | Exactly 0.60 and 0.40 for this feature |
| `highThreshold`, `mediumThreshold` | Exactly 80 and 60 for this formula version |
| `roundingRule` | One-decimal, round-half-up after weighted sum |
| `jobDescriptionVersionId`, `cvSnapshotVersionId` | Required exact input lineage |
| `scoringConfigVersionId`, `parserBundleVersion` | Required deterministic configuration lineage |
| `mayBeIncomplete`, `incompletenessLabel` | True/non-empty when either source parse is not fully successful |
| `computedAt`, `publishedAt` | Server times; publication is atomic |
| `supersededAt` | Nullable history marker; does not mutate component values |

Constraint: `finalScore IS NOT NULL` iff `aiAssessmentId` and `aiScore` are non-null; formula/component/config lineage must agree. Unique `(jobApplicationId, generation)`.

## AutomaticMatchResult

| Field | Rule |
|---|---|
| `id` | Primary key; immutable |
| `jobApplicationId` | Required application scope |
| `jobDescriptionVersionId`, `cvSnapshotVersionId` | Exact snapshots |
| `scoringConfigVersionId`, `parserBundleVersion` | Exact algorithm/config lineage |
| `score` | Decimal 0–100, reproducible from normalized inputs |
| `requiredSkillPoints`, `experiencePoints`, `preferredSkillBonus` | Versioned bounded components; preferred input remains neutral and cannot erase required criteria |
| `minimumExperienceYears` | Nullable JD value |
| `detectedExperienceYears` | Nullable; null is projected as `Not detected` |
| `experienceInterpretationCode`, `experienceInterpretationLabel` | Explicit outcome; no color-only meaning |
| `computedAt` | Server time |

## DocumentParseResult

One immutable parse result per document snapshot/parser version.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `documentKind` | `CV` or `JOB_DESCRIPTION` |
| `applicationDocumentId` | Required for CV and resolves only through Group 1 authority |
| `jobDescriptionVersionId` | Required for JD |
| `snapshotVersion` | Required source version |
| `parserName`, `parserVersion`, `schemaVersion` | Required provenance |
| `status` | `PARSED_SUCCESSFULLY`, `PARSED_WITH_ERRORS`, or `FAILED` |
| `processingMilliseconds` | Non-negative measured time |
| `safeIssueCodes` | Allowlisted codes; no raw document text/error |
| `parsedAt` | Server time |

Exactly one source binding applies according to `documentKind`.

## SkillEvidenceExtraction

| Field | Rule |
|---|---|
| `id` | Primary key |
| `automaticMatchResultId` | Required parent |
| `skillCanonicalId`, `skillLabel` | Versioned normalized skill identity and display label |
| `requirementKind` | `REQUIRED` or `PREFERRED` |
| `matchState` | `FOUND`, `MISSING`, or `NEUTRAL_PREFERRED` |
| `normalizationVersion` | Required skill taxonomy version |
| `createdAt` | Server time |

Unique `(automaticMatchResultId, skillCanonicalId, requirementKind)`.

## CvEvidenceExcerpt

| Field | Rule |
|---|---|
| `id` | Primary key |
| `skillEvidenceExtractionId` | Required parent |
| `excerptEncrypted` | Minimum verbatim CV span; recruiter-only |
| `pageNumber` | Positive when page-stable source exists |
| `sectionLabel` | Required when page is unavailable; at least one reference is present |
| `sourceStart`, `sourceEnd` | Optional validated offsets in parser snapshot |
| `cvSnapshotVersionId`, `parserVersion` | Required matching provenance |
| `createdAt`, `accessDeniedAt`, `deleteAfter`, `deletedAt` | Same purpose deadline as source application evidence |

Missing skills have zero excerpts; excerpts are never fabricated.

## AiAssessment

| Field | Rule |
|---|---|
| `id` | Primary key; immutable successful assessment |
| `jobApplicationId`, `automaticMatchResultId` | Required compatible context |
| `score` | Decimal 0–100 |
| `confidencePercent` | Integer 0–100 |
| `confidenceLevel` | `LOW` below 70, otherwise `STANDARD` |
| `confidenceLabel`, `humanReviewGuidance` | Required textual semantics; guidance required for `LOW` |
| `providerAdapterVersion`, `providerModel`, `modelVersion` | Required provider provenance |
| `promptVersion`, `assessmentSchemaVersion`, `sensitiveAttributePolicyVersion` | Required instruction/policy provenance |
| `overallSummaryEncrypted` | AI-generated label applied on projection |
| `technicalAbilitySummaryEncrypted`, `roleFitSummaryEncrypted`, `deductionSummaryEncrypted` | Three concise breakdown lines |
| `complianceStatementCode`, `complianceStatementLabel` | Required; label states sensitive personal attributes are excluded |
| `questionState` | `GENERATED` or `INSUFFICIENT_DATA` |
| `questionFallbackLabel` | Required iff insufficient data |
| `computedAt`, `accessDeniedAt`, `deleteAfter`, `deletedAt` | Purpose lifecycle aligned with source evidence |

Raw provider request/response is not an entity and is not retained.

## AiAssessmentFinding

| Field | Rule |
|---|---|
| `id` | Primary key |
| `aiAssessmentId` | Required parent |
| `kind` | `STRENGTH` or `POINT_TO_VERIFY` |
| `titleEncrypted`, `evidenceEncrypted` | Required concise title and source-grounded explanation |
| `ordinal` | Stable display order |

## AiSuggestedInterviewQuestion

| Field | Rule |
|---|---|
| `id` | Primary key |
| `aiAssessmentId` | Required parent |
| `pointToVerifyFindingId` | Required source finding |
| `questionEncrypted` | Job-relevant question; never a decision instruction |
| `ordinal` | Stable order |

## ScoringOperation

| Field | Rule |
|---|---|
| `id` | Primary key |
| `kind` | `INITIAL`, `JOB_RESCORE`, or `AI_RETRY` |
| `jobPostingId`, `jobApplicationId` | Job required; application required only for retry/initial item context |
| `requestedByUserId`, `requestedAt` | First-class actor/time |
| `confirmationIntent`, `idempotencyKey` | Required and unique within actor/job command scope |
| `targetJobDescriptionVersionId`, `targetScoringConfigVersionId` | Required target lineage |
| `reusedAutomaticMatchResultId` | Required only for AI retry |
| `state` | `QUEUED`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_FAILURES`, or `FAILED` |
| `totalCount`, `succeededCount`, `deterministicOnlyCount`, `failedCount`, `supersededCount` | Non-negative reconciled counters |
| `startedAt`, `completedAt` | Lifecycle times |

## ScoringWorkItem and AiAssessmentAttempt

| Field | Rule |
|---|---|
| `id` | Primary key |
| `operationId`, `jobApplicationId` | Unique work item per operation/application |
| `state` | `QUEUED`, `LEASED`, `AUTOMATIC_READY`, `AI_PENDING`, `PUBLISHED`, `DETERMINISTIC_ONLY`, `FAILED`, or `SUPERSEDED` |
| `leaseOwner`, `leaseExpiresAt` | Bounded ownership; stale workers cannot publish |
| `attemptCount`, `consecutiveAiFailureCount` | Bounded retry/support metadata |
| `lastSafeFailureCode` | Allowlisted content-free code |
| `nextAttemptAt`, `startedAt`, `completedAt` | Scheduling/lifecycle times |

Each AI attempt additionally records provider adapter/model/prompt versions, deadline, safe outcome, and time; it never stores raw payloads.

## ManualApplicationPriority

Immutable temporal priority history.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `jobApplicationId` | Required existing application |
| `value` | `HIGH`, `NORMAL`, `LOW`, or `HOLD` |
| `reasonEncrypted` | Required normalized non-blank recruiter reason |
| `setByUserId`, `setAt` | Required actor/server time |
| `version` | Positive application-local optimistic concurrency value |
| `active` | Exactly one active row per application |
| `removedByUserId`, `removedAt`, `removalReasonEncrypted` | All null while active; all required on removal |

Partial unique constraint: one row where `active=true` per application. Rescore has no FK or mutation path to this table.

## Existing ApplicationStageEvent (extended fields)

The existing entity remains canonical; these fields add decision detail rather than create a new transition model.

| Field | Rule |
|---|---|
| existing `jobApplicationId`, `fromStage`, `toStage`, version, actor, timestamp | Preserved authority; transition and application update commit together |
| `decisionKind` | Nullable for legacy events; `MOVE_TO_INTERVIEW` or `REJECT` here |
| `reasonCode` | Required allowlisted code for reject; `RECRUITER_CONFIRMED_INTERVIEW` for interview |
| `reasonLabelSnapshot` | Versioned reportable label |
| `internalNoteEncrypted` | Optional only for reject; recruiter-only and never notification content |
| `notificationRequired` | True only for interview command here |
| `notificationStatus` | `NOT_REQUIRED`, `PENDING`, `SENT`, or `FAILED_RETRYING` |
| `idempotencyKey` | Unique within application/decision command scope |

### RejectionReasonCode

Allowlisted, versioned values: `REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED`, `INSUFFICIENT_EXPERIENCE`, `REQUIRED_SKILLS_NOT_DEMONSTRATED`, `POSITION_FILLED`, `APPLICATION_WITHDRAWN_BY_CANDIDATE`, `OTHER_JOB_RELATED_REASON`. `OTHER_JOB_RELATED_REASON` still requires a reportable reason label; subjective protected-attribute proxies such as culture fit are not accepted.

## Existing AuditEvent (extended structured detail)

Existing audit authority stores action `SCORING_RESCORE_REQUESTED`, `AI_RETRY_REQUESTED`, `MANUAL_PRIORITY_SET`, `MANUAL_PRIORITY_REMOVED`, `APPLICATION_MOVED_TO_INTERVIEW`, or `APPLICATION_REJECTED`; actor, application/job target, safe result, server timestamp, first-class reason code where applicable, correlation, and operation/stage-event identifier. It excludes CV excerpts, AI prose, internal notes, provider payloads, document locators, and sensitive attributes.

## Existing CandidateNotification / Outbox

Move-to-interview inserts one outbox intent uniquely keyed by stage-event ID and notification kind. `notified=true` is projected only after confirmed delivery; pending/failure is not misreported. Reject creates no candidate notification in this feature, and internal note is structurally unavailable to notification serialization.

## RecruiterCandidateRanking Projection

Extends Group 1 safe row with current stage/version, typed score state, score/band labels when valid, parsing warning, active manual-priority label, rescore indicator, and allowed-action descriptors. It contains no evidence excerpt or internal note. Filter metadata returns normalized removable chips and processing-exclusion count/label.

## State Machines

### Scoring lifecycle

```text
NOT_CALCULATED
  -> PENDING (list row: PROCESSING before any published result)
     -> SCORED (automatic + AI + final published)
     -> UNAVAILABLE (automatic published; AI failed; final NOT_CALCULATED)

UNAVAILABLE
  -> PENDING (AI-only retry; automatic remains published)
     -> SCORED
     -> UNAVAILABLE

SCORED or UNAVAILABLE
  -> PENDING_RESCORE (old published result remains current/readable)
     -> SCORED successor
     -> UNAVAILABLE successor (new automatic, failed AI)
     -> prior published result remains if item fails before safe publication
```

`Processing` is a list-row representation only for initial/pending work with no published result. It is not stored as a completed aggregate state.

### Rescore batch lifecycle

```text
QUEUED -> RUNNING
  -> COMPLETED (including zero items)
  -> COMPLETED_WITH_FAILURES (isolated deterministic-only/failed items)
  -> FAILED (batch infrastructure cannot enumerate/process safely)

RUNNING item: QUEUED -> LEASED -> AUTOMATIC_READY -> AI_PENDING
  -> PUBLISHED | DETERMINISTIC_ONLY | FAILED | SUPERSEDED
```

### Manual-priority lifecycle

```text
NONE -> ACTIVE(v1)
ACTIVE(vN) -> CLOSED + ACTIVE(vN+1)
ACTIVE(vN) -> REMOVED(vN) -> NONE

stale expected version -> CONFLICT (no mutation)
rescore -> no transition and no mutation
```

## Constraints

1. Score component/result rows are immutable; no recruiter/API hand-edit exists.
2. Full rescore may publish a successor automatic/AI/final aggregate; AI retry reuses the exact automatic result and replaces only AI/final lineage.
3. One current scoring-result pointer, one active manual priority, and one current canonical stage exist per application.
4. Final score cannot exist without successful compatible components and exact formula/config provenance.
5. Priority and stage writes require actor/time/reason semantics, idempotency, tenant authority, and expected version.
6. Stage transition and canonical event/audit/outbox intent are one transaction; scores cannot call this transaction.
7. Source-derived content is logically denied and physically deleted with Group 1 document retention; legal hold postpones physical deletion only and never ordinary access.
8. Ranking snapshots are immutable for cursor lifetime and expire on a bounded schedule; cursor expiry returns an explicit restart requirement.

## Migration Rules

1. Preflight canonical stage values/version/events and Group 1 artifact bindings; abort on inconsistent authority.
2. Add tables/enums/indexes and nullable current pointer; do not rename/remove Group 1 fields or paths.
3. Treat all existing scalar scores as non-authoritative; do not backfill a published result without full reproducible lineage.
4. Initialize applications without valid lineage as `Not calculated`; background initial scoring is explicit and observable.
5. Deploy schema, readers, provider adapter, worker, and recovery controls before enabling commands/UI.
6. Roll back entry points/work intake only; keep published results, retention, stage history, audit, and notification delivery intact; recover through forward migration.
