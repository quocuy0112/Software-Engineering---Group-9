
---
description: "Dependency-ordered implementation tasks for Feature 008 realtime messaging"
---

# Tasks: Realtime Messaging and Communication

**Input**: Design documents from `spec-kit/specs/008-realtime-messaging/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`

**Tests**: Required by the specification. Within each story, create failing
contract/integration/component tests before the corresponding implementation.

**Organization**: Tasks are grouped and executed in the approved delivery order:
US1 -> US2 -> US3 -> US5 -> US6 -> US4, followed by performance,
accessibility, and cross-story release gates. All 78 original tasks are retained;
two remediation tasks are added for the formal eligibility boundary and Profile
entry point.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel after its phase prerequisites because it changes
  different files and does not depend on an incomplete task in the same batch.
- **[Story]**: Maps work to the numbered user story in `spec.md`.
- Every task names the exact repository file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lock the approved dependencies and establish focused commands
without implementing messaging behavior.

- [X] T001 Add exact `socket.io` and `socket.io-client` 4.8.3 dependencies, verify and retain exact `tsx` 4.23.1 in production `dependencies`, and add `test:messaging`, `test:messaging:e2e`, and `perf:messaging` scripts in `web/package.json`, root `package.json`, and `package-lock.json`
- [X] T002 [P] Create the public messaging contract barrel and domain-error skeleton in `web/src/shared/contracts/messaging/index.ts` and `web/src/backend/messaging/messaging-errors.ts`
- [X] T003 [P] Add Feature 008 environment/startup contract for one-process realtime readiness in the existing environment parser `web/src/backend/env/server.ts` and `web/.env.example`
- [X] T004 Add the Feature 008 regression/architecture allowlist skeleton without permitting out-of-scope capabilities in `web/tests/architecture/realtime-messaging-boundaries.test.ts`

**Checkpoint**: Dependencies and test entrypoints are declared; no production
chat path is exposed.

---

## Phase 2: Foundational (Schema and Trust Boundaries)

**Purpose**: Build the database, contracts, authority ports, and fixtures that
block every user story.

**CRITICAL**: No user story implementation begins until this phase passes.

- [X] T005 Add the minimal Feature 007-owned `ProfessionalConnection` canonical pair plus `ACCEPTED` state, `MessagingConversationContextType`, `MessagingReportTargetType`, `MessagingConversation`, `MessagingConversationParticipant`, `MessagingMessage`, `UserMessagingBlock`, `MessagingReport`, and required existing-model relations/constraints to `web/prisma/schema.prisma`
- [X] T006 Create safe forward/recovery SQL, uniqueness/check constraints, foreign keys, and indexes for Feature 008 in `web/prisma/migrations/023_realtime_messaging/migration.sql`
- [X] T007 Regenerate the Prisma client after T005-T006 and verify migration sequencing in `web/src/backend/generated/prisma/` and `web/tests/backend/integration/messaging/messaging-migration.test.ts`
- [X] T008 [P] Define strict Zod schemas and safe projections for eligible participants, conversations, messages, cursors, read boundaries, blocks, reports, and errors in `web/src/shared/contracts/messaging/common.ts`, `web/src/shared/contracts/messaging/conversations.ts`, and `web/src/shared/contracts/messaging/messages.ts`
- [X] T009 [P] Define typed `/chat` client/server event maps and acknowledgement unions matching `contracts/socket-events.md` in `web/src/shared/contracts/messaging/socket-events.ts`
- [X] T010 [P] Define repository, `canMessage(userA, userB)` eligibility, realtime publication, presence/socket-registry, and enforcement ports in `web/src/backend/messaging/ports/messaging-repository.ts`, `web/src/backend/messaging/ports/eligibility-provider.ts`, and `web/src/backend/messaging/ports/realtime-publisher.ts`
- [X] T011 Implement the shared HTTP/socket `MessagingRequestBoundary` over existing Better Auth session, account-state, exact-origin, CSRF, safe error handling, and mandatory `Cache-Control: no-store` on every messaging REST success/error response in `web/src/backend/messaging/authorization/messaging-request-boundary.ts` and `web/src/backend/messaging/http/messaging-route.ts`
- [X] T012 Implement the formal `MessagingEligibilityService.canMessage(userA, userB)` boundary over existing application/company eligibility and the minimal Feature 007 accepted-connection provider in `web/src/backend/messaging/authorization/messaging-eligibility-service.ts`, `web/src/backend/messaging/authorization/application-messaging-eligibility.ts`, and `web/src/backend/messaging/authorization/professional-connection-eligibility.ts`
- [X] T013 [P] Extend existing rate-limit policy definitions for participant discovery, conversation creation, send, block, and report admission in `web/src/backend/security/rate-limit/policies.ts`
- [X] T014 Create two-user, multi-company, application, connection, block, conversation, and message fixtures in `web/tests/backend/integration/messaging/fixtures.ts` and `web/tests/system/e2e/fixtures/messaging.ts`
- [X] T015 Add focused unit tests for `canMessage()` covering accepted connection only, application only, both providers, and neither provider in `web/tests/backend/unit/messaging/messaging-eligibility-service.test.ts`

