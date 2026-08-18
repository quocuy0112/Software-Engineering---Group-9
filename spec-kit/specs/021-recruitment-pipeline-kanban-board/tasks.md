# Tasks: Recruitment Pipeline Kanban Board

**Input**: Design documents from `spec-kit/specs/021-recruitment-pipeline-kanban-board/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/recruitment-pipeline.openapi.yaml`

**Tests**: Required by the feature specification. Write each listed test before its corresponding implementation and confirm that it fails for the expected missing behavior.

**Organization**: Tasks are grouped by user story. All five stories are P1 technical checkpoints that jointly form the releasable P0 workflow; no single story is independently releasable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Safe to execute in parallel after the phase prerequisites are satisfied because the task targets different files and does not depend on another incomplete task in that parallel set.
- **[Story]**: Maps work to one of the five user stories in `spec.md`.
- Every task names its concrete target path. No Prisma schema or migration task is required.

## Phase 1: Setup and Shared Contracts

**Purpose**: Add the one reviewed presentation dependency and establish the typed Feature 019 transport boundary before backend or frontend behavior.

- [X] T001 Add exact `@dnd-kit/core@6.3.1` dependency without `@dnd-kit/sortable` and update the lock entry in `web/package.json` and `package-lock.json`
- [X] T002 [P] Add failing strict-schema tests for all nine stages, labels, role capabilities, board metadata/pages/cards, transition commands/outcomes, and conflict problems in `web/tests/shared/applications/recruitment-pipeline-contracts.test.ts`
- [X] T003 [P] Add failing OpenAPI-to-runtime parity tests for the three reviewed pipeline operations, required headers, bounded pages, and the closed `StageConflict` shape in `web/tests/backend/contract/applications/recruitment-pipeline-openapi-parity.test.ts`
- [X] T004 Implement and export the Zod/type contracts matching `contracts/recruitment-pipeline.openapi.yaml` in `web/src/shared/contracts/applications/recruitment-pipeline.ts` and `web/src/shared/contracts/applications/index.ts`

**Checkpoint**: Feature 019 inputs and outputs are strict, shared, and aligned with the reviewed OpenAPI contract.

---

## Phase 2: Foundational Canonical Job Context and Authorization

**Purpose**: Resolve every Recruiter-facing job reference to one authorized canonical `JobPosting.id` and make that context reusable by every read and mutation path.

**CRITICAL**: This phase blocks every user story. Consumers must never query `JobApplication.jobPostingId` with an unresolved catalogue identifier.

