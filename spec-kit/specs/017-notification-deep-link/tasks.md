# Tasks: Notification Deep-Link

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contract](./contracts/notification-destination.md)

## Phase 1: Setup

- [X] T001 Create notification deep-link fixtures and resolver test matrix in `web/tests/backend/unit/notifications/notification-destination-resolver.test.ts`

## Phase 2: Foundational

- [ ] T002 Add immutable recipient audience, nullable href rollout migration, and shared notification contract updates in `web/prisma/schema.prisma`, `web/prisma/migrations/`, and `web/src/shared/contracts/notifications/index.ts`
- [ ] T003 Implement audience-aware, current-state `NotificationDestinationResolver` and stop storing generated hrefs in `web/src/backend/notifications/event-policy.ts` and `web/src/backend/notifications/notification-destination-resolver.ts`
- [ ] T004 Resolve transient hrefs at notification list serving time and cover kind/audience/group/staleness contracts in `web/src/backend/notifications/notification-service.ts` and `web/tests/backend/contract/notifications/notification-deep-link.test.ts`

## Phase 3: User Story 1 - Safe current destinations (P1)

**Independent Test**: Candidate and recruiter receive different application hrefs; messages, job reviews, reports, and security notifications select only permitted destination shapes.

- [ ] T005 [US1] Add scoped destination and stale-versus-forbidden reader responses with authorization tests in `web/src/app/`, `web/tests/security/notification-deep-link-authorization.test.ts`

## Phase 4: User Story 2 - Resilient click flow (P1)

**Independent Test**: An item activation sends mark-read then navigates despite 500; null/current href does not navigate and the refresh reconciles unread count.

- [ ] T006 [US2] Implement optimistic non-blocking notification activation, explicit actions, and component resilience tests in `web/src/frontend/features/notifications/components/notification-center.tsx`, `web/src/frontend/features/notifications/client/use-notifications.ts`, and `web/tests/frontend/components/notifications/notification-center.test.tsx`

## Phase 5: User Story 3 - Accessible unavailable states (P2)

**Independent Test**: Authorized stale content gets safe unavailable copy, revoked access is neutral, and keyboard/focus/name checks pass.

- [ ] T007 [US3] Add focus-visible styling, keyboard/accessibility coverage, and safe unavailable presentation tests in `web/src/frontend/features/notifications/styles/notifications.css` and `web/tests/frontend/accessibility/notifications/notification-center.a11y.test.tsx`

## Phase 6: Polish

- [ ] T008 Run the relevant notification backend/frontend suites, typecheck, and quickstart scenarios; record results in `spec-kit/specs/017-notification-deep-link/quickstart.md`

## Dependencies

`T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008`. Tests are written alongside each implementation task because the feature alters a cross-cutting contract. T005 and T006 may be developed in parallel only after T004.

## Implementation Strategy

Deliver the server resolver and contract first, then protected destination behavior, then client interaction/accessibility. Commit each checked task separately after its relevant tests pass.
