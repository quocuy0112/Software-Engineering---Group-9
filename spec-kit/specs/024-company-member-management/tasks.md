# Tasks: Company Member Management

## Phase 1: Foundation

- [X] T001 Add invitation schema, migration, and generated Prisma client updates in `web/prisma/schema.prisma` and `web/prisma/migrations/`.
- [X] T002 [P] Add strict Team and invitation contracts and OpenAPI documentation in `web/src/shared/contracts/company-members/team.ts` and `spec-kit/specs/024-company-member-management/contracts/team.openapi.yaml`.
- [X] T003 [P] Add contract, security, and accessibility tests for Owner-only company-scoped commands in `web/tests/backend/contract/company-members/`, `web/tests/security/company-members/`, and `web/tests/frontend/accessibility/company-members/`.

## Phase 2: Owner team management (US1, US3)

- [X] T004 [US1] Implement active Owner company authorization and safe team read projection in `web/src/backend/company-members/company-team-authorization.ts`.
- [X] T005 [P] [US1] Add Team list/service tests in `web/tests/backend/integration/company-members/company-team.test.ts`.
- [X] T006 [US1] Implement list, role change, suspend, restore, and remove commands with audit/history in `web/src/backend/company-members/company-team-service.ts`.
- [X] T007 [US1] Add protected team and membership command routes in `web/src/app/api/recruiter/company/team/`.
- [X] T008 [US1] Implement the accessible Owner Team screen and integrate its navigation in `web/src/frontend/features/recruiter-workspace/`.

## Phase 3: Invitation lifecycle (US2)

- [X] T009 [P] [US2] Add invitation lifecycle, expiry, duplicate, recipient-binding, and replay tests in `web/tests/backend/integration/company-members/company-invitations.test.ts`.
- [X] T010 [US2] Implement create/revoke/accept invitation transactions and safe token delivery in `web/src/backend/company-members/company-team-service.ts`.
- [X] T011 [US2] Add protected create/revoke/accept invitation routes in `web/src/app/api/recruiter/company/team/invitations/`.
- [X] T012 [US2] Add invitation UI, status, validation, confirmation, and acceptance feedback in `web/src/frontend/features/recruiter-workspace/company-team-screen.tsx`.

## Phase 4: Verification and synchronization

- [X] T013 Update Feature 006, 009, and 021 references that conflict with Owner-facing invitation lifecycle in `spec-kit/specs/`.
- [X] T015 [US2] Deliver each invitation through the email outbox and a token-free in-app notification; remove Owner-browser token delivery and add migration/template coverage.
- [X] T014 Run focused tests, typecheck, lint, Prisma validation, and update this checklist in `web/` and `spec-kit/specs/024-company-member-management/tasks.md`.

## Phase 5: Recipient decision and activity timeline

- [X] T016 [US2] Add declined invitation state, immutable company team activity storage, migrations, and Prisma updates.
- [X] T017 [P] [US2] Add recipient preview/decline contracts and Owner response notification templates, policies, and tests.
- [X] T018 [US2] Implement transactional invitation accept/decline responses, Owner notification delivery, and activity recording.
- [X] T019 [P] [US2] Add protected preview/decline routes and update the invitation decision UI with accessible terminal states.
- [X] T020 [US1] Render the Owner-visible Team activity timeline on the Team page.
- [X] T021 Run focused tests, typecheck, lint, Prisma validation/migration deploy, and synchronize this checklist.

## Phase 6: Invitation feedback polish

- [X] T022 [US2] Show success/error toast feedback for invitation delivery and map pending-invitation, existing-member, and unavailable-recipient responses to actionable messages.
