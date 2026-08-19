# Implementation Plan: Recruitment Pipeline Kanban Board

**Branch**: `021-recruitment-pipeline-kanban-board` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/021-recruitment-pipeline-kanban-board/spec.md`

## Summary

**Feature 024 synchronization (2026-08-19):** Pipeline authorization continues
to derive access from the current `CompanyMembership` row. Team invitations do
not grant pipeline access until accepted, and suspended/removed members lose it
on the next server authorization check.

Add a job-scoped Kanban view to the existing Recruiter candidate workspace. The existing catalogue job selector remains the entry point, but a strengthened `RecruiterApplicationAuthorization` resolves that external job reference to exactly one authorized PostgreSQL `JobPosting.id` before applicant reads, scoring enrichment, document access, or mutation. A bounded board projection returns authoritative stage counts and independently cursor-paged columns, so up to 10,000 applications remain discoverable without rendering or transferring every card.

All board moves and existing interview/rejection actions converge on an extended `ApplicationStageService`. That single service validates the canonical transition policy, active verified-company authority, mutation roles, reasons and confirmations; performs stage-version compare-and-set, history, audit, in-app notification, and email-outbox writes in one serializable transaction; and replays exact idempotent retries without duplicating side effects. The frontend adds an accessible list/Kanban switch, pointer drag-and-drop through `@dnd-kit/core`, a first-class non-drag stage control, explicit consequential-decision dialogs, optimistic feedback, and authoritative rollback/reconciliation.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, existing Better Auth 1.6 session boundary, existing in-app notification service and email outbox; add exact dependency `@dnd-kit/core@6.3.1`

**Storage**: Existing PostgreSQL `JobPosting`, `JobApplication`, `ApplicationStageEvent`, `AuditEvent`, `InAppNotification`, and `EmailOutbox`; existing JSON job catalogue plus `JobPostReviewAggregate.publicJobPostingId` compatibility mapping remains the Recruiter selector source

**Testing**: Vitest 4.1 unit/integration/contract/security/architecture/performance suites, Testing Library and axe-core component/accessibility tests, and targeted Playwright Recruiter smoke coverage

**Target Platform**: Existing responsive Recruiter workspace, optimized for data-dense desktop use and keyboard/pointer operation

**Project Type**: Existing npm-workspace web application with Next.js presentation/transport, backend service/repository layers, shared Zod contracts, Prisma/PostgreSQL persistence, and a compatibility JSON job catalogue

**Performance Goals**: P95 visual move feedback <= 500 ms; P95 successful stage persistence <= 2 seconds; P95 board usable <= 2 seconds for the documented 10,000-application job workload; P95 committed in-app notification visibility <= 5 seconds

**Constraints**: One selected job at a time; nine fixed stages; human-only recruitment decisions; `OWNER` may manage the pipeline; company isolation; server authority; mandatory explicit `HIRED` confirmation and hiring email; no score-driven movement; no all-at-once 10,000-card render; no duplicate critical side effects; no new notification, scoring, session, job, or application domain

**Scale/Scope**: Up to 10,000 applications for one selected job, nine columns, bounded pages of at most 100 cards per column, multiple simultaneous Recruiter-side actors, and one logical stage command per card at a time in a client session

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Gate | Status | Evidence |
|------|--------|----------|
| Human-controlled recruitment | PASS | `OWNER`, `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER` can mutate within their authorized company. `HIRED` requires a separate explicit human confirmation; candidate activity and scoring never invoke the mutation service. |
| Security, privacy, tenant isolation | PASS | Better Auth remains the exclusive browser session. Every read and write resolves the selected job to one active verified company membership and revalidates job/application ownership server-side. `OWNER` may manage the pipeline within its company and cross-company failures use neutral responses. |
| Deterministic core and AI separation | PASS | The existing deterministic stage policy remains authoritative. Optional score projection is nullable and no scoring state, result, or worker can change recruitment stage. |
| State, audit, and data integrity | PASS | Stage compare-and-set, immutable `ApplicationStageEvent`, audit, in-app notification, and email intent share one serializable transaction; exact retries are request-bound and duplicate-safe. |
| Scope discipline and complete P0 workflow | PASS | Board read, all permitted moves, consequential decisions, notifications, retry/conflict recovery, accessibility, and 10,000-application discoverability are included; analytics, bulk actions, custom stages, scheduling, and new subsystems remain excluded. |
| Measurable quality and accessibility | PASS | The plan preserves the 500 ms, 2 second, and 5 second P95 targets and defines keyboard, focus, live-feedback, non-color, empty, error, and rollback validation. |
| Maintainable/provider-independent architecture | PASS | Route Handlers delegate to shared contracts, authorization, services, and repository ports. Drag-and-drop is isolated to presentation; email providers remain behind the existing outbox worker. |

**Exclusive browser-session owner**: Existing Better Auth opaque database-backed sessions in secure HttpOnly cookies remain the only browser credentials. `requireAccountRequest`/`requireJobActor` continue to enforce current session validity, revocation, account state, same-origin, and CSRF proof; no token enters local storage, session storage, or shared client caches.

**Post-design re-check**: PASS. No schema or migration is required; the design reuses existing authoritative state and closes current authorization/idempotency/notification gaps rather than weakening a constitutional rule.

## Current-State Findings That Drive the Design

### Job identity mismatch remains

`RecruiterCandidatesPage` links with the JSON catalogue `RecruiterJob.id`. `RecruiterApplicationAuthorization.authorizeJobs` accepts a direct `JobPosting.id` or falls back to `authorizeLegacyRecruiterJobs`, but its result returns the requested catalogue ID. `RankedCandidateListService`, `ListSubmittedCandidatesService`, campaign scoring statistics, and document repositories then query `JobApplication.jobPostingId` with that value.

Recent job-review work introduced the authoritative mapping `JobPostReviewAggregate.jobId -> publicJobPostingId -> JobPosting.id`. Existing seeded jobs can still share the same ID, which hides the bug, while newly approved/review-managed jobs normally have a distinct generated `JobPosting.id`. The resolver therefore must use direct `JobPosting.id` when valid and otherwise follow the unique review-aggregate mapping. It must not guess by title, slug, or company name.

### Mutation behavior is split

`ApplicationStageService.transition` already provides the complete transition policy, serializable compare-and-set, stage history, in-app notification, preference-aware email, and audit transaction. It currently permits `OWNER`, lacks request idempotency, accepts an unrestricted rejection reason, and makes `HIRED` email preference-dependent.

`RecruiterApplicationDecisionService` adds request idempotency, the six rejection reasons, confirmation commands, and an optional internal rejection note, but supports only Interviewing and Rejected; uses routes without the shared CSRF/account boundary; treats `OWNER` as mutable through the current authorization set; always emails Interviewing; and emits no rejection notification. Feature 019 extends the general stage service and turns the decision service/routes into compatibility adapters so no route owns divergent transition rules.

## Architecture and Ownership

```text
Recruiter campaign selector (catalogue job reference)
  -> existing /recruiter/candidates/[jobId] workspace
      -> accessible Ranked list | Pipeline board switch
          -> pipeline metadata + per-stage cursor pages
              -> RecruiterApplicationAuthorization
                  -> direct JobPosting.id, or
                  -> JobPostReviewAggregate.jobId -> publicJobPostingId
                  -> active account/membership/verified company/role
              -> PrismaApplicationRepository
                  -> stage counts + bounded card projection

