# Implementation Plan: Administrator Job Post Management

**Branch**: `018-admin-job-management` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/018-admin-job-management/spec.md`

## Summary

Add a protected Administrator Job Post Management resource for review-managed posts that have entered post-publication operation. The implementation extends the existing review aggregate with independent visibility and application state, preserves immutable approved and pending review versions, adds correction requests, bounded featured placements, separate enforcement actions, and many-to-many report links. Existing candidate search/application code continues to read its `JobPosting` projection; a transactional projector synchronizes compatibility status from authoritative operational state. React Admin gets a dense list/detail/action workflow while administrator commands reuse current CSRF, step-up, idempotency, audit, notification, and stale-conflict boundaries.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, React Admin 5.15, MUI 7.3, Better Auth 1.6, Vitest 4.1, Playwright

**Storage**: PostgreSQL is authoritative for operational state, immutable review versions, correction requests, features, enforcement, report links, audit events, and notifications. Existing `JobPosting` remains a derived candidate-search projection. JSON catalogue remains recruiter working content only.

**Testing**: Vitest unit, contract, integration, security, architecture, accessibility, and performance suites; targeted Playwright Administrator and candidate/recruiter workflow smoke tests.

**Target Platform**: Existing responsive Next.js recruiter/candidate workspace and desktop-oriented React Admin console hosted by the long-lived custom Node server.

**Project Type**: Existing monorepo web application with layered Route Handler, service, repository, shared-contract, Prisma, React Admin, and background-worker architecture.

**Performance Goals**: P95 list/detail and ordinary lifecycle command <=2 seconds over 10,000 managed jobs; P95 visibility propagation <=5 seconds; no over-capacity feature placements or duplicate command effects under concurrent command tests.

**Constraints**: Existing Job Post Reviews remains exclusive content-approval authority; no automatic moderation judgment; `visibilityState` and `applicationState` remain independent; soft delete requires elevated human authority; all mutations require current active admin grant, CSRF, step-up, expected version, idempotency, audit evidence, and safe error recovery; no reporter identity/private notes/applicant data in job list or notifications.

**Scale/Scope**: At least 10,000 managed jobs, dozens of concurrent administrators, bounded pages of <=100 rows, configured low-cardinality feature placements, up to 100 report links per enforcement command; unmanaged legacy catalogue jobs excluded initially.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Human-controlled recruitment | PASS | Moderation, lifecycle, features, corrections, and enforcement are initiated only by authorized humans; no AI decision exists. |
| Security, privacy, tenant isolation | PASS | Existing session, AdminRequestBoundary, current verified company checks, scoped admin grants, safe projections, and private-note exclusion are retained. |
| Deterministic core | PASS | Explicit state matrix, bounded commands, transactional capacity checks, deterministic projection mapping, and idempotency guard every authoritative transition. |
| State, audit, data integrity | PASS | Additive PostgreSQL models, version checks, command receipts, immutable history, audit events, and migration verification protect all critical writes. |
| Scope discipline and complete workflow | PASS | Delivers inspection, operation, correction, feature governance, reports/enforcement, candidate effects, recovery, and verification without billing or automated sanction scope. |
| Measurable quality and accessibility | PASS | P95 targets, conflict tests, keyboard controls, non-color states, performance script, and accessible React Admin views are planned. |
| Maintainable/provider-independent architecture | PASS | Route handlers delegate to contracts/services/repositories; existing custom server and admin worker are extended rather than bypassed. |

**Exclusive browser-session owner**: Existing Better Auth opaque database-backed session in secure HttpOnly cookies remains the only browser credential. All administrator commands use `AdminRequestBoundary`, same-origin request checks, CSRF proof, active grant, designated session, and 15-minute sensitive-action step-up policy.

**Post-design re-check**: PASS. The design retains PostgreSQL as the authority for all state, uses a single public projection pathway, preserves review-version immutability, and introduces no autonomous recruitment or moderation decision.

## Architecture and Ownership

```text
Administrator Console
  |-- Job Post Management list/detail
  |-- lifecycle, correction, feature, enforcement commands
  `-- /api/admin/job-postings/* Route Handlers
        `-- JobPostManagementService
              |-- AdminRequestBoundary and scope policy
              |-- PrismaAdminCommandRepository receipt/idempotency boundary
              |-- PrismaJobPostManagementRepository transaction
              |-- operational history + AuditWriter
              |-- safe notifications
              `-- public JobPosting compatibility projector

Job Post Review Workflow
  |-- immutable JobPostReviewVersion pending/approved decisions
  `-- approval projector swaps approved live version and satisfies correction request

Moderation Reports
  |-- existing report/notes/history
  `-- ModerationReportEnforcementLink <-> JobPostEnforcementAction

Admin Worker
  `-- post lifecycle loop archives expired jobs in bounded retry-safe batches

Candidate and Recruiter Readers
  |-- candidate search/detail/application read JobPosting compatibility projection
  `-- recruiter sees correction request and submits a separate review revision
```

### Operational State and Projection

