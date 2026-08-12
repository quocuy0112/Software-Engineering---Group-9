# Tasks: Professional Connection Proposals

**Input**: Design documents from `spec-kit/specs/011-professional-connection-proposals/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Test-first tasks are required because consent, concurrency, authorization, privacy, retention, and cross-feature messaging behavior are security-critical.

## Phase 1: Setup

**Purpose**: Establish Feature 011 contract and verification entry points.

- [ ] T001 Add focused `test:connections` and performance scripts in `web/package.json`
- [ ] T002 [P] Add Feature 011 OpenAPI drift generator/checker in `web/scripts/generate-connection-contracts.mjs` and generated path manifest in `web/src/shared/contracts/connections/generated.ts`
- [ ] T003 [P] Add migration upgrade/fresh verification fixture in `web/scripts/verify-professional-connection-migration.mjs`
- [ ] T004 Add Feature 011 release evidence template in `spec-kit/specs/011-professional-connection-proposals/release-validation.md`

---

## Phase 2: Foundational Domain and Persistence

**Purpose**: Create shared contracts, durable state, and ports that block every user story.

- [ ] T005 [P] Add strict proposal, decision, connection, notification, admin, participant, cursor, command, and invalidation contract tests in `web/tests/shared/unit/connections/connection-contracts.test.ts` (FR-003–FR-044)
- [ ] T006 [P] Add schema/migration constraint tests for canonical pairs, active proposals, accepted connections, decisions, and retention fields in `web/tests/backend/integration/connections/connection-schema.test.ts` (FR-005–FR-008, FR-014, FR-031–FR-034)
- [ ] T007 Add proposal, decision, history, notification, connection lifecycle, email reference, and conversation archive schema changes in `web/prisma/schema.prisma` (FR-005–FR-008, FR-014, FR-025, FR-029–FR-039)
- [ ] T008 Add safe upgrade migration with canonical checks and partial unique indexes in `web/prisma/migrations/*_professional_connection_proposals/migration.sql` (FR-005–FR-008, FR-014, FR-034, SC-001–SC-002)
- [ ] T009 Generate Prisma client and add connection contract schemas in `web/src/shared/contracts/connections/` (FR-003–FR-044)
- [ ] T010 [P] Add safe domain errors and no-store HTTP helpers in `web/src/backend/connections/http/connection-route.ts` and `web/src/backend/connections/connection-errors.ts` (FR-024, FR-040)
- [ ] T011 [P] Add participant request boundary using the exclusive session/account state in `web/src/backend/connections/authorization/connection-request-boundary.ts` (FR-010, FR-040)
- [ ] T012 Add repository/service/realtime/notification ports in `web/src/backend/connections/ports/` (FR-025, FR-029, FR-036–FR-044)
- [ ] T013 Extend audit allowlists and rate-limit policies in `web/src/backend/audit/events.ts` and `web/src/backend/security/rate-limit/policies.ts` (FR-020–FR-023, FR-029–FR-030)

**Checkpoint**: Schema, contracts, boundaries, and provider ports are available to all stories.

---

## Phase 3: User Story 1 - Administrator Proposes a Connection (Priority: P1)

**Goal**: A Platform Administrator can safely create/list/inspect a bilateral proposal without creating messaging eligibility.

**Independent Test**: Create one proposal for two eligible ACTIVE accounts, including optional Support linkage, and verify both notifications but no connection or Feature 008 eligibility.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add administrator proposal REST/OpenAPI and safe projection contract tests in `web/tests/backend/contract/connections/admin-proposal.contract.test.ts` (FR-001–FR-009, FR-024, FR-027)
- [ ] T015 [P] [US1] Add real repository creation/idempotency/canonical-pair race and eligibility-negative tests in `web/tests/backend/integration/connections/admin-proposal-create.test.ts` (FR-003–FR-009, SC-001)
- [ ] T016 [P] [US1] Add administrator/recruiter/support-assignee authorization matrix tests in `web/tests/security/connections/admin-proposal-authorization.test.ts` (FR-001–FR-002, FR-024, SC-003)
- [ ] T017 [P] [US1] Add Support reference isolation tests in `web/tests/security/connections/support-proposal-boundary.test.ts` (FR-027–FR-030)
- [ ] T018 [P] [US1] Add React Admin proposal create/list/detail component and accessibility tests in `web/tests/frontend/components/connections/admin-proposals.test.tsx` and `web/tests/frontend/accessibility/connections/admin-proposals.accessibility.test.tsx` (FR-002–FR-004, FR-041)

### Implementation for User Story 1

- [ ] T019 [US1] Implement canonical pair/digest, deterministic participant/admin quota locks, admin list/detail, and transactional create repository operations in `web/src/backend/repositories/connections/prisma-connection-proposal-repository.ts` (FR-003–FR-009, FR-020–FR-023, SC-001)
- [ ] T020 [US1] Implement protected admin create/list/detail service and Support-case reference verification in `web/src/backend/connections/services/admin-proposal-service.ts` (FR-001–FR-009, FR-027–FR-028)
- [ ] T021 [US1] Add admin proposal list/create and detail Route Handlers in `web/src/app/api/admin/professional-connection-proposals/route.ts` and `web/src/app/api/admin/professional-connection-proposals/[proposalId]/route.ts` (FR-001–FR-009, FR-024, FR-040)
- [ ] T022 [US1] Add proposal-created in-app records and content-minimized email templates/outbox dispatch in `web/src/backend/connections/notifications/` and `web/src/backend/email/workers/email-outbox.ts` (FR-025–FR-026, FR-030)
- [ ] T023 [US1] Build React Admin proposal list/create/detail screens in `web/src/frontend/features/admin/professional-connections/` (FR-002–FR-004, FR-041, FR-043)
- [ ] T024 [US1] Register the closed `professional-connection-proposals` resource in `web/src/frontend/features/admin/app/admin-app.tsx`, `web/src/frontend/features/admin/app/data-provider.ts`, and the generated Feature 011 contract manifest (FR-001–FR-004, FR-040)

**Checkpoint**: Proposal initiation is usable, auditable, and independently proves no force-connect.

---

## Phase 4: User Story 2 - Participants Decide Independently (Priority: P1)

**Goal**: Each participant can safely accept or decline, with exactly one connection created only after two accepts.

**Independent Test**: First acceptance yields `PARTIALLY_ACCEPTED`; second acceptance atomically creates one accepted connection; decline yields neutral terminal state and no connection.

### Tests for User Story 2

- [ ] T025 [P] [US2] Add participant-owned list/detail/decision contract and neutral unavailable tests in `web/tests/backend/contract/connections/participant-proposal.contract.test.ts` (FR-010–FR-017, FR-024)
- [ ] T026 [P] [US2] Add concurrent decisions, accepted-to-declined withdrawal, stale version, and idempotency integration tests in `web/tests/backend/integration/connections/proposal-decisions.test.ts` (FR-011–FR-017, SC-002)
- [ ] T027 [P] [US2] Add cross-participant enumeration and symmetric notification privacy tests in `web/tests/security/connections/participant-proposal-privacy.test.ts` (FR-010, FR-013, FR-015, FR-024–FR-026, SC-003)
- [ ] T028 [P] [US2] Add participant proposal inbox/decision component and accessibility tests in `web/tests/frontend/components/connections/participant-proposals.test.tsx` and `web/tests/frontend/accessibility/connections/participant-proposals.accessibility.test.tsx` (FR-010–FR-017, FR-041)

### Implementation for User Story 2

- [ ] T029 [US2] Implement owned cursor list/detail and proposal projection retention rules in `web/src/backend/repositories/connections/prisma-connection-proposal-repository.ts` (FR-010, FR-017, FR-031, FR-043)
- [ ] T030 [US2] Implement transactional accept/decline state machine and exactly-once connection creation in `web/src/backend/connections/services/participant-proposal-service.ts` (FR-011–FR-017, FR-034, SC-002)
- [ ] T031 [US2] Add participant proposal list/detail/decision Route Handlers under `web/src/app/api/connections/proposals/` (FR-010–FR-017, FR-024, FR-040)
- [ ] T032 [US2] Add symmetric proposal-update/terminal/accepted notification rendering and email intents in `web/src/backend/connections/notifications/` (FR-014–FR-015, FR-025–FR-026, FR-030)
- [ ] T033 [US2] Add content-free `/connections` invalidation gateway and client hook in `web/src/backend/connections/realtime/`, `web/src/backend/messaging/realtime/socket-io-chat-gateway.ts`, and `web/src/frontend/features/connections/client/` (FR-025–FR-026, FR-030, SC-005)
- [ ] T034 [US2] Build responsive `/connections` participant inbox/detail/decision workspace in `web/src/app/(workspace)/connections/page.tsx` and `web/src/frontend/features/connections/` (FR-010–FR-017, FR-024–FR-026, FR-041)
- [ ] T035 [US2] Implement recipient-owned notification list/read repository, service, Route Handlers, Connections navigation, and safe inbox controls in `web/src/backend/repositories/connections/prisma-connection-notification-repository.ts`, `web/src/backend/connections/services/connection-notification-service.ts`, `web/src/app/api/connections/notifications/`, and `web/src/frontend/features/dashboard/components/workspace-navigation.tsx` (FR-025–FR-026, FR-033, FR-041)

**Checkpoint**: Bilateral consent and neutral decline are complete and independently testable.

---

## Phase 5: User Story 3 - Operate Proposal Lifecycle Safely (Priority: P1)

**Goal**: Expiry, cancellation, quotas, cooldown, blocks, and account state safely terminate or reject proposals.

**Independent Test**: Exercise every exact boundary and race; verify neutral terminal behavior, retry-safe workers, and no connection creation.

### Tests for User Story 3

- [ ] T036 [P] [US3] Add quota/cooldown/exact-expiry and authorized-administrator cancellation integration tests in `web/tests/backend/integration/connections/proposal-lifecycle.test.ts` (FR-016–FR-023)
- [ ] T037 [P] [US3] Add block/suspension/final-acceptance race tests in `web/tests/backend/integration/connections/proposal-invalidation-races.test.ts` (FR-018–FR-019, SC-003)
- [ ] T038 [P] [US3] Add safe retry/error timing and blocker/decliner non-inference tests in `web/tests/security/connections/proposal-abuse-privacy.test.ts` (FR-020–FR-026)
- [ ] T039 [P] [US3] Add lifecycle worker overlap/restart tests in `web/tests/backend/integration/connections/proposal-lifecycle-worker.test.ts` (FR-017–FR-019, FR-042)

### Implementation for User Story 3

- [ ] T040 [US3] Implement indexed quota/cooldown/account/block rechecks and retry calculations in `web/src/backend/repositories/connections/prisma-connection-proposal-repository.ts` (FR-018–FR-024)
- [ ] T041 [US3] Implement authorized-administrator versioned cancellation service and Route Handler in `web/src/backend/connections/services/admin-proposal-service.ts` and `web/src/app/api/admin/professional-connection-proposals/[proposalId]/cancel/route.ts` (FR-016–FR-017, FR-024)
- [ ] T042 [US3] Integrate the shared pair transaction lock and active-proposal cancellation into Feature 008 block creation in `web/src/backend/messaging/services/block-participant.ts` through the Feature 011 invalidation port (FR-019, FR-024, FR-026)
- [ ] T043 [US3] Integrate account-state invalidation with proposal cancellation in `web/src/backend/connections/services/proposal-authority-invalidation-service.ts` and existing admin account lifecycle publishers (FR-018, FR-024–FR-026)
- [ ] T044 [US3] Implement bounded expiry/account/block reconciliation loop in `web/src/backend/connections/workers/proposal-lifecycle-loop.ts` and register it in `web/src/backend/admin/workers/admin-worker-runtime.ts` (FR-017–FR-019, FR-042)
- [ ] T045 [US3] Add lifecycle status, cancel confirmation, quota/cooldown retry, and stale-state UI feedback in `web/src/frontend/features/admin/professional-connections/` and `web/src/frontend/features/connections/` (FR-016–FR-026, FR-041)

**Checkpoint**: Active proposals cannot outlive consent, safety, account, or abuse boundaries.

---

## Phase 6: User Story 4 - Use and End an Accepted Connection (Priority: P1)

**Goal**: Accepted connections activate Feature 008; participant disconnect immediately revokes writes while preserving archived history.

**Independent Test**: Message over an accepted connection, disconnect, verify every active write/realtime path is denied and retained history remains read-only; reconnect creates a new conversation.

### Tests for User Story 4

- [ ] T046 [P] [US4] Add connection list/disconnect contract tests and Feature 011-to-008 projection parity tests in `web/tests/backend/contract/connections/connection-disconnect.contract.test.ts` (FR-034–FR-040, FR-044)
- [ ] T047 [P] [US4] Add shared-lock disconnect/send/read/socket race and archive transaction tests in `web/tests/backend/integration/connections/connection-disconnect.test.ts` (FR-035–FR-038, SC-006)
- [ ] T048 [P] [US4] Add archived history ownership and administrator exclusion tests in `web/tests/security/connections/archived-conversation-privacy.test.ts` (FR-035, FR-038, SC-003)
- [ ] T049 [P] [US4] Add reconnection/new-conversation isolation tests in `web/tests/backend/integration/connections/connection-reconnect.test.ts` (FR-034, FR-039)
- [ ] T050 [P] [US4] Add disconnect/archived-chat component and accessibility tests in `web/tests/frontend/components/connections/connection-disconnect.test.tsx` and `web/tests/frontend/accessibility/connections/connection-disconnect.accessibility.test.tsx` (FR-035–FR-041)

### Implementation for User Story 4

- [ ] T051 [US4] Implement participant-owned connection list and transactional disconnect repository operations in `web/src/backend/repositories/connections/prisma-professional-connection-repository.ts` (FR-034–FR-036, FR-039, FR-043)
- [ ] T052 [US4] Implement connection list/disconnect service, revoked notification/email intent, and Route Handlers under `web/src/backend/connections/services/connection-service.ts`, `web/src/backend/connections/notifications/`, and `web/src/app/api/connections/` (FR-025–FR-026, FR-035–FR-040)
- [ ] T053 [US4] Split Feature 008 active communication and archived read authorization in `web/src/backend/messaging/authorization/` and `web/src/backend/messaging/ports/eligibility-provider.ts` (FR-036–FR-039, FR-044)
- [ ] T054 [US4] Update Feature 008 list/detail/history services for participant-only `READ_ONLY` projections in `web/src/backend/messaging/services/list-conversations.ts`, `web/src/backend/messaging/services/get-message-history.ts`, and shared messaging contracts (FR-037–FR-039)
- [ ] T055 [US4] Enforce shared connection/conversation transaction locks and unarchived accepted authority in Feature 008 open/send/read/presence/typing/realtime paths under `web/src/backend/messaging/services/`, `web/src/backend/repositories/messaging/`, and `web/src/backend/messaging/realtime/` (FR-036–FR-039, SC-006)
- [ ] T056 [US4] Publish post-commit authority revocation through the existing messaging realtime port in `web/src/backend/connections/services/connection-service.ts` and `web/src/backend/messaging/realtime/messaging-authority-enforcement.ts` (FR-036–FR-037)
- [ ] T057 [US4] Add participant connection/disconnect UI and `READ_ONLY` archived conversation states in `web/src/frontend/features/connections/` and `web/src/frontend/features/messaging/` (FR-035–FR-041)
- [ ] T058 [US4] Update Feature 008 dependency documentation to Feature 011 ownership in `spec-kit/specs/008-realtime-messaging/spec.md`, `spec-kit/specs/008-realtime-messaging/plan.md`, `spec-kit/specs/008-realtime-messaging/data-model.md`, and `spec-kit/specs/008-realtime-messaging/contracts/professional-connection-dependency.md` (FR-044)

**Checkpoint**: Relationship withdrawal is enforced server-side without erasing authorized history.

---

## Phase 7: User Story 5 - Review Accountability and Retention (Priority: P2)

**Goal**: Provide bounded audit accountability and exact sensitive-detail deletion.

**Independent Test**: Verify allowlisted events for every transition, 90-day ordinary suppression, step-up protected access before 365 days, and irreversible scrub at 365 days under worker overlap.

### Tests for User Story 5

- [ ] T059 [P] [US5] Add audit allowlist and forbidden-content tests in `web/tests/security/connections/connection-audit-privacy.test.ts` (FR-029–FR-030, SC-008)
- [ ] T060 [P] [US5] Add exact proposal/notification 90-day and proposal 365-day projection/deletion overlap tests in `web/tests/backend/integration/connections/proposal-retention.test.ts` (FR-031–FR-033, FR-042, SC-007)
- [ ] T061 [P] [US5] Add step-up protected audit Route Handler and administrator detail component tests in `web/tests/backend/contract/connections/protected-proposal-audit.contract.test.ts` and `web/tests/frontend/components/connections/protected-proposal-audit.test.tsx` (FR-031–FR-033, FR-041)
- [ ] T062 [P] [US5] Add log/realtime/email/support/private-message content-exclusion architecture tests in `web/tests/architecture/professional-connection-boundaries.test.ts` (FR-027–FR-033, FR-044)

### Implementation for User Story 5

- [ ] T063 [US5] Write correlated allowlisted audit/history events for all Feature 011 commands and worker transitions in `web/src/backend/connections/services/` and `web/src/backend/connections/workers/` (FR-029–FR-030)
- [ ] T064 [US5] Implement step-up protected audit projection service and Route Handler in `web/src/backend/connections/services/protected-proposal-audit-service.ts` and `web/src/app/api/admin/professional-connection-proposals/[proposalId]/protected-audit/route.ts` (FR-031–FR-033)
- [ ] T065 [US5] Implement exact read-time suppression plus bounded proposal and notification retention scrub loops in `web/src/backend/repositories/connections/`, `web/src/backend/connections/workers/proposal-retention-loop.ts`, and register the loop in `web/src/backend/admin/workers/admin-worker-runtime.ts` (FR-031–FR-033, FR-042)
- [ ] T066 [US5] Add protected audit availability/deletion state to administrator proposal detail UI in `web/src/frontend/features/admin/professional-connections/` (FR-031–FR-033, FR-041)

**Checkpoint**: Accountability is available only for approved periods and sensitive decisions are not retained indefinitely.

---

## Phase 8: Polish and Cross-Cutting Verification

- [ ] T067 [P] Add Feature 011 performance harness and representative fixture generator in `web/scripts/measure-professional-connections-performance.mjs` and `web/tests/performance/connections/` (SC-004–SC-005)
- [ ] T068 [P] Add complete administrator/participant/block/disconnect/retention Playwright journeys in `web/tests/system/e2e/connections/` (SC-001–SC-010)
- [ ] T069 [P] Add moderated usability and manual screen-reader protocols in `web/tests/usability/connections/proposal-consent-protocol.md` and `web/tests/accessibility/connections/manual-screen-reader-protocol.md` (SC-009–SC-010)
- [ ] T070 Run Prisma validation/generation/migration status, OpenAPI drift, typecheck, targeted lint/format, `test:connections`, Feature 006/Support/008 regressions, worker probe, migration verifier, production build, and documented usability/screen-reader protocols where the required environment is available; record passes or explicit non-passing blockers without claiming unexecuted evidence in `spec-kit/specs/011-professional-connection-proposals/release-validation.md` (SC-001–SC-010)
- [ ] T071 Audit canonical constraints, transaction locks, exact deadlines, neutral outputs, no admin chat reader, no support copy, content-free events, bounded workers, and `.claude/settings.local.json` exclusion; mark all tasks complete in `spec-kit/specs/011-professional-connection-proposals/tasks.md` (FR-001–FR-044)

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks every user story.
- US1 depends on Phase 2.
- US2 depends on US1 because decisions require an administrator-created proposal.
- US3 depends on US2 state transitions and may proceed before US4.
- US4 depends on US2 accepted-connection creation; it can proceed in parallel with late US3 UI work.
- US5 depends on all transition-producing stories so its audit/retention coverage is complete.
- Phase 8 depends on all selected stories.

### User Story Dependency Graph

```text
Foundation -> US1 -> US2 -> US3
                      |      |
                      +----> US4
US1 + US2 + US3 + US4 -> US5 -> Release Gates
```

### Parallel Opportunities

- T002–T004 can proceed independently.
- Foundation contract/constraint tests T005–T006 run in parallel before T007–T013.
- Within each story, tasks marked `[P]` target separate contract, integration, security, component, accessibility, architecture, or performance files.
- US3 lifecycle worker work and US4 messaging archive work can proceed concurrently after US2, provided shared schema/contracts are merged first.
- T067–T069 can proceed in parallel before T070.

## Implementation Strategy

### Consent-Safe MVP

Complete Phases 1–6. A release must include administrator proposal creation, both participant decisions, abuse/lifecycle controls, accepted Feature 008 eligibility, participant disconnect, and archived read-only history. US1 alone is demonstrable but not releasable because it does not complete bilateral consent.

### Incremental Delivery

1. Establish schema/contracts and migration safety.
2. Deliver administrator proposal initiation without messaging eligibility.
3. Deliver bilateral participant decisions and notifications.
4. Enforce expiry, cancellation, quotas, cooldown, blocks, and account state.
5. Activate accepted messaging and safe disconnect/archive behavior.
6. Complete protected audit and exact retention.
7. Run cross-feature, performance, accessibility, migration, and build gates.

## Notes

- Every generic React Admin mutation remains disabled; only explicit proposal commands may change state.
- Test tasks precede implementation tasks within each story.
- Feature 011 never queries `MessagingMessage.content`; archived reading remains inside Feature 008 participant services.
- `.claude/settings.local.json` is user-local and must never be staged or committed.
