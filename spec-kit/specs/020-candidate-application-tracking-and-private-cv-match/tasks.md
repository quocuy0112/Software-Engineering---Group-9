# Tasks: Candidate Application Tracking and Private CV Match

**Input**: Design documents from `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Test-first tasks are included because the specification mandates measurable contract, integration, security, accessibility, retention, fallback, and performance behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on another incomplete task in the same phase.
- **[Story]**: Maps the task to the corresponding user story in `spec.md`.
- Every task includes an exact repository-relative file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish feature directories, commands, and migration scaffolding without changing behavior.

- [ ] T001 Create the candidate application, private match, and shared scoring-engine backend module skeletons under `web/src/backend/candidate-applications/`, `web/src/backend/private-cv-match/`, and `web/src/backend/scoring-engine/`
- [ ] T002 [P] Create frontend feature skeletons under `web/src/frontend/features/candidate-applications/` and `web/src/frontend/features/private-cv-match/`
- [ ] T003 [P] Create shared contract entry points in `web/src/shared/contracts/candidate-applications/index.ts` and `web/src/shared/contracts/private-cv-match/index.ts`
- [ ] T004 [P] Add feature test and performance script entries to `web/package.json` and root forwarding entries to `package.json`
- [ ] T005 Create additive migration scaffolding at `web/prisma/migrations/<timestamp>_candidate_application_tracking_private_match/migration.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared persistence, authorization, scoring, worker, projection, and verification boundaries required by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [ ] T006 Define application draft, intake, public update, notification preference, withdrawal outcome, private check, private attempt, private component, evidence, and cleanup models with required indexes and constraints in `web/prisma/schema.prisma`
- [ ] T007 Implement the additive schema migration, legacy intake/default-preference backfill, private-pipeline isolation constraints, and reversible indexes in `web/prisma/migrations/<timestamp>_candidate_application_tracking_private_match/migration.sql`
- [x] T008 [P] Implement shared Zod value contracts for score inputs, provenance, 60/40 components, bands, and limited/full discriminated states in `web/src/backend/scoring-engine/scoring-contracts.ts`
- [x] T009 [P] Implement the exact one-time-rounding 60/40 formula and approved band policy in `web/src/backend/scoring-engine/hybrid-score-policy.ts`
- [x] T010 [P] Define persistence-free automatic matching and AI evaluation ports in `web/src/backend/scoring-engine/automatic-matching-port.ts` and `web/src/backend/scoring-engine/ai-evaluation-port.ts`
- [x] T011 Adapt the existing Feature 015 deterministic matcher and the selected OpenAI Responses API adapter (`gpt-5.4-mini-2026-03-17` baseline) behind purpose-neutral ports with DPA/cross-border/privacy/zero-data-retention gates in `web/src/backend/scoring-engine/scoring-engine-adapter.ts`
- [ ] T012 [P] Implement Candidate session, ownership, CSRF, and indistinguishable-unavailable helpers in `web/src/backend/security/candidate-application-request-boundary.ts`
- [ ] T013 [P] Implement Candidate-safe application and private-report error mappings in `web/src/backend/candidate-applications/candidate-application-errors.ts` and `web/src/backend/private-cv-match/private-match-errors.ts`
- [ ] T014 Implement the application repository transaction boundary for drafts, submission, intake, public updates, preferences, and withdrawal in `web/src/backend/repositories/candidate-applications/prisma-candidate-application-repository.ts`
- [x] T015 Implement the isolated private-check repository with owner predicates, immutable attempts, current publication, leases, and cleanup claims in `web/src/backend/repositories/private-cv-match/prisma-private-cv-match-repository.ts`
- [x] T016 [P] Add a migration verifier for uniqueness, stage preservation, private-table isolation, current-attempt integrity, deadlines, and work indexes in `web/scripts/verify-candidate-application-private-match-migration.mjs`
- [x] T017 [P] Add architecture tests forbidding recruiter/employer imports or queries of private-match modules in `web/tests/architecture/candidate-application-private-match-boundaries.test.ts`
- [ ] T018 [P] Add cross-owner, cross-company, identifier-tampering, CSRF, and response-shape security fixtures in `web/tests/security/candidate-application-private-match/authorization-matrix.test.ts`
- [ ] T019 [P] Add scoring parity fixtures proving private and employer invocations use identical formula/config behavior without shared persistence in `web/tests/backend/integration/private-cv-match/scoring-engine-parity.test.ts`
- [x] T020 Validate and generate Prisma client changes and make the migration verifier pass using `web/prisma/schema.prisma` and `web/scripts/verify-candidate-application-private-match-migration.mjs`

