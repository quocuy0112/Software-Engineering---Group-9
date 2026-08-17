# Tasks: Recruitment Analytics & Data Export

**Input**: Design documents from `specs/022-recruitment-analytics-export/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Tests are required because the specification defines testable acceptance scenarios and measurable accuracy, security, accessibility, parity, retention, and performance outcomes. Story tests must be written first and observed failing before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent technical checkpoint. P1 release scope requires User Stories 1–3; User Story 4 UI/aggregates are P2, while its foundational critical-event capture is mandatory.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on another incomplete task in the same phase.
- **[Story]**: Maps the task to a user story from the specification.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish dependencies, directories, scripts, and feature-level verification commands.

- [ ] T001 Add the pinned ExcelJS dependency and recruitment analytics test/performance/worker scripts to `web/package.json`
- [ ] T002 [P] Create analytics shared-contract barrels and definition-version constants in `web/src/shared/contracts/analytics/index.ts`, `web/src/shared/contracts/analytics/admin.ts`, `web/src/shared/contracts/analytics/employer.ts`, and `web/src/shared/contracts/analytics/exports.ts`
- [ ] T003 [P] Create analytics backend, export, storage, repository, and frontend feature directory barrels in `web/src/backend/analytics/index.ts`, `web/src/backend/exports/index.ts`, `web/src/backend/repositories/analytics/index.ts`, `web/src/frontend/features/admin/analytics/index.ts`, and `web/src/frontend/features/recruitment-analytics/index.ts`
- [ ] T004 [P] Add common analytics test fixture builders for time ranges, users, companies, postings, views, applications, stages, and scores in `web/tests/helpers/recruitment-analytics/fixtures.ts`
- [ ] T005 [P] Add environment contracts for visitor-digest keys, export storage, lease limits, and worker batch bounds in `web/src/backend/analytics/analytics-config.ts` and `web/src/backend/exports/export-config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared persistence, time semantics, authorization, audit contracts, storage, and worker foundations required by every story.

**CRITICAL**: No user-story implementation begins until this phase is complete.

### Foundational Tests

- [ ] T006 [P] Write migration verification plus mandatory audit-retention/legal-hold tests for view uniqueness, posting lifecycle ordering, export idempotency/leases/expiry, 24-month eligibility, scoped holds, idempotent deletion, indexes, and additive rollback safety in `web/scripts/verify-recruitment-analytics-migration.mjs` and `web/tests/backend/integration/recruitment-analytics/activity-retention.integration.test.ts`
- [ ] T007 [P] Write unit tests for half-open ranges, time-zone/DST boundaries, bucket ends, cutoffs, `analyticsAvailableFrom` rejection, and rate availability in `web/tests/backend/unit/recruitment-analytics/report-time-policy.test.ts`
- [ ] T008 [P] Write security tests for Administrator grants, active verified-company memberships, multi-company scope, suspended/removed access, and neutral denials in `web/tests/security/recruitment-analytics/authorization-matrix.test.ts`
- [ ] T009 [P] Write architecture tests for Route Handler/service/repository/storage separation, server-only boundaries, provider-neutral storage, and forbidden candidate-PII audit flows in `web/tests/architecture/recruitment-analytics-boundaries.test.ts`
- [ ] T010 [P] Write qualified-view policy and public-job-boundary integration tests for daily HMAC uniqueness, next-day qualification, owner previews, bots, invalid requests, non-blocking admission failure, and raw-identifier non-retention in `web/tests/backend/unit/recruitment-analytics/qualified-view-policy.test.ts` and `web/tests/backend/integration/recruitment-analytics/public-job-view-admission.integration.test.ts`

### Foundational Implementation

