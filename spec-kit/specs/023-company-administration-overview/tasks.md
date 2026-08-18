# Tasks: Company Administration Overview

**Input**: Design documents from `spec-kit/specs/023-company-administration-overview/`

## Phase 1: Foundation

- [x] T001 Extend `web/src/backend/audit/events.ts` with the company-detail view audit action and company target.
- [x] T002 Implement bounded company overview aggregation in `web/src/backend/repositories/admin/prisma-admin-membership-repository.ts`.
- [x] T003 Implement authorized detail orchestration and required audit write in `web/src/backend/admin/memberships/admin-membership-service.ts` and `web/src/backend/admin/authorization/admin-access-audit.ts`.

## Phase 2: User Story 1 - Inspect a company safely (P1)

- [x] T004 [P] [US1] Add owner-risk component coverage in `web/tests/frontend/components/admin-management/company-detail-show.test.tsx`.
- [x] T005 [US1] Add protected detail endpoint at `web/src/app/api/admin/companies/[companyId]/route.ts`.
- [x] T006 [US1] Add `CompanyDetailShow` with responsive summary, empty states, and owner-risk warnings in `web/src/frontend/features/admin/companies/company-detail-show.tsx`.
- [x] T007 [US1] Register the Company show view in `web/src/frontend/features/admin/app/admin-app.tsx`.

## Phase 3: User Story 2 - Find companies reliably (P2)

- [x] T008 [US2] Replace the generic company list with `web/src/frontend/features/admin/companies/company-list.tsx` and display only server-returned identity fields.
- [x] T009 [US2] Return display name with the company list projection in `web/src/backend/repositories/admin/prisma-admin-membership-repository.ts`.
- [x] T012 [US2] Add Accounts-style always-visible search and verification/created-date filters in `web/src/frontend/features/admin/companies/company-list.tsx` and apply them in `web/src/backend/repositories/admin/prisma-admin-membership-repository.ts`.
- [x] T013 [US2] Repair job-post-review verification navigation with a hash route and canonical `targetCompanyId` filter across `web/src/backend/jobs/review/job-post-review-service.ts`, verification-list transport, contract, and repository files.
- [x] T014 [US2] Improve the Company Membership show presentation with responsive React Admin/MUI panels, status cues, history, and a sticky action area in `web/src/frontend/features/admin/memberships/membership-lifecycle-panel.tsx`.
- [x] T015 [US2] Improve the Account Detail show presentation with responsive React Admin/MUI summary, activity, authority, evidence, moderation, and history panels in `web/src/frontend/features/admin/accounts/account-detail-show.tsx`.

## Phase 4: Validation

- [x] T010 Run focused lint, typecheck, and component tests from `web/`; the broad admin suite was attempted but exceeded its 180-second command window before producing test results.
- [x] T011 Update `AGENTS.md` through the Spec Kit agent-context script or equivalent managed-block update.