Pointer drag or explicit stage control
  -> consequential dialog when required
  -> secure nested stage Route Handler
      -> ApplicationStageService (single mutation authority)
          -> re-resolve selected job + application ownership + mutation role
          -> exact-retry binding and canonical transition policy
          -> serializable stageVersion compare-and-set
          -> ApplicationStageEvent + AuditEvent
          -> InAppNotification + applicable EmailOutbox
      -> authoritative outcome or safe conflict/unavailable response
  -> client confirm, rollback, or reconcile affected columns
```

## Backend Design

### Canonical Recruiter job context

Extend `web/src/backend/applications/authorization/recruiter-application-authorization.ts` so its result distinguishes:

- `requestedJobId`: the route/selector reference;
- `jobPostingId`: the canonical persisted ID used by every application/scoring/document query;
- `companyId`, job title, canonical lifecycle state, membership role;
- view and mutation capability projections.

Resolution order is deterministic:

1. Match the supplied reference directly to a non-removed `JobPosting` owned by an active verified company and an active membership.
2. Otherwise match the unique `JobPostReviewAggregate.jobId`, require its `publicJobPostingId`, and authorize the linked non-removed `JobPosting` against the same aggregate company.
3. Allow pipeline reads and decisions only for canonical `ACTIVE` or `CLOSED` jobs. A closed job remains mutable under the normal transition policy. Missing projections, mismatched companies, removed/unresolvable records, inactive accounts/memberships/companies, and cross-company references return the established neutral unavailable result.

All application consumers use `jobPostingId` after authorization. Update ranked/submitted applicant retrieval, campaign stats, rescore and document access paths that currently reuse the external identifier as a database foreign key. Campaign stats remain keyed by the requested catalogue ID in the response so existing cards continue to update correctly.

### Board read projection and 10,000-application scale

Add a `RecruitmentPipelineBoardService` as read orchestration only; it does not own mutation or domain state. Extend the existing application repository port/Prisma repository with:

- a grouped count query over all nine stages using the same visibility predicates as card retrieval;
- one stable cursor page for a requested stage, ordered consistently with existing applicant lists by `submittedAt DESC, id DESC`;
- a signed cursor bound to canonical job ID and stage using the existing application cursor secret;
- a least-privilege card projection with application ID, candidate display identity, submission time, stage/version, document availability, optional current score summary, and server-calculated allowed destinations.

The metadata request returns job state, role permissions, and all nine counts. The client requests the first bounded page for each visible column in parallel and exposes a keyboard-operable “Load more” control per column. No request or render contains all 10,000 cards. Score joins are left/optional; missing, pending, failed, or unavailable scoring leaves the card usable. Counts and pages use identical visibility predicates, and card IDs are de-duplicated when pages merge or a moved card is inserted.

### One authoritative stage command

Extend `ApplicationStageService.transition` to accept the selected job reference, application ID, actor/session, required idempotency key, and one validated command. The command contains target stage, expected `stageVersion`, optional reason/private note, and explicit confirmation when required.

Within one serializable transaction the service:

1. Resolves/revalidates the selected canonical job, active account, active membership, verified active company, role, job lifecycle, and application ownership.
2. Computes a deterministic digest over the normalized actor/application/job/target/version/reason/confirmation binding.
3. Replays an existing `ApplicationStageEvent` only when both application/idempotency key and stored digest match. Reuse with changed input returns an idempotency conflict.
4. Validates the current stage/version and `canTransitionApplicationStage` policy.
5. Applies target-specific rules: rejection allowlist and confirmation; Offer Declined reason and confirmation from Offered; Hired confirmation from Offered with no candidate-acceptance prerequisite.
6. Performs the existing stage/version compare-and-set and creates one stage event. Existing event fields store reason label/private note and metadata stores the request digest/source without schema changes.
7. Creates one in-app candidate notification for every committed stage change. It enqueues ordinary stage email only when the existing preference permits, but always enqueues the existing stage-changed email for `HIRED` so the constitution-required hiring confirmation cannot be disabled.
8. Appends one success audit event with actor/session, application, previous/new stage, version, safe reason code, and correlation ID.

The existing `/stage`, `/decisions/interview`, and `/decisions/reject` handlers are converted to secure, thin adapters over this service while existing frontend calls move to the nested job-scoped route. Compatibility adapters contain no policy or persistence logic and are covered by parity tests. This prevents divergent behavior while avoiding an abrupt contract removal.

Concurrent identical first attempts can race before seeing the stage event. The service treats the existing unique `(applicationId, idempotencyKey)` and `(applicationId, applicationVersion)` constraints/serialization failure as replay opportunities: after rollback it reads and verifies the committed digest, returning the prior outcome only for an exact match. A new later decision uses a new idempotency key and latest version.

### Consequential transitions

- **Rejected**: reuse the six-value `rejectionReasonCodeSchema` and shared labels; require `confirmed: true`; retain the existing optional 2,000-character internal note in `ApplicationStageEvent.internalNoteEncrypted`; exclude that field from candidate contracts, notifications, email payloads, and ordinary logs.
- **Offer Declined**: allow only `OFFERED -> OFFER_DECLINED`; require the existing bounded reason code and `confirmed: true`; terminal afterward; no candidate-side response workflow.
- **Hired**: allow only `OFFERED -> HIRED`; require an eligible mutable role and `confirmed: true`; drag merely opens the dialog; do not query candidate offer acceptance; always enqueue the existing application-stage email as the mandatory hiring confirmation.

## Frontend Design

Introduce a small `RecruiterCandidateWorkspace` shell at the current selected-job branch in `RecruiterCandidatesPage`. It preserves the current route, campaign selector, breadcrumbs, ranking/list components, score drawer, rescore controls, document viewers, loading/error patterns, and candidate details. An accessible two-option view switch conditionally mounts either the existing ranked list or the new pipeline board, avoiding duplicate background retrieval.

The board uses local feature state through `useRecruitmentPipeline`; no new global store is required. State contains board metadata, loaded pages/cursors by stage, pending commands by application, a stable idempotency key for each unresolved logical command, announcements, and the application that should regain focus. Sensitive/session material is never stored there.

`@dnd-kit/core@6.3.1` provides pointer and keyboard sensors, droppable columns, drag cancellation, overlay, and screen-reader announcements. Only server-returned destinations are droppable. A visible button/menu on every mutable card invokes the same stage command without drag. `OWNER` receives the same permitted mutation destinations as the other active company roles.

Ordinary moves may apply an optimistic source/destination/count update. Rejected, Offer Declined, and Hired open the shared stage-decision dialog before any mutation; Hired can never commit in `onDragEnd`. On success, the client applies the authoritative version and refreshes metadata plus affected column pages. On validation, authorization, network, server, or stale failure it restores/removes the optimistic copy, announces the result, and reloads affected authoritative pages. A 404/unavailable result clears cached board/application data rather than continuing to display it as current. Focus returns to the moved card when it remains loaded, otherwise to the destination column heading or originating control.

## API and Contract Changes

The full transport contract is in [contracts/recruitment-pipeline.openapi.yaml](./contracts/recruitment-pipeline.openapi.yaml).

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/recruiter/jobs/{jobId}/applications/pipeline` | Resolve job context, authorize view, and return role permissions plus all nine authoritative counts. |
| GET | `/api/recruiter/jobs/{jobId}/applications/pipeline/{stage}` | Return one bounded, cursor-paged stage column with minimal cards and optional score enrichment. |
| PATCH | `/api/recruiter/jobs/{jobId}/applications/{applicationId}/stage` | Execute the single job-scoped, request-idempotent authoritative stage command. |

