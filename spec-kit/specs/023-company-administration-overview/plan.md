# Implementation Plan: Company Administration Overview

**Branch**: `UI_update` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

## Summary

Add a secure, read-only Company overview to the existing administrator console. A single protected overview projection returns safe identity, membership, verification, and activity summaries. Every successful view persists a minimal immutable access-audit event. The React Admin `Show` page presents the projection with responsive MUI `sx` layout and explicit owner-risk states.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24

**Primary Dependencies**: Next.js App Router, React Admin, MUI, Prisma 7, Zod

**Storage**: Existing PostgreSQL `Company`, membership, verification, job, moderation, and audit tables; no migration

**Testing**: Vitest, Testing Library, existing admin integration/contract patterns

**Target Platform**: Existing desktop-focused administrator console

**Project Type**: Existing web application with Next Route Handlers, services, repositories, and React Admin presentation

**Performance Goals**: P95 company overview visible within 3 seconds under representative administrative data

**Constraints**: Server authorization, no-store response, least-privilege fields, mandatory view audit, no company-management commands, bounded recent memberships

**Scale/Scope**: One company per view; aggregate counts and at most five membership rows

## Constitution Check

| Gate                      | Status | Evidence                                                                                             |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Security and privacy      | PASS   | Admin boundary guards the endpoint; projection omits documents, tax ID, email, and notes.            |
| State and audit integrity | PASS   | Successful reads write one minimal immutable access audit; no business state changes.                |
| Scope discipline          | PASS   | The feature is read-only; suspension, ownership, and verification overrides remain excluded.         |
| Accessible quality        | PASS   | Responsive MUI layout, text-labelled states, empty/error/warning feedback, keyboard-native controls. |
| Architecture              | PASS   | Route Handler delegates to admin service and Prisma repository; React Admin stays presentation-only. |

## Design

1. The detail route authenticates the platform administrator with the existing designated-session boundary.
2. `AdminMembershipService` asks `PrismaAdminMembershipRepository` for one bounded company projection using parallel aggregate queries.
3. When the company exists, the service records `admin.company_detail_viewed` with the actor/session and company target. Audit persistence failures fail closed.
4. The data provider's existing `getOne` support reads the endpoint. `CompanyDetailShow` renders its projection and owner-health warnings.
5. The company list uses fields actually returned by its API and the existing server-side `q` filter.

## API Contract

See [contracts/company-administration.md](./contracts/company-administration.md).

## Project Structure

```text
web/
|-- src/app/api/admin/companies/[companyId]/route.ts
|-- src/backend/admin/authorization/admin-access-audit.ts
|-- src/backend/admin/memberships/admin-membership-service.ts
|-- src/backend/repositories/admin/prisma-admin-membership-repository.ts
|-- src/backend/audit/events.ts
|-- src/frontend/features/admin/companies/
|   |-- company-list.tsx
|   `-- company-detail-show.tsx
`-- src/frontend/features/admin/app/admin-app.tsx
```

**Structure Decision**: Reuse the existing admin membership service/repository because company and membership read ownership already resides there; add only the read projection and access-audit concern.

## Navigation Repair

The Job Post Review company-verification link must target the React Admin hash
route and pass a `targetCompanyId` filter. The verification list validates and
applies that canonical ID at the route, contract, data-provider, and repository
boundaries. The destination remains the request list; protected evidence opens
only after an administrator selects a specific request.

## Review History Retention

Verification requests and job-post reviews remain visible in their respective
administrator lists after a decision. The default list query is intentionally
unfiltered by review state (and verification applicant eligibility) so a
decision changes only the displayed state; administrators can narrow either
list explicitly with its status filter.

## Reference and Name Search

Verification Requests and Job Post Reviews expose an always-visible React Admin
search field. It accepts stable references and tolerant, case-insensitive name
terms: verification request, applicant, company, or tax-code references plus
applicant/company names for verification; review, job, or company references
plus job/company names for job-post reviews.

The backend normalizes whitespace, Unicode case, and Vietnamese diacritics,
then tokenizes the search input. Every token must occur in one searchable name
field, so `Web De` matches `Web Developer` without requiring a full exact
phrase. Identifier and tax-code matches remain exact. Job-post review titles
are projected to a persisted normalized search column instead of querying the
JSON snapshot directly. A migration and idempotent backfill populate the column
for existing review versions; newly submitted versions populate it at write
time. The validated filter is applied at the repository query boundary before
pagination.

## Complexity Tracking

No constitutional violations or new infrastructure are required.
