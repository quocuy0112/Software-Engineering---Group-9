# Tasks: Job Board and Advanced Search

**Input**: Design documents from `spec-kit/specs/003-job-board-and-advanced-search/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the user and constitution. Tests are written before their corresponding implementation and include unit, contract, PostgreSQL integration, frontend accessibility, architecture, E2E, migration, and performance evidence.

**Organization**: Tasks are grouped by user story. `[P]` means the task can proceed in parallel because it owns different files and has no dependency on another incomplete task in the same phase.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register focused validation commands and feature paths without changing the existing workspace/dependency baseline.

- [ ] T001 Add `test:job-board` and `perf:job-board` scripts in `web/package.json` and root `package.json`
- [ ] T002 [P] Add Feature 003 test-path and privacy-safe fixture conventions in `web/tests/helpers/job-board-database-fixture.ts`
- [ ] T003 [P] Add the job-board stylesheet import boundary in `web/src/app/globals.css` and create `web/src/frontend/features/jobs/styles/job-board.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, database structures, normalization, security boundary, and fixture support required by every story.

**CRITICAL**: No user-story implementation starts until this phase passes its focused schema/contract checks.

- [ ] T004 Add job/company/CV/save/report/application/notification enums, models, relations, constraints, and indexes in `web/prisma/schema.prisma`
- [ ] T005 Add forward-only PostgreSQL SQL, `pg_trgm`, invariants, and clean/upgrade recovery notes in `web/prisma/migrations/008_job_board_advanced_search/migration.sql`
- [ ] T006 Regenerate the Prisma client under `web/src/backend/generated/prisma/` and validate `web/prisma/schema.prisma`
- [ ] T007 [P] Create strict shared job discovery/detail schemas in `web/src/shared/contracts/jobs/discovery.ts`
- [ ] T008 [P] Create strict save/report/application schemas and canonical problem outcomes in `web/src/shared/contracts/jobs/actions.ts`
- [ ] T009 [P] Write failing schema/unknown-field/OpenAPI fixture tests in `web/tests/shared/unit/contracts/jobs/job-contracts.test.ts`
- [ ] T010 [P] Write failing Vietnamese normalization and cursor tests in `web/tests/backend/unit/jobs/search-normalization.test.ts`
- [ ] T011 Implement bounded Vietnamese normalization and versioned opaque cursors in `web/src/backend/services/jobs/search-normalization.ts`
- [ ] T012 Implement the protected job request boundary using the existing active session, same-origin, and CSRF controls in `web/src/backend/security/job-request-boundary.ts`
- [ ] T013 [P] Add shared job service errors, public field projection types, and action-state types in `web/src/backend/services/jobs/job-types.ts`
- [ ] T014 Complete isolated PostgreSQL company/job/question/CV/candidate fixture lifecycle in `web/tests/helpers/job-board-database-fixture.ts`

**Checkpoint**: Prisma validates/generates; shared contract and normalization tests pass; fixtures never seed production migrations.

---

## Phase 3: User Story 1 - Browse, Search, and Filter Jobs (Priority: P1)

**Goal**: Public actors can discover only active approved jobs through deterministic Vietnamese-aware search, filters, stable sorting, and keyset pagination.

**Independent Test**: Seed all lifecycle states and Vietnamese variants, call the public search API/page with every filter/sort/cursor boundary, and verify only correct active projections within the required timing envelope.

### Tests for User Story 1

- [ ] T015 [P] [US1] Write failing query validation, availability, relevance, tie-break, and cursor unit tests in `web/tests/backend/unit/jobs/job-search-policy.test.ts`
- [ ] T016 [P] [US1] Write failing PostgreSQL visibility/filter/sort/pagination/concurrency tests in `web/tests/backend/integration/jobs/job-search.test.ts`
- [ ] T017 [P] [US1] Write failing GET `/api/jobs` contract/public-field tests in `web/tests/backend/contract/jobs/job-search.contract.test.ts`
- [ ] T018 [P] [US1] Write failing search form, result, empty/error, keyboard, and 320-pixel tests in `web/tests/frontend/components/jobs/job-discovery.test.tsx` and `web/tests/frontend/accessibility/jobs/job-discovery.accessibility.test.tsx`

