# Implementation Plan: Administrator Job-Post Review and Approval

**Branch**: `017-admin-management-job-posting` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/017-admin-management-job-posting/spec.md`

## Summary

Extend the existing JSON-backed Recruiter job editor with a PostgreSQL-backed human review authority. A Recruiter continues to create and edit working job content through the existing catalogue, then submits an exact validated snapshot. Submission transactionally creates a versioned pending review, audit evidence, and deduplicated in-app alerts for active Platform Administrators. An Administrator claims the work, reviews the complete snapshot plus safe company context, and approves or rejects the expected version. For review-managed jobs, PostgreSQL review state and immutable snapshots become authoritative for public visibility while the JSON record remains the working catalogue and compatibility projection. Decisions notify only an eligible submitting Recruiter, preserve private notes separately, and retain immutable history for revision and resubmission.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, TanStack Query 5.101, React Admin 5.15, MUI 7.3, Better Auth 1.6, existing unified in-app notification services

**Storage**: Existing `web/data/jobs/jobs.json` remains the Recruiter working catalogue; PostgreSQL stores authoritative review aggregates, immutable submitted/approved JSON snapshots, assignment, decisions, private notes, audit events, and in-app notifications

**Testing**: Vitest 4.1 unit/integration/contract/security/architecture/performance suites, Testing Library accessibility/component tests, and targeted Playwright Administrator/Recruiter smoke coverage

**Target Platform**: Responsive Recruiter workspace and desktop-oriented Platform Administrator console on the existing long-lived Node custom server

**Project Type**: Existing monorepo web application with Next.js presentation/transport, backend service/repository layers, shared Zod contracts, a legacy JSON job-catalogue adapter, and PostgreSQL control-plane state

**Performance Goals**: Administrator notification visibility P95 <= 5 seconds; review queue/detail/claim/decision visible feedback P95 <= 2 seconds; zero duplicate authoritative transitions under documented concurrent submission, claim, and decision tests

**Constraints**: Preserve existing JSON job content and stable job identifiers; no catalogue-wide job migration; no automatic moderation decision; PostgreSQL review state gates every review-managed public job; full snapshots never enter notification payloads or ordinary logs; exclusive Better Auth browser session; all four P1 stories are required for release

**Scale/Scope**: Thousands of existing JSON catalogue rows, incremental adoption only for newly submitted or materially edited jobs, dozens of concurrent active Administrators, bounded paginated review queues, one exact pending version and at most one approved version per managed job

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Gate | Status | Evidence |
|------|--------|----------|
| Human-controlled recruitment | PASS | Only an eligible assigned Platform Administrator can approve or reject; no AI, score, or automatic decision is introduced. |
| Security, privacy, tenant isolation | PASS | Better Auth remains the exclusive session owner; server-side Administrator grants and verified-company memberships protect every route; snapshots, notes, and notifications have separate least-privilege projections. |
| Deterministic core | PASS | Validation, content hashing, state transitions, assignment claims, idempotency, visibility, and reason codes are deterministic and provider-independent. |
| State, audit, data integrity | PASS | PostgreSQL is authoritative for review-managed state and approved snapshots; critical review writes, audit events, and notifications share transactions; JSON status becomes compatibility-only after adoption. |
| Scope discipline and complete P0 workflow | PASS | Submission, discovery, claim, complete review, decision, outcome, revision, recovery, audit, and verification gates are all included; unrelated recruitment and AI features are excluded. |
| Measurable quality and accessibility | PASS | The plan preserves the five-second notification SLA, two-second Administrator interaction target, concurrency correctness, keyboard operation, non-color states, and documented measurement conditions. |
| Maintainable/provider-independent architecture | PASS | App Router handlers delegate to typed services/repositories; the JSON catalogue is isolated behind one repository boundary; PostgreSQL and notification services remain the sole review control plane. |

**Exclusive browser-session owner**: The existing Better Auth opaque database-backed session in secure HttpOnly cookies remains the only browser credential. Existing expiration, revocation, logout, account-state, password-reset, CSRF, origin, and Administrator step-up boundaries remain unchanged and are reused.

**Legacy JSON reconciliation**: Retaining the working catalogue does not make its mutable `status` or `approvalComment` authoritative for review-managed jobs. Submission copies the exact allow-listed content into an immutable PostgreSQL snapshot. Recruiter and public projections overlay review authority; a stale or tampered JSON state cannot publish content. If snapshot creation fails, the JSON working record remains a draft and is safe to retry.

**Post-design re-check**: PASS. The data model gives PostgreSQL authority over every new review lifecycle and public approved snapshot, preserves complete audit evidence, and confines the legacy JSON file to an adapter-compatible working-content role.

## Architecture and Ownership

```text
Recruiter Job Editor
  |-- existing draft create/update -> JsonJobCatalogueRepository
  `-- submit for review
        `-- JobPostSubmissionService
              |-- validate current membership/company
              |-- normalize safe job content
              |-- persist/confirm JSON working draft atomically
              `-- PostgreSQL transaction
                    |-- JobPostReviewAggregate + immutable ReviewVersion
                    |-- AuditEvent
                    `-- admin InAppNotification fan-out