- [X] T005 [P] Expand exhaustive allowed, disallowed, same-stage, and terminal-source transition coverage for all nine canonical stages in `web/tests/backend/unit/jobs/application-stage-policy.test.ts`
- [X] T006 [P] Add failing resolver tests for direct persisted IDs, `JobPostReviewAggregate.jobId -> publicJobPostingId`, duplicate/absent mappings, company mismatches, ACTIVE/CLOSED jobs, and removed jobs in `web/tests/backend/integration/applications/recruiter-job-context.test.ts`
- [X] T007 [P] Add failing authorization-matrix tests for active/inactive accounts, active/suspended/removed memberships, verified/inactive companies, OWNER read-only capabilities, mutable roles, cross-company denial, and multi-company membership in `web/tests/security/applications/recruitment-pipeline-authorization.test.ts`
- [X] T008 [P] Add failing regression tests proving ranked, submitted, scoring-summary, rescore, and document consumers use the resolved canonical job while retaining the requested job key externally in `web/tests/backend/integration/applications/recruiter-job-identity-consumers.test.ts`
- [X] T009 Extend authorization result types and deterministic direct-or-review-aggregate canonical resolution with requested job ID, canonical job ID, company, title, and lifecycle in `web/src/backend/applications/authorization/recruiter-application-authorization.ts`
- [X] T010 Enforce active account, active membership, active verified company, company consistency, ACTIVE/CLOSED lifecycle, neutral unavailable results, and distinct view/mutation capabilities in `web/src/backend/applications/authorization/recruiter-application-authorization.ts`
- [X] T011 [P] Replace unresolved selector-ID database lookups with authorized `jobPostingId` while retaining the requested response context in `web/src/backend/applications/services/ranked-candidate-list.ts`
- [X] T012 [P] Replace unresolved selector-ID database lookups with authorized `jobPostingId` in `web/src/backend/applications/services/list-submitted-candidates.ts`
- [X] T013 [P] Query scoring aggregates by canonical job IDs and map results back to requested campaign IDs in `web/src/backend/applications/services/campaign-scoring-stats.ts`
- [X] T014 [P] Bind document authorization and lookup to the resolved canonical job/application pair in `web/src/backend/applications/services/open-application-document.ts`
- [X] T015 [P] Update job rescore request/status authorization and persistence queries to use canonical job identity in `web/src/backend/scoring/services/job-rescore-service.ts`
- [X] T016 [P] Adapt application-level scoring/detail/priority authorization consumers to the strengthened result contract without broadening access in `web/src/backend/scoring/services/scoring-detail-service.ts`, `web/src/backend/scoring/services/application-scoring-service.ts`, `web/src/backend/scoring/services/ai-retry-service.ts`, and `web/src/backend/scoring/services/manual-priority-service.ts`
- [X] T017 Update application ownership checks to compare `JobApplication.jobPostingId` with the resolved canonical job and expose current state only after authorization in `web/src/backend/applications/authorization/recruiter-application-authorization.ts`
- [X] T018 [P] Extend boundary tests to require centralized job/application authorization and prohibit client, route, scoring, or document code from introducing another job-identity resolver in `web/tests/architecture/applications/application-boundaries.test.ts`

**Checkpoint**: One authorized job context supplies the canonical company and `JobPosting.id` for all application consumers; OWNER has view capability only.

---

## Phase 3: User Story 1 - View One Authorized Job Pipeline (Priority: P1)

**Goal**: An authorized member can switch from the existing ranked list to a job-scoped board, see all nine authoritative columns/counts, and incrementally discover up to 10,000 applications without data leakage.

**Independent Test**: Select direct-ID and catalogue-mapped jobs containing zero through 10,000 applications; verify all authorized applications are discoverable exactly once in the correct stage, OWNER can inspect existing details, score absence is harmless, CLOSED remains usable, and unavailable/cross-company jobs expose no stale data.

### Tests for User Story 1

- [X] T019 [P] [US1] Add failing repository tests for all-nine grouped counts, deterministic `submittedAt DESC, id DESC` pages, signed cursor job/stage binding, page limits, no duplicates/gaps, and complete 10,000-record traversal in `web/tests/backend/integration/applications/recruitment-pipeline-repository.test.ts`
- [X] T020 [P] [US1] Add failing board-service tests for least-privilege cards, server-calculated allowed destinations, OWNER empty destinations, optional/missing scoring, document availability, zero-count stages, and matching count/page visibility predicates in `web/tests/backend/unit/applications/recruitment-pipeline-board.test.ts`
- [X] T021 [P] [US1] Add failing GET contract tests for metadata and stage-page success, strict bounds/cursors, no-store behavior, active/closed jobs, and neutral unavailable responses in `web/tests/backend/contract/applications/recruitment-pipeline-read-routes.contract.test.ts`
- [X] T022 [P] [US1] Add failing component tests for list/board switching, nine columns/counts, initial/job-empty/column-empty/error/retry states, incremental loading, optional score summaries, and existing detail/document actions in `web/tests/frontend/applications/recruitment-pipeline-board.test.tsx`
- [X] T023 [P] [US1] Add failing accessibility tests for labelled view switching, column landmarks/headings, keyboard-operable Load more, readable card identity, non-color state cues, and OWNER read-only presentation in `web/tests/frontend/accessibility/applications/recruitment-pipeline-board.accessibility.test.tsx`

### Implementation for User Story 1

