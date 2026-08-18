# Tasks: Administrator Job-Post Review and Approval

**Input**: Design documents from `spec-kit/specs/017-admin-management-job-posting/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/job-post-review.openapi.yaml`, `quickstart.md`

**Tests**: Required. This P0 human-review workflow uses tests-first ordering for contracts, state transitions, authorization, JSON safety, transactional integrity, privacy, accessibility, performance, and regressions.

**Organization**: Tasks are grouped by user story. Each story is independently testable, but the feature is releasable only after all four P1 stories and the final quality gates pass.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on another unfinished task in the same phase.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task names the implementation or evidence file it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the feature's commands and reusable deterministic fixtures before foundational tests.

- [X] T001 Add `test:job-post-reviews`, `job-post-reviews:migrate`, `job-post-reviews:migration:verify`, `job-catalogue:preflight`, and `perf:job-post-reviews` scripts in `web/package.json` and document designated-writer/read-only-host plus durable catalogue path configuration in `web/.env.example`
- [X] T002 [P] Create deterministic job/review/company/Administrator fixture builders in `web/tests/helpers/job-post-reviews/job-post-review-fixtures.ts`
- [X] T003 [P] Create recipient-safe notification cleanup helpers for review contexts in `web/tests/helpers/notifications/job-post-review-notification-cleanup.ts`

---

## Phase 2: Foundational Review Authority (Blocking Prerequisites)

**Purpose**: Establish strict contracts, persistent authority, JSON safety, lifecycle policy, notification policy, and migration integrity before any user journey implementation.

**CRITICAL**: No user-story implementation begins until this phase is complete.

### Tests for Foundational Authority

- [X] T004 [P] Add strict schema, reason-code, command-discriminator, and server-owned-field rejection tests in `web/tests/shared/unit/contracts/job-post-reviews/job-post-review-contracts.test.ts` (FR-003, FR-004, FR-019, FR-028)
- [X] T005 [P] Add canonical snapshot normalization, material-field identity, SHA-256 determinism, allow-listed relational-enum/search-field mapping, and lifecycle transition tests in `web/tests/backend/unit/job-post-reviews/job-post-review-policy.test.ts` (FR-002-FR-004, FR-007, FR-008, FR-018)
- [X] T006 [P] Add additive table, one-pending constraint, actor-scoped submission-idempotency binding, unique aggregate-to-`JobPosting` projection ownership, writer-lease, imported-baseline, notification-enum, index, and rollback-safety migration tests in `web/tests/backend/integration/job-post-reviews/job-post-review-migration.test.ts` (FR-004, FR-005, FR-018, FR-021, FR-025)
- [X] T007 [P] Add designated-writer/read-only-host admission, PostgreSQL writer-lease contention/renewal, monotonically fenced scoped read-through-transaction ownership, expiry-at-commit/replacement rejection, stale recovery, unwritable/non-durable path preflight, checksum conflict, temporary-file cleanup, atomic-replace, malformed-file, and crash-recovery tests in `web/tests/backend/integration/job-post-reviews/json-job-catalogue-repository.test.ts` (FR-007, FR-008, FR-025, FR-026, SC-009)
- [X] T008 [P] Add safe-copy, locale, href, severity, allow-listed-variable, and challenge-secret exclusion tests in `web/tests/backend/unit/notifications/job-post-review-notification-policy.test.ts` (FR-009, FR-010, FR-016, FR-022, FR-023)
- [X] T009 [P] Add layer, single-Route-Handler, sole JSON-importer, server-only, exclusive-session, and no-direct-file-access canaries in `web/tests/architecture/job-post-review-boundaries.test.ts` (FR-026, FR-027, FR-031)
- [X] T010 [P] Add OpenAPI/runtime Zod parity tests for the complete strict job snapshot, bounded safe company/submitter context, every review path, action/body match, command discriminator, response, and error in `web/tests/backend/contract/job-post-reviews/job-post-review-openapi-parity.test.ts` (FR-012-FR-017, FR-019, FR-020, FR-028)

### Implementation for Foundational Authority

