# Tasks: In-App Notification Center

**Input**: Design documents from `spec-kit/specs/016-inapp-email-notification/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/notifications.openapi.yaml`, `quickstart.md`

**Tests**: Required by FR-045 and the security, privacy, authorization, accessibility, migration, performance, and email non-regression outcomes. Tests are written before corresponding implementation and must fail for the intended missing behavior.

**Organization**: Tasks are grouped by user story. All P1-P3 stories and cross-cutting validation form one Feature 016 release unit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no incomplete dependency.
- **[Story]**: User story from `spec.md`.
- Every task includes an exact repository path.

## Phase 1: Setup and Contract Baseline

**Purpose**: Register focused commands and shared contracts without changing runtime behavior.

- [ ] T001 Add `test:notifications`, `perf:notifications`, `notifications:migrate:legacy`, and `notifications:migration:verify` commands in `web/package.json` and root `package.json`
- [ ] T002 [P] Create exhaustive Zod API/event types matching OpenAPI in `web/src/shared/contracts/notifications/index.ts`
- [ ] T003 [P] Add OpenAPI-to-Zod parity and response-shape tests in `web/tests/backend/contract/notifications/notification-openapi-parity.test.ts`
- [ ] T004 [P] Add notification test builders and authenticated fixtures in `web/tests/helpers/notifications/notification-fixtures.ts`

---

## Phase 2: Foundational Persistence and Policy

**Purpose**: Establish the unified model, migration, repository, allow-listed policy, authorization, and service boundaries used by every story.

**CRITICAL**: No user-story producer or UI task starts until this phase passes.

### Tests

- [ ] T005 [P] Add event-policy exhaustiveness, severity, localization fallback, safe variable, destination allowlist, and proof-email exclusion tests in `web/tests/backend/unit/notifications/notification-event-policy.test.ts`
- [ ] T006 [P] Add repository deduplication, cursor, unread, expiry, read, read-all, and context-read integration tests in `web/tests/backend/integration/notifications/notification-repository.test.ts`
- [ ] T007 [P] Add recipient isolation and missing-versus-foreign indistinguishability tests in `web/tests/security/notifications/notification-authorization.test.ts`
- [ ] T008 [P] Add schema, index, constraint, and legacy-backfill migration tests in `web/tests/backend/integration/notifications/notification-migration.test.ts`

### Implementation

- [ ] T009 Add notification enums, `InAppNotification`, indexes, constraints, and `UserAccount` relation in `web/prisma/schema.prisma`
- [ ] T010 Create additive unified notification and legacy connection backfill SQL in `web/prisma/migrations/20260814090000_unified_in_app_notifications/migration.sql`
- [ ] T011 Add read-only source/target/read-state/challenge-exclusion verifier in `web/scripts/verify-in-app-notification-migration.mjs`
- [ ] T012 Regenerate Prisma client output in `web/src/backend/generated/prisma/`
- [ ] T013 [P] Define safe error codes and transport mapping helpers in `web/src/backend/notifications/notification-errors.ts`
- [ ] T014 [P] Implement server-only event kinds, safe schemas, severity/category/copy/destination rules, and email classification in `web/src/backend/notifications/event-policy.ts`
- [ ] T015 Implement recipient/event deduplication, cursor listing, unread count, and read mutations in `web/src/backend/repositories/notifications/prisma-notification-repository.ts`
- [ ] T016 Implement transaction-compatible create/list/read/context services in `web/src/backend/notifications/notification-service.ts`
- [ ] T017 [P] Implement company membership and conversation recipient resolution in `web/src/backend/notifications/notification-recipient-policy.ts`
- [ ] T018 Compose repository, policy, session, CSRF, and clock dependencies in `web/src/backend/notifications/notification-service-factory.ts`

**Checkpoint**: Unified persistence and deterministic safe event creation pass without any producer integration.

---

## Phase 3: User Story 1 - Security and Account Events (Priority: P1)

**Goal**: Every supported completed security/account email event creates one safe in-app record while challenge/proof emails remain excluded and existing email behavior is unchanged.

**Independent Test**: Trigger each account, password, recovery, session, and membership event; verify exact recipient/severity/deduplication, safe content, proof exclusion, and unchanged email snapshots/outbox semantics.

### Tests