**Checkpoint**: Database, authorization, isolated persistence, shared scoring engine, and worker primitives are ready; story work may begin.

---

## Phase 3: User Story 1 - Review and Submit an Application (Priority: P1)

**Goal**: Deliver one resumable 30-day candidate-job draft and an explicit, transparent, idempotent submission that creates the existing authoritative Application with immutable snapshots.

**Independent Test**: Save and resume a draft, review exact personal/file/message inputs, enforce confirmation, submit the same command twice, and verify one `APPLIED` Application with immutable CV/JD/profile/message snapshots and no recruiter-internal data.

### Tests for User Story 1

- [ ] T021 [P] [US1] Add draft and submission contract tests for CSRF, idempotent `200/201`, stale revision, job/CV ownership, confirmed parse state, PDF/DOCX MIME and extension agreement, exact 5,000,000-byte boundary/tampering rejection, and safe errors in `web/tests/backend/contract/candidate-applications/draft-submit.contract.test.ts`
- [ ] T022 [P] [US1] Add repository integration tests for one draft per candidate-job, sliding 30-day expiry, transactional submission, unique replay, and draft consumption in `web/tests/backend/integration/candidate-applications/draft-submit.test.ts`
- [ ] T023 [P] [US1] Add component tests for the three-step wizard, consolidated checklist, file changes, confirmation gating, transparency copy, and retry feedback in `web/tests/frontend/components/candidate-applications/review-submit.test.tsx`
- [ ] T024 [P] [US1] Add keyboard, focus, validation announcement, contrast, and responsive tests for review/submit in `web/tests/frontend/accessibility/candidate-applications/review-submit.accessibility.test.tsx`

### Implementation for User Story 1

- [ ] T025 [P] [US1] Implement draft/save/review/receipt contracts matching the OpenAPI document in `web/src/shared/contracts/candidate-applications/drafts.ts`
- [ ] T026 [US1] Implement revisioned upsert, restore, 30-day expiry, job/CV ownership, confirmed parse state, PDF/DOCX MIME-extension agreement, 5,000,000-byte maximum revalidation, tampering rejection, and draft consumption in `web/src/backend/candidate-applications/application-draft-service.ts`
- [ ] T027 [US1] Extend authoritative application submission for explicit confirmation, immutable CV/JD/profile/message snapshots, initial event/intake/preferences, audit/outbox, and idempotent replay in `web/src/backend/services/jobs/job-application-service.ts`
- [ ] T028 [US1] Implement draft GET/PUT Route Handler with server session, CSRF, and Zod validation in `web/src/app/api/candidate/application-drafts/route.ts`
- [ ] T029 [US1] Implement idempotent Application submission Route Handler in `web/src/app/api/candidate/applications/route.ts`
- [ ] T030 [P] [US1] Implement Candidate application client mutations and recoverable draft state in `web/src/frontend/features/candidate-applications/client/use-application-wizard.ts`
- [ ] T031 [P] [US1] Implement personal information and application files steps in `web/src/frontend/features/candidate-applications/components/application-wizard.tsx`
- [ ] T032 [US1] Implement review checklist, change actions, one-way message, confirmation, transparency block, Save draft, and Submit application UI in `web/src/frontend/features/candidate-applications/components/application-review-submit.tsx`
- [ ] T033 [US1] Wire the job application entry and review routes to the new authoritative wizard in `web/src/app/jobs/[slug]/apply/page.tsx` and `web/src/app/jobs/[slug]/apply/review/page.tsx`
- [ ] T034 [US1] Add localized responsive styling and non-color states in `web/src/frontend/features/candidate-applications/styles/application-wizard.css`
- [ ] T035 [US1] Run the US1 contract, integration, component, accessibility, and duplicate-submission tests and record fixes in `web/tests/backend/integration/candidate-applications/draft-submit.test.ts`