- [X] T011 Define review state, reason, queue/detail, Recruiter projection, and discriminated command schemas in `web/src/shared/contracts/admin/job-post-review.ts` (FR-004, FR-012, FR-015, FR-019, FR-028)
- [X] T012 Define Recruiter-authored input and immutable review-snapshot schemas with deterministic public-enum inputs while excluding client ownership, status, approval feedback, verification display, statistics, review facts, and lifecycle/publication timestamps in `web/src/shared/contracts/recruiter-job-posting.ts` (FR-002, FR-003, FR-018, FR-027, FR-028)
- [X] T013 Add review notification kinds and `JOB_POST_REVIEW` context to `web/src/shared/contracts/notifications/index.ts` and `web/prisma/schema.prisma` (FR-009, FR-010, FR-022)
- [X] T014 Add review aggregate/version/history/private-note and catalogue-writer-lease models, authoritative aggregate closure actor/time, the unique aggregate-to-existing-`JobPosting` projection relation, actor-scoped submission-idempotency binding, enums, invariants, and indexes to `web/prisma/schema.prisma` (FR-003-FR-005, FR-008, FR-013, FR-018, FR-019, FR-021, FR-025)
- [X] T015 Create the additive review-authority, aggregate-to-`JobPosting` projection-link, and notification-enum migration in `web/prisma/migrations/038_job_post_review_authority/migration.sql` (FR-003-FR-005, FR-018, FR-021, FR-025)
- [X] T016 Regenerate the Prisma client models for the new review authority in `web/src/backend/generated/prisma/` (FR-003, FR-004, FR-021)
- [X] T017 Implement canonical content normalization, server-field exclusion, schema versioning, material-field selection, content hashing, transition/reason policy in `web/src/backend/jobs/review/job-post-review-policy.ts` and the pure deterministic snapshot-to-`JobPosting`/normalized-skill mapper in `web/src/backend/jobs/review/job-post-publication-projector.ts` (FR-002-FR-004, FR-006, FR-008, FR-018, FR-019)
- [X] T018 Define neutral validation, authorization, conflict, integrity, assignment, and unavailable errors in `web/src/backend/jobs/review/job-post-review-errors.ts` (FR-020, FR-027, FR-028)
- [X] T019 Implement PostgreSQL-coordinated writer claims/renewal/monotonic fencing/stale recovery and transaction-time ownership validation in `web/src/backend/repositories/jobs/prisma-job-catalogue-write-lease-repository.ts`, then inject a scoped owner/fencing/checksum callback across validated read, external review transaction, process queueing, shared-path preflight, final compare, temporary write/flush/atomic replace, and explicit updates in `web/src/backend/repositories/jobs/json-job-catalogue-repository.ts` (FR-007, FR-008, FR-025, FR-026, SC-009)
- [X] T020 Refactor direct `jobs.json` access to use the sole JSON repository without changing current management behavior in `web/src/backend/services/jobs/recruiter-job-posting-data.ts` (FR-026, FR-031)
- [X] T021 Implement core aggregate/version queries, one-pending enforcement, actor-scoped submission-key/request-hash replay validation, optimistic claims, projection selects, and transaction-compatible writes in `web/src/backend/repositories/jobs/prisma-job-post-review-repository.ts` (FR-003, FR-004, FR-005, FR-013, FR-020)
- [X] T022 Add review-request and outcome copy, severity, safe variable, and destination policy in `web/src/backend/notifications/event-policy.ts` (FR-009, FR-016, FR-022, FR-023)
- [X] T023 Extend active-Administrator fan-out with the generic job-review request kind in `web/src/backend/notifications/admin-notification-fanout.ts` (FR-009, FR-010)
- [X] T024 Add `JOB_POST_REVIEW` destinations for Administrator and Recruiter notification projections in `web/src/frontend/features/admin/notifications/admin-notification-navigation.ts` and `web/src/frontend/features/notifications/notification-copy.ts` (FR-011, FR-022, FR-023)
- [X] T025 Create rerunnable legacy pending/rejected adoption with dry-run and unresolved-authority reporting in `web/scripts/migrate-json-job-reviews.mjs` (FR-024, FR-026, SC-009)
- [X] T026 Create read-only aggregate/hash/state/recipient/unresolved-row verification in `web/scripts/verify-job-post-review-migration.mjs` and fail-closed shared-path/lease/checksum preflight in `web/scripts/check-json-job-catalogue-writer.mjs` (FR-005, FR-010, FR-021, FR-025, FR-026)

**Checkpoint**: Shared contracts, schema, JSON safety, review policy, notification policy, and migration controls are ready; all foundational tests fail before implementation and pass afterward.

---

## Phase 3: User Story 1 - Submit a Job for Review (Priority: P1)

**Goal**: An authorized Recruiter submits one exact valid job version; it becomes a durable, private, immutable pending review and an active edit preserves the last approved public content.

**Independent Test**: Submit valid, invalid, duplicate, concurrent, unauthorized, active-edit, and injected-failure fixtures and verify one pending version, exact snapshot/hash, no unapproved publication, correct audit, and recoverable JSON state.

### Tests for User Story 1