- [ ] T011 Extend Prisma with `JobPostingViewFact`, `JobPostingLifecycleFact`, `ExportRequest`, and `ActivityLegalHold` entities, enums, relations, uniqueness, and reporting/worker indexes in `web/prisma/schema.prisma`
- [ ] T012 Create the additive recruitment analytics migration, existing-post lifecycle baseline, and safe disable/rollback notes in `web/prisma/migrations/<timestamp>_recruitment_analytics_export/migration.sql`
- [ ] T013 Implement `[from,to)` validation, IANA time-zone normalization, `analyticsAvailableFrom` enforcement, DAY/WEEK/MONTH bucket generation, one-cutoff metadata, rounding, and null-rate policy in `web/src/backend/analytics/report-time-policy.ts`
- [ ] T014 Implement Administrator grant and Employer company/posting scope adapters over existing authorization services in `web/src/backend/analytics/analytics-authorization.ts`
- [ ] T015 Implement privacy-safe visitor-day HMAC classification and qualification policy in `web/src/backend/analytics/qualified-view-policy.ts`
- [ ] T016 Implement idempotent qualified-view admission and aggregate reads, then invoke non-blocking admission from the public job-detail request boundary in `web/src/backend/repositories/analytics/prisma-qualified-view-repository.ts`, `web/src/backend/analytics/qualified-view-service.ts`, and `web/src/app/jobs/[slug]/page.tsx`
- [ ] T017 Integrate lifecycle-fact append operations transactionally with posting create/publish/close/expire/remove transitions in `web/src/backend/services/jobs/recruiter-job-posting-data.ts` and `web/src/backend/jobs/management/job-post-management-service.ts`
- [ ] T018 Implement lifecycle baseline/read reconstruction and shared analytics queries in `web/src/backend/repositories/analytics/prisma-analytics-repository.ts`
- [ ] T019 Extend strict audit action, target, and privacy-safe context allow-lists for posting creation/deletion and export lifecycle events in `web/src/backend/audit/events.ts`
- [ ] T020 Integrate mandatory job-post creation/deletion audit writes with authoritative business transactions in `web/src/backend/services/jobs/recruiter-job-posting-data.ts` and `web/src/backend/jobs/management/job-post-management-service.ts`
- [ ] T021 Implement the branded `ExportArtifactStoragePort` and private filesystem/S3 adapters with opaque locators, byte integrity, encryption/private access, and separate export prefixes in `web/src/backend/exports/storage/export-artifact-storage.ts`, `web/src/backend/exports/storage/filesystem.ts`, and `web/src/backend/exports/storage/s3.ts`
- [ ] T022 Implement export-request persistence plus mandatory audit-retention/legal-hold persistence, idempotent admission, `SKIP LOCKED` lease/retry transitions, successful publication metadata, expiry, and cleanup claims in `web/src/backend/repositories/analytics/prisma-export-request-repository.ts` and `web/src/backend/repositories/analytics/prisma-activity-retention-repository.ts`
- [ ] T023 Implement mandatory 24-month audit retention, scoped legal holds, bounded idempotent deletion, retries, and operational evidence in `web/src/backend/analytics/activity-retention-service.ts` and `web/scripts/run-recruitment-analytics-retention-worker.mjs`, run the failing-first T006 coverage, then record foundational outcomes in `specs/022-recruitment-analytics-export/quickstart.md`

**Checkpoint**: Shared persistence, authorization, time definitions, views, lifecycle facts, audit contracts, and export infrastructure are ready; all user stories may now proceed independently.

---

## Phase 3: User Story 1 - Monitor Platform Growth (Priority: P1)

**Goal**: Give Platform Administrators an accessible, filterable dashboard for registrations, bucket-end active postings, application-success cohorts, and applications per submitting Candidate.

**Independent Test**: Seed known registrations, lifecycle facts, applications, and stage events across date/time-zone boundaries; request all groupings as an Administrator; compare every bucket with independent calculations; verify empty states and neutral denial for non-Administrators.

### Tests for User Story 1

- [ ] T024 [P] [US1] Write contract tests for the Administrator overview response, metadata including `analyticsAvailableFrom`, pre-baseline range rejection, null rates, validation errors, strict no-extra-fields behavior, and OpenAPI parity in `web/tests/backend/contract/recruitment-analytics/admin-overview.contract.test.ts`
- [ ] T025 [P] [US1] Write repository/integration tests for registrations, baseline-bounded bucket-end lifecycle reconstruction, submission cohorts, Hired-at-cutoff history, withdrawn denominators, and distinct submitting Candidates in `web/tests/backend/integration/recruitment-analytics/admin-growth-report.integration.test.ts`
- [ ] T026 [P] [US1] Write component tests for date presets/custom ranges, definition disclosures, cutoff labels, loading/zero/error states, and filter refresh in `web/tests/frontend/components/recruitment-analytics/admin-growth-dashboard.test.tsx`
- [ ] T027 [P] [US1] Write accessibility tests for chart text/table equivalence, headings, keyboard filters, focus, status messages, contrast, and non-color series meaning in `web/tests/frontend/accessibility/recruitment-analytics/admin-growth-dashboard.accessibility.test.tsx`