**Checkpoint**: Clean database migration succeeds; typed trust boundaries and
fixtures exist; direct JWT/global-role assumptions are structurally absent.

---

## Phase 3: User Story 1 - Start an Eligible Professional Conversation (Priority: P1)

**Goal**: Discover only eligible people/contexts and create one authoritative
context-scoped direct conversation.

**Independent Test**: Search/open the same conversation concurrently for
eligible and ineligible pairs across two companies; prove one row, safe
projections, neutral denials, and current membership enforcement.

### Tests for User Story 1

- [X] T016 [P] [US1] Add OpenAPI/Zod parity, mandatory success/error `Cache-Control: no-store`, and safe-response contract tests for eligible participant and conversation create/list shapes in `web/tests/backend/contract/messaging/conversation-contract.test.ts`
- [X] T017 [P] [US1] Add integration tests for application eligibility, Feature 007 connection eligibility, neutral discovery, canonical pair/context uniqueness, concurrent creation, and cross-company denial in `web/tests/backend/integration/messaging/conversation-eligibility.test.ts`
- [X] T018 [P] [US1] Add component/accessibility tests for eligible search, explicit context selection, loading/empty/error states, and keyboard conversation creation in `web/tests/frontend/components/messaging/conversation-start.test.tsx` and `web/tests/frontend/accessibility/messaging/conversation-start.accessibility.test.tsx`

### Implementation for User Story 1

- [X] T019 [US1] Implement eligible participant/context queries with bounded neutral search projections in `web/src/backend/repositories/messaging/prisma-messaging-eligibility-repository.ts`
- [X] T020 [US1] Implement transactional canonical pair/context conversation creation and duplicate recovery in `web/src/backend/repositories/messaging/prisma-messaging-conversation-repository.ts`
- [X] T021 [US1] Implement eligible search and open-conversation services with current account/application/membership/connection checks plus privacy-minimized creation/denial audit in `web/src/backend/messaging/services/find-eligible-participants.ts` and `web/src/backend/messaging/services/open-conversation.ts`
- [X] T022 [US1] Implement `GET /api/messaging/eligible-participants` in `web/src/app/api/messaging/eligible-participants/route.ts`
- [X] T023 [US1] Implement `POST /api/messaging/conversations` and initial `GET` shell contract in `web/src/app/api/messaging/conversations/route.ts`
- [X] T024 [P] [US1] Create authenticated `/messages` page bootstrap and safe server context in `web/src/app/(workspace)/messages/page.tsx` and `web/src/backend/messaging/services/get-messaging-page-context.ts`
- [X] T025 [US1] Build eligible-person search/context picker and new-conversation dialog in `web/src/frontend/features/messaging/components/start-conversation.tsx` and `web/src/frontend/features/messaging/client/messaging-api.ts`
- [X] T026 [US1] Add localized Messages navigation/icon and entry-point wiring in `web/src/frontend/features/dashboard/components/workspace-navigation.tsx` and `web/src/frontend/features/dashboard/client/workspace-locale.tsx`
- [X] T027 [US1] Add an authorized public professional profile route and `Message` button that selects an eligible context, calls `POST /api/messaging/conversations`, and redirects to the returned thread, including canonical pair/context duplicate recovery when the conversation already exists, in `web/src/app/(workspace)/people/[userId]/page.tsx`, `web/src/frontend/features/profile/components/public-professional-profile.tsx`, `web/src/frontend/features/profile/components/profile-message-action.tsx`, and `web/tests/frontend/components/messaging/profile-message-action.test.tsx`

