# Data Model: Administrator Job Post Management

## Existing Authority

`JobPostReviewAggregate` remains the authority for review-managed job identity, company, approved live version, pending version, and public projection link. `JobPostReviewVersion` remains immutable review content. `JobPosting` remains the existing candidate-search projection.

## Additive Enums

| Enum | Values | Rule |
|---|---|---|
| `JobPostVisibilityState` | `PUBLISHED`, `HIDDEN`, `ARCHIVED` | `ARCHIVED` is not candidate-visible; it is recoverable only through an authorized restore. |
| `JobPostApplicationState` | `OPEN`, `CLOSED` | Controls new applications independently from visibility. |
| `JobPostOperationalAction` | `HIDE`, `RESTORE`, `CLOSE_APPLICATIONS`, `REOPEN_APPLICATIONS`, `ARCHIVE`, `REQUEST_CHANGES`, `SOFT_DELETE`, `FEATURE`, `UNFEATURE` | Server-only audited actions. |
| `JobPostFeatureState` | `SCHEDULED`, `ACTIVE`, `ENDED`, `CANCELLED` | Derived/evaluated against its time interval; `CANCELLED` cannot become active again. |
| `JobPostEnforcementType` | `HIDE_JOB`, `CLOSE_APPLICATIONS`, `REQUEST_CHANGES`, `SOFT_DELETE_JOB`, `SUSPEND_COMPANY`, `SUSPEND_RECRUITER` | A type determines required elevated authority and target validation. |
| `PlatformAdministratorScope` | `JOB_POST_MODERATE`, `JOB_POST_FEATURE`, `JOB_POST_ENFORCE` | Scope is evaluated in addition to active grant and step-up requirements. |

## Aggregate Extension: JobPostReviewAggregate

| Field | Type | Validation and behavior |
|---|---|---|
| `visibilityState` | `JobPostVisibilityState` | Defaults to `PUBLISHED` only after the first approval; new/rejected-only jobs are not candidate-visible. |
| `applicationState` | `JobPostApplicationState` | Defaults to `OPEN`; setting `CLOSED` never changes visibility. |
| `archivedAt`, `archivedByUserId` | nullable timestamp/reference | Set only by archive lifecycle action. |
| `hiddenAt`, `hiddenByUserId`, `hiddenReason` | nullable timestamp/reference/text | Set for hide; restore clears active hidden fields while history remains. |
| `softDeletedAt`, `softDeletedByUserId`, `softDeleteReason` | nullable timestamp/reference/text | Terminal ordinary-operation guard; only enforcement recovery policy may change it. |
| `applicationClosedAt`, `applicationClosedByUserId` | nullable timestamp/reference | Set for close; reopen clears active closure fields. |
| `activeCorrectionRequestId` | nullable unique reference | At most one unresolved request can require a next revision. |
| `operationalVersion` | positive integer | Shared optimistic concurrency version for post-management commands. Existing aggregate `version` is retained and incremented atomically with it while both APIs coexist. |

## JobPostRevisionRequest

| Field | Type | Rules |
|---|---|---|
| `id`, `aggregateId` | identifiers | One aggregate has many historic requests. |
| `liveVersionId` | review-version reference | Must be the aggregate approved version when created. |
| `requestedByAdminUserId` | user reference | Requires `JOB_POST_MODERATE`. |
| `publicExplanation` | bounded text | Visible to the authorized recruiter; no private note is stored here. |
| `hideImmediately` | boolean | If true, the request transaction also performs an auditable hide. |
| `state` | `OPEN`, `SATISFIED`, `CANCELLED` | `SATISFIED` is set only when a subsequent review version is approved. |
| `submittedRevisionId` | nullable version reference | Set when the recruiter submits the revision. |
| timestamps/version | timestamps/integer | Supports recovery and immutable timeline projection. |

## JobPostFeaturedPlacement