**Checkpoint**: US1 is independently demonstrable from draft through one accepted immutable Application.

---

## Phase 4: User Story 2 - Run and Inspect a Private CV Match Check (Priority: P1)

**Goal**: Let an authenticated Candidate run a completely private normal 60/40 check and view its report without creating or influencing employer evaluation.

**Independent Test**: Analyze one owned parsed CV against one visible job with AI available, verify the full explainable score/provenance, and prove recruiter/company/admin paths cannot discover the check or mutate employer scoring.

### Tests for User Story 2

- [ ] T036 [P] [US2] Add create/status/full-report contract tests including owner-only unavailable behavior and forbidden employer fields in `web/tests/backend/contract/private-cv-match/private-match.contract.test.ts`
- [ ] T037 [P] [US2] Add private repository tests for fixed CV/JD/config provenance, immutable attempt publication, current pointer integrity, and no Application relation in `web/tests/backend/integration/private-cv-match/private-match-repository.test.ts`
- [ ] T038 [P] [US2] Add normal scoring tests for deterministic evidence, AI schema validation, one-time rounding, bands, evidence signals, sensitive-attribute exclusion, and truthful guidance in `web/tests/backend/unit/private-cv-match/private-match-scoring.test.ts`
- [ ] T039 [P] [US2] Add setup, report-ready, and full-report component tests for every required block and Apply now prefill behavior in `web/tests/frontend/components/private-cv-match/private-match-normal.test.tsx`
- [ ] T040 [P] [US2] Add keyboard, focus, progress announcement, report semantics, contrast, and responsive tests in `web/tests/frontend/accessibility/private-cv-match/private-match.accessibility.test.tsx`
- [x] T041 [P] [US2] Add security tests proving recruiter/company/admin enumeration, exports, logs, and employer result repositories cannot access private checks in `web/tests/security/candidate-application-private-match/private-pipeline-isolation.test.ts`

### Implementation for User Story 2

- [x] T042 [P] [US2] Implement setup, status, evidence, metric, provenance, and full-report discriminated contracts in `web/src/shared/contracts/private-cv-match/index.ts`
- [x] T043 [US2] Implement check creation, CV/JD eligibility, immutable sanitized input snapshots, idempotency, and background enqueue in `web/src/backend/private-cv-match/private-cv-match-service.ts`
- [x] T044 [US2] Implement deterministic-first and normal hybrid attempt execution with schema validation and atomic publication in `web/src/backend/private-cv-match/private-match-worker.ts`
- [x] T045 [US2] Implement owner-only status/ready/full report projections with recruiter fields structurally absent in `web/src/backend/private-cv-match/private-match-projection.ts`
- [x] T046 [US2] Implement create and owner-only read Route Handlers in `web/src/app/api/candidate/private-cv-matches/route.ts` and `web/src/app/api/candidate/private-cv-matches/[checkId]/route.ts`
- [x] T047 [P] [US2] Implement the private-match worker entry and probe in `web/scripts/run-candidate-match-worker.mjs`
- [x] T048 [P] [US2] Implement setup job/CV selectors, requirement chips, parse status, comparison checklist, limitations, and privacy callout in `web/src/frontend/features/private-cv-match/components/private-match-setup.tsx`
- [x] T049 [P] [US2] Implement analysis progress and report-ready preview with sources and privacy commitments in `web/src/frontend/features/private-cv-match/components/private-match-ready.tsx`
- [x] T050 [US2] Implement full report metrics, matched requirements, gaps, evidence quotes, prioritized actions, formula, provenance, and privacy block in `web/src/frontend/features/private-cv-match/components/private-match-report.tsx`
- [x] T051 [US2] Implement polling, cache invalidation after analysis commands, and Apply now prefill clients in `web/src/frontend/features/private-cv-match/client/use-private-cv-match.ts`
- [x] T052 [US2] Wire setup and owner-only report routes in `web/src/app/jobs/matches/page.tsx` and `web/src/app/jobs/matches/[checkId]/page.tsx`
- [x] T053 [US2] Add responsive private-report layout and non-color score/confidence/band styles in `web/src/frontend/features/private-cv-match/styles/private-cv-match.css`
- [ ] T054 [US2] Run US2 contract, scoring, isolation, component, accessibility, and parity tests and record fixes in `web/tests/backend/integration/private-cv-match/scoring-engine-parity.test.ts`

