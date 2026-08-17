# Data Model: Recruitment Analytics & Data Export

## Conventions

- PostgreSQL is authoritative. All instants are stored in UTC; report bucketing applies the requested/displayed time zone.
- Report ranges are half-open `[from,to)`. `dataCutoff` is captured once and all projections use data no later than it.
- IDs are opaque. Tenant-scoped rows always carry or resolve a company id. Sensitive files use opaque branded storage locators.
- New enum/state values are illustrative domain names; exact persistence names are fixed in implementation contracts and migrations.

## Existing Authoritative Entities

### UserAccount and CandidateIdentity

Relevant fields: account id, name, email, account state, created timestamp, deleted timestamp, Candidate identity, and Candidate profile phone. Registration trends use account creation. Candidate export does not read later live profile values; it uses the immutable contact snapshot captured on `JobApplication` at submission.

### Company and CompanyMembership

Relevant fields: company id, verification state, membership user/company, role, status, and state-change timestamps. Employer access requires an active membership in an active verified company and one of OWNER, HR_MANAGER, RECRUITER, or HIRING_MANAGER.

### JobPosting

Relevant fields: id, company id, title/reference, status, creation/publish/close/removal timestamps, and current version. Current state remains authoritative; historical active-at-bucket calculations use lifecycle facts below.

### JobApplication and ApplicationStageEvent

Relevant fields: application id, posting id, candidate id, contact snapshot, submitted timestamp, current stage/version, current published scoring-result reference, and stage events with from/to stage, actor, version, and occurrence time. Unique candidate/posting identity remains unchanged.

Canonical stages: APPLIED, VIEWED, SHORTLISTED, INTERVIEWING, OFFERED, HIRED, OFFER_DECLINED, REJECTED, WAITLISTED. Analytics never creates a parallel stage model.

### ApplicationScoringResult

Relevant fields: application id, final score, state, computed/published/superseded timestamps, weights/threshold/provenance references. Only the current published result is exportable; otherwise the score is unavailable.

### AuditEvent

Relevant fields: actor type/user/session, action, target type/id, result, correlation id, privacy-reduced context, and occurrence timestamp. Required analytics/export actions extend the strict action/target/context contracts.

## New Entities

### JobPostingViewFact

Represents an admitted or excluded posting observation needed for deterministic view metrics.

| Field | Rules |
|---|---|
| id | Opaque unique identifier |
| jobPostingId, companyId | Required; resolve to the authoritative posting/company |
| occurredAt | Required UTC instant |
| platformDay | Required local calendar date under the recorded time-zone policy |
| visitorDayDigest | Versioned HMAC digest; never raw visitor identity |
| digestVersion | Required policy/key version |
| qualification | QUALIFIED, OWNER_PREVIEW, AUTOMATED, INVALID |
| qualificationPolicyVersion | Required definition version |
| createdAt | Required |

Uniqueness: at most one QUALIFIED fact for `(jobPostingId, platformDay, visitorDayDigest, digestVersion)`. Excluded observations may be kept only when operationally necessary and under a short privacy policy; aggregate correctness must not require raw request data.

### JobPostingLifecycleFact

Represents an append-only lifecycle transition used to reconstruct posting state at a bucket end.

| Field | Rules |
|---|---|
| id | Opaque unique identifier |
| jobPostingId, companyId | Required |
| fromStatus, toStatus | Canonical posting lifecycle states; initial baseline may have no fromStatus |
| effectiveAt | UTC occurrence time |
| postingVersion | Required and unique per posting |
| actorUserId | Nullable only for system/baseline events |
| correlationId | Required idempotency/audit correlation |
| createdAt | Required |

Transitions are appended in the same transaction as the authoritative posting state change. A migration records one baseline fact for existing postings and publishes that instant as `analyticsAvailableFrom`; report ranges beginning earlier are rejected because pre-baseline state is not inferred.

### ExportRequest

Represents request, work lease, artifact metadata, and 24-hour access lifecycle.