### Implementation for User Story 1

- [ ] T028 [US1] Define strict Zod schemas for overview filters, metadata, metric rates, buckets, and report responses in `web/src/shared/contracts/analytics/admin.ts`
- [ ] T029 [US1] Implement cutoff-consistent Administrator growth calculations and metric definition metadata in `web/src/backend/analytics/admin-analytics-service.ts`
- [ ] T030 [US1] Implement the Administrator overview Route Handler with grant authorization, validation, neutral denial, no-store behavior, and typed responses in `web/src/app/api/admin/analytics/overview/route.ts`
- [ ] T031 [P] [US1] Implement accessible trend summaries, semantic table alternatives, metric cards, and empty/error/loading components in `web/src/frontend/features/admin/analytics/admin-growth-dashboard.tsx` and `web/src/frontend/features/admin/analytics/analytics-trend.tsx`
- [ ] T032 [P] [US1] Implement reusable date-range/grouping controls with visible time zone and cutoff in `web/src/frontend/features/admin/analytics/analytics-filters.tsx`
- [ ] T033 [US1] Register the growth dashboard in the existing React Admin workspace and data provider in `web/src/frontend/features/admin/app/admin-app.tsx` and `web/src/frontend/features/admin/app/data-provider.ts`
- [ ] T034 [US1] Execute US1 contract, integration, component, accessibility, and authorization tests and record the independent checkpoint result in `specs/022-recruitment-analytics-export/quickstart.md`

**Checkpoint**: Administrator platform-growth reporting is complete and independently demonstrable.

---

## Phase 4: User Story 2 - Evaluate Job Posting Performance (Priority: P1)

**Goal**: Give authorized Employers per-posting qualifying views, submitted applications, conversion, and a current canonical-stage funnel.

**Independent Test**: Seed one posting with qualified/repeated/owner/bot views and applications in all nine stages; verify period counts, zero-view behavior, funnel totals/percentages, filters, cutoff labels, and cross-company denial.

### Tests for User Story 2

- [ ] T035 [P] [US2] Write contract tests for job performance metadata, conversion availability, exactly nine canonical stages, percentages, strict field allow-listing, and OpenAPI parity in `web/tests/backend/contract/recruitment-analytics/job-performance.contract.test.ts`
- [ ] T036 [P] [US2] Write integration tests for qualified-view totals, submitted applications, zero views, current-stage exclusivity, rounding, date filters, and company ownership in `web/tests/backend/integration/recruitment-analytics/job-performance.integration.test.ts`
- [ ] T037 [P] [US2] Write component tests for posting selection, counts, conversion, current-snapshot labeling, funnel stages, loading/empty/error states, and filter refresh in `web/tests/frontend/components/recruitment-analytics/job-performance-report.test.tsx`
- [ ] T038 [P] [US2] Write accessibility tests for ordered stage regions, headings, count/percentage text, keyboard controls, focus, and non-color drop-off meaning in `web/tests/frontend/accessibility/recruitment-analytics/job-performance-report.accessibility.test.tsx`

### Implementation for User Story 2