- [ ] T019 [P] [US1] Add password-change and email-change-alert in-app integration tests in `web/tests/backend/integration/notifications/account-notification-events.test.ts`
- [ ] T020 [P] [US1] Add recovery pending/cancelled/completed and proof exclusion tests in `web/tests/backend/integration/notifications/recovery-notification-events.test.ts`
- [ ] T021 [P] [US1] Add admin account/membership security event tests in `web/tests/backend/integration/notifications/admin-security-notification-events.test.ts`
- [ ] T022 [P] [US1] Add secret, token, private evidence, HTML, unsafe href, and oversized copy rejection tests in `web/tests/security/notifications/notification-payload-privacy.test.ts`
- [ ] T023 [P] [US1] Add unchanged email subject/body/recipient/preference/retry regression tests in `web/tests/backend/integration/notifications/existing-email-non-regression.test.ts`

### Implementation

- [ ] T024 [US1] Add safe in-app creation beside password changed and old-address email-change alert producers in `web/src/backend/repositories/account/prisma-password-change-operation-repository.ts`, `web/src/backend/repositories/identity/prisma-password-reset-repository.ts`, and `web/src/backend/repositories/account/prisma-email-change-repository.ts`
- [ ] T025 [US1] Add safe recovery lifecycle notifications while excluding confirmation/proof delivery in `web/src/backend/repositories/identity/prisma-account-recovery-repository.ts`
- [ ] T026 [US1] Add unified records beside admin account and membership security work creation in `web/src/backend/admin/accounts/admin-account-command-transaction.ts` and `web/src/backend/admin/memberships/admin-membership-command-transaction.ts`
- [ ] T027 [US1] Add session-revocation notification integration at its authoritative security producer in `web/src/backend/admin/accounts/admin-account-command-transaction.ts`
- [ ] T028 [US1] Keep all email templates/renderers untouched and enforce event/proof classification at compile time in `web/src/backend/notifications/event-policy.ts`

**Checkpoint**: Security/account event emails have in-app counterparts and no challenge/proof material is persisted.

---

## Phase 4: User Story 2 - Unified Inbox and Read State (Priority: P1)

**Goal**: Authenticated users can list, count, open, read, and read-all their own notifications through accessible workspace and administrator shells.

**Independent Test**: Seed mixed records and verify APIs, pagination, badges, panel/page states, links, keyboard/focus behavior, cross-user denial, and two-client convergence.

### Tests

- [ ] T029 [P] [US2] Add list/count/read/read-all/context Route Handler contract tests in `web/tests/backend/contract/notifications/notification-routes.contract.test.ts`
- [ ] T030 [P] [US2] Add authenticated API integration tests for cursor stability, expiry filtering, CSRF, idempotency, and cache headers in `web/tests/backend/integration/notifications/notification-api.test.ts`
- [ ] T031 [P] [US2] Add bell badge, overflow, polling, loading, empty, error, retry, and optimistic read tests in `web/tests/frontend/components/notifications/notification-center.test.tsx`
- [ ] T032 [P] [US2] Add full inbox pagination/filter/read-all UI tests in `web/tests/frontend/components/notifications/notification-inbox-page.test.tsx`
- [ ] T033 [P] [US2] Add workspace and React Admin shell integration tests in `web/tests/frontend/components/notifications/notification-shell-integration.test.tsx`
- [ ] T034 [P] [US2] Add keyboard, focus, live-region, labels, contrast, reduced-motion, and non-color state tests in `web/tests/frontend/accessibility/notifications/notification-center.accessibility.test.tsx`

### Implementation

- [ ] T035 [P] [US2] Implement no-store notification list Route Handler in `web/src/app/api/notifications/route.ts`
- [ ] T036 [P] [US2] Implement no-store unread-count Route Handler in `web/src/app/api/notifications/unread-count/route.ts`
- [ ] T037 [P] [US2] Implement CSRF-protected individual read Route Handler in `web/src/app/api/notifications/[notificationId]/read/route.ts`
- [ ] T038 [P] [US2] Implement CSRF-protected read-all Route Handler in `web/src/app/api/notifications/read-all/route.ts`
- [ ] T039 [P] [US2] Implement CSRF-protected allow-listed context-read Route Handler in `web/src/app/api/notifications/contexts/read/route.ts`
- [ ] T040 [US2] Implement TanStack Query client, four-second visible polling, invalidation, and mutation helpers in `web/src/frontend/features/notifications/client/use-notifications.ts`
- [ ] T041 [P] [US2] Add bilingual notification UI copy and date formatting in `web/src/frontend/features/notifications/notification-copy.ts`
- [ ] T042 [US2] Build accessible bell, overflow badge, popover panel, item, error, and empty components in `web/src/frontend/features/notifications/components/notification-center.tsx`
- [ ] T043 [US2] Build filterable paginated full inbox in `web/src/frontend/features/notifications/components/notification-inbox.tsx`
- [ ] T044 [US2] Add responsive notification styles and non-color severity/read indicators in `web/src/frontend/features/notifications/styles/notifications.css`
- [ ] T045 [US2] Add authenticated `/notifications` page in `web/src/app/(workspace)/notifications/page.tsx`
- [ ] T046 [US2] Mount notification center in candidate/recruiter header in `web/src/frontend/features/dashboard/components/workspace-shell.tsx`
- [ ] T047 [US2] Add a custom React Admin app bar with unified notification center in `web/src/frontend/features/admin/layout/admin-app-bar.tsx` and `web/src/frontend/features/admin/layout/admin-layout.tsx`