**Checkpoint**: Conversation discovery and creation work through REST with no
realtime server present and are independently demonstrable.

---

## Phase 4: User Story 2 - Exchange Durable Text Messages (Priority: P1)

**Goal**: Add one same-process Socket.IO gateway that persists/idempotently
accepts text before acknowledgement and broadcast, with reconnect recovery.

**Independent Test**: Send online/offline/retried/concurrent messages through a
real client connection, inject commit/ack/disconnect failures, and prove one
durable ordered row, no pre-commit broadcast, safe failure, and REST recovery.

### Tests for User Story 2

- [X] T028 [P] [US2] Add typed event/Zod parity tests for `/chat` handshake, join/leave, `message:send` acknowledgement, `message:new`, `message:read`, and safe errors in `web/tests/backend/contract/messaging/socket-contract.test.ts`
- [X] T029 [P] [US2] Add real Socket.IO server/client integration tests for cookie/origin authentication, auto-join of all authorized rooms, idempotent explicit join, list-only `message:new` delivery without opening a thread, per-recipient emit-time `canMessage()` revalidation, force-leave races, commit-before-broadcast, acknowledgement retry, idempotent replay, and disconnect gaps in `web/tests/backend/integration/messaging/socket-message-gateway.test.ts`
- [X] T030 [P] [US2] Add barrier-synchronized repository tests for sequence allocation, sender/client-operation uniqueness, mismatched replay denial, and conversation last-message transaction rollback in `web/tests/backend/integration/messaging/message-send.test.ts`
- [X] T031 [P] [US2] Add component tests for local pending, sent, read, failed/retry, duplicate event reconciliation, reconnecting, and composer validation in `web/tests/frontend/components/messaging/message-composer.test.tsx`

### Implementation for User Story 2

- [X] T032 [US2] Add the minimal same-process Next.js/Socket.IO composition entrypoint, `/chat` upgrade handling outside Route Handlers, and production-safe startup/error lifecycle in `web/server.ts`
- [X] T033 [US2] Switch workspace/root dev and production scripts to `node --conditions=react-server --import tsx server.ts` while retaining `next build` in `web/package.json` and root `package.json`
- [X] T034 [US2] Implement namespace handshake cookie/origin validation, server-side socket identity, `userId -> Set<socketId>` and bidirectional conversation socket indexes, database-backed auto-join of every authorized conversation room, account rooms, and idempotent authorized join/leave in `web/src/backend/messaging/realtime/socket-io-chat-gateway.ts`
- [X] T035 [US2] Implement transactional sequence allocation, idempotent retry lookup, immutable insert, and last-message update in `web/src/backend/repositories/messaging/prisma-messaging-message-repository.ts`
- [X] T036 [US2] Implement validated send orchestration with fresh session/context/block checks, committed persistence, and per-room-member `canMessage(sender, member)` revalidation immediately before post-commit publication in `web/src/backend/messaging/services/send-message.ts`
- [X] T037 [US2] Register `message:send` acknowledgement plus recipient-filtered `message:new` handlers and stable safe error mapping in `web/src/backend/messaging/realtime/register-chat-events.ts`
- [X] T038 [P] [US2] Implement the SSR-safe singleton `/chat` WebSocket-transport client, bounded acknowledgement retry, lifecycle subscription cleanup, and credential-free configuration in `web/src/frontend/features/messaging/client/chat-socket.ts`
- [X] T039 [US2] Implement plain-text composer normalization, pending/sent/failed reconciliation, explicit retry, and duplicate event suppression in `web/src/frontend/features/messaging/components/message-composer.tsx` and `web/src/frontend/features/messaging/client/use-send-message.ts`
- [X] T040 [US2] Publish committed REST read boundaries as `message:read` and reconcile them monotonically in `web/src/backend/messaging/realtime/messaging-realtime-publisher.ts` and `web/src/frontend/features/messaging/client/use-chat-events.ts`
- [X] T041 [US2] Implement reconnect purge/refetch and server-driven full authorized-room rejoin flow plus logout cleanup without local/session storage in `web/src/frontend/features/messaging/client/use-chat-connection.ts`

