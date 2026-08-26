# Implementation Plan: Administrator Data Backup

**Branch**: `026-admin-data-backup` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

## Summary

Add an administrator-only Backup Settings page and worker-managed PostgreSQL backup workflow. A typed service coordinates persisted configuration and leased runs; a storage adapter encrypts data then uploads it to Google Drive. No restore UI is included.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Next.js App Router, Prisma 7, PostgreSQL 16.  
**Primary Dependencies**: Existing Better Auth admin boundary, Zod, Prisma, Google Drive API client.  
**Storage**: PostgreSQL metadata plus encrypted Google Drive object.  
**Testing**: Vitest unit/integration/security/accessibility tests.  
**Target Platform**: Existing Admin Console and persistent `admin-worker` container.  
**Constraints**: Recent 2FA + CSRF, no secrets in UI/DB/logs, no overlapping runs, logical backup only.  
**Scale/Scope**: Single global configuration; PostgreSQL-only V1; interval in seconds for demo.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Security and privacy | PASS | Server-only admin boundary, secret environment values, encrypted artifact, metadata-only UI. |
| State and audit integrity | PASS | Transactional configuration, leased runs, idempotency, audit events. |
| Provider independence | PASS | Drive adapter behind backup artifact interface. |
| Scope discipline | PASS | Restore and non-database artifacts explicitly deferred. |

## Project Structure

```text
web/
├── prisma/schema.prisma and migrations/
├── src/backend/backup/{backup-service,backup-worker,storage/google-drive}.ts
├── src/backend/repositories/backup/prisma-backup-repository.ts
├── src/shared/contracts/admin/backup.ts
├── src/app/api/admin/backup/{route,runs/route}.ts
├── src/frontend/features/admin/backup/backup-settings.tsx
└── tests/{backend,security,frontend}/admin-backup/
```

## Design Decisions

1. PostgreSQL dump creation is isolated behind a port to make it testable and to prevent routes from invoking system commands.
2. The Drive adapter owns credential parsing and upload. Its output is opaque locator/checksum/size only.
3. The existing admin worker polls the due configuration frequently, then uses a DB lease for one active backup run.
4. Sensitive save and manual-run commands use the existing `AdminRequestBoundary.require({ sensitive: true })` check.
