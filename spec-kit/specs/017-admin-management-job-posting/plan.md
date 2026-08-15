# Implementation Plan: Administrator Job-Post Review and Approval

**Branch**: `017-admin-management-job-posting` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/017-admin-management-job-posting/spec.md`

## Summary

Extend the existing JSON-backed Recruiter job editor with a PostgreSQL-backed human review authority. A Recruiter continues to create and edit working job content through the existing catalogue, then submits an exact validated snapshot. Submission transactionally creates a versioned pending review, audit evidence, and deduplicated in-app alerts for active Platform Administrators. An Administrator claims the work, reviews the complete snapshot plus safe company context, and approves or rejects the expected version. Approval transactionally derives the existing PostgreSQL `JobPosting` search/public projection from the reviewed snapshot so canonical `/jobs` retrieval can discover it. For review-managed jobs, PostgreSQL review state and immutable snapshots remain content authority while the JSON record remains the working catalogue. Decisions notify only an eligible submitting Recruiter, preserve private notes separately, and retain immutable history for revision and resubmission.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, TanStack Query 5.101, React Admin 5.15, MUI 7.3, Better Auth 1.6, existing unified in-app notification services

**Storage**: Existing `web/data/jobs/jobs.json` remains the Recruiter working catalogue; PostgreSQL stores authoritative review aggregates, immutable submitted/approved JSON snapshots, assignment, decisions, private notes, audit events, in-app notifications, and the existing derivative `JobPosting`/skill search-publication projection

**Testing**: Vitest 4.1 unit/integration/contract/security/architecture/performance suites, Testing Library accessibility/component tests, and targeted Playwright Administrator/Recruiter smoke coverage

**Target Platform**: Responsive Recruiter workspace and desktop-oriented Platform Administrator console on the existing long-lived Node custom server

**Project Type**: Existing monorepo web application with Next.js presentation/transport, backend service/repository layers, shared Zod contracts, a legacy JSON job-catalogue adapter, and PostgreSQL control-plane state

**Performance Goals**: Administrator notification visibility P95 <= 5 seconds; review queue/detail/claim/decision visible feedback P95 <= 2 seconds; zero duplicate authoritative transitions under documented concurrent submission, claim, and decision tests

**Constraints**: Preserve existing JSON job content and stable job identifiers; no catalogue-wide job migration; exactly one designated long-lived application host accepts catalogue mutations on one durable path while its local processes coordinate through a PostgreSQL writer lease; every other host is catalogue-read-only; fail closed when writer designation, durability, checksum continuity, or lease exclusivity is unavailable; no automatic moderation decision; PostgreSQL review state gates every review-managed public job; full snapshots never enter notification payloads or ordinary logs; exclusive Better Auth browser session; all four P1 stories are required for release

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
              |-- acquire PostgreSQL catalogue writer lease
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
              |-- deterministic JobPosting/skill publication projection
              `-- eligible submitter outcome notification

Recruiter/Public Readers
  |-- unmanaged legacy job -> existing JSON behavior
  `-- review-managed job -> PostgreSQL review projection
        |-- Recruiter sees draft/pending/rejected/active overlay
        `-- public sees only the approved immutable snapshot