- [X] T024 [US1] Add grouped stage-count and bounded stage-page methods plus least-privilege projection types to `web/src/backend/repositories/applications/application-repository.ts`
- [X] T025 [US1] Implement indexed grouped counts, optional score/document projection, deterministic ordering, signed canonical-job/stage cursors, and de-duplicated bounded pages in `web/src/backend/repositories/applications/prisma-application-repository.ts`
- [X] T026 [US1] Implement authorized metadata and single-stage page orchestration without mutation logic in `web/src/backend/applications/services/recruitment-pipeline-board.ts`
- [X] T027 [P] [US1] Add the thin authorized no-store metadata GET handler in `web/src/app/api/recruiter/jobs/[jobId]/applications/pipeline/route.ts`
- [X] T028 [P] [US1] Add the thin authorized no-store bounded stage-page GET handler in `web/src/app/api/recruiter/jobs/[jobId]/applications/pipeline/[stage]/route.ts`
- [X] T029 [P] [US1] Create the accessible ranked-list/Pipeline-board view shell with conditional mounting in `web/src/frontend/features/recruiter-applications/recruiter-candidate-workspace.tsx`
- [X] T030 [US1] Implement metadata, independent per-stage page/cursor loading, request cancellation, merge de-duplication, retry, and unavailable-cache clearing in `web/src/frontend/features/recruiter-applications/use-recruitment-pipeline.ts`
- [X] T031 [P] [US1] Implement a canonical stage column with count, empty state, bounded cards, and keyboard-operable Load more in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-column.tsx`
- [X] T032 [P] [US1] Implement the minimal application card with stage/version, candidate/submission identity, optional score, and authorized detail/document entry points in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-card.tsx`
- [X] T033 [US1] Compose metadata and nine independently loaded columns with loading, empty, unavailable, and recoverable error states in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx`
- [X] T034 [US1] Integrate the view shell into the selected-job branch while preserving the current selector, ranking list, score drawer, rescore controls, breadcrumbs, and detail flow in `web/src/frontend/features/recruiter-applications/recruiter-candidates-page.tsx` and `web/src/frontend/features/recruiter-applications/candidate-score-drawer.tsx`
- [X] T035 [US1] Add responsive horizontal board/column/card layout, truncation, visible focus, and non-color loading/error/permission states without replacing existing workspace styling in `web/src/frontend/styles/recruiter-workspace-full.css`

**Checkpoint**: User Story 1 is independently demonstrable as a secure, read-only-capable, scalable board; it is not yet a releasable P0 workflow.

---

## Phase 4: User Story 2 - Move Applications Through Ordinary Stages (Priority: P1)

**Goal**: HR_MANAGER, RECRUITER, and HIRING_MANAGER can perform valid ordinary stage moves by pointer or explicit non-drag control, while OWNER and invalid transitions are rejected server-side.

**Independent Test**: Exercise every allowed and disallowed ordinary transition from every non-terminal/terminal source through drag-and-drop, the Change Stage control, and direct requests; verify one persisted stage/history/audit result, unchanged scoring, no unnecessary confirmation, and equivalent keyboard behavior.

### Tests for User Story 2

- [X] T036 [P] [US2] Add failing service tests for the complete ordinary transition matrix, same-stage/terminal rejection, mutable-role matrix, OWNER denial, canonical job/application binding, stageVersion compare-and-set, serializable rollback, history/audit fields, and unchanged scoring in `web/tests/backend/integration/applications/application-stage-authority.test.ts`
- [X] T037 [P] [US2] Add failing PATCH contract/security tests for account/session, same-origin and CSRF boundaries, required Idempotency-Key, strict payloads, neutral target denial, and authoritative outcome/error mapping in `web/tests/backend/contract/applications/recruitment-pipeline-stage-route.contract.test.ts`
- [X] T038 [P] [US2] Add failing pointer and explicit-control component tests for allowed drops, invalid/current-column drops, Escape cancellation, pending state, authoritative success, and no ordinary confirmation dialog in `web/tests/frontend/applications/recruitment-pipeline-movement.test.tsx`
- [X] T039 [P] [US2] Add failing keyboard/accessibility tests for card identification, Change Stage invocation, destination selection, DnD instructions/announcements, cancellation, focus restoration, and non-color feedback in `web/tests/frontend/accessibility/applications/recruitment-pipeline-movement.accessibility.test.tsx`

### Implementation for User Story 2

- [X] T040 [US2] Extend `ApplicationStageService.transition` as the sole ordinary-mutation authority with selected-job/application ownership, mutable-role enforcement, canonical policy validation, expected stageVersion, serializable compare-and-set, stage history, audit, and scoring-field isolation in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T041 [US2] Add the thin `requireAccountRequest`-protected job-scoped PATCH handler using shared contracts and the authoritative service in `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/stage/route.ts`
- [X] T042 [US2] Implement the shared destination selector and ordinary-command boundary without consequential confirmation in `web/src/frontend/features/recruiter-applications/application-stage-change-dialog.tsx`
- [X] T043 [US2] Add command submission, pending-card tracking, server-outcome application, and error classification to `web/src/frontend/features/recruiter-applications/use-recruitment-pipeline.ts`
- [X] T044 [US2] Isolate `@dnd-kit/core` pointer/keyboard sensors, droppable allowed destinations, drag overlay, invalid-drop handling, and Escape cancellation in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx`
- [X] T045 [US2] Add a visible Change Stage control that invokes the same command path as drag and exposes only server-returned destinations in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-card.tsx`
- [X] T046 [US2] Remove mutation controls for OWNER while keeping authorized detail access and preserve server authority for manipulated requests in `web/src/frontend/features/recruiter-applications/recruiter-candidate-workspace.tsx` and `web/src/frontend/features/recruiter-applications/candidate-ranking-list.tsx`
- [X] T047 [US2] Add distinct drag, allowed/invalid destination, pending, success, and error treatments with visible text/icons and focus styling in `web/src/frontend/styles/recruiter-workspace-full.css`

**Checkpoint**: Ordinary movement works through both interaction modes with one server-authoritative state policy.

---

## Phase 5: User Story 3 - Make Consequential Recruitment Decisions (Priority: P1)

**Goal**: Rejection, Offer Declined, and Hired require the reviewed human confirmations and reasons, preserve privacy/audit rules, and cannot be triggered by candidate or AI activity.

**Independent Test**: For every role and allowed/disallowed source, cancel and confirm rejection, Offer Declined, and Hired with missing/invalid/valid reasons; verify only an eligible human action commits, private notes never reach candidates, Hired does not require in-app acceptance, and candidate/scoring activity never moves the application.

### Tests for User Story 3

- [X] T048 [P] [US3] Add failing service tests for the six rejection reasons, required confirmations, optional 2,000-character private note, `OFFERED -> OFFER_DECLINED` reason/terminal rule, `OFFERED -> HIRED` confirmation, role limits, and cancelled/invalid no-side-effect behavior in `web/tests/backend/integration/applications/consequential-stage-decisions.test.ts`
- [X] T049 [P] [US3] Add failing security tests proving candidate acceptance endpoints, scoring workers/results, AI recommendations, OWNER, and unaffiliated actors cannot invoke or indirectly cause recruiter-controlled transitions in `web/tests/security/applications/human-controlled-pipeline.test.ts`
- [X] T050 [P] [US3] Add failing component tests for reason validation, explicit confirmation, cancellation, drag-to-Hired interception, no candidate-acceptance prerequisite, and terminal-result feedback in `web/tests/frontend/applications/consequential-stage-decisions.test.tsx`
- [X] T051 [P] [US3] Add failing privacy tests proving recruiter-private notes are absent from candidate application/history responses, in-app/email payloads, errors, metrics, and ordinary logs in `web/tests/security/applications/rejection-note-privacy.test.ts`

### Implementation for User Story 3

- [X] T052 [US3] Add the existing six-value rejection allowlist, required confirmation, normalized reason snapshot, and optional private-note handling to the authoritative transition in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T053 [US3] Add confirmed `OFFERED -> OFFER_DECLINED` bounded-reason enforcement and confirmed `OFFERED -> HIRED` enforcement without querying candidate acceptance in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T054 [US3] Persist safe reason/audit metadata while excluding `internalNoteEncrypted` from candidate-visible projections, notification inputs, errors, and logs in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T055 [P] [US3] Implement the shared rejection/offer-decline/hiring confirmation UI, including reason controls and a separate Hired confirmation action, in `web/src/frontend/features/recruiter-applications/application-stage-change-dialog.tsx`
- [X] T056 [P] [US3] Adapt the existing rejection and stage-confirmation modals to the shared command semantics without retaining independent transition rules in `web/src/frontend/features/recruiter-applications/reject-candidate-modal.tsx` and `web/src/frontend/features/recruiter-applications/stage-transition-confirm-modal.tsx`
- [X] T057 [US3] Route consequential drag/control intents through confirmation before mutation and restore focus/state on cancellation or validation failure in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx` and `web/src/frontend/features/recruiter-applications/use-recruitment-pipeline.ts`