### Implementation for User Story 1

- [ ] T019 [US1] Implement parameterized indexed public search/count and keyset ordering in `web/src/backend/repositories/jobs/prisma-public-job-repository.ts`
- [ ] T020 [US1] Implement validation, normalization, public availability, projection, and cursor orchestration in `web/src/backend/services/jobs/job-discovery-service.ts`
- [ ] T021 [US1] Implement the thin public search handler in `web/src/app/api/jobs/route.ts`
- [ ] T022 [P] [US1] Implement job search/filter URL controls and accessible result cards in `web/src/frontend/features/jobs/components/job-search-form.tsx` and `web/src/frontend/features/jobs/components/job-card.tsx`
- [ ] T023 [US1] Implement the server-rendered catalogue, total/empty/retry states, and next-cursor link in `web/src/app/jobs/page.tsx`

**Checkpoint**: UC-JOB-01 works anonymously and independently; inactive/private fields never cross the contract.

---

## Phase 4: User Story 2 - View Job Details (Priority: P1)

**Goal**: Public actors can inspect an active or historically public job through a stable URL and receive a neutral response for every non-public state.

**Independent Test**: Open active/closed/expired and missing/private/pending/rejected/removed slugs as visitor and candidate and compare approved fields, state labels, actions, and neutral errors.

### Tests for User Story 2

- [ ] T024 [P] [US2] Write failing public-detail availability/action projection unit tests in `web/tests/backend/unit/jobs/job-detail-policy.test.ts`
- [ ] T025 [P] [US2] Write failing GET `/api/jobs/{slug}` neutral-response and field-allowlist tests in `web/tests/backend/contract/jobs/job-detail.contract.test.ts`
- [ ] T026 [P] [US2] Write failing detail state, action, semantic, keyboard, and 320-pixel tests in `web/tests/frontend/components/jobs/job-detail.test.tsx` and `web/tests/frontend/accessibility/jobs/job-detail.accessibility.test.tsx`

### Implementation for User Story 2

- [ ] T027 [US2] Add public detail and actor-scoped action-state queries in `web/src/backend/repositories/jobs/prisma-public-job-repository.ts`
- [ ] T028 [US2] Add active/closed/expired projection, neutral unavailability, and cache policy in `web/src/backend/services/jobs/job-discovery-service.ts`
- [ ] T029 [US2] Implement the thin detail handler in `web/src/app/api/jobs/[slug]/route.ts`
- [ ] T030 [P] [US2] Implement approved detail sections, textual state badges, and protected-action entry points in `web/src/frontend/features/jobs/components/job-detail.tsx`
- [ ] T031 [US2] Implement metadata/canonical URL, not-found/error behavior, and server-rendered detail page in `web/src/app/jobs/[slug]/page.tsx`

**Checkpoint**: UC-JOB-02 works independently and reveals no moderation or recruiter-private state.

---

## Phase 5: User Story 3 - Apply for a Job (Priority: P1)

**Goal**: An eligible Candidate submits exactly one `Applied` application with confirmed CV, answers, consent, immutable snapshots, audit, and notification work.

**Independent Test**: Submit valid, incomplete, duplicate, concurrent, closed-job, stale-consent, foreign-CV, and injected-failure applications and inspect one authoritative PostgreSQL transaction result.

### Tests for User Story 3

- [ ] T032 [P] [US3] Write failing application eligibility, answer validation, consent, and snapshot tests in `web/tests/backend/unit/jobs/application-policy.test.ts`
- [ ] T033 [P] [US3] Write failing transaction rollback, uniqueness race, idempotency binding, audit, and notification atomicity tests in `web/tests/backend/integration/jobs/job-application.test.ts`
- [ ] T034 [P] [US3] Write failing application-form/submission contract and authorization tests in `web/tests/backend/contract/jobs/job-application.contract.test.ts`
- [ ] T035 [P] [US3] Write failing application form, CV/question/consent, error-focus, retry, and accessible pending-state tests in `web/tests/frontend/components/jobs/job-application.test.tsx` and `web/tests/frontend/accessibility/jobs/job-application.accessibility.test.tsx`

### Implementation for User Story 3