```

### Submission and JSON Boundary

1. Draft create/update remains in `jobs.json`, but server-owned identifiers, status, review feedback, verification display, statistics, and lifecycle/publication timestamps are no longer accepted as Recruiter-authored values, and review-owned pending versions are write-locked server-side. Before the first material update of an unmanaged active job, the server holds the catalogue writer lease and expected checksum across reading the pre-edit record, transactionally creating an imported approved baseline plus its exact projection link (or exact projection when none exists), and atomically replacing JSON with the edited working draft. The JSON replacement occurs only after the baseline transaction commits. If replacement fails or the process crashes, the imported baseline remains the unchanged public authority and the edit is safely retryable.
2. The deployment designates exactly one long-lived application host as the catalogue writer; other hosts reject Recruiter job mutations. On the writer host, the JSON repository uses one process-wide queue plus an injected PostgreSQL-backed lease keyed by the configured catalogue identity, a monotonically increasing fencing version, compare-before-write checksum, temporary file, flush, and atomic replace. Review transactions lock and revalidate the unexpired owner/fencing/checksum tuple; final file replacement repeats that compare, so an expired or recovered owner cannot commit a stale operation. Startup/write preflight disables mutations when writer designation, durable-path writability, checksum continuity, or exclusive lease acquisition fails; a failed write leaves the prior valid file intact.
3. A dedicated submit command holds the catalogue writer lease and expected checksum from its validated JSON read until the pending-review PostgreSQL transaction commits. It verifies current database-backed company membership, treats the catalogue-generated stable ID/slug/company as server identity, strips other server-owned fields, validates deterministic mappings into the existing public `JobPosting` enums/search fields/skills, rejects a stable-slug collision owned by another company or aggregate, calculates a canonical SHA-256 content identity, and ensures the working record is recoverable as a draft.
4. While that lease prevents a competing JSON mutation, one PostgreSQL transaction creates or replays the aggregate/version, increments the review sequence, records the actor-scoped submission idempotency key and request-binding hash, records history/audit, and fans out generic Administrator notifications. After commit, a later JSON writer observes the authoritative pending lock and is rejected. Unique `(reviewAggregateId, contentHash)` and `(submittedByUserId, submissionIdempotencyKey)` identities make exact retries converge and reject changed bindings.
5. JSON `status` and `approvalComment` are updated only as best-effort compatibility fields after commit. All managed projections ignore them in favor of PostgreSQL review state.
6. Existing catalogue entries without a review aggregate remain under legacy behavior. A draft is adopted on submit; an active job is adopted before its first material JSON edit. Subsequent submit creates the pending replacement from the edited working record, while the pre-edit imported baseline remains public.

### Administrator Review and Decisions

1. The protected queue defaults to oldest unassigned pending work, then assigned pending work, with bounded snapshot title and current company display name, stable age/company/state/assignee/version filters, and pagination. Generic notification copy still contains neither value.
2. All active Platform Administrator grants receive a generic safe `MODERATION`/`MEDIUM` alert. Approval outcomes use `MODERATION`/`LOW`; rejection outcomes use `MODERATION`/`MEDIUM`. Notification destinations contain only `JOB_POST_REVIEW` context and the externally addressable Job Review Version ID. Every API `reviewId` also identifies a Job Review Version; the aggregate ID remains internal.
3. Claim uses a version-checked update and succeeds for only one Administrator. The current eligible assignee may explicitly reassign to another active Administrator. Any active Administrator may recover a review only from an assignee whose grant is no longer active. Every reassignment requires an expected version and audit event.
4. Detail validates the immutable snapshot through the shared job schema before display and joins only bounded current company/account display names, company verification and submitting-membership eligibility, assignment, prior-approved diff, history, and protected-viewer link facts. Email, phone, unrestricted profile data, and evidence remain excluded.
5. Approval rechecks the expected review version, assignment, active verified company, submitting/company authority rules, application deadline, content identity, deterministic public mapping, and stable projection ownership. In one PostgreSQL transaction it makes the snapshot authoritative; creates and links one `JobPosting` when the stable slug is unused or updates the aggregate's existing linked row; upserts skills by normalized-name identity and replaces ordered links; assigns server-owned approval/publication/public-update times; clears pending work; creates history/audit; and sends a safe outcome only if the submitter still qualifies. It never adopts or overwrites a slug linked to another company or aggregate. If managed closure occurred while the version was pending, approval preserves aggregate `closedAt` and projection `CLOSED` status rather than silently reopening the job.
6. Rejection requires an allow-listed reason code and a normalized 20-1,000 character public explanation. An optional 1-2,000 character private note is stored separately and excluded from notifications and Recruiter projections.
7. Lost responses and duplicate commands replay the stored result through the existing `AdminCommandReceipt` boundary. Its normalized body digest binds the external review version, path action, expected aggregate version, and complete normalized command payload; changed key reuse conflicts without mutation. Stale commands return current version/state without overwriting newer work.

### Public and Recruiter Projection

- A review-managed job without an approved version is neutral/unavailable publicly, regardless of JSON status.
- Canonical search reads the indexed `JobPosting` projection created from the approved version; canonical detail joins the approved snapshot when fields exceed that projection. Both paths reapply active/deadline/company gates.
- A review-managed job with an approved version exposes only that validated content snapshot while it is active and before its deadline. Public `postedAt`, `updatedAt`, review status, approval feedback, statistics, and verification display are server-derived rather than snapshot-authored. A pending replacement never changes the `JobPosting` projection or public content.
- Closing, expiry, or removal may suppress public visibility without approving pending edits and must not delete review history.
- Closing a managed job writes authoritative aggregate closure actor/time/history/audit and updates the `JobPosting` projection transactionally. Closure while a replacement is pending hides the current public job without deciding that version; later approval may update the approved content but preserves closed visibility. Expiry is derived from the approved deadline, and removal remains an authorized audited moderation action in the existing moderation authority.
- Recruiter management reads JSON working content plus the actor-authorized review projection. Pending versions are read-only; rejected versions expose only public reason/explanation; active records may begin a distinct edit draft.
- A missing, malformed, or hash-mismatched working JSON record cannot alter an approved public snapshot. The review queue shows a safe integrity-blocked state and operations evidence until repaired.

## Data and Migration Strategy

1. Add review state/reason enums and additive PostgreSQL tables for aggregate, version, history, private note, and writer lease. Add notification kinds/context, aggregate-to-`JobPosting` projection linkage, and indexes without replacing existing `JobPosting` or JSON identifiers.
2. Do not bulk migrate thousands of legacy JSON jobs. Unmanaged legacy rows retain current behavior until submitted or materially edited.
3. Provide a rerunnable adoption command for current JSON `pending_approval` and `rejected` rows. It validates content, resolves a verified database company and submitter where possible, inserts idempotent review versions, and reports unresolved legacy rows without guessing authority.
4. Before the first material JSON edit of a legacy active/open job, transactionally create a grandfathered approved baseline snapshot and public projection ownership from the pre-edit content. Bind an existing `JobPosting` only when unique slug, company, mapped content, and unowned projection identity match; preserve its valid relational publication time, or create an exact projection with adoption time when the slug is unused. Mutable JSON timestamps never supply publication facts. Otherwise block and report reconciliation instead of overwriting public data. Commit the later pending version only when the Recruiter submits the edited JSON working draft. The baseline is labeled imported and auditable; it is not presented as a new Administrator decision.
5. Keep schema deployment additive and rollback-safe. Rollback disables submit/review routes and returns unmanaged jobs to legacy reads while retaining review/audit/notification records for forward recovery.
6. Add a read-only verification script comparing managed job IDs, snapshot hashes, review state, public projections, notification recipients, and unresolved legacy JSON rows.

## Security, Privacy, and Observability

- Recruiter routes require the configured Recruiter origin, current active session, active account, active verified company, and active hiring-authority membership; client-supplied owner/company/status/feedback fields are rejected.
- Administrator routes use `AdminRequestBoundary`, CSRF proof, current active grant, step-up policy where already required, expected versions, idempotency keys, and an exact match between the path action and discriminated body command.
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
|   `-- migrations/036_job_post_review_authority/migration.sql
|-- scripts/
|   |-- migrate-json-job-reviews.mjs
|   |-- verify-job-post-review-migration.mjs
|   |-- check-json-job-catalogue-writer.mjs
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
|   |   |   |-- job-post-publication-projector.ts
|   |   |   |-- job-post-review-operations.ts
|   |   |   `-- job-post-review-errors.ts
|   |   |-- repositories/jobs/
|   |   |   |-- json-job-catalogue-repository.ts
|   |   |   |-- prisma-job-catalogue-write-lease-repository.ts
|   |   |   `-- prisma-job-post-review-repository.ts
|   |   |-- notifications/{event-policy.ts,admin-notification-fanout.ts}
|   |   `-- services/jobs/{recruiter-job-posting-data.ts,job-workspace-data.ts,job-discovery-service.ts}
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
    |-- usability/job-post-reviews/
    `-- system/e2e/job-post-reviews/
