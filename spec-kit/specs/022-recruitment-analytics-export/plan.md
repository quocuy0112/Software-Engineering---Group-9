# Implementation Plan: Recruitment Analytics & Data Export

**Branch**: `023-recruitment-analytics-export` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-recruitment-analytics-export/spec.md`

## Summary

Extend the existing SmartHire web application with tenant-scoped Employer analytics and exports plus Administrator platform trends and optional activity history. PostgreSQL remains authoritative: durable qualified-view facts enforce the daily uniqueness rule, lifecycle events reconstruct active-posting snapshots, application/stage history produces cutoff-consistent cohorts and funnels, and a leased worker generates private CSV/XLSX artifacts from immutable export snapshots. Every view, generation, and download passes the existing server-side Administrator grant or active company-membership boundary; artifacts expire after 24 hours while privacy-reduced audit records follow the 24-month policy.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, React Admin 5.15/MUI 7.3 for Administrator UI, existing recruiter UI conventions, Prisma 7.9, PostgreSQL, Zod 4.3, TanStack Query 5.101, Better Auth 1.6, and ExcelJS streaming workbook writer added for XLSX output

**Storage**: PostgreSQL for authoritative facts, report/export state, leases, and audit metadata; the existing private S3/filesystem storage pattern behind a new export-specific storage port and key prefix for short-lived artifacts

**Testing**: Vitest 4.1 unit/integration/contract/security/architecture/accessibility/performance suites; Testing Library and axe-core for UI; Playwright 1.57 for authenticated end-to-end flows; migration and performance verification scripts

**Target Platform**: Responsive, data-dense Administrator and Employer web workspaces on the existing long-lived Node server hosting Next.js

**Project Type**: Existing monorepo web application with Route Handler, service, repository, worker, storage-port, shared-contract, and frontend-feature boundaries

**Performance Goals**: Dashboard/report page usable P95 <=3 seconds; filter/navigation response P95 <=2 seconds; Kanban visual response P95 <=500 milliseconds; at least 95% of exports up to 10,000 rows available within 10 seconds; export generation error rate below 1% excluding invalid/unauthorized requests

**Constraints**: Half-open `[from,to)` ranges in the displayed platform time zone; ranges cannot begin before the authoritative analytics baseline; one qualifying view per privacy-safe visitor/posting/platform day; cohort and stage calculations share one cutoff; current canonical application stages remain unchanged; application contact snapshots are the export authority; CSV and XLSX parity; spreadsheet-formula neutralization; authorization on request, generation, and every download; export artifacts inaccessible/deleted after 24 hours; audit metadata retained 24 months unless legally held; no candidate PII in audit/operational logs

**Scale/Scope**: P1 Administrator dashboard, Employer per-posting performance/funnel, and one-posting candidate export; P2 Administrator activity UI/aggregates after P1. Representative fixtures cover 1,000,000 view/activity facts, 100,000 applications, and 10,000-row exports with bounded worker batches.

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Human-controlled recruitment | PASS | Analytics and exported scores are read-only estimates; no report or worker changes stages, rejects, offers, or hires. Canonical stages and explicit recruiter authority remain unchanged. |
| Security, privacy, tenant isolation | PASS | Administrator grant and active company-membership checks occur server-side for reads, generation, and downloads. Export projection is allow-listed, storage is private, keys are purpose-specific, and audit records exclude candidate PII. |
| Deterministic core and explainable AI | PASS | Export reads the current published screening result without recalculation; missing/limited scores remain explicit and no score drives a decision. Existing 40/60 policy and provenance remain authoritative. |
| State, audit, data integrity | PASS | Qualified-view uniqueness, lifecycle facts, snapshot cutoff, export idempotency, leased generation, checksum/row counts, and audit outcomes prevent duplication and partial success. PostgreSQL remains authoritative. |
| Scope discipline | PASS | P1 work is independently deliverable; only the P2 activity screen and aggregates may defer. Critical-event capture and 24-month retention/legal-hold enforcement remain mandatory. No excluded AI or editing feature is introduced. |
| Measurable quality and accessibility | PASS | Plan retains constitutional P95 targets, 10,000-row export target, reproducible test conditions, text/table chart alternatives, keyboard controls, status announcements, and non-color meaning. |
| Maintainable/provider-independent architecture | PASS | Existing Next.js/service/repository boundaries are extended; export generation depends on a format writer and storage port, not a provider. PostgreSQL and the one Better Auth browser session remain authoritative. |

**Exclusive browser-session owner**: Existing Better Auth server sessions stored in secure HttpOnly cookies. Administrator endpoints additionally resolve an active/non-expired Administrator grant and required scope. Employer endpoints resolve the authenticated account, active verified company, active permitted membership, and posting ownership on every request; export download never trusts an artifact identifier alone.

**Post-design re-check**: PASS. Contracts expose role-specific allow-listed projections, the model preserves stage and score authorities, lifecycle facts support historical metrics without mutating source records, and export artifact cleanup separates the 24-hour file deadline from 24-month privacy-reduced audit retention.

## Project Structure

### Documentation (this feature)

```text
specs/022-recruitment-analytics-export/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- recruitment-analytics-export.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md                         # generated by /speckit-tasks
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/<timestamp>_recruitment_analytics_export/migration.sql
|-- scripts/
|   |-- run-recruitment-export-worker.mjs
|   |-- run-recruitment-analytics-retention-worker.mjs
|   |-- verify-recruitment-analytics-migration.mjs
|   `-- measure-recruitment-analytics-performance.mjs
|-- src/
|   |-- app/
|   |   |-- recruiter/analytics/{page.tsx,[jobId]/page.tsx}
|   |   `-- api/
|   |       |-- admin/analytics/{overview,activity}/route.ts
|   |       `-- recruiter/analytics/jobs/[jobId]/{performance,exports/**}/route.ts
|   |-- backend/
|   |   |-- analytics/
|   |   |   |-- admin-analytics-service.ts
|   |   |   |-- job-performance-service.ts
|   |   |   |-- report-time-policy.ts
|   |   |   |-- qualified-view-service.ts
|   |   |   `-- activity-query-service.ts
|   |   |-- exports/
|   |   |   |-- candidate-export-service.ts
|   |   |   |-- candidate-export-worker.ts
|   |   |   |-- export-cell-policy.ts
|   |   |   `-- storage/{export-artifact-storage.ts,filesystem.ts,s3.ts}
|   |   `-- repositories/analytics/
|   |       |-- prisma-analytics-repository.ts
|   |       |-- prisma-qualified-view-repository.ts
|   |       `-- prisma-export-request-repository.ts
|   |-- shared/contracts/analytics/{index.ts,admin.ts,employer.ts,exports.ts}
|   `-- frontend/features/
|       |-- admin/analytics/**
|       `-- recruitment-analytics/**
`-- tests/
    |-- backend/{unit,integration,contract}/recruitment-analytics/**
    |-- frontend/{components,accessibility}/recruitment-analytics/**
    |-- security/recruitment-analytics/**
    |-- architecture/recruitment-analytics-boundaries.test.ts
    |-- performance/recruitment-analytics/**
    `-- system/e2e/recruitment-analytics/**
```

**Structure Decision**: Extend the existing `web` workspace and its established App Router, admin dashboard, recruiter authorization, audit repository, worker lease, and private-storage patterns. Keep metric definitions in pure policy modules; all database queries stay behind analytics/export repositories; CSV/XLSX writers consume one canonical row projection so formats cannot drift.

## Delivery Design

### Metric Truth and Time Semantics

- Normalize accepted ranges to UTC instants from the displayed platform time zone, use `[from,to)`, and return range, grouping, time zone, definition version, and one `dataCutoff` in every response.
- Registration buckets use `UserAccount.createdAt`. Application cohort metrics use `JobApplication.submittedAt`; Hired status at cutoff is reconstructed from `ApplicationStageEvent` rather than current mutable state.
- Active-posting values are reconstructed at each bucket end from explicit lifecycle facts. Migration seeds a baseline from current posting state and later changes append facts transactionally with the source transition.
- The migration publishes `analyticsAvailableFrom` at the lifecycle baseline. Overview requests beginning earlier are rejected with that date; no pre-baseline state is estimated.
- Funnel is a clearly timestamped current snapshot over canonical stages. View/application conversion uses period facts; zero views produces `null` conversion with an `NOT_APPLICABLE` display state.
- Qualified views use a versioned HMAC visitor-day digest, posting id, and platform day. A uniqueness constraint admits only one qualifying fact for the tuple. Raw addresses, cookies, and browser identifiers are not retained in the fact.
- The public job-detail request boundary invokes qualified-view admission after confirming a publicly visible posting; owning-company preview and automated classifications are passed through the same policy, and admission failure never blocks the page.

### Secure Export Lifecycle

1. The request boundary authenticates the Employer, verifies active permitted membership and posting/company scope, validates format/filters/idempotency, captures one data cutoff, creates `ExportRequest`, and writes a privacy-safe audit outcome.
2. A database-leased worker revalidates current authority, reads the point-in-time allow-listed candidate projection in stable application-id order using the immutable application contact snapshot, streams CSV or XLSX, neutralizes formula-like text, calculates checksum/bytes/rows, and publishes the artifact only after complete generation.
3. CSV uses UTF-8 with a header row and RFC 4180 quoting. XLSX uses ExcelJS streaming output with `Candidates` and `Metadata` sheets; all user-controlled cells are explicit strings, never formulas.
4. A download request rechecks requester identity, company membership, posting ownership, request success, 24-hour expiry, and artifact integrity before streaming with private/no-store and safe content-disposition headers. Authorization failure and absence use the same neutral response.
5. At expiry or authority revocation, access is denied immediately. A bounded idempotent cleanup worker deletes the private object and marks cleanup outcome; storage lifecycle rules are defense in depth, not the deadline authority.

### Activity Tracking

- Extend the strict audit action/target/context allow-list for posting creation/deletion and export lifecycle events, and reuse existing login/logout/application/stage events.
- Critical business writes append audit events transactionally or through an existing transactionally coupled outbox so aggregate counts do not depend on best-effort logging.
- Mandatory retention applies 24 months unless a scoped legal hold is active, regardless of whether the P2 activity UI ships. P2 queries project only Administrator-safe identity labels, role, action, target label, result, and timestamp; legal holds never restore ordinary access to deleted personal content.

## Validation Strategy

1. Pure metric fixtures for range boundaries, time-zone/DST behavior, bucket-end posting state, cohort-at-cutoff status, zero denominators, rounding, and canonical funnel totals.
2. Migration/repository tests for qualified-view uniqueness, lifecycle reconstruction, tenant indexes, export idempotency/leasing, legal holds, expiry, checksum, and cleanup retries.
3. Authorization matrix tests for Administrator grants, all permitted Employer membership roles, suspended/removed membership, inactive company, wrong-company posting, multi-company switching, and revoked in-flight exports.
4. Contract parity tests against `contracts/recruitment-analytics-export.openapi.yaml`, including strict rejection of extra PII and stable CSV/XLSX headers.
5. Export security tests for commas/quotes/newlines/Unicode, leading whitespace plus `= + - @`, file names, MIME headers, truncated storage, retry, and CSV/XLSX row/value parity.
6. UI component and accessibility tests for filters, visible definitions/cutoff, chart table alternatives, stage headings/counts/percentages, keyboard navigation, focus, loading/empty/error states, and announced export progress.
7. Performance runs with documented environment, dataset, concurrency, sample size, duration, percentile method, p50/p95/p99/max, and error rate for 1,000,000 facts, 100,000 applications, and 10,000-row exports.
8. End-to-end scenarios for Administrator trends, Employer job report, both export formats, expiry/revocation, and P2 activity filters; then typecheck, lint, migration verification, focused suites, full regression, and production build.
9. Moderated usability validation with representative Administrator and Employer participants measures first-attempt filtering, metric-definition interpretation, and report/export completion; retain aggregate evidence only.

## Complexity Tracking

No constitution violations require justification.
