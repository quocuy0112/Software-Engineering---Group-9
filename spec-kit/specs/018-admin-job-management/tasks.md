# Tasks: Administrator Job Post Management

**Input**: Design documents from `spec-kit/specs/018-admin-job-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/job-post-management.openapi.yaml](./contracts/job-post-management.openapi.yaml)

**Tests**: Contract, unit, integration, security, frontend component/accessibility, architecture, and performance tests are required because the feature changes authorization, authoritative lifecycle state, candidate visibility, and audit evidence.

**Organization**: Tasks are grouped by independently testable user story after shared foundations.

## Phase 1: Setup

**Purpose**: Establish feature-specific test, script, and contract boundaries.

- [X] T001 Create job-post-management test directories and feature test script entries in `web/tests/**/job-post-management/` and `web/package.json`
- [X] T002 [P] Create shared operational contracts and contract tests in `web/src/shared/contracts/admin/job-post-management.ts` and `web/tests/shared/unit/contracts/job-post-management/`
- [X] T003 [P] Add OpenAPI parity validation for `spec-kit/specs/018-admin-job-management/contracts/job-post-management.openapi.yaml` in `web/tests/backend/contract/job-post-management/openapi-parity.test.ts`
- [X] T004 [P] Create migration verification and performance-script skeletons in `web/scripts/verify-job-post-management-migration.mjs` and `web/scripts/measure-job-post-management-performance.mjs`

---

## Phase 2: Foundational

**Purpose**: Add authoritative storage, scoped authorization, shared command protection, and candidate projection guards before any story endpoint exists.

- [X] T005 Extend admin grant scopes, job operational enums, aggregate relations, correction, feature, enforcement, report-link, and operational-history models in `web/prisma/schema.prisma`
- [X] T006 Create additive/backfill-safe migration and indexes in `web/prisma/migrations/0xx_admin_job_post_management/migration.sql`
- [X] T007 Generate Prisma client and implement migration/backfill invariants in `web/scripts/verify-job-post-management-migration.mjs`
- [X] T008 [P] Implement scope evaluation and explicit action policy in `web/src/backend/jobs/management/job-post-management-policy.ts` and `web/tests/backend/unit/job-post-management/job-post-management-policy.test.ts`
- [X] T009 [P] Implement safe operation events and metrics boundary in `web/src/backend/jobs/management/job-post-management-operations.ts` and `web/tests/backend/unit/job-post-management/job-post-management-operations.test.ts`
- [X] T010 Implement transactional repository queries, aggregate locking, report summaries, feature overlap capacity checks, and public projection sync in `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts`
- [X] T011 Implement versioned command service with AdminRequestBoundary/command receipts/audit/notifications in `web/src/backend/jobs/management/job-post-management-service.ts`
- [ ] T012 Integrate approved revision satisfaction and candidate projection guards into `web/src/backend/jobs/review/job-post-review-service.ts`, `web/src/backend/repositories/jobs/prisma-job-post-review-repository.ts`, and candidate job read/application boundaries
- [X] T013 Add protected list/detail/command routes and strict path-command validation in `web/src/app/api/admin/job-postings/route.ts`, `web/src/app/api/admin/job-postings/[jobId]/route.ts`, and `web/src/app/api/admin/job-postings/[jobId]/[action]/route.ts`
- [ ] T014 Add foundational authorization, idempotency, projection-integrity, and migration tests in `web/tests/security/job-post-management/`, `web/tests/backend/integration/job-post-management/`, and `web/tests/architecture/job-post-management-boundaries.test.ts`

**Checkpoint**: Migration, state authority, strict command boundary, and candidate safety are ready. No user story UI is enabled before this checkpoint passes.

---

## Phase 3: User Story 1 - Find and Inspect a Published Job (Priority: P1)

**Goal**: An authorized administrator can find and understand a review-managed published job and its authoritative operational facts.

**Independent Test**: Seed two companies, multiple recruiters, managed jobs, reports, and versions; search/filter one job and verify detail exposes only safe consolidated facts.

### Tests

- [X] T015 [P] [US1] Add list/detail contract tests in `web/tests/backend/contract/job-post-management/list-detail.contract.test.ts`
- [ ] T016 [P] [US1] Add repository integration tests for safe search, filters, report aggregation, version joins, and pagination in `web/tests/backend/integration/job-post-management/list-detail.integration.test.ts`
- [ ] T017 [P] [US1] Add security tests for anonymous, inactive, cross-company, and unscoped administrator reads in `web/tests/security/job-post-management/list-detail-authorization.test.ts`
- [ ] T018 [P] [US1] Add component and accessibility tests in `web/tests/frontend/components/admin-management/job-post-management-list.test.tsx` and `web/tests/frontend/accessibility/admin-management/job-post-management-list.accessibility.test.tsx`

### Implementation

- [X] T019 [US1] Implement safe list/detail projections, full-text normalized search, company/recruiter/approver/date/report/featured filters, report summary, and pagination in `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts`
- [X] T020 [US1] Implement list/detail orchestration and response contracts in `web/src/backend/jobs/management/job-post-management-service.ts` and `web/src/app/api/admin/job-postings/{route.ts,[jobId]/route.ts}`
- [X] T021 [P] [US1] Build dense React Admin list filters, state chips, report summary, and row navigation in `web/src/frontend/features/admin/job-post-management/job-post-management-list.tsx`
- [X] T022 [P] [US1] Build structured job management detail cards, version comparison, metadata, reports, feature, and timeline sections in `web/src/frontend/features/admin/job-post-management/job-post-management-show.tsx`
- [X] T023 [US1] Register the `job-postings` admin resource, navigation label, icon, and data-provider mapping in `web/src/frontend/features/admin/app/admin-app.tsx` and `web/src/frontend/features/admin/layout/admin-layout.tsx`

**Checkpoint**: Administrators can independently find and inspect safe operational detail for a managed job.

---

## Phase 4: User Story 2 - Control Job Availability Safely (Priority: P1)

**Goal**: An authorized moderator controls candidate visibility and application intake independently while preserving history and candidate/public behavior.

**Independent Test**: Hide/restore and close/reopen a live job, then verify one dimension never alters the other and candidate search/application behavior matches state.

### Tests

- [X] T024 [P] [US2] Add command contract tests for hide, restore, close, reopen, archive, and soft-delete payloads in `web/tests/backend/contract/job-post-management/lifecycle.contract.test.ts`
- [ ] T025 [P] [US2] Add transaction/integration tests for state matrix, projection synchronization, command replay, stale conflict, and archive recovery in `web/tests/backend/integration/job-post-management/lifecycle.integration.test.ts`
- [ ] T026 [P] [US2] Add candidate visibility/application regression tests in `web/tests/backend/integration/jobs/job-post-management-visibility.integration.test.ts`
- [ ] T027 [P] [US2] Add lifecycle action-panel component/accessibility tests in `web/tests/frontend/components/admin-management/job-post-management-lifecycle.test.tsx` and `web/tests/frontend/accessibility/admin-management/job-post-management-lifecycle.accessibility.test.tsx`

### Implementation

- [ ] T028 [US2] Implement state-transition validation, required reasons, scoped authorization, command receipts, history, audit, and safe notifications in `web/src/backend/jobs/management/job-post-management-policy.ts` and `web/src/backend/jobs/management/job-post-management-service.ts`
- [ ] T029 [US2] Implement aggregate/public-projection updates and terminal soft-delete safeguards in `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts`
- [X] T030 [US2] Implement lifecycle command endpoint handling and neutral errors in `web/src/app/api/admin/job-postings/[jobId]/[action]/route.ts`
- [X] T031 [US2] Build confirmation-based hide/restore/close/reopen/archive/soft-delete controls with conflict recovery in `web/src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx`
- [X] T032 [US2] Surface independent state, command outcomes, and candidate-effect guidance in `web/src/frontend/features/admin/job-post-management/job-post-management-show.tsx`

**Checkpoint**: Lifecycle actions are independently safe, auditable, accessible, and reflected by candidate readers.

---

## Phase 5: User Story 3 - Request a Corrected Public Job (Priority: P1)

**Goal**: A correction request creates a safe recruiter revision workflow without changing unapproved candidate content.

**Independent Test**: Request changes for a live job, submit/approve a revision, and verify the original live version survives until approval or explicit hide.

### Tests

- [X] T033 [P] [US3] Add correction command and recruiter projection contract tests in `web/tests/backend/contract/job-post-management/correction-request.contract.test.ts`
- [ ] T034 [P] [US3] Add correction/live-version integration and concurrency tests in `web/tests/backend/integration/job-post-management/correction-request.integration.test.ts`
- [ ] T035 [P] [US3] Add recruiter workspace and administrator detail component tests in `web/tests/frontend/components/recruiter-workspace/job-post-correction-request.test.tsx` and `web/tests/frontend/components/admin-management/job-post-management-correction.test.tsx`

### Implementation

- [ ] T036 [US3] Implement correction-request persistence, single-open-request invariant, and immediate-hide composition in `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts` and `web/src/backend/jobs/management/job-post-management-service.ts`
- [ ] T037 [US3] Link recruiter submission and review approval/rejection to correction-request state in `web/src/backend/jobs/review/job-post-review-service.ts`, `web/src/backend/repositories/jobs/prisma-job-post-review-repository.ts`, and `web/src/backend/jobs/review/job-post-publication-projector.ts`
- [ ] T038 [US3] Expose authorized correction context and read-only version labels in `web/src/backend/jobs/review/job-post-review-service-factory.ts`, recruiter job APIs, and `web/src/shared/contracts/recruiter-job-posting.ts`
- [X] T039 [US3] Build administrator correction-request controls and live/pending version distinction in `web/src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx` and `web/src/frontend/features/admin/job-post-management/job-post-management-show.tsx`
- [X] T040 [US3] Build recruiter correction banner and revision-submit guidance in `web/src/frontend/features/recruiter/jobs/` and `web/src/frontend/styles/recruiter-workspace-full.css`

**Checkpoint**: A pending correction can never overwrite or silently replace the live approved version.

---

## Phase 6: User Story 4 - Feature and Govern Promoted Jobs (Priority: P2)

**Goal**: Authorized content managers safely schedule and remove featured placement without bypassing normal job eligibility.

**Independent Test**: Schedule one valid placement, then race/overlap a capacity-conflicting placement and verify exactly one permitted active interval.

### Tests

- [X] T041 [P] [US4] Add feature command and placement-capacity contract tests in `web/tests/backend/contract/job-post-management/featured-placement.contract.test.ts`
- [ ] T042 [P] [US4] Add feature window, eligibility, concurrent-capacity, replay, and cancellation integration tests in `web/tests/backend/integration/job-post-management/featured-placement.integration.test.ts`
- [ ] T043 [P] [US4] Add feature control component/accessibility tests in `web/tests/frontend/components/admin-management/job-post-management-feature.test.tsx` and `web/tests/frontend/accessibility/admin-management/job-post-management-feature.accessibility.test.tsx`

### Implementation

- [X] T044 [US4] Implement configured placement capacity, atomic overlap checks, eligibility, and schedule/amend/cancel persistence keyed by feature ID in `web/src/backend/jobs/management/job-post-feature-policy.ts` and `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts`
- [X] T045 [US4] Implement feature create/amend/cancel command orchestration, history/audit/receipt, and routes in `web/src/backend/jobs/management/job-post-management-service.ts` and `web/src/app/api/admin/job-postings/[jobId]/[action]/route.ts`
- [X] T046 [US4] Build feature scheduling/removal controls and active/scheduled placement presentation in `web/src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx` and `web/src/frontend/features/admin/job-post-management/job-post-management-show.tsx`

**Checkpoint**: Featured placement is bounded, scoped, auditable, and cannot overbook under concurrent use.

---

## Phase 7: User Story 5 - Resolve Reports Through Explicit Enforcement (Priority: P2)

**Goal**: Moderators connect reports to explicit post/company/recruiter enforcement while retaining immutable report evidence.

**Independent Test**: Link two reports to one hide enforcement and one report to another action; verify bidirectional detail and no report history loss.

### Tests

- [X] T047 [P] [US5] Add enforcement/link command contracts in `web/tests/backend/contract/job-post-management/enforcement.contract.test.ts`
- [ ] T048 [P] [US5] Add many-to-many report/enforcement, authorization, idempotency, and audit integration tests in `web/tests/backend/integration/job-post-management/enforcement.integration.test.ts`
- [ ] T049 [P] [US5] Add report-detail and job-detail enforcement UI tests in `web/tests/frontend/components/admin-management/job-post-management-enforcement.test.tsx` and `web/tests/frontend/components/admin-management/moderation-report-enforcement.test.tsx`

### Implementation

- [ ] T050 [US5] Implement enforcement aggregate, target validation, REQUEST_CHANGES public-explanation validation, report-link creation, report-state outcome, history, audit, and notifications in `web/src/backend/jobs/management/job-post-enforcement-service.ts` and `web/src/backend/repositories/jobs/prisma-job-post-management-repository.ts`
- [ ] T051 [US5] Integrate report detail/list projections and command delegation in `web/src/backend/admin/moderation/moderation-review-service.ts`, `web/src/backend/repositories/admin/prisma-moderation-repository.ts`, and `web/src/app/api/admin/moderation-reports/[reportId]/[action]/route.ts`
- [X] T052 [US5] Build report selection/enforcement evidence UI in `web/src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx`, `web/src/frontend/features/admin/moderation/moderation-review-show.tsx`, and `web/src/frontend/features/admin/moderation/report-action-panel.tsx`

**Checkpoint**: Reports are operationally meaningful and retain many-to-many enforcement evidence.

---

## Phase 8: Worker, Verification, and Polish

**Purpose**: Complete lifecycle automation, observability, security, documentation, and end-to-end validation.

- [X] T053 Implement bounded retry-safe deadline archive loop and worker registration in `web/src/backend/admin/workers/job-post-lifecycle-loop.ts`, `web/src/backend/admin/workers/admin-worker-runtime.ts`, and `web/src/backend/admin/workers/admin-worker-entry.ts`
- [ ] T054 [P] Add lifecycle worker integration/reliability tests in `web/tests/backend/integration/job-post-management/lifecycle-worker.integration.test.ts` and `web/tests/performance/job-post-management/lifecycle-worker.reliability.test.ts`
- [X] T055 [P] Complete migration reconciliation checks and performance measurement in `web/scripts/verify-job-post-management-migration.mjs`, `web/scripts/measure-job-post-management-performance.mjs`, and `web/package.json`
- [ ] T056 [P] Add architecture, privacy, scope-escalation, stale-command, and reporter-data-exposure tests in `web/tests/architecture/job-post-management-boundaries.test.ts` and `web/tests/security/job-post-management/`
- [ ] T057 Add targeted administrator/recruiter/candidate Playwright flows in `web/tests/system/e2e/job-post-management/`
- [ ] T058 Update [quickstart.md](./quickstart.md), validate all scenarios, run formatter/typecheck/targeted suites, and record results in `spec-kit/specs/018-admin-job-management/quickstart.md`

---

## Dependencies & Execution Order

1. Complete T001-T004, then T005-T014. These foundations block every user story.
2. US1 (T015-T023) establishes the resource and may be demonstrated after T014.
3. US2 (T024-T032) depends on the shared action panel and projection safeguards but does not depend on correction/feature/enforcement implementation.
4. US3 (T033-T040) depends on the review-projection extension from T012 and lifecycle hide composition from US2.
5. US4 (T041-T046) and US5 (T047-T052) can proceed in parallel after T014; both merge into the shared action panel sequentially.
6. T053-T058 require all selected stories and close the release-quality gate.

## Parallel Opportunities

- T002-T004 can run in parallel after the initial test directory setup.
- T008-T009 can run in parallel with migration design after T005 is agreed.
- Test tasks marked `[P]` in each story can be written in parallel before their implementation task.
- US4 and US5 backend work can run in parallel after foundational storage and command contracts are stable.
- Shared frontend files (`job-post-management-action-panel.tsx`, `job-post-management-show.tsx`) must be merged sequentially.

## Implementation Strategy

1. Deliver foundational persistence/authorization first and fail closed on all unknown state.
2. Deliver US1 list/detail as the initial visible checkpoint.
3. Deliver US2 and US3 as the complete P1 post-publication safety workflow; do not release lifecycle controls without candidate projection checks and correction integrity.
4. Deliver US4/US5 as governed operational expansion, then archive automation and full verification.
5. Every completed task is marked `[X]` only after its targeted validation has passed.
