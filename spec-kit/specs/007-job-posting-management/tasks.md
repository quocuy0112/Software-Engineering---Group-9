---
description: Dependency-ordered implementation tasks for the Candidate recruiter header action
---

# Tasks: Recruiter Base Role — Header Layout Change

**Input**: Design documents from spec-kit/specs/007-job-posting-management/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, and quickstart.md

**Tests**: Tests are mandatory because the specification and plan define explicit contract, security, privacy, accessibility, responsive, performance, regression, and usability acceptance criteria.

**Organization**: Tasks are grouped by user story. Each story is independently testable after the shared foundation, while a releasable Group 1 increment requires all four P1 stories and the final release gates.

## Format: [ID] [P?] [Story] Description

- **[P]**: May run in parallel because it changes a different file and has no dependency on incomplete work.
- **[Story]**: Maps a task to one approved user story; setup, foundation, and cross-cutting tasks have no story label.
- Every task names exact files plus at least one FR or SC identifier for traceability.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add focused commands and deterministic fixtures with the existing Next.js, Vitest, Testing Library, Playwright, axe-core, and Prisma toolchain. Do not add dependencies, migrations, or persistent feature state.

- [X] T001 [P] Register focused test:recruiter-header, test:recruiter-header:e2e, and perf:recruiter-header commands using only installed tooling in web/package.json (SC-001–SC-010)
- [X] T002 [P] Create deterministic account, company, membership, session, and latest-verification-request fixture builders for the complete projection matrix in web/tests/helpers/recruiter-header-fixture.ts (FR-003–FR-007, FR-017, FR-034; SC-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the strict projection contract, layered read boundary, exact-host/session guards, client lifecycle, navigation recovery, safe placeholder, header composition, and base styling shared by all four stories.

**Critical**: No user-story work begins until this phase can render a safe placeholder, validate trust-boundary data, preserve module boundaries, and prove the exact Candidate-host check runs before session or status access.

### Tests for the Foundation

> Write these tests first and confirm they fail for the missing foundation.

- [X] T003 [P] Add strict schema tests for four states, destination/href invariants, offset timestamps, UNAUTHORIZED, UNAVAILABLE, STATUS_UNAVAILABLE, unknown-field rejection, and identifier canaries in web/tests/shared/unit/contracts/recruiter-header-status.test.ts (FR-003, FR-008–FR-018; SC-001, SC-007)
- [X] T004 [P] Add architecture and scope tests that confine Prisma to the repository implementation, require injected service dependencies, keep the shared host predicate free of session/status imports, preserve existing session-policy auditing, prevent frontend/server coupling and alternate browser sessions, and prohibit feature storage, writes, migrations, new recruiter-header audit events, notifications, destination workflow ownership, authorization changes, route construction, workspace switching, and job-post creation in web/tests/architecture/recruiter-header-boundaries.test.ts (FR-016–FR-020, FR-034–FR-036; SC-007–SC-010)
- [X] T005 [P] Add repository integration tests for account-scoped qualifying-membership existence, bounded latest-request reads, createdAt/id tie ordering, minimal returned fields, and zero writes in web/tests/backend/integration/recruiter-header/status-projection.test.ts (FR-003–FR-007, FR-018, FR-034–FR-035; SC-001, SC-007)
- [X] T006 [P] Add pure predicate unit tests for exact and case-normalized Candidate hosts plus missing, malformed, Admin, Recruiter, and unknown hosts without session or status dependency access in web/tests/backend/unit/auth/candidate-host-boundary.test.ts (FR-016–FR-020; SC-007–SC-008)
- [X] T007 [P] Add initial-render integration tests proving the workspace layout returns a neutral not-found result for rejected hosts before getWorkspaceContext, session, profile, service, or repository access while the exact Candidate host proceeds in web/tests/backend/integration/recruiter-header/initial-host-boundary.test.ts (FR-016–FR-020; SC-007–SC-008)
- [X] T008 [P] Add route security contract tests proving exact Candidate-host acceptance, neutral 404 UNAVAILABLE for Admin, Recruiter, unknown, and malformed hosts before session/service/repository access, existing Better Auth validation, no credential creation or refresh, and no-store errors in web/tests/backend/contract/recruiter-header/header-status.contract.test.ts (FR-016–FR-020; SC-007–SC-008)
- [X] T009 [P] Add fake-timer and deferred-fetch tests for adopting the server initial projection without a mount-triggered request, strict parsing, focus/visibility/30-second refresh, hidden-tab pause, one in-flight request, abort, stale-response rejection, preserved busy label, and unavailable fallback in web/tests/frontend/components/recruiter-header/recruiter-header-status-hook.test.tsx (FR-012–FR-015, FR-019, FR-022; SC-003, SC-008–SC-009)
- [X] T010 [P] Add controlled-adapter tests for one-shot same-origin and external opening plus recovery after throw, cancellation, same-route or unchanged-path result, pageshow restoration, and focus/visibility return in web/tests/frontend/components/recruiter-header/recruiter-header-navigation-hook.test.tsx (FR-020, FR-022–FR-024; SC-005)
- [X] T011 [P] Add shell composition tests for placeholder failure isolation, theme/profile/action DOM and Tab order, unchanged profile destination/fallback avatar, full-name/email accessible description, and non-layout-shifting hover/focus disclosure in web/tests/frontend/components/dashboard/workspace-shell-recruiter-header.test.tsx (FR-001–FR-002, FR-012–FR-013, FR-015, FR-029–FR-032; SC-006, SC-008, SC-010)

### Foundation Implementation

- [X] T012 Implement strict Zod schemas, inferred discriminated types, safe error schemas, destination allowlists, and identifier-free validation in web/src/shared/contracts/recruiter-header-status.ts (FR-003, FR-008–FR-012, FR-016–FR-019; SC-001, SC-007)
- [X] T013 [P] Define the server-only RecruiterHeaderStatusRepositoryPort with qualifying-membership and latest-verification-state operations returning no persistence identifiers in web/src/backend/recruiter-header/recruiter-header-status-repository.ts (FR-003–FR-007, FR-018, FR-034–FR-035; SC-001, SC-007)
- [X] T014 Implement PrismaRecruiterHeaderStatusRepository as the sole feature Prisma importer with bounded account-scoped existence/latest-row queries, deterministic ordering, minimal selection, and no writes in web/src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts (FR-003–FR-007, FR-018, FR-034–FR-035; SC-001, SC-007)
- [X] T015 [P] Implement the pure server-only exact Candidate-host predicate using the configured Candidate origin, normalized Host comparison, and false results for missing or malformed values without reading session or status dependencies in web/src/backend/auth/candidate-host-boundary.ts (FR-016–FR-020; SC-007–SC-008)
- [X] T016 Implement server initial-projection adoption without a mount-triggered request, strict response parsing, visible-only 30-second polling, focus/visibility refresh, single-flight requests, abort/stale-result protection, preserved revalidation state, and unavailable fallback in web/src/frontend/features/recruiter-header/client/use-recruiter-header-status.ts (FR-012–FR-015, FR-019, FR-022; SC-003, SC-008–SC-009)
- [X] T017 [P] Implement the bounded in-memory opening adapter and lock lifecycle for only the server-approved destination with pathname, pageshow, focus, and visibility recovery, without choosing destinations, constructing recruiter routes, selecting workspaces, tracking destination progress, changing authorization, or animating transitions in web/src/frontend/features/recruiter-header/client/use-recruiter-header-navigation.ts (FR-019–FR-024, FR-036; SC-005)
- [X] T018 Build the recruiter action shell with reserved loading/unavailable role=status placeholder, polite checking announcement, stable data-state hooks, no confirmed label/destination, and activation suppression while busy in web/src/frontend/features/recruiter-header/components/recruiter-header-action.tsx (FR-012–FR-015, FR-021–FR-024; SC-005–SC-006, SC-008)
- [X] T019 Add optional initialRecruiterStatus composition after the existing profile link and expose complete name/email through the profile accessible description and hover/focus disclosure without changing its destination or target in web/src/frontend/features/dashboard/components/workspace-shell.tsx (FR-001–FR-002, FR-015, FR-029–FR-032; SC-006, SC-010)
- [X] T020 [P] Apply the shared exact Candidate-host predicate in the workspace layout and return the neutral not-found outcome before getWorkspaceContext so rejected initial requests cannot read session, profile, or recruiter status data in web/src/app/(workspace)/layout.tsx (FR-016–FR-020; SC-007–SC-008)
- [X] T021 Add non-wrapping action-group foundations, reserved placeholder dimensions, 40-by-40 minimum targets, focus-visible treatment, independent profile ellipsis, and token-based light/dark state hooks in web/src/frontend/styles/workspace.css (FR-002, FR-012, FR-015, FR-021–FR-022, FR-025–FR-033; SC-004, SC-006)

**Checkpoint**: The Candidate header renders theme, profile, and a safe non-actionable placeholder in the required order; shared contract, repository, polling, navigation, composition, and architecture tests pass.

---

## Phase 3: User Story 1 — Candidate Who Has Never Applied (Priority: P1) — Technical MVP

**Goal**: Derive NEVER_APPLIED, display an enabled primary Post a Job action, and open the existing Employer Verification destination exactly once.

**Independent Test**: Sign in with no qualifying membership and with each never-applied-equivalent history; verify a no-store projection and an enabled Post a Job action that opens /dashboard/employer-verification once through click, tap, Enter, and Space.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementation.

- [X] T022 [P] [US1] Add table-driven service tests for no request, CANCELLED, EXPIRED, stale APPROVED without entitlement, membership precedence inputs, exact destination, and deterministic observation time using an injected fake repository in web/tests/backend/unit/recruiter-header/status-service.test.ts (FR-003–FR-004, FR-007–FR-008, FR-034; SC-001)
- [X] T023 [P] [US1] Extend route contract tests for authenticated NEVER_APPLIED, exact Employer Verification href, strict response validation, no-store success, safe 401/503 handling, and identifier-free output in web/tests/backend/contract/recruiter-header/header-status.contract.test.ts (FR-007–FR-008, FR-013, FR-017–FR-020; SC-001, SC-007–SC-008)
- [X] T024 [P] [US1] Add action tests for the exact Post a Job label, never-applied state hook, Employer Verification destination, click/tap/Enter/Space parity, busy dimension preservation, duplicate suppression, and retry after failed or cancelled navigation in web/tests/frontend/components/recruiter-header/recruiter-header-action.test.tsx (FR-008, FR-020–FR-024; SC-001, SC-005)
- [X] T025 [P] [US1] Extend repository integration tests for no request, CANCELLED, EXPIRED, stale APPROVED, deterministic tied histories, account isolation, query failure, and zero writes in web/tests/backend/integration/recruiter-header/status-projection.test.ts (FR-003, FR-007, FR-013, FR-018, FR-034–FR-035; SC-001, SC-007–SC-008)

### Implementation for User Story 1

- [X] T026 [US1] Implement the injected server-only RecruiterHeaderStatusService with entitlement-first evaluation, NEVER_APPLIED mapping for no request and terminal or stale-approved histories, allowlisted Employer Verification destination, and no Prisma/presentation dependency in web/src/backend/recruiter-header/recruiter-header-status-service.ts (FR-003–FR-004, FR-007–FR-008, FR-018, FR-034–FR-035; SC-001, SC-007)
- [X] T027 [US1] Implement GET /api/recruiter/header-status with the shared exact Candidate-host predicate before requireSession, existing Better Auth validation, shared service reuse, strict output parsing, no-store on 200/401/404/503, neutral UNAVAILABLE and STATUS_UNAVAILABLE errors, and no identifiers in web/src/app/api/recruiter/header-status/route.ts (FR-008, FR-013, FR-016–FR-020, FR-034–FR-035; SC-001, SC-007–SC-008)
- [X] T028 [US1] Resolve the best-effort initial projection only after existing session validation, inject the same repository/service path as the route, and isolate status-read failure from safe profile/workspace loading in web/src/backend/auth/get-workspace-context.ts (FR-001, FR-013, FR-017–FR-020, FR-034; SC-007–SC-008, SC-010)
- [X] T029 [US1] Pass the initial projection from the authenticated server workspace context into WorkspaceShell without creating a client credential or persistent cache in web/src/app/(workspace)/layout.tsx (FR-001, FR-013, FR-017, FR-019; SC-008, SC-010)
- [X] T030 [US1] Add the NEVER_APPLIED label, primary presentation mapping, Employer Verification activation, status and navigation hook integration, one-shot lock, and retry behavior in web/src/frontend/features/recruiter-header/components/recruiter-header-action.tsx (FR-008, FR-014–FR-015, FR-020–FR-024; SC-001, SC-003, SC-005, SC-009)
- [X] T031 [US1] Add never-applied primary default, hover, active, focus-visible, revalidating, navigating, and unavailable styles with stable dimensions and non-color cues in both themes in web/src/frontend/styles/workspace.css (FR-008, FR-015, FR-021–FR-022, FR-031; SC-004, SC-006)

**Checkpoint**: User Story 1 works end to end and can be tested independently. It is the technical MVP checkpoint, not a releasable Group 1 scope by itself.

---

## Phase 4: User Story 2 — Applicant Awaiting Review (Priority: P1)

**Goal**: Derive PENDING_REVIEW and show Application Under Review as a focusable, semantically unavailable, completely non-activating status control.

**Independent Test**: For PENDING_CHECKS, PENDING_REVIEW, CHANGES_REQUESTED, and RESUBMITTED without current entitlement, verify the exact label remains in the Tab order, is announced unavailable, and performs no click, tap, Enter, or Space action.

### Tests for User Story 2

> Write these tests first and confirm they fail before implementation.

- [X] T032 [P] [US2] Extend table-driven service tests for all four pending-family lifecycle states, NONE/null destination invariants, and account-scoped inputs in web/tests/backend/unit/recruiter-header/status-service.test.ts (FR-003, FR-005, FR-009, FR-034; SC-001)
- [X] T033 [P] [US2] Add component tests for the exact Application Under Review label, aria-disabled semantics, Tab focus, unchanged hover, no pressed state, and zero click/tap/Enter/Space activation in web/tests/frontend/components/recruiter-header/recruiter-header-action.test.tsx (FR-009, FR-021, FR-024; SC-001, SC-005–SC-006)
- [X] T034 [P] [US2] Add light/dark accessibility tests for pending focus visibility, disabled announcement, non-color cue, decorative icon treatment, keyboard order, and zero serious or critical axe findings in web/tests/frontend/accessibility/recruiter-header/recruiter-header-action.accessibility.test.tsx (FR-002, FR-009, FR-021, FR-031; SC-006)

### Implementation for User Story 2

- [X] T035 [US2] Add PENDING_CHECKS, PENDING_REVIEW, CHANGES_REQUESTED, and RESUBMITTED mapping to PENDING_REVIEW with NONE/null destination after entitlement precedence in web/src/backend/recruiter-header/recruiter-header-status-service.ts (FR-003–FR-005, FR-009, FR-034; SC-001)
- [X] T036 [US2] Implement the exact Application Under Review mapping as a focusable aria-disabled control with pointer, touch, Enter, and Space guards and no navigation adapter call in web/src/frontend/features/recruiter-header/components/recruiter-header-action.tsx (FR-009, FR-020–FR-024; SC-001, SC-005–SC-006)
- [X] T037 [US2] Add neutral pending default, focus-visible, and disabled styling with no hover, pressed, elevation, or pointer affordance and with a text/icon non-color cue in web/src/frontend/styles/workspace.css (FR-009, FR-021–FR-022, FR-031; SC-006)

**Checkpoint**: User Story 2 independently communicates every in-review state without offering or triggering another application path.

---

## Phase 5: User Story 3 — Rejected Applicant (Priority: P1)

**Goal**: Derive REJECTED, display Reapply as Recruiter as an enabled secondary action, and open Employer Verification exactly once.

**Independent Test**: With a latest rejected request and no current entitlement, verify the exact outlined label and one Employer Verification opening through click, tap, Enter, and Space, including retry after an unsuccessful attempt.

### Tests for User Story 3

> Write these tests first and confirm they fail before implementation.

- [X] T038 [P] [US3] Extend service tests for latest REJECTED mapping, entitlement precedence, exact Employer Verification destination, and identifier-free projection in web/tests/backend/unit/recruiter-header/status-service.test.ts (FR-003–FR-004, FR-006, FR-010, FR-018, FR-034; SC-001, SC-007)
- [X] T039 [P] [US3] Add component tests for the exact Reapply as Recruiter label, secondary state hook, click/tap/Enter/Space parity, busy preservation, duplicate suppression, and failed/cancelled navigation retry in web/tests/frontend/components/recruiter-header/recruiter-header-action.test.tsx (FR-010, FR-020–FR-024; SC-001, SC-005)

### Implementation for User Story 3

- [X] T040 [US3] Add the REJECTED service branch with the allowlisted Candidate Employer Verification destination after entitlement precedence in web/src/backend/recruiter-header/recruiter-header-status-service.ts (FR-003–FR-004, FR-006, FR-010, FR-018, FR-034; SC-001, SC-007)
- [X] T041 [US3] Implement the rejected label, secondary presentation mapping, safe Employer Verification activation, one-shot navigation lock, and retry behavior in web/src/frontend/features/recruiter-header/components/recruiter-header-action.tsx (FR-010, FR-020–FR-024; SC-001, SC-005)
- [X] T042 [US3] Add secondary outlined default, hover, active, focus-visible, revalidating, navigating, and disabled styles with a complete one-line label in both themes in web/src/frontend/styles/workspace.css (FR-010, FR-021–FR-022, FR-031, FR-033; SC-004, SC-006)

**Checkpoint**: User Story 3 independently exposes a safe reapplication entry point without implementing application content or submission.

---

## Phase 6: User Story 4 — Approved Recruiter (Priority: P1)

**Goal**: Give current active recruiter entitlement precedence, display an enabled primary Post a Job action, and hand off once to the exact configured Recruiter origin without implementing Group 2 mechanics.

**Independent Test**: Exercise active, suspended, removed, inactive-company, multi-company, cross-account, and stale-approved histories; only an ACTIVE membership in an ACTIVE verified company produces APPROVED and one exact-origin handoff.

### Tests for User Story 4

> Write these tests first and confirm they fail before implementation.

- [X] T043 [P] [US4] Extend service tests for qualifying membership precedence over every request state, denial of stale approval, and exact configured Recruiter-origin output using injected repository/origin dependencies in web/tests/backend/unit/recruiter-header/status-service.test.ts (FR-003–FR-004, FR-011, FR-018, FR-020, FR-034; SC-001, SC-007)
- [X] T044 [P] [US4] Extend Prisma repository integration tests for ACTIVE company/membership qualification, suspended or removed membership denial, inactive-company denial, multi-company and cross-account isolation, minimal selection, and zero writes in web/tests/backend/integration/recruiter-header/status-projection.test.ts (FR-004, FR-018, FR-034–FR-035; SC-001, SC-007)
- [X] T045 [P] [US4] Extend route contract tests for APPROVED projection, exact configured Recruiter origin, Candidate-host-only disclosure, destination allowlisting, no-store response, and no authority-bearing identifiers in web/tests/backend/contract/recruiter-header/header-status.contract.test.ts (FR-011, FR-016–FR-020, FR-034; SC-001, SC-007)
- [X] T046 [P] [US4] Add component tests for approved Post a Job, exact-origin external opening, click/tap/Enter/Space parity, duplicate suppression, synchronous-failure recovery, pageshow restoration, and focus/visibility return in web/tests/frontend/components/recruiter-header/recruiter-header-action.test.tsx (FR-011, FR-020–FR-024; SC-001, SC-005)

### Implementation for User Story 4

- [X] T047 [US4] Add qualifying active-membership precedence and APPROVED mapping with the exact server-configured Recruiter origin, never historical request approval alone, in web/src/backend/recruiter-header/recruiter-header-status-service.ts (FR-003–FR-004, FR-011, FR-018, FR-020, FR-034; SC-001, SC-007)
- [X] T048 [US4] Implement the approved primary mapping and one-shot request to open only the server-approved destination with in-memory failure/return recovery while excluding destination selection/content/progress, authorization changes, route construction, workspace selection, switch animation, and job-post creation in web/src/frontend/features/recruiter-header/components/recruiter-header-action.tsx (FR-011, FR-019–FR-024, FR-036; SC-001, SC-005)

**Checkpoint**: User Story 4 independently distinguishes current entitlement from stale approval and reaches only the existing Recruiter-origin boundary.

---

## Phase 7: Polish, Regression, and Cross-Cutting Release Gates

**Purpose**: Prove the integrated four-state header satisfies the complete API/UI contracts, session and host boundaries, responsive and accessibility rules, privacy constraints, performance thresholds, regression expectations, usability outcome, and Group 1 exclusions.

- [X] T049 [P] Complete OpenAPI/runtime parity coverage for all four success projections, all three safe errors, additionalProperties rejection, exact-host ordering, no-store on every outcome, and destination allowlists in web/tests/backend/contract/recruiter-header/header-status.contract.test.ts (FR-003, FR-008–FR-018; SC-001, SC-007–SC-008)
- [X] T050 [P] Complete light/dark axe and keyboard coverage for every state and busy/placeholder variant, focus order, visible focus, non-color cues, decorative icons, profile full-value disclosure, and zero serious or critical findings in web/tests/frontend/accessibility/recruiter-header/recruiter-header-action.accessibility.test.tsx (FR-002, FR-009, FR-012, FR-021–FR-022, FR-029–FR-031; SC-005–SC-006)
- [ ] T051 [P] Add Playwright coverage at 1440, 1024, 1023, 761, 760, 479, and 320 CSS px plus 200 percent text zoom for exact order, spacing, insets, profile visibility/truncation/disclosure, full labels, fallback avatar, search separation, contained row scrolling, themes, and no document overflow in web/tests/system/e2e/recruiter-header/header-layout.spec.ts (FR-001–FR-002, FR-015, FR-021, FR-025–FR-033; SC-004, SC-006, SC-010)
- [X] T052 Finalize desktop, tablet, mobile, and very-narrow rules including 12/8 px gaps, 24/16 px insets, 220/120 px profile limits, mobile 48 px avatar with visible name/email, full one-line action labels, search separation, and action-row-only horizontal overflow in web/src/frontend/styles/workspace.css (FR-002, FR-015, FR-021, FR-025–FR-033; SC-004, SC-006)
- [X] T053 [P] Add privacy and host canaries proving rejected initial pages and route requests expose only neutral unavailable outcomes before session/status access; accepted responses, DOM, URLs, browser storage, analytics, and ordinary logs contain no prohibited identifier or submitted business field; and the header grants no authority in web/tests/security/recruiter-header/recruiter-header-privacy.test.ts (FR-016–FR-020, FR-034–FR-036; SC-007–SC-008)
- [X] T054 [P] Create a machine-readable measurement harness that validates at least 100 accounts with 25 per confirmed state; runs exactly 20 warm-ups plus 200 measured authenticated page loads and exactly 20 warm-ups plus 200 measured refresh opportunities at 20 concurrent Candidate sessions; measures page load from authenticated navigation start through the first frame with operable theme/profile controls and a visible confirmed-action or safe-placeholder footprint; requires every refresh to change to a result with a different label or availability; records exactly 50 refresh results per state, 66 or 67 per interval/focus/visibility trigger, and 16 or 17 per trigger-result cell; measures refresh from accepted eligible opportunity through the first frame with expected label/availability; and separately records HTTP duration, environment, dataset/database state, method, nearest-rank P50/P95/P99/max, errors, external conditions, cadence, and overlap in web/scripts/measure-recruiter-header-performance.mjs (FR-014–FR-015, FR-022; SC-002–SC-003, SC-009)
- [X] T055 Add threshold validation that rejects missing metadata or rendered-frame boundaries, fewer than 100 accounts or 25 per state, warm-up or measured counts other than exactly 20 and 200 per measurement, concurrency other than 20, any refresh sample without a visible label/availability change, result-state counts other than 50, trigger counts other than 66 or 67, trigger-result-cell counts other than 16 or 17, non-nearest-rank percentiles, Candidate page-load P95 above 3 seconds, accepted-refresh-to-visible-update P95 above 2 seconds, unplanned errors above 0.5 percent, interval reads more frequent than 30 seconds, overlap, or any failed authorization/privacy/host/state correctness gate in web/tests/performance/recruiter-header/release-thresholds.test.ts (FR-014–FR-015, FR-022; SC-001–SC-003, SC-007, SC-009)
- [X] T056 [P] Add recruiter-header session-boundary regressions for expired, idle-expired, absolute-expired, revoked, logged-out, password-reset-revoked, recovery-blocked, and inactive-account sessions plus absence of any second credential mechanism in web/tests/backend/integration/recruiter-header/session-boundary.test.ts (FR-017, FR-019–FR-020; SC-007–SC-008, SC-010)
- [X] T057 Run typecheck, lint, format, focused shared/backend/frontend/architecture/accessibility/privacy Vitest suites, and database validation/status checks from quickstart.md and record commands, environment, and results in spec-kit/specs/007-job-posting-management/release-validation.md (FR-001–FR-036; SC-001, SC-005–SC-010)
- [ ] T058 Run recruiter-header Playwright and the fixed at-least-100-account, 20-concurrent, exactly-20-warm-up, exactly-200-sample page/visible-refresh gates with the required rendered-frame boundaries and 50-result/66-or-67-trigger/16-or-17-cell refresh quotas, plus existing admin-management, profile-account, and job-board regression suites; record responsive, zoom, P50/P95/P99/max, error, host/privacy/state, quota, timing-boundary, and regression evidence in spec-kit/specs/007-job-posting-management/release-validation.md (FR-001–FR-002, FR-014–FR-015, FR-021, FR-025–FR-033; SC-001–SC-004, SC-006–SC-010)
- [ ] T059 Conduct the final integrated five-second identification study with exactly 20 uncoached participants who used an online job-search/application service in the previous 12 months, can use the product language under test, did not implement or review this feature, and have not seen the study materials; include 10 primarily mobile and 10 primarily desktop/laptop job seekers, assign exactly five to each confirmed state, record only eligibility result/device cohort/assignment/raw elapsed time/both answers/pass-fail, and require at least 18 of 20 correct outcomes in spec-kit/specs/007-job-posting-management/usability-validation.md (FR-008–FR-012, FR-021; SC-011)
- [ ] T060 Audit the final diff for zero Prisma schema/migration changes, business writes, new recruiter-header audit events, notifications, destination selection/content/progress, authorization changes, route construction, workspace selection/switch animation, or job-post creation while preserving existing session-policy auditing; execute four-state manual acceptance and rollback checks and record the scope boundary in spec-kit/specs/007-job-posting-management/release-validation.md (FR-003, FR-019–FR-020, FR-034–FR-036; SC-001, SC-007–SC-010)

**Final Checkpoint**: All four P1 stories, exact host and session boundaries, responsive widths, 200 percent zoom, both themes, all activation methods, privacy checks, performance thresholds, usability outcome, and existing-workspace regressions pass with no excluded workflow entering Group 1.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; T001 and T002 can start immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks story implementation. Tests T003–T011 precede implementation T012–T021; T015 and T020 establish the shared initial-render host boundary before any story projection is wired.
- **Phase 3 — US1**: Depends on Phase 2 and establishes the first complete service/route/context/UI vertical slice.
- **Phases 4–6 — US2, US3, US4**: Their test tasks can begin after Phase 2; implementation reuses the US1 service, route, and action shell and therefore follows T026–T031.
- **Phase 7 — Release gates**: Depends on all four stories. T049–T056 proceed in their stated dependency groups, T057–T058 record automated evidence, T059 follows the completed integrated UI and final responsive styling in T052, and T060 closes the release audit.

### User Story Dependency Graph

~~~text
Setup -> Foundation -> US1 technical vertical slice
                    |-> US2 tests -> US2 implementation --+
                    |-> US3 tests -> US3 implementation --+-> Release gates
                    +-> US4 tests -> US4 implementation --+
~~~

### User Story Dependencies

- **US1 — Never Applied**: Starts after Foundation; no other story dependency.
- **US2 — Pending Review**: Tests start after Foundation; implementation depends on the shared US1 service/action vertical slice, but its pending matrix remains independently verifiable.
- **US3 — Rejected**: Tests start after Foundation; implementation depends on the shared US1 service/action vertical slice, but its rejected path remains independently verifiable.
- **US4 — Approved Recruiter**: Tests start after Foundation; implementation depends on the shared US1 service/action vertical slice, but its entitlement matrix remains independently verifiable.

### Within Each User Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Complete repository/contract prerequisites before service mapping.
3. Complete service mapping before route or presentation reliance.
4. Complete component behavior before final state-specific styling.
5. Pass the independent test before treating the story checkpoint as complete.
6. Preserve the exact-host check, existing Better Auth boundary, destination reauthorization, identifier-free contract, and zero-write rule in every increment.

### Requirement-to-Task Traceability

| Requirement or outcome | Primary task coverage |
|---|---|
| FR-001–FR-002 global placement and order | T011, T019, T028–T029, T051–T052, T057–T058 |
| FR-003–FR-007 and FR-034 deterministic account-scoped projection | T002–T005, T012–T014, T022, T025–T026, T032, T035, T038, T040, T043–T047 |
| FR-008–FR-011 labels and destinations | T003, T022–T024, T026–T027, T030–T033, T035–T036, T038–T041, T043–T049 |
| FR-012–FR-015 loading, isolation, and refresh | T009, T011–T012, T016, T018, T028–T031, T049, T054–T055 |
| FR-016–FR-020 host, session, privacy, and destination authority | T003–T004, T006–T008, T012, T015, T017, T020, T023, T026–T030, T038–T041, T043–T049, T053, T056–T057, T060 |
| FR-021–FR-024 accessibility, busy state, recovery, activation parity | T010, T017–T018, T021, T024, T030–T037, T039–T042, T046, T048, T050–T052 |
| FR-025–FR-033 responsive layout and profile/theme/search preservation | T011, T019, T021, T031, T034, T037, T042, T050–T052, T058 |
| FR-035–FR-036 read-only scope exclusions | T004–T005, T013–T014, T017, T026–T027, T048, T053, T060 |
| SC-001 four-state correctness | T002–T005, T012–T014, T022–T049, T055, T057–T060 |
| SC-002–SC-003 latency outcomes | T054–T055, T058 |
| SC-004 responsive and zoom outcome | T021, T031, T042, T051–T052, T058 |
| SC-005 activation outcome | T010, T017–T018, T024, T030, T033, T036, T039, T041, T046, T048, T050, T057 |
| SC-006 accessibility outcome | T011, T018–T021, T031, T033–T034, T037, T042, T050–T052, T057–T058 |
| SC-007 privacy outcome | T003–T008, T012–T015, T020, T022–T029, T038, T040, T043–T049, T053, T055–T057, T060 |
| SC-008 failure isolation outcome | T006–T009, T011, T015–T016, T018, T020, T023, T027–T030, T049, T053, T056–T057, T060 |
| SC-009 polling outcome | T009, T016, T030, T054–T055, T058 |
| SC-010 regression outcome | T004, T007, T011, T019–T020, T028–T029, T051, T056–T058, T060 |
| SC-011 five-second identification outcome | T059 |

---

## Parallel Opportunities

- T001 and T002 can run together because package commands and fixtures use different files.
- Foundation tests T003–T011 can be authored concurrently; T012, T013, and T015 can also run together before their dependent repository, UI, and layout integration.
- US1 tests T022–T025 can run together before the vertical-slice implementation.
- After Foundation, US2 tests T032–T034, US3 tests T038–T039, and US4 tests T043–T046 can be authored concurrently.
- Final contract, accessibility, browser, privacy, measurement-harness, and session-boundary work at T049–T051, T053–T054, and T056 uses separate files and can proceed concurrently after the four stories. T059 deliberately waits for the completed integrated UI and T052 styling.
- Tasks that edit recruiter-header-status-service.ts, recruiter-header-action.tsx, workspace.css, or release-validation.md must follow task order or use coordinated non-overlapping changes.

### Parallel Example: User Story 1

- T022: service mapping tests
- T023: route contract tests
- T024: action interaction tests
- T025: repository integration cases

### Parallel Example: User Story 2

- T032: pending-family service tests
- T033: pending component tests
- T034: pending accessibility tests

### Parallel Example: User Story 3

- T038: rejected service tests
- T039: rejected component tests

### Parallel Example: User Story 4

- T043: entitlement-precedence service tests
- T044: Prisma membership integration tests
- T045: approved route contract tests
- T046: approved handoff component tests

---

## Implementation Strategy

### Technical MVP First

1. Complete Phase 1.
2. Complete Phase 2; it blocks all story implementation.
3. Complete Phase 3 for the never-applied vertical slice.
4. Stop and run the US1 independent test.
5. Treat US1 as a technical demonstration only; all four P1 stories and applicable release gates are required before Group 1 is releasable.

### Incremental Delivery

1. Setup plus Foundation produces a safe placeholder and bounded architecture.
2. US1 adds the never-applied application entry point.
3. US2 adds non-activating pending communication.
4. US3 adds the reapplication entry point.
5. US4 adds current-entitlement recruiter-origin handoff.
6. Phase 7 verifies the complete releasable scope without introducing destination workflows.

### Parallel Team Strategy

1. Complete Setup first, then complete Foundation; parallelize only the tasks explicitly marked [P] within each phase.
2. Author US1–US4 tests in parallel after the Foundation.
3. Land the US1 shared vertical slice.
4. Integrate US2, US3, and US4 mappings in task order where they touch shared files.
5. Run independent story checks, then the cross-cutting release gates.

---

## Notes

- [P] tasks operate on different files and have no dependency on incomplete tasks.
- User-story labels appear only in story phases.
- Tests must be written first and must fail for the intended missing behavior before implementation.
- No task authorizes a dependency addition, Prisma schema change, migration, business write, new audit/notification, alternate browser credential, or downstream Group 2/job-post workflow.
- Commit after each task or coherent task group if the optional git extension hook is chosen.