- [ ] T039 [US2] Define strict Employer performance request/response, conversion, and canonical funnel contracts in `web/src/shared/contracts/analytics/employer.ts`
- [ ] T040 [US2] Implement tenant-scoped view/application aggregation, null conversion, and current funnel calculation in `web/src/backend/analytics/job-performance-service.ts`
- [ ] T041 [US2] Implement the job performance Route Handler with fresh membership/posting authorization, validation, neutral denial, and no-store typed responses in `web/src/app/api/recruiter/analytics/jobs/[jobId]/performance/route.ts`
- [ ] T042 [P] [US2] Add centralized recruiter analytics route builders and job-scoped server-page ownership guard in `web/src/shared/routing/recruiter-routes.ts` and `web/src/app/recruiter/analytics/[jobId]/page.tsx`
- [ ] T043 [P] [US2] Implement performance cards, definitions, current-snapshot header, and accessible Kanban-style funnel in `web/src/frontend/features/recruitment-analytics/job-performance-report.tsx` and `web/src/frontend/features/recruitment-analytics/hiring-funnel.tsx`
- [ ] T044 [P] [US2] Implement the Employer analytics landing/posting selector and report filters in `web/src/app/recruiter/analytics/page.tsx` and `web/src/frontend/features/recruitment-analytics/job-performance-filters.tsx`
- [ ] T045 [US2] Execute US2 contract, integration, component, accessibility, view-policy, and tenant-security tests and record the independent checkpoint result in `specs/022-recruitment-analytics-export/quickstart.md`

**Checkpoint**: Employer posting performance and funnel reporting are complete and independently demonstrable.

---

## Phase 5: User Story 3 - Export a Posting's Candidate List (Priority: P1)

**Goal**: Let an authorized Employer request, monitor, and download point-in-time CSV/XLSX candidate exports containing only name, email, phone, application status, and current published screening score.

**Independent Test**: Generate both formats from the same posting/cutoff and compare headers, rows, values, score availability, Unicode, formula-like inputs, authorization, expiry, cleanup, and 10,000-row performance.

### Tests for User Story 3

- [ ] T046 [P] [US3] Write contract tests for export admission/status/download responses, idempotency, strict metadata, neutral unavailable responses, MIME/cache/disposition headers, and OpenAPI parity in `web/tests/backend/contract/recruitment-analytics/candidate-export.contract.test.ts`
- [ ] T047 [P] [US3] Write unit/security tests for RFC 4180 quoting, UTF-8, fixed columns, explicit XLSX strings, and leading whitespace/tab/CR/LF plus `= + - @` neutralization in `web/tests/backend/unit/recruitment-analytics/export-cell-policy.test.ts`
- [ ] T048 [P] [US3] Write integration tests for leases, bounded retries, stable cutoff/order, immutable application-contact snapshots despite later profile edits, canonical published score selection, missing scores, checksum/row counts, atomic publication, and CSV/XLSX parity in `web/tests/backend/integration/recruitment-analytics/candidate-export-worker.integration.test.ts`
- [ ] T049 [P] [US3] Write security tests for request/generation/download reauthorization, wrong company, revoked membership, suspended account, opaque locators, no PII in audit/logs, and neutral absence in `web/tests/security/recruitment-analytics/candidate-export-security.test.ts`
- [ ] T050 [P] [US3] Write retention tests for exact 24-hour denial, early revocation, idempotent deletion, storage failure retries, and audit-metadata survival in `web/tests/backend/integration/recruitment-analytics/export-retention.integration.test.ts`
- [ ] T051 [P] [US3] Write component/accessibility tests for format choice, queued/processing/success/failure/expired states, announced progress, retry, keyboard download, and safe unavailable feedback in `web/tests/frontend/components/recruitment-analytics/candidate-export.test.tsx` and `web/tests/frontend/accessibility/recruitment-analytics/candidate-export.accessibility.test.tsx`

### Implementation for User Story 3