**Checkpoint**: Two eligible participants exchange one-to-one durable text in
realtime and recover authoritative history after disconnect/reload.

---

## Phase 5: User Story 3 - Review Conversations and Read State (Priority: P1)

**Goal**: Complete REST list/history/read recovery before adding realtime
delivery.

**Independent Test**: Seed 100 conversations and more than one 20-message page,
then prove stable ordering, ownership/context isolation, exact unread counts,
monotonic reads, and no cursor duplicates.

### Tests for User Story 3

- [X] T042 [P] [US3] Add contract tests for conversation list, 20-message history, cursor errors, read input/output, and no-store envelopes in `web/tests/backend/contract/messaging/history-read-contract.test.ts`
- [X] T043 [P] [US3] Add repository/integration tests for stable list/history cursors, equal-time records, exact sequence order, unread counts, monotonic/repeated/stale read updates, and context loss in `web/tests/backend/integration/messaging/history-read.test.ts`
- [X] T044 [P] [US3] Add component tests for list ordering, unread badges, load-older recovery, selected thread, sent/read labels, and mobile list/thread navigation in `web/tests/frontend/components/messaging/conversation-workspace.test.tsx`

### Implementation for User Story 3

- [X] T045 [US3] Implement authorized conversation summary, history cursor, unread-count, and monotonic read repository methods in `web/src/backend/repositories/messaging/prisma-messaging-conversation-repository.ts`
- [X] T046 [US3] Implement list/history/read application services and privacy-safe projections in `web/src/backend/messaging/services/list-conversations.ts`, `web/src/backend/messaging/services/get-message-history.ts`, and `web/src/backend/messaging/services/mark-conversation-read.ts`
- [X] T047 [US3] Complete `GET /api/messaging/conversations` in `web/src/app/api/messaging/conversations/route.ts`
- [X] T048 [US3] Implement `GET /api/messaging/conversations/[conversationId]/messages` in `web/src/app/api/messaging/conversations/[conversationId]/messages/route.ts`
- [X] T049 [US3] Implement `POST /api/messaging/conversations/[conversationId]/read` with CSRF and monotonic conflict handling in `web/src/app/api/messaging/conversations/[conversationId]/read/route.ts`
- [X] T050 [P] [US3] Implement paginated REST client queries and authoritative cache keys in `web/src/frontend/features/messaging/client/use-conversations.ts` and `web/src/frontend/features/messaging/client/use-message-history.ts`
- [X] T051 [US3] Build the responsive list/thread shell, 20-message load-older flow, unread/read projections, and no-data/error states in `web/src/frontend/features/messaging/components/messaging-workspace.tsx`, `web/src/frontend/features/messaging/components/conversation-list.tsx`, and `web/src/frontend/features/messaging/components/message-thread.tsx`
- [X] T052 [US3] Add responsive/token-based messaging styles without MUI or foreign template CSS in `web/src/frontend/features/messaging/styles/messaging.css` and import them from `web/src/app/(workspace)/messages/page.tsx`

**Checkpoint**: Offline-style messaging history and read recovery are complete;
the REST contracts are authoritative before Socket.IO integration.

---

## Phase 6: User Story 5 - Block and Unblock a Participant (Priority: P2)