- [X] T027 [P] [US1] Add submit-review success, idempotent replay, strict body/header, stale working timestamp, neutral errors, and no-store contract tests in `web/tests/backend/contract/job-post-reviews/recruiter-submit-review.contract.test.ts` (FR-001, FR-002, FR-005, FR-027, FR-028)
- [X] T028 [P] [US1] Add verified-company membership, cross-company, inactive account/company/membership, and legacy-company denial tests in `web/tests/security/job-post-reviews/recruiter-submission-isolation.test.ts` (FR-001, FR-027, SC-006)
- [X] T029 [P] [US1] Add exact snapshot/hash, deterministic relational mapping acceptance/rejection, cross-company/aggregate stable-slug collision, one pending version, zero pending public change, sequence, audit, and pre-edit active-baseline bind/create with relational-or-adoption publication time before JSON integration tests in `web/tests/backend/integration/job-post-reviews/recruiter-submission.test.ts` (FR-002-FR-004, FR-007, FR-008, FR-018, FR-021)
- [X] T030 [P] [US1] Add repeated/concurrent submission, submit-versus-edit lease races, post-commit pending-lock rejection, actor-scoped key replay, and changed job/working-version/content binding tests in `web/tests/backend/integration/job-post-reviews/recruiter-submission-concurrency.test.ts` (FR-005, FR-007, FR-020, SC-004)
- [X] T031 [P] [US1] Add draft JSON-before-submission-transaction, writer-lease/checksum-scoped active baseline-before-JSON-edit, failed/crashed/concurrent active-edit JSON write, database, audit, notification, compatibility-status, and lost-response failure-isolation tests in `web/tests/backend/integration/job-post-reviews/recruiter-submission-failure.test.ts` (FR-008, FR-025, SC-009)
- [X] T032 [P] [US1] Add draft validation, submit confirmation, pending lock, active-edit pending version, visible errors, and retry component tests in `web/tests/frontend/components/recruiter-workspace/job-post-review-submission.test.tsx` (FR-002, FR-007, FR-008, FR-029)
- [X] T033 [P] [US1] Add keyboard focus recovery, live pending status, confirmation labeling, non-color lock cues, and narrow-screen tests in `web/tests/frontend/accessibility/job-post-reviews/recruiter-submission.accessibility.test.tsx` (FR-029, SC-008)

### Implementation for User Story 1

- [X] T034 [US1] Implement membership/company authorization, working-content and deterministic public-mapping validation, pre-edit imported-active-baseline/projection preparation, snapshot/hash creation, actor-scoped submission-key/request-hash binding, transactional pending-version/audit/notification creation, and safe failure isolation in `web/src/backend/jobs/review/job-post-submission-service.ts` (FR-001-FR-010, FR-018, FR-021, FR-025)
- [X] T035 [US1] Compose the submission service with JSON, Prisma, audit, and notification dependencies in `web/src/backend/jobs/review/job-post-review-service-factory.ts` (FR-025, FR-026, FR-031)
- [X] T036 [US1] Implement exact Recruiter-origin, session, strict input, idempotency, no-store, and safe error handling in `web/src/app/api/recruiter/job-postings/[jobId]/submit-review/route.ts` (FR-001, FR-002, FR-005, FR-027, FR-028)
- [X] T037 [US1] Restrict general create/update routes to draft content, enforce the review-owned pending write lock, prevent client-authored lifecycle/approval fields, require writer-lease/checksum-scoped baseline preparation before a first active material JSON write, and dispatch managed-job `DELETE` closure through review authority in `web/src/app/api/recruiter/job-postings/route.ts` (FR-002, FR-007, FR-008, FR-027, FR-028)
- [X] T038 [US1] Overlay authorized PostgreSQL review state/reason/read-only/version data onto JSON working jobs in `web/src/backend/services/jobs/recruiter-job-posting-data.ts` (FR-006, FR-007, FR-008, FR-023, FR-026)
- [X] T039 [US1] Add save-draft-then-submit behavior, idempotency keys, stale retry, confirmation, and active-edit submission in `web/src/frontend/features/recruiter-workspace/job-posting-editor.tsx` (FR-002, FR-005, FR-007, FR-008, FR-029)
- [X] T040 [US1] Add pending state, immutable version, integrity block, and safe retry presentation in `web/src/frontend/features/recruiter-workspace/job-posting-management.tsx` (FR-007, FR-008, FR-029)
- [X] T041 [P] [US1] Add responsive, focus, pending-lock, integrity, and non-color review styles in `web/src/frontend/styles/recruiter-workspace-full.css` (FR-029, SC-008)
- [X] T042 [US1] Add submission events, context cleanup, and producer coverage to `web/tests/backend/integration/notifications/notification-event-producers.test.ts` (FR-009, FR-010, FR-025)
- [X] T043 [US1] Validate User Story 1 with the focused commands and record exact results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-001, SC-004, SC-005, SC-009)
- [X] T044 [US1] Commit the completed User Story 1 logical group with an English message; use Git history as the commit-hash evidence referenced by `spec-kit/specs/017-admin-management-job-posting/quickstart.md`

**Checkpoint**: Recruiter submission is independently demonstrable and safe, but the feature is not releasable until Administrator discovery, decisions, outcomes, and final gates are complete.

---

## Phase 4: User Story 2 - Discover and Claim Pending Reviews (Priority: P1)

**Goal**: Every eligible Platform Administrator receives one safe alert, can browse the protected queue/detail, and concurrent claims select one current assignee.

**Independent Test**: Submit a posting with multiple active/inactive grants, open isolated notifications and queue detail, race claims/reassignment, and verify recipient, authority, assignment, pagination, and privacy behavior.

### Tests for User Story 2