Administrator Console
  |-- protected review queue/detail
  |-- claim/reassign
  `-- approve/reject expected version
        `-- JobPostReviewDecisionService transaction
              |-- revalidate assignment/company/deadline/snapshot
              |-- decision + history + audit
              |-- approved snapshot authority or rejection feedback
              `-- eligible submitter outcome notification

Recruiter/Public Readers
  |-- unmanaged legacy job -> existing JSON behavior
  `-- review-managed job -> PostgreSQL review projection
        |-- Recruiter sees draft/pending/rejected/active overlay
        `-- public sees only the approved immutable snapshot
```

### Submission and JSON Boundary

1. Draft create/update remains in `jobs.json`, but server-owned identifiers, status, review feedback, statistics, and timestamps are no longer accepted as Recruiter-authored values.
2. The JSON repository uses one process-wide queue plus a cross-process lock lease, compare-before-write checksum, temporary file, flush, and atomic replace. A failed write leaves the prior valid file intact.
3. A dedicated submit command reads or receives the normalized working job, verifies current database-backed company membership, strips server-owned fields, calculates a canonical SHA-256 content identity, and ensures the working record is recoverable as a draft.
4. One PostgreSQL transaction creates or replays the aggregate/version, increments the review sequence, records history/audit, and fans out generic Administrator notifications. A unique `(reviewId, contentHash)` identity makes exact retries idempotent.
5. JSON `status` and `approvalComment` are updated only as best-effort compatibility fields after commit. All managed projections ignore them in favor of PostgreSQL review state.
6. Existing catalogue entries without a review aggregate remain under legacy behavior. The first submit or material edit adopts that job into review authority. Active adoption captures the current public content as the approved baseline before creating the edited pending version.

### Administrator Review and Decisions

1. The queue defaults to oldest unassigned pending work, then assigned pending work, with stable age/company/state/assignee/version filters and pagination.
2. All active Platform Administrator grants receive a generic safe alert. Notification destinations contain only `JOB_POST_REVIEW` context and the review ID.
3. Claim uses a version-checked update and succeeds for only one Administrator. Reassignment requires current authority, an expected version, an explicit target Administrator with an active grant, and an audit event.
4. Detail validates the immutable snapshot through the shared job schema before display and joins only safe company, submitting membership, assignment, prior-approved diff, history, and protected-viewer link facts.
5. Approval rechecks the expected review version, assignment, active verified company, submitting/company authority rules, application deadline, and content identity. It atomically makes the submitted snapshot the aggregate's approved version, clears pending work, creates history/audit, and sends a safe outcome only if the submitter still qualifies.
6. Rejection requires an allow-listed reason code and a normalized 20-1,000 character public explanation. An optional 1-2,000 character private note is stored separately and excluded from notifications and Recruiter projections.
7. Lost responses and duplicate commands replay the stored result through the existing Administrator command idempotency boundary. Stale commands return current version/state without overwriting newer work.

### Public and Recruiter Projection

- A review-managed job without an approved version is neutral/unavailable publicly, regardless of JSON status.
- A review-managed job with an approved version exposes only that validated snapshot while it is active and before its deadline. A pending replacement never changes public content.
- Closing, expiry, or removal may suppress public visibility without approving pending edits and must not delete review history.
- Recruiter management reads JSON working content plus the actor-authorized review projection. Pending versions are read-only; rejected versions expose only public reason/explanation; active records may begin a distinct edit draft.
- A missing, malformed, or hash-mismatched working JSON record cannot alter an approved public snapshot. The review queue shows a safe integrity-blocked state and operations evidence until repaired.

## Data and Migration Strategy

1. Add review state/reason enums and additive PostgreSQL tables for aggregate, version, history, and private note. Add notification kinds/context and indexes without changing existing `JobPosting` or JSON identifiers.
2. Do not bulk migrate thousands of legacy JSON jobs. Unmanaged legacy rows retain current behavior until submitted or materially edited.
3. Provide a rerunnable adoption command for current JSON `pending_approval` and `rejected` rows. It validates content, resolves a verified database company and submitter where possible, inserts idempotent review versions, and reports unresolved legacy rows without guessing authority.
4. On first edit of a legacy active/open job, transactionally create a grandfathered approved baseline snapshot plus the new pending version. The baseline is labeled imported and auditable; it is not presented as a new Administrator decision.
5. Keep schema deployment additive and rollback-safe. Rollback disables submit/review routes and returns unmanaged jobs to legacy reads while retaining review/audit/notification records for forward recovery.
6. Add a read-only verification script comparing managed job IDs, snapshot hashes, review state, public projections, notification recipients, and unresolved legacy JSON rows.

## Security, Privacy, and Observability