- [ ] T052 [US3] Define strict export admission, status, row/column, availability, and error contracts with fixed header/version metadata in `web/src/shared/contracts/analytics/exports.ts`
- [ ] T053 [US3] Implement the shared export cell normalization, CSV stream encoder, and canonical candidate-row projection using only immutable application contact snapshots in `web/src/backend/exports/export-cell-policy.ts`, `web/src/backend/exports/csv-export-writer.ts`, and `web/src/backend/exports/candidate-export-projection.ts`
- [ ] T054 [P] [US3] Implement the ExcelJS streaming writer with `Candidates` and `Metadata` sheets and explicit string cells in `web/src/backend/exports/xlsx-export-writer.ts`
- [ ] T055 [US3] Implement export admission/status/download orchestration with idempotency, data cutoff, current published score, audit outcomes, expiry, integrity, and fresh authorization in `web/src/backend/exports/candidate-export-service.ts`
- [ ] T056 [US3] Implement leased export generation with authority recheck, stable batching/order, bounded retries, checksum/bytes/rows, and atomic artifact publication in `web/src/backend/exports/candidate-export-worker.ts`
- [ ] T057 [P] [US3] Implement the bounded expiry/revocation cleanup worker and operational probes in `web/src/backend/exports/candidate-export-retention.ts` and `web/scripts/run-recruitment-analytics-retention-worker.mjs`
- [ ] T058 [P] [US3] Add the export worker entrypoint, probe, graceful shutdown, and package-script integration in `web/scripts/run-recruitment-export-worker.mjs`
- [ ] T059 [US3] Implement export admission and status Route Handlers in `web/src/app/api/recruiter/analytics/jobs/[jobId]/exports/route.ts` and `web/src/app/api/recruiter/analytics/jobs/[jobId]/exports/[exportId]/route.ts`
- [ ] T060 [US3] Implement the authenticated private download Route Handler with integrity checks, safe filename, private/no-store, nosniff, content type, and neutral denial in `web/src/app/api/recruiter/analytics/jobs/[jobId]/exports/[exportId]/download/route.ts`
- [ ] T061 [US3] Implement the Employer export controls, polling/status announcements, retry, and download interaction in `web/src/frontend/features/recruitment-analytics/candidate-export-panel.tsx` and integrate it into `web/src/frontend/features/recruitment-analytics/job-performance-report.tsx`
- [ ] T062 [US3] Execute US3 contract, unit, integration, security, retention, component, accessibility, and CSV/XLSX parity tests and record the independent checkpoint result in `specs/022-recruitment-analytics-export/quickstart.md`

**Checkpoint**: The complete P1 feature scope—Administrator growth, Employer performance, and secure candidate export—is functional and independently verified.

---

## Phase 6: User Story 4 - Review Activity and Operational Trends (Priority: P2)

**Goal**: Give Administrators a filterable activity history and posting/application aggregates over the mandatory audit records and retention/legal-hold controls completed in Phase 2. This user-facing P2 phase may defer after the full mandatory foundation is complete.

**Independent Test**: Seed all supported actions across roles/dates, filter and paginate the Administrator projection, compare aggregates, test anonymized/deleted targets, verify non-Administrator denial, and exercise retention with and without a legal hold.

### Tests for User Story 4

- [ ] T063 [P] [US4] Write contract tests for activity filters, cursor paging, privacy-safe actor/target projections, aggregates, strict fields, and OpenAPI parity in `web/tests/backend/contract/recruitment-analytics/activity-report.contract.test.ts`
- [ ] T064 [P] [US4] Write integration tests for login/logout/post-created/post-deleted/application-submitted/stage/export events, role/action/range filters, aggregates, deleted identities, and stable pagination in `web/tests/backend/integration/recruitment-analytics/activity-report.integration.test.ts`
- [ ] T065 [P] [US4] Write activity-view integration tests proving retained and legally held records are projected only while available and never restore deleted source content in `web/tests/backend/integration/recruitment-analytics/activity-retention-projection.integration.test.ts`
- [ ] T066 [P] [US4] Write component/accessibility tests for filter visibility, results/aggregates, loading/empty/error states, keyboard paging, labels, focus, and non-color trends in `web/tests/frontend/components/recruitment-analytics/admin-activity-report.test.tsx` and `web/tests/frontend/accessibility/recruitment-analytics/admin-activity-report.accessibility.test.tsx`

### Implementation for User Story 4