- [X] T045 [P] [US2] Add list/detail pagination, filters, ordering, response bounds, authority, no-store, and neutral-error contract tests in `web/tests/backend/contract/job-post-reviews/admin-review-query.contract.test.ts` (FR-011, FR-012, FR-015, FR-016, FR-027)
- [X] T046 [P] [US2] Add claim/reassign path/body match, command discriminator, CSRF, actor-scoped `AdminCommandReceipt` replay/binding, expected-version, current-grant, and safe-conflict contract tests in `web/tests/backend/contract/job-post-reviews/admin-review-command.contract.test.ts` (FR-013, FR-014, FR-020, FR-027, FR-028)
- [X] T047 [P] [US2] Add active/inactive Administrator fan-out, per-recipient dedupe/read state, five-second availability, and exact navigation integration tests in `web/tests/backend/integration/job-post-reviews/admin-review-notification.test.ts` (FR-009, FR-010, FR-011, SC-002)
- [X] T048 [P] [US2] Add deterministic queue order, bounded title/company summary, age/company/state/assignment filters, safe company/submitter detail context without contact data, complete detail, and current eligibility integration tests in `web/tests/backend/integration/job-post-reviews/admin-review-query.test.ts` (FR-012, FR-015, FR-016)
- [X] T049 [P] [US2] Add concurrent/stale claim, current-assignee reassignment, non-assignee takeover denial, inactive target, recovery from an inactive assignee, and immutable history/audit tests in `web/tests/backend/integration/job-post-reviews/admin-review-assignment.test.ts` (FR-013, FR-014, FR-020, FR-021, SC-004)
- [X] T050 [P] [US2] Add cross-recipient notification, revoked grant, direct enumeration, snapshot/note/evidence, and ordinary-log privacy tests in `web/tests/security/job-post-reviews/admin-review-isolation.test.ts` (FR-016, FR-027, FR-030, SC-006)
- [X] T051 [P] [US2] Add queue/detail/claim/reassign/loading/empty/error/stale component tests in `web/tests/frontend/components/admin-management/job-post-review-discovery.test.tsx` (FR-012, FR-013, FR-014, FR-029)
- [X] T052 [P] [US2] Add queue keyboard navigation, filter labels, focus restoration, live claim status, non-color assignment cues, and axe tests in `web/tests/frontend/accessibility/admin-management/job-post-review-discovery.accessibility.test.tsx` (FR-029, SC-008)

### Implementation for User Story 2

- [X] T053 [US2] Implement deterministic paginated queue and complete safe detail projections in `web/src/backend/repositories/jobs/prisma-job-post-review-repository.ts` (FR-012, FR-015, FR-016)
- [X] T054 [US2] Implement current-grant list/detail authorization, first-writer claim, current-assignee reassignment, inactive-assignee recovery, expected versions, existing `AdminCommandReceipt` binding/replay, history, and audit in `web/src/backend/jobs/review/job-post-review-service.ts` (FR-012-FR-016, FR-020, FR-021, FR-027)
- [X] T055 [US2] Implement protected Administrator queue transport in `web/src/app/api/admin/job-post-reviews/route.ts` (FR-012, FR-027, FR-028)
- [X] T056 [US2] Implement protected complete detail transport in `web/src/app/api/admin/job-post-reviews/[reviewId]/route.ts` (FR-015, FR-016, FR-027, FR-028)
- [X] T057 [US2] Implement claim/reassign action dispatch, exact command/path matching with mutation-free mismatch rejection, CSRF, expected-version, idempotency, and safe conflict responses in `web/src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts` (FR-013, FR-014, FR-020, FR-027, FR-028)
- [X] T058 [US2] Add `job-post-reviews` list/detail/command mappings to `web/src/frontend/features/admin/app/data-provider.ts` (FR-012, FR-013, FR-014)
- [X] T059 [US2] Add the protected job-review resource and navigation entry to `web/src/frontend/features/admin/app/admin-app.tsx` (FR-012, FR-029)
- [X] T060 [P] [US2] Implement filtered deterministic queue presentation with bounded job title/company labels in `web/src/frontend/features/admin/job-post-reviews/job-post-review-list.tsx` (FR-012, FR-029)
- [X] T061 [P] [US2] Implement complete snapshot, eligibility, prior-approved diff, assignment, history, private-note, and protected-evidence-link detail in `web/src/frontend/features/admin/job-post-reviews/job-post-review-show.tsx` (FR-015, FR-016, FR-029)
- [X] T062 [US2] Implement claim/reassign confirmation and stale-conflict recovery in `web/src/frontend/features/admin/job-post-reviews/job-post-review-action-panel.tsx` (FR-013, FR-014, FR-020, FR-029)
- [X] T063 [US2] Validate User Story 2 and record focused results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-002, SC-003, SC-004, SC-006, SC-008)

**Checkpoint**: Administrator discovery, protected full detail, and single-owner assignment work independently; terminal decisions remain the next required slice.

---

## Phase 5: User Story 3 - Review and Decide the Exact Version (Priority: P1)