**Goal**: Enforce a directional block choice with immediate bidirectional
communication/presence effect and retained pre-block history.

**Independent Test**: Race block with send across two sockets, attempt reverse
unblock/direct events, and prove no post-block message, safe shared status,
history access, and fresh eligibility after unblock.

### Tests for User Story 5

- [X] T053 [P] [US5] Add REST contract and component/accessibility tests for idempotent block/unblock, success/error `Cache-Control: no-store`, safe shared status, dialog confirmation, retained history, and disabled composer in `web/tests/backend/contract/messaging/block-contract.test.ts` and `web/tests/frontend/components/messaging/block-controls.test.tsx`
- [X] T054 [P] [US5] Add transaction/race integration tests for both block directions, block-vs-send ordering, actor-only unblock, immediate socket-registry force-leave, emit-time delivery denial when leave races, presence suppression, and membership loss after unblock in `web/tests/backend/integration/messaging/block-enforcement.test.ts`

### Implementation for User Story 5

- [X] T055 [US5] Implement bidirectional block lookup plus idempotent actor-owned create/delete methods in `web/src/backend/repositories/messaging/prisma-user-messaging-block-repository.ts`
- [X] T056 [US5] Implement block/unblock services with audit, fresh eligibility, and after-commit enforcement publication in `web/src/backend/messaging/services/block-participant.ts` and `web/src/backend/messaging/services/unblock-participant.ts`
- [X] T057 [US5] Implement `POST`/`DELETE /api/messaging/blocks/[targetUserId]` with CSRF, idempotency, neutral denial, and rate limiting in `web/src/app/api/messaging/blocks/[targetUserId]/route.ts`
- [X] T058 [US5] On block/revoke, look up affected active sockets, force-leave shared rooms, update bidirectional registry indexes, emit safe `conversation:access_revoked`, and suppress pair presence in `web/src/backend/messaging/realtime/messaging-realtime-publisher.ts`
- [X] T059 [US5] Build localized block/unblock confirmation, blocked banner, report continuation, focus restoration, and composer disablement in `web/src/frontend/features/messaging/components/block-participant-dialog.tsx` and `web/src/frontend/features/messaging/components/message-thread.tsx`

**Checkpoint**: Blocking is authoritative in both HTTP and socket paths and does
not erase evidence/history.

---

## Phase 7: User Story 6 - Report Harmful Communication (Priority: P2)

**Goal**: Store one protected pending messaging report and neutral receipt with
no Administrator message browser.

**Independent Test**: Submit valid/duplicate/unauthorized/quota reports with an
optional same-conversation message reference and prove one protected record,
safe audit, and zero disclosure through ordinary views.

### Tests for User Story 6

- [X] T060 [P] [US6] Add REST/Zod contract tests for report target/category/detail/evidence validation, success/error `Cache-Control: no-store`, and the neutral `REPORT_RECEIVED` receipt in `web/tests/backend/contract/messaging/report-contract.test.ts`
- [X] T061 [P] [US6] Add integration/privacy-canary tests for participant/evidence authorization, 24-hour unresolved dedupe, quota, audit minimization, and absence from current Admin/Candidate/Recruiter reads in `web/tests/backend/integration/messaging/messaging-report.test.ts`
- [X] T062 [P] [US6] Add keyboard/focus/component tests for report category, optional detail/evidence, validation, success, retry, and block-independent state in `web/tests/frontend/components/messaging/report-dialog.test.tsx`

### Implementation for User Story 6

- [X] T063 [US6] Implement protected report relationship, dedupe, quota, insert, and neutral receipt persistence in `web/src/backend/repositories/messaging/prisma-messaging-report-repository.ts`
- [X] T064 [US6] Implement report service with shared moderation categories, normalized detail, privacy-minimized audit, and no current Admin projection in `web/src/backend/messaging/services/report-messaging.ts`
- [X] T065 [US6] Implement `POST /api/messaging/reports` with CSRF, idempotency, rate limiting, and neutral errors in `web/src/app/api/messaging/reports/route.ts`
- [X] T066 [US6] Build the localized report dialog and safe receipt/error flow in `web/src/frontend/features/messaging/components/report-messaging-dialog.tsx` and `web/src/frontend/features/messaging/client/messaging-api.ts`

