# Tasks: Candidate Profile Discovery and Recruiter Review

**Input**: Design documents from `spec-kit/specs/027-candidate-profile-discovery/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts](./contracts/)

**Tests**: Tests are required because the specification defines authorization, privacy, audit, performance, accessibility, and measurable acceptance outcomes.

**Organization**: Tasks are grouped by user story so each workflow can be implemented and tested independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks that touch different files after its dependencies are complete.
- **[US#]**: User story from the specification.

## Phase 1: Setup

**Purpose**: Establish the feature’s verification entry points and fixtures without changing production behavior.

- [ ] T001 [P] Add the focused `test:profile-discovery` and `profile-discovery:migration:verify` scripts in `web/package.json`.
- [ ] T002 [P] Add Candidate/Candidate/Recruiter application fixtures and safe account-ID helpers in `web/tests/helpers/profile-database-fixture.ts` and `web/tests/helpers/application-fixture.ts`.

---

## Phase 2: Foundational privacy, storage, and authorization primitives

**Purpose**: Complete the shared persistence, contracts, audit, throttling, retention, and redaction boundaries required by every story.

**CRITICAL**: No user-story route or UI may be shipped before this phase is complete.

- [ ] T003 Add `CandidateProfileVisibility`, `JobApplicationContactConsent`, snapshot-review retention fields/relations, and indexes to `web/prisma/schema.prisma`.
- [ ] T004 Create forward-only migration `web/prisma/migrations/066_candidate_profile_discovery/migration.sql` with default-hidden/backfill-safe behavior, one-to-one constraints, retention deadlines, and recovery notes.
- [ ] T005 [P] Create `web/scripts/verify-candidate-profile-discovery-migration.mjs` and migration constraint tests in `web/tests/backend/integration/db/candidate-profile-discovery-constraints.test.ts`.
- [ ] T006 Define strict visibility-section, profile-projection, lookup, and mutation contracts in `web/src/shared/contracts/account/profile.ts` and `web/src/shared/contracts/profile-discovery.ts`.
- [ ] T007 Define application contact-consent and recruiter applicant-profile response contracts in `web/src/shared/contracts/candidate-applications/index.ts` and `web/src/shared/contracts/applications/applicant-profile.ts`.
- [ ] T008 Extend safe profile-discovery, consent, and recruiter-review actions/contexts/target types in `web/src/backend/audit/events.ts` and cover redaction constraints in `web/tests/backend/unit/security/profile-discovery-audit.test.ts`.
- [ ] T009 Extend `web/src/backend/repositories/rate-limit/prisma-rate-limit-repository.ts` with atomic account/network admission, unsuccessful rolling-hour count, and durable `blockedUntil` enforcement; add policies in `web/src/backend/security/rate-limit/policies.ts`.
- [ ] T010 [P] Add limiter boundary, concurrent-attempt, account/network isolation, and 15-minute-block tests in `web/tests/backend/unit/security/profile-discovery-rate-limit.test.ts`.
- [ ] T011 Create common audience projection/redaction helpers in `web/src/backend/services/profile/profile-visibility-projection.ts` and unit tests in `web/tests/backend/unit/profile/profile-visibility-projection.test.ts`.
- [ ] T012 Extend `web/src/backend/applications/workers/application-retention-worker.ts` and `web/scripts/run-application-retention-worker.mjs` to deny expired application profile-snapshot review while preserving legal holds and minimum audit evidence.
- [ ] T013 [P] Add snapshot-retention and legal-hold tests in `web/tests/backend/applications/profile-snapshot-retention.test.ts`.

**Checkpoint**: Schema, contracts, audit allowlists, limiter behavior, shared redaction, and retention policy are ready. All stories can now be implemented without weakening privacy policy.

---

## Phase 3: User Story 1 — Configure a discoverable professional profile (Priority: P1)

**Goal**: An active Candidate can independently set Candidate-discovery and Recruiter-after-application visibility, with default-hidden disclosure and auditable versioned saves.

**Independent Test**: A Candidate saves different section selections for each audience, reloads them, then hides an audience; the saved policy updates and is audit-recorded without modifying applications.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add profile visibility contract/version-conflict tests in `web/tests/backend/contract/candidate-profile-visibility.contract.test.ts`.
- [ ] T015 [P] [US1] Add save, default-hidden, concurrency, and audit integration tests in `web/tests/backend/integration/profile/profile-visibility.test.ts`.
- [ ] T016 [P] [US1] Add profile visibility form/component and accessibility tests in `web/tests/frontend/components/profile-account/profile-visibility.test.tsx` and `web/tests/frontend/accessibility/profile-visibility.accessibility.test.tsx`.

### Implementation for User Story 1

- [ ] T017 [US1] Extend `web/src/backend/repositories/profile/prisma-profile-query-repository.ts` and `web/src/backend/repositories/profile/prisma-profile-command-repository.ts` to load and compare-and-set the visibility record.
- [ ] T018 [US1] Extend `web/src/backend/services/profile/get-profile-aggregate.ts` and `web/src/backend/services/profile/save-profile-section.ts` to return/save visibility using the strict contracts and audit transaction.
- [ ] T019 [US1] Extend `web/src/app/api/account/profile/route.ts` so authenticated Candidate GET/PATCH operations expose and mutate only the owner’s visibility policy with CSRF/version checks.
- [ ] T020 [US1] Build `web/src/frontend/features/profile/components/profile-visibility-form.tsx` and integrate it into `web/src/frontend/features/profile/components/profile-overview.tsx`, `web/src/frontend/features/profile/components/profile-navigation.tsx`, and profile styles.

**Checkpoint**: User Story 1 is independently demonstrable: the Candidate controls both audiences and unselected fields remain hidden.

---

## Phase 4: User Story 2 — Find a professional by exact ID (Priority: P1)

**Goal**: An authenticated Candidate can search `/connections` by full exact ID, receive at most one consented projection, and open a rechecked profile without obtaining messaging rights.

**Independent Test**: Two Candidates perform a valid discovery lookup; the viewer sees one selected projection. Unknown, inactive, hidden, and unauthorized IDs all return the same neutral result, and messaging remains unavailable unless independently eligible.

### Tests for User Story 2

- [ ] T021 [P] [US2] Add lookup API contract and no-store response tests in `web/tests/backend/contract/profile-discovery.contract.test.ts`.
- [ ] T022 [P] [US2] Add active-viewer/target, hidden, self-redirect, empty-section, and audience-projection integration tests in `web/tests/backend/integration/profile-discovery/candidate-lookup.test.ts`.
- [ ] T023 [P] [US2] Add non-enumeration, timing-path, raw-ID audit redaction, and throttle security tests in `web/tests/security/profile-discovery/candidate-lookup-privacy.test.ts`.
- [ ] T024 [P] [US2] Add Connections search component/accessibility tests in `web/tests/frontend/components/connections/connections-workspace-profile-search.test.tsx` and `web/tests/frontend/accessibility/connections/profile-search.accessibility.test.tsx`.

### Implementation for User Story 2

- [ ] T025 [US2] Add active-target exact-ID lookup and audience-projection queries to `web/src/backend/repositories/profile/prisma-profile-query-repository.ts`.
- [ ] T026 [US2] Implement active-Candidate viewer admission, self-profile redirect outcome, neutralization, empty-section projection, and minimal audit writes in `web/src/backend/services/profile/candidate-profile-discovery-service.ts`.
- [ ] T027 [US2] Create `web/src/app/api/people/lookup/route.ts` with authenticated GET validation, dual account/network admission, neutral response semantics, and private no-store headers.
- [ ] T028 [US2] Refactor `web/src/app/(workspace)/people/[userId]/page.tsx` and `web/src/frontend/features/profile/components/public-professional-profile.tsx` to recheck Candidate discovery policy while retaining the independently derived messaging CTA.
- [ ] T029 [US2] Add an exact-ID search field, neutral result card, and safe profile link to `web/src/frontend/features/connections/components/connections-workspace.tsx` and `web/src/frontend/features/connections/styles/connections.css`.
- [ ] T030 [US2] Add Candidate discovery end-to-end coverage, including hidden-after-search behavior, in `web/tests/system/e2e/connections/candidate-profile-discovery.spec.ts`.

**Checkpoint**: User Story 2 is independently demonstrable without a public directory or implicit messaging relationship.

---

## Phase 5: User Story 3 — Review an applicant profile as an authorized recruiter (Priority: P1)

**Goal**: A recruiter with current verified company/job authority can review an applicant’s labelled immutable snapshot, submitted documents, and permitted live profile; no other recruiter can obtain those data.

**Independent Test**: An authorized recruiter opens the applicant profile from the candidate drawer. An unrelated company, removed member, or wrong job ID receives no snapshot, live profile, contact, or document data.

### Tests for User Story 3

- [ ] T031 [P] [US3] Add recruiter applicant-profile contract and cache-header tests in `web/tests/backend/contract/recruiter-applicant-profile.contract.test.ts`.
- [ ] T032 [P] [US3] Add snapshot/live-profile/redaction integration tests in `web/tests/backend/integration/applications/recruiter-applicant-profile.test.ts`.
- [ ] T033 [P] [US3] Add cross-company, wrong-job, removed-membership, expired-retention, and direct-route security tests in `web/tests/security/applications/recruiter-applicant-profile-authorization.test.ts`.
- [ ] T034 [P] [US3] Add candidate drawer profile-action/component and keyboard/screen-reader accessibility tests in `web/tests/frontend/scoring/candidate-score-drawer-profile.test.tsx` and `web/tests/frontend/accessibility/recruiter-applicant-profile.accessibility.test.tsx`.

### Implementation for User Story 3

- [ ] T035 [US3] Extend `web/src/backend/repositories/applications/application-repository.ts` and `web/src/backend/repositories/applications/prisma-application-repository.ts` with an application-scoped snapshot/live/consent read that never directly projects email or phone.
- [ ] T036 [US3] Implement `web/src/backend/applications/services/read-recruiter-application-profile.ts` using `RecruiterApplicationAuthorization.authorizeApplication`, current recruiter visibility, snapshot-retention checks, shared redaction, and audit writes.
- [ ] T037 [US3] Create `web/src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/profile/route.ts` with neutral unavailable failures, private no-store headers, and no document bypass.
- [ ] T038 [US3] Add labelled profile view/action to `web/src/frontend/features/recruiter-applications/candidate-score-drawer.tsx` and supporting recruiter profile components/styles under `web/src/frontend/features/recruiter-applications/`.
- [ ] T039 [US3] Apply consent-aware contact redaction to `web/src/backend/repositories/applications/prisma-application-repository.ts`, `web/src/backend/applications/services/ranked-candidate-list.ts`, and recruiter document/preview projections that currently expose email or phone.

**Checkpoint**: User Story 3 is independently demonstrable with application/job tenancy, immutable evidence, retention checks, and consent-safe recruiter projections.

---

## Phase 6: User Story 4 — Give contact consent for one application (Priority: P2)

**Goal**: A Candidate explicitly grants contact disclosure per application, can later withdraw it, and each recruiter projection immediately honors the current consent.

**Independent Test**: The same Candidate submits two applications with different choices, then withdraws one; each authorized recruiter sees contact only for the currently consented application.

### Tests for User Story 4

- [ ] T040 [P] [US4] Add submission and contact-consent route contract tests in `web/tests/backend/contract/application-contact-consent.contract.test.ts`.
- [ ] T041 [P] [US4] Add per-application grant, withdrawal, ownership, version-conflict, and audit integration tests in `web/tests/backend/integration/applications/application-contact-consent.test.ts`.
- [ ] T042 [P] [US4] Add application review consent UI/accessibility tests in `web/tests/frontend/applications/application-contact-consent.test.tsx` and `web/tests/frontend/accessibility/application-contact-consent.accessibility.test.tsx`.

### Implementation for User Story 4

- [ ] T043 [US4] Extend submission/contact schemas in `web/src/shared/contracts/candidate-applications/index.ts` and `web/src/shared/contracts/jobs/actions.ts` with the explicit initial `shareContactWithRecruiter` choice.
- [ ] T044 [US4] Update `web/src/backend/candidate-applications/application-draft-service.ts`, `web/src/backend/candidate-applications/candidate-application-submission-service.ts`, and `web/src/backend/services/jobs/job-application-service.ts` to validate and atomically persist initial contact consent with the immutable contact snapshot.
- [ ] T045 [US4] Implement candidate-owned consent read/update service and route in `web/src/backend/candidate-applications/application-contact-consent-service.ts` and `web/src/app/api/candidate/applications/[applicationId]/contact-consent/route.ts` with CSRF, compare-and-set, immediate withdrawal, and audit.
- [ ] T046 [US4] Add clear per-application contact disclosure control and withdrawal status to `web/src/frontend/features/candidate-applications/components/application-review-submit.tsx`, `web/src/frontend/features/candidate-applications/components/application-tracker.tsx`, and `web/src/frontend/features/candidate-applications/styles/application-workflow.css`.

**Checkpoint**: User Story 4 is independently demonstrable and updates every recruiter projection through the shared consent gate.

---

## Phase 7: Polish and cross-cutting verification

**Purpose**: Prove all feature requirements together, harden migrations/contracts, and complete release evidence.

- [ ] T047 [P] Update `web/scripts/check-application-contracts.mjs`, profile contract parity tests, and `spec-kit/specs/027-candidate-profile-discovery/contracts/profile-discovery.openapi.yaml` to enforce implemented contract parity.
- [ ] T048 [P] Add exact-ID lookup and recruiter applicant-profile performance measurements, including environment, dataset, sample, concurrency, P95, maximum, and error-rate report fields, in `web/scripts/measure-profile-discovery-performance.mjs`, `web/tests/performance/profile-discovery/lookup-performance.test.ts`, and `web/tests/performance/profile-discovery/recruiter-profile-performance.test.ts`.
- [ ] T049 [P] Add full Candidate/Recruiter privacy regression coverage in `web/tests/security/profile-discovery/` and ensure audit payloads never contain raw IDs, contact, or profile content.
- [ ] T050 Run the validation matrix from `spec-kit/specs/027-candidate-profile-discovery/quickstart.md`: migration verification, typecheck, focused suites, E2E, accessibility, and build; record failures/fixes in the feature evidence.
- [ ] T051 [P] Add and execute the first-attempt Candidate discovery usability protocol with at least 10 representative participants in `web/tests/usability/profile-discovery/candidate-discovery-protocol.md`; record the SC-002 90% completion result in the feature evidence.

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1** has no dependency.
- **Phase 2** depends on Phase 1 and blocks every user story.
- **US1, US2, and US3** may proceed after Phase 2. US2 requires US1’s visibility save for its full acceptance test; US3 works with default-hidden recruiter visibility and later gains contact through US4.
- **US4** depends on Phase 2 and its contact-redaction integration point in US3.
- **Phase 7** depends on all selected user stories.

### User story dependency graph

```text
Setup → Foundation → US1 (visibility) → US2 (exact-ID discovery)
                   ├────────────────→ US3 (recruiter profile) → US4 (contact consent)
                   └──────────────────────────────────────────→ Polish
```

### Parallel opportunities

- T001 and T002 can run in parallel.
- T005, T008, T010, and T013 can run in parallel once their prerequisite production seams exist.
- In each story, all `[P]` tests can be authored in parallel before implementation.
- After Phase 2, separate developers can work on US1 and the initial US3 repository/service work; start US2 after US1 supplies visibility mutation.

## Implementation strategy

### MVP checkpoint

Complete Phases 1–4 to deliver a privacy-safe Candidate visibility editor and exact-ID discovery. Validate the neutral lookup response, section redaction, rate limiting, no implicit messaging, and accessibility before starting recruiter presentation work.

### Incremental delivery

1. Finish shared schema, audit, limiter, projection, and retention policy.
2. Deliver Candidate visibility controls (US1), then exact-ID lookup (US2).
3. Deliver recruiter application profile (US3), ensuring no current list/ranking/document contact leakage.
4. Add per-application contact consent and withdrawal (US4).
5. Complete cross-cutting performance, security, migration, contract, and end-to-end verification.

## Format validation

All 51 tasks use the required checkbox, sequential task ID, optional `[P]`, story label for story work, and exact file paths.