**Checkpoint**: US2 independently delivers a normal private report with proven storage/query isolation.

---

## Phase 5: User Story 3 - Track a Submitted Application (Priority: P1)

**Goal**: Show persistent technical intake and Candidate-safe public recruitment progress without exposing scoring or recruiter internals.

**Independent Test**: Submit, leave/reopen during intake, complete intake, advance canonical stages, and verify monotonic processing, safe four-stage mapping, timeline freshness, immutable files, and zero score/note/rank leakage.

### Tests for User Story 3

- [ ] T055 [P] [US3] Add tracker contract tests for intake/public mapping, allow-listed updates, immutable files, ownership, and forbidden fields in `web/tests/backend/contract/candidate-applications/tracker.contract.test.ts`
- [ ] T056 [P] [US3] Add intake worker tests for leases, monotonic progress/timestamps, retry, attention-required recovery, cancellation, and duplicate/out-of-order events in `web/tests/backend/integration/candidate-applications/application-intake.test.ts`
- [ ] T057 [P] [US3] Add stage projection and notification freshness integration tests across all canonical stages and AI failures in `web/tests/backend/integration/candidate-applications/application-tracking.test.ts`
- [ ] T058 [P] [US3] Add processing/tracker component tests for progress, timeline, immutable files, privacy banner, empty/error/retry states, and four-second refresh in `web/tests/frontend/components/candidate-applications/application-tracker.test.tsx`
- [ ] T059 [P] [US3] Add tracker keyboard, live-region, contrast, responsive stepper, and non-color status tests in `web/tests/frontend/accessibility/candidate-applications/application-tracker.accessibility.test.tsx`

### Implementation for User Story 3

- [ ] T060 [P] [US3] Implement intake, public stage, public update, file, and tracker contracts in `web/src/shared/contracts/candidate-applications/tracking.ts`
- [ ] T061 [US3] Implement leased technical intake state transitions and content-free failure recovery in `web/src/backend/candidate-applications/application-intake-service.ts`
- [ ] T062 [US3] Extend the existing Candidate tracking repository with safe intake, public update, withdrawal outcome, and preference projections in `web/src/backend/repositories/jobs/prisma-application-tracking-repository.ts`
- [ ] T063 [US3] Implement canonical-to-public stage mapping and allow-listed timeline projection in `web/src/backend/candidate-applications/candidate-application-tracking-service.ts`
- [ ] T064 [US3] Implement the owner-only tracker Route Handler in `web/src/app/api/candidate/applications/[applicationId]/route.ts`
- [ ] T065 [P] [US3] Implement four-second visible-page polling and immediate mutation invalidation in `web/src/frontend/features/candidate-applications/client/use-application-tracker.ts`
- [ ] T066 [P] [US3] Implement technical intake progress with three timestamped steps and no-scoring disclosure in `web/src/frontend/features/candidate-applications/components/application-processing.tsx`
- [ ] T067 [US3] Implement public stepper, updates timeline, version-locked files, privacy banner, and safe status display in `web/src/frontend/features/candidate-applications/components/application-tracker.tsx`
- [ ] T068 [US3] Wire processing and long-lived tracking pages in `web/src/app/jobs/applied/[applicationId]/processing/page.tsx` and `web/src/app/jobs/applied/[applicationId]/page.tsx`
- [ ] T069 [US3] Run US3 contract, intake, tracking, notification, component, accessibility, and AI-independence tests and record fixes in `web/tests/backend/integration/candidate-applications/application-tracking.test.ts`

