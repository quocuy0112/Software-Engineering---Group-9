# Implementation Plan: Job Board and Advanced Search

**Branch**: `003-job-board-and-advanced-search` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `spec-kit/specs/003-job-board-and-advanced-search/spec.md`

## Summary

Deliver a public SmartHire job catalogue and detail experience plus authenticated save, report, and application workflows. The existing Next.js modular monolith gains typed Zod contracts, thin App Router Route Handlers, job/application services, Prisma repositories, a forward-only PostgreSQL migration, server-rendered public pages, and focused React client islands for protected mutations. Search uses deterministic case- and Vietnamese-diacritic-insensitive normalized fields with keyset pagination; applications commit snapshots, audit evidence, and notification work transactionally.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.2.11, React 19.2.3, Zod 4.3.6, Prisma and `@prisma/adapter-pg` 7.9.0, `pg` 8.16.3, React Hook Form 7.82.0, TanStack Query 5.101.4, Sonner 2.0.7, and the existing Tailwind CSS 4.1.18/design tokens

**Storage**: PostgreSQL 16.12 as the sole relational production database; existing opaque provider-backed browser sessions; opaque retained-CV storage references only. Feature 004 temporary artifact locators are explicitly ineligible.

**Testing**: Vitest 4.1.10, Testing Library 16.3.1, Playwright 1.57.0, PostgreSQL integration tests, OpenAPI parity, architecture boundary tests, accessibility checks, and a production-build performance harness

**Target Platform**: Responsive public and authenticated web flows at desktop and 320 CSS pixels on the existing Node.js server runtime

**Project Type**: Existing full-stack Next.js modular monolith in the root `web` npm workspace

**Performance Goals**: p95 catalogue/search/filter and job detail at or below 2 seconds; public page load at or below 3 seconds under documented normal load

**Constraints**: Public field allowlists; no AI search/recommendation; Better Auth remains the exclusive session owner; protected writes require active server session, same-origin/CSRF proof, strict validation, ownership derivation, and uniqueness/idempotency; application commit is transactional; retained CVs are PDF/DOCX and exactly `1..5,000,000` bytes; Feature 004 temporary imports cannot become attachments implicitly; reports never auto-moderate postings

**Scale/Scope**: Index for at least 100,000 public/historical postings, 10,000 active postings, 1,000,000 applications, 50 skills and 20 questions per posting, and 50 results per request

## Constitution Check

_GATE: PASS before Phase 0 research; PASS again after Phase 1 design._

| Principle / boundary                | Design evidence                                                                                                                                                                                                                                                                                              | Result                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Human-controlled recruitment        | No scoring or automated hiring. Reports enter `Pending Review` and cannot change a posting without a later human moderation action.                                                                                                                                                                          | PASS                         |
| Security, privacy, tenant isolation | Public repositories select explicit fields. Save/report/apply derive the actor from the existing server session. Application/CV/report content is not public or logged.                                                                                                                                      | PASS                         |
| Deterministic core                  | Search normalization, filters, ordering, and eligibility are deterministic. AI search keywords and semantic recommendations are excluded.                                                                                                                                                                    | PASS                         |
| State, audit, integrity             | `Applied` is the initial canonical stage. Uniqueness prevents duplicates. Application snapshots, audit, and notification work share one transaction.                                                                                                                                                         | PASS                         |
| Scope discipline                    | All three Must workflows include UI, authorization, persistence, failures, and tests; both requested Should workflows are P2 increments. UC-JOB-04 remains backlog. Production Apply is explicitly gated on the separately approved retained-CV provider rather than misusing Feature 004 temporary content. | PASS WITH RELEASE DEPENDENCY |
| Quality/accessibility               | Plan includes p95 measurement, keyboard and accessibility tests, non-color states, and 320-pixel evidence.                                                                                                                                                                                                   | PASS                         |
| Maintainable architecture           | App Router handlers stay thin; services own policy; repositories own persistence; shared contracts validate trust boundaries; no second session/database/provider is introduced.                                                                                                                             | PASS                         |

### Post-Design Re-check