**Goal**: The current assignee explicitly approves or rejects the exact eligible snapshot; approval exposes only reviewed content, rejection remains private, and every valid/blocked attempt is auditable.

**Independent Test**: Approve/reject exact fixtures and race stale/duplicate/unauthorized/ineligible/deadline/tamper commands while verifying public projection, private notes, outcome integrity, history, audit, and visible recovery.

### Tests for User Story 3

- [X] T064 [P] [US3] Add approval/rejection eligibility, deadline, assignment, expected-version, content-integrity, public reason, private-note, and transition policy tests in `web/tests/backend/unit/job-post-reviews/job-post-decision-policy.test.ts` (FR-017-FR-020)
- [X] T065 [P] [US3] Add approve/reject strict command/path, reason bounds, actor-scoped `AdminCommandReceipt` exact replay and changed-binding conflict, stale conflict, terminal replay, and safe error contract tests in `web/tests/backend/contract/job-post-reviews/admin-review-decision.contract.test.ts` (FR-017-FR-020, FR-028)
- [X] T066 [P] [US3] Add exact approval, atomic `JobPosting`/normalized-skill upsert, unused-slug creation, collision blocking, stable aggregate projection identity across reapproval, one public snapshot, server-owned approval/publication/public-update facts, history, audit, outcome notification, and replay integration tests in `web/tests/backend/integration/job-post-reviews/admin-review-approval.test.ts` (FR-017, FR-018, FR-020-FR-022, SC-005)
- [X] T067 [P] [US3] Add required reason, safe explanation, separate private note, non-public result, history, audit, and replay integration tests in `web/tests/backend/integration/job-post-reviews/admin-review-rejection.test.ts` (FR-019-FR-023, SC-006)
- [X] T068 [P] [US3] Add simultaneous approve/reject, stale assignment, revoked grant, inactive company/membership, expired deadline, changed hash, and lost-response tests in `web/tests/backend/integration/job-post-reviews/admin-review-decision-concurrency.test.ts` (FR-017, FR-020, FR-025, SC-004, SC-009)
- [X] T069 [P] [US3] Add canonical `/jobs` search/detail, exact `JobPosting`/skill projection, approved-snapshot enrichment, pending-replacement, rejected, managed closure with pending then later approval remaining closed, expired, removed, malformed/missing JSON, JSON-status-tamper, and unmanaged-legacy compatibility tests in `web/tests/backend/integration/job-post-reviews/job-post-public-projection.test.ts` (FR-006, FR-008, FR-018, FR-025, FR-031, SC-001)
- [X] T070 [P] [US3] Add snapshot allow-list, evidence/contact/application exclusion, private-note isolation, neutral public errors, cross-tenant reads, and log-redaction tests in `web/tests/security/job-post-reviews/job-post-review-privacy.test.ts` (FR-016, FR-023, FR-027, FR-030, SC-006)
- [X] T071 [P] [US3] Add full review, approve/reject confirmation, reason validation, eligibility block, stale recovery, and decision-result component tests in `web/tests/frontend/components/admin-management/job-post-review-decision.test.tsx` (FR-015, FR-017-FR-020, FR-029)
- [X] T072 [P] [US3] Add focus trap/return, destructive-action labeling, keyboard decision, live result, diff semantics, non-color outcomes, and axe tests in `web/tests/frontend/accessibility/admin-management/job-post-review-decision.accessibility.test.tsx` (FR-029, SC-008)

### Implementation for User Story 3

- [X] T073 [US3] Implement approval/rejection revalidation for assignee grant, company verification, membership context, deadline, expected version, and content integrity in `web/src/backend/jobs/review/job-post-review-policy.ts` (FR-017, FR-019, FR-020, FR-027)
- [X] T074 [US3] Implement transaction-compatible approve/reject claims, aggregate pointers/closure actor-time, deterministic existing-`JobPosting`/skill projection writes with closed-state preservation, decision fields, private notes, history, audit, and eligible outcome notifications in `web/src/backend/repositories/jobs/prisma-job-post-review-repository.ts` (FR-008, FR-017-FR-025)
- [X] T075 [US3] Implement idempotent assigned-human approval/rejection orchestration, authorized managed-job closure across review lifecycle and public projection, and blocked-attempt auditing in `web/src/backend/jobs/review/job-post-review-service.ts` (FR-008, FR-014, FR-017-FR-025, FR-027)
- [X] T076 [US3] Complete approve/reject dispatch and strict discriminated validation in `web/src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts` (FR-017-FR-020, FR-027, FR-028)
- [X] T077 [US3] Implement managed-job approved-content selection, server-derived public status/verification/statistics/timestamps, and neutral unavailable behavior in `web/src/backend/services/jobs/job-workspace-data.ts` (FR-006, FR-008, FR-018, FR-025)
- [X] T078 [US3] Integrate the deterministic projector from T017 with aggregate-linked canonical search and approved-snapshot detail enrichment in `web/src/backend/services/jobs/job-discovery-service.ts` and `web/src/backend/repositories/jobs/prisma-public-job-repository.ts` without changing unmanaged legacy behavior (FR-006, FR-018, FR-031)
- [X] T079 [US3] Add safe protected verification-viewer destination resolution without evidence copying in `web/src/backend/jobs/review/job-post-review-service.ts` (FR-015, FR-016)
- [X] T080 [US3] Extend the Administrator action panel with approve/reject forms, public/private separation, eligibility blocks, confirmation, and stale recovery in `web/src/frontend/features/admin/job-post-reviews/job-post-review-action-panel.tsx` (FR-017-FR-020, FR-029)
- [X] T081 [US3] Add current decision, public reason, private notes, approved diff, integrity state, and immutable history rendering in `web/src/frontend/features/admin/job-post-reviews/job-post-review-show.tsx` (FR-015, FR-016, FR-019, FR-021, FR-029)
- [X] T082 [US3] Add integrity-block, decision failure, stale conflict, and queue-age operational metrics in `web/src/backend/jobs/review/job-post-review-operations.ts` (FR-030, SC-009)
- [X] T083 [US3] Validate User Story 3 and record focused results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-001, SC-003-SC-006, SC-008, SC-009)
- [X] T084 [US3] Commit the completed Administrator discovery/decision logical group with an English message; use Git history as the commit-hash evidence referenced by `spec-kit/specs/017-admin-management-job-posting/quickstart.md`