**Checkpoint**: US3 independently provides accurate processing and public tracking with strict Candidate-safe projection.

---

## Phase 6: User Story 4 - Continue in Limited Mode When AI Is Unavailable (Priority: P2)

**Goal**: Preserve a complete deterministic report, uninterrupted Apply now, and immutable retry history whenever AI fails.

**Independent Test**: Force AI timeout/malformed output, verify `—` and no hybrid/band, retry against fixed inputs, keep the limited report readable, and promote the same check after successful AI completion.

### Tests for User Story 4

- [ ] T070 [P] [US4] Add AI timeout, malformed output, circuit-open, repeated failure, and retry idempotency tests in `web/tests/backend/integration/private-cv-match/private-match-fallback.test.ts`
- [ ] T071 [P] [US4] Add limited-mode contract tests proving full deterministic evidence, null AI/hybrid/band, fixed provenance, and safe retry responses in `web/tests/backend/contract/private-cv-match/private-match-limited.contract.test.ts`
- [ ] T072 [P] [US4] Add limited-mode UI tests for exact labels, `—`, formula replacement, Retry AI, Apply now, and prior-attempt continuity in `web/tests/frontend/components/private-cv-match/private-match-limited.test.tsx`

### Implementation for User Story 4

- [x] T073 [US4] Implement deterministic limited publication and safe AI failure classification in `web/src/backend/private-cv-match/private-match-worker.ts`
- [x] T074 [US4] Implement immutable AI retry attempts, idempotency, lease protection, fixed-input reuse, and current-pointer promotion in `web/src/backend/private-cv-match/private-cv-match-service.ts`
- [x] T075 [US4] Implement the owner-only Retry AI Route Handler in `web/src/app/api/candidate/private-cv-matches/[checkId]/retry-ai/route.ts`
- [x] T076 [US4] Implement the limited report presentation and retry/apply actions in `web/src/frontend/features/private-cv-match/components/private-match-limited-report.tsx`
- [ ] T077 [US4] Run US4 fallback, retry, application-nonblocking, contract, and UI tests and record fixes in `web/tests/backend/integration/private-cv-match/private-match-fallback.test.ts`

**Checkpoint**: US4 independently demonstrates deterministic continuity through AI outage and recovery.

---

## Phase 7: User Story 5 - Control Candidate-Owned Records (Priority: P2)

**Goal**: Support immediate private-report deletion and race-safe pre-interview withdrawal while preserving audit and canonical stage truth.

**Independent Test**: Delete a private check during retry, withdraw an eligible Application, race withdrawal with interview, and verify immediate denial, bounded cleanup, preserved last stage, one terminal outcome, safe notifications, and no cross-record mutation.

### Tests for User Story 5