```

**Structure Decision**: Extend the existing `web/` workspace and preserve its Route Handler, service, repository, shared-contract, React Admin, and notification boundaries. Replace direct file operations inside the current service with a narrow JSON catalogue repository, while new review authority remains in a separate Prisma repository. No new application, database, session, worker topology, or paid provider is introduced.

## Validation Strategy

1. Shared contract and pure policy tests define lifecycle, reason codes, material-field identity, snapshot normalization, and public projection before services.
2. Migration/schema tests prove constraints for one pending version, unique sequence/hash, terminal decision integrity, assignment references, notification context, and additive rollback safety.
3. JSON repository tests cover designated-writer/read-only-host admission, the PostgreSQL-coordinated cross-process lease on the writer host, distinct-process contention, stale lease recovery, unwritable/non-durable path preflight, checksum conflict, atomic replace, malformed input, crash recovery, and preservation of user data.
4. Submission integration tests cover membership/company eligibility, exact snapshot, public-field mapping admission, idempotency, concurrent submission, notification fan-out, audit atomicity, active-edit baseline, and JSON/DB failure isolation.
5. Administrator contract/integration/security tests cover list/detail isolation, safe projections, claim/reassign races, stale expected versions, idempotent decisions, lost grants, blocked companies, deadlines, private notes, and notification navigation.
6. Public/Recruiter projection tests prove transactional `JobPosting`/skill publication mapping, approved-snapshot-only detail visibility, pending replacement isolation, managed closure, rejected feedback privacy, lost submitter access, legacy compatibility, and tamper blocking.
7. Frontend component/accessibility tests cover queue, detail, diff, loading/empty/error/stale states, claim and decision confirmation, keyboard flow, focus recovery, live status, and non-color cues.
8. Performance evidence uses a documented fixture dataset with thousands of legacy jobs, hundreds of managed versions, multiple active Administrators, warm-up, concurrency, nearest-rank percentiles, max, and error rate.
9. Run targeted feature suites, notification/admin/job-board regressions, typecheck, lint, Prisma validation/generation, migration verification, production build, and targeted Playwright smoke tests before release.

## Complexity Tracking

No constitution violation requires justification. The legacy JSON catalogue is retained only as the user-mandated working-content adapter; PostgreSQL is authoritative for every review-managed state, immutable submitted/approved snapshot, audit event, and notification.
