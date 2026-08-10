---
description: "Dependency-ordered implementation tasks for Feature 006 administration management"
---

# Tasks: Platform Administration and Employer Verification

**Input**: Design documents from `spec-kit/specs/006-admin-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`

**Tests**: Test tasks are mandatory for this feature because the approved
specification defines 56 Acceptance Scenarios and 18 measurable Success
Criteria, including hard authorization, privacy, concurrency, accessibility,
performance, and deadline outcomes.

**Organization**: Tasks are grouped by user story. Each story phase produces an
independently testable increment; release still requires the complete selected
scope and all applicable constitutional gates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel with adjacent marked tasks because it changes
  different files and has no dependency on their incomplete work.
- **[Story]**: Maps the task to one approved user story.
- Every task names the exact implementation or test file it must create or
  update.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the fixed React Admin dependency, feature entry points, local
configuration, and runnable command scaffolding without exposing any admin
capability.

- [X] T001 Pin React Admin 5.15.1 and compatible MUI, Emotion, and React Router peers in `web/package.json` and `package-lock.json`
- [X] T002 [P] Create backend, frontend, shared-contract, and test boundary exports in `web/src/backend/admin/index.ts`, `web/src/frontend/features/admin/index.ts`, `web/src/shared/contracts/admin/index.ts`, and `web/tests/fixtures/admin-management/index.ts`
- [X] T003 [P] Add exact Candidate/Admin/Recruiter origin, evidence storage, scanner, worker, encryption, retention, and notification configuration parsing in `web/src/backend/admin/config.ts` and client-safe admin-origin parsing in `web/src/frontend/env/client.ts` (FR-003, FR-027, FR-054)
- [X] T004 [P] Add OpenAPI-to-runtime/client contract generation and drift checking in `web/scripts/generate-admin-contracts.mjs` and `web/src/shared/contracts/admin/generated.ts`
- [X] T005 Add the admin worker entry/probe and register only the `admin:worker` and `admin:worker:probe` commands in `web/scripts/run-admin-worker.mjs`, `web/scripts/check-admin-worker.mjs`, `web/package.json`, and root `package.json`
- [X] T006 [P] Add deterministic Feature 006 fixture builders for accounts, grants, sessions, companies, memberships, verification requests, reports, and notification failures in `web/tests/fixtures/admin-management/fixtures.ts`
- [X] T007 [P] Add the isolated admin-worker container and private evidence volume/service wiring in `Dockerfile.admin-worker` and `compose.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared persistence, contracts, server trust boundaries,
privacy-safe command infrastructure, React Admin adapters, and worker runtime
required by every user story.

**Critical**: No user-story implementation begins until this phase passes its
migration, contract, authorization-boundary, and architecture tests.

### Tests for the Foundation

> Write these tests first and confirm they fail for the missing foundation.

- [X] T008 [P] Add OpenAPI, runtime-schema, and React Admin provider parity tests that reject unknown fields and unsupported generic CRUD in `web/tests/backend/contract/admin-management/admin-contract-parity.test.ts` (FR-005, FR-059)
- [X] T009 [P] Add migration integrity and rollback-safety tests covering existing Session, Candidate, membership, application, JobReport, and audit data in `web/tests/backend/integration/admin-management/admin-migration-integrity.test.ts` (FR-001, FR-038, FR-046, FR-061)
- [X] T010 [P] Add architecture tests prohibiting browser/provider imports of Prisma, Better Auth internals, storage, scanner, mail, repositories, and business services; prove MUI/global resets remain inside the admin subtree and the primary Tailwind/shadcn baseline remains unchanged in `web/tests/architecture/admin-management-boundaries.test.ts` (FR-005, FR-060, FR-061)
- [X] T011 [P] Add the direct-route trust-boundary matrix for exact host/origin, Fetch Metadata, CSRF, account, grant, designated session, factor proof, target availability, and non-enumerating denials in `web/tests/security/admin-management/admin-request-boundary.test.ts` (FR-003–FR-006, FR-054)

### Foundation Implementation

- [X] T012 Create shared enums, projection schemas, list/query envelopes, command inputs, safe errors, normalization functions, and state-definition versions in `web/src/shared/contracts/admin/common.ts`, `web/src/shared/contracts/admin/resources.ts`, and `web/src/shared/contracts/admin/commands.ts` (FR-013–FR-022, FR-025, FR-028, FR-031, FR-038–FR-059)
- [X] T013 Extend the authoritative Prisma model with PlatformAdministratorGrant, AdministratorSessionPolicy, Company verification/tax fields, versioned CompanyMembership REMOVED state, verification/evidence entities, moderation entities, rationale, command receipt, SecurityNotificationWork, verification lifecycle relations to the existing EmailOutbox, and dashboard snapshot in `web/prisma/schema.prisma` (FR-001, FR-020–FR-022, FR-024–FR-058, FR-062)
- [X] T014 Create the additive schema/data migration, indexes, partial uniqueness rules including verification-event EmailOutbox idempotency, legacy JobReport category mapping, and reversible verification checks in `web/prisma/migrations/20260810090000_admin_management/migration.sql` (FR-034, FR-035, FR-037, FR-046, FR-048, FR-058, FR-061)
- [X] T015 [P] Implement the transaction/version/idempotency repository primitives and safe conflict results in `web/src/backend/repositories/admin/prisma-admin-command-repository.ts` (FR-020, FR-034, FR-045, FR-052, FR-058)
- [X] T016 [P] Extend typed audit action/context allowlists and implement the fail-closed AuditWriter in `web/src/backend/audit/events.ts` and `web/src/backend/admin/audit/audit-writer.ts` (FR-008, FR-021, FR-036, FR-045, FR-052, FR-058)
- [X] T017 [P] Implement encrypted PrivilegedActionRationale persistence, fresh-proof reads, exact inaccessibility, and deletion claims in `web/src/backend/admin/rationales/privileged-rationale-service.ts` and `web/src/backend/repositories/admin/prisma-privileged-rationale-repository.ts` (FR-016, FR-018, FR-019, FR-021, FR-039–FR-041)
- [X] T018 [P] Implement durable SecurityNotificationWork persistence, exact retry classification/schedule, leasing, manual-intervention transition, and non-rollback behavior only for FR-022 access notifications in `web/src/backend/admin/notifications/security-notification-dispatcher.ts` and `web/src/backend/repositories/admin/prisma-security-notification-repository.ts` (FR-022, FR-058)
- [X] T019 Implement AdminRequestBoundary with exact host/origin, same-origin/CSRF, current account/grant/session/designation, fresh-step-up, and non-enumerating failure enforcement in `web/src/backend/security/admin-request-boundary.ts` (FR-003–FR-006, FR-008, FR-060, FR-062)
- [X] T020 Implement exact-host routing and startup fail-closed validation for Candidate, Admin, and Recruiter shells in `web/src/proxy.ts` and `web/src/backend/admin/origins.ts` (FR-003, FR-054)
- [X] T021 [P] Add common admin Route Handler parsing, projection validation, no-store headers, error mapping, correlation, and command-header helpers in `web/src/backend/admin/http/admin-route.ts` (FR-005, FR-006, FR-059, FR-060)
- [X] T022 [P] Implement closed-surface React Admin auth/data provider bases, memory-only store, zero-retention QueryClient, CSRF binding, safe error mapping, and cache purge in `web/src/frontend/features/admin/app/auth-provider.ts`, `web/src/frontend/features/admin/app/data-provider.ts`, and `web/src/frontend/features/admin/app/query-client.ts` (FR-004–FR-006, FR-020, FR-059, FR-060)
- [X] T023 Implement the client-only React Admin shell after T022, contain the MUI theme/reset inside the admin mount, preserve the primary Tailwind/shadcn baseline, register closed resources, and add accessible layout/status/loading/empty/error states in `web/src/frontend/features/admin/app/admin-app.tsx`, `web/src/frontend/features/admin/layout/admin-layout.tsx`, and `web/src/frontend/features/admin/shared/safe-status-field.tsx` (FR-001, FR-007, FR-038, FR-059, FR-060)
- [X] T024 [P] Implement separately leased snapshot, evidence, verification-deadline, notification, and retention loops with isolated readiness in `web/src/backend/admin/workers/admin-worker-runtime.ts` and `web/src/backend/admin/workers/admin-worker-entry.ts` (FR-010, FR-021, FR-022, FR-026–FR-028, FR-058)
- [X] T025 Add controlled Feature 006 data provisioning with no browser grant path in `web/scripts/provision-platform-administrator.mjs` and `web/tests/fixtures/admin-management/seed.ts` (FR-002, FR-009)

**Checkpoint**: Migrations apply safely; shared contract and boundary tests fail
closed; React Admin has no generic privileged CRUD surface; the worker can start
with all loops independently observable.

---

## Phase 3: User Story 1 - Enter the Protected Administration Console (Priority: P1)

**Goal**: Admit only an ACTIVE account with an ACTIVE Platform Administrator
grant, the sole designated Better Auth session, and completed two-factor proof;
preserve Candidate/company permissions independently.

**Independent Test**: Visit and directly call the admin origin as every approved
allowed/denied actor, replace the designated session from a second browser, and
cross the 15-minute step-up boundary; only the fully authorized designated
session may see console content and failed proof changes no business state.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementation.

- [X] T026 [P] [US1] Add auth-context/login/two-factor/step-up/logout contract tests with zero token/permission persistence in `web/tests/backend/contract/admin-management/admin-auth.contract.test.ts` (US1-AS1–AS7, FR-004–FR-006)
- [X] T027 [P] [US1] Add account/grant/session/factor and immediate authority-change integration matrix in `web/tests/backend/integration/admin-management/admin-authorization-matrix.test.ts` (US1-AS1–AS5, SC-001)
- [X] T028 [P] [US1] Add barrier-synchronized two-device designation and 15-minute-plus-1-second step-up tests in `web/tests/backend/integration/admin-management/admin-session-policy.test.ts` (US1-AS6–AS7, FR-004, FR-062, SC-015, SC-016)
- [X] T029 [P] [US1] Add auth-provider/component behavior plus keyboard, focus, screen-reader naming, error, and memory-purge accessibility tests in `web/tests/frontend/components/admin-management/admin-auth.test.tsx` and `web/tests/frontend/accessibility/admin-management/admin-auth.accessibility.test.tsx` (FR-007, FR-060, SC-014)
- [ ] T030 [P] [US1] Add multi-context browser tests for exact admin origin, direct-route denial, session replacement, step-up, logout, Back/Forward, and Candidate/recruiter isolation in `web/tests/system/e2e/admin-management/admin-auth.spec.ts` (US1-AS1–AS7, SC-001, SC-015, SC-016)

### Implementation for User Story 1

- [X] T031 [P] [US1] Implement safe PlatformAdministratorGrant and AdministratorSessionPolicy queries/locks without public lifecycle mutations in `web/src/backend/repositories/admin/prisma-admin-authority-repository.ts` (FR-001, FR-002, FR-004, FR-009, FR-062)
- [X] T032 [US1] Implement initial two-factor designation, prior designated-session revocation, same-session step-up, and fresh-proof assertions over Better Auth Session in `web/src/backend/admin/authorization/administrator-session-service.ts` (FR-004, FR-008, FR-062)
- [X] T033 [US1] Implement admin auth context, login continuation, two-factor, step-up, and logout Route Handlers in `web/src/app/api/admin/auth/context/route.ts`, `web/src/app/api/admin/auth/login/route.ts`, `web/src/app/api/admin/auth/two-factor/route.ts`, `web/src/app/api/admin/auth/step-up/route.ts`, and `web/src/app/api/admin/auth/logout/route.ts` (FR-004–FR-006, FR-062)
- [X] T034 [US1] Complete the React Admin authProvider lifecycle and presentation-only access hints in `web/src/frontend/features/admin/app/auth-provider.ts` (FR-004–FR-006, FR-060)
- [X] T035 [P] [US1] Build AdminLoginPage, AdminTwoFactorPage, and reusable StepUpDialog without creating or storing a second browser credential in `web/src/frontend/features/admin/auth/admin-login-page.tsx`, `web/src/frontend/features/admin/auth/admin-two-factor-page.tsx`, and `web/src/frontend/features/admin/auth/step-up-dialog.tsx` (FR-004, FR-007)
- [X] T036 [P] [US1] Build AdminAuthorityGate with route-change revalidation and pre-render query/store purge on authority loss in `web/src/frontend/features/admin/auth/admin-authority-gate.tsx` (FR-005, FR-006, FR-008, FR-060)
- [X] T037 [US1] Mount the client-only console only behind the rewritten exact admin host and add a generic non-enumerating denial page in `web/src/app/(admin-console)/__admin/page.tsx` and `web/src/app/(admin-console)/__admin/unavailable/page.tsx` (FR-003, FR-006, FR-007)
- [X] T038 [US1] Record allowlisted admin access changes and denied privileged attempts without credentials or protected payloads in `web/src/backend/admin/authorization/admin-access-audit.ts` (FR-008, SC-013)
- [X] T039 [US1] Document audited ordinary bootstrap, suspension, revocation, expiry, and last-usable-admin prevention procedures while explicitly excluding emergency recovery and break-glass operations in `docs/runbooks/platform-administrator-grants.md` (FR-002, FR-009)

**Checkpoint**: User Story 1 is independently functional and satisfies the
exclusive-session and step-up trust boundary; it is a technical checkpoint, not
yet the complete releasable Feature 006 scope.

---

## Phase 4: User Story 2 - Understand Platform and Review Workload (Priority: P1)

**Goal**: Show correctly labelled periodic counts and deterministic current
drill-downs without confusing people, accounts, companies, memberships,
requests, or reports.

**Independent Test**: Seed overlapping Candidate identities, multi-company
memberships, lifecycle states, verification requests, and moderation reports;
verify the snapshot truth, age, units, filters, changed-source notice, ordering,
allowlisted rows, and performance target.

### Tests for User Story 2

> Write these tests first and confirm they fail before implementation.

- [X] T040 [P] [US2] Add golden metric/state-definition tests for overlapping identities, role/state units, queue totals, and canonical drill-down filters in `web/tests/backend/unit/admin-management/dashboard-definition.test.ts` (US2-AS1–AS5, FR-010–FR-012)
- [X] T041 [P] [US2] Add dashboard plus account/company/membership/verification/moderation list contract tests requiring current `calculatedAt`, shared `stateDefinitionVersion`, filter allowlists, row allowlists, page sizes, and deterministic order in `web/tests/backend/contract/admin-management/admin-dashboard-accounts.contract.test.ts` (US2-AS4–AS6, FR-010–FR-014)
- [X] T042 [P] [US2] Add changed-source, expired-snapshot, concurrent calculation, immediate-recalculation integration tests and dashboard/list component-state tests in `web/tests/backend/integration/admin-management/dashboard-snapshot.test.ts` and `web/tests/frontend/components/admin-management/admin-dashboard.test.tsx` (US2-AS1–AS6, SC-003)
- [X] T043 [P] [US2] Add the exact SC-002 dataset/concurrency/percentile/error harness in `web/tests/performance/admin-management/dashboard-performance.test.ts` and `web/scripts/measure-admin-management-performance.mjs` (SC-002)

### Implementation for User Story 2

- [X] T044 [P] [US2] Implement the single versioned DashboardDefinition and required calculation-metadata contract imported by snapshot, account, company, membership, verification, and moderation lists in `web/src/backend/admin/dashboard/dashboard-definition.ts` (FR-010–FR-012)
- [X] T045 [US2] Implement immutable snapshot creation/current-age enforcement and account-list projections with mandatory shared definition/calculation metadata in `web/src/backend/repositories/admin/prisma-admin-dashboard-repository.ts` and `web/src/backend/admin/dashboard/dashboard-snapshot-service.ts` (FR-010–FR-014)
- [X] T046 [US2] Add 30-second snapshot generation, expired-snapshot rejection, cleanup, and immediate recalculation signalling to `web/src/backend/admin/workers/dashboard-snapshot-loop.ts` (FR-010, SC-003)
- [X] T047 [P] [US2] Implement dashboard and account-list Route Handlers with required independent `calculatedAt` and `stateDefinitionVersion` metadata in `web/src/app/api/admin/dashboard/route.ts` and `web/src/app/api/admin/accounts/route.ts` (FR-010–FR-014)
- [X] T048 [US2] Add `getDashboardSnapshot` and allowlisted `accounts.getList` mappings without React Admin cache authority in `web/src/frontend/features/admin/app/data-provider.ts` (FR-010, FR-013, FR-014)
- [X] T049 [P] [US2] Build AdminDashboard, MetricCard, and SnapshotDifferenceNotice with exact units, timestamps, age statement, and canonical drill-down navigation in `web/src/frontend/features/admin/dashboard/admin-dashboard.tsx`, `web/src/frontend/features/admin/dashboard/metric-card.tsx`, and `web/src/frontend/features/admin/dashboard/snapshot-difference-notice.tsx` (FR-010, FR-011, FR-012)
- [X] T050 [P] [US2] Build the account List/DataTable with exact filters, 25/50/100 paging, locked ordering, masked-email projection, and accessible states in `web/src/frontend/features/admin/accounts/account-list.tsx` (FR-013, FR-014)

**Checkpoint**: User Story 2 independently proves correct periodic aggregates,
current drill-down behavior, allowlisted account discovery, and SC-002/SC-003
measurement readiness.

---

## Phase 5: User Story 3 - Manage Accounts and Sessions Safely (Priority: P1)

**Goal**: Inspect only safe account/session facts and perform revoke-one,
revoke-all, suspend, and reinstate commands with confirmation, rationale,
step-up, idempotency, concurrency, audit, notification, and lockout protection.

**Independent Test**: Search and inspect a target, exercise every action and
concurrent conflict, then prove immediate enforcement, prior-session
non-restoration, private-rationale retention, exact notification retry status,
self/last-admin protection, and zero prohibited data exposure.

### Tests for User Story 3

> Write these tests first and confirm they fail before implementation.

- [X] T051 [P] [US3] Add account-security and account/session command contract tests for exact projections, reasons, rationale normalization, confirmation, versions, idempotency, step-up, and safe errors in `web/tests/backend/contract/admin-management/admin-account-security.contract.test.ts` (US3-AS1–AS10, FR-015–FR-022)
- [X] T052 [P] [US3] Add account/session transaction, revoke-one/all, challenge invalidation, self/last-admin, stale-version, replay, and parallel-command tests in `web/tests/backend/integration/admin-management/admin-account-commands.test.ts` (US3-AS3–AS8, SC-004, SC-005, SC-010)
- [X] T053 [P] [US3] Add notification schedule/permanent/exhausted/manual-intervention and originating-action persistence tests, including exactly one notification for suspension/reinstatement/all-session revocation and none for single-session revocation, in `web/tests/backend/integration/admin-management/security-notification-work.test.ts` (US3-AS9, FR-022, FR-058, SC-018)
- [X] T054 [P] [US3] Add session/rationale privacy, 15-minute rationale proof, 365-day inaccessibility, and 24-hour deletion canaries in `web/tests/security/admin-management/account-session-rationale-privacy.test.ts` (US3-AS2, US3-AS10, FR-017, FR-021, SC-012)
- [X] T055 [P] [US3] Add component and accessibility tests for safe account detail, target-specific confirmations, stale conflict recovery, notification status, and rationale detail in `web/tests/frontend/components/admin-management/account-security.test.tsx` and `web/tests/frontend/accessibility/admin-management/account-security.accessibility.test.tsx` (FR-007, FR-015–FR-022, SC-014)
- [ ] T056 [P] [US3] Add end-to-end account search, revoke-one/all, suspend, reinstate, wrong-target prevention, and notification failure workflows in `web/tests/system/e2e/admin-management/account-security.spec.ts` (US3-AS1–AS10, SC-004–SC-006)

### Implementation for User Story 3

- [X] T057 [P] [US3] Implement exact account/security and safe session projections, server-side email masking, coarse location, and non-reusable session references in `web/src/backend/repositories/admin/prisma-admin-account-repository.ts` and `web/src/backend/admin/accounts/admin-session-projector.ts` (FR-014, FR-015, FR-017)
- [X] T058 [US3] Implement list/detail, revoke-one/all, suspend, and reinstate domain services with current-state locks, self/last-admin checks, session/challenge invalidation, and no unrelated restoration in `web/src/backend/admin/accounts/admin-account-service.ts` (FR-009, FR-015–FR-020, FR-023)
- [X] T059 [US3] Bind every account/session action to authoritative state, AuditEvent, encrypted rationale, and command receipt; create exactly one SecurityNotificationWork only for suspension, reinstatement, or all-session revocation and none for single-session revocation in `web/src/backend/admin/accounts/admin-account-command-transaction.ts` (FR-016, FR-018–FR-022, FR-058)
- [X] T060 [US3] Implement account security, revoke-one/all, suspend, reinstate, rationale, and audit-correlation Route Handlers in `web/src/app/api/admin/accounts/[accountId]/security/route.ts`, `web/src/app/api/admin/accounts/[accountId]/sessions/[sessionReference]/revoke/route.ts`, `web/src/app/api/admin/accounts/[accountId]/sessions/revoke-all/route.ts`, `web/src/app/api/admin/accounts/[accountId]/suspend/route.ts`, `web/src/app/api/admin/accounts/[accountId]/reinstate/route.ts`, `web/src/app/api/admin/actions/[correlationId]/rationale/route.ts`, and `web/src/app/api/admin/audit-events/[correlationId]/route.ts` (FR-015–FR-022)
- [X] T061 [US3] Add account-security/rationale queries and four pessimistic account/session commands to `web/src/frontend/features/admin/app/data-provider.ts` (FR-015, FR-016, FR-018–FR-022)
- [X] T062 [P] [US3] Build AccountSecurityShow and SafeSessionTable with the exact allowed account, membership, session, audit, and notification projections in `web/src/frontend/features/admin/accounts/account-security-show.tsx` and `web/src/frontend/features/admin/accounts/safe-session-table.tsx` (FR-015, FR-017, FR-022)
- [X] T063 [P] [US3] Build target-explicit SessionRevocationDialog, SuspendAccountDialog, and ReinstateAccountDialog with category and 10–500-character normalized rationale in `web/src/frontend/features/admin/accounts/session-revocation-dialog.tsx` and `web/src/frontend/features/admin/accounts/account-state-dialog.tsx` (FR-016, FR-018, FR-019)
- [X] T064 [P] [US3] Build StaleConflictPanel, PrivilegedRationaleDetail, and NotificationDeliveryStatus with safe refresh/manual-intervention behavior in `web/src/frontend/features/admin/shared/stale-conflict-panel.tsx`, `web/src/frontend/features/admin/accounts/privileged-rationale-detail.tsx`, and `web/src/frontend/features/admin/accounts/notification-delivery-status.tsx` (FR-020–FR-022, FR-059)
- [X] T065 [US3] Add rationale cleanup and notification retry/dead-letter loop integration to `web/src/backend/admin/workers/rationale-retention-loop.ts` and `web/src/backend/admin/workers/security-notification-loop.ts` (FR-021, FR-022, SC-012, SC-018)
- [X] T066 [US3] Add affected-user account-security notification templates containing only safe resulting state/time/next action in `web/src/backend/admin/notifications/account-security-templates.tsx` (FR-021, FR-022)
- [X] T067 [US3] Add the representative administrator first-attempt/two-minute usability protocol and wrong-membership scoring sheet in `web/tests/usability/admin-management/account-security-protocol.md` (SC-006)

**Checkpoint**: User Story 3 is independently functional; every account/session
action is authoritative, non-optimistic, concurrency-safe, auditable, private,
notified, and immediately enforced.

---

## Phase 6: User Story 4 - Review Recruiter and Company Verification (Priority: P1)

**Goal**: Let a Candidate submit, cancel, and resubmit protected business-license
evidence; let an authorized administrator safely review and approve, request
changes, or reject it without bypassing safety, relationship, state, concurrency,
notification, retention, or tenant rules.

**Independent Test**: Exercise every submission boundary, safety outcome,
deadline, protected-viewer outage, state transition, resubmission limit,
applicant-only cancellation, new/existing-company approval, prerequisite state,
duplicate/concurrent outcome, notification, audit, and evidence-retention rule.

### Tests for User Story 4

> Write these tests first and confirm they fail before implementation.

- [X] T068 [P] [US4] Add Candidate submission/cancel/resubmit and admin queue/detail/evidence/decision OpenAPI contract tests in `web/tests/backend/contract/admin-management/employer-verification.contract.test.ts` (US4-AS1–AS14, FR-024–FR-037)
- [X] T069 [P] [US4] Add exhaustive table-driven verification state machine, tax-ID, file-size/type, text normalization, resubmission, cancellation, and deadline unit tests in `web/tests/backend/unit/admin-management/verification-state-machine.test.ts` (FR-025, FR-026, FR-028, FR-031)
- [X] T070 [P] [US4] Add private storage, four safety stages, lease/restart, late-result, supersession, exact evidence retention, and exactly-one existing EmailOutbox row for each delay/expiry milestone under retries and lease recovery in `web/tests/backend/integration/admin-management/business-evidence-pipeline.test.ts` (US4-AS1–AS3, US4-AS10–AS11, FR-026–FR-028, FR-037, SC-007)
- [X] T071 [P] [US4] Add submission/resubmission receipt, cancellation, request-changes, rejection, and new/existing-company approval transaction tests proving authoritative state/history/audit plus exactly one existing EmailOutbox row, prerequisite revalidation/consumption, duplicate prevention, and barrier-synchronized reviewer outcomes in `web/tests/backend/integration/admin-management/verification-decisions.test.ts` (US4-AS4–AS9, US4-AS12–AS14, FR-024, FR-028, FR-031–FR-037, FR-058, SC-008, SC-010)
- [X] T072 [P] [US4] Add response/DOM/log/storage capability canaries proving evidence and locators never become public or persist client-side in `web/tests/security/admin-management/business-evidence-privacy.test.ts` (FR-027, SC-012)
- [X] T073 [P] [US4] Add component and keyboard/accessibility tests for submission, queue, review, viewer controls/status, step-up, disabled decisions, forms, and conflicts in `web/tests/frontend/components/admin-management/employer-verification.test.tsx` and `web/tests/frontend/accessibility/admin-management/employer-verification.accessibility.test.tsx` (FR-007, FR-027, FR-030, FR-031, SC-014)
- [ ] T074 [P] [US4] Add end-to-end clean/unsafe submission, review decisions, concurrent approval, applicant cancellation/resubmission, existing-company denial, and simulated 15/24/72-hour outages in `web/tests/system/e2e/admin-management/employer-verification.spec.ts` (US4-AS1–AS14, SC-007, SC-008, SC-010)

### Implementation for User Story 4

- [X] T075 [P] [US4] Define Candidate/admin verification schemas, exact state transitions, tax-ID/file rules, categories, roles, and projection allowlists in `web/src/shared/contracts/admin/verification.ts` (FR-024–FR-031, FR-036, FR-037)
- [X] T076 [P] [US4] Implement private encrypted filesystem and S3 evidence adapters with quarantine, integrity, review streams, normalized previews, inaccessibility, deletion, and reconciliation in `web/src/backend/storage/business-evidence/private-business-evidence-storage.ts`, `web/src/backend/storage/business-evidence/filesystem.ts`, and `web/src/backend/storage/business-evidence/s3.ts` (FR-026, FR-027)
- [X] T077 [US4] Implement malware, detected-type agreement, structural integrity, preview safety, policy provenance, and safe failure classification in `web/src/backend/admin/verification/evidence-safety-pipeline.ts` (FR-025–FR-027)
- [X] T078 [P] [US4] Implement verification request/evidence/safety-attempt/history/notes queries, read-only assignment/UNASSIGNED filtering, state/version locks, active-request uniqueness, deterministic queue ordering, and mandatory DashboardDefinition calculation/version metadata in `web/src/backend/repositories/admin/prisma-verification-repository.ts` (FR-024–FR-036)
- [X] T079 [US4] Implement Candidate submit, applicant-only cancel, and uninterrupted resubmit commands with evidence isolation, at-most-three resubmissions, and exactly one idempotent existing EmailOutbox receipt or cancellation row committed with each accepted lifecycle event in `web/src/backend/admin/verification/applicant-verification-service.ts` (FR-024–FR-028, FR-031, FR-035, FR-037)
- [X] T080 [US4] Implement Candidate submission/cancel/resubmit Route Handlers with multipart streaming limits and non-enumerating existing-company behavior in `web/src/app/api/employer-verifications/route.ts` and `web/src/app/api/employer-verifications/[requestId]/[action]/route.ts` (FR-024–FR-028)
- [X] T081 [P] [US4] Implement the consumer-only CompanyRelationshipPrerequisiteGateway plus a hard readiness contract recording upstream owner/version/environment and disabling existing-company approval until integration passes in `web/src/backend/admin/verification/company-relationship-prerequisite-gateway.ts` and `docs/dependencies/company-access-prerequisite.md` (FR-024, FR-030, FR-033)
- [X] T082 [US4] Implement verification queue/detail plus request-changes and rejection transactions with read-only assignment metadata, current evidence, role/category/note rules, version conflicts, and atomic request state, decision history, audit, and exactly one idempotent existing EmailOutbox row; expose no assignment mutation in `web/src/backend/admin/verification/verification-review-service.ts` (FR-028–FR-031, FR-034–FR-037, FR-058)
- [X] T083 [US4] Implement atomic new-company and existing-company approval transactions including unique tax ID, exact membership, prerequisite consumption, request/history, audit, and exactly one idempotent existing EmailOutbox applicant notification row in `web/src/backend/admin/verification/verification-approval-transaction.ts` (FR-032–FR-035, FR-037, FR-038, FR-058)
- [X] T084 [US4] Implement verification queue/detail, evidence preview/download, request-changes, reject, and approve Route Handlers; require queue `calculatedAt`/`stateDefinitionVersion` and expose no assignment command in `web/src/app/api/admin/verification-requests/route.ts`, `web/src/app/api/admin/verification-requests/[requestId]/route.ts`, `web/src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/preview/route.ts`, `web/src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/download/route.ts`, `web/src/app/api/admin/verification-requests/[requestId]/request-changes/route.ts`, `web/src/app/api/admin/verification-requests/[requestId]/reject/route.ts`, and `web/src/app/api/admin/verification-requests/[requestId]/approve/route.ts` (FR-027, FR-029–FR-031)
- [X] T085 [US4] Add verification list/detail/evidence and pessimistic decision mappings to `web/src/frontend/features/admin/app/data-provider.ts` (FR-029–FR-031)
- [X] T086 [P] [US4] Build the Candidate employer-verification submission/status/cancel/resubmit workflow in `web/src/frontend/features/employer-verification/employer-verification-page.tsx` and mount it at `web/src/app/(workspace)/dashboard/employer-verification/page.tsx` (FR-024–FR-028, FR-037)
- [X] T087 [P] [US4] Build VerificationRequestList and VerificationReviewShow with exact filters/order, matches, prerequisite validity, submissions, outage state, and safe history in `web/src/frontend/features/admin/verification/verification-request-list.tsx` and `web/src/frontend/features/admin/verification/verification-review-show.tsx` (FR-029, FR-030, FR-036)
- [X] T088 [P] [US4] Build ProtectedEvidenceViewer using authenticated bytes, PDF canvas or normalized image blobs, labelled controls, cleanup, safe download, and decision disablement in `web/src/frontend/features/admin/verification/protected-evidence-viewer.tsx` (FR-004, FR-027, FR-028)
- [X] T089 [P] [US4] Build VerificationDecisionPanel for request changes, rejection, approval, private note, resubmission boundary, explicit confirmation, step-up, and conflict recovery in `web/src/frontend/features/admin/verification/verification-decision-panel.tsx` (FR-031–FR-035, FR-059)
- [X] T090 [P] [US4] Implement typed existing-EmailOutbox payload builders and receipt/change/approval/rejection/cancellation/delay/expiry applicant templates with no private signals, notes, locators, or admin identity in `web/src/backend/admin/notifications/verification-templates.tsx` (FR-026, FR-028, FR-037)
- [X] T091 [US4] Implement leased safety processing, 15/24-hour check delay/expiry, 15/24/72-hour viewer outage, 30-day changes expiry, and terminal/superseded cleanup loops, atomically inserting exactly one idempotent existing EmailOutbox row for each accepted delay or expiry milestone in `web/src/backend/admin/workers/verification-lifecycle-loop.ts` and `web/src/backend/admin/workers/evidence-retention-loop.ts` (FR-026–FR-028, FR-037, SC-007)
- [ ] T092 [US4] Create the versioned business-license evidence policy with named Legal/Security/Operations approvals and add fail-closed policy-version, storage, scanner, encryption, access, inactive-verification, and retention readiness checks in `docs/policies/business-license-evidence.md` and `web/scripts/check-admin-evidence-readiness.mjs` (FR-026, FR-027)
- [X] T093 [US4] Add the representative administrator three-minute review usability protocol and outcome sheet in `web/tests/usability/admin-management/verification-review-protocol.md` (SC-008)

**Checkpoint**: User Story 4 is independently functional for new-company
verification. Existing-company approval remains disabled until the separately
owned invitation/OWNER-approval producer satisfies the gateway contract; no
fallback or tax-ID-only bypass is permitted.

---

## Phase 7: User Story 5 - Suspend, Restore, or Remove Recruiter Authority (Priority: P1)

**Goal**: Apply enforcement to exactly one company-scoped membership while
preserving the account, Candidate identity, other memberships, retained role,
last active OWNER, audit, notification, and concurrency rules.

**Independent Test**: Give one account memberships in multiple companies,
suspend/restore/remove one, attempt a last-OWNER change and stale in-flight
command, and prove only the selected company authority changes.

### Tests for User Story 5

> Write these tests first and confirm they fail before implementation.

- [X] T094 [P] [US5] Add OpenAPI/provider contract tests for safe company-reference list, membership list/detail, mandatory calculation/definition metadata, and lifecycle commands covering scope, roles/states, rationale, versions, and safe errors in `web/tests/backend/contract/admin-management/company-membership.contract.test.ts` (US5-AS1–AS6, FR-038–FR-045)
- [X] T095 [P] [US5] Add multi-company isolation, prior-role restore, REMOVED terminal behavior, last-OWNER locking, notification/audit, and stale-command integration tests in `web/tests/backend/integration/admin-management/company-membership-lifecycle.test.ts` (US5-AS1–AS6, SC-009, SC-010)
- [X] T096 [P] [US5] Add membership action component/accessibility tests for explicit company/role/target, stronger removal confirmation, blocked OWNER, step-up, and conflicts in `web/tests/frontend/components/admin-management/company-membership.test.tsx` and `web/tests/frontend/accessibility/admin-management/company-membership.accessibility.test.tsx` (FR-007, FR-039–FR-045, SC-014)
- [ ] T097 [P] [US5] Add end-to-end suspend/restore/remove, no-active-membership denial, Candidate preservation, and stale recruiter-operation tests in `web/tests/system/e2e/admin-management/company-membership.spec.ts` (US5-AS1–AS6, SC-009, SC-010)

### Implementation for User Story 5

- [X] T098 [P] [US5] Implement safe company-reference and company-scoped membership list/show projections importing DashboardDefinition with required `calculatedAt`/`stateDefinitionVersion`, retained-role history, version locking, and active-OWNER locking in `web/src/backend/repositories/admin/prisma-admin-membership-repository.ts` (FR-038, FR-042, FR-044, FR-045)
- [X] T099 [US5] Implement suspend, restore-prior-role, and remove services with one-membership isolation, last-OWNER denial, new-prerequisite return rule, and current-state revalidation in `web/src/backend/admin/memberships/admin-membership-service.ts` (FR-038–FR-045)
- [X] T100 [US5] Bind membership state, audit, rationale, notification work, command receipt, and denied conflicts as one outcome in `web/src/backend/admin/memberships/admin-membership-command-transaction.ts` (FR-039–FR-045, FR-058)
- [X] T101 [US5] Implement OpenAPI-aligned safe company-reference list, membership list/show with mandatory calculation/definition metadata, and explicit suspend/restore/remove Route Handlers in `web/src/app/api/admin/companies/route.ts`, `web/src/app/api/admin/company-memberships/route.ts`, `web/src/app/api/admin/company-memberships/[membershipId]/route.ts`, and `web/src/app/api/admin/company-memberships/[membershipId]/[action]/route.ts` (FR-038–FR-045)
- [X] T102 [US5] Add the read-only `companies` and `company-memberships` getList/getOne mappings plus three pessimistic membership lifecycle commands to `web/src/frontend/features/admin/app/data-provider.ts` (FR-038–FR-045)
- [X] T103 [P] [US5] Build CompanyMembershipList and MembershipLifecyclePanel with explicit company context, retained role, last-OWNER explanation, and unrelated-membership refetch checks in `web/src/frontend/features/admin/memberships/company-membership-list.tsx` and `web/src/frontend/features/admin/memberships/membership-lifecycle-panel.tsx` (FR-038–FR-045)
- [X] T104 [P] [US5] Build SuspendMembershipDialog, RestoreMembershipDialog, and stronger RemoveMembershipDialog using shared rationale/step-up/conflict primitives in `web/src/frontend/features/admin/memberships/membership-action-dialog.tsx` (FR-039, FR-040, FR-041, FR-045)
- [X] T105 [US5] Add safe membership suspension/restoration/removal notification templates and account-detail delivery projection in `web/src/backend/admin/notifications/membership-security-templates.tsx` (FR-022, FR-039–FR-041)

**Checkpoint**: User Story 5 is independently functional and passes all
multi-company, Candidate-preservation, last-OWNER, in-flight authorization,
notification, and concurrency assertions.

---

## Phase 8: User Story 6 - Review Candidate, Recruiter, Company, and Job Reports (Priority: P2)

**Goal**: Accept only relationship-authorized private reports under exact
normalization/dedupe/quota rules, migrate existing job reports into one private
queue, and support assignment, notes, terminal review, and separately confirmed
enforcement links without automatic domain changes.

**Independent Test**: Submit every target/category from allowed and denied
relationships, cross the duplicate and rolling quota boundaries, review and
concurrently decide reports, and prove private details never leak or enforce on
their own.

### Tests for User Story 6

> Write these tests first and confirm they fail before implementation.

- [X] T106 [P] [US6] Add reporter submission and admin moderation queue/detail/action contract tests covering required calculation/definition metadata, neutral acknowledgement/unavailable responses, exact field allowlists, and zero NotificationWork for moderation-only commands in `web/tests/backend/contract/admin-management/moderation-report.contract.test.ts` (US6-AS1–AS9, FR-046–FR-053)
- [X] T107 [P] [US6] Add normalization/category/priority/order, unresolved/24-hour dedupe, 10-per-24-hour cross-session quota, retry duration, and race tests in `web/tests/backend/integration/admin-management/moderation-report-admission.test.ts` (US6-AS2–AS4, US6-AS8–AS9, FR-046–FR-050, SC-011, SC-017)
- [X] T108 [P] [US6] Add OWNER/HR and direct RECRUITER/HIRING_MANAGER application-authorization plus same-company non-authorized denial tests in `web/tests/security/admin-management/candidate-report-authorization.test.ts` (US6-AS3–AS4, US6-AS8, FR-046, FR-047, SC-017)
- [X] T109 [P] [US6] Add assignment/note/resolve/dismiss/enforcement-link concurrency, immutable history, deleted-target reference, no-reopen, zero moderation-only NotificationWork, and no duplicate notification after linked enforcement tests in `web/tests/backend/integration/admin-management/moderation-review.test.ts` (US6-AS5–AS7, FR-049–FR-053, FR-058, SC-010, SC-011)
- [X] T110 [P] [US6] Add zero-automatic-enforcement and privacy canaries across job/account/membership/company/application/score state, reporter, target, logs, audit, and browser storage in `web/tests/security/admin-management/moderation-isolation-privacy.test.ts` (US6-AS7, FR-049, FR-052, FR-053, SC-011, SC-012)
- [X] T111 [P] [US6] Add component and keyboard/accessibility tests for queue filters, priorities, assignment, normalized private note, terminal decisions, confirmation, conflicts, and non-color states in `web/tests/frontend/components/admin-management/moderation-review.test.tsx` and `web/tests/frontend/accessibility/admin-management/moderation-review.accessibility.test.tsx` (FR-007, FR-050, FR-051, SC-014)
- [ ] T112 [P] [US6] Add end-to-end public-job and application-context report submission, neutral denials/duplicates/quota, queue review, terminal decision, and no-enforcement workflows in `web/tests/system/e2e/admin-management/moderation-reports.spec.ts` (US6-AS1–AS9, SC-011, SC-017)

### Implementation for User Story 6

- [X] T113 [P] [US6] Define generalized moderation target/category/priority/submission/list/detail/action schemas and exact plain-text normalization in `web/src/shared/contracts/admin/moderation.ts` (FR-046–FR-053)
- [X] T114 [P] [US6] Implement generalized report, admission event, unresolved key, private note, immutable history, assignment, priority, filters, deterministic ordering, and required DashboardDefinition calculation/version metadata in `web/src/backend/repositories/admin/prisma-moderation-repository.ts` (FR-046, FR-048, FR-050–FR-052)
- [X] T115 [US6] Implement report admission with public-job/company/recruiter relationships, direct Candidate-application authority, neutral denial, transactional dedupe/quota, and no enforcement dependency in `web/src/backend/admin/moderation/moderation-submission-service.ts` (FR-046–FR-049)
- [X] T116 [US6] Migrate existing job reporting to the generalized submission service while preserving the existing public job relationship and neutral UI contract in `web/src/backend/services/jobs/job-report-service.ts` and `web/src/app/api/jobs/[jobId]/reports/route.ts` (FR-046, FR-048, FR-049, FR-061)
- [X] T117 [US6] Implement the unified reporter submission Route Handler for company, recruiter-membership, and Candidate application contexts in `web/src/app/api/moderation-reports/route.ts` (FR-046–FR-049)
- [X] T118 [US6] Implement admin queue/detail, assignment, normalized note, resolve, dismiss, and separately confirmed enforcement-link services with version conflicts and terminal-state preservation; create no moderation-only NotificationWork and delegate linked access notification to the underlying enforcement command in `web/src/backend/admin/moderation/moderation-review-service.ts` (FR-050–FR-053, FR-058)
- [X] T119 [US6] Implement moderation list/detail and explicit action Route Handlers with required list `calculatedAt`/`stateDefinitionVersion` in `web/src/app/api/admin/moderation-reports/route.ts`, `web/src/app/api/admin/moderation-reports/[reportId]/route.ts`, and `web/src/app/api/admin/moderation-reports/[reportId]/[action]/route.ts` (FR-050–FR-053)
- [X] T120 [US6] Add moderation list/detail and pessimistic assignment/note/resolve/dismiss/link methods to `web/src/frontend/features/admin/app/data-provider.ts` (FR-050–FR-053)
- [X] T121 [P] [US6] Extend the existing public job report form and add an application-context Candidate report action without adding Recruiter Manager navigation in `web/src/frontend/features/jobs/components/report-job-dialog.tsx` and `web/src/frontend/features/applications/components/report-candidate-dialog.tsx` (FR-046–FR-049)
- [X] T122 [P] [US6] Build ModerationReportList, ModerationReviewShow, and ReportActionPanel with exact filters/order, private detail, state history, terminal behavior, and enforcement confirmation in `web/src/frontend/features/admin/moderation/moderation-report-list.tsx`, `web/src/frontend/features/admin/moderation/moderation-review-show.tsx`, and `web/src/frontend/features/admin/moderation/report-action-panel.tsx` (FR-050–FR-053)
- [X] T123 [US6] Add legacy JobReport parity/count/reference verification and cutover diagnostics in `web/scripts/verify-moderation-report-migration.mjs` (FR-046, FR-061)

**Checkpoint**: User Story 6 is independently functional; all qualifying reports
enter one private queue, non-qualifying requests do not enumerate targets,
duplicates/quotas are deterministic, and no report changes another domain
without a separately authorized action.

---

## Phase 9: User Story 7 - Hand Off Approved Recruiters to Their Workspace (Priority: P2)

**Goal**: Enforce exact recruiter-origin entitlement from current ACTIVE account
and company membership, make company selection explicit, and expose only the
Candidate Dashboard and Employer Verification destinations until the separate
Recruiter Manager feature exists.

**Independent Test**: Enter the recruiter origin with zero, one, multiple,
suspended, and removed memberships and a suspended account; only active company
contexts are offered, no cross-company/private data appears, and no Recruiter
Manager capability or route exists.

### Tests for User Story 7

> Write these tests first and confirm they fail before implementation.

- [X] T124 [P] [US7] Add exact recruiter-host and entitlement response contract tests for ACTIVE account/membership, safe company options, explicit selection, and exactly two destinations in `web/tests/backend/contract/admin-management/recruiter-entitlement.contract.test.ts` (US7-AS1–AS4, FR-054–FR-057)
- [X] T125 [P] [US7] Add multi-company, role/state, admin-grant non-substitution, stale membership, and cross-company non-disclosure integration tests in `web/tests/backend/integration/admin-management/recruiter-entitlement.test.ts` (US7-AS1–AS3, FR-055, FR-056)
- [X] T126 [P] [US7] Add component, keyboard/accessibility, and route/link-absence tests for the coming-next page in `web/tests/frontend/components/admin-management/recruiter-entitlement.test.tsx` and `web/tests/frontend/accessibility/admin-management/recruiter-entitlement.accessibility.test.tsx` (US7-AS2–AS4, FR-057, SC-014)
- [ ] T127 [P] [US7] Add end-to-end exact-host, company selection, stale revocation, Candidate fallback, and no-Recruiter-Manager-surface tests in `web/tests/system/e2e/admin-management/recruiter-entitlement.spec.ts` (US7-AS1–AS4, FR-043, FR-054–FR-057)

### Implementation for User Story 7

- [X] T128 [P] [US7] Define the minimal recruiter entitlement, company option, explicit-selection, unavailable, and two-destination schemas in `web/src/shared/contracts/admin/recruiter-entitlement.ts` (FR-054–FR-057)
- [X] T129 [US7] Implement current account/company/membership/role entitlement queries and selected-company revalidation without accepting admin grants in `web/src/backend/admin/memberships/recruiter-entitlement-service.ts` (FR-043, FR-055, FR-056)
- [X] T130 [US7] Implement the exact recruiter-origin entitlement Route Handler with non-private safe projections in `web/src/app/api/recruiter/entitlement/route.ts` (FR-054–FR-057)
- [X] T131 [P] [US7] Build the explicit-company RecruiterEntitlementComingNextPage containing only Candidate Dashboard and Employer Verification destinations in `web/src/frontend/features/recruiter-entitlement/recruiter-entitlement-coming-next-page.tsx` (FR-056, FR-057)
- [X] T132 [US7] Mount only the limited entitlement page behind the exact recruiter host rewrite in `web/src/app/(recruiter-entitlement)/__recruiter/page.tsx` (FR-054–FR-057)

**Checkpoint**: User Story 7 is independently functional as an entitlement
boundary and coming-next page; it contains no recruiter dashboard, job,
applicant, scoring, Kanban, team, analytics, or export capability.

---

## Phase 10: Polish, Regression, and Cross-Cutting Release Gates

**Purpose**: Prove the integrated feature preserves privacy, accessibility,
performance, deterministic behavior, existing workflows, operational deadlines,
and the explicit out-of-scope boundary.

- [X] T133 [P] Add only the focused unit/contract/integration/accessibility/security/e2e/performance scripts and their CI ordering, preserving the worker commands established by T005, in `web/package.json` and `.github/workflows/ci.yml`
- [X] T134 [P] Complete OpenAPI/runtime/provider parity for all 32 planned paths and publish the generated client/schema drift report from `web/tests/backend/contract/admin-management/admin-contract-parity.test.ts` (FR-005, FR-059)
- [X] T135 [P] Add a full audit correlation and secret-scanning suite for every privileged success, denied high-risk attempt, notification, rationale, verification, membership, and moderation action in `web/tests/security/admin-management/admin-audit-privacy.test.ts` (FR-008, FR-021, FR-036, FR-045, FR-052, FR-058, SC-013)
- [X] T136 [P] Add browser Back/Forward/reload, URL, analytics, ordinary log, memory store, Query cache, and bundle privacy checks across all admin resources in `web/tests/security/admin-management/admin-browser-privacy.test.ts` (FR-006, FR-017, FR-027, FR-053, FR-060, SC-012)
- [X] T137 [P] Add regression tests proving Candidate auth/profile/CV/job search/application/session self-service and deterministic recruitment remain unchanged except lawful suspension in `web/tests/architecture/admin-management-regression.test.ts` (FR-023, FR-049, FR-061)
- [ ] T138 [P] Add full keyboard-only Playwright journeys and automated axe checks with zero serious/critical findings for every core admin task in `web/tests/system/e2e/admin-management/accessibility.spec.ts` (FR-007, SC-014)
- [X] T139 [P] Add NVDA/Firefox and VoiceOver/Safari manual smoke protocol and evidence template in `web/tests/accessibility/admin-management/manual-screen-reader-protocol.md` (FR-007, SC-014)
- [ ] T140 [P] Complete SC-002 dashboard/list, two-second session/designation, document qualification, and worker-deadline performance reporting in `web/scripts/measure-admin-management-performance.mjs` and `web/tests/performance/admin-management/release-thresholds.test.ts` (SC-002–SC-004, SC-007, SC-015, SC-018)
- [X] T141 [P] Add restart, lease expiry, partial-provider outage, independent-loop readiness, and retention reconciliation tests for the admin worker in `web/tests/backend/integration/admin-management/admin-worker-resilience.test.ts` (FR-021, FR-022, FR-026–FR-028, SC-007, SC-012, SC-018)
- [X] T142 [P] Add exact production-origin/no-wildcard checks plus approved evidence-policy version and upstream prerequisite owner/version/integration readiness gates alongside private storage, encryption-key, scanner, notification, and retention checks in `scripts/check-environment.mjs` and `web/scripts/check-admin-evidence-readiness.mjs` (FR-003, FR-024, FR-027, FR-054)
- [X] T143 Update the end-to-end validation instructions, planned-command markers, representative dataset, and release-evidence checklist after commands become runnable in `spec-kit/specs/006-admin-management/quickstart.md`
- [ ] T144 Run every quickstart acceptance journey and record pass/fail evidence without editing the authoritative spec in `spec-kit/specs/006-admin-management/release-validation.md` (SC-001–SC-018)
- [X] T145 Verify no Recruiter Manager, company deletion, account deletion, grant-management UI, automated enforcement, AI moderation/verification, export, or other excluded capability entered the implementation using `web/tests/architecture/admin-management-scope-boundaries.test.ts`

**Final Checkpoint**: All selected user stories, constitution gates, migration
checks, hard deadlines, privacy/security assertions, accessibility checks,
performance thresholds, and regression suites pass. Feature 006 is not released
with a bypass for any unresolved external prerequisite.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Phase 2 and establishes the admin console trust
  boundary used by US2–US6.
- **Phases 4–8 — US2–US6**: Backend tests and domain modules may begin in
  parallel after Phase 2, but each story's admin UI/system completion depends on
  US1's stable auth/provider/shell contracts.
- **Phase 6 — US4 existing-company approval**: Additionally blocked from
  acceptance by the separately owned authoritative invitation/OWNER-approval
  producer. New-company verification is not blocked.
- **Phase 9 — US7**: Depends on Phase 2 and the membership model; it does not
  depend on the US5 admin lifecycle UI and may proceed in parallel with US2–US6.
- **Phase 10 — Release gates**: Depends on every story selected for delivery.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 ----+-> US2
                              +-> US3
                              +-> US4 new-company path
                              +-> US5
                              `-> US6