- Recruiter routes require the configured Recruiter origin, current active session, active account, active verified company, and active hiring-authority membership; client-supplied owner/company/status/feedback fields are rejected.
- Administrator routes use `AdminRequestBoundary`, CSRF proof, current active grant, step-up policy where already required, expected versions, and idempotency keys.
- Unknown, cross-tenant, lost-authority, and unavailable review IDs return the established neutral Administrator or Recruiter error shape without revealing existence.
- Snapshots may contain approved public job content only. They exclude private contacts, business evidence, raw company registry bodies, Administrator notes, applications, candidates, and credentials.
- Notifications carry safe policy-generated copy, review context ID, bounded state/audience values, and no snapshot, company name, submitter identity, reason explanation, or note.
- Ordinary logs contain correlation ID, command kind, safe result code, duration class, version, and hashed/opaque target references only. Full snapshots, rejection explanations, and notes are excluded.
- Metrics cover queue age, unassigned count, notification failures, integrity blocks, stale conflicts, decision outcomes, adoption failures, and P50/P95/P99/max/error rate under documented datasets.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/017-admin-management-job-posting/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- job-post-review.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/<timestamp>_job_post_review_authority/migration.sql
|-- scripts/
|   |-- migrate-json-job-reviews.mjs
|   |-- verify-job-post-review-migration.mjs
|   `-- measure-job-post-review-performance.mjs
|-- src/
|   |-- app/api/
|   |   |-- recruiter/job-postings/[jobId]/submit-review/route.ts
|   |   `-- admin/job-post-reviews/
|   |       |-- route.ts
|   |       |-- [reviewId]/route.ts
|   |       `-- [reviewId]/[action]/route.ts
|   |-- backend/
|   |   |-- jobs/review/
|   |   |   |-- job-post-submission-service.ts
|   |   |   |-- job-post-review-service.ts
|   |   |   |-- job-post-review-policy.ts
|   |   |   `-- job-post-review-errors.ts
|   |   |-- repositories/jobs/
|   |   |   |-- json-job-catalogue-repository.ts
|   |   |   `-- prisma-job-post-review-repository.ts
|   |   `-- notifications/{event-policy.ts,admin-notification-fanout.ts}
|   |-- frontend/features/
|   |   |-- recruiter-workspace/{job-posting-editor.tsx,job-posting-management.tsx}
|   |   `-- admin/job-post-reviews/
|   |       |-- job-post-review-list.tsx
|   |       |-- job-post-review-show.tsx
|   |       `-- job-post-review-action-panel.tsx
|   `-- shared/contracts/
|       |-- recruiter-job-posting.ts
|       |-- admin/job-post-review.ts
|       `-- notifications/index.ts
`-- tests/
    |-- backend/{unit,integration,contract}/job-post-reviews/
    |-- frontend/{components,accessibility}/job-post-reviews/
    |-- security/job-post-reviews/
    |-- architecture/job-post-review-boundaries.test.ts
    |-- performance/job-post-reviews/
    `-- system/e2e/job-post-reviews/
```

**Structure Decision**: Extend the existing `web/` workspace and preserve its Route Handler, service, repository, shared-contract, React Admin, and notification boundaries. Replace direct file operations inside the current service with a narrow JSON catalogue repository, while new review authority remains in a separate Prisma repository. No new application, database, session, worker topology, or paid provider is introduced.

## Validation Strategy

1. Shared contract and pure policy tests define lifecycle, reason codes, material-field identity, snapshot normalization, and public projection before services.
2. Migration/schema tests prove constraints for one pending version, unique sequence/hash, terminal decision integrity, assignment references, notification context, and additive rollback safety.
3. JSON repository tests cover cross-process lease, stale lease recovery, checksum conflict, atomic replace, malformed input, crash recovery, and preservation of user data.
4. Submission integration tests cover membership/company eligibility, exact snapshot, idempotency, concurrent submission, notification fan-out, audit atomicity, active-edit baseline, and JSON/DB failure isolation.
5. Administrator contract/integration/security tests cover list/detail isolation, safe projections, claim/reassign races, stale expected versions, idempotent decisions, lost grants, blocked companies, deadlines, private notes, and notification navigation.
6. Public/Recruiter projection tests prove approved-snapshot-only visibility, pending replacement isolation, rejected feedback privacy, lost submitter access, legacy compatibility, and tamper blocking.
7. Frontend component/accessibility tests cover queue, detail, diff, loading/empty/error/stale states, claim and decision confirmation, keyboard flow, focus recovery, live status, and non-color cues.
8. Performance evidence uses a documented fixture dataset with thousands of legacy jobs, hundreds of managed versions, multiple active Administrators, warm-up, concurrency, nearest-rank percentiles, max, and error rate.
9. Run targeted feature suites, notification/admin/job-board regressions, typecheck, lint, Prisma validation/generation, migration verification, production build, and targeted Playwright smoke tests before release.

## Complexity Tracking

No constitution violation requires justification. The legacy JSON catalogue is retained only as the user-mandated working-content adapter; PostgreSQL is authoritative for every review-managed state, immutable submitted/approved snapshot, audit event, and notification.