- The data model preserves referential integrity, immutable application snapshots, unique/idempotent writes, explicit states, and privacy-minimized audit data.
- OpenAPI exposes public fields only and gives protected mutations consistent authentication, CSRF, validation, conflict, and rate-limit responses.
- Provider-neutral notification work does not couple application validity to delivery or introduce a second email/session mechanism.
- The migration is additive and forward-only; no Feature 001/002 migration is edited.
- No constitutional design violation or unresolved product ambiguity remains. Production UC-APP-01 stays blocked until the retained-CV provider gate is satisfied.

## Architecture and Boundaries

```text
Public/Authenticated Server Component or Client Island
  -> App Router page / thin Route Handler
  -> discovery, saved-job, report, or application service
  -> repository + existing security/audit/rate-limit boundary
  -> PostgreSQL 16.12

Application transaction
  -> eligibility recheck
  -> application + snapshots + answers
  -> AuditEvent
  -> RecruitmentNotificationWork
```

- `shared/contracts/jobs` owns transport-neutral query, response, and mutation schemas.
- `backend/services/jobs` owns normalization, public availability, action projection, eligibility, snapshot building, and orchestration.
- `backend/repositories/jobs` owns Prisma and any reviewed parameterized SQL/keyset details.
- `app/api/jobs`, `app/api/saved-jobs`, and nested job routes translate HTTP only.
- `frontend/features/jobs` owns presentation and protected-action client islands and cannot import server services or Prisma.

## Search and Pagination Design

1. Normalize query/location/tag input with Unicode NFD, remove combining marks, map Vietnamese `đ/Đ` to `d`, lowercase, collapse whitespace, and enforce bounds.
2. Persist normalized title, location, and search document beside original public text; future job management refreshes them when approved content changes.
3. Search only `ACTIVE` postings with approval, reached publication time, and unpassed deadline/close time.
4. Use deterministic filters and PostgreSQL trigram/B-tree indexes. Any relevance SQL remains parameterized inside the repository.
5. Use opaque versioned keyset cursors with selected sort keys and job-ID tie-breakers.
6. `RELEVANCE` uses deterministic weighted title/skill/document similarity and falls back to newest when the query is blank. `NEWEST` and `SALARY_DESC` define stable null ordering.

## Security and Privacy Controls

- Dedicated public projections omit private membership/contact, moderation, report, application, CV, and audit fields.
- Protected routes reuse `requireSession`, same-origin validation, and session-bound CSRF proof. Strict schemas reject ownership input.
- Apply rechecks CV/profile ownership, CV confirmation, job status/deadline, account state, consent, answers, and duplicates in the transaction.
- Save/delete are naturally idempotent. Apply uses an opaque `Idempotency-Key` bound to the normalized submission.
- Reports use a nullable unique unresolved key plus the existing database rate limiter; a later moderation workflow clears the key on resolution.
- Report text, answers, CV/profile snapshots, credentials, cookies, raw headers, and raw network data are excluded from ordinary logs and audit context.

## Inherited Browser Session Boundary

Feature 003 defines no browser-session mechanism. Better Auth remains the exclusive owner established by Feature 001:

- authentication state is an opaque PostgreSQL-backed session referenced only by the server-controlled cookie;
- production uses `__Host-smarthire.session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`; local HTTP uses unprefixed `smarthire.session` without `Secure`;
- every protected Job Board request reuses server validation plus ACTIVE-account, 30-minute idle-expiry, and creation-plus-seven-day absolute-expiry enforcement;
- logout and explicit session management revoke selected sessions, password reset revokes all account sessions, and natural expiry is denied even before cleanup removes old rows;
- Feature 003 introduces no authentication cookie, JWT, session table, localStorage/sessionStorage credential, or alternate lifecycle.

Public discovery may resolve an optional session only to project the current actor's save/apply state. Any actor-scoped response is `private, no-store`; anonymous public projections may use the documented short public cache.

## Retained CV and Feature 004 Boundary

UC-APP-01 consumes `CandidateCv`, a separately retained application document. It is not produced by Feature 004, whose approved contract treats uploads as temporary import sources and deletes confirmed source content within seven days.