- [ ] T067 [US4] Extend strict Administrator activity filter, cursor, item, aggregate, and metadata contracts in `web/src/shared/contracts/analytics/admin.ts`
- [ ] T068 [US4] Implement privacy-safe activity projections, role/action/range filtering, stable cursor paging, and posting/application aggregates in `web/src/backend/analytics/activity-query-service.ts` and `web/src/backend/repositories/analytics/prisma-activity-repository.ts`
- [ ] T069 [US4] Implement Administrator-safe retention/hold availability labels for the activity projection without exposing hold reasons or deleted source content in `web/src/backend/analytics/activity-retention-projection.ts`
- [ ] T070 [US4] Implement the Administrator activity Route Handler with grant authorization, validation, neutral denial, and no-store typed responses in `web/src/app/api/admin/analytics/activity/route.ts`
- [ ] T071 [P] [US4] Implement the Administrator activity table, aggregate trends, filters, paging, and visible retention/cutoff context in `web/src/frontend/features/admin/analytics/admin-activity-report.tsx` and `web/src/frontend/features/admin/analytics/activity-filters.tsx`
- [ ] T072 [US4] Register the activity resource/navigation and data-provider method in `web/src/frontend/features/admin/app/admin-app.tsx` and `web/src/frontend/features/admin/app/data-provider.ts`
- [ ] T073 [US4] Execute US4 contract, integration, retention, security, component, and accessibility tests and record the independent checkpoint result in `specs/022-recruitment-analytics-export/quickstart.md`

**Checkpoint**: P2 Administrator activity history and aggregates are complete; if deferred, all Phase 2 critical-event capture and retention/legal-hold tasks remain mandatory for P1 release.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Verify cross-story consistency, performance, security, migration safety, accessibility, observability, and documentation.

- [ ] T074 [P] Add end-to-end scenarios for Administrator growth, Employer performance, CSV/XLSX export, revocation/expiry, and optional P2 activity in `web/tests/system/e2e/recruitment-analytics/recruitment-analytics.spec.ts`
- [ ] T075 [P] Add representative 1,000,000-fact/100,000-application/10,000-export-row performance fixtures and percentile/error measurement harness in `web/scripts/measure-recruitment-analytics-performance.mjs` and `web/tests/performance/recruitment-analytics/recruitment-analytics-performance.test.ts`
- [ ] T076 [P] Add operational metrics and content-free structured failure signals for report latency, worker lease/retry/failure, artifact cleanup lag, and retention failures in `web/src/backend/analytics/analytics-observability.ts` and `web/src/backend/exports/export-observability.ts`
- [ ] T077 Add query-plan verification and bounded pagination/batch optimization for analytics/export repositories in `web/scripts/verify-recruitment-analytics-query-plans.mjs`
- [ ] T078 Run the migration verifier, focused feature suite, end-to-end tests, performance harness, typecheck, lint, full regression suite, and production build; record environment, dataset, concurrency, sample size, p50/p95/p99/max, error rate, and outcomes in `specs/022-recruitment-analytics-export/quickstart.md`
- [ ] T079 Reconcile the implemented Zod contracts and Route Handler behavior with `specs/022-recruitment-analytics-export/contracts/recruitment-analytics-export.openapi.yaml`
- [ ] T080 Run and document moderated Administrator/Employer usability validation against the SC-007 90% first-attempt threshold, then perform the final constitution/security/privacy/accessibility audit and document P1 completion plus any explicitly deferred P2 UI tasks in `specs/022-recruitment-analytics-export/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends only on Phase 2.
- **Phase 4 — US2**: Depends only on Phase 2; can run in parallel with US1.
- **Phase 5 — US3**: Depends on Phase 2 storage/export foundations. UI integration T061 follows the US2 report surface T043, but all backend export work can proceed independently of US2.
- **Phase 6 — US4**: Depends on the complete Phase 2 audit capture and retention/legal-hold foundation; its user-facing activity history and aggregates may proceed in parallel or defer after P1.
- **Phase 7 — Polish**: Begins after all stories selected for the release are complete; P1 release verification requires US1–US3.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (Admin growth) -----------\
                    -> US2 (Job performance) --------+-> P1 verification -> Polish
                    -> US3 (Candidate export) -------/
                    -> US4 (Activity P2, optional UI) ----> Full-module verification

US2 report surface -> US3 export-panel integration only
```

### Within Each User Story

1. Write contract, unit, integration, security, component, and accessibility tests first and confirm the targeted behavior fails.
2. Complete story contracts and repository/model work before services.
3. Complete services before Route Handlers and UI integration.
4. Run the story's focused verification task and record its checkpoint before declaring the story complete.

## Parallel Opportunities