**Checkpoint**: Every consequential decision is explicit, human-controlled, role-limited, validated, auditable, and privacy-safe.

---

## Phase 6: User Story 4 - Recover from Concurrent and Failed Moves (Priority: P1)

**Goal**: Same-version races, stale views, lost responses, retries, and failed optimistic moves converge on authoritative server state without duplicate side effects or lost updates.

**Independent Test**: Race two actors on one stageVersion, retry an exact command after a lost response, reuse a key with changed input, and inject authorization/network/server failures; verify at most one decision commits, exact replay returns the prior outcome, later decisions use current state/new keys, and every client visibly reconciles.

### Tests for User Story 4

- [X] T058 [P] [US4] Add failing idempotency tests for normalized command digests, exact replay, and same-key changed-payload conflicts including changed target, reason, internal note, confirmation, or bound job context; cover lost-response retry, simultaneous identical attempts, and a genuinely new later decision in `web/tests/backend/integration/applications/application-stage-idempotency.test.ts`
- [X] T059 [P] [US4] Add failing concurrency tests for different same-version destinations, serializable/unique-constraint races, stale stageVersion, one history/audit success, and no loser side effects in `web/tests/backend/integration/applications/application-stage-concurrency.test.ts`
- [X] T060 [P] [US4] Add failing route tests for the three reviewed 409 codes and optional authorized-only `{stage, stageVersion}` current state in `web/tests/backend/contract/applications/recruitment-pipeline-conflict.contract.test.ts`
- [X] T061 [P] [US4] Add failing client tests for optimistic success, rollback, targeted source/destination/count refresh, exact-key retry, new-key rotation, stale reconciliation, unavailable-board clearing, and focus/live feedback in `web/tests/frontend/applications/recruitment-pipeline-recovery.test.tsx`