- `CandidateCv.storageKey` must reference an approved retained private-document provider and must never reference `CvUpload`, `CvStoredArtifact`, extracted text, draft payload, provenance, or a Feature 004 cleanup-controlled locator.
- The application form returns only safe confirmed document options; commit rechecks candidate ownership, confirmation, archival state, PDF/DOCX media type, and the decimal `5,000,000`-byte limit.
- Controlled fixtures may exercise the consumer contract, but production release evidence must identify the approved retained-document producer, consent/purpose notice, malware-safety inheritance, encryption, retention/deletion owner, and replacement boundary.
- If that provider is absent, the candidate receives the existing no-confirmed-CV recovery path and no application is created. The system must not weaken UC-APP-01 by treating a confirmation receipt as a file attachment.

## Migration and Recovery

1. Add enums, public company/job structures, normalized search columns, skills/questions, confirmed retained-CV metadata, saved jobs, reports, applications, answers, and notification work without rewriting identity/profile rows.
2. Enable `pg_trgm` if absent and add reviewed indexes after invariant checks.
3. Do not seed production in the migration; tests and quickstart use isolated fixtures.
4. Keep Feature 004 in `008_cv_upload_parse_review`, followed by Feature 003 in the single `009_job_board_advanced_search` migration, including the exact decimal 5,000,000-byte constraint and three trigram indexes. Later migrations continue with the sequential `010`–`013` prefixes.
5. Never accept a generated migration that drops the reviewed trigram indexes. Verify clean, Feature 002-upgraded, and Feature 004-upgraded databases without editing migrations after this feature is merged or applied outside disposable development.
6. Recover later changes by reviewed roll-forward migration; restore from tested backup if affected production data cannot be safely repaired.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/003-job-board-and-advanced-search/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/{openapi.yaml,internal-contracts.md}
├── checklists/
│   ├── {requirements.md,job-board.md,integration-boundaries.md}
│   ├── {foundation-results.md,integration-results.md,migration-results.md}
│   ├── {us1-...,us2-...,us3-...,us4-...,us5-...-results.md}
│   └── {traceability.md,release-results.md,usability-results.md}
└── tasks.md
```

### Source Code (repository root)

```text
web/
├── prisma/{schema.prisma,migrations/009_job_board_advanced_search/migration.sql}
├── scripts/measure-job-board-performance.mjs
├── src/
│   ├── app/jobs/{page.tsx,[slug]/page.tsx}
│   ├── app/api/{jobs,saved-jobs}/**/route.ts
│   ├── backend/{repositories,services}/jobs/
│   ├── frontend/features/jobs/
│   └── shared/contracts/jobs/
└── tests/{architecture,backend,frontend,system}/**/jobs/
```

**Structure Decision**: Extend the existing `web` workspace and its established presentation/service/repository separation. No second frontend, API service, session implementation, database, or provider-specific application dependency is introduced.

## Verification Strategy

- Contract: strict Zod schemas, OpenAPI parity, public allowlist, canonical errors.
- Unit: normalization, bounds, cursors, ordering, availability, report rules, eligibility, and snapshots.
- PostgreSQL integration: visibility/indexes, clean/002/004 upgrade paths, uniqueness races, rate limiting, rollback, audit/notification atomicity, authorization matrix.
- Cross-feature boundary: exact decimal CV cap, approved retained-CV references only, and architecture tests that prevent Feature 004 temporary artifacts from becoming application attachments.
- Frontend: URL state, empty/retry/loading, action reconciliation, validation, keyboard flows, 320-pixel layout, non-color states.
- E2E: browse/detail, login return, save/remove, report, apply, and duplicate/closed/session/failure recovery.
- Quality: format, lint, typecheck, full Vitest, Playwright desktop/mobile, migration verification, build, and p95 harness.
- Per-story evidence: each US1-US5 checklist combines the detailed independent
  flow, failures, contracts, source/tests, exit gate, and aggregate
  non-sensitive results without overstating production readiness.

## Complexity Tracking

No constitutional exception or added deployment unit is required. The retained-CV producer is a release dependency, not an implicit Feature 004 scope expansion.