**Checkpoint**: Report submission is durable and private; resolution/UI access
for administrators remains absent by design.

---

## Phase 8: User Story 4 - See Approximate Availability (Priority: P3)

**Goal**: Add privacy-limited, multi-tab-aware, memory-only online/offline state.

**Independent Test**: Connect/disconnect up to three sockets for one account and
prove coarse presence only reaches authorized partners, does not flicker on one
tab close, and leaves no last-seen database record.

### Tests for User Story 4

- [X] T067 [P] [US4] Add fake-clock/multi-socket integration tests for presence counting, disconnect grace, unauthorized suppression, process reset, and no persistence in `web/tests/backend/integration/messaging/presence-registry.test.ts`

### Implementation for User Story 4

- [X] T068 [US4] Build multi-tab presence counts and disconnect grace on the foundational account/session/socket/conversation registry, including memory reset behavior, in `web/src/backend/messaging/realtime/messaging-presence-registry.ts`
- [X] T069 [US4] Emit `presence:changed` only to currently authorized conversation partners and suppress blocked pairs in `web/src/backend/messaging/realtime/socket-io-chat-gateway.ts`
- [X] T070 [US4] Render approximate localized online/offline labels with non-color semantics in `web/src/frontend/features/messaging/components/conversation-header.tsx` and `web/src/frontend/features/messaging/client/use-chat-events.ts`

**Checkpoint**: Presence improves the live thread but cannot disclose exact or
unauthorized activity.

---

## Phase 9: Polish, Enforcement, and Release Gates

**Purpose**: Prove cross-story constitutional behavior and the complete MVP.

- [X] T071 Integrate post-commit session/account/company-membership, Feature 007 connection deletion, and report-driven suspension enforcement signals with the socket registry in `web/src/backend/services/session/session-service.ts`, `web/src/backend/admin/accounts/admin-account-service.ts`, `web/src/backend/admin/memberships/admin-membership-service.ts`, and `web/src/backend/messaging/realtime/messaging-realtime-publisher.ts`
- [X] T072 [P] Add security/privacy/tenant matrix tests for revoked sessions, suspended accounts, removed memberships/connections, report-driven suspension, forged room/event calls, outbound emit races, cross-company contexts, logs, URLs, caches, DOM, and report/message canaries in `web/tests/security/realtime-messaging/authorization-privacy.test.ts`
- [X] T073 [P] Complete architecture tests that forbid JWT/browser credential storage, a second service/database/broker, MUI/template leakage, per-message receipts, unrestricted messaging, and every Post-MVP capability in `web/tests/architecture/realtime-messaging-boundaries.test.ts`
- [X] T074 [P] Complete keyboard, live-region, contrast, responsive, and zero serious/critical axe coverage for all six stories in `web/tests/frontend/accessibility/messaging/messaging-workspace.accessibility.test.tsx`
- [X] T075 Add two-real-browser online/offline/reload/read/reconnect journey coverage for Candidate and Recruiter accounts in `web/tests/system/e2e/messaging/two-user-messaging.spec.ts`
- [X] T076 Add two-real-browser block/report/session-revocation/membership-loss and multi-tab presence coverage in `web/tests/system/e2e/messaging/messaging-safety.spec.ts`
- [X] T077 Implement the documented 100-conversation/10,000-message performance harness and result assertions for SC-002/SC-005 in `web/scripts/measure-messaging-performance.mjs` and `web/tests/performance/messaging/messaging-performance.test.ts`
- [X] T078 Implement indefinite default message retention, deleted-account sender anonymization as `Deleted user`, and at-least-90-day report-evidence holds independent of account deletion, with lifecycle tests in `web/src/backend/messaging/services/apply-messaging-data-lifecycle.ts` and `web/tests/backend/integration/messaging/messaging-retention-deletion.test.ts`
- [X] T079 Add and execute a representative two-person first-conversation usability protocol for SC-011 in `web/tests/usability/realtime-messaging/first-conversation-protocol.md`
- [X] T080 Run and record `quickstart.md` focused tests, job-board/admin regressions, typecheck, production build/start smoke, custom-server shutdown, and out-of-scope absence in `spec-kit/specs/008-realtime-messaging/quickstart.md`