**Checkpoint**: One recipient-isolated inbox works in all authenticated modes with complete read behavior.

---

## Phase 5: User Story 3 - Workflow Outcomes (Priority: P2)

**Goal**: Applications, recruiter verification, support, connections, and messaging-report outcomes appear in the unified inbox with unchanged existing email delivery.

**Independent Test**: Trigger every supported transition and verify recipient, context, severity, destination, safe copy, deduplication, email non-regression, and legacy parity.

### Tests

- [ ] T048 [P] [US3] Add application stage and submission/authorized-company-recipient integration tests in `web/tests/backend/integration/notifications/application-notification-events.test.ts`
- [ ] T049 [P] [US3] Add all seven recruiter verification outcome tests in `web/tests/backend/integration/notifications/verification-notification-events.test.ts`
- [ ] T050 [P] [US3] Add support waiting/resolved event tests in `web/tests/backend/integration/notifications/support-notification-events.test.ts`
- [ ] T051 [P] [US3] Add five connection event, legacy read-state, and duplicate migration tests in `web/tests/backend/integration/notifications/connection-notification-events.test.ts`
- [ ] T052 [P] [US3] Add messaging/general report receipt/resolved/dismissed restricted-content tests in `web/tests/backend/integration/notifications/report-notification-events.test.ts`

### Implementation

- [ ] T053 [US3] Replace future recruitment work writes with candidate and authorized-company unified notifications in `web/src/backend/repositories/jobs/prisma-job-application-repository.ts`
- [ ] T054 [US3] Add unified application stage notification beside unchanged optional email write in `web/src/backend/services/jobs/application-stage-service.ts`
- [ ] T055 [US3] Add verification receipt/cancelled records in `web/src/backend/admin/verification/applicant-verification-service.ts`
- [ ] T056 [US3] Add verification changes/rejected/approved records in `web/src/backend/admin/verification/verification-review-service.ts` and `web/src/backend/admin/verification/verification-approval-transaction.ts`
- [ ] T057 [US3] Add delayed/expired records in `web/src/backend/admin/workers/verification-lifecycle-loop.ts`
- [ ] T058 [US3] Add support waiting/resolved unified records beside unchanged support email writes in `web/src/backend/repositories/support/prisma-support-repository.ts`
- [ ] T059 [US3] Switch connection producer writes to unified notifications while preserving email outbox writes in `web/src/backend/repositories/connections/prisma-connection-repository.ts`
- [ ] T060 [US3] Adapt connection notification list/read compatibility routes to unified service in `web/src/app/api/connections/notifications/route.ts` and `web/src/app/api/connections/notifications/[notificationId]/read/route.ts`
- [ ] T061 [US3] Add safe messaging/general report receipt and terminal outcome notifications in `web/src/backend/repositories/messaging/prisma-messaging-report-repository.ts`, `web/src/backend/admin/messaging-reports/admin-messaging-report-review-service.ts`, `web/src/backend/admin/moderation/moderation-submission-service.ts`, and `web/src/backend/admin/moderation/moderation-review-service.ts`
- [ ] T062 [US3] Bridge pending recruitment work idempotently and mark rows delivered only after complete fanout in `web/scripts/migrate-in-app-notification-legacy-data.mjs`

**Checkpoint**: Existing workflow email events and specified report/application events are represented exactly once in the unified inbox.

---

## Phase 6: User Story 4 - Contextual Clearing (Priority: P2)

**Goal**: Successfully displayed conversations and workflow details clear only matching notifications while failed/forbidden views remain unread.

**Independent Test**: Load success, loading failure, missing, and forbidden states for conversations and workflow details and compare only matching read-state changes.

