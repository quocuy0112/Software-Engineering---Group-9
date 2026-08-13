# Research: Submitted Candidates List & CV Access — Group 1

## Decision 1: Extend existing JobApplication

**Decision**: Treat current `JobApplication`, canonical stage contracts and candidate submission endpoint as sole authorities.

**Rationale**: The repository has advanced beyond the original `appliedJobIds[]` gap. A parallel Application would split identity, stages, idempotency and candidate tracking.

**Alternatives considered**: New Application table (duplicate authority); replace JobApplication wholesale (high migration risk); read JSON demo data (non-authoritative).

## Decision 2: Immutable application-owned artifacts

**Decision**: Promote exact validated CV/cover-letter bytes to purpose-separated application artifacts; never depend on mutable CandidateCv storage after submission.

**Rationale**: Feature 004 sources are temporary and CandidateCv may evolve. Recruiters require the exact submission evidence.

**Alternatives considered**: Current profile CV; indefinite Feature 004 retention; PostgreSQL byte storage.

## Decision 3: Atomic APPLIED state and audit

**Decision**: Commit JobApplication, `APPLIED`/version 1, initial stage event, immutable bindings, idempotency, promotion state, and content-minimized success audit in one transaction after successful promotion. Assign correlation before validation and record a separate allowlisted failure audit after rollback for every rejected or failed attempt. Retain both outcomes under the 365-day shared audit policy.

**Rationale**: This preserves canonical state, prevents an accepted UI outcome without evidence/audit, and audits unsuccessful attempts without committing partial application data.

**Alternatives considered**: Audit after commit; stage inferred on reads; separate application creation service.

## Decision 4: Retention calculation

**Decision**: Compute document retention from the later of job closure or terminal application state; logically deny exactly at 12 months and purge within 30 days.

**Rationale**: It gives a deterministic recruitment-purpose window while separating access authority from asynchronous cleanup.

**Alternatives considered**: Permanent retention; worker-time denial; submission-only deadline.

## Decision 5: Restricted legal holds

**Decision**: Legal hold may postpone minimum physical deletion but never restores ordinary recruiter access after the normal deadline.

**Rationale**: Legal preservation and least-privilege recruiter access are separate concerns.

**Alternatives considered**: Hold extends recruiter access; unbounded hold with no review; deletion despite valid hold.

## Decision 6: Leased cleanup and orphan reconciliation

**Decision**: Use the existing PostgreSQL worker pattern with leases, idempotent finalize, bounded retries, half-deadline warning and hard-deadline critical signal; failed-submission orphans delete within 24 hours.

**Rationale**: External deletion cannot be part of the DB transaction and must recover without extending logical access.

**Alternatives considered**: Best-effort request cleanup; S3 lifecycle only; unbounded retry without alert.

## Decision 7: Authenticated byte routes

**Decision**: Reauthorize and stream bytes through server routes with no-store/nosniff headers and safe disposition.

**Rationale**: Current membership/job authority can change after list load; durable URLs would outlive it.

**Alternatives considered**: Public or long-lived signed URL; browser-provided object locator.

## Decision 8: Stable keyset pagination

**Decision**: Use `(submittedAt DESC, id DESC)`, opaque job-bound cursor, default 25/maximum 100 and no exact count.

**Rationale**: Bounded stable traversal meets the 10,000-row target without deep offset/count costs.

**Alternatives considered**: Offset pagination; load-all virtualization; timestamp-only cursor.

## Decision 9: Evidence-based legacy classification

**Decision**: Backfill existing JobApplication only when exact selected bytes/digest/version are provable; otherwise classify legacy-unavailable. Never synthesize from `appliedJobIds[]`.

**Rationale**: A current CV is not proof of what was submitted historically.

**Alternatives considered**: Substitute current CV; fabricate timestamp; silently omit without report.

## Decision 10: Versioned future scoring ownership

**Decision**: Later groups own versioned evaluation/provenance records; Group 1 ignores existing scalar scoring columns.

**Rationale**: Scores alone cannot retain required weights, thresholds, model/provider, prompt and policy versions.

**Alternatives considered**: Treat scalar fields as complete scoring authority; design Groups 2–4 now.