Foundation ----------------------> US7

External prerequisite producer --> US4 existing-company approval

US1 + US2 + US3 + US4 + US5 + US6 + US7 -> Release gates
```

### Within Each User Story

1. Write the listed tests and verify they fail for the missing behavior.
2. Add or extend shared story contracts before repositories/services.
3. Implement persistence/state transitions before Route Handlers.
4. Implement Route Handlers before React Admin/custom UI integration.
5. Keep all security-sensitive mutations pessimistic and reconfirm conflicts.
6. Pass the story checkpoint before treating the increment as complete.

### Requirement-to-Task Traceability

| Requirements                  | Primary task coverage                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| FR-001–FR-009, FR-060, FR-062 | T008–T039, T135–T137                                                                                        |
| FR-010–FR-014                 | T024, T040–T050, T140                                                                                       |
| FR-015–FR-023                 | T015–T018, T051–T067, T135–T141                                                                             |
| FR-024–FR-037                 | T068–T093, T135–T142                                                                                        |
| FR-038–FR-045                 | T094–T105, T125–T132                                                                                        |
| FR-046–FR-053                 | T106–T123, T135–T145                                                                                        |
| FR-054–FR-057                 | T003, T011, T020, T124–T132, T142, T145                                                                     |
| FR-058–FR-059                 | T008, T012–T024, T059, T083, T100, T118, T134–T141                                                          |
| FR-061                        | T009, T010, T116, T123, T137, T145                                                                          |
| SC-001–SC-018                 | Story test tasks T026–T030, T040–T043, T051–T056, T068–T074, T094–T097, T106–T112, T124–T127 plus T133–T144 |

---

## Parallel Opportunities

- Setup tasks T002–T004 and T006–T007 may run concurrently after T001; T005 is
  sequential because it registers worker commands in package files.
- Foundation test tasks T008–T011 may run concurrently; implementation tasks
  explicitly marked [P] touch separate boundaries.
- Once Phase 2 completes, backend test/design work for US2–US7 can proceed in
  parallel while US1 is finished, but admin UI/system acceptance waits for US1.
- Within each story, all test tasks marked [P] may be authored concurrently
  before implementation begins.

## Parallel Examples by User Story

### User Story 1

```text
T026 auth contracts | T027 authorization matrix | T028 session policy | T029 accessibility | T030 E2E
T035 auth pages | T036 authority gate
```

### User Story 2

```text
T040 metric definitions | T041 contracts | T042 snapshot integration | T043 performance harness
T049 dashboard components | T050 account list
```

### User Story 3

```text
T051 contracts | T052 commands | T053 notifications | T054 privacy | T055 accessibility | T056 E2E
T062 security detail | T063 dialogs | T064 conflict/rationale/notification UI
```

### User Story 4

```text
T068 contracts | T069 state machine | T070 pipeline | T071 decisions | T072 privacy | T073 accessibility | T074 E2E
T086 Candidate workflow | T087 admin queue/detail | T088 viewer | T089 decisions | T090 templates
```

### User Story 5

```text
T094 contracts | T095 lifecycle integration | T096 accessibility | T097 E2E
T103 membership list/panel | T104 lifecycle dialogs
```

### User Story 6

```text
T106 contracts | T107 admission | T108 relationship authorization | T109 review | T110 privacy | T111 accessibility | T112 E2E
T121 reporter forms | T122 admin moderation UI
```

### User Story 7

```text
T124 contracts | T125 entitlement integration | T126 accessibility | T127 E2E
T128 schemas | T131 coming-next page
```

---

## Implementation Strategy

### Technical Checkpoint First

1. Complete Phase 1 and Phase 2.
2. Complete US1 and validate the exact-host, exclusive-session, two-factor,
   step-up, and server authorization boundary independently.
3. Treat US1 as a technical checkpoint only; it is not a releasable P0 admin
   feature by itself.

### Releasable P1 Scope

1. Complete US1–US5, which cover the P1 console boundary, dashboard,
   account/session control, employer verification, and company-scoped membership
   enforcement.
2. Pass every applicable Phase 10 release gate for that selected scope.
3. Keep existing-company approval disabled until the prerequisite producer is
   authoritative; do not claim US4 complete or release a bypass.
4. Add US6 and US7 as independently tested P2 increments without weakening the
   P1 workflows.

### Incremental Delivery

1. Setup + Foundation -> migration and trust boundaries ready.
2. US1 -> protected console checkpoint.
3. US2 -> operational dashboard/account discovery checkpoint.
4. US3 -> account/session enforcement checkpoint.
5. US4 -> new-company verification, then gated existing-company verification.
6. US5 -> company-scoped membership enforcement checkpoint.
7. US6 -> unified private moderation checkpoint.
8. US7 -> recruiter entitlement/coming-next checkpoint.
9. Phase 10 -> integrated release evidence.

---

## Notes

- `[P]` means separate files and no dependency on another incomplete adjacent
  task; shared-file edits such as `data-provider.ts` remain ordered.
- All tests listed before implementation are written first and observed failing
  for the intended missing behavior.
- React Admin is never an authorization boundary and exposes no generic
  privileged create/update/delete or undoable mutation.
- Better Auth Session remains the exclusive browser-session mechanism.
- Company Membership always remains company-scoped; no global recruiter
  resource is introduced.
- T081 consumes but does not create invitations or OWNER approvals. That
  producer and its UI remain a separate dependency and outside Feature 006.
- No task authorizes full Recruiter Manager capabilities at the recruiter
  origin.
- Commit after each task or coherent test/implementation pair once its focused
  checks pass.