All routes use bounded shared Zod inputs and no-store responses. GET routes use the account boundary without mutation checks; PATCH requires current account, same origin, CSRF proof, `Idempotency-Key`, and server authorization. Unknown and cross-tenant targets return the same neutral unavailable representation. Conflict responses may return the latest stage/version only after the request has been authorized for that application.

## Data and Migration Strategy

No Prisma schema change or database migration is required.

Existing data already provides:

- `JobPostReviewAggregate.jobId/publicJobPostingId` for catalogue-to-persisted identity;
- `JobApplication.stage`, `stageVersion`, and `lastStageChangedAt`;
- `ApplicationStageEvent` actor, stages, reason, version, private note, idempotency key, and metadata;
- unique application/version and application/idempotency constraints;
- indexed job/stage/submission queries;
- `AuditEvent`, unique in-app deduplication keys, and unique email-outbox idempotency keys.

The request-binding digest fits the existing stage-event `metadata` JSON. Existing nullable event fields support ordinary and consequential transitions. Rollback consists of disabling the new routes/view and retaining immutable transition/audit/notification records; there is no data conversion to reverse.

## Security, Privacy, and Failure Isolation

- Browser authentication remains Better Auth through `requireSession`; account state and CSRF/origin checks use `requireAccountRequest`/`requireJobActor`.
- Read and mutation authorization both bind user, membership, company, selected job, canonical `JobPosting`, and `JobApplication`; mutation additionally checks the role inside the write transaction.
- Multi-company authority is derived from the explicitly selected job, not from “first company” or a global recruiter role.
- Board cards omit contact details, full CV content, reasons, notes, and scoring evidence. Existing protected endpoints remain responsible for detail/document access.
- Internal rejection notes never enter candidate history, in-app variables, email payloads, errors, or ordinary logs.
- External email delivery remains asynchronous through `EmailOutbox`; provider failure changes only outbox delivery state and cannot roll back or corrupt the committed stage.
- Client capability flags improve usability only. Server policy remains authoritative for direct or manipulated requests.