- Setup tasks T002–T005 can run in parallel after T001 when dependency installation is not required by the individual edit.
- Foundational tests T006–T010 can run in parallel; T014–T16, T019, and T021 can proceed on separate files after schema shape T011 is agreed.
- After Phase 2, US1 and US2 can run in parallel; most US3 backend work can run in parallel with both; US4 can be assigned independently or deferred.
- Within every story, tasks marked `[P]` target distinct contract, integration, component, accessibility, security, worker, or UI files.
- Final end-to-end, performance, and observability tasks T074–T076 can run in parallel before the consolidated verification tasks.

## Parallel Example: User Story 1

```text
T024 Contract tests: web/tests/backend/contract/recruitment-analytics/admin-overview.contract.test.ts
T025 Integration tests: web/tests/backend/integration/recruitment-analytics/admin-growth-report.integration.test.ts
T026 Component tests: web/tests/frontend/components/recruitment-analytics/admin-growth-dashboard.test.tsx
T027 Accessibility tests: web/tests/frontend/accessibility/recruitment-analytics/admin-growth-dashboard.accessibility.test.tsx
```

## Parallel Example: User Story 2

```text
T035 Contract tests: web/tests/backend/contract/recruitment-analytics/job-performance.contract.test.ts
T036 Integration tests: web/tests/backend/integration/recruitment-analytics/job-performance.integration.test.ts
T037 Component tests: web/tests/frontend/components/recruitment-analytics/job-performance-report.test.tsx
T038 Accessibility tests: web/tests/frontend/accessibility/recruitment-analytics/job-performance-report.accessibility.test.tsx
```

## Parallel Example: User Story 3

```text
T046 Contract tests: web/tests/backend/contract/recruitment-analytics/candidate-export.contract.test.ts
T047 Cell security tests: web/tests/backend/unit/recruitment-analytics/export-cell-policy.test.ts
T048 Worker integration tests: web/tests/backend/integration/recruitment-analytics/candidate-export-worker.integration.test.ts
T049 Authorization/privacy tests: web/tests/security/recruitment-analytics/candidate-export-security.test.ts
T050 Retention tests: web/tests/backend/integration/recruitment-analytics/export-retention.integration.test.ts
T051 UI/accessibility tests: web/tests/frontend/components/recruitment-analytics/candidate-export.test.tsx
```

## Parallel Example: User Story 4

```text
T063 Contract tests: web/tests/backend/contract/recruitment-analytics/activity-report.contract.test.ts
T064 Integration tests: web/tests/backend/integration/recruitment-analytics/activity-report.integration.test.ts
T065 Retention/legal-hold tests: web/tests/backend/integration/recruitment-analytics/activity-retention.integration.test.ts
T066 UI/accessibility tests: web/tests/frontend/components/recruitment-analytics/admin-activity-report.test.tsx
```

## Implementation Strategy

### P1 Core First

1. Complete Setup and Foundation.
2. Implement and validate US1 and US2 in parallel where possible.
3. Implement US3 backend export lifecycle in parallel, then integrate its panel into the US2 report.
4. Stop and validate the complete P1 scope: Administrator growth, Employer performance/funnel, and candidate CSV/XLSX export.
5. Implement US4 only after P1 quality gates pass or when capacity permits; do not defer mandatory audit event capture, retention, or legal-hold enforcement from Phase 2.

### Incremental Checkpoints

1. **Foundation**: deterministic time/view/lifecycle definitions, authorization, audit, storage, leases.
2. **US1**: independently testable Administrator growth dashboard.
3. **US2**: independently testable Employer posting report and funnel.
4. **US3**: independently testable secure export lifecycle; completes P1 feature scope.
5. **US4**: independently testable P2 activity history/aggregates/retention.
6. **Polish**: cross-story E2E, scale, migration, contract, constitution, and build verification.

## Notes

- `[P]` means different files and no dependency on another incomplete task in that phase.
- `[US1]`–`[US4]` provide specification traceability; setup/foundation/polish tasks intentionally have no story label.
- Do not mark implementation tasks complete until their preceding tests were observed failing for the intended reason and then pass.
- Preserve unrelated user changes and do not weaken existing P0 workflows to deliver this P1/P2 module.
- A checkpoint may be demonstrated independently, but P1 release requires US1–US3 plus every applicable constitution gate.
