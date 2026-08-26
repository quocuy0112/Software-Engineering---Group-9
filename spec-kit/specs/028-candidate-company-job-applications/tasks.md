# Tasks: Candidate Company and Team Applications

**Input**: Design documents from `spec-kit/specs/028-candidate-company-job-applications/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/company-team-applications.openapi.yaml`, `quickstart.md`

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independently verifiable increment.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature boundaries and shared test fixtures without changing ordinary job application behavior.

- [ ] T001 Create the feature directory structure and register `spec-kit/specs/028-candidate-company-job-applications/tasks.md` as the implementation task source.
- [ ] T002 [P] Add shared Team Application role/status labels and display helpers in `web/src/shared/contracts/company-members/team-applications.ts`.
- [ ] T003 [P] Add feature test fixtures for approved companies, active public jobs, Owner accounts, Candidate accounts, team roles, invitations, and CV files in `web/tests/helpers/company-team-applications-fixture.ts`.
- [ ] T004 [P] Add localized copy keys for Company discovery, Team Applications, invitation decisions, rejection email, and unavailable/empty/error states in the existing locale resource files under `web/src/shared/i18n/`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, authorization, file, notification, audit, and projection boundaries required by all stories.

- [ ] T005 Define `TeamApplication` and `TeamOpportunity` schema entities, supported role/status enums, relations, indexes, and duplicate constraints in `web/prisma/schema.prisma`.
- [ ] T006 Create a safe PostgreSQL migration for Team Application, Team Opportunity, CV evidence linkage, rejection reason, and invitation linkage in `web/prisma/migrations/`.
- [ ] T007 [P] Add repository interfaces for company public projections, company-scoped jobs, Team Opportunities, Team Applications, and decision updates under `web/src/backend/repositories/companies/` and `web/src/backend/repositories/company-members/`.
- [ ] T008 [P] Implement server-side company visibility and tenant authorization for approved public companies/jobs and verified Owner Team Applications in `web/src/backend/services/companies/company-discovery-authorization.ts` and `web/src/backend/services/company-members/team-application-authorization.ts`.
- [ ] T009 [P] Define Zod request/response contracts matching `spec-kit/specs/028-candidate-company-job-applications/contracts/company-team-applications.openapi.yaml` in `web/src/shared/contracts/company/` and `web/src/shared/contracts/company-members/team-applications.ts`.
- [ ] T010 Implement validated CV promotion/access helpers that enforce PDF/DOCX and exactly 5,000,000-byte maximum, immutable evidence, retention, and Owner-only authorization in `web/src/backend/services/company-members/team-application-cv-service.ts`.
- [ ] T011 Implement transactional Team Application state transitions, duplicate prevention, optimistic concurrency, candidate withdrawal, and audit event creation in `web/src/backend/services/company-members/team-application-service.ts`.
- [ ] T012 Extend the existing CompanyInvitation service to support originating Team Applications, confirmed HR Manager/Recruiter role binding, idempotent creation, expiration/revocation, and acceptance handoff in `web/src/backend/company-members/company-team-service.ts`.
- [ ] T013 Define team-application email templates and notification payloads for acceptance/invitation, rejection with optional reason, delivery failure, and retry under `web/src/backend/notifications/` or the existing notification template boundary.
- [ ] T014 Add foundational contract, repository, authorization, migration, CV-validation, idempotency, and audit tests under `web/tests/backend/{contract,integration,security,unit}/company-team-applications/`.

**Checkpoint**: Database, contracts, authorization, CV protection, lifecycle, invitation, and notification foundations are ready; no user story should bypass them.

## Phase 3: User Story 1 - Browse Companies (Priority: P1)

**Goal**: Candidates can open Company and browse approved company cards.

