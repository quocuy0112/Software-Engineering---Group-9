# Research: Administrator Job-Post Review and Approval

**Date**: 2026-08-15

All planning unknowns are resolved. No external provider or AI capability is required.

## Decision 1: Retain JSON as a Working Catalogue, Not Review Authority

**Decision**: Keep the existing `jobs.json` content and stable IDs for Recruiter draft compatibility. At first submission or material edit, persist an immutable validated snapshot and all lifecycle state in PostgreSQL. Managed Recruiter/public reads overlay PostgreSQL authority and never trust mutable JSON `status` or `approvalComment`.

**Rationale**: This respects the requested no-migration boundary while satisfying transactional review state, audit, notification, concurrency, and public-visibility requirements.

**Alternatives considered**:

- Migrate all job content into `JobPosting`: rejected by the explicit feature constraint.
- Keep decisions only in JSON: rejected because critical state, audit, notification, and concurrent decisions could not be made transactionally authoritative.
- Treat JSON status plus database notification as dual authority: rejected because partial failure could publish unapproved content.

## Decision 2: Store Full Immutable Review Snapshots

**Decision**: Store the normalized allow-listed job content as a JSON snapshot with schema version and canonical SHA-256 identity for every submitted version.

**Rationale**: Administrators must decide the exact content they inspected, active edits must preserve the prior approved content, and later JSON changes must not rewrite history.

**Alternatives considered**:

- Store only a hash and reread JSON: rejected because the reviewed content could disappear or change.
- Copy only changed fields: rejected because reconstruction complicates full review, rollback, audit, and validation.

## Decision 3: Adopt Legacy Jobs Incrementally

**Decision**: Leave unmanaged legacy jobs unchanged. Adopt a job when it is submitted or materially edited. Capture an imported approved baseline for an active legacy job before reviewing its replacement. Provide a rerunnable command for existing pending/rejected JSON rows.

**Rationale**: Incremental adoption avoids a risky bulk migration across thousands of legacy rows while ensuring every new decision has exact authority.

**Alternatives considered**:

- Bulk snapshot every legacy job: rejected because it is outside scope and would manufacture approval history.
- Ignore existing pending/rejected rows: rejected because they would remain permanently undiscoverable to Administrators.

## Decision 4: Isolate JSON File Safety Behind One Repository

**Decision**: Replace direct `readFile`/`writeFile` use in job services with one JSON repository using a process queue, cross-process lease, checksum comparison, validated parse, temporary file, flush, and atomic replace.

**Rationale**: Multiple routes and process restarts must not corrupt the catalogue, and all compatibility writes need one deterministic recovery boundary.

**Alternatives considered**:

- Keep the current in-memory write queue only: rejected because it does not coordinate multiple processes.
- Introduce a second document database: rejected because it violates scope and architecture constraints.

## Decision 5: Use Explicit Submit and Administrator Command Endpoints

**Decision**: Preserve draft create/update routes and add a dedicated submit-review command. Add protected Administrator list/detail and claim/reassign/approve/reject commands with expected versions and idempotency keys.

**Rationale**: Draft persistence and review submission have different validation, authorization, atomicity, and retry semantics. Explicit commands prevent clients from forging status transitions.

**Alternatives considered**:

- Continue accepting arbitrary target status in the general PATCH body: rejected because it mixes Recruiter content with server-owned lifecycle authority.
- Generic unrestricted CRUD: rejected because review transitions require purpose-specific authorization and audit.

## Decision 6: Notify All Eligible Administrators, Then Claim

**Decision**: Fan out one generic deduplicated alert to every active Platform Administrator grant. The first valid claim owns the review; later reassignment is explicit, version-checked, and audited.

**Rationale**: Unassigned work remains discoverable without a separate scheduler, while claim concurrency prevents duplicate decisions.

**Alternatives considered**:

- Notify one random Administrator: rejected because no durable workload policy exists and work could be missed.
- Permit any Administrator to decide without claiming: rejected because simultaneous review ownership would be unclear.

## Decision 7: Keep Notifications Free of Job Content

**Decision**: Add `JOB_POST_REVIEW_REQUESTED_ADMIN`, `JOB_POST_APPROVED`, and `JOB_POST_REJECTED` with a `JOB_POST_REVIEW` context. Payloads contain only audience/state variables and an opaque review context ID.

**Rationale**: The destination reauthorizes and loads current data; notification rows do not need company names, job titles, reasons, evidence, or notes.

**Alternatives considered**:

- Embed title/company/rejection explanation: rejected due to stale data, privacy, payload growth, and recipient-loss risks.
- Reuse moderation-report kinds: rejected because user-submitted abuse reports and pre-publication quality review have different lifecycles and destinations.

## Decision 8: Separate Public Rejection Feedback from Private Notes

**Decision**: Require an allow-listed public reason code plus a 20-1,000 character normalized actionable explanation. Store an optional 1-2,000 character private note in a separate protected relation.

**Rationale**: Recruiters need useful corrections, while investigation or policy notes must remain least-privilege.

**Alternatives considered**:

- One shared comment: rejected because it invites accidental private-data disclosure.
- Reason code only: rejected because it is insufficiently actionable for resubmission.

## Decision 9: Preserve the Last Approved Version During Edits

**Decision**: A material active-job edit creates a pending snapshot while the prior approved snapshot remains public. Closure, expiry, and removal can suppress visibility independently.

**Rationale**: Public candidates never see unreviewed edits, and Recruiters can improve content without an avoidable publication gap.

**Alternatives considered**:

- Hide the job during every edit review: rejected because it creates unnecessary downtime.
- Apply edits immediately and review later: rejected because it bypasses human quality control.

## Decision 10: Recheck Eligibility at Every Critical Boundary

**Decision**: Submission rechecks verified-company membership; reads reauthorize the actor; approval rechecks Administrator assignment, grant, company verification, membership context, deadline, expected version, and content identity.

**Rationale**: Long-running reviews can outlive grants, memberships, deadlines, and company status.

**Alternatives considered**:

- Trust eligibility captured at submission: rejected because stale authority could publish a job.

## Decision 11: Outcome Notifications Follow Current Membership

**Decision**: Notify the original submitter only if that person still has qualifying membership at decision time. Otherwise send no direct detail; authorized company members discover the state through the workspace.

**Rationale**: Historical authorship does not preserve access after membership loss.

**Alternatives considered**:

- Always notify the submitter: rejected as cross-tenant disclosure.
- Fan out every outcome to all company members: rejected as unnecessary noise and broader disclosure.

## Decision 12: Reuse Existing Session, Admin, Audit, and Notification Boundaries

**Decision**: Better Auth remains the exclusive browser session. Reuse `AdminRequestBoundary`, the idempotent Administrator command repository, existing audit writer, notification service, and four-second Administrator polling.

**Rationale**: These are already tested authorities and avoid a second session, queue, or presentation transport.

**Alternatives considered**:

- New review token/session: rejected by the exclusive-session constitution rule.
- WebSocket review delivery: rejected because existing polling meets the five-second target.

## Decision 13: Measure Integrity Separately from Latency

**Decision**: Apply P95 targets to notification and interaction latency, but require 100% pass rates for authorization, isolation, idempotency, audit, approved-snapshot visibility, and privacy tests.

**Rationale**: Correctness and privacy cannot be percentile-based.

**Alternatives considered**:

- One combined performance success rate: rejected because it could conceal critical correctness failures.