## Performance and Observability

1. Initial board work is bounded to one indexed count aggregation plus bounded first-page column queries; subsequent work is per-column cursor pagination.
2. The UI never mounts all 10,000 cards and loads more only on explicit/near-column demand. Pointer transforms are presentation-only and do not trigger server reads during drag.
3. Successful moves refresh only metadata and affected columns, while unavailable/tenant changes clear the entire board.
4. Add safe operation metrics for board metadata, column reads, transition success/conflict/replay/denial, durations, result codes, and loaded-card counts. Do not log candidate identity, reasons, notes, or idempotency keys.
5. Performance evidence documents environment, 10,000-application stage distribution, warm-up, sample size, concurrency, P50/P95/P99/max, error rate, and notification/email-provider conditions.

## Validation Strategy

1. Shared contract and policy tests cover all nine values, every allowed/disallowed transition, target-specific confirmation/reason rules, strict payloads, and neutral errors.
2. Job-context tests cover direct IDs, review aggregate mappings, mismatched aggregate/company links, legacy unmapped jobs, closed jobs, removed jobs, inactive accounts/memberships/companies, all roles, and multi-company membership.
3. Repository/contract tests cover nine counts, cursor binding to canonical job and stage, deterministic ordering, optional/missing scores and documents, no duplicate cards, and traversal of 10,000 records.
4. Mutation integration tests cover role matrix, tenant isolation, stage compare-and-set, transaction rollback, exact replay, changed-key binding conflict, simultaneous retries, different later decisions, history, audit, and no score changes.
5. Consequential-decision tests cover the six rejection reasons, missing/invalid reasons, private-note privacy, Offer Declined from Offered only, explicit Hired confirmation, no in-app acceptance prerequisite, no candidate/AI mutation path, and mandatory Hired email despite preferences.
6. Notification tests cover in-app delivery for every committed stage, ordinary email preference behavior, Hired email override, deduplication, outbox retry, and external-provider failure isolation.
7. Frontend tests cover list/board switching, nine columns/counts, empty/loading/unavailable states, pointer drop, explicit non-drag movement, invalid targets, confirmations, optimistic success/rollback, stale reconciliation, exact retry key reuse, and new-command key rotation.
8. Accessibility tests cover tab order, drag handle and non-drag controls, Space/Enter/Escape, screen-reader instructions/live announcements, dialogs, error/success feedback, focus restoration, and non-color cues.
9. Performance tests use a documented 10,000-application job and concurrent Recruiter actors to verify board usability, visual feedback, persistence, and notification P95 targets.
10. Run targeted Feature 019 tests plus application, scoring, notification, job-post-review, typecheck, lint, Prisma validation, production build, and focused Playwright smoke regressions.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/021-recruitment-pipeline-kanban-board/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- recruitment-pipeline.openapi.yaml
`-- checklists/
    `-- requirements.md