**Independent Test**: As a Candidate, open Company and verify company cards, safe public fields, empty state, and navigation to a company detail page.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add contract tests for approved public company list projection in `web/tests/backend/contract/company-discovery.contract.test.ts`.
- [ ] T016 [P] [US1] Add authorization tests proving unapproved, private, suspended, and cross-tenant company data is excluded in `web/tests/security/company-discovery/company-public-privacy.test.ts`.
- [ ] T017 [P] [US1] Add frontend tests for company cards, fallback logo, empty state, keyboard navigation, and detail-link behavior in `web/tests/frontend/company-discovery/company-list.test.tsx`.

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement approved public company list projection and pagination in `web/src/backend/services/companies/company-discovery-service.ts` and `web/src/backend/repositories/companies/prisma-company-discovery-repository.ts`.
- [ ] T019 [US1] Implement the Candidate Company route and data loading in `web/src/app/company/page.tsx` and `web/src/app/api/companies/route.ts`.
- [ ] T020 [US1] Build responsive company cards, description truncation, fallback logo, loading, error, empty, and keyboard-accessible states in `web/src/frontend/features/candidate-company/company-list-screen.tsx` and its stylesheet.
- [ ] T021 [US1] Add Candidate navigation entry and route link to Company in the existing Candidate workspace navigation files under `web/src/frontend/`.

**Checkpoint**: US1 is independently usable: candidates can discover only approved public companies and open a company detail target.

## Phase 4: User Story 2 - View Company Details and Jobs (Priority: P1)

**Goal**: Candidates can inspect public company information, team-role entry points, and active jobs.

**Independent Test**: Open one company detail page and verify public metadata, employee-derived size, team roles, active jobs, and unavailable/empty states.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add contract tests for company detail and active public job projections in `web/tests/backend/contract/company-detail.contract.test.ts`.
- [ ] T023 [P] [US2] Add integration tests for employee-derived size, missing fields, closed/rejected job exclusion, and cross-company job exclusion in `web/tests/backend/integration/company-discovery/company-detail.test.ts`.
- [ ] T024 [P] [US2] Add frontend tests for company metadata, size range, team-role actions, job cards, and ordinary-job detail navigation in `web/tests/frontend/company-discovery/company-detail.test.tsx`.

### Implementation for User Story 2

- [ ] T025 [P] [US2] Implement company detail projection with founding year, industry, location, active employee count-to-size-range mapping, and safe unavailable values in `web/src/backend/services/companies/company-discovery-service.ts`.
- [ ] T026 [P] [US2] Implement company-scoped active approved job projection by reusing existing job discovery rules in `web/src/backend/repositories/companies/prisma-company-job-repository.ts`.
- [ ] T027 [US2] Implement company detail route and public API in `web/src/app/company/[companyId]/page.tsx` and `web/src/app/api/companies/[companyId]/route.ts`.
- [ ] T028 [US2] Build the company header, metadata panel, team-role entry points, jobs section, and responsive detail layout in `web/src/frontend/features/candidate-company/company-detail-screen.tsx` and its stylesheet.
- [ ] T029 [US2] Link ordinary company jobs to the existing job detail route without routing them into Team Applications in `web/src/frontend/features/candidate-company/company-job-card.tsx`.

**Checkpoint**: US2 is independently usable: candidates can understand a company and distinguish team applications from ordinary job applications.

## Phase 5: User Story 3 - Search and Filter Company Jobs (Priority: P1)

**Goal**: Candidates can search the selected company’s jobs by keyword and location.

**Independent Test**: Apply keyword, location, combined, and reset filters and confirm results are company-scoped and deterministic.

### Tests for User Story 3

- [ ] T030 [P] [US3] Add contract tests for keyword/location query parameters and company-scoped result envelopes in `web/tests/backend/contract/company-jobs-search.contract.test.ts`.
- [ ] T031 [P] [US3] Add integration tests for case-insensitive, Vietnamese-diacritic-insensitive, location, combined, reset, and no-result behavior in `web/tests/backend/integration/company-discovery/company-job-search.test.ts`.
- [ ] T032 [P] [US3] Add frontend tests for search input, location selector, loading, no-results, clear filters, and keyboard-accessible interaction in `web/tests/frontend/company-discovery/company-job-search.test.tsx`.