1. `JobPostReviewAggregate` owns independent visibility/application state, all special dates, correction link, and operational version. It is never derived from mutable JSON fields.
2. `JobPosting.status` is a compatibility projection only: `ACTIVE` for published/open, `CLOSED` for published/closed, `REMOVED` for hidden/archived/soft-deleted candidate suppression. Candidate readers additionally join aggregate state where required so a stale projection cannot leak content.
3. The same transaction updates aggregate state, `JobPosting` compatibility state, operational history, `AuditEvent`, enforcement links, and notification outbox records. Command receipts replay an existing result and do not repeat writes or notifications.
4. `JobPostReviewAggregate.version` is the authoritative expected version exposed by management APIs. An additive operational version may be introduced only if compatibility with the job-review command protocol requires it; either form is always incremented in the same transaction.

### Correction and Version Flow

1. `REQUEST_CHANGES` creates an open correction request against the current `approvedVersionId`, with bounded public explanation and a visibility decision. Its default keeps the live version published.
2. Recruiter workspace reads the active correction request and labels edit submission as a revision; it creates the next normal `JobPostReviewVersion` through existing submission safeguards.
3. Approval of that version updates `approvedVersionId` and marks the linked correction request satisfied in the approval transaction. Rejection/cancellation leaves the old version live and the request visible to the authorized recruiter.
4. No management operation writes an immutable review snapshot or turns a pending version public.

### Scope Policy

1. All active administrators retain normal review access.
2. `JOB_POST_MODERATE` controls inspection, hide/restore, close/reopen, archive, and correction requests.
3. `JOB_POST_FEATURE` controls feature create/change/cancel.
4. `JOB_POST_ENFORCE` controls soft deletion and actions against company/recruiter authority; every enforcement still has an explicit human confirmation and reason.
5. Migration/seed compatibility grants the narrow minimum scope for existing operational administrator fixtures and requires explicit provisioning for elevated actions.

### Background Lifecycle

The existing admin worker processes a bounded oldest-first batch of eligible review-managed jobs whose live deadline has passed, using idempotent archive commands with a system actor/audit classification. It skips soft-deleted/previously archived jobs, reports metrics, and can be reconciled by a verification script.

## Data and Migration Strategy

1. Add enums/tables/relations/indexes described in [data-model.md](./data-model.md) through one additive migration. Do not rewrite existing review snapshots or job catalogue JSON.
2. Backfill existing approved review aggregates from their linked `JobPosting`: active becomes `PUBLISHED/OPEN`, closed becomes `PUBLISHED/CLOSED`, removed becomes `HIDDEN/CLOSED`, expired becomes `ARCHIVED/CLOSED`; record imported baseline operational history using a system migration actor without inventing human actions.
3. Verify every managed aggregate has exactly one compatible projection and no candidate-visible projection lacks a valid approved version.
4. Add rollback-safe feature flags/routes so operators can disable management commands while preserving new evidence. Rollback never deletes audit, enforcement, report-link, or history rows.
5. Configure featured placement capacity server-side with conservative initial capacities and explicit validation; no capacity is client-supplied.

## Security, Privacy, and Observability

- Server handlers parse strict Zod command discriminators and require exact path-command agreement, expected ETag/`If-Match`, idempotency key, active scoped grant, current session, CSRF, origin, and sensitive step-up.
- Unknown/cross-tenant jobs and reports use established neutral admin error envelopes without confirming existence.
- Detail joins bounded safe company/recruiter displays. It excludes email, phone, reports' reporter identity on list rows, private moderation notes, CVs, applications, company evidence, and credentials.
- All actions write audit events with actor, action, target, correlation, result, state transitions, and safe reason category. Private explanations and notes remain outside ordinary logs.
- Emit counters/timers for management list/detail, lifecycle outcomes, stale conflicts, capacity conflicts, report links, worker archives, projection repair, and authorization denials; extend performance measurement with dataset, concurrency, P50/P95/P99/max, error rate, and environment fields.

## Project Structure

### Documentation

```text
spec-kit/specs/018-admin-job-management/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/job-post-management.openapi.yaml
`-- tasks.md
```

### Source Code

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/0xx_admin_job_post_management/migration.sql
|-- scripts/
|   |-- verify-job-post-management-migration.mjs
|   `-- measure-job-post-management-performance.mjs
|-- src/
|   |-- app/api/admin/job-postings/
|   |-- backend/jobs/management/
|   |-- backend/repositories/jobs/prisma-job-post-management-repository.ts
|   |-- backend/admin/workers/job-post-lifecycle-loop.ts
|   |-- frontend/features/admin/job-post-management/
|   `-- shared/contracts/admin/job-post-management.ts
`-- tests/
    |-- backend/{unit,contract,integration}/job-post-management/
    |-- frontend/{components,accessibility}/admin-management/
    |-- security/job-post-management/
    |-- architecture/job-post-management-boundaries.test.ts
    `-- performance/job-post-management/
```

**Structure Decision**: Extend the existing web application’s server boundary, layered domain/repository pattern, React Admin resource registration, and existing admin worker. No new service, browser session, or persistent store is introduced.
