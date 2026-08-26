# Implementation Plan: Candidate Company and Team Applications

**Branch**: `028-candidate-company-job-applications` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-candidate-company-job-applications/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a Candidate-facing Company discovery experience with public company cards, company detail pages, employee-derived size, and scoped job search by keyword and location. Add a separate Owner-only Team Applications workflow for candidates who want to join a company as HR Manager or Recruiter. Team applications retain the submitted CV, allow a human Owner decision, send an idempotent invitation, and create membership only after explicit invitation acceptance. Ordinary job applications continue using the existing job detail, application, scoring, and pipeline workflows.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9, React 19, Next.js 16 App Router, Prisma 7.9, PostgreSQL 16.

**Primary Dependencies**: Existing Better Auth session boundary, Zod contracts, Prisma repositories, CompanyMembership/CompanyInvitation services, CV document storage, job discovery/search service, notification outbox/email service, CSRF and audit primitives.

**Storage**: PostgreSQL for company/job/application/team-application/invitation state; existing protected CV storage for submitted evidence; existing notification outbox for email delivery.

**Testing**: Vitest unit, contract, integration, security and frontend tests; Playwright system tests; accessibility checks; representative P95 performance tests.

**Target Platform**: Existing responsive Next.js Candidate workspace and Recruiter/Company Settings workspace.

**Project Type**: Next.js modular-monolith web application.

**Performance Goals**: Company list/detail and scoped keyword/location job search P95 ≤2 seconds; normal page load P95 ≤3 seconds; invitation and decision actions provide visible completion/failure feedback without duplicate records.

**Constraints**: Server-side company visibility and tenant authorization; only approved public companies/jobs; Team Applications limited to HR Manager and Recruiter; CV PDF/DOCX only and exactly 5,000,000-byte maximum; Owner decision required; invitation acceptance required before membership; no scoring, AI, pipeline, or automatic hiring; Vietnamese personal-data and retention controls.

**Scale/Scope**: One public Company area, one company detail view with scoped job search, one Team Applications view, one team-application submission flow, and invitation acceptance. Reuse existing ordinary job application flow; no public people directory or general-purpose ATS pipeline.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Human-controlled recruitment | PASS | Owner explicitly accepts or rejects team applications; no automatic hiring, scoring, or pipeline transition. |
| Security, privacy, tenant isolation | PASS | Public projections expose approved company/job fields only; CVs and application records require candidate/Owner authorization; membership is not granted on submission. |
| State, audit, and integrity | PASS | Team application and invitation transitions are server-validated, transactional, auditable, and idempotent; duplicate active applications/invitations are prevented. |
| CV and personal-data protection | PASS | PDF/DOCX and 5,000,000-byte limit, validation before persistence, least-privilege CV access, retention/deletion policy, and email privacy controls are specified. |
| Quality and accessibility | PASS | P95 search/page targets, responsive UI, keyboard access, labels, loading/error states, and security/performance acceptance tests are planned. |
| Maintainable boundaries | PASS | Company/job projections, team-application service, invitation service, repositories, contracts, and UI remain separated; ordinary job workflow is reused. |
| Scope discipline | PASS | No scoring, AI recommendation, pipeline/Kanban, or ordinary job application replacement is introduced. |

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/028-candidate-company-job-applications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., web, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Phase 0: Research Summary

Research decisions are recorded in [research.md](./research.md). The design reuses existing domain boundaries rather than introducing a second ordinary job-application system.

## Phase 1: Design Summary

- Public Company pages use a safe, approved-company projection and reuse deterministic job discovery/search behavior scoped by `companyId`.
- Team Applications are a separate entity from ordinary `JobApplication`; they capture a team role and immutable CV evidence without scoring or pipeline state.
- Owner decisions and invitation creation are transactional and idempotent. Invitation acceptance is the only transition that grants company membership.
- Company size is a read-time projection from active membership count and documented size ranges, with an unavailable state when source data is missing.
- Candidate and Owner views expose only their permitted projections. CV download/preview is authorized server-side and audited.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/028-candidate-company-job-applications/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/company-team-applications.openapi.yaml
└── checklists/requirements.md
```

### Source Code (repository root)

```text
web/
├── prisma/schema.prisma and migration
├── src/app/company/page.tsx
├── src/app/company/[companyId]/page.tsx
├── src/app/api/companies/route.ts
├── src/app/api/companies/[companyId]/route.ts
├── src/app/api/companies/[companyId]/jobs/route.ts
├── src/app/api/candidate/team-applications/route.ts
├── src/app/api/candidate/team-applications/[applicationId]/route.ts
├── src/app/api/recruiter/company/team/applications/route.ts
├── src/app/api/recruiter/company/team/applications/[applicationId]/route.ts
├── src/app/api/recruiter/company/team/applications/[applicationId]/accept/route.ts
├── src/app/api/recruiter/company/team/applications/[applicationId]/reject/route.ts
├── src/app/api/recruiter/company/team/invitations/accept/route.ts
├── src/backend/services/companies/company-discovery-service.ts
├── src/backend/services/company-members/team-application-service.ts
├── src/backend/services/company-members/team-application-authorization.ts
├── src/backend/repositories/companies/
├── src/backend/repositories/company-members/
├── src/frontend/features/candidate-company/
├── src/frontend/features/recruiter-workspace/company-team-applications-screen.tsx
├── src/shared/contracts/company/
├── src/shared/contracts/company-members/team-applications.ts
└── tests/{backend,frontend,security,system}/company-team-applications/
```

**Structure Decision**: Extend the existing modular web application. Candidate company discovery and ordinary job navigation belong to the public/candidate job-board boundary. Team applications, Owner review, invitation decisions, CV access, and membership creation belong to the existing company-members/recruiter workspace boundary. Shared contracts keep transport validation separate from domain services and persistence.

## Implementation Phases

### Phase 0 — Research

1. Confirm existing approved-company projection and public job visibility rules.
2. Confirm job search normalization and company-scoped filtering behavior.
3. Confirm existing CV validation, immutable document promotion, retention, and download authorization.
4. Confirm CompanyInvitation acceptance and email outbox idempotency boundaries.
5. Record decisions and rejected alternatives in `research.md`.

### Phase 1 — Data and contracts

1. Define TeamApplication fields, states, unique constraints, and relations to Candidate, Company, team opportunity/job context, CV evidence, invitation, and audit records.
2. Add safe persistence changes and retention/deletion handling for team CV evidence.
3. Define public company list/detail/job-search projections and Team Application candidate/Owner contracts.
4. Define invitation acceptance and rejection-notification outcomes, including retry/idempotency behavior.
5. Create quickstart validation scenarios.
6. Update agent context to reference this plan.

### Phase 2 — Implementation sequencing for tasks generation

1. Public company projections and responsive Candidate Company list/detail UI.
2. Company-scoped keyword/location search and navigation to existing job detail pages.
3. Team opportunity entry point and candidate CV submission/status flow.
4. Team Application repository/service, authorization, audit, retention, and Owner review UI.
5. Accept/reject decisions, optional rejection reason, email notifications, and invitation retry behavior.
6. Invitation acceptance and membership creation using existing company membership rules.
7. Security, accessibility, integration, system, and P95 verification.

## Complexity Tracking

No constitutional violations identified; no complexity exception is required.
