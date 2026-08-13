# Tasks: Admin User Management and Recruiter Verification

**Input**: Design documents from `spec-kit/specs/009-user-management-and-recruiter-verification/`

**Prerequisites**: `plan.md`, `spec.md`, three peer group specs, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Story label map**: Group 1 stories 1-4 use `[US1]`-`[US4]`; Group 2 stories 1-5 use `[US5]`-`[US9]`; Group 3 stories 1-5 use `[US10]`-`[US14]`.

**Implementation order**: Complete Group 1 and its gate before Group 2; complete Group 2 and its gate before Group 3. No group-specific task directory is created.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing Feature 006 admin surface, task tooling, and test boundaries for Feature 009.

- [ ] T001 Confirm the `009-user-management-and-recruiter-verification` branch, feature directory, and reviewed inputs in `spec-kit/specs/009-user-management-and-recruiter-verification/plan.md`
- [ ] T002 [P] Add root and `web/package.json` scripts for contract validation, focused tests, E2E tests, performance, usability, and migration verification from `spec-kit/specs/009-user-management-and-recruiter-verification/quickstart.md`
- [ ] T003 [P] Create planned source and test directories under `web/src/backend/admin/accounts`, `web/src/backend/admin/verification`, `web/src/frontend/features/admin`, `web/tests/fixtures/admin-user-verification`, `web/tests/backend/{unit,contract,integration}/admin-user-verification`, `web/tests/frontend/{components,accessibility}/admin-user-verification`, `web/tests/{architecture,security,performance,usability}`, and `web/tests/system/e2e/admin-user-verification/` without adding a group folder under `spec-kit/specs/009-user-management-and-recruiter-verification/`
- [ ] T004 [P] Add deterministic fixture factories and synthetic evidence fixtures in `web/tests/fixtures/admin-user-verification/index.ts` and `web/tests/fixtures/admin-user-verification/documents/`
- [ ] T005 Add the Feature 009 contract-validation entry point for `spec-kit/specs/009-user-management-and-recruiter-verification/contracts/admin-user-verification.openapi.yaml` and `admin-console-contract.md` in `web/scripts/validate-admin-user-verification-contracts.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared persistence, authorization, command, evidence, and test infrastructure before any story implementation.

**Checkpoint**: Foundation passes migration, boundary, and contract checks before Group 1 work begins.

- [ ] T006 Create migration `web/prisma/migrations/022_admin_user_management_refinement/migration.sql` and update `web/prisma/schema.prisma` with nullable `RecruiterVerificationRequest.adminComment`, `VerificationNotificationEvent` dual-channel persistence/idempotency, reviewed directory indexes, and safe legacy-row handling
- [ ] T007 [P] Define shared Zod/domain types for masked account identity, account status/type, version/freshness, error envelopes, and correlation in `web/src/shared/contracts/admin/resources.ts`
- [ ] T008 [P] Extend the Admin-origin, Better Auth session, Platform Administrator grant, CSRF, and 15-minute step-up boundary for Feature 009 reads and commands in `web/src/backend/admin/admin-request-boundary.ts`
- [ ] T009 [P] Extend shared idempotency, `If-Match`, pessimistic mutation, audit correlation, and safe failure primitives in `web/src/backend/admin/admin-command-boundary.ts`
- [ ] T010 [P] Define private evidence capability, no-store byte-stream, protected rationale, and retention ports in `web/src/backend/admin/admin-protected-data-ports.ts`
- [ ] T011 [P] Add fixed-clock, transaction-failure, concurrency, session-revocation, and email-capture helpers in `web/tests/fixtures/admin-user-verification/test-harness.ts`
- [ ] T012 [P] Add architecture tests enforcing route-handler/service/repository/provider separation, one browser-session owner, no protected client persistence, and no Prisma imports in services in `web/tests/architecture/admin-user-verification-boundaries.test.ts`
- [ ] T013 Add shared OpenAPI/Zod response and command schemas, removed-route metadata for `reinstate` and `request-changes`, and generated exports in `web/src/shared/contracts/admin/commands.ts` and `web/src/shared/contracts/admin/index.ts`
- [ ] T014 Verify migration counts, legacy rejected rows, audit/history rows, and index plans without changing authoritative data in `web/scripts/verify-admin-user-management-migration.mjs`

---

## Phase 3: Group 1 - User Account Directory

### US1 - Find an account in the directory (Priority: P1)

**Goal**: Let an administrator search, filter, paginate, and classify Active/Suspended Candidate and Recruiter accounts using one bounded read projection.

**Independent test**: With mixed synthetic accounts, prove combined/Candidate/Recruiter filters, keyword/date/status filters, stable ordering, pagination, masked identity, and zero writes through API and UI.

- [ ] T015 [P] [US1] Write failing contract tests for `GET /api/admin/accounts` filters, pagination, stable ordering, freshness, masked fields, and safe errors in `web/tests/contract/admin-user-verification/account-directory.contract.test.ts`
- [ ] T016 [P] [US1] Write failing repository/integration tests for Candidate-only, Recruiter-only, combined, account-reference/display-name/email keyword, inclusive date-range, lifecycle-status, and `registeredAt DESC, id ASC` queries in `web/tests/backend/integration/admin-user-verification/account-directory-query.test.ts`
- [ ] T017 [P] [US1] Implement bounded account page query and active verified-membership classifier in `web/src/backend/repositories/admin/prisma-account-directory-repository.ts`
- [ ] T018 [US1] Implement `AccountDirectoryItem` projection, filter normalization, page bounds, unavailable-result handling, and `calculatedAt` in `web/src/backend/admin/accounts/account-directory-service.ts`
- [ ] T019 [US1] Add typed query/response schemas for account directory filters and rows in `web/src/shared/contracts/admin/resources.ts`
- [ ] T020 [US1] Implement authenticated `GET /api/admin/accounts` in `web/src/app/api/admin/accounts/route.ts`
- [ ] T021 [US1] Implement React Admin `accounts.getList` with memory-only filters, no-store reads, abort propagation, and authority-loss cache purge in `web/src/frontend/features/admin/app/data-provider.tsx`
- [ ] T022 [US1] Build account table, filter bar, loading/empty/error/authority-lost states, masked identity, status labels, and responsive rows in `web/src/frontend/features/admin/accounts/account-list.tsx`

**Checkpoint**: US1 is demonstrable through the directory route and React Admin list without account or business-state mutation.

### US2 - Inspect Candidate account activity (Priority: P1)

**Goal**: Show Candidate registration date, CV count, submitted-application count, lifecycle/version, and safe detail eligibility.

**Independent test**: Open Active and Suspended Candidate fixtures and verify exact counts, freshness, no CV/application content leakage, and no N+1 behavior.

- [ ] T023 [P] [US2] Write failing aggregate tests for all Candidate CV rows and submitted JobApplication rows, including zero, unavailable, and Suspended cases, in `web/tests/backend/integration/admin-user-verification/candidate-activity-aggregate.test.ts`
- [ ] T024 [P] [US2] Write failing contract/privacy tests for `GET /api/admin/accounts/{accountId}` Candidate detail and forbidden protected fields in `web/tests/contract/admin-user-verification/account-detail.contract.test.ts`
- [ ] T025 [P] [US2] Add page-bounded Candidate CV/application aggregate queries in `web/src/backend/repositories/admin/prisma-account-directory-repository.ts`
- [ ] T026 [US2] Implement Candidate-aware account detail composition and exact count semantics in `web/src/backend/admin/accounts/account-detail-service.ts`
- [ ] T027 [US2] Add account detail route and safe not-found/authority/version responses in `web/src/app/api/admin/accounts/[accountId]/route.ts`
- [ ] T028 [US2] Add typed account detail schemas and Candidate count variants in `web/src/shared/contracts/admin/resources.ts`
- [ ] T029 [US2] Build Candidate detail rendering, freshness/unavailable states, protected-field exclusions, and keyboard navigation in `web/src/frontend/features/admin/accounts/account-detail-show.tsx`

**Checkpoint**: US2 is independently testable by opening a Candidate detail from a seeded directory page and comparing counts with authoritative records.

### US3 - Inspect Recruiter account activity (Priority: P1)

**Goal**: Show Recruiter registration date, exact Active/Pending Review/Rejected/Draft/Closed job counts, and each visible company authority.

**Independent test**: Seed multiple Active verified companies plus expired/removed control postings and verify distinct-company counts, authority rows, and excluded statuses.

- [ ] T030 [P] [US3] Write failing repository tests for distinct active verified company membership, five displayed job statuses, and excluded EXPIRED/REMOVED postings in `web/tests/backend/integration/admin-user-verification/recruiter-job-aggregate.test.ts`
- [ ] T031 [P] [US3] Write failing contract/component tests for Recruiter detail authority rows and type-specific counts in `web/tests/frontend/components/admin-user-verification/recruiter-account-detail.test.tsx`
- [ ] T032 [P] [US3] Add bounded Recruiter job-status aggregate and per-company authority queries in `web/src/backend/repositories/admin/prisma-account-directory-repository.ts`
- [ ] T033 [US3] Extend account detail service with Recruiter counts, authority state, duplicate-company protection, and explicit unavailable results in `web/src/backend/admin/accounts/account-detail-service.ts`
- [ ] T034 [US3] Add Recruiter count and company-authority contract variants in `web/src/shared/contracts/admin/resources.ts`
- [ ] T035 [US3] Render Recruiter counts, company authority entries, status labels, and excluded-status semantics in `web/src/frontend/features/admin/accounts/account-detail-show.tsx`
- [ ] T036 [US3] Add 10,000-account/200-sample directory performance instrumentation and N+1 query assertions in `web/tests/performance/admin-user-verification/account-directory.perf.test.ts`

**Checkpoint**: US3 is demonstrable with exact Recruiter aggregates and company authority data while preserving tenant boundaries.

### US4 - Read the directory safely and accessibly (Priority: P2)

**Goal**: Make the full Group 1 read-only workflow responsive, keyboard accessible, privacy-safe, and measurable.

**Independent test**: Run axe, keyboard, narrow-screen, 200% zoom, privacy, browser-history, and zero-write checks against list/detail flows.

- [ ] T037 [P] [US4] Write failing accessibility and responsive tests for list/detail/filter/table states at 320 CSS px and 200% zoom in `web/tests/accessibility/admin-user-verification/account-directory.a11y.test.tsx`
- [ ] T038 [P] [US4] Write failing security canaries for URL, cache, telemetry, raw-email, raw-document, session, and zero-write leakage in `web/tests/security/admin-user-verification/account-directory-privacy.test.ts`
- [ ] T039 [US4] Complete focus management, labeled filters, non-color status text, retry/refetch behavior, and mobile stacked rows in `web/src/frontend/features/admin/accounts/account-list.tsx`
- [ ] T040 [US4] Complete detail focus return, protected-field boundaries, responsive authority/count sections, and no-store refresh behavior in `web/src/frontend/features/admin/accounts/account-detail-show.tsx`
- [ ] T041 [US4] Add Group 1 list/detail E2E navigation and back/forward/reload stale-state tests in `web/tests/system/e2e/admin-user-verification/account-directory.spec.ts`
- [ ] T042 [US4] Record Group 1 usability/performance/privacy release evidence and run the Group 1 gate from `spec-kit/specs/009-user-management-and-recruiter-verification/quickstart.md` in `web/tests/usability/admin-user-verification/group-1-release-evidence.test.ts`

**Checkpoint**: Group 1 gate passes; no Group 2 implementation starts until directory correctness, accessibility, privacy, and P95 evidence are recorded.

---

## Phase 4: Group 2 - Business Verification Approval

### US5 - Prioritize the pending review queue (Priority: P1)

**Goal**: Provide an oldest-first, filterable queue of qualified verification requests with Active/Suspended applicant overlay and no evidence leakage.

**Independent test**: Seed Active, Suspended, legacy, expired, and non-qualified requests and verify default/operational filters, fields, ordering, pagination, and freshness.

- [ ] T043 [P] [US5] Write failing queue contract tests for `/api/admin/verification-requests`, default Active Pending Review scope, applicant eligibility filters, exact tax-code/company/date filters, assignment metadata, and stable ordering in `web/tests/contract/admin-user-verification/verification-queue.contract.test.ts`
- [ ] T044 [P] [US5] Write failing repository tests for request-state, applicant-state, evidence qualification, pagination, and no-locator queue projections in `web/tests/backend/integration/admin-user-verification/verification-queue-query.test.ts`
- [ ] T045 [P] [US5] Implement queue filters, oldest-first order, bounded page query, applicant eligibility overlay, and safe queue fields in `web/src/backend/repositories/admin/prisma-verification-repository.ts`
- [ ] T046 [US5] Implement `VerificationQueueItem` projection and operational suspended-applicant filtering in `web/src/backend/admin/verification/verification-review-service.ts`
- [ ] T047 [US5] Implement `GET /api/admin/verification-requests` with validated filters and no evidence capability in `web/src/app/api/admin/verification-requests/route.ts`
- [ ] T048 [US5] Add queue schemas, exact `^[0-9]{10}$` tax-code validation, and React Admin `verification-requests.getList` mapping in `web/src/shared/contracts/admin/verification.ts` and `web/src/frontend/features/admin/app/data-provider.tsx`
- [ ] T049 [US5] Build verification queue table, filters, empty/loading/error states, applicant eligibility badges, pagination, and calculated-at display in `web/src/frontend/features/admin/verification/verification-request-list.tsx`

**Checkpoint**: US5 is demonstrable as a read-only review queue with Active-only default behavior and suspended operational visibility.

### US6 - Review company facts and evidence safely (Priority: P1)

**Goal**: Let administrators inspect company/tax facts, prerequisite state, evidence versions, protected notes, histories, and safe image/PDF evidence streams.

**Independent test**: Open clean image/PDF, failed, inaccessible, superseded, deleted, and unsupported evidence fixtures and verify capability, no-store, viewer, and recovery behavior.

- [ ] T050 [P] [US6] Write failing review-detail contract tests for applicant/company/prerequisite/evidence metadata, histories, notes, `canDecide`, and safe block reasons in `web/tests/contract/admin-user-verification/verification-review.contract.test.ts`
- [ ] T051 [P] [US6] Write failing evidence capability/privacy tests for preview/download media types, no-store headers, expired capability, deleted evidence, and raw-byte exclusion in `web/tests/security/admin-user-verification/verification-evidence-privacy.test.ts`
- [ ] T052 [P] [US6] Implement review-detail joins, evidence version metadata, decision history, protected-note projection, and applicant eligibility in `web/src/backend/repositories/admin/prisma-verification-repository.ts`
- [ ] T053 [US6] Implement `GET /api/admin/verification-requests/{requestId}` and protected evidence preview/download route handlers in `web/src/app/api/admin/verification-requests/[requestId]/route.ts` and `web/src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/{preview,download}/route.ts`
- [ ] T054 [US6] Add review-detail/evidence metadata schemas and capability response validation in `web/src/shared/contracts/admin/verification.ts`
- [ ] T055 [US6] Build review detail with company facts, tax code, histories, notes, decision availability, and safe recovery states in `web/src/frontend/features/admin/verification/verification-review-show.tsx`
- [ ] T056 [US6] Build protected image/PDF viewer controls, zoom/page keyboard behavior, no-store download, and inaccessible/deleted/unsupported states in `web/src/frontend/features/admin/verification/protected-evidence-viewer.tsx`

**Checkpoint**: US6 is independently testable with review detail and protected evidence viewing without exposing locators or internal scanner responses.

### US7 - Approve a legitimate application (Priority: P1)

**Goal**: Approve one qualified Active applicant atomically, grant exactly one company-scoped authority, and emit decision/audit/outbox effects.

**Independent test**: Approve clean new-company and existing-company fixtures, then verify state, membership, identity preservation, audit, outbox, idempotency, and duplicate prevention.

- [ ] T057 [P] [US7] Write failing eligibility tests for request/version, applicant Active, four evidence PASS checks, prerequisite, authority, fresh proof, and duplicate-membership gates in `web/tests/backend/unit/admin-user-verification/verification-decision-eligibility.test.ts`
- [ ] T058 [P] [US7] Write failing transaction tests for exactly-once approval, company creation/reuse, membership grant, Candidate identity preservation, decision history, audit, and one dual-channel notification outcome in `web/tests/backend/integration/admin-user-verification/verification-approval-transaction.test.ts`
- [ ] T059 [US7] Implement shared transaction-local approval/rejection eligibility loader in `web/src/backend/admin/verification/verification-decision-eligibility.ts`
- [ ] T060 [US7] Implement atomic approval transaction with row locks, version checks, company prerequisite validation, membership uniqueness, decision/audit/outbox writes, and idempotency in `web/src/backend/admin/verification/verification-approval-transaction.ts`
- [ ] T061 [US7] Add approval command schema/result and shared verification command types in `web/src/shared/contracts/admin/commands.ts`
- [ ] T062 [US7] Implement `POST /api/admin/verification-requests/{requestId}/approve` with CSRF, step-up, If-Match, and idempotency handling in `web/src/app/api/admin/verification-requests/[requestId]/approve/route.ts`
- [ ] T063 [US7] Add Approve confirmation, pending/conflict/success/error states, per-channel email/in-app queued delivery status, and authoritative refetch to `web/src/frontend/features/admin/verification/verification-decision-panel.tsx`
- [ ] T064 [US7] Add concurrency, replay, prerequisite-expiry, duplicate-authority, audit, dual-channel notification-outbox, and delivery-idempotency E2E coverage in `web/tests/system/e2e/admin-user-verification/verification-approval.spec.ts`

**Checkpoint**: US7 is demonstrable and approved membership appears in Group 1 on the next confirmed read.

### US8 - Reject an invalid application and enable reapplication (Priority: P1)

**Goal**: Reject with a required category and 10-500-character applicant-visible reason, retain protected notes separately, and trigger compatible Candidate reapplication.

**Independent test**: Reject invalid fixtures with boundary-length/invalid inputs and verify `adminComment`, evidence inaccessibility/deletion schedule, decision/audit, exactly one safe email, and Candidate Reapply compatibility.

- [ ] T065 [P] [US8] Write failing rejection validation and legacy-row tests for category, normalized 10-500-character reason, protected note separation, and unavailable legacy reason in `web/tests/backend/unit/admin-user-verification/verification-rejection-validation.test.ts`
- [ ] T066 [P] [US8] Write failing integration tests for rejection evidence inaccessibility, 24-hour deletion scheduling, decision/audit/outbox, and Candidate-side reapplication fields/statuses in `web/tests/backend/integration/admin-user-verification/verification-rejection-reapply.test.ts`
- [ ] T067 [US8] Implement rejection transaction, `adminComment` persistence, evidence retention transition, decision/audit writes, and exactly-once `VerificationNotificationEvent` with one email outbox child plus one in-app work item in `web/src/backend/admin/verification/verification-approval-transaction.ts`
- [ ] T068 [US8] Implement `POST /api/admin/verification-requests/{requestId}/reject` and remove current Request Changes command exposure in `web/src/app/api/admin/verification-requests/[requestId]/reject/route.ts`
- [ ] T069 [US8] Add Reject command schemas with the seven allowlisted reason categories, applicant-visible/protected-note separation, dual-channel notification result, and removed-route metadata in `web/src/shared/contracts/admin/commands.ts` and `web/src/shared/contracts/admin/generated/index.ts`
- [ ] T070 [US8] Build Reject dialog, field validation, protected-note labeling, email-safe preview, and authoritative result/refetch states in `web/src/frontend/features/admin/verification/verification-decision-panel.tsx`
- [ ] T071 [US8] Update Candidate verification state/reapply compatibility and map one idempotent verification outcome to both email and in-app applicant channels; implement retryable channel delivery in `web/src/backend/candidate/recruiter-verification/verification-application-service.ts` and `web/src/backend/admin/workers/verification-notification-loop.ts`
- [ ] T072 [US8] Add rejection privacy, dual-channel notification payload/delivery-idempotency, reapply, retention, and no-Request-Changes E2E coverage in `web/tests/system/e2e/admin-user-verification/verification-rejection.spec.ts`

**Checkpoint**: US8 is independently testable from Admin rejection through Candidate reapplication without leaking protected notes or documents.

### US9 - Recover from delayed, unavailable, and stale review state (Priority: P2)

**Goal**: Make suspended-applicant overlays, stale decisions, evidence outages, retention, and worker retries safe and observable.

**Independent test**: Inject applicant suspension, stale versions, PENDING_CHECKS, storage outages, worker retries, and fake-clock retention transitions; verify no partial decision or authority grant.

- [ ] T073 [P] [US9] Write failing stale/suspended/outage/concurrency tests for decision endpoints and queue refetch behavior in `web/tests/backend/integration/admin-user-verification/verification-recovery.test.ts`
- [ ] T074 [P] [US9] Write failing fake-clock worker tests for evidence deletion deadlines, verification lifecycle reconciliation, retry idempotency, and no-authority mutation in `web/tests/backend/integration/admin-user-verification/verification-retention-worker.test.ts`
- [ ] T075 [US9] Implement suspended-applicant eligibility overlay, safe 423/block responses, stale refetch contract, and no-deadline-reset behavior in `web/src/backend/admin/verification/verification-review-service.ts` and `web/src/backend/admin/verification/verification-decision-eligibility.ts`
- [ ] T076 [US9] Complete evidence retention and verification lifecycle reconciliation for rejected/cancelled/expired/superseded/approved records in `web/src/backend/admin/workers/evidence-retention-loop.ts` and `web/src/backend/admin/workers/verification-lifecycle-loop.ts`
- [ ] T077 [US9] Add suspended-applicant, stale, worker-delay, storage-error, and retry UI states with explicit retry/refetch behavior in `web/src/frontend/features/admin/verification/verification-review-show.tsx`
- [ ] T078 [US9] Record Group 2 qualification, privacy, accessibility, P95, concurrency, and usability evidence from `spec-kit/specs/009-user-management-and-recruiter-verification/quickstart.md` in `web/tests/usability/admin-user-verification/group-2-release-evidence.test.ts`

**Checkpoint**: Group 2 gate passes; only then may Group 3 account lifecycle commands be implemented.

---

## Phase 5: Group 3 - Account Suspension and Restoration

### US10 - Suspend an account safely (Priority: P1)

**Goal**: Atomically suspend an eligible account, revoke sessions/challenges, persist audit/rationale, and queue exactly one mandatory security email.

**Independent test**: Suspend Active Candidate-only and recruiter-enabled fixtures and verify state/version, revocation, preservation of domain records, audit/rationale/email projections, and idempotency.

- [ ] T079 [P] [US10] Write failing suspend command tests for category/reason/confirmation, Active-state/version, authorization, session/challenge revocation, audit, rationale, email work, and exactly-once effects in `web/tests/backend/integration/admin-user-verification/account-suspend-command.test.ts`
- [ ] T080 [P] [US10] Write failing contract tests for `POST /api/admin/accounts/{accountId}/suspend`, error codes, If-Match, CSRF, idempotency, and safe protected-target behavior in `web/tests/contract/admin-user-verification/account-moderation.contract.test.ts`
- [ ] T081 [US10] Tighten suspend transaction with current Platform Administrator target block, row lock, version check, account state update, all-session/challenge revocation, audit, encrypted rationale, and notification outbox in `web/src/backend/admin/accounts/admin-account-command-transaction.ts`
- [ ] T082 [US10] Implement suspend command validation, account eligibility, and moderation history projection in `web/src/backend/admin/accounts/admin-account-service.ts`
- [ ] T083 [US10] Implement `POST /api/admin/accounts/{accountId}/suspend` with fresh proof, CSRF, If-Match, idempotency, and safe errors in `web/src/app/api/admin/accounts/[accountId]/suspend/route.ts`
- [ ] T084 [US10] Add moderation command schemas/results with the seven allowlisted categories and canonical `ACCOUNT_SUSPENDED` security event payload in `web/src/shared/contracts/admin/commands.ts` and `web/src/backend/admin/notifications/notification-events.ts`
- [ ] T085 [US10] Build Suspend dialog with reason/category validation, explicit confirmation, focus containment, pending/result/error states, and authoritative refetch in `web/src/frontend/features/admin/accounts/account-state-dialog.tsx`
- [ ] T086 [US10] Add suspend command E2E, failure-injection, session-revocation, protected-rationale, and mandatory-email assertions in `web/tests/system/e2e/admin-user-verification/account-suspend.spec.ts`

**Checkpoint**: US10 is demonstrable with atomic suspension and no mutation to jobs, applications, memberships, verification, CVs, or scores.

### US11 - Understand the suspended-user experience (Priority: P1)

**Goal**: Enforce suspended account state across authentication and protected commands while preserving public job visibility and independent company workflows.

**Independent test**: Attempt old/new session login, Candidate apply, Recruiter commands, public job browsing, and another authorized Recruiter application processing for suspended fixtures.

- [ ] T087 [P] [US11] Write failing authentication and protected-command tests for suspended Candidate/Recruiter denial, support/dispute destination, stale cache/back-forward/reload, and enforcement timing in `web/tests/security/admin-user-verification/suspended-account-enforcement.test.ts`
- [ ] T088 [P] [US11] Write failing cross-module regression tests proving public job visibility, preserved applications/memberships/jobs/scores, and other-authorized-Recruiter processing in `web/tests/backend/integration/admin-user-verification/suspended-cross-workflow.test.ts`
- [ ] T089 [US11] Enforce current UserAccount state at shared Better Auth login/session and protected-command boundaries in `web/src/backend/auth/account-state-enforcement.ts`
- [ ] T090 [US11] Implement suspended-login safe result and approved support/dispute destination in `web/src/app/api/auth/suspended-state/route.ts` and `web/src/frontend/features/auth/suspended-account-screen.tsx`
- [ ] T091 [US11] Add explicit preservation checks to application, job, membership, verification, and scoring services without changing authoritative records in `web/src/backend/recruitment/application-access-service.ts`
- [ ] T092 [US11] Add suspended Candidate/Recruiter/public-job/authorized-Recruiter E2E regression coverage in `web/tests/system/e2e/admin-user-verification/suspended-user-experience.spec.ts`

**Checkpoint**: US11 is independently testable as shared enforcement and preservation, with public browsing and independent company processing intact.

### US12 - Restore a suspended account safely (Priority: P1)

**Goal**: Atomically restore an eligible Suspended account, allow a new login, preserve independent records, and queue exactly one canonical Restore email without reviving old sessions.

**Independent test**: Restore Candidate-only and recruiter-enabled Suspended fixtures and verify Active state/version, new-login behavior, old-session invalidity, no membership/content revival, audit/rationale/email, and verification revalidation.

- [ ] T093 [P] [US12] Write failing restore transaction and contract tests for Suspended-state/version, protected-admin block, no-session-creation, canonical event, rationale, email, and idempotent replay in `web/tests/backend/integration/admin-user-verification/account-restore-command.test.ts`
- [ ] T094 [US12] Implement Restore branch and `ACCOUNT_RESTORED` mapping while keeping historical `ACCOUNT_REINSTATED` rows immutable in `web/src/backend/admin/accounts/admin-account-command-transaction.ts`
- [ ] T095 [US12] Implement `POST /api/admin/accounts/{accountId}/restore` and remove current `reinstate` command exposure in `web/src/app/api/admin/accounts/[accountId]/restore/route.ts`
- [ ] T096 [US12] Add Restore command schema/result, historical event presentation mapper, and canonical notification template payload in `web/src/shared/contracts/admin/commands.ts` and `web/src/backend/admin/notifications/account-security-templates.tsx`
- [ ] T097 [US12] Add Restore action, confirmation, no-session messaging, stale/refetch states, and verification-request revalidation link in `web/src/frontend/features/admin/accounts/account-state-dialog.tsx`
- [ ] T098 [US12] Add restore/login/session-preservation and post-restore verification eligibility E2E coverage in `web/tests/system/e2e/admin-user-verification/account-restore.spec.ts`
- [ ] T099 [US12] Add Group 3 restore acceptance evidence for state, session, domain-record preservation, email, and P95 navigation in `web/tests/usability/admin-user-verification/group-3-restore-evidence.test.ts`

**Checkpoint**: US12 is demonstrable and Group 1/2 reads reflect restored state only after authoritative refetch and revalidation.

### US13 - Prevent unsafe, duplicate, and stale enforcement (Priority: P1)

**Goal**: Make Suspend/Restore safe for current Platform Administrator targets, stale clients, concurrent operators, failures, retries, and in-flight requests.

**Independent test**: Exercise every protected-admin target, invalid input/proof, stale version, duplicate key, concurrent command, and injected write failure; verify denied audit/receipt rules and no partial mutation.

- [ ] T100 [P] [US13] Write failing protected-administrator and denied-audit tests for acting/non-acting current administrators, audit failure, no rationale/email, and safe `ACTION_BLOCKED` output in `web/tests/security/admin-user-verification/protected-admin-target.test.ts`
- [ ] T101 [P] [US13] Write failing concurrency/idempotency/failure-injection tests across account, session, challenge, audit, rationale, notification, and outbox writes in `web/tests/backend/integration/admin-user-verification/account-moderation-integrity.test.ts`
- [ ] T102 [US13] Implement stable denied command receipt/audit branch and all row-lock/version/idempotency conflict handling in `web/src/backend/admin/accounts/admin-account-command-transaction.ts`
- [ ] T103 [US13] Implement cache purge, authoritative detail refetch, stale-page handling, and authority-loss navigation for moderation commands in `web/src/frontend/features/admin/app/data-provider.tsx`
- [ ] T104 [US13] Add browser history/in-flight request protection and shared session invalidation canaries in `web/src/backend/auth/session-revocation-service.ts`
- [ ] T105 [US13] Add safe moderation error-envelope and removed-route contract parity assertions in `web/tests/contract/admin-user-verification/account-moderation.contract.test.ts`
- [ ] T106 [US13] Add two-second session/challenge revocation measurement and nearest-rank P95 reporting in `web/tests/performance/admin-user-verification/account-moderation.perf.test.ts`
- [ ] T107 [US13] Add architecture and security regression checks proving no second session, moderation table, notification channel, bulk action, or administrator-grant mutation in `web/tests/architecture/admin-user-verification-boundaries.test.ts`

**Checkpoint**: US13 is independently testable under failure and concurrency before exposing the complete moderation history surface.

### US14 - Review moderation history and delivery failures (Priority: P2)

**Goal**: Project allowlisted moderation history, protected rationale access, security-email retry/manual-intervention state, and retention evidence.

**Independent test**: Create success, denied, failed, retried, manual-intervention, legacy-reinstated, and expired-rationale records and verify safe detail/history rendering and cleanup.

- [ ] T108 [P] [US14] Write failing audit projection tests for actor/target/action/prior/result/category/result/time/correlation, denied/failed outcomes, and legacy Restore presentation in `web/tests/backend/unit/admin-user-verification/account-moderation-history.test.ts`
- [ ] T109 [P] [US14] Write failing security-notification worker tests for immediate attempt, retry schedule, attempt-5/manual intervention, delivery failure isolation, and exactly-once linkage in `web/tests/backend/integration/admin-user-verification/security-notification-worker.test.ts`
- [ ] T110 [US14] Implement allowlisted `AccountModerationLog` projection and protected rationale read boundary in `web/src/backend/admin/accounts/account-detail-service.ts` and `web/src/app/api/admin/actions/[correlationId]/rationale/route.ts`
- [ ] T111 [US14] Implement canonical security email templates, dispatcher payload allowlist, retry/manual-intervention reconciliation, and no in-app notification behavior in `web/src/backend/admin/notifications/security-notification-dispatcher.ts` and `web/src/backend/admin/workers/security-notification-loop.ts`
- [ ] T112 [US14] Implement encrypted rationale cleanup at 365 days plus 24-hour deletion and evidence reporting in `web/src/backend/admin/workers/rationale-retention-loop.ts`
- [ ] T113 [US14] Render moderation timeline, notification delivery status, protected rationale detail, unavailable state, and fresh-proof reveal in `web/src/frontend/features/admin/accounts/notification-delivery-status.tsx` and `web/src/frontend/features/admin/accounts/privileged-rationale-detail.tsx`
- [ ] T114 [US14] Add Group 3 history, delivery-failure, retention, accessibility, privacy, usability, and quickstart release-evidence coverage in `web/tests/system/e2e/admin-user-verification/account-moderation-history.spec.ts`

**Checkpoint**: Group 3 gate passes with audit/rationale/email retention evidence and no plaintext protected data in UI, URLs, logs, telemetry, or notification payloads.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete release-quality verification across all three groups and preserve existing SmartHire workflows.

- [ ] T115 [P] Run full OpenAPI/Zod/provider parity and removed-route validation for `spec-kit/specs/009-user-management-and-recruiter-verification/contracts/` in `web/scripts/validate-admin-user-verification-contracts.mjs`
- [ ] T116 [P] Run full Feature 009 unit/integration/contract/accessibility/security suites and publish sanitized evidence in `web/tests/system/e2e/admin-user-verification/release-suite.spec.ts`
- [ ] T117 [P] Run all three 10,000-account/1,000-request performance protocols with 200 measured samples, 10 concurrent admins, P95/error reporting, and dataset metadata in `web/tests/performance/admin-user-verification/release-performance.test.ts`
- [ ] T118 [P] Run 20-participant usability protocols for directory, verification review, and moderation dialogs with keyboard/focus observations in `web/tests/usability/admin-user-verification/release-usability.test.ts`
- [ ] T119 [P] Run privacy/security canaries for URLs, cache, browser storage, telemetry, evidence, rationale, email payloads, session isolation, and tenant boundaries in `web/tests/security/admin-user-verification/release-privacy.test.ts`
- [ ] T120 Run Feature 006 admin, Feature 007 job board, Candidate Recruiter verification, application pipeline, CV/evidence, and email-worker regressions in `web/tests/system/e2e/admin-user-verification/cross-module-regression.spec.ts`
- [ ] T121 Run `quickstart.md` migration/retention/failure-recovery steps and record sanitized release evidence in `web/tests/system/e2e/admin-user-verification/quickstart-validation.spec.ts`
- [ ] T122 Update Feature 009 implementation notes, release evidence index, and operator recovery guidance in `spec-kit/specs/009-user-management-and-recruiter-verification/quickstart.md`
- [ ] T123 Review final diff for Constitution compliance, exact task traceability, no group folder, no out-of-scope implementation, and generated task completion in `spec-kit/specs/009-user-management-and-recruiter-verification/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 is the starting check; T002-T005 can run in parallel after the feature directory is confirmed.
- **Phase 2 (Foundational)**: Depends on T001-T005; T006-T012 are parallel where files do not overlap, T013 depends on T007-T010, and T014 depends on T006.
- **Phase 3 (Group 1)**: Depends on all Phase 2 tasks. US1 must complete before US2/US3; US2 and US3 may proceed in parallel after US1; US4 follows US1-US3.
- **Phase 4 (Group 2)**: Depends on the Group 1 gate (T042). US5 precedes US6; US7 and US8 depend on US6 and share the eligibility boundary; US9 follows US7-US8.
- **Phase 5 (Group 3)**: Depends on the Group 2 gate (T078). US10 precedes US11-US12; US11 and US12 may proceed in parallel after US10; US13 follows command work; US14 follows US13.
- **Phase 6 (Polish)**: Depends on Group 1, Group 2, and Group 3 checkpoints; T115-T119 can run in parallel, while T120-T123 consume their results.

