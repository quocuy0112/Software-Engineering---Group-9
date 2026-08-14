# Implementation Plan: In-App Notification Center

**Branch**: `015-inapp-email-notification` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/016-inapp-email-notification/spec.md`

## Summary

Build one PostgreSQL-backed notification inbox for candidates, recruiters, and platform administrators. A central allow-listed event policy converts safe business-event inputs into localized notification records with severity, context, destination, retention, and idempotency rules. Existing event-email production remains unchanged; the same producer transaction adds an independent in-app record, while token/proof email kinds are explicitly excluded. Existing professional-connection notifications and recruitment notification work are backfilled and bridged to the unified model. Authenticated workspace and admin shells poll a compact API every four seconds, provide a bell, unread count, panel, full inbox, read/read-all actions, and context-aware clearing.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, TanStack Query 5.101, React Admin 5.15, MUI 7.3

**Storage**: PostgreSQL through the existing Prisma client; no browser persistence for notification authority

**Testing**: Vitest 4.1 with backend unit/integration/contract, frontend component/accessibility, architecture/security/performance suites; Playwright for targeted authenticated smoke coverage

**Target Platform**: Responsive web application and desktop-oriented administration console on the existing long-lived Node custom server

**Project Type**: Existing monorepo web application with layered frontend, backend services/repositories, shared contracts, and Next.js transport handlers

**Performance Goals**: Notification availability and cross-session read-state convergence P95 at or below 5 seconds; list and unread-count API P95 at or below 500 milliseconds on the documented fixture dataset

**Constraints**: Preserve all existing email content and delivery semantics; no token/proof material in notification data; strict recipient isolation; idempotent writes and read mutations; 90-day visible retention; no new paid provider or second session mechanism

**Scale/Scope**: Approximately 30 existing logical event-email variants, five in-app-only event families, three user modes, one panel, one full inbox, four mutation/read APIs, legacy backfill for two feature-specific stores, and bounded pagination over thousands of rows per recipient

## Constitution Check

*GATE: Must pass before Phase 0 research and was re-checked after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Human-controlled recruitment | PASS | Notifications communicate events only; they do not score, rank, reject, hire, or advance candidates. |
| Security, privacy, tenant isolation | PASS | Server-owned session authorization, recipient-only queries, allow-listed safe payloads, internal links, no tokens/proofs/evidence, and company recipient rules are explicit. |
| Deterministic core | PASS | Event policy and deduplication are deterministic; no AI or external provider is introduced. |
| State, audit, data integrity | PASS | PostgreSQL is authoritative; unique deduplication keys, transactional producer integration, idempotent reads, migration verification, and originating audit retention are planned. |
| Scope discipline and complete workflows | PASS | Scope is limited to delivery and read state for existing events plus specified in-app-only events. Email templates and unrelated workflows are not redesigned. |
| Measurable quality and accessibility | PASS | Four-second refresh supports the five-second P95 target; keyboard, focus, live status, contrast, non-color state, security, and performance tests are included. |
| Maintainable/provider-independent architecture | PASS | Shared Zod contracts, service/repository boundaries, Route Handlers, existing session owner, and PostgreSQL are retained. Socket transport remains untouched. |

**Exclusive browser-session owner**: The existing Better Auth server session stored in secure HttpOnly cookies remains the only browser session mechanism. Unified notification routes resolve that session server-side. Platform-administrator access is additionally checked through the existing active administrator grant/context boundary; no notification token is stored client-side.

**Post-design re-check**: PASS. The data model contains only safe display data and references; contracts reveal no cross-recipient existence; legacy migration is additive and reversible; the client transport remains ordinary polling rather than new business logic in the realtime server.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/016-inapp-email-notification/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- notifications.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/<timestamp>_unified_in_app_notifications/migration.sql
|-- scripts/
|   |-- verify-in-app-notification-migration.mjs
|   `-- measure-in-app-notification-performance.mjs
|-- src/
|   |-- app/
|   |   |-- (workspace)/notifications/page.tsx
|   |   `-- api/notifications/
|   |       |-- route.ts
|   |       |-- unread-count/route.ts
|   |       |-- read-all/route.ts
|   |       |-- contexts/read/route.ts
|   |       `-- [notificationId]/read/route.ts
|   |-- backend/
|   |   |-- notifications/
|   |   |   |-- event-policy.ts
|   |   |   |-- notification-service.ts
|   |   |   |-- notification-recipient-policy.ts
|   |   |   |-- notification-errors.ts
|   |   |   `-- notification-service-factory.ts
|   |   `-- repositories/notifications/prisma-notification-repository.ts
|   |-- frontend/features/notifications/
|   |   |-- client/
|   |   |-- components/
|   |   |-- styles/
|   |   `-- notification-copy.ts
|   `-- shared/contracts/notifications/index.ts
`-- tests/
    |-- backend/{unit,integration,contract}/notifications/
    |-- frontend/{components,accessibility}/notifications/
    |-- architecture/in-app-notification-boundaries.test.ts
    |-- security/notifications/
    |-- performance/notifications/
    `-- system/e2e/notifications/