### Implementation for User Story 3

- [ ] T033 [US3] Implement company-scoped query normalization, deterministic keyword matching, location filtering, pagination, and no-result projection in `web/src/backend/services/companies/company-job-search-service.ts`.
- [ ] T034 [US3] Implement `GET /api/companies/[companyId]/jobs` with validated query parameters in `web/src/app/api/companies/[companyId]/jobs/route.ts`.
- [ ] T035 [US3] Add search bar, location filter, combined query state, clear action, and result-count/empty feedback to `web/src/frontend/features/candidate-company/company-detail-screen.tsx`.
- [ ] T036 [US3] Add representative P95 company job-search performance coverage in `web/tests/performance/company-discovery/company-job-search-performance.test.ts`.

**Checkpoint**: US3 is independently usable: candidates can find ordinary jobs within one company and open their existing detail flow.

## Phase 6: User Story 4 - Apply for HR Manager or Recruiter Team Role (Priority: P1)

**Goal**: Candidates can submit one validated CV for an available HR Manager or Recruiter team opportunity.

**Independent Test**: Submit a valid CV once, verify confirmation and status, then verify invalid files, closed roles, and duplicates create no invalid records.

### Tests for User Story 4

- [ ] T037 [P] [US4] Add contract tests for multipart team-application submission and candidate status responses in `web/tests/backend/contract/team-application-candidate.contract.test.ts`.
- [ ] T038 [P] [US4] Add integration tests for valid submission, role validation, file limits, closed opportunity, duplicate prevention, withdrawal, and no-membership/no-invitation behavior in `web/tests/backend/integration/company-team-applications/candidate-submission.test.ts`.
- [ ] T039 [P] [US4] Add frontend tests for role selection, CV validation, submit confirmation, duplicate status, withdrawal, and accessible error/loading states in `web/tests/frontend/company-team-applications/candidate-team-application.test.tsx`.

### Implementation for User Story 4

- [ ] T040 [US4] Implement Candidate Team Opportunity projection and candidate-owned application/status repository methods in `web/src/backend/repositories/company-members/prisma-team-application-repository.ts`.
- [ ] T041 [US4] Implement multipart submission, CV validation/promotion, duplicate handling, candidate withdrawal, and application status service calls in `web/src/backend/services/company-members/team-application-service.ts`.
- [ ] T042 [US4] Implement Candidate Team Application endpoints in `web/src/app/api/candidate/team-applications/route.ts` and `web/src/app/api/candidate/team-applications/[applicationId]/route.ts`.
- [ ] T043 [US4] Build the Company team-application form with HR Manager/Recruiter selection, CV upload, confirmation, existing-status state, and accessible validation feedback in `web/src/frontend/features/candidate-company/team-application-form.tsx`.
- [ ] T044 [US4] Add candidate Team Application status/invitation display to the existing Candidate application/status area in `web/src/frontend/features/candidate-company/team-application-status.tsx`.

**Checkpoint**: US4 is independently usable: a Candidate can apply to join a company team without entering ordinary job scoring or pipeline behavior.

## Phase 7: User Story 5 - Owner Reviews and Invites Candidate (Priority: P1)

**Goal**: An authorized Owner can view CVs, reject with optional reason, or accept with a confirmed role and send an invitation.

**Independent Test**: Owner lists and opens a Team Application, views the CV, rejects one with/without reason, accepts another, and verifies unauthorized access is denied.

### Tests for User Story 5

- [ ] T045 [P] [US5] Add contract tests for Owner list/detail/accept/reject endpoints in `web/tests/backend/contract/team-application-owner.contract.test.ts`.
- [ ] T046 [P] [US5] Add security tests for Owner-only access, verified-company membership, cross-company isolation, CV download authorization, and private rejection-reason handling in `web/tests/security/company-team-applications/owner-authorization.test.ts`.
- [ ] T047 [P] [US5] Add integration tests for viewed/rejected/accepted transitions, optional reason email, invitation creation, retry idempotency, and audit events in `web/tests/backend/integration/company-team-applications/owner-decisions.test.ts`.
- [ ] T048 [P] [US5] Add frontend tests for Team Applications list/detail, CV action, accept role confirmation, reject reason field, email failure/retry, and accessibility states in `web/tests/frontend/company-team-applications/owner-review.test.tsx`.

