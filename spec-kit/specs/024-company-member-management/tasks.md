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
- [ ] T014 Run focused tests, typecheck, lint, Prisma validation, and update this checklist in `web/` and `spec-kit/specs/024-company-member-management/tasks.md`.