| Field | Type | Rules |
|---|---|---|
| `id`, `aggregateId` | identifiers | Relates one reviewed job to one placement interval. |
| `placement` | bounded configured identifier | Initial values are `HOME_FEATURED` and `SEARCH_FEATURED`; configuration supplies capacity. |
| `priority` | positive bounded integer | Lower number is earlier within a placement; it is not a global search override. |
| `startsAt`, `endsAt` | timestamps | `startsAt < endsAt`; interval overlap checks are atomic. |
| `state` | feature state | Mutations transition only through allowed values. |
| `reason`, `createdByAdminUserId`, `cancelledByAdminUserId` | text/references | Reason is mandatory; create requires `JOB_POST_FEATURE`. |
| `version` | positive integer | Used for amendment/cancel conflict detection. |

## JobPostEnforcementAction

| Field | Type | Rules |
|---|---|---|
| `id`, `correlationId`, `idempotencyKey` | identifiers | Actor-scoped idempotency binds command body and target set. |
| `type`, `result` | enforcement type/result | Result captures success, no-op replay, or denial-safe result. |
| `actorAdminUserId`, `actorSessionId` | references | Requires `JOB_POST_ENFORCE` for destructive and cross-target actions. |
| `reason` | bounded normalized text | Mandatory and never placed in ordinary notification payloads. |
| `occurredAt` | timestamp | Immutable operational evidence. |
| `targets` | normalized child rows | Each target has type, reference, prior state, and resulting state. |

## ModerationReportEnforcementLink

Composite primary key `(moderationReportId, enforcementActionId)` links report evidence to an action. Links are immutable after the action succeeds. One report may link to many actions and one action may link to many reports.

## JobPostOperationalHistory

Append-only record for every lifecycle, correction, feature, and enforcement-related transition. It includes aggregate, optional target entity, actor, action, prior and resulting visibility/application/feature state, safe reason category, correlation ID, operation version, and time. It is the detail timeline source; `AuditEvent` remains cross-domain evidence.

## Relationships

```text
JobPostReviewAggregate 1--* JobPostReviewVersion
JobPostReviewAggregate 1--* JobPostRevisionRequest
JobPostReviewAggregate 1--* JobPostFeaturedPlacement
JobPostReviewAggregate 1--* JobPostOperationalHistory
JobPostReviewAggregate 1--* JobPostEnforcementTarget
JobPostEnforcementAction 1--* JobPostEnforcementTarget
ModerationReport *--* JobPostEnforcementAction
PlatformAdministratorGrant *--* PlatformAdministratorScope
```

## State Transition Matrix

| Command | Required scope | From | To | Candidate effect |
|---|---|---|---|---|
| Hide | `JOB_POST_MODERATE` | `PUBLISHED` | `HIDDEN` | Not discoverable/readable. |
| Restore | `JOB_POST_MODERATE` | `HIDDEN` or `ARCHIVED` | `PUBLISHED` | Visible only if not soft deleted and deadline/company gates pass. |
| Close applications | `JOB_POST_MODERATE` | `OPEN` | `CLOSED` | Existing page may remain visible; new applications blocked. |
| Reopen applications | `JOB_POST_MODERATE` | `CLOSED` | `OPEN` | Requires eligible company, future deadline, visible non-deleted live job. |
| Archive | worker or `JOB_POST_MODERATE` | any non-deleted visibility | `ARCHIVED` | Not candidate-visible; recoverable. |
| Request changes | `JOB_POST_MODERATE` | any live version | correction request `OPEN` | Live content unchanged unless `hideImmediately`. |
| Soft delete | `JOB_POST_ENFORCE` | any | terminal deleted | Not candidate-visible or ordinarily restorable. |
| Feature/unfeature | `JOB_POST_FEATURE` | eligible live job | interval state change | Does not bypass other gates. |

## Integrity Rules and Indexes

- At most one `OPEN` correction request per aggregate.
- At most one active feature interval conflict check per placement and time range, protected by a placement advisory/row lock and a targeted overlap index.
- `softDeletedAt IS NOT NULL` blocks restore, open applications, and feature activation.
- A feature interval requires a current approved version, `PUBLISHED` visibility, `OPEN` application state, an eligible company, and an unexpired deadline at activation time.
- Report summary queries use grouped active `ModerationReport` data with indexes on `(jobReference, state, priority, createdAt)` and do not return reporter identity to list rows.