**Checkpoint**: Exact human approval/rejection and approved-only public projection are independently demonstrable; Recruiter outcome/resubmission completes the workflow.

---

## Phase 6: User Story 4 - Receive Outcome and Resubmit Safely (Priority: P1)

**Goal**: A still-authorized submitter receives safe decision feedback; rejected content can be revised and resubmitted as a new immutable version without losing history or leaking after membership loss.

**Independent Test**: Approve/reject, remove and preserve memberships, open outcomes, revise/resubmit, repeat requests, and verify recipient isolation, safe feedback, new sequence/hash, prior history, and public approved content.

### Tests for User Story 4

- [X] T085 [P] [US4] Add eligible submitter, lost membership, unrelated member, multi-company, duplicate outcome, safe payload, and recipient-read-state tests in `web/tests/backend/integration/job-post-reviews/recruiter-outcome-notification.test.ts` (FR-022, FR-023, SC-006)
- [X] T086 [P] [US4] Add rejected revision, changed content hash, new sequence, repeated/concurrent resubmit, preserved history, and prior approved visibility tests in `web/tests/backend/integration/job-post-reviews/recruiter-resubmission.test.ts` (FR-005, FR-008, FR-024, SC-004)
- [X] T087 [P] [US4] Add lost-membership direct notification/detail denial and authorized company-workspace discovery tests in `web/tests/security/job-post-reviews/recruiter-outcome-isolation.test.ts` (FR-022, FR-023, FR-027)
- [X] T088 [P] [US4] Add approved/rejected notification navigation, feedback display, revise/resubmit, pending replacement, and recovery component tests in `web/tests/frontend/components/recruiter-workspace/job-post-review-outcome.test.tsx` (FR-022-FR-024, FR-029)
- [X] T089 [P] [US4] Add outcome announcement, rejection-reason semantics, private-note absence, keyboard revise/resubmit, focus recovery, and axe tests in `web/tests/frontend/accessibility/job-post-reviews/recruiter-outcome.accessibility.test.tsx` (FR-023, FR-024, FR-029, SC-008)

### Implementation for User Story 4

- [X] T090 [US4] Enforce current qualifying membership before outcome notification and tenant-scoped fallback discovery in `web/src/backend/jobs/review/job-post-review-service.ts` (FR-022, FR-023, FR-027)
- [X] T091 [US4] Add safe approved/rejected outcome rendering and Recruiter destinations in `web/src/backend/notifications/event-policy.ts` and `web/src/frontend/features/notifications/notification-copy.ts` (FR-022, FR-023)
- [X] T092 [US4] Implement rejected-revision and distinct resubmission orchestration with preserved aggregate history in `web/src/backend/jobs/review/job-post-submission-service.ts` (FR-005, FR-024)
- [X] T093 [US4] Return tenant-safe public reason/explanation, approved outcome, current sequence, and authorized discovery from `web/src/backend/services/jobs/recruiter-job-posting-data.ts` (FR-022-FR-024)
- [X] T094 [US4] Implement approved/rejected feedback, revise entry, resubmit confirmation, and lost-access recovery in `web/src/frontend/features/recruiter-workspace/job-posting-management.tsx` (FR-022-FR-024, FR-029)
- [X] T095 [US4] Implement rejected-version editing, public reason display, and new-version submit behavior in `web/src/frontend/features/recruiter-workspace/job-posting-editor.tsx` (FR-019, FR-024, FR-029)
- [X] T096 [P] [US4] Add outcome, reason, resubmit, and pending-replacement styles to `web/src/frontend/styles/recruiter-workspace-full.css` (FR-029, SC-008)
- [X] T097 [US4] Validate User Story 4 and record focused results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-004, SC-006-SC-009)
- [X] T098 [US4] Commit the completed Recruiter outcome/resubmission logical group with an English message; use Git history as the commit-hash evidence referenced by `spec-kit/specs/017-admin-management-job-posting/quickstart.md`