- [ ] T036 [P] [US3] Implement required-profile, confirmed-CV, question/answer, consent, and bounded snapshot policy in `web/src/backend/services/jobs/application-policy.ts`
- [ ] T037 [US3] Implement locked/retry-safe form query and transactional application/audit/notification persistence in `web/src/backend/repositories/jobs/prisma-job-application-repository.ts`
- [ ] T038 [US3] Implement application form and idempotent submission orchestration in `web/src/backend/services/jobs/job-application-service.ts`
- [ ] T039 [P] [US3] Implement the protected application-form handler in `web/src/app/api/jobs/[jobId]/application-form/route.ts`
- [ ] T040 [US3] Implement the protected idempotent submission handler in `web/src/app/api/jobs/[jobId]/applications/route.ts`
- [ ] T041 [US3] Implement accessible CV selection, questions, cover letter, consent, confirmation, and authoritative error recovery in `web/src/frontend/features/jobs/components/job-application-form.tsx`
- [ ] T042 [US3] Wire the Apply action/dialog into `web/src/frontend/features/jobs/components/job-detail.tsx`

**Checkpoint**: UC-APP-01 completes the P0 browse-to-application workflow; duplicate and partial applications are impossible.

---

## Phase 6: User Story 4 - Save or Remove a Job (Priority: P2)

**Goal**: Authenticated users idempotently save/remove their own jobs with authoritative UI reconciliation.

**Independent Test**: Save/remove/race the same job from list/detail using two users and failed/expired sessions; verify only the actor's composite relationship changes.

### Tests for User Story 4

- [ ] T043 [P] [US4] Write failing ownership, idempotency, race, failure, and CSRF tests in `web/tests/backend/integration/jobs/saved-job.test.ts`
- [ ] T044 [P] [US4] Write failing saved-action pending/success/error/reconciliation accessibility tests in `web/tests/frontend/components/jobs/save-job-action.test.tsx`

### Implementation for User Story 4

- [ ] T045 [US4] Implement composite-key create-or-read/delete persistence in `web/src/backend/repositories/jobs/prisma-saved-job-repository.ts`
- [ ] T046 [US4] Implement target validation and authoritative saved-state orchestration in `web/src/backend/services/jobs/saved-job-service.ts`
- [ ] T047 [US4] Implement protected idempotent PUT/DELETE handler in `web/src/app/api/saved-jobs/[jobId]/route.ts`
- [ ] T048 [US4] Implement the accessible reconciled save/remove control in `web/src/frontend/features/jobs/components/save-job-action.tsx` and wire it into list/detail cards

**Checkpoint**: UC-JOB-03 is independently testable and never changes another account's collection.

---

## Phase 7: User Story 5 - Report a Job Posting (Priority: P2)

**Goal**: Authenticated users privately submit bounded, abuse-controlled, non-enforcing moderation reports.

**Independent Test**: Submit all reasons, detail rules, unresolved duplicates, rate-limit excess, removed target, another actor, and transaction failure; inspect private report/audit and unchanged job state.

### Tests for User Story 5

- [ ] T049 [P] [US5] Write failing reason/detail normalization, duplicate, rate-limit, audit, privacy, and rollback tests in `web/tests/backend/integration/jobs/job-report.test.ts`
- [ ] T050 [P] [US5] Write failing report contract, neutral response, and protected-boundary tests in `web/tests/backend/contract/jobs/job-report.contract.test.ts`
- [ ] T051 [P] [US5] Write failing accessible dialog, conditional detail, cancel, pending, duplicate, retry, and focus-restoration tests in `web/tests/frontend/components/jobs/report-job-dialog.test.tsx`

### Implementation for User Story 5

- [ ] T052 [US5] Implement nullable unresolved-key report persistence and audit transaction in `web/src/backend/repositories/jobs/prisma-job-report-repository.ts`
- [ ] T053 [US5] Implement report policy, existing database rate limit, neutral duplicate, and non-enforcement orchestration in `web/src/backend/services/jobs/job-report-service.ts`
- [ ] T054 [US5] Implement the protected report handler in `web/src/app/api/jobs/[jobId]/reports/route.ts`
- [ ] T055 [US5] Implement and wire the accessible report dialog in `web/src/frontend/features/jobs/components/report-job-dialog.tsx` and `web/src/frontend/features/jobs/components/job-detail.tsx`

