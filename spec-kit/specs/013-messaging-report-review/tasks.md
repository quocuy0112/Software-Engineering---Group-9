# Tasks: Protected Messaging Report Review

**Input**: Design documents from `spec-kit/specs/013-messaging-report-review/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`

**Tests**: Required by the specification for contracts, authorization/privacy, concurrency/idempotency, UI behavior, and participant confirmation.

## Phase 1: Setup

**Purpose**: Establish feature contracts and schema ownership.

- [X] T001 Add shared messaging-report admin schemas in `web/src/shared/contracts/admin/messaging-reports.ts`
- [X] T002 Extend report review models in `web/prisma/schema.prisma`
- [X] T003 Add additive messaging-report review migration in `web/prisma/migrations/*_messaging_report_review/migration.sql`

---

## Phase 2: Foundational

**Purpose**: Implement metadata-only and evidence-only repository boundaries.

- [X] T004 [P] Add shared contract tests in `web/tests/shared/contracts/admin-messaging-reports.test.ts`
- [X] T005 Add dedicated repository in `web/src/backend/repositories/admin/prisma-admin-messaging-report-repository.ts`
- [X] T006 Add review service in `web/src/backend/admin/messaging-reports/admin-messaging-report-review-service.ts`
- [X] T007 [P] Add architecture/privacy tests in `web/tests/architecture/messaging-report-review-boundaries.test.ts`

**Checkpoint**: Schema, contracts, safe projections, and transaction boundary are ready.

---

## Phase 3: User Story 1 - Review a dedicated queue (Priority: P1)

**Goal**: Administrators can find participant messaging reports without exposing report or message content in the list.

**Independent Test**: Submit a report, open the dedicated queue, filter it, and verify only safe metadata appears.

### Tests

- [X] T008 [P] [US1] Add list repository tests in `web/tests/backend/integration/admin-management/messaging-report-review.test.ts`
- [X] T009 [P] [US1] Add list UI tests in `web/tests/frontend/components/admin-management/messaging-report-list.test.tsx`

### Implementation

- [X] T010 [US1] Add list route in `web/src/app/api/admin/messaging-reports/route.ts`
- [X] T011 [US1] Add queue UI in `web/src/frontend/features/admin/messaging-reports/messaging-report-list.tsx`
- [X] T012 [US1] Register endpoint/resource in `web/src/frontend/features/admin/app/data-provider.ts` and `web/src/frontend/features/admin/app/admin-app.tsx`

**Checkpoint**: The dedicated metadata-only queue is independently usable.

---

## Phase 4: User Story 2 - Inspect submitted evidence (Priority: P1)

**Goal**: A freshly authorized administrator can inspect only the reporter detail and selected evidence message.

**Independent Test**: Open a report with valid, missing, and mismatched evidence; verify one message or an unavailable state and never conversation history.

### Tests

- [X] T013 [P] [US2] Add protected detail route/repository tests in `web/tests/backend/integration/admin-management/messaging-report-review.test.ts`
- [X] T014 [P] [US2] Add detail UI tests in `web/tests/frontend/components/admin-management/messaging-report-review-show.test.tsx`
- [X] T015 [P] [US2] Add sensitive-proof and no-store tests in `web/tests/security/admin-management/messaging-report-review.test.ts`

### Implementation

- [X] T016 [US2] Add protected detail route in `web/src/app/api/admin/messaging-reports/[reportId]/route.ts`
- [X] T017 [US2] Add evidence-only detail UI in `web/src/frontend/features/admin/messaging-reports/messaging-report-review-show.tsx`

**Checkpoint**: Protected evidence can be reviewed without administrator conversation browsing.

---

## Phase 5: User Story 3 - Record review decisions (Priority: P1)

**Goal**: Administrators can assign, note, resolve, dismiss, and link separate enforcement with immutable audit history.

**Independent Test**: Exercise every command, retry the same key, issue a stale command, and verify one atomic version/history/note/audit outcome.

### Tests

- [X] T018 [P] [US3] Add command idempotency/state tests in `web/tests/backend/integration/admin-management/messaging-report-review.test.ts`
- [X] T019 [P] [US3] Add action panel tests in `web/tests/frontend/components/admin-management/messaging-report-action-panel.test.tsx`

### Implementation

- [X] T020 [US3] Add command route in `web/src/app/api/admin/messaging-reports/[reportId]/[action]/route.ts`
- [X] T021 [US3] Add action panel in `web/src/frontend/features/admin/messaging-reports/messaging-report-action-panel.tsx`
- [X] T022 [US3] Render private notes and immutable history in `web/src/frontend/features/admin/messaging-reports/messaging-report-review-show.tsx`

**Checkpoint**: Review commands are safe, idempotent, versioned, and auditable.

---

## Phase 6: User Story 4 - Confirm protected review (Priority: P2)

**Goal**: The participant receives an accurate, non-promissory submission confirmation.

**Independent Test**: Submit a report and verify confirmation states it was queued for protected review.

- [X] T023 [P] [US4] Add confirmation-copy test in `web/tests/frontend/components/messaging/report-dialog.test.tsx`
- [X] T024 [US4] Update report confirmation in `web/src/frontend/features/messaging/components/report-messaging-dialog.tsx`

---

## Phase 7: Polish and Verification

**Purpose**: Validate generated client, quality, privacy, and performance claims.

- [X] T025 Generate Prisma client and run focused contract/backend/frontend/security/architecture tests
- [X] T026 Run typecheck and lint, then fix feature-local failures
- [X] T027 Validate `spec-kit/specs/013-messaging-report-review/quickstart.md` and record the 10,000-report performance evidence when a representative database is available

---

## Dependencies and Execution Order

- Phase 1 blocks repository/service work.
- Phase 2 blocks all user stories.
- User Story 1 establishes navigation and list projection; User Stories 2 and 3 share its record contract.
- User Story 4 is independent after foundational contracts.
- Phase 7 follows all implemented stories.

## Parallel Opportunities

- Contract and architecture tests can be authored in parallel after schema design.
- Backend and UI tests for each user story touch separate files.
- Participant confirmation work is independent from administrator review implementation.

## Implementation Strategy

1. Complete schema/contracts and repository privacy boundary.
2. Deliver the metadata-only queue.
3. Add sensitive evidence-only detail.
4. Add atomic review commands and history.
5. Improve participant confirmation and run focused validation.