### Implementation for User Story 4

- [X] T062 [US4] Compute and persist the bounded normalized actor/requested-and-canonical-job/application/version/target/reason/internal-note/confirmation command digest and command source in ApplicationStageEvent.metadata, and support exact-replay outcome reconstruction in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T063 [US4] Convert idempotency/application-version uniqueness and serialization races into verified replay or conflict outcomes without duplicate history/audit success in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T064 [US4] Return reviewed conflict codes and expose current stage/version only after job/application authorization in `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/stage/route.ts`
- [X] T065 [US4] Add operation-scoped original/target/version/payload/idempotency state, optimistic ordinary moves, exact retry reuse, and new-command key rotation in `web/src/frontend/features/recruiter-applications/use-recruitment-pipeline.ts`
- [X] T066 [US4] Reconcile authoritative metadata and affected pages after success/conflict/failure, remove duplicate card copies, roll back unpersisted moves, and clear all cached board data on unavailable responses in `web/src/frontend/features/recruiter-applications/use-recruitment-pipeline.ts`
- [X] T067 [US4] Restore focus to the reconciled card or meaningful column/control and announce pending, success, cancelled, stale, authorization, network, and server outcomes in `web/src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx`

**Checkpoint**: Concurrent and failed operations cannot silently overwrite decisions or leave an unpersisted visual state.