### User Story Dependencies

| Global label | Peer spec stories | Priority | Depends on | Independently verifiable increment |
|---|---|---:|---|---|
| US1-US4 | Group 1 - Account Directory stories 1-4 | P1/P2 | Foundation; US2/US3 follow US1, US4 follows Group 1 | Read-only account directory and detail |
| US5-US9 | Group 2 - Verification stories 1-5 | P1/P2 | Group 1 gate; US6 after US5, US7/US8 after US6, US9 after decisions | Review queue, protected evidence, approve/reject |
| US10-US14 | Group 3 - Suspension/Restoration stories 1-5 | P1/P2 | Group 2 gate; US11/US12 after US10, US13 after commands, US14 after US13 | Atomic lifecycle enforcement and audit/email recovery |

### Requirement Traceability

| Tasks | Specification coverage |
|---|---|
| T015-T022 | Group 1 FR-001..FR-010, AC-001..AC-004, SC-001..SC-003 |
| T023-T029 | Group 1 FR-011, FR-014..FR-019, AC-005, SC-004 |
| T030-T036 | Group 1 FR-012..FR-017, AC-006..AC-007, SC-005..SC-006 |
| T037-T042 | Group 1 FR-018..FR-025, AC-008..AC-011, SC-007..SC-009 |
| T043-T049 | Group 2 G2-FR-001..G2-FR-007, G2-AC-001..G2-AC-003, G2-SC-001..G2-SC-002 |
| T050-T056 | Group 2 G2-FR-001..G2-FR-009, G2-AC-004, G2-SC-003..G2-SC-004 |
| T057-T064 | Group 2 G2-FR-010..G2-FR-013 and G2-FR-018, G2-AC-005..G2-AC-007, G2-SC-005..G2-SC-007 |
| T065-T072 | Group 2 G2-FR-014..G2-FR-022, G2-AC-008..G2-AC-010, G2-SC-008 |
| T073-T078 | Group 2 G2-FR-023..G2-FR-031, G2-AC-011..G2-AC-013, G2-SC-009..G2-SC-012 |
| T079-T086 | Group 3 G3-FR-001..G3-FR-006 and G3-FR-015, G3-AC-001..G3-AC-002, G3-SC-001..G3-SC-003 |
| T087-T092 | Group 3 G3-FR-007..G3-FR-010 and G3-FR-024..G3-FR-025, G3-AC-003..G3-AC-004, G3-SC-002 |
| T093-T099 | Group 3 G3-FR-011..G3-FR-012 and G3-FR-018..G3-FR-020, G3-AC-005, G3-SC-003 |
| T100-T107 | Group 3 G3-FR-013..G3-FR-015 and G3-FR-026, G3-AC-006..G3-AC-008, G3-SC-005..G3-SC-006 |
| T108-T114 | Group 3 G3-FR-016..G3-FR-023 and G3-FR-027..G3-FR-030, G3-AC-009..G3-AC-012, G3-SC-006..G3-SC-011 |
| T115-T123 | Constitution gates, all Group 1-3 SC validation protocols, migration/recovery, privacy, accessibility, performance, and regression coverage |