- [ ] T078 [P] [US5] Add withdrawal contract/integration tests for confirmation, ownership, idempotency, stage eligibility, canonical-stage preservation, and interview races in `web/tests/backend/integration/candidate-applications/application-withdrawal.test.ts`
- [ ] T079 [P] [US5] Add private deletion/expiry tests for immediate denial, in-flight lease invalidation, 12-month expiry, 30-day cleanup, legal hold, and retryable failures in `web/tests/backend/integration/private-cv-match/private-match-retention.test.ts`
- [ ] T080 [P] [US5] Add withdrawal/delete confirmation, success, conflict, unavailable, and focus-recovery component tests in `web/tests/frontend/components/candidate-applications/candidate-data-controls.test.tsx`
- [ ] T081 [P] [US5] Add audit/log privacy tests proving no CV quote, private evidence, message, sensitive attribute, or raw AI output is emitted in `web/tests/security/candidate-application-private-match/audit-log-privacy.test.ts`

### Implementation for User Story 5

- [ ] T082 [US5] Implement transactional pre-interview withdrawal with optimistic concurrency, preserved canonical stage, terminal outcome, active-work stop, public update, audit, and recruiter notification intent in `web/src/backend/candidate-applications/application-withdrawal-service.ts`
- [ ] T083 [US5] Implement the owner-only withdrawal Route Handler in `web/src/app/api/candidate/applications/[applicationId]/withdraw/route.ts`
- [ ] T084 [US5] Implement immediate private logical deletion, lease invalidation, 12-month expiry, legal-hold denial, and bounded physical cleanup in `web/src/backend/private-cv-match/private-match-retention.ts`
- [x] T085 [US5] Integrate private cleanup claims into the Candidate match worker loop in `web/src/backend/private-cv-match/private-match-worker.ts`
- [ ] T086 [US5] Implement the owner-only private-check DELETE Route Handler and client mutation after T084, plus Application withdrawal/private-check delete confirmation controls in `web/src/app/api/candidate/private-cv-matches/[checkId]/route.ts`, `web/src/frontend/features/private-cv-match/client/use-private-cv-match.ts`, `web/src/frontend/features/candidate-applications/components/application-data-controls.tsx`, and `web/src/frontend/features/private-cv-match/components/private-match-delete-control.tsx`
- [ ] T087 [US5] Add withdrawn public Outcome rendering and disable active tracking actions in `web/src/frontend/features/candidate-applications/components/application-tracker.tsx`
- [ ] T088 [US5] Run US5 withdrawal, deletion, retention, concurrency, audit, notification, and UI tests and record fixes in `web/tests/backend/integration/candidate-applications/application-withdrawal.test.ts`

**Checkpoint**: US5 independently proves Candidate control without corrupting recruitment state or leaking private content.

---

## Phase 8: User Story 6 - Choose Status Notification Channels (Priority: P3)

**Goal**: Persist independent email/in-app preferences per Application and apply them only to optional future public-stage notifications.

**Independent Test**: Configure two Applications differently, trigger public changes, and verify independent delivery while both trackers remain authoritative and mandatory communication is unchanged.

### Tests for User Story 6

- [ ] T089 [P] [US6] Add notification-preference contract tests for ownership, CSRF, optimistic versioning, and Application-local behavior in `web/tests/backend/contract/candidate-applications/notification-preferences.contract.test.ts`
- [ ] T090 [P] [US6] Add integration tests for two Applications with different channel settings, optional delivery, timeline authority, and mandatory-message non-regression in `web/tests/backend/integration/candidate-applications/notification-preferences.test.ts`
- [ ] T091 [P] [US6] Add accessible toggle, persistence, success, error, and cross-Application isolation component tests in `web/tests/frontend/accessibility/candidate-applications/notification-preferences.accessibility.test.tsx`

### Implementation for User Story 6

- [ ] T092 [P] [US6] Implement Application-local notification preference contracts in `web/src/shared/contracts/candidate-applications/notification-preferences.ts`
- [ ] T093 [US6] Implement preference read/update with ownership and optimistic concurrency in `web/src/backend/candidate-applications/application-notification-preference-service.ts`
- [ ] T094 [US6] Update application stage notification production to consult Application-local settings while preserving mandatory behavior in `web/src/backend/services/jobs/application-stage-service.ts`
- [ ] T095 [US6] Implement the preference PATCH Route Handler in `web/src/app/api/candidate/applications/[applicationId]/notification-preferences/route.ts`
- [ ] T096 [US6] Implement email/in-app toggles with persistence feedback in `web/src/frontend/features/candidate-applications/components/application-notification-preferences.tsx`
- [ ] T097 [US6] Run US6 contract, integration, notification non-regression, and accessibility tests and record fixes in `web/tests/backend/integration/candidate-applications/notification-preferences.test.ts`