```

`tasks.md` is intentionally not created during planning.

### Source Code (repository root)

```text
web/
|-- package.json                                  # add @dnd-kit/core and later a focused test script
|-- src/
|   |-- app/api/recruiter/
|   |   |-- jobs/[jobId]/applications/
|   |   |   |-- pipeline/route.ts                 # new board metadata
|   |   |   |-- pipeline/[stage]/route.ts         # new bounded stage page
|   |   |   `-- [applicationId]/stage/route.ts     # new job-scoped command
|   |   `-- applications/[applicationId]/
|   |       |-- stage/route.ts                     # compatibility adapter, shared service
|   |       `-- decisions/{interview,reject}/route.ts # secure compatibility adapters
|   |-- backend/
|   |   |-- applications/
|   |   |   |-- authorization/recruiter-application-authorization.ts
|   |   |   `-- services/
|   |   |       |-- recruitment-pipeline-board.ts # new read orchestrator
|   |   |       |-- ranked-candidate-list.ts
|   |   |       |-- list-submitted-candidates.ts
|   |   |       |-- campaign-scoring-stats.ts
|   |   |       |-- open-application-document.ts
|   |   |       `-- recruiter-application-decision-service.ts # thin adapter
|   |   |-- repositories/applications/
|   |   |   |-- application-repository.ts
|   |   |   `-- prisma-application-repository.ts
|   |   `-- services/jobs/
|   |       |-- application-stage-service.ts      # single mutation authority
|   |       `-- application-stage-policy.ts       # canonical policy reused
|   |-- shared/contracts/applications/
|   |   |-- index.ts
|   |   `-- recruitment-pipeline.ts               # new typed board/command contracts
|   `-- frontend/
|       |-- features/recruiter-applications/
|       |   |-- recruiter-candidates-page.tsx
|       |   |-- recruiter-candidate-workspace.tsx # new list/board shell
|       |   |-- candidate-ranking-list.tsx
|       |   |-- recruitment-pipeline-board.tsx    # new DnD/feedback orchestration
|       |   |-- recruitment-pipeline-column.tsx   # new bounded column
|       |   |-- recruitment-pipeline-card.tsx     # new minimal card
|       |   |-- application-stage-change-dialog.tsx # shared consequential/non-drag UX
|       |   |-- use-recruitment-pipeline.ts       # new local state/retry/reconcile hook
|       |   |-- candidate-score-drawer.tsx        # adapt shared card identity
|       |   |-- stage-transition-confirm-modal.tsx
|       |   `-- reject-candidate-modal.tsx
|       `-- styles/recruiter-workspace-full.css
`-- tests/
    |-- shared/applications/
    |-- backend/{unit,integration,contract}/applications/
    |-- frontend/{applications,accessibility/applications}/
    |-- security/applications/
    |-- architecture/applications/
    |-- performance/applications/
    `-- system/e2e/recruitment-pipeline-kanban/

