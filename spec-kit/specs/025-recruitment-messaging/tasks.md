# Tasks: Application-Scoped Recruitment Messaging

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contract](./contracts/recruitment-messaging.md)

## Phase 1: Setup

- [X] T001 Add feature fixtures and migration verification harness in `web/tests/helpers/recruitment-messaging/` and `web/scripts/verify-recruitment-messaging-migration.mjs`.
- [X] T002 [P] Add shared typed recruitment messaging schemas in `web/src/shared/contracts/recruitment-messaging/`.

## Phase 2: Foundational

- [X] T003 Add additive `RecruitmentThread`/`RecruitmentMessage` storage, indexes, relations, and safe migration in `web/prisma/schema.prisma` and `web/prisma/migrations/`.
- [X] T004 Implement transactional repository methods for unique thread creation, ordering, idempotent append, read boundaries, reassignment, list, and Owner projections in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts`.
- [X] T005 Implement server-side Candidate/staff/Owner authorization and canonical application-stage lifecycle policy in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts`.
- [ ] T006 [P] Add unit/security matrix tests for membership, assignment, stage, multi-company, and Owner non-participant authority in `web/tests/security/recruitment-messaging/recruitment-thread-authorization.test.ts`.
- [X] T007 Implement typed route errors, CSRF/idempotency, rate-limit, audit, and notification adapter boundaries in `web/src/backend/recruitment-messaging/`.

**Checkpoint**: Application-scoped storage and authorization are ready for all user stories.

## Phase 3: User Story 1 - Conduct an application conversation (P1)

**Independent Test**: Candidate and active assigned staff open one application thread, exchange idempotent messages, and a second application remains separate.

- [ ] T008 [P] [US1] Add contract/integration tests for Candidate thread discovery, initial assignment gate, unique creation, message retry, reassignment continuity, and terminal read-only behavior in `web/tests/backend/{contract,integration}/recruitment-messaging/application-thread.test.ts`.
- [X] T009 [US1] Implement application-thread read/open/send/read-state services in `web/src/backend/recruitment-messaging/recruitment-thread-service.ts`.
- [X] T010 [US1] Implement Candidate application-thread/message handlers and HR Manager-only assignment in `web/src/app/api/candidate/applications/[applicationId]/recruitment-thread/route.ts`, `web/src/app/api/recruiter/applications/[applicationId]/recruitment-thread/assignment/route.ts`, and `web/src/app/api/recruitment-threads/[threadId]/`.
- [X] T011 [US1] Implement Candidate thread client, application-tracker `Contact recruiter` entry point, visible job/company/stage header, compose/read-only states, recovery, and responsive conversation styling in `web/src/frontend/features/recruitment-messaging/candidate-recruitment-thread.tsx`.
- [ ] T012 [P] [US1] Add component/accessibility coverage for Candidate assignment, compose, terminal state, keyboard flow, and non-color feedback in `web/tests/frontend/{components,accessibility}/recruitment-messaging/candidate-application-thread.test.tsx`.

## Phase 4: User Story 2 - Manage a recruitment inbox (P1)

**Independent Test**: Recruiter/HR sees only authorized company/job/application summaries, filters them server-side, and opens a thread with complete safe context.

- [ ] T013 [P] [US2] Add contract/security tests for recruiter list/detail filters, assignment scope, and neutral foreign-company denial in `web/tests/{backend/contract,security}/recruitment-messaging/recruiter-inbox.test.ts`.
- [X] T014 [US2] Implement company/job/stage/assignment list/detail services and routes in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts` and `web/src/app/api/recruiter/messages/route.ts`.
- [X] T015 [US2] Build recruiter desktop inbox, server-authorized filters, thread header, and application/profile links in `web/src/frontend/features/recruitment-messaging/recruitment-messaging-workspace.tsx`.
- [X] T015a [US2] Add the application-detail `Message candidate` entry point, atomic create-and-self-assign flow, and assignment audit events.
- [X] T016 [US2] Add navigation/route composition for `/recruiter/messages` in `web/src/app/recruiter/messages/page.tsx` and recruiter navigation.
- [ ] T017 [P] [US2] Add recruiter inbox component/accessibility tests for filters, empty/loading/error states, context labels, and keyboard navigation in `web/tests/frontend/{components,accessibility}/recruitment-messaging/recruiter-message-workspace.test.tsx`.

## Phase 5: User Story 3 - Owner read-only oversight (P2)

**Independent Test**: Owner views only owned-company threads, obtains an audited read-only projection, and cannot alter participant state or send.

- [ ] T018 [P] [US3] Add Owner scope, audit-minimization, non-participant, and write-denial security tests in `web/tests/security/recruitment-messaging/owner-oversight.test.ts`.
- [X] T019 [US3] Implement Owner overview/detail service methods and audited read-only views in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts`.
- [X] T020 [US3] Implement Owner oversight route handlers in `web/src/app/api/recruiter/messages/oversight/{route.ts,threads/[threadId]/route.ts}`.
- [X] T021 [US3] Build Owner read-only inbox/detail UI with job/stage filters and no message/assignment controls in `web/src/frontend/features/recruitment-messaging/recruitment-messaging-workspace.tsx`.
- [ ] T022 [P] [US3] Add UI/accessibility tests proving no composer and state-neutral Owner views in `web/tests/frontend/{components,accessibility}/recruitment-messaging/owner-oversight.test.tsx`.

## Phase 6: User Story 4 - Close and report recruitment communication safely (P2)

**Independent Test**: Application closure makes a thread read-only; a participant can report a message and only the existing protected review workflow receives evidence.

- [ ] T023 [P] [US4] Add lifecycle/report privacy integration tests in `web/tests/backend/integration/recruitment-messaging/lifecycle-and-report.test.ts`.
- [X] T024 [US4] Bridge recruitment messages to the existing protected report queue and evidence policy in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts` and admin report repository.
- [X] T025 [US4] Enforce application lifecycle read-only authority at every recruitment-thread detail/send operation in `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts`.
- [ ] T026 [US4] Add reporting/read-only controls and recovery copy in `web/src/frontend/features/recruitment-messaging/components/{candidate-application-thread,recruiter-message-workspace}.tsx`.

## Phase 7: Polish and cross-feature integration

- [X] T027 Integrate recruitment message notification events and recipient-safe deep links in `web/src/backend/notifications/` and `web/src/backend/recruitment-messaging/recruitment-messaging-service.ts`.
- [ ] T028 [P] Add performance, realtime, and notification privacy coverage in `web/tests/{performance,security,backend/integration}/recruitment-messaging/`.
- [X] T029 [P] Synchronize Feature 008, 013, 019, and 024 documentation with the approved recruitment-thread boundary in `spec-kit/specs/{008-realtime-messaging,013-messaging-report-review,019-notification-deep-link,024-company-member-management}/`.
- [ ] T030 Run quickstart validation commands, focused contract tests, migration validation, and update `spec-kit/specs/025-recruitment-messaging/quickstart.md` with results. (Blocked locally until the generated `20260820163010` migration is reconciled with the repository naming convention.)

## Dependencies

`T001-T007` blocks all stories. `US1` creates thread mechanics; `US2` and `US3` depend on it; `US4` depends on thread mechanics and report adapters; polish depends on all stories.

## Implementation Strategy

Implement storage/authorization first, then Candidate communication, recruiter inbox, Owner oversight, lifecycle/report integration, and finally notification/performance validation. Every phase includes authorization, privacy, error handling, and verification before proceeding. No task authorizes a git commit; the user verifies and commits the final change set.