**Checkpoint**: UC-JOB-05 is independently testable, private, audited, abuse-controlled, and cannot change JobPosting.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Cross-story architecture, E2E, migration, accessibility, performance, and documentation evidence.

- [ ] T056 [P] Add OpenAPI-to-Zod parity and protected/public cache tests in `web/tests/backend/contract/jobs/job-board-openapi-parity.test.ts`
- [ ] T057 [P] Add frontend/server/provider/import boundary tests in `web/tests/architecture/job-board-boundaries.test.ts`
- [ ] T058 [P] Add desktop/mobile public browse/detail E2E coverage in `web/tests/system/e2e/job-board/job-discovery.spec.ts`
- [ ] T059 [P] Add desktop/mobile login-return/save/report/apply and failure-recovery E2E coverage in `web/tests/system/e2e/job-board/job-actions.spec.ts`
- [ ] T060 Implement documented 100-sample p95 search/detail/action harness in `web/scripts/measure-job-board-performance.mjs`
- [ ] T061 Update current features, commands, architecture, privacy, and validation documentation in `README.md` and `docs/operations/job-board-data-lifecycle.md`
- [ ] T062 Run clean/upgraded migration verification and record aggregate results in `spec-kit/specs/003-job-board-and-advanced-search/checklists/migration-results.md`
- [ ] T063 Run focused contract/unit/integration/frontend/E2E checks and record non-sensitive results in `spec-kit/specs/003-job-board-and-advanced-search/checklists/integration-results.md`
- [ ] T064 Run format, lint, typecheck, full tests, build, desktop/mobile accessibility, and performance gates and record results in `spec-kit/specs/003-job-board-and-advanced-search/checklists/release-results.md`
- [ ] T065 Run the documented representative-user browse/filter/detail/apply study for SC-004 and record aggregate results in `spec-kit/specs/003-job-board-and-advanced-search/checklists/usability-results.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 Setup has no dependency.
- Phase 2 Foundational depends on Setup and blocks all user stories.
- US1-US5 depend on Foundational. Their backend tests and repositories may proceed independently after that checkpoint.
- US2 list-to-detail UI integrates with US1 cards but its detail API remains independently testable.
- US3/US4/US5 protected entry points integrate with the US2 detail component after their own service/API slices pass.
- Phase 8 depends on every story selected for release; migration and architecture tests may begin earlier.

### User Story Completion Order

```text
Setup -> Foundation
              |-> US1 Browse/Search ----> US2 Detail ----> US3 Apply (Must MVP)
              |-> US4 Save/Remove (Should)
              `-> US5 Report (Should)
All selected stories -> Cross-cutting release gates
```

### Within Each Story

1. Write and observe failing tests.
2. Implement repository/data behavior.
3. Implement service/policy.
4. Implement thin route handler.
5. Implement accessible UI and integration.
6. Run the independent story checkpoint before marking tasks complete.

## Parallel Opportunities

- T002 and T003 can run while T001 is prepared.
- T007-T010 and T013 own separate contract/test/type files after the schema shape is agreed.
- Within each story, unit/contract/frontend tests marked `[P]` can be authored together before implementation.
- After Foundation, US1 backend, US4, and US5 slices can proceed independently; US3 can proceed using seeded JobPosting/CandidateCv fixtures.
- T056-T059 and T061 are separate files and can proceed after the corresponding behavior stabilizes.

## Implementation Strategy

### Must MVP

1. Complete Setup and Foundation.
2. Complete US1 Browse/Search.
3. Complete US2 Job Details.
4. Complete US3 Apply.
5. Run the P0 end-to-end, authorization, transaction, accessibility, migration, and performance checkpoints.

The constitution requires this complete browse-to-application path; US1 alone is not an acceptable P0 release.

### Incremental Should Delivery

1. Add US4 Save/Remove and validate independently.
2. Add US5 Report and validate independently.
3. Run the full cross-story release sequence and preserve only non-sensitive aggregate evidence.

## Format Validation

- Every executable task uses `- [ ] T###`.
- Every story-phase task includes `[US#]` and an exact repository path.
- Tests precede implementation in each story.
- `[P]` appears only where different files and no incomplete same-phase dependency allow parallel work.
