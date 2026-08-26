# Tasks: Administrator Data Backup

**Input**: Design documents in `spec-kit/specs/026-admin-data-backup/`

## Phase 1: Setup

- [X] T001 Add backup credential/document ignores to `.gitignore`.
- [ ] T002 Add Google Drive API dependency and server environment validation in `web/package.json` and `web/src/backend/env/server.ts`.
- [X] T003 Add the PostgreSQL client package to `Dockerfile.admin-worker`.

## Phase 2: Foundational

- [X] T004 Add backup configuration/run enums, models, indexes, and migration in `web/prisma/schema.prisma` and `web/prisma/migrations/20260821183000_admin_data_backup/migration.sql`.
- [X] T005 Add typed backup schemas and API responses in `web/src/shared/contracts/admin/backup.ts`.
- [X] T006 Add the PostgreSQL dump port, encryption envelope, Drive OAuth storage adapter, and repository/service layer in `web/src/backend/backup/`.
- [ ] T007 Add unit and security tests for validation, encryption, Drive adapter, lease/idempotency, and audit privacy in `web/tests/backend/unit/admin-backup/` and `web/tests/security/admin-backup/`.

## Phase 3: User Story 1 - Configure and run backups (P1)

- [X] T008 [US1] Add sensitive admin configuration and manual-run route handlers in `web/src/app/api/admin/backup/route.ts` and `web/src/app/api/admin/backup/runs/route.ts`.
- [X] T009 [US1] Add the persistent worker scheduling loop in `web/src/backend/admin/workers/backup-schedule-loop.ts` and register it in `web/src/backend/admin/workers/`.
- [X] T010 [US1] Implement the accessible Backup Settings UI and Admin Console route/navigation in `web/src/frontend/features/admin/backup/` and `web/src/frontend/features/admin/app/admin-app.tsx`.

## Phase 4: User Story 2 - Review backup health (P1)

- [X] T011 [US2] Add backup-run history API projection and read route in `web/src/app/api/admin/backup/runs/route.ts`.
- [X] T012 [US2] Add latest-success and history states to `web/src/frontend/features/admin/backup/backup-settings.tsx`.

## Phase 5: Validation

- [ ] T013 Add integration, component, and accessibility tests in `web/tests/backend/integration/admin-backup/` and `web/tests/frontend/components/admin-backup/`.
- [ ] T014 Run Prisma generation, focused tests, typecheck, and production build; record outcomes in `spec-kit/specs/026-admin-data-backup/quickstart.md`.

## Dependencies & Execution Order

- Phase 1 is required before all later phases because the worker container and secret isolation are foundational.
- Phase 2 is required before API, worker, or UI work because it supplies persistent state and the provider boundary.
- User Story 1 depends on Phase 2. User Story 2 depends on the run projection from User Story 1.
- Validation runs only after the database schema, worker, APIs, and UI are integrated.

## Implementation Strategy

1. Deliver the secure baseline first: ignored JSON credentials, environment-only paths, encrypted upload, database lease, and PostgreSQL logical dump.
2. Add the protected Admin Settings APIs and worker loop, then verify manual backup without the browser being open.
3. Add the read-only history/status UI so administrators can demonstrate protection and diagnose safe failures.
4. Validate with mocked Drive transport plus a real local Drive smoke test only after the operator supplies the dedicated SmartHire OAuth JSON files.

## Parallel Opportunities

- T002 and T003 can proceed in parallel.
- The schema/contract tests in T005 and T007 can proceed once T004 is accepted.
- UI work T010/T012 can proceed after the route contracts are stable.
