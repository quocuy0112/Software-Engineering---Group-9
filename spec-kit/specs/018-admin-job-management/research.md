# Research: Administrator Job Post Management

## Decision: Keep approval versions separate from post-publication operations

- **Decision**: Reuse `JobPostReviewAggregate.approvedVersionId` as the immutable live-content authority and add operational state alongside it rather than adding operational states to `JobPostReviewState`.
- **Rationale**: Review approval has three states (`PENDING_REVIEW`, `APPROVED`, `REJECTED`) and must continue to answer whether a version is eligible to be live. Visibility, application intake, archival, and enforcement are independent post-publication concerns.
- **Alternatives considered**: Expanding `JobPostingStatus` into every combined state was rejected because it cannot represent hidden/open and published/closed combinations cleanly.

## Decision: Preserve a live version during correction requests

- **Decision**: A request-change action records its reason and optional immediate hide against the aggregate. Recruiter edits submit a normal distinct pending review version; approval atomically replaces the aggregate's approved version. The prior approved version remains live until approval unless visibility is hidden.
- **Rationale**: This preserves candidate-facing content and prevents an unreviewed correction from becoming public.
- **Alternatives considered**: Editing the live snapshot in place and automatically hiding every correction request were rejected because each loses either immutable review history or expected availability.

## Decision: Add independent visibility and application dimensions

- **Decision**: Persist `visibilityState` (`PUBLISHED`, `HIDDEN`, `ARCHIVED`) and `applicationState` (`OPEN`, `CLOSED`) with a single operational version on the review aggregate; derive and synchronize the existing public `JobPosting.status` for compatibility.
- **Rationale**: The aggregate already owns review-managed lifecycle facts. The public projection must remain readable by existing job search and application code.
- **Alternatives considered**: Replacing all existing `JobPosting.status` consumers was rejected because it would broaden scope and risk current job-board behavior.

## Decision: Archive and soft delete have separate policies

- **Decision**: Archive is a reversible normal lifecycle action, including retry-safe expiration processing. Soft delete is a terminal enforcement action requiring elevated authority, a nonempty reason, a confirmation, and distinct audit evidence.
- **Rationale**: Operators need predictable recovery for natural expiry and stronger controls for violations.
- **Alternatives considered**: Treating archive as delete was rejected because recruiter and candidate history must remain recoverable.

## Decision: Model enforcement as an aggregate linked many-to-many to reports

- **Decision**: Create `JobPostEnforcementAction` and `ModerationReportEnforcementLink`. Existing report history retains legacy correlation data but no longer carries the authoritative relationship.
- **Rationale**: One action can resolve duplicate reports and one report can require separate job, company, and recruiter actions.
- **Alternatives considered**: A single `enforcementCorrelationId` field was rejected because it cannot express cardinality or relational integrity.

## Decision: Enforce featured capacity transactionally

- **Decision**: Store bounded feature windows with placement, priority, state, creator, reason, and time bounds. A transaction locks the placement schedule, checks overlap against configured capacity, and creates or changes exactly one interval.
- **Rationale**: Application-side availability checks alone allow concurrent admins to overbook a placement.
- **Alternatives considered**: Unbounded manual featured flags and feature-as-search-rank overrides were rejected because they are not governable or deterministic.

## Decision: Reuse administrator command safeguards and notifications

- **Decision**: Route all mutating post-management commands through `AdminRequestBoundary` and `PrismaAdminCommandRepository`, using CSRF, step-up, expected aggregate version, idempotency, audit events, and safe in-app notifications.
- **Rationale**: These protections already govern job-review decisions and moderation commands.
- **Alternatives considered**: Direct CRUD update endpoints were rejected because they would bypass conflict recovery and command receipts.

## Decision: Introduce explicit scoped authority

- **Decision**: Define additive grant scopes for `JOB_POST_MODERATE`, `JOB_POST_FEATURE`, and `JOB_POST_ENFORCE`; preserve existing active platform administrators by granting the least compatible scope through migration/seed policy documented in the implementation.
- **Rationale**: Feature promotion and destructive enforcement require higher or different authority than ordinary queue review.
- **Alternatives considered**: Treating all active administrators as equally privileged was rejected because the feature explicitly requires role separation.

## Decision: Run expiry through the existing admin worker

- **Decision**: Add a bounded, retry-safe post lifecycle loop to the existing long-lived admin worker and a manual verification entrypoint.
- **Rationale**: The admin worker already hosts recurring operational loops; no new service topology is required.
- **Alternatives considered**: Browser-triggered expiration and a new standalone worker were rejected because they are unreliable or unnecessary.