---

## Phase 7: User Story 5 - Receive Reliable Candidate Status Communication (Priority: P1)

**Goal**: Every committed stage transition uses the existing notification/outbox infrastructure with one in-app notification, preference-aware ordinary email, mandatory Hired email, deduplication, and delivery-failure isolation.

**Independent Test**: Commit and exactly replay representative transitions across all stages with email preferences enabled/disabled and provider failures; verify one applicable communication per channel, mandatory Hired email, in-app independence, private-note exclusion, and unchanged committed recruitment state during delivery retries.

### Tests for User Story 5

- [X] T068 [P] [US5] Add failing integration tests for in-app notification on every committed stage, ordinary email preference behavior, mandatory Hired email, exact-retry/concurrency deduplication, and no notification on invalid/cancelled/failed transitions in `web/tests/backend/integration/applications/application-stage-notifications.test.ts`
- [X] T069 [P] [US5] Extend candidate payload/log privacy coverage for stage reasons, private notes, idempotency keys, and candidate/company identifiers in `web/tests/security/notifications/application-stage-notification-privacy.test.ts`
- [X] T070 [P] [US5] Add a documented representative test for committed in-app notification visibility at P95 <= 5 seconds and outbox-provider failure isolation in `web/tests/performance/applications/application-stage-notification-performance.test.ts`

### Implementation for User Story 5

- [X] T071 [US5] Create the existing `APPLICATION_STAGE_CHANGED` in-app notification intent inside the authoritative serializable stage transaction using `createInAppNotification` in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T072 [US5] Enqueue the existing `application-stage-changed.v1` email conditionally for ordinary stages and unconditionally for HIRED without direct provider delivery in `web/src/backend/services/jobs/application-stage-service.ts`
- [X] T073 [US5] Bind in-app and email-outbox deduplication keys to the committed application stage event/version while leaving provider delivery and retry with the existing unchanged outbox worker in `web/src/backend/services/jobs/application-stage-service.ts`

**Checkpoint**: Candidate communication is complete, duplicate-safe, preference-correct, and isolated from external delivery failures.

---

## Phase 8: Compatibility, Performance, and Cross-Cutting Validation

**Purpose**: Remove divergent legacy mutation behavior, prove architectural boundaries and performance targets, and run the complete P0 regression gate.

- [X] T074 [P] Add failing parity tests proving generic-stage, interview, and reject entry points share role, CSRF, idempotency, reason, history/audit, and notification outcomes in `web/tests/backend/contract/applications/application-stage-compatibility.contract.test.ts`
- [X] T075 Convert `RecruiterApplicationDecisionService` into interview/rejection command adapters over `ApplicationStageService` with no independent policy, persistence, idempotency, or notification logic in `web/src/backend/applications/services/recruiter-application-decision-service.ts`
- [X] T076 Apply `requireAccountRequest`, shared contracts, and authoritative service delegation to legacy handlers in `web/src/app/api/recruiter/applications/[applicationId]/stage/route.ts`, `web/src/app/api/recruiter/applications/[applicationId]/decisions/interview/route.ts`, and `web/src/app/api/recruiter/applications/[applicationId]/decisions/reject/route.ts`
- [X] T077 Point existing ranking interview/rejection actions at the job-scoped authoritative command and enforce OWNER read-only rendering in `web/src/frontend/features/recruiter-applications/candidate-ranking-list.tsx`, `web/src/frontend/features/recruiter-applications/reject-candidate-modal.tsx`, and `web/src/frontend/features/recruiter-applications/stage-transition-confirm-modal.tsx`
- [X] T078 [P] Extend architecture tests to prohibit board-specific persistence/notification authorities, client-side Prisma/provider access, raw candidate/private-note logging, and DnD imports outside the presentation boundary in `web/tests/architecture/applications/application-boundaries.test.ts`
- [X] T079 [P] Add representative 10,000-application and concurrent-actor performance coverage for P95 board usability <= 2 seconds, move feedback <= 500 ms, persistence <= 2 seconds, bounded rendered cards/payloads, percentiles, errors, and environment evidence in `web/tests/performance/applications/recruitment-pipeline-performance.test.ts`
- [X] T080 [P] Add a focused Playwright workflow covering job selection, list/board switch, pointer move, keyboard Change Stage, rejection, Hired confirmation, stale conflict, closed job, and unavailable clearing in `web/tests/system/e2e/recruitment-pipeline-kanban/recruitment-pipeline-kanban.spec.ts`
- [X] T081 Run the targeted Feature 019, application, scoring, notification, and job-post-review suites specified in `spec-kit/specs/021-recruitment-pipeline-kanban-board/quickstart.md` and resolve regressions only in files touched by Feature 019
- [X] T082 Run Prisma validation, typecheck, lint, production build, focused Playwright smoke, and the full regression gate from `spec-kit/specs/021-recruitment-pipeline-kanban-board/quickstart.md`; confirm no Prisma migration, no non-canonical stage, no new domain/notification/scoring subsystem, and no out-of-scope capability was introduced

