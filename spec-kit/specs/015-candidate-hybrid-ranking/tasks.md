# Tasks: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

**Input**: Design documents from `spec-kit/specs/015-candidate-hybrid-ranking/`  
**Prerequisites**: Feature 012 Group 1 authorities, `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Tests-first is required by this feature because scoring determinism, concurrency, authorization, privacy, and human-decision governance are acceptance-critical.

## Phase 1: Setup

**Purpose**: Establish additive module and contract scaffolding without changing Group 1 behavior.

- [X] T001 Create scoring module directories and public boundaries in `web/src/backend/scoring/index.ts`
- [X] T002 [P] Create shared scoring contract barrel in `web/src/shared/contracts/scoring/index.ts`
- [X] T003 [P] Create focused test directory fixtures in `web/tests/backend/scoring/fixtures.ts`
- [X] T004 [P] Add scoring worker entrypoint wiring in `web/scripts/run-application-scoring-worker.mjs`
- [X] T005 Add Feature 015 environment validation placeholders without provider secrets in `web/src/backend/scoring/providers/config.ts`

---

## Phase 2: Foundational

**Purpose**: Blocking schema, authorization, provider, worker, audit, and contract foundations.

**⚠️ CRITICAL**: No user-story work starts until this phase is complete.

- [ ] T006 Write migration preflight and non-authoritative scalar-score assertions in `web/tests/backend/scoring/migration-preflight.test.ts`
- [X] T007 Extend Prisma schema with immutable scoring, parse/evidence, operation, attempt, priority, and stage-detail models in `web/prisma/schema.prisma`
- [X] T008 Create additive forward migration with uniqueness, partial-active-priority, lineage, and ranking indexes in `web/prisma/migrations/*_candidate_hybrid_ranking/migration.sql`
- [X] T009 [P] Define discriminated scoring-state, parsing, formula, list, operation, priority, and decision schemas in `web/src/shared/contracts/scoring/schemas.ts`
- [ ] T010 [P] Add OpenAPI/shared-contract parity tests in `web/tests/shared/scoring/openapi-parity.test.ts`
- [ ] T011 [P] Add tenant/role/job authority and revocation tests in `web/tests/security/scoring/authorization.test.ts`
- [X] T012 Extend Group 1 recruiter authorization instead of duplicating document access in `web/src/backend/applications/authorization/recruiter-application-authorization.ts`
- [X] T013 Define repository ports and transactional publication contracts in `web/src/backend/scoring/repositories/scoring-repository.ts`
- [X] T014 Implement Prisma scoring repository with immutable publication and generation fencing in `web/src/backend/scoring/repositories/prisma-scoring-repository.ts`
- [X] T015 [P] Define `AiAssessmentProviderPort` and normalized provider errors in `web/src/backend/scoring/providers/ai-assessment-provider-port.ts`
- [ ] T016 [P] Add provider timeout, malformed output, redaction, retry/backoff, circuit-breaker tests in `web/tests/backend/scoring/ai-provider-boundary.test.ts`
- [X] T017 Implement approved AI adapter with schema validation and bounded resilience in `web/src/backend/scoring/providers/approved-ai-assessment-adapter.ts`
- [X] T018 Implement leased work claiming, stale-result fencing, and reconciled counters in `web/src/backend/scoring/workers/scoring-worker.ts`
- [ ] T019 [P] Add worker lease/idempotency/late-response tests in `web/tests/backend/scoring/scoring-worker-concurrency.test.ts`
- [X] T020 Extend structured audit action/reason allowlists in `web/src/backend/audit/application-audit-events.ts`
- [X] T021 Add derived-evidence retention/erasure/legal-hold integration in `web/src/backend/scoring/workers/scoring-retention.ts`
- [ ] T022 [P] Add privacy/log/provider-payload/internal-note leakage tests in `web/tests/security/scoring/privacy.test.ts`

**Checkpoint**: Foundational authorities are additive, provider independent, tenant safe, and migration ready.

---

## Phase 3: User Story 1 — Automatic deterministic matching (Priority: P1) 🎯 MVP

**Goal**: Publish reproducible automatic score, extraction, evidence, experience, and parser honesty without AI.

**Independent Test**: With AI disabled, exact CV/JD/config fixtures produce the expected 0–100 result and evidence while final remains not calculated.

- [X] T023 [P] [US1] Add deterministic reproducibility, zero-skill, missing-skill, preferred-skill, and experience tests in `web/tests/backend/scoring/automatic-match.test.ts`
- [ ] T024 [P] [US1] Add parser status/provenance and incomplete-score tests in `web/tests/backend/scoring/parser-provenance.test.ts`
- [X] T025 [US1] Implement versioned CV/JD parser orchestration in `web/src/backend/scoring/services/document-parsing-service.ts`
- [X] T026 [US1] Implement normalized skill and verbatim source-span extraction in `web/src/backend/scoring/domain/skill-evidence-extractor.ts`
- [X] T027 [US1] Implement deterministic skill/experience calculation in `web/src/backend/scoring/domain/automatic-match-calculator.ts`
- [X] T028 [US1] Implement automatic result service and immutable persistence in `web/src/backend/scoring/services/automatic-match-service.ts`
- [ ] T029 [P] [US1] Add automatic-match response projection tests in `web/tests/shared/scoring/automatic-match-contract.test.ts`

---

## Phase 4: User Story 2 — AI assessment and hybrid score (Priority: P1)

**Goal**: Publish explainable schema-valid AI and exact auditable 60/40 final results.

**Independent Test**: Automatic 92 and AI 88 publish 90.4 with complete provenance/explanation; timeout/malformed responses preserve fallback.

- [X] T030 [P] [US2] Add hybrid formula, one-rounding, lineage mismatch, and no-partial-final tests in `web/tests/backend/scoring/hybrid-score.test.ts`
- [ ] T031 [P] [US2] Add AI explanation, confidence, compliance, question-link/fallback tests in `web/tests/backend/scoring/ai-assessment.test.ts`
- [X] T032 [US2] Implement provider-neutral AI assessment normalization in `web/src/backend/scoring/services/ai-assessment-service.ts`
- [X] T033 [US2] Implement fixed versioned hybrid formula and score-band labels in `web/src/backend/scoring/domain/hybrid-score-calculator.ts`
- [X] T034 [US2] Implement atomic scored/deterministic-fallback publication in `web/src/backend/scoring/services/scoring-publication-service.ts`
- [X] T035 [US2] Implement authorized scoring detail route in `web/src/app/api/recruiter/applications/[applicationId]/scoring/route.ts`
- [ ] T036 [P] [US2] Add detail route contract/authorization/state-union tests in `web/tests/backend/scoring/scoring-detail-route.test.ts`
- [X] T037 [P] [US2] Implement score drawer automatic/AI tabs with explicit labels in `web/src/frontend/features/recruiter-applications/candidate-score-drawer.tsx`
- [X] T038 [P] [US2] Implement Group 1 viewer-composing documents tab in `web/src/frontend/features/recruiter-applications/documents-tab.tsx`
- [ ] T039 [US2] Add drawer accessibility/state/parser-warning tests in `web/tests/frontend/scoring/candidate-score-drawer.test.tsx`

---

## Phase 5: User Story 3 — Score-aware list, filters, and pagination (Priority: P1)

**Goal**: Provide stable ranking and combinable transparent filters at campaign scale.

**Independent Test**: A snapshot traversal remains exact across mid-browse rescore and page-size changes cannot reinterpret cursors.

- [ ] T040 [P] [US3] Add ranking, non-final grouping, filter-chip, processing-exclusion tests in `web/tests/backend/scoring/ranked-list.test.ts`
- [X] T041 [P] [US3] Add snapshot cursor tamper/filter/job/page-size binding tests in `web/tests/security/scoring/ranking-cursor.test.ts`
- [X] T042 [US3] Implement immutable ranking snapshot repository in `web/src/backend/scoring/pagination/ranking-snapshot-repository.ts`
- [X] T043 [US3] Implement score-aware keyset cursor codec in `web/src/backend/scoring/pagination/ranking-cursor.ts`
- [ ] T044 [US3] Extend recruiter list query with sort/filter/status metadata in `web/src/backend/applications/services/recruiter-application-service.ts`
- [X] T045 [US3] Implement ranked list route in `web/src/app/api/recruiter/jobs/[jobId]/applications/ranked/route.ts`
- [X] T046 [P] [US3] Implement ranking list and removable filter chips in `web/src/frontend/features/recruiter-applications/candidate-ranking-list.tsx`
- [X] T047 [US3] Add list accessibility, no-color-only, exclusion-copy, and pagination tests in `web/tests/frontend/scoring/candidate-ranking-list.test.tsx`

---

## Phase 6: User Story 4 — Campaign background rescore (Priority: P1)

**Goal**: Rescore up to 10,000 applications while old results and priorities remain usable.

**Independent Test**: Mixed outcomes publish independently, open reads never blank, and zero-item batch completes cleanly.

- [ ] T048 [P] [US4] Add old-score continuity, partial-failure, supersession, priority-preservation, and zero-item tests in `web/tests/backend/scoring/job-rescore.test.ts`
- [X] T049 [US4] Implement job rescore orchestration and item enumeration in `web/src/backend/scoring/services/job-rescore-service.ts`
- [X] T050 [US4] Implement rescore trigger/status routes in `web/src/app/api/recruiter/jobs/[jobId]/scoring/rescore/route.ts`
- [X] T051 [US4] Implement operation status route in `web/src/app/api/recruiter/jobs/[jobId]/scoring/rescore/[operationId]/route.ts`
- [X] T052 [P] [US4] Implement accessible confirmation/in-progress UI in `web/src/frontend/features/recruiter-applications/rescore-confirm-modal.tsx`
- [ ] T053 [US4] Add cancel/ESC/no-side-effect and live old-result continuity tests in `web/tests/frontend/scoring/rescore-flow.test.tsx`

---

## Phase 7: User Story 5 — Per-candidate AI retry (Priority: P1)

**Goal**: Recover AI only while preserving deterministic identity and background behavior.

**Independent Test**: Retry from unavailable never invokes deterministic calculation and returns to scored/unavailable persistently.

- [ ] T054 [P] [US5] Add AI-only reuse, duplicate-click, reopen, success/failure, and support-threshold tests in `web/tests/backend/scoring/ai-retry.test.ts`
- [X] T055 [US5] Implement AI retry orchestration with automatic-result binding in `web/src/backend/scoring/services/ai-retry-service.ts`
- [X] T056 [US5] Implement confirmed AI retry route in `web/src/app/api/recruiter/applications/[applicationId]/scoring/retry-ai/route.ts`
- [X] T057 [US5] Implement retrying/unavailable drawer states in `web/src/frontend/features/recruiter-applications/ai-assessment-tab.tsx`
- [ ] T058 [US5] Add background-close/reopen and distinct-state UI tests in `web/tests/frontend/scoring/ai-retry-flow.test.tsx`

---

## Phase 8: User Story 6 — Manual priority (Priority: P2)

**Goal**: Set/change/remove one durable human override without score mutation.

**Independent Test**: Concurrent writes have one winner, history is complete, and rescore leaves priority unchanged.

- [ ] T059 [P] [US6] Add one-active-row, required-reason, history, CAS, and score-immutability tests in `web/tests/backend/scoring/manual-priority.test.ts`
- [X] T060 [US6] Implement manual priority service and audit integration in `web/src/backend/scoring/services/manual-priority-service.ts`
- [X] T061 [US6] Implement set/remove priority route in `web/src/app/api/recruiter/applications/[applicationId]/priority/route.ts`
- [X] T062 [P] [US6] Implement set/change/remove confirmation UI in `web/src/frontend/features/recruiter-applications/manual-priority-modal.tsx`
- [ ] T063 [US6] Add reason validation, conflict refresh, label, focus, and cancel tests in `web/tests/frontend/scoring/manual-priority-modal.test.tsx`

---

## Phase 9: User Story 7 — Move to interview (Priority: P2)

**Goal**: Extend canonical pipeline authority with an explicit human interview command and notification.

**Independent Test**: Allowed transitions atomically create stage/event/audit/outbox; invalid/racing commands do not.

- [ ] T064 [P] [US7] Add allowed/disallowed stage, CAS race, idempotency, and atomicity tests in `web/tests/backend/scoring/interview-decision.test.ts`
- [ ] T065 [P] [US7] Add exactly-once notification outbox/delivery tests in `web/tests/backend/scoring/interview-notification.test.ts`
- [X] T066 [US7] Extend canonical application decision service in `web/src/backend/applications/services/recruiter-application-decision-service.ts`
- [X] T067 [US7] Implement interview decision route in `web/src/app/api/recruiter/applications/[applicationId]/decisions/interview/route.ts`
- [X] T068 [P] [US7] Implement shared transition confirmation UI in `web/src/frontend/features/recruiter-applications/stage-transition-confirm-modal.tsx`
- [ ] T069 [US7] Add immediate status, invalid-action, keyboard, and confirmation tests in `web/tests/frontend/scoring/interview-transition.test.tsx`

---

## Phase 10: User Story 8 — Reject with reason (Priority: P2)

**Goal**: Commit an accountable canonical rejection while protecting the internal note.

**Independent Test**: Missing/non-allowlisted reasons fail; valid transition is atomic; raced decision has one winner; note never reaches candidate surface.

- [ ] T070 [P] [US8] Add reason allowlist, source-stage, CAS race, atomicity, and no-notification tests in `web/tests/backend/scoring/reject-decision.test.ts`
- [ ] T071 [P] [US8] Add internal-note candidate/API/notification non-disclosure tests in `web/tests/security/scoring/rejection-note.test.ts`
- [X] T072 [US8] Add reject command and structured stage detail to canonical decision service in `web/src/backend/applications/services/recruiter-application-decision-service.ts`
- [X] T073 [US8] Implement reject route in `web/src/app/api/recruiter/applications/[applicationId]/decisions/reject/route.ts`
- [X] T074 [P] [US8] Implement rejection confirmation UI in `web/src/frontend/features/recruiter-applications/reject-candidate-modal.tsx`
- [ ] T075 [US8] Add required-reason, non-default destructive focus, cancel, immediate status, and active-filter tests in `web/tests/frontend/scoring/reject-candidate-modal.test.tsx`

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Prove governance, scale, regression safety, and operational recovery.

- [X] T076 [P] Add architecture guard preventing scoring-to-stage mutation and direct provider/UI document access in `web/tests/architecture/scoring/boundaries.test.ts`
- [ ] T077 [P] Add complete actor/time/reason and no-score-trigger governance tests in `web/tests/security/scoring/human-decision-governance.test.ts`
- [ ] T078 [P] Add all-state no-color-only/accessibility audit in `web/tests/frontend/scoring/accessibility.test.tsx`
- [ ] T079 Build 10,000-row ranked/filter/rescore benchmark harness in `web/tests/performance/scoring/candidate-ranking-rescore.perf.ts`
- [X] T080 Record required percentile/throughput/error/provider evidence in `spec-kit/specs/015-candidate-hybrid-ranking/performance-evidence.md`
- [ ] T081 [P] Add migration rollback/forward-recovery and stale-worker probe in `web/tests/system/scoring/recovery.test.ts`
- [X] T082 Run and record Feature 012 Group 1 submission/document/retention/list regression suite in `spec-kit/specs/015-candidate-hybrid-ranking/quickstart-evidence.md`
- [ ] T083 Run Feature 015 focused suites, production build, migration verification, worker probe, E2E, and all quickstart sections in `spec-kit/specs/015-candidate-hybrid-ranking/quickstart-evidence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks every story.
- **US1**: Starts after Foundational and provides deterministic component to US2/US4/US5.
- **US2**: Depends on US1; provides final score to US3 and published aggregate to US4/US5.
- **US3**: Depends on US2 for score ordering; can proceed in parallel with US4 after publication contract stabilizes.
- **US4**: Depends on US1/US2 and worker foundation.
- **US5**: Depends on US2 fallback and provider boundary; otherwise independent of US4.
- **US6**: Depends only on Foundational, but must pass preservation integration with US4.
- **US7** and **US8**: Depend on Foundational canonical decision service; can proceed in parallel and share stage-version concurrency rules.
- **Polish**: Depends on all selected stories.

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 -> US2 -> US3
                              ├-> US4
                              └-> US5
                      ├-> US6
                      ├-> US7
                      └-> US8
US3 + US4 + US5 + US6 + US7 + US8 -> Polish
```

### Parallel Opportunities

- Schema-contract, security, provider, worker, and privacy tests marked `[P]` use separate files in Foundational.
- Within each story, contract/domain tests precede implementation but independent frontend scaffolding may proceed against frozen schemas.
- After Foundational, US6/US7/US8 can run independently of scoring-calculation work; US3/US4/US5 split after US2.

## Parallel Example: User Story 2

```text
T030 hybrid formula tests
T031 AI explanation tests
then T032 + T033
then T034 + T035
in parallel T037 + T038
then T036 + T039
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational.
2. Complete US1 and prove deterministic fallback with AI disabled.
3. Complete US2 and publish explainable hybrid results.
4. Stop and validate before list ranking or decision writes.

### Incremental Delivery

1. Add US3 ranking/filter/pagination.
2. Add US4 rescore and US5 AI retry.
3. Add US6 manual human override.
4. Add US7/US8 explicit canonical decisions.
5. Complete scale, governance, privacy, accessibility, recovery, and Group 1 regression evidence.

## Scope Guard

- Group 2–4 MUST NOT remove, rename, overwrite, or weaken any Feature 012 Group 1 submission, immutable-document, retention, authorization, privacy, audit, pagination, or human-decision guarantee.
- It MUST NOT treat legacy scalar score fields as authoritative or hand-edit a score.
- It MUST NOT let any score, band, confidence, priority, provider output, or threshold silently or automatically mutate `JobApplication.stage`.
- It MUST NOT create a parallel application/stage enum/event/history/audit/notification authority or bypass existing `ApplicationStageEvent`.
- It MUST NOT add another CV/cover-letter byte path; `documents-tab.tsx` composes Group 1 viewers and service authorization.
- It MUST NOT show a hybrid final when AI is missing, use missing score as zero, silently omit processing rows from score filters, or rely on color alone.
- It MUST NOT send internal rejection notes to candidates/providers/logs or add rejection notification/undo/reopen behavior.
- It MUST NOT change the constitution-fixed 60/40 weights, score bands, canonical stages, or AI-as-advisory rule.

## Format Validation

Every executable item uses `- [ ] TNNN [P?] [US?] Description in exact/path` format; setup/foundational/polish omit story labels, and every story-phase task carries its `[USn]` label.