### Implementation for User Story 5

- [ ] T049 [US5] Implement Owner Team Application list/detail projections and CV access authorization in `web/src/backend/services/company-members/team-application-owner-service.ts`.
- [ ] T050 [US5] Implement Owner list/detail/accept/reject Route Handlers in `web/src/app/api/recruiter/company/team/applications/route.ts`, `web/src/app/api/recruiter/company/team/applications/[applicationId]/route.ts`, `web/src/app/api/recruiter/company/team/applications/[applicationId]/accept/route.ts`, and `web/src/app/api/recruiter/company/team/applications/[applicationId]/reject/route.ts`.
- [ ] T051 [US5] Implement accept/reject transaction orchestration, optional rejection reason, notification enqueue, audit, and retry-safe outcomes in `web/src/backend/services/company-members/team-application-owner-service.ts`.
- [ ] T052 [US5] Build the Owner Team Applications list, detail drawer/page, CV preview/download action, status labels, and decision controls in `web/src/frontend/features/recruiter-workspace/company-team-applications-screen.tsx`.
- [ ] T053 [US5] Add Team Applications navigation, unread-count/status badge, and Owner-only visibility to `web/src/frontend/features/recruiter-workspace/company-settings-screen.tsx` and `web/src/app/recruiter/company-settings/team/applications/page.tsx`.

**Checkpoint**: US5 is independently usable: Owner decisions are human-controlled, authorized, auditable, and produce at most one invitation.

## Phase 8: User Story 6 - Accept Invitation and Join Company (Priority: P1)

**Goal**: Candidate accepts a valid invitation and receives the confirmed company role only after explicit consent.

**Independent Test**: Accept a valid invitation, verify membership role, then test expired/revoked/reused/wrong-account invitations.

### Tests for User Story 6

- [ ] T054 [P] [US6] Add contract tests for invitation preview/acceptance and membership outcome in `web/tests/backend/contract/team-invitation.contract.test.ts`.
- [ ] T055 [P] [US6] Add security and integration tests for email binding, expiration, revocation, one-time use, duplicate membership prevention, and audit behavior in `web/tests/security/company-team-applications/invitation-acceptance.test.ts`.
- [ ] T056 [P] [US6] Add frontend/system tests for invitation review, signed-in account mismatch, acceptance confirmation, and failure states in `web/tests/system/e2e/company-team-applications/team-invitation.spec.ts`.

### Implementation for User Story 6

- [ ] T057 [US6] Extend invitation acceptance service logic to validate token, recipient account, company state, role, expiration, revocation, and membership uniqueness in `web/src/backend/company-members/company-team-service.ts`.
- [ ] T058 [US6] Implement invitation preview/acceptance route behavior in `web/src/app/recruiter/company-invitation/page.tsx` and the existing invitation API routes under `web/src/app/api/recruiter/company/team/invitations/`.
- [ ] T059 [US6] Update invitation UI to show company, confirmed role, candidate account confirmation, acceptance result, and non-sensitive invalid-invitation errors in `web/src/frontend/features/recruiter-workspace/company-invitation-screen.tsx`.
- [ ] T060 [US6] Verify accepted invitation creates/activates exactly one HR Manager or Recruiter membership and updates Team Application status to JOINED in `web/tests/backend/integration/company-team-applications/membership-creation.test.ts`.

**Checkpoint**: US6 is independently usable: explicit invitation acceptance is the only path from Team Application to company membership.

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Complete quality, privacy, reliability, accessibility, and documentation verification across all stories.