```

Existing event producers in identity/account, admin security, recruiter verification, support, professional connections, jobs/applications, messaging, and messaging-report review are changed only to invoke the shared in-app notification boundary with their already-authoritative event identity. Existing email renderer/template files are protected by regression tests and are not edited.

**Structure Decision**: Extend the existing web workspace and its established presentation/service/repository/shared-contract layers. The unified API uses only App Router Route Handlers. Polling is presentation transport; event policy, authorization, idempotency, and persistence remain backend responsibilities.

## Delivery Design

### Event Production

1. The originating service validates and commits its business transition using its existing transaction.
2. Existing email outbox writes remain exactly as they are.
3. The producer invokes a transaction-compatible notification writer with an allow-listed event kind, recipient, business event key, context, and safe variables.
4. The policy resolves category, severity, locale copy, safe destination, and 90-day expiry.
5. The repository inserts using a unique recipient/event deduplication identity; a replay returns the existing record without error.
6. An in-app write failure rolls back only when still inside the originating transaction. Failures in asynchronous legacy backfill are retried without changing already-committed business state.

### Channel Classification

- Event email kinds are mirrored in-app without reading, changing, or copying their rendered email HTML/text.
- Challenge/proof kinds `VERIFY_EMAIL`, `EMAIL_CHANGE_VERIFY`, `RESET_PASSWORD`, and `COMPANY_EMAIL_VERIFY` are excluded.
- `SECURITY_ALERT` is classified by its safe `eventKind`: completed account/recovery/security events are mirrored; confirmation/proof delivery is excluded.
- Existing `PASSWORD_CHANGED`, application stage, verification outcome, support update, professional connection, account state, and membership state email events are mirrored.
- No new email template is planned. In-app-only application receipt, company application receipt, message, and report events do not queue email.

### Read and Freshness Model

- The bell requests unread count every four seconds while an authenticated shell is visible.
- The open panel refreshes its first page on the same interval and immediately invalidates after read mutations.
- Individual, read-all, and context-read updates are idempotent database updates scoped by `recipientUserId`.
- Messaging and workflow views call context-read only after protected content loads successfully.
- Existing socket message events remain responsible for message delivery; the unified notification UI does not place persistence or authorization logic in the socket server.

### Legacy Migration

- Add the unified table and indexes without dropping old tables.
- Backfill unexpired `ProfessionalConnectionNotification` rows using their existing deduplication key and read state.
- Backfill `RecruitmentNotificationWork` rows: candidate targets map directly; company targets fan out only to active company memberships with hiring authority. Existing rows are marked delivered only after all idempotent recipient inserts succeed.
- Switch new connection and recruitment producers to the unified writer.
- Keep old tables read-only for one release and provide a verification script comparing source rows, resolved recipients, and unified rows. Destructive removal is deferred to a separate migration.

## Validation Strategy

1. Contract and policy unit tests before repository implementation.
2. Migration apply/verify tests and Prisma validation/generation.
3. Repository integration tests for pagination, isolation, deduplication, retention, and read operations.
4. Producer integration tests for every event family and challenge exclusion.
5. Email snapshot/regression tests proving no existing template or delivery behavior changed.
6. Frontend component and accessibility tests for bell, panel, page, errors, and read state.
7. Architecture and security tests for route ownership, server-only boundaries, CSRF, unsafe payload rejection, and cross-user enumeration resistance.
8. Performance measurement on documented seeded data, followed by targeted feature tests, typecheck, lint, migration checks, full test suite, and production build.

## Complexity Tracking

No constitution violations require justification.
