# Tasks: Submitted Candidates List & CV Access — Group 1

**Input**: Design documents from `spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Required because the specification and plan define contract, integration, security, accessibility, performance, migration, retention, and regression evidence. For each behavior, write the listed test first and confirm it fails for the intended reason.

**Organization**: Tasks are grouped by user story after a shared foundation. All four P1 stories are required for the Group 1 release; US1 alone is only a technical checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on another unfinished task in the phase.
- **[Story]**: Maps the task to a user story in `spec.md`; labels appear only in user-story phases.
- Every task includes an exact file or directory path.

## Phase 1: Setup

**Purpose**: Establish feature-owned structure and executable validation commands without changing product behavior.

- [ ] T001 Create feature directories under `web/src/backend/applications/`, `web/src/backend/repositories/applications/`, `web/src/shared/contracts/applications/`, and `web/src/frontend/features/recruiter-applications/`
- [ ] T002 [P] Add focused application unit, integration, E2E, contract, and performance scripts to `web/package.json`
- [ ] T003 [P] Add synthetic JobApplication, CV, cover-letter, clock, and legal-hold fixture builders in `web/tests/helpers/application-fixture.ts`
- [ ] T004 [P] Create application test folders under `web/tests/{shared,backend,frontend,security,performance,architecture,system}/applications/`

---

## Phase 2: Foundational

**Purpose**: Extend the existing authoritative `JobApplication` flow with immutable evidence, atomic audit, migration safety, retention, and current recruiter authorization. This phase must not create a parallel Application aggregate or submission endpoint.

**⚠️ CRITICAL**: No user-story implementation starts until this phase passes.

### Foundational tests

- [ ] T005 [P] Add failing database invariant tests for existing JobApplication uniqueness, `APPLIED` version 1 creation, immutable document bindings, exclusive cover-letter variants, retention fields, promotion state, and legal holds in `web/tests/backend/applications/application-database-constraints.test.ts`
- [ ] T006 [P] Add failing submission tests for atomic successful JobApplication/stage/idempotency/evidence/promotion/success-audit creation and one content-minimized failure audit after every rejected or rolled-back attempt in `web/tests/backend/applications/job-application-submission-atomicity.test.ts`
- [ ] T007 [P] Add failing concurrency tests for exact replay, conflicting idempotency reuse, and simultaneous candidate-job submissions without timestamp or artifact replacement in `web/tests/backend/applications/job-application-submission-concurrency.test.ts`
- [ ] T008 [P] Add failing storage contract tests for immutable application purpose, encryption, exact bytes, promotion commit, immediate orphan denial, and 24-hour orphan deletion in `web/tests/backend/applications/application-document-storage.contract.test.ts`
- [ ] T009 [P] Add failing migration preflight tests for authoritative backfill, legacy-unavailable classification, duplicate/inconsistent blocking, plaintext scrubbing, and rejection of `appliedJobIds[]` or demo-data synthesis in `web/tests/backend/applications/application-migration-preflight.test.ts`
- [ ] T010 [P] Add failing fake-clock tests for document denial/purge/holds/retries/orphans and exact 365-day deletion of successful and failed submission-audit metadata in `web/tests/backend/applications/application-retention.test.ts` and `web/tests/backend/applications/application-audit-retention.test.ts`
- [ ] T011 [P] Add failing recruiter authorization tests for active account, verified company, active membership, job ownership, application/document binding, revocation, and neutral foreign-resource outcomes in `web/tests/security/applications/recruiter-application-authorization.test.ts`
- [ ] T012 [P] Add failing shared-schema/OpenAPI parity tests for the extended existing submission request/outcome and new recruiter list/document operations in `web/tests/shared/applications/application-contracts.test.ts` and `web/tests/backend/applications/application-openapi-parity.test.ts`
- [ ] T013 [P] Add failing architecture tests enforcing existing route → service → repository/storage boundaries, server-only artifact access, one JobApplication aggregate, and absence of Groups 2–4 behavior in `web/tests/architecture/application-boundaries.test.ts`

### Foundational implementation

- [ ] T014 Extend the existing `JobApplication` and add `ApplicationDocument`, `ApplicationCoverLetterText`, `ApplicationArtifactPromotion`, and `ApplicationDocumentLegalHold` relations, enums, constraints, and indexes in `web/prisma/schema.prisma`
- [ ] T015 Create the additive migration and guarded backfill/scrub SQL in `web/prisma/migrations/*_submitted_candidates/migration.sql`
- [ ] T016 Implement the blocking duplicate, stage/version, artifact-proof, and retention-date preflight in `web/scripts/verify-application-migration.mjs`
- [ ] T017 [P] Extend the existing candidate submission schemas for immutable CV and exclusive optional text/file cover letter in `web/src/shared/contracts/jobs/applications.ts`
- [ ] T018 [P] Define strict recruiter list, cursor, candidate projection, document-kind, document-outcome, and safe-error schemas in `web/src/shared/contracts/applications/index.ts`
- [ ] T019 [P] Define the purpose-separated immutable storage port and retained-object metadata in `web/src/backend/applications/storage/application-document-storage.ts`
- [ ] T020 [P] Implement encrypted local application-document storage by reusing approved CV-storage primitives in `web/src/backend/applications/storage/filesystem.ts`
- [ ] T021 [P] Implement private non-versioned S3/SSE-KMS application-document storage in `web/src/backend/applications/storage/s3.ts`
- [ ] T022 Implement provider selection, immutable promotion to `PROMOTED`, and uncommitted-orphan reconciliation registration without transitioning tokens to `COMMITTED` in `web/src/backend/applications/storage/factory.ts` and `web/src/backend/applications/services/promote-application-document.ts`
- [ ] T023 [P] Define JobApplication list, document, promotion, retention, legal-hold, and transactional submission repository ports in `web/src/backend/repositories/applications/application-repository.ts`
- [ ] T024 Extend existing submission persistence so JobApplication `APPLIED` v1, initial stage event, immutable evidence, idempotency result, repository-owned `PROMOTED` to `COMMITTED` transition, and allowlisted success AuditEvent commit atomically in `web/src/backend/repositories/jobs/prisma-job-application-repository.ts`
- [ ] T025 Implement list/document/retention queries, exact access deadlines, cleanup leases, hold evaluation, and migration classifications in `web/src/backend/repositories/applications/prisma-application-repository.ts`
- [ ] T026 [P] Implement current recruiter/company/job/application authorization with neutral denial outcomes in `web/src/backend/applications/authorization/recruiter-application-authorization.ts`
- [ ] T027 Extend candidate submission orchestration to assign correlation before validation, promote evidence before the atomic repository command, register failed promotions as inaccessible orphans, and write one allowlisted failure audit after each rejection or rollback in `web/src/backend/services/jobs/job-application-service.ts`
- [ ] T028 Extend the existing `POST /api/jobs/[jobId]/applications` parser for bounded CV and exclusive cover-letter variants without creating a second write route in `web/src/app/api/jobs/[jobId]/applications/route.ts`
- [ ] T029 Implement exact retention/erasure denial, leased purge, orphan reconciliation, bounded retries, and content-free warning/critical signals in `web/src/backend/applications/workers/application-retention-worker.ts`
- [ ] T030 Add bounded document/orphan and 365-day submission-audit retention entry points with lease-safe shutdown in `web/scripts/run-application-retention-worker.mjs` and `web/src/backend/applications/workers/application-audit-retention-worker.ts`

**Checkpoint**: Existing submission behavior remains authoritative and now produces immutable, retained, auditable evidence; migrations, storage, authorization, and cleanup are ready for recruiter reads.

---

## Phase 3: User Story 1 — View submitted candidates for a job (Priority: P1)

**Goal**: An authorized Recruiter sees all authoritative, document-complete submissions for an owned job in stable newest-first pages, including approved candidate identity/contact data and an explicit unscored state.

**Independent Test**: Seed 30 unscored applications for one owned job and verify two stable pages with exact job isolation, `submittedAt DESC, id DESC`, verified email/shared phone, no duplicates or omissions, and no ranking/filter/color behavior.

### Tests for User Story 1

- [ ] T031 [P] [US1] Add failing list contract tests for bounded limit, opaque job-bound cursor, no-store response, neutral authorization failure, evidence-backed migrated-row inclusion, legacy-unavailable exclusion, and complete absence of score fields/placeholders in `web/tests/backend/applications/submitted-candidate-list.contract.test.ts`
- [ ] T032 [P] [US1] Add failing PostgreSQL tests for stable keyset pagination, equal-timestamp tie breaks, concurrent inserts, tenant isolation, avatar fallback, and 10,000-row bounded reads in `web/tests/backend/applications/submitted-candidate-list.integration.test.ts`
- [ ] T033 [P] [US1] Add failing component tests for loading, populated, load-more, retry, approved contact fields, unscored rows, and preserved list position in `web/tests/frontend/applications/submitted-candidates-list.test.tsx`
- [ ] T034 [P] [US1] Add failing accessibility tests for row/card semantics, descriptive document actions, keyboard traversal, responsive layout, and non-color status cues in `web/tests/frontend/applications/submitted-candidates-list.accessibility.test.tsx`

### Implementation for User Story 1

- [ ] T035 [US1] Implement job-bound cursor encoding and the `(jobPostingId, submittedAt DESC, id DESC)` complete-document projection in `web/src/backend/repositories/applications/prisma-application-repository.ts`
- [ ] T036 [US1] Implement authorized, privacy-minimized recruiter list orchestration with default 25 and maximum 100 records in `web/src/backend/applications/services/list-submitted-candidates.ts`
- [ ] T037 [US1] Implement `GET /api/recruiter/jobs/[jobId]/applications` with strict validation, current authorization, neutral errors, and private no-store output in `web/src/app/api/recruiter/jobs/[jobId]/applications/route.ts`
- [ ] T038 [P] [US1] Implement cancellable list fetching, opaque pagination, retry, and stale-response protection in `web/src/frontend/features/recruiter-applications/use-submitted-candidates.ts`
- [ ] T039 [US1] Implement responsive score-neutral candidate rows/cards, approved contact display, avatar fallback, and bounded load-more behavior in `web/src/frontend/features/recruiter-applications/submitted-candidates-list.tsx`
- [ ] T040 [US1] Integrate the submitted-candidate view with the selected job in `web/src/frontend/features/recruiter-workspace/job-posting-management.tsx`

**Checkpoint**: US1 is independently demonstrable, but Group 1 is not releasable until original-document access and trustworthy empty/error states also pass.

---

## Phase 4: User Story 2 — Open or download the original CV (Priority: P1)

**Goal**: An authorized Recruiter previews an original PDF CV or downloads exact original PDF/DOCX bytes; unsupported or unreadable preview receives a safe fallback without losing list context.

**Independent Test**: Preview PDF, request DOCX preview, download both formats, compare immutable bytes, corrupt one object, revoke authority, and verify each next request is independently reauthorized and isolated.

### Tests for User Story 2

- [ ] T041 [P] [US2] Add failing CV route contract tests for exact job/application/kind binding, reauthorization, inline versus attachment disposition, no-store/nosniff headers, normalized filenames, retention denial, and neutral errors in `web/tests/backend/applications/cv-document.contract.test.ts`
- [ ] T042 [P] [US2] Add failing storage/integration tests for immutable bytes, PDF preview, DOCX preview-unavailable fallback, corrupt/missing object isolation, legal hold, erasure, and mid-session revocation in `web/tests/backend/applications/cv-document-access.integration.test.ts`
- [ ] T043 [P] [US2] Add failing component/accessibility tests for progress, PDF viewer, explicit download, fallback, error isolation, keyboard close, and focus restoration in `web/tests/frontend/applications/application-cv-viewer.test.tsx`

### Implementation for User Story 2

- [ ] T044 [US2] Implement exact authorized CV metadata resolution, retention/hold evaluation, audit outcome, and storage streaming in `web/src/backend/applications/services/open-application-document.ts`
- [ ] T045 [US2] Implement authenticated PDF-only CV preview and safe preview-unavailable outcomes in `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/documents/[kind]/route.ts`
- [ ] T046 [US2] Implement authenticated exact-byte CV downloads with safe attachment headers in `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/documents/[kind]/download/route.ts`
- [ ] T047 [US2] Implement CV preview/download progress, fallback, isolated error, focus restoration, and return-to-list UI in `web/src/frontend/features/recruiter-applications/application-document-viewer.tsx`
- [ ] T048 [US2] Wire `View CV` and `Download CV` actions into candidate entries in `web/src/frontend/features/recruiter-applications/submitted-candidates-list.tsx`

**Checkpoint**: Required original CV access works independently for a seeded application and does not require a cover letter.

---

## Phase 5: User Story 3 — Open or download the cover letter (Priority: P1)

**Goal**: An authorized Recruiter reads immutable cover-letter text, previews/downloads a cover-letter file, or sees `Not provided` with no invalid action.

**Independent Test**: Seed absent, text, PDF, and DOCX variants and verify text-safe rendering, supported preview, explicit original download, unsupported preview fallback, and exact absence semantics.

### Tests for User Story 3

- [ ] T049 [P] [US3] Add failing cover-letter contract tests for `NONE`, `TEXT`, `PDF`, and `DOCX`, exclusive representation, safe text response, file headers, retention denial, and neutral foreign access in `web/tests/backend/applications/cover-letter-document.contract.test.ts`
- [ ] T050 [P] [US3] Add failing integration tests for encrypted text retrieval, immutable file bytes, absent state, corrupt-file isolation, legal hold, erasure, and current authorization in `web/tests/backend/applications/cover-letter-access.integration.test.ts`
- [ ] T051 [P] [US3] Add failing component/accessibility tests for `Not provided`, safe text viewer, file preview/download, fallback, labelled actions, focus management, and no absent action in `web/tests/frontend/applications/application-cover-letter.test.tsx`

### Implementation for User Story 3

- [ ] T052 [US3] Extend authorized document orchestration for exclusive text/file/absent cover-letter outcomes in `web/src/backend/applications/services/open-application-document.ts`
- [ ] T053 [US3] Extend recruiter document preview and download handlers for cover-letter text, PDF, DOCX, absent, unavailable, and denied outcomes in `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/documents/[kind]/route.ts` and `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/documents/[kind]/download/route.ts`
- [ ] T054 [US3] Implement cover-letter text/file/absent presentation and accessible actions in `web/src/frontend/features/recruiter-applications/application-cover-letter-viewer.tsx`
- [ ] T055 [US3] Wire cover-letter state and actions into each candidate entry without changing CV behavior in `web/src/frontend/features/recruiter-applications/submitted-candidates-list.tsx`

**Checkpoint**: US3 passes independently for all supported cover-letter variants.

---

## Phase 6: User Story 4 — See an empty state for a job with no submissions (Priority: P1)

**Goal**: A successful zero-result request shows a clear empty state; retrieval or authorization failure remains a distinct safe state with retry where appropriate.

**Independent Test**: Open an owned zero-application job, then simulate repository/network failure and recovery; verify the empty message appears only for a successful empty page.

### Tests for User Story 4

- [ ] T056 [P] [US4] Add failing backend tests distinguishing successful empty pages, unavailable legacy rows, repository failure, and neutral authorization outcomes in `web/tests/backend/applications/submitted-candidate-empty-state.test.ts`
- [ ] T057 [P] [US4] Add failing component/accessibility tests for loading-to-empty, loading-to-error, retry recovery, live feedback, and absence of document/score controls in `web/tests/frontend/applications/submitted-candidates-empty-state.test.tsx`

### Implementation for User Story 4

- [ ] T058 [US4] Implement explicit successful-zero and safe list-failure outcomes in `web/src/backend/applications/services/list-submitted-candidates.ts` and `web/src/app/api/recruiter/jobs/[jobId]/applications/route.ts`
- [ ] T059 [US4] Implement distinct empty, loading, error, retry, and recovered states with accessible feedback in `web/src/frontend/features/recruiter-applications/submitted-candidates-list.tsx`

**Checkpoint**: US4 never reports a failed or incomplete retrieval as “no submissions.”

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Prove release-wide privacy, retention, migration, performance, accessibility, and regression gates across all four P1 stories.

- [ ] T060 [P] Add privacy-canary tests proving CV/cover-letter content, contact values, filenames, locators, raw idempotency keys, and future score rationale never enter ordinary logs, analytics, traces, or browser persistence in `web/tests/security/applications/application-privacy-canary.test.ts`
- [ ] T061 [P] Add hostile-input and cross-tenant tests for cursor tampering, header injection, invalid MIME/signature, wrong storage purpose, foreign identifiers, and artifact mismatch in `web/tests/security/applications/application-hostile-inputs.test.ts`
- [ ] T062 [P] Add regression tests for candidate tracking/stages, Feature 004 temporary CV retention, Feature 007 job management, and absence of matching, AI, combined ranking, filtering, and score colors in `web/tests/architecture/application-regression-and-scope.test.ts`
- [ ] T063 [P] Add deterministic 10,000-application first/subsequent-page performance evidence recording environment, dataset construction, warm-up, sample size, duration, concurrency, nearest-rank P50/P95/P99/max, maximum latency, error rate, external-service conditions, and query count in `web/tests/performance/applications/application-list-performance.test.ts` and `web/scripts/measure-application-performance.mjs`
- [ ] T064 [P] Add E2E scenarios for existing candidate submission, populated recruiter list, CV, all cover-letter variants, empty/error recovery, authority revocation, retention denial, and responsive keyboard use in `web/tests/system/applications/submitted-candidates.spec.ts`
- [ ] T065 [P] Add contract drift verification between `spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/contracts/openapi.yaml` and shared Zod schemas in `web/scripts/check-application-contracts.mjs`
- [ ] T066 Add health checks and deployment configuration for bounded document/orphan cleanup and submission-audit retention concurrency with graceful shutdown in `web/src/backend/applications/workers/application-retention-worker.ts`, `web/src/backend/applications/workers/application-audit-retention-worker.ts`, and `web/package.json`
- [ ] T067 Run migration preflight, contract drift, typecheck, lint, focused tests, Feature 004/007 regressions, production build, E2E, worker deadlines, audit expiry, and 10,000-row performance checks; record commands plus environment, dataset, warm-up, sample size, duration, concurrency, percentile method, P50/P95/P99/max, error rate, and external-service conditions in `spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/release-validation.md`
- [ ] T068 Validate every `quickstart.md` scenario and Group 1 acceptance criterion, including desktop/mobile rendering, and record remaining limitations in `spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/release-validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundational**: Depends on Setup and blocks every user story.
- **Phase 3 — US1**: Depends on Foundation.
- **Phase 4 — US2**: Depends on Foundation; T048 integrates with the US1 list.
- **Phase 5 — US3**: Depends on Foundation and reuses the document boundary introduced by US2.
- **Phase 6 — US4**: Depends on the US1 list route/component because it specifies their zero/error branches.
- **Phase 7 — Polish**: Depends on all four P1 stories.

### User Story Dependencies

```text
Setup → Foundation → US1 ─┬→ US2 → US3 ─┐
                          └→ US4 ────────┴→ Polish/Release validation
```

- US1 is the first technical checkpoint.
- US2 provides mandatory CV access.
- US3 extends the same access boundary for optional cover letters.
- US4 makes zero-result behavior trustworthy.
- All four stories are mandatory for release.

### Within Each Phase

- Write and run the listed failing tests before implementation.
- Complete schema and storage primitives before repository work.
- Complete repository work before services, and services before Route Handlers/UI.
- Keep the existing candidate submission route and JobApplication aggregate authoritative.
- Re-run story-focused security and regression tests at every checkpoint.

## Parallel Opportunities

- T002–T004 can run in parallel after T001.
- T005–T013 are parallel test-writing tasks.
- T017–T021, T023, and T026 can proceed in parallel after schema intent is fixed.
- T031–T034, T041–T043, T049–T051, and T056–T057 are parallel story-test groups.
- After Foundation, US1 list work and US2 document-access tests can proceed concurrently; US4 implementation waits for the US1 list component.
- T060–T065 can run in parallel after functional stories complete; T067–T068 consume the results sequentially.

## Parallel Examples

### User Story 1

```text
T031 list contract tests
T032 pagination/tenant integration tests
T033 list component tests
T034 list accessibility tests
```

### User Story 2

```text
T041 CV route contract tests
T042 CV storage/access integration tests
T043 CV viewer component/accessibility tests
```

### User Story 3

```text
T049 cover-letter contract tests
T050 cover-letter integration tests
T051 cover-letter component/accessibility tests
```

### User Story 4

```text
T056 empty/error backend tests
T057 empty/error component/accessibility tests
```

## Implementation Strategy

### Technical Checkpoint First

1. Complete Setup and Foundation.
2. Complete US1 and validate its stable unscored list independently.
3. Treat US1 as a demo checkpoint only, not a release.

### Complete Group 1 Increment

1. Add US2 required CV access.
2. Add US3 optional cover-letter variants.
3. Add US4 explicit empty/error behavior.
4. Complete migration, privacy, retention, performance, accessibility, regression, E2E, and build evidence.
5. Release only when all four P1 stories and applicable constitution gates pass.

### Scope Guard

- Do not create a second Application entity, stage enum, candidate submission route, or candidate application service.
- Do not synthesize submissions from `appliedJobIds[]`, current profile/CV state, or demo JSON.
- Do not add keyword matching, LLM calls, scoring jobs, combined ranking, filtering, score colors, or recruitment decisions.
- Future score fields remain nullable extension points and Group 1 does not read or write them.

## Notes

- `[P]` means distinct-file work without an unfinished dependency.
- Story labels provide traceability to the four P1 stories in `spec.md`.
- Tests must fail for the intended missing behavior before their corresponding implementation begins.
- No task authorizes branch creation, commit, deployment, or use of real candidate data.