### Tests

- [ ] T063 [P] [US4] Add successful/failed/forbidden conversation context-read UI tests in `web/tests/frontend/components/notifications/messaging-context-read.test.tsx`
- [ ] T064 [P] [US4] Add application, verification, support, report, and connection context-read service tests in `web/tests/backend/integration/notifications/workflow-context-read.test.ts`
- [ ] T065 [P] [US4] Add two-client polling convergence test in `web/tests/frontend/components/notifications/notification-convergence.test.tsx`

### Implementation

- [ ] T066 [US4] Invoke conversation context-read only after message history renders in `web/src/frontend/features/messaging/components/message-thread.tsx`
- [ ] T067 [US4] Synchronize unified context read with existing conversation participant unread state in `web/src/backend/notifications/notification-service.ts`
- [ ] T068 [US4] Add post-load context-read hooks for application, verification, support, connection, and report detail views in `web/src/frontend/features/notifications/client/use-notification-context-read.ts`
- [ ] T069 [US4] Integrate context-read hooks in affected workspace and administrator detail components under `web/src/frontend/features/`

**Checkpoint**: Read badges reflect content actually displayed, not routes merely visited.

---

## Phase 7: User Story 5 - In-App-Only Operational Updates (Priority: P3)

**Goal**: Application receipts, authorized company receipts, messages, and report receipts use in-app delivery without introducing new email.

**Independent Test**: Trigger each event, confirm no new email row, validate recipient/fanout and grouped message behavior, then clear via context.

### Tests

- [ ] T070 [P] [US5] Add grouped conversation notification and sender-exclusion tests in `web/tests/backend/integration/notifications/message-notification-events.test.ts`
- [ ] T071 [P] [US5] Add no-new-email assertions for application/message/report events in `web/tests/backend/integration/notifications/in-app-only-channel-policy.test.ts`

### Implementation

- [ ] T072 [US5] Create or update one bounded unread conversation notification in the message transaction in `web/src/backend/repositories/messaging/prisma-messaging-message-repository.ts`
- [ ] T073 [US5] Invalidate notification queries from existing safe messaging events in `web/src/frontend/features/messaging/client/use-chat-connection.ts`
- [ ] T074 [US5] Enforce in-app-only channel policy for application receipt, message, and report receipt events in `web/src/backend/notifications/event-policy.ts`

**Checkpoint**: Operational updates are visible without increasing email volume.

---

## Phase 8: User Story 6 - Reliability and Operations (Priority: P3)

**Goal**: Retention, diagnostics, retries, migration, and channel failures are safe, observable, and do not corrupt business state.

**Independent Test**: Inject database, email provider, stale legacy row, duplicate, malformed payload, and cleanup failures; verify sanitized diagnostics, retry behavior, state integrity, and eventual single-record recovery.

### Tests

- [ ] T075 [P] [US6] Add channel failure and transaction-boundary tests in `web/tests/backend/integration/notifications/notification-failure-isolation.test.ts`
- [ ] T076 [P] [US6] Add sanitized structured logging and correlation tests in `web/tests/security/notifications/notification-logging.test.ts`
- [ ] T077 [P] [US6] Add 90-day cleanup, retry, and originating-audit preservation tests in `web/tests/backend/integration/notifications/notification-retention.test.ts`
- [ ] T078 [P] [US6] Add architecture boundaries for server-only policy, Route Handlers, repository ownership, and no second session/transport in `web/tests/architecture/in-app-notification-boundaries.test.ts`

### Implementation

- [ ] T079 [US6] Add sanitized notification operation logger and metric hooks in `web/src/backend/notifications/notification-operations.ts`
- [ ] T080 [US6] Add expired-notification cleanup loop to existing worker composition in `web/src/backend/admin/workers/notification-retention-loop.ts` and `web/scripts/run-admin-worker.mjs`
- [ ] T081 [US6] Add bounded performance harness with documented fixtures and P95 output in `web/scripts/measure-in-app-notification-performance.mjs`
- [ ] T082 [US6] Add feature performance assertions in `web/tests/performance/notifications/in-app-notification-performance.test.ts`

**Checkpoint**: Failure and cleanup behavior meet reliability, privacy, and performance requirements.

---

## Phase 9: Cross-Cutting Completion and Release Gates

**Purpose**: Resolve all consistency findings, synchronize affected specifications, validate every severity, and prepare local-only commits.