**Checkpoint**: All four P1 user stories form one complete human-controlled P0 review workflow.

---

## Phase 7: Polish and Cross-Cutting Release Gates

**Purpose**: Prove migration safety, security, privacy, accessibility, performance, usability, architecture, and regressions across the complete workflow.

- [X] T099 [P] Add migration adoption/replay, exact legacy `JobPosting` identity/content binding, slug/owner mismatch blocking, unresolved mapping, and verification-script integration tests in `web/tests/backend/integration/job-post-reviews/job-post-review-adoption.test.ts` (FR-018, FR-024, FR-026, SC-009)
- [X] T100 [P] Add notification payload privacy, recipient isolation, log redaction, and no snapshot/reason/note canaries in `web/tests/security/notifications/job-post-review-notification-privacy.test.ts` (FR-009, FR-016, FR-022, FR-023)
- [X] T101 [P] Add CSRF, exact-origin, session expiry/revocation, account state, company/membership state, managed closure, Administrator grant, enumeration, and command replay matrix tests in `web/tests/security/job-post-reviews/job-post-review-authorization-matrix.test.ts` (FR-001, FR-008, FR-014, FR-027, FR-028)
- [X] T102 [P] Add architecture canaries for PostgreSQL review authority, aggregate-linked `JobPosting` as derivative search projection, approved-snapshot detail gating, one JSON repository, no second session, and no automated decision path in `web/tests/architecture/job-post-review-boundaries.test.ts` (FR-006, FR-018, FR-025-FR-027, FR-031)
- [X] T103 Create the documented dataset, concurrency, warm-up, nearest-rank percentile, max, error-rate, and integrity-aware measurement harness in `web/scripts/measure-job-post-review-performance.mjs` (FR-030, SC-002, SC-003)
- [X] T104 [P] Add release thresholds for five-second notification P95, two-second interaction P95, exact sample metadata, and 100% integrity/privacy correctness in `web/tests/performance/job-post-reviews/job-post-review-performance.test.ts` (SC-001-SC-006, SC-009)
- [X] T105 [P] Add responsive Administrator/Recruiter submit-alert-claim-approve/reject-resubmit Playwright coverage in `web/tests/system/e2e/job-post-reviews/job-post-review-workflow.spec.ts` (SC-007, SC-008)
- [X] T106 [P] Add network-loss, stale-refresh, JSON integrity-block, notification retry, zero-Administrator, lost-authority, and recovery Playwright coverage in `web/tests/system/e2e/job-post-reviews/job-post-review-recovery.spec.ts` (SC-009)
- [X] T107 Add a fixed first-attempt task-completion protocol and results template for representative Recruiters and Administrators in `web/tests/usability/job-post-reviews/job-post-review-usability-protocol.md` (SC-007)
- [ ] T108 Run the representative usability protocol and record raw completion/error evidence in `web/tests/usability/job-post-reviews/job-post-review-usability-results.md` (SC-007)
- [X] T109 Run Prisma validation/generation, migration checks, typecheck, lint, focused feature suites, and build; record commands/environment/results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-009, SC-010)
- [X] T110 Run notification, Administrator management, job-board, Recruiter workspace, and business-verification regression suites and record results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (FR-031, SC-010)
- [X] T111 Run migration dry-run/adoption/verification twice against documented legacy fixtures and record zero duplicate/destructive outcomes in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (FR-005, FR-026, SC-009)
- [X] T112 Run the performance harness and record environment, dataset, samples, concurrency, P50/P95/P99/max, error rate, and threshold results in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-002, SC-003)
- [ ] T113 Run keyboard, axe, responsive, and focused Playwright validation and record zero serious/critical findings in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (SC-007, SC-008)
- [X] T114 Audit final diffs for zero client-authored lifecycle fields, private-note leakage, unmanaged direct JSON writes, automated decisions, second sessions, hidden analysis findings, or unrelated feature scope and record the result in `spec-kit/specs/017-admin-management-job-posting/quickstart.md` (FR-016, FR-023, FR-026-FR-031)
- [ ] T115 Commit final validation evidence with an English message and use Git history as the release commit-hash evidence referenced by `spec-kit/specs/017-admin-management-job-posting/quickstart.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 Setup**: starts immediately.
- **Phase 2 Foundational**: depends on Phase 1 and blocks every user story.
- **US1 / Phase 3**: depends on the complete foundation and creates pending review authority.
- **US2 / Phase 4**: depends on foundation and consumes US1-created review fixtures for integration, while its list/claim service remains independently testable with seeded reviews.
- **US3 / Phase 5**: depends on US2 assignment authority and US1 exact snapshots.
- **US4 / Phase 6**: depends on US1 versioning and US3 decisions.
- **Phase 7 Release Gates**: depends on all four stories; no story alone is releasable.

### User Story Dependency Graph

```text
Foundation
  -> US1 Submit exact version
       -> US2 Notify/discover/claim
            -> US3 Review/approve/reject
                 -> US4 Outcome/revise/resubmit
                      -> Cross-cutting release gates