| Field | Rules |
|---|---|
| id | Opaque unique identifier |
| requesterUserId, companyId, jobPostingId | Required ownership/scope |
| format | CSV or XLSX |
| filters, rangeStart, rangeEnd, timeZone | Validated normalized snapshot; no arbitrary PII |
| dataCutoff | Captured once at admission |
| definitionVersion | Required |
| status | QUEUED, LEASED, SUCCEEDED, FAILED, EXPIRED, DELETING, DELETED |
| idempotencyKey | Unique per requester/business request scope |
| leaseOwner, leaseExpiresAt, attemptCount | Bounded worker coordination |
| storageLocator | Nullable until successful publication; branded export locator |
| fileName, mediaType, byteCount, checksum | Required on success |
| rowCount | Required non-negative count on success |
| failureCode | Allow-listed, non-sensitive terminal/retry code |
| requestedAt, startedAt, completedAt | Lifecycle timestamps |
| expiresAt | Exactly 24 hours after successful completion |
| inaccessibleAt, deletedAt | Access denial and physical cleanup evidence |
| version | Optimistic concurrency |

State transitions:

```text
QUEUED -> LEASED -> SUCCEEDED -> EXPIRED -> DELETING -> DELETED
                 \-> QUEUED       (bounded retry)
                 \-> FAILED       (terminal failure)
SUCCEEDED -> DELETING -> DELETED   (revocation/early cleanup)
```

No state exposes an artifact until checksum, bytes, row count, and storage publication are complete. Downloads require SUCCEEDED, current time before expiry, and fresh authorization.

### ActivityLegalHold

Represents an Administrator-authorized, purpose-limited exception to 24-month deletion.

| Field | Rules |
|---|---|
| id | Opaque unique identifier |
| scopeType, scopeReference | Narrow event/account/company/action/time scope |
| reasonCategory | Allow-listed; no unnecessary case narrative |
| authorizedByAdminUserId | Required |
| startsAt, endsAt | Required bounded interval; extension creates new evidence |
| releasedAt | Optional early release |
| correlationId, createdAt | Audit linkage |

The hold prevents eligible audit deletion only; it does not restore deleted source content or ordinary user access.

## Derived Projections

### AdminGrowthReport

Contains normalized range/grouping/time zone/cutoff/definition version and ordered buckets. Each bucket has new registrations, active postings at bucket end, submitted-application count, distinct submitting candidates, applications-per-candidate, cohort size, Hired-at-cutoff count, and success rate/null reason.

### JobPerformanceReport

Contains authorized posting summary, period qualified views, period submitted applications, conversion/null reason, current funnel as-of cutoff, and canonical stage count/percentage entries. Percentages derive from one funnel total.

### CandidateExportRow

Fixed columns: application id/reference, candidate name, email, and phone from the immutable application contact snapshot; application status; CV screening score; score availability; and application submission timestamp. Optional documented metadata columns are stable and versioned. Postal address, later live-profile values, and other profile fields are forbidden.

### ActivityProjection

Administrator-only projection: event id, timestamp, action, result, effective role, privacy-safe actor label/reference, target type/reference/label, and company context where applicable. It never contains exported candidate rows, contact details, session secrets, raw IP, or unrestricted audit context.

## Required Indexes and Integrity Rules

- View uniqueness and `(jobPostingId, occurredAt)` / `(companyId, occurredAt)` reporting indexes.
- Lifecycle uniqueness on `(jobPostingId, postingVersion)` and index on `(jobPostingId, effectiveAt)`.
- Application reporting indexes already cover job/stage/submitted time; verify cutoff event index `(applicationId, occurredAt, applicationVersion)`.
- Export worker indexes on `(status, leaseExpiresAt, requestedAt)` and cleanup indexes on `(status, expiresAt)`; unique requester/idempotency scope.
- Audit indexes on action/time, actor/time, target/time already exist; add retention/hold access paths only after query-plan verification.
- All migrations are additive first, seed/verify lifecycle baseline, deploy dual writes, then enable historical reads. Rollback disables readers/workers without deleting source facts.