- [ ] T083 Add focused Feature 016 command documentation and exact validation output to `spec-kit/specs/016-inapp-email-notification/quickstart.md`
- [ ] T084 Synchronize notification/read-state impacts in `spec-kit/specs/002-candidate-profile-account-management/spec.md`, `spec-kit/specs/003-job-board-and-advanced-search/spec.md`, `spec-kit/specs/006-admin-management/spec.md`, `spec-kit/specs/008-realtime-messaging/spec.md`, `spec-kit/specs/009-user-management-and-recruiter-verification/spec.md`, `spec-kit/specs/011-professional-connection-proposals/spec.md`, `spec-kit/specs/013-messaging-report-review/spec.md`, and `spec-kit/specs/014-business-verification-enrichment/spec.md`
- [ ] T085 Run Spec Kit analysis, fix every Critical/High/Medium/Low finding in `spec-kit/specs/016-inapp-email-notification/`, and rerun until none remain
- [ ] T086 Run Prisma validation/generation, migration verifier, focused notification tests, affected feature suites, typecheck, lint, full tests, and production build from repository root `.`
- [ ] T087 Review diffs for secrets, challenge tokens, private evidence, arbitrary HTML/links, generated runtime data, email template changes, and unrelated files from repository root `.`
- [ ] T088 Mark every completed task `[X]`, commit each coherent Spec Kit/implementation phase locally, and verify no push occurred in `spec-kit/specs/016-inapp-email-notification/tasks.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks all user stories.
- **US1 and US2 (Phases 3-4)** depend on Foundational and may proceed in parallel after contracts stabilize.
- **US3 (Phase 5)** depends on Foundational; legacy connection compatibility additionally depends on US2 read APIs.
- **US4 (Phase 6)** depends on US2 read APIs and relevant US3 context-producing events.
- **US5 (Phase 7)** depends on Foundational and messaging/application producer access; it may proceed beside US3.
- **US6 (Phase 8)** depends on stable persistence and event production.
- **Completion (Phase 9)** depends on every story and is required for release.

### User Story Dependencies

```text
Setup -> Foundation -> US1
                    -> US2 -> US4
                    -> US3 -> US4
                    -> US5
US1 + US2 + US3 + US4 + US5 -> US6 -> Completion
```

### Within Each Story

- Write focused tests and confirm the intended missing behavior before implementation.
- Implement shared contracts/policy before repositories and services.
- Implement services before Route Handlers and clients.
- Complete authorization, privacy, and idempotency tests before UI integration.
- Complete the independent checkpoint before advancing.

## Parallel Opportunities

- T002-T004 can run in parallel after T001.
- T005-T008 can run in parallel; T013, T014, and T017 can run in parallel after schema shape stabilizes.
- US1 test tasks T019-T023 can run in parallel.
- US2 API route tasks T035-T039 can run in parallel after T016/T018.
- US2 component, page, admin shell, and accessibility tests can run in parallel across separate files.
- US3 event-family tests T048-T052 and producer integrations T053-T061 can proceed by feature family.
- US4 tests T063-T065 can run in parallel.
- US6 security, retention, architecture, and performance tests T075-T078 can run in parallel.

## Implementation Strategy

### Technical Checkpoint First

1. Complete shared contracts, schema, migration, policy, repository, and services.
2. Complete security/account event coverage and proof exclusion.
3. Complete unified APIs and both authenticated shells.
4. Complete every workflow and in-app-only producer.
5. Complete contextual read, migration bridge, retention, and operations.
6. Run consistency and all validation gates; resolve every severity before reporting.

### Release Scope

All six stories and Phase 9 are required for Feature 016. A bell without complete producer coverage, or producers without recipient-isolated UI/read behavior, is not releasable.

### Commit Strategy

- Commit Specify, Clarify, Plan, Tasks, analysis remediation, and implementation phases separately.
- During implementation, commit coherent schema/foundation, API/UI, producer-integration, and hardening groups with their tests.
- Never stage `.claude/settings.local.json`, `web/data/jobs/applications.json`, `web/data/jobs/jobs.json`, secrets, or unrelated user changes.
- Keep all commits local and never push.

## Notes

- `[P]` means file-level parallel work with no incomplete dependency.
- Existing email templates and renderers are protected files for Feature 016 and must remain unchanged.
- Challenge/proof emails are delivery mechanisms, not inbox events.
- The feature adds no external service and no new email template.
- Existing custom Socket.IO server remains transport-only; notification persistence and authorization stay behind backend services and Route Handlers.