- [ ] T061 [P] Add retention/deletion worker handling for Team Application CV evidence and minimum audit retention in `web/src/backend/jobs/` and `web/tests/backend/integration/company-team-applications/retention.test.ts`.
- [ ] T062 [P] Add notification delivery failure, retry, and duplicate suppression coverage in `web/tests/backend/integration/company-team-applications/notification-reliability.test.ts`.
- [ ] T063 [P] Add cross-tenant privacy regression tests covering public company projections, ordinary jobs, Team Applications, CVs, invitations, and membership data in `web/tests/security/company-team-applications/tenant-isolation.test.ts`.
- [ ] T064 [P] Add responsive and keyboard accessibility coverage for Candidate Company and Owner Team Applications in `web/tests/frontend/company-team-applications/accessibility.test.tsx`.
- [ ] T065 [P] Add end-to-end coverage for the full quickstart flow in `web/tests/system/e2e/company-team-applications/company-team-applications.spec.ts`.
- [ ] T066 Run the scenarios in `spec-kit/specs/028-candidate-company-job-applications/quickstart.md` and record any deviations or required updates in that document.
- [ ] T067 Re-run contract, unit, integration, security, frontend, system, accessibility, and P95 performance checks; resolve regressions without changing the ordinary job application workflow.
- [ ] T068 Review all changed user-facing copy, audit payloads, CV access paths, and error states for Vietnamese personal-data minimization and non-sensitive disclosure in the relevant `web/src/` and `web/tests/` files.

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- US1, US2, and US3 depend on the public projection/search foundations from Phase 2; US2 depends on US1’s shared Company navigation components where reused.
- US4 depends on Team Application persistence/contracts/CV boundaries from Phase 2 and the team-role entry point from US2.
- US5 depends on US4’s Team Application entity and candidate submission contract.
- US6 depends on US5’s invitation creation and existing CompanyInvitation acceptance boundary.
- Polish depends on all selected user stories being complete.

### User Story Dependencies

```text
Foundational
   ├── US1 Browse Companies
   ├── US2 Company Details and Jobs ──┐
   ├── US3 Company Job Search ────────┘
   └── US4 Team Application ──> US5 Owner Review and Decision ──> US6 Invitation Acceptance
```

### Parallel Opportunities

- T002–T004 can run in parallel after setup.
- T007–T010 and T014 can run in parallel where they touch separate repository, contract, service, and test files.
- US1 and US3 implementation can proceed in parallel after foundational public projections exist; US2 integrates their shared detail shell.
- Within each story, contract/security/frontend tests marked `[P]` can be written in parallel before implementation tasks.
- US4 candidate flow and US1/US3 public discovery can be staffed in parallel after Phase 2; US5 and US6 remain sequential because they depend on team-application and invitation state.
- T061–T065 can run in parallel during polish.

## Parallel Example: Public Discovery and Team Application

```text
Developer A: US1 company list + US2 company detail
Developer B: US3 company job search
Developer C: US4 candidate team application
```

After US4 is complete:

```text
Developer A: US5 Owner Team Applications
Developer B: US6 invitation acceptance
Developer C: security/accessibility/performance verification
```

## Implementation Strategy

1. Complete Setup and Foundational phases first; verify no ordinary job application behavior changes.
2. Deliver the public Company list/detail/search slice (US1–US3) as the discovery checkpoint.
3. Deliver US4 as the first Team Application MVP checkpoint: candidate submission, CV protection, duplicate prevention, and status only.
4. Add US5 Owner review and decision; validate accept/reject email and invitation idempotency before enabling the flow broadly.
5. Add US6 invitation acceptance and membership creation; validate that submission and Owner acceptance never grant access early.
6. Complete Polish and cross-cutting privacy, audit, retention, accessibility, reliability, and P95 checks before release.

## Notes

- Every task follows the required checklist format: checkbox, sequential ID, optional `[P]`, required story label in story phases, and an exact file path.
- Team Applications intentionally do not create scoring, AI, ordinary `JobApplication` pipeline stages, or automatic hiring decisions.