### Parallel Opportunities

- **Setup**: T002, T003, and T004 touch separate configuration/fixture paths and can run in parallel after T001.
- **Foundation**: T007-T012 are parallelizable by contract, boundary, port, harness, and architecture ownership; T006 remains the migration dependency for T014.
- **Group 1**: T015-T016; T017 and T019; T023-T024; T025 and T028; T030-T031; T032 and T034; T037-T038 can run in parallel in their dependency windows.
- **Group 2**: T043-T044; T050-T051; T052 and T054; T057-T058; T065-T066; T073-T074 can run in parallel before implementation.
- **Group 3**: T079-T080; T087-T088; T093; T100-T101; T108-T109 can run in parallel because they use separate test files.
- **Polish**: T115-T119 can run in parallel after all story checkpoints.

### Parallel Example: Group 1 checkpoint

```text
After T014:
  - T015 contract tests and T016 repository tests
After T016:
  - T017 repository projection and T019 shared schemas
After T022:
  - T023/T024 Candidate tests, then T025/T028 aggregate and schema work
After T029:
  - T030/T031 Recruiter tests and T032/T034 Recruiter aggregate/schema work
After T036:
  - T037/T038 accessibility and privacy tests, then T039-T042 release gate
```

### Parallel Example: Group 2 decision checkpoint