**Final Checkpoint**: All six stories, hard authorization/privacy/data-integrity
gates, performance evidence, accessibility, and regressions pass. The relaxed\ndeadline does not waive or remove any task.

---

---

## Delivery Allocation

The estimate assumes two developers with code review support, existing
authentication/application/admin fixtures, and no one-day deadline. A day is one
focused developer-day; calendar weeks include integration and review margin.

| Window                                | Scope                                                                                         | Tasks     | Estimated effort  | Exit evidence                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ----------------- | ---------------------------------------------------------------------------------------- |
| Week 0, Days 1-2                      | Minimal Feature 007 accepted-connection dependency and architecture setup                     | T001-T007 | 4 developer-days  | Migration and production entrypoint dependencies are reviewable.                         |
| Week 1, Days 1-5                      | Shared contracts, authorization, `canMessage()`, fixtures                                     | T008-T015 | 8 developer-days  | Foundation and eligibility matrix pass.                                                  |
| Week 2, Days 1-5                      | US1 conversation discovery/create plus Profile entry point                                    | T016-T027 | 10 developer-days | Eligible/ineligible, concurrent open, and duplicate redirect flows pass.                 |
| Week 3, Days 1-5                      | US2 custom server, Socket.IO delivery, auto-join, reconnect                                   | T028-T041 | 14 developer-days | Two authorized users exchange durable messages; list-only realtime and race checks pass. |
| Week 4, Days 1-5                      | US3 list/history/read state and responsive workspace                                          | T042-T052 | 11 developer-days | Cursor, unread/read, mobile, and offline recovery checks pass.                           |
| Week 5, Days 1-3                      | US5 block/unblock and force-leave enforcement                                                 | T053-T059 | 7 developer-days  | Block/send race and outbound privacy backstop pass.                                      |
| Week 5, Days 4-5 and Week 6, Days 1-2 | US6 private report submission and retention linkage                                           | T060-T066 | 7 developer-days  | Dedupe, quota, privacy canary, and neutral receipt pass.                                 |
| Week 6, Days 3-5                      | US4 approximate presence on the shared socket registry                                        | T067-T070 | 4 developer-days  | Multi-tab and authorized-presence tests pass.                                            |
| Week 7, Days 1-5                      | Cross-story enforcement, E2E, performance, retention, accessibility, usability, release smoke | T071-T080 | 14 developer-days | All release gates and documented evidence pass.                                          |

Total estimate: approximately **79 developer-days**, or about **7 calendar
weeks with two developers** after review/integration margin. Performance and
accessibility remain mandatory but are scheduled last because they qualify the
complete behavior rather than establish the core messaging workflow.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependency.
- **Phase 2 Foundation**: Depends on T001-T004 and blocks every story. The minimal
  Feature 007 accepted-connection slice is completed in T005-T007 immediately
  before Feature 008 messaging schema/services consume it.
- **Phase 3 US1**: Depends on all Foundation tasks.
- **Phase 4 US2**: Depends on US1 conversation creation and shared event/authority
  contracts; it establishes the same-process gateway and durable send.
- **Phase 5 US3**: Depends on US1 and US2; it completes authoritative list,
  history, unread/read, and reconnect presentation.
- **Phase 6 US5**: Depends on the gateway, socket registry, and durable send.
- **Phase 7 US6**: Depends on conversation/history identity and may begin after
  US5 server contracts stabilize.
- **Phase 8 US4**: Depends on the working foundational socket registry and all
  safety suppression rules.
- **Phase 9 Release Gates**: Depends on all six stories.

### User Story Dependency Graph