package-lock.json                                # lock exact DnD dependency
AGENTS.md                                        # Spec Kit managed plan reference only
```

**Structure Decision**: Extend the existing `web/` workspace and current Recruiter application feature. Keep Next.js Route Handlers thin, centralize authorization and transition rules in backend services, extend the existing application repository for read projections, and reuse all current domain tables and notification workers. No new application, job, scoring, notification, audit, session, worker, or database authority is introduced.

## Change Inventory

### Existing implementations reused

- `RecruiterCandidatesPage`, `CandidateRankingList`, score drawer, document tabs/viewers, modal frame, status display, and loading/error styling.
- `RecruiterApplicationAuthorization`, `ApplicationStageService`, `canTransitionApplicationStage`, `PrismaApplicationRepository`, and current scoring projections.
- `JobPostReviewAggregate.publicJobPostingId` as the authoritative catalogue mapping.
- `JobApplication.stageVersion`, `ApplicationStageEvent`, `PrismaAuditRepository`, `createInAppNotification`, `EmailOutbox`, and the existing application-stage email renderer/worker.
- Existing Better Auth session, account request/CSRF boundary, test fixtures, Vitest/Testing Library/axe/Playwright patterns.

### Existing files requiring adaptation

- Authorization and all applicant/document/scoring reads that currently treat the selector ID as `JobPosting.id`.
- General stage service and overlapping decision routes/services.
- Ranked-list action permissions so `OWNER` cannot receive mutation controls.
- Selected-job Recruiter workspace shell and shared detail-card boundary.
- Application shared contracts, repository port/Prisma projection, package manifests/lock, styles, and relevant regression tests.

### Genuinely new implementation units

- Board metadata/column read service and three job-scoped Route Handlers.
- Board contracts, local board hook, board/column/card components, common stage-change dialog, and focused tests/performance harness.
- One presentation dependency: `@dnd-kit/core@6.3.1`.

### Schema/API/migration impact

- **Database/schema migration**: None.
- **API**: Three additive job-scoped pipeline endpoints; existing stage/decision endpoints become compatibility adapters.
- **External dependency**: One exact, MIT-licensed DnD core package; rationale and alternatives are recorded in research.md.

## Complexity Tracking

No constitution violation requires justification. The compatibility job mapping and legacy mutation routes remain only as adapters around one canonical persisted job context and one transition service; neither becomes a second domain authority.