```

### Within Each Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Implement shared/repository rules before service orchestration.
3. Implement services before Route Handlers and UI integration.
4. Re-run focused tests and the story's independent scenario.
5. Commit the logical group in English without staging unrelated user files.

## Parallel Opportunities

- T002-T003 can run in parallel.
- T004-T010 can run in parallel because they are separate foundational test files.
- T027-T033, T045-T052, T064-T072, and T085-T089 can run in parallel within their story before implementation.
- Backend and frontend implementation tasks marked `[P]` can run in parallel only after their shared contracts/services are complete.
- T099-T107 can run in parallel after the complete workflow exists; evidence-recording tasks T108-T114 remain ordered by their prerequisite runs.

## Parallel Examples

### User Story 1

```text
Task T027: Recruiter submit-review contract tests
Task T028: Recruiter submission tenant-isolation tests
Task T029: Exact snapshot and baseline integration tests
Task T032: Recruiter submission component tests
Task T033: Recruiter submission accessibility tests
```

### User Story 2

```text
Task T045: Administrator query contract tests
Task T047: Administrator notification integration tests
Task T049: Claim/reassignment concurrency tests
Task T051: Discovery component tests
Task T052: Discovery accessibility tests
```

### User Story 3

```text
Task T064: Decision policy unit tests
Task T066: Approval integration tests
Task T067: Rejection integration tests
Task T069: Public projection tests
Task T070: Decision privacy tests
```

### User Story 4

```text
Task T085: Outcome-recipient integration tests
Task T086: Resubmission integration tests
Task T087: Lost-membership security tests
Task T088: Recruiter outcome component tests
Task T089: Recruiter outcome accessibility tests
```

## Requirement Traceability

| Requirement | Primary Task Coverage |
|-------------|-----------------------|
| FR-001-FR-002 | T012, T027-T029, T034, T036-T039, T101 |
| FR-003-FR-005 | T004-T006, T014-T017, T021, T029-T034, T086, T111 |
| FR-006-FR-008 | T005, T017, T029, T034, T038-T040, T069, T077-T078, T086 |
| FR-009-FR-011 | T008, T013, T022-T024, T034, T042, T047, T100 |
| FR-012-FR-016 | T010-T011, T045-T062, T070, T079-T081, T100 |
| FR-017-FR-020 | T004, T010-T011, T018, T021, T064-T076, T080-T081 |
| FR-021 | T006, T014-T015, T021, T026, T029, T049, T066-T067, T074-T075, T081 |
| FR-022-FR-024 | T008, T013, T022, T024, T067, T074-T075, T085-T098, T099-T100 |
| FR-025-FR-026 | T006-T007, T019-T020, T025-T026, T031, T034-T035, T069, T099, T102, T111, T114 |
| FR-027-FR-028 | T009-T012, T018, T027-T028, T034-T037, T045-T057, T065, T070, T073-T076, T087, T101-T102, T114 |
| FR-029-FR-031 | T009, T020, T032-T041, T051-T052, T059-T063, T070-T072, T080-T083, T088-T098, T102-T114 |
| SC-001 | T043, T069, T077-T078, T104 |
| SC-002-SC-003 | T047, T063, T083, T103-T104, T112 |
| SC-004-SC-006 | T028-T031, T043, T049-T050, T063, T066-T070, T083, T085-T087, T097, T104 |
| SC-007-SC-008 | T033, T041, T052, T063, T071-T072, T083, T088-T089, T096-T098, T105, T107-T108, T113 |
| SC-009-SC-010 | T007, T019, T025-T026, T031, T043, T068-T070, T082-T083, T097, T099-T114 |

## Implementation Strategy

### Technical Checkpoint First

1. Complete Setup and Foundational authority.
2. Complete US1 and validate exact pending snapshots.
3. Complete US2 and validate safe discovery/single assignment.
4. Complete US3 and validate assigned human decisions/approved-only publication.
5. Complete US4 and validate outcome/resubmission.
6. Complete all release gates before any deployment decision.

### P0 Release Scope

The minimum releasable scope is **US1 + US2 + US3 + US4 + Phase 7**. US1 is the first technical checkpoint, not a releasable MVP, because a submission without discovery, decision, feedback, audit, privacy, and recovery is constitution-incomplete.

## Notes

- Keep all Spec Kit artifacts, code comments, test names, and commit messages in English.
- Do not run `/speckit-implement` until the user explicitly approves these artifacts.
- Run `/speckit-analyze` after this task list and remediate every Critical, High, Medium, and Low finding before implementation.
- Preserve `.claude/settings.local.json` and any unrelated user changes; stage only feature-owned files.