```text
Feature 007 minimal accepted connection
                  |
                  v
              Foundation
                  |
                  v
                 US1
                  |
                  v
                 US2
                  |
                  v
                 US3
                  |
                  v
                 US5
                  |
                  v
                 US6
                  |
                  v
                 US4
                  |
                  v
     Performance / accessibility / release
```

### Within Each Story

1. Add failing contract/integration/component tests.
2. Complete repository/data behavior.
3. Complete service authorization and business rules.
4. Expose transport endpoints/events.
5. Integrate accessible UI and recovery.
6. Run the story's independent checkpoint before advancing.

## Parallel Opportunities

The original **28** `[P]` opportunities are retained unchanged:

- T002-T004 may proceed in parallel after T001, subject to their markers.
- Foundation contract/port/rate-limit tasks marked `[P]` may proceed after T005
  stabilizes; migration/client generation and `canMessage()` tests stay
  sequential.
- Within US1, the four marked contract/integration/UI/page tasks can proceed in
  their existing parallel batches.
- Within US2, the five marked socket/repository/UI/client tasks can proceed after
  the shared event maps stabilize.
- Within US3, the four marked contract/integration/UI/client tasks can proceed
  against frozen REST contracts.
- US5, US6, and US4 retain their marked story-local test opportunities, but the
  delivery priority remains US5 -> US6 -> US4.
- The three marked Phase 9 security/architecture/accessibility tasks can proceed
  in parallel after all story behavior is integrated.

## Parallel Examples

### US1 test batch

```text
Conversation contract tests
Eligibility/concurrency integration tests
Conversation-start UI/accessibility tests
Authenticated page bootstrap
```

### US2 transport batch

```text
Typed socket contract tests
Real gateway auto-join/list-only delivery/race tests
Transaction/idempotency tests
Composer/reconciliation tests
Client transport against frozen event maps
```

### Final quality batch

```text
Security/privacy/tenant matrix
Architecture boundary suite
Accessibility qualification
```

## Implementation Strategy

### Approved sequential delivery

1. T001-T015: production dependency, minimal Feature 007 slice, schema,
   migration, contracts, `canMessage()`, authority, and fixtures.
2. T016-T027: US1 conversation discovery/create and Profile entry point.
3. T028-T041: US2 same-process Socket.IO gateway, durable send, auto-join,
   emit-time recipient checks, and reconnect.
4. T042-T052: US3 conversation list/history/read and responsive workspace.
5. T053-T059: US5 block/unblock and force-leave enforcement.
6. T060-T066: US6 protected report submission.
7. T067-T070: US4 approximate presence.
8. T071-T080: cross-story enforcement, E2E, retention, performance,
   accessibility, usability, and production smoke.

### Technical checkpoints

- **Checkpoint A**: Clean migration plus application/connection eligibility
  matrix.
- **Checkpoint B**: Conversation open from search and Profile is duplicate-safe.
- **Checkpoint C**: Exactly-once-visible durable send reaches open threads and
  list-only recipients; reconnect works.
- **Checkpoint D**: List/history/read recovery remains authoritative.
- **Checkpoint E**: Block force-leave, report privacy, then presence pass.
- **Checkpoint F**: All release gates and regressions pass.

### Release scope

No individual story is a releasable version of Feature 008. The approved MVP is
US1-US6 plus Phase 9 because the specification requires durable recovery, safety
controls, authorization, and verification. Group chat, attachments, typing,
message mutation, pinning, calls, message search/export, exact last seen, and
cross-module realtime remain Post-MVP only.

## Notes

- All 78 original tasks are retained; T015 and T027 are the two remediation
  additions, for 80 tasks total.
- No task creates a Git commit; the user owns commit timing and messages.
- Do not copy a third-party chat UI or introduce a second auth/database/service.
- `[P]` never overrides the explicit dependency graph or shared-file conflicts.
- Tests must fail for the intended missing behavior before implementation.
- Keep message/report content out of ordinary logs, analytics, audit context,
  URLs, and unprotected snapshots.