```text
After T049:
  - T050/T051 review/evidence tests
After T056:
  - T057/T058 approval tests and T065/T066 rejection tests can be prepared in parallel
After T060:
  - T061/T062/T063 approval contract, route, and UI work
After T067:
  - T068/T069/T070 rejection route, contract, and UI work
After T072:
  - T073/T074 recovery and retention tests, then T075-T078 Group 2 gate
```

### Parallel Example: Group 3 enforcement checkpoint

```text
After T086:
  - T087/T088 suspended-experience tests and T093 restore tests
After T092/T099:
  - T100/T101 integrity tests and T102-T107 command hardening
After T107:
  - T108/T109 history/worker tests and T110-T114 moderation history/release evidence
```

## Implementation Strategy

### Technical checkpoint and MVP scope

1. Complete Setup and Foundational phases.
2. Deliver Group 1 US1 as the first technical checkpoint: a read-only searchable account directory with deterministic classification and no business-state writes.
3. Add Group 1 US2-US4 and stop for the complete Group 1 gate.
4. Add Group 2 queue/evidence/decision workflow and stop for its complete gate.
5. Add Group 3 lifecycle enforcement/history and stop for its complete gate.
6. Run all cross-cutting gates before release.

US1 is the smallest useful development checkpoint, not a standalone production release. User management and employer verification are P0 capabilities, so releasable scope must satisfy all applicable Group 1-3 requirements and Constitution gates.

### Incremental delivery

Each completed story must preserve previous story behavior and pass its independent test criteria. Group 2 consumes Group 1's confirmed account classification/detail; Group 3 consumes Group 1 detail and Group 2 applicant eligibility without creating alternate authorities or sessions.

### Task quality rules

- Every task is a strict unchecked checklist item with a sequential ID and an exact repository path.
- `[P]` appears only where the task can run independently without incomplete-file dependencies.
- Every user-story task carries exactly one global `[USn]` label for traceability.
- Tests precede implementation within each story and demonstrate the relevant specification requirements before implementation is complete.
- No task creates a group-specific spec directory, second admin app, second worker, second session mechanism, aggregate cache, moderation table, or notification authority.