**Checkpoint**: US6 independently provides per-Application channel control without weakening tracker truth or mandatory delivery.

---

## Phase 9: Polish and Cross-Cutting Release Gates

**Purpose**: Validate the complete P0 workflow, operational safety, accessibility, performance, and regression boundaries.

- [ ] T098 [P] Add a 10,000-Application and 50-private-check representative fixture plus P50/P95/P99/max measurement harness in `web/scripts/measure-candidate-application-private-match-performance.mjs`
- [ ] T099 [P] Add authenticated end-to-end coverage for the seven UI states, Apply now handoff, withdrawal, deletion, and per-Application preferences in `web/tests/system/e2e/candidate-application-private-match/feature-018.spec.ts`
- [ ] T100 [P] Add global forbidden-field regression scans over Candidate APIs, notifications, errors, logs, and downloads in `web/tests/security/candidate-application-private-match/no-recruiter-internal-exposure.test.ts`
- [ ] T101 [P] Add sensitive-attribute exclusion corpus tests across automatic matching, AI requests, explanations, gaps, confidence, and guidance in `web/tests/security/candidate-application-private-match/sensitive-attribute-exclusion.test.ts`
- [ ] T102 Add worker shutdown, lease recovery, retry-budget, cleanup-failure, and provider-circuit operational tests in `web/tests/backend/integration/private-cv-match/private-match-worker-resilience.test.ts`
- [ ] T103 Validate all OpenAPI operations and shared Zod contracts remain in parity in `web/tests/backend/contract/candidate-application-private-match-openapi-parity.test.ts`
- [ ] T104 Execute every scenario and expected result in `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/quickstart.md` and append measured evidence to that file
- [ ] T105 Run Prisma validation/generation, migration deploy/verification, focused feature suite, typecheck, lint, full regression suite, and production build using commands documented in `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/quickstart.md`
- [ ] T106 Review implemented scope against all 46 functional requirements, 13 success criteria, clarifications, and Must NOT Build guards and record traceability in `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/checklists/implementation-readiness.md`
- [ ] T107 Execute the moderated review-and-submit usability protocol with a documented representative Candidate cohort, verify at least 95% complete valid submission on their first attempt within three minutes, and record aggregate evidence only in `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/checklists/usability-results.md`
- [ ] T108 Execute the private-report comprehension protocol with the documented Candidate cohort, verify at least 90% correctly identify guidance/non-sharing/no-ranking-impact, and record aggregate evidence only in `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/checklists/usability-results.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **US1, US2, US3**: P1 work may start in parallel after Phase 2. US3 can use a seeded/legacy Application independently, although integrated release testing includes US1 submission.
- **US4**: Depends on US2's private-check aggregate and normal orchestration.
- **US5**: Depends on the foundational repositories; its private deletion portion depends on US2 and its tracker presentation portion integrates with US3.
- **US6**: Depends on foundational preference storage and integrates with US3 tracking/notification production.
- **Phase 9 — Polish**: Depends on all stories selected for the complete P0 release.

### User Story Dependency Graph

```text
Setup -> Foundation
Foundation -> US1
Foundation -> US2 -> US4
Foundation -> US3
Foundation -> US5 (private-delete completion also uses US2; tracker display uses US3)
Foundation -> US6 (delivery integration uses US3)
US1 + US2 + US3 + US4 + US5 + US6 -> Polish/Release Gates
```

### Within Each User Story

1. Write contract, integration, component, accessibility, and security tests first and verify they fail for the intended missing behavior.
2. Implement story contracts/models before services.
3. Implement repositories/services before Route Handlers and UI integration.
4. Complete focused story validation before marking its checkpoint complete.
5. Never use UI completion as evidence for authorization, persistence, privacy, or fallback correctness.

## Parallel Opportunities

- T002-T004 can run in parallel after T001 establishes naming.
- T008-T010, T012-T013, and T016-T019 target independent foundational files and can run concurrently around repository/migration work.
- After Phase 2, US1, US2, and US3 may proceed concurrently; US4 follows US2.
- All test tasks marked `[P]` within each story can be authored concurrently before implementation.
- Frontend component work marked `[P]` can proceed against frozen shared contracts while backend services are implemented.
- Phase 9 security, performance, and end-to-end harnesses can be prepared in parallel before the final integrated run.

## Parallel Examples

### User Story 1

```text
T021 Contract tests: web/tests/backend/contract/candidate-applications/draft-submit.contract.test.ts
T022 Repository integration: web/tests/backend/integration/candidate-applications/draft-submit.test.ts
T023 Component tests: web/tests/frontend/components/candidate-applications/review-submit.test.tsx
T024 Accessibility tests: web/tests/frontend/accessibility/candidate-applications/review-submit.accessibility.test.tsx
```

### User Story 2

```text
T036 Contract tests: web/tests/backend/contract/private-cv-match/private-match.contract.test.ts
T038 Scoring unit tests: web/tests/backend/unit/private-cv-match/private-match-scoring.test.ts
T040 Accessibility tests: web/tests/frontend/accessibility/private-cv-match/private-match.accessibility.test.tsx
T041 Isolation tests: web/tests/security/candidate-application-private-match/private-pipeline-isolation.test.ts
```

### User Story 3

```text
T055 Tracker contract: web/tests/backend/contract/candidate-applications/tracker.contract.test.ts
T056 Intake integration: web/tests/backend/integration/candidate-applications/application-intake.test.ts
T058 Tracker components: web/tests/frontend/components/candidate-applications/application-tracker.test.tsx
T059 Tracker accessibility: web/tests/frontend/accessibility/candidate-applications/application-tracker.accessibility.test.tsx
```

### User Stories 4-6

```text
US4: T070 fallback integration, T071 limited contract, T072 limited UI
US5: T078 withdrawal race, T079 retention, T080 controls, T081 audit privacy
US6: T089 preference contract, T090 delivery integration, T091 toggle accessibility
```

## Implementation Strategy

### MVP Technical Checkpoint

1. Complete Setup and Foundation.
2. Complete US1 and validate draft/review/idempotent submission independently.
3. This is the suggested first demonstration checkpoint, not a releasable P0 by itself.

### Complete P0 Release Sequence

1. Foundation + US1: authoritative Candidate submission.
2. US3: processing and public tracking.
3. US2 + US4: normal and limited private match.
4. US5: deletion and withdrawal data control.
5. US6: per-Application notification settings.
6. Complete Phase 9 gates before release.

### Team Parallelization

After Foundation:

- Stream A: US1 submission, then US5 withdrawal.
- Stream B: US2 private report, then US4 fallback and private deletion portion of US5.
- Stream C: US3 tracking, then US6 preferences.
- Cross-cutting stream: architecture/security/contract fixtures and Phase 9 harnesses.

## Notes

- `[P]` means safe file-level parallelism, not permission to ignore a listed dependency.
- Private match code may share pure scoring-engine ports/policies only; it must never call employer scoring repositories/services.
- Candidate application projections must remain allow-listed and must never serialize recruiter DTOs then redact them.
- Withdrawal preserves canonical stage and adds an orthogonal terminal outcome.
- Every story checkpoint is independently testable; the constitution requires the full P0 workflow before production release.
- Commit only when requested or according to an explicitly invoked Git hook.