**Checkpoint**: All five P1 stories form one constitution-complete, regression-validated P0 Kanban workflow.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 - Setup and Shared Contracts**: Starts immediately.
- **Phase 2 - Foundational Job Context and Authorization**: Depends on T004 and blocks every user story.
- **Phase 3 - US1 Board Read**: Depends on Phase 2; establishes the workspace, board projection, cards, columns, and local read state used by later stories.
- **Phase 4 - US2 Ordinary Movement**: Depends on US1 and the foundational authorization context.
- **Phase 5 - US3 Consequential Decisions**: Depends on the US2 authoritative command path and shared interaction boundary.
- **Phase 6 - US4 Recovery**: Depends on the mutation path from US2 and consequential command shapes from US3.
- **Phase 7 - US5 Communication**: Depends on the single authoritative mutation and event identity from US2-US4.
- **Phase 8 - Compatibility and Validation**: Depends on all five user-story phases.

### User Story Dependencies

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4 -> US5 -> Compatibility/Release Gate
```

- **US1** is independently testable as a secure read-only-capable board after Foundation.
- **US2** adds the principal ordinary move workflow on US1's board and remains independently testable against ordinary transitions.
- **US3** adds the consequential-decision safeguards to the same authoritative command.
- **US4** hardens that command and client state for concurrency, retry, and failure recovery.
- **US5** completes the required candidate communication consequences.
- The P0 feature is releasable only after US1-US5 and Phase 8 pass; story checkpoints are not partial production releases.

### Within Each Phase

- Write the listed tests first and confirm expected failure before implementation.
- Complete shared contracts before services, services before Route Handlers, and backend contracts before frontend integration.
- Complete T009-T010 before parallel consumer adaptations T011-T016.
- Complete T024 before T025, T025 before T026, and T026 before T027-T028.
- Complete T040 before T041 and frontend mutation integration.
- Complete T062-T063 before finalizing route/client reconciliation in T064-T067.
- Complete notification intent and deduplication before compatibility adapters.

## Parallel Opportunities

### Foundation

After T004, execute the initial policy, resolver, security, and consumer regression tests together:

```text
T005 application-stage policy tests
T006 canonical job-context integration tests
T007 authorization matrix security tests
T008 job-identity consumer regression tests
```

After T010, T011-T016 may be split by consumer file, while T018 may be handled independently.

### User Story 1

T019-T023 can be written in parallel. After T026, the two GET handlers T027-T028 can proceed in parallel; frontend shell/card/column work T029, T031, and T032 can also be split by file before integration in T033-T035.

### User Story 2

T036-T039 can be written in parallel. Backend authority/route work T040-T041 remains sequential; frontend board, card, and style work can be split only after the shared hook/dialog command contract is stable.

### User Story 3

T048-T051 can be written in parallel. T052-T054 are sequential because they modify the same authoritative service; T055-T056 can proceed in parallel before T057 integrates them.

### User Story 4

T058-T061 can be written in parallel. T062-T066 remain sequential across shared service/hook state; T067 follows reconciliation behavior.

### User Story 5 and Cross-Cutting Work

T068-T070 can be written in parallel. After all stories pass, T074, T078, T079, and T080 target independent contract, architecture, performance, and system-test files.

## Implementation Strategy

### Technical MVP Checkpoint

1. Complete Phase 1 and Phase 2.
2. Complete US1 and validate its independent board-read criteria.
3. Demonstrate the job-scoped, tenant-isolated, scalable read board as a technical checkpoint only.
4. Do not release Feature 019 until US2-US5 and Phase 8 are complete.

### Incremental Delivery

1. **Foundation**: shared contracts plus canonical job/company authorization.
2. **US1**: all-nine-stage read board with bounded discovery and existing details.
3. **US2**: one authoritative ordinary mutation through pointer and non-drag controls.
4. **US3**: rejection, Offer Declined, and Hired human safeguards.
5. **US4**: optimistic concurrency, exact retries, rollback, and reconciliation.
6. **US5**: transactional, duplicate-safe candidate communication.
7. **Release Gate**: legacy adapter parity, architecture/security checks, scale/performance evidence, E2E, and full regressions.

## Requirement Coverage Map

| Functional requirements | Requirement area | Tasks |
|-------------------------|------------------|-------|
| FR-001-FR-002 | Existing workspace, one selected ACTIVE/CLOSED job | T006, T010, T022, T029-T035 |
| FR-003-FR-007 | Canonical job identity, ownership, neutral failure, and tenant isolation | T006-T018, T021, T037, T064 |
| FR-008-FR-010 | View/mutation role matrix and OWNER read-only behavior | T007, T010, T020, T036-T037, T046, T048-T049 |
| FR-011-FR-012 | Exactly nine canonical stages and labels | T002-T005, T019-T020, T031-T033 |
| FR-013-FR-018 | Counts, discoverability, cards, details, optional scoring, and board states | T019-T035, T079 |
| FR-019-FR-020 | Pointer DnD, explicit non-drag movement, and keyboard operation | T038-T047, T055-T057, T061, T067, T080 |
| FR-021-FR-027 | Human/server authority, transition policy, transactional state/history/audit, and scoring separation | T005, T036-T043, T048-T054 |
| FR-028-FR-032 | Idempotency, concurrency, cancellation, optimistic rollback, and reconciliation | T058-T067 |
| FR-033-FR-040 | Rejection, Offer Declined, Hired, human confirmation, and no candidate/AI progression | T048-T057, T068, T072 |
| FR-041-FR-046 | Existing notifications, preferences, mandatory Hired email, deduplication, failure isolation, and audit without a new history UI | T054, T068-T076 |
| FR-047-FR-051 | Distinct feedback, authoritative visual state, focus, non-color cues, and proportionate confirmation | T038-T047, T050, T057, T061, T065-T067 |
| FR-052-FR-054 | Visual, persistence, and in-app notification P95 targets | T070, T079, T082 |
| FR-055 | Reuse existing domain, authorization, retrieval, audit, notification, document, scoring, and workspace foundations | T009-T018, T024-T035, T040, T071-T078 |

## Notes

- No Prisma schema or migration work is planned; existing entities, unique constraints, metadata, and indexes are reused.
- `@dnd-kit/core` remains a replaceable presentation dependency and is never a business-rule authority.
- Optional scoring enriches cards only and never blocks board operation or changes recruitment stage.
- Legacy mutation routes remain compatibility adapters only; they must not retain independent policy or side effects.
- Do not add a candidate offer workflow, new notification/scoring/application domain, custom stages, bulk actions, analytics, assignment, scheduling, or collaborative notes.
