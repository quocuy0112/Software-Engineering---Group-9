# Tasks: Business Verification Enrichment

**Input**: Design documents from `spec-kit/specs/014-business-verification-enrichment/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Required by the feature's measurable correctness, privacy, concurrency, performance, and accessibility criteria. Tests are written before the corresponding implementation and must fail for the intended missing behavior.

**Organization**: Tasks are grouped by user story. Feature 014 is one P0 release unit even though each story has an independent technical checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no incomplete dependency.
- **[Story]**: User story from `spec.md`.
- Every task includes an exact repository path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the feature's commands, provider configuration, and test entry point without changing behavior.

- [X] T001 Add focused verification test and migration-verification scripts in `web/package.json` and root `package.json`
- [X] T002 [P] Document `BUSINESS_REGISTRY_PROVIDER`, timeout, and response-cap defaults in `.env.example` and `README.md`
- [X] T003 [P] Add Feature 014 version constants and safe configuration parsing in `web/src/backend/admin/verification/business-verification-config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, persistence, repository boundaries, and compatibility migration used by every story.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T004 Add normalizers and strict Candidate preparation/submission schemas in `web/src/shared/contracts/employer-verification/business-verification.ts`
- [X] T005 [P] Add response/error/admin projection types matching OpenAPI in `web/src/shared/contracts/employer-verification/business-verification-responses.ts`
- [X] T006 Add Feature 014 enums, preparation, snapshot, challenge, facts, and outbox relations in `web/prisma/schema.prisma`
- [X] T007 Create the additive migration and reuse the active-request partial unique index in `web/prisma/migrations/030_business_verification_enrichment/migration.sql`
- [X] T008 [P] Add legacy-duplicate and migration-shape verifier in `web/scripts/verify-business-verification-enrichment-migration.mjs`
- [X] T009 Regenerate Prisma client outputs in `web/src/backend/generated/prisma/`
- [X] T010 Define preparation repository ports and transactional inputs in `web/src/backend/admin/verification/employer-verification-preparation-repository.ts`
- [X] T011 Implement applicant-bound Prisma preparation/snapshot/challenge repository in `web/src/backend/repositories/admin/prisma-employer-verification-preparation-repository.ts`
- [X] T012 Extend safe route error mapping with field issues, challenge, rate-limit, and stale codes in `web/src/backend/admin/http/admin-route.ts`
- [X] T013 [P] Add OpenAPI/Zod parity tests in `web/tests/backend/contract/employer-verification/business-verification-openapi-parity.test.ts`
- [X] T014 Add schema and migration validation tests in `web/tests/backend/integration/employer-verification/business-verification-migration.test.ts`

**Checkpoint**: Additive schema, typed contracts, and repository boundaries are ready; legacy requests remain readable.

---

## Phase 3: User Story 1 - Confirm Registered Business Facts (Priority: P1)

**Goal**: A Candidate can enter a valid tax identifier first, continue only after an exact registry record is confirmed, and reset all bound progress before changing that identifier.

**Independent Test**: Exercise matched, partial, not-found, timeout, 429, malformed, oversized, disabled, invalid-tax-ID, changed-tax-ID, reset, refresh, and direct-command bypass cases; verify only matched/partial exact records unlock later steps and source facts remain non-decisive for recruiter approval.

### Tests for User Story 1

- [X] T015 [P] [US1] Add tax, plain-text, website, phone, multipart boolean, and mismatch normalizer tests in `web/tests/shared/unit/employer-verification/business-verification-normalization.test.ts`
- [X] T016 [P] [US1] Add gateway mapping, response-cap, and allowlist tests in `web/tests/backend/unit/employer-verification/vietqr-business-registry-adapter.test.ts`
- [X] T017 [P] [US1] Add lookup and preparation route contract tests in `web/tests/backend/contract/employer-verification/registry-lookup.contract.test.ts`
- [X] T018 [P] [US1] Add lookup ownership, rate-limit, snapshot immutability, failed-outcome blocking, and invalidation integration tests in `web/tests/backend/integration/employer-verification/registry-lookup.test.ts`
- [X] T019 [P] [US1] Add matched/not-found/unavailable/reset/refresh Candidate UI tests in `web/tests/frontend/components/employer-verification/business-registry-section.test.tsx`

### Implementation for User Story 1

- [X] T020 [P] [US1] Define provider-independent lookup gateway and outcomes in `web/src/backend/business-registry/business-registry-lookup-gateway.ts`
- [X] T021 [P] [US1] Implement bounded VietQR v2 adapter in `web/src/backend/business-registry/vietqr-business-registry-adapter.ts`
- [X] T022 [US1] Compose enabled/disabled registry providers in `web/src/backend/business-registry/business-registry-provider.ts`
- [X] T023 [US1] Implement lookup admission, 15-minute reuse, safe snapshot mapping, and tax-change invalidation in `web/src/backend/admin/verification/employer-verification-preparation-service.ts`
- [X] T024 [US1] Implement server-side normalized draft restore/update and optimistic versioning in `web/src/backend/admin/verification/employer-verification-preparation-service.ts`
- [X] T025 [US1] Add no-store GET/PATCH preparation Route Handler in `web/src/app/api/employer-verifications/preparation/route.ts`
- [X] T026 [US1] Add no-store POST registry lookup Route Handler in `web/src/app/api/employer-verifications/registry-lookups/route.ts`
- [X] T027 [US1] Add Candidate preparation API client and safe error translation in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T028 [US1] Build tax-first registry UI with strict progression gate in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T029 [US1] Integrate restored preparation and normalized on-blur autosave in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`

**Checkpoint**: Exact registry confirmation unlocks preparation, all failed outcomes remain blocking, and no automatic recruiter decision is created.

---

## Phase 4: User Story 2 - Prove a Reachable Company Contact (Priority: P1)

**Goal**: A Candidate can verify one company mailbox for the current lookup binding and provide normalized phone/website signals without false trust claims.

**Independent Test**: Exercise valid, malformed, resend, delivery retry, expired, replayed, wrong-account, changed-email, changed-tax-ID, free-provider, domain mismatch, phone, and website cases; at most one current binding becomes verified.

### Tests for User Story 2

- [X] T030 [P] [US2] Add token generation/digest, masking, free-email, and domain-signal tests in `web/tests/backend/unit/employer-verification/company-email-challenge.test.ts`
- [X] T031 [P] [US2] Add challenge issue/confirm Route Handler contract tests in `web/tests/backend/contract/employer-verification/company-email-challenge.contract.test.ts`
- [X] T032 [P] [US2] Add challenge resend, replay, expiry, ownership, outbox, and concurrent-consume integration tests in `web/tests/backend/integration/employer-verification/company-email-challenge.test.ts`
- [X] T033 [P] [US2] Add company-email template rendering and fragment-link tests in `web/tests/backend/unit/email/company-email-verification-template.test.tsx`
- [X] T034 [P] [US2] Add contact field, fragment removal, toast, and verified-status UI tests in `web/tests/frontend/components/employer-verification/company-contact-section.test.tsx`

### Implementation for User Story 2

- [X] T035 [P] [US2] Add cryptographic token/digest, masking, and deterministic email signals in `web/src/backend/admin/verification/company-email-verification.ts`
- [X] T036 [P] [US2] Add `COMPANY_EMAIL_VERIFY` React Email template in `web/src/backend/email/templates/company-email-verification.tsx`
- [X] T037 [US2] Register challenge template and protected payload rendering in `web/src/backend/email/workers/email-outbox.ts`
- [X] T038 [US2] Implement transactional challenge issue, supersede, confirm, and rate limiting in `web/src/backend/admin/verification/employer-verification-preparation-service.ts`
- [X] T039 [US2] Add no-store challenge issue Route Handler in `web/src/app/api/employer-verifications/company-email/challenges/route.ts`
- [X] T040 [US2] Add no-store POST confirmation Route Handler in `web/src/app/api/employer-verifications/company-email/confirm/route.ts`
- [X] T041 [US2] Implement fragment extraction, immediate URL cleanup, and confirmation client flow in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T042 [US2] Build verified-email, unverified-phone, and safe-website UI section in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T043 [US2] Integrate stable accessible Sonner feedback for lookup/contact actions in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`

**Checkpoint**: Mailbox control can be proven for one current binding; phone remains explicitly unverified and malformed contacts never persist.

---

## Phase 5: User Story 3 - Declare Relationship and Submit Evidence (Priority: P1)

**Goal**: A Candidate can submit normalized authority context, consent, and existing protected evidence exactly once after valid lookup/email preparation.

**Independent Test**: Submit every relationship and conditional explanation combination with valid/invalid consent, stale bindings, existing-company prerequisites, duplicate clicks, concurrency, and storage/database failures; one authoritative request/evidence/receipt is created or none remains.

### Tests for User Story 3

- [X] T044 [P] [US3] Add conditional final-submission schema and field-issue tests in `web/tests/shared/unit/employer-verification/business-verification-submission.test.ts`
- [X] T045 [P] [US3] Add multipart final-submission contract and safe-error tests in `web/tests/backend/contract/employer-verification/enriched-submission.contract.test.ts`
- [X] T046 [P] [US3] Add atomic facts/request/evidence/receipt/challenge integration tests in `web/tests/backend/integration/employer-verification/enriched-submission.test.ts`
- [X] T047 [P] [US3] Add active-request concurrency, idempotency, prerequisite, and evidence-cleanup tests in `web/tests/backend/integration/employer-verification/enriched-submission-concurrency.test.ts`
- [X] T048 [P] [US3] Add relationship, consent, field focus, toast, file, and narrow-screen UI tests in `web/tests/frontend/components/employer-verification/employer-verification-submission.test.tsx`
- [X] T049 [P] [US3] Add Candidate form accessibility tests in `web/tests/frontend/accessibility/employer-verification/employer-verification.accessibility.test.tsx`

### Implementation for User Story 3

- [X] T050 [US3] Extend final multipart parsing with preparation, relationship, contact, explanation, consent, and idempotency fields in `web/src/app/api/employer-verifications/route.ts`
- [X] T051 [US3] Rework final submission validation and existing-company checks around current preparation binding in `web/src/backend/admin/verification/applicant-verification-service.ts`
- [X] T052 [US3] Implement atomic challenge consumption, snapshot acceptance, immutable facts, request, evidence, and receipt transaction in `web/src/backend/admin/verification/applicant-verification-service.ts`
- [X] T053 [US3] Preserve storage compensation and map duplicate/stale/prerequisite failures safely in `web/src/backend/admin/verification/applicant-verification-service.ts`
- [X] T054 [US3] Build applicant relationship, title, explanations, and declarations UI in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T055 [US3] Build evidence upload and first-invalid-field behavior in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T056 [US3] Integrate the four-section responsive form and idempotent submit control in `web/src/frontend/features/employer-verification/employer-verification-page.tsx`
- [X] T057 [US3] Add safe enrichment summary/legacy marker to applicant request list in `web/src/backend/admin/verification/applicant-verification-service.ts`

**Checkpoint**: The complete Candidate request path is independently usable and retains Feature 006 lifecycle/evidence behavior.

---

## Phase 6: User Story 4 - Review Enriched Verification Context (Priority: P1)

**Goal**: An authorized administrator can compare immutable source and applicant facts while all existing human decision gates remain unchanged.

**Independent Test**: Open matched, partial, legacy-unconfirmed, unavailable-source, mismatch, free-email, domain-mismatch, stale-snapshot, and existing-company requests; verify bounded display and that approve/reject still re-evaluate Feature 006 prerequisites and evidence.

### Tests for User Story 4

- [X] T058 [P] [US4] Add enriched admin repository projection and privacy tests in `web/tests/backend/integration/admin-management/verification-enriched-detail.test.ts`
- [X] T059 [P] [US4] Add enriched admin detail contract tests in `web/tests/backend/contract/admin-management/verification-enriched-detail.contract.test.ts`
- [X] T060 [P] [US4] Add matched/legacy-unconfirmed comparison panel UI tests in `web/tests/frontend/components/admin-management/verification-enriched-detail.test.tsx`
- [X] T061 [P] [US4] Add administrator detail accessibility tests in `web/tests/frontend/accessibility/admin-management/verification-enriched-detail.accessibility.test.tsx`
- [X] T062 [P] [US4] Add approval regression tests proving all Feature 006 gates remain authoritative in `web/tests/backend/integration/admin-management/verification-enriched-approval.test.ts`

### Implementation for User Story 4

- [X] T063 [US4] Extend bounded verification detail projection with facts/snapshot/legacy signals in `web/src/backend/repositories/admin/prisma-verification-repository.ts`
- [X] T064 [US4] Extend shared administrator verification response types in `web/src/shared/contracts/admin/verification.ts`
- [X] T065 [US4] Re-evaluate enriched completeness without auto-decisions in `web/src/backend/repositories/admin/prisma-verification-repository.ts`
- [X] T066 [US4] Render source age, side-by-side differences, contact signals, relationship, and consent in `web/src/frontend/features/admin/verification/verification-business-facts-panel.tsx`
- [X] T067 [US4] Add non-color labels for unavailable/stale/legacy/unverified facts in `web/src/frontend/features/admin/verification/verification-business-facts-panel.tsx`

**Checkpoint**: Administrators receive the complete enriched context while decision authority and prerequisites remain unchanged.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Complete retention, privacy, architecture, performance, documentation, and release validation across all stories.

- [X] T068 Add preparation/snapshot/challenge expiry, scrub, and deletion work to `web/src/backend/admin/workers/verification-lifecycle-loop.ts`
- [X] T069 [P] Add retention deadline and retry integration tests in `web/tests/backend/integration/employer-verification/business-verification-retention.test.ts`
- [X] T070 [P] Add privacy and existing-notification regression tests for logs, URLs, storage, responses, notifications, and audit metadata in `web/tests/security/employer-verification/business-verification-privacy.test.ts`
- [X] T071 [P] Add provider/repository/session boundaries in `web/tests/architecture/business-verification-boundaries.test.ts`
- [X] T072 [P] Add lookup/challenge P95 measurement harness in `web/scripts/measure-business-verification-performance.mjs`
- [X] T073 [P] Add representative performance assertions and metadata checks in `web/tests/performance/employer-verification/business-verification-performance.test.ts`
- [X] T074 Synchronize implemented API/status details in `spec-kit/specs/006-admin-management/spec.md`, `spec-kit/specs/009-user-management-and-recruiter-verification/spec-group-2-business-verification-approval.md`, and `spec-kit/specs/014-business-verification-enrichment/quickstart.md`
- [X] T075 Run migration verifier, Prisma validation/generation, focused Feature 014 tests, typecheck, lint, build, and fail-closed disabled-provider quickstart from `spec-kit/specs/014-business-verification-enrichment/quickstart.md`
- [X] T076 Review generated diffs for secrets, raw provider/token data, unrelated changes, and local-only commit status from repository root `.`
- [X] T077 [US4] Add an administrator review checklist and current evidence metadata to the verification detail UI
- [X] T078 [US4] Add sensitive-authorized full-document inline viewing while preserving protected preview and download behavior
- [X] T079 [US1] Require matched/partial exact registry confirmation in draft, email, evidence, and final submission service gates
- [X] T080 [US1] Lock confirmed tax identifiers and add transactional preparation reset before identifier changes

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks every story.
- **US1 (Phase 3)**: Depends on Foundational; establishes preparation and lookup used by US2/US3.
- **US2 (Phase 4)**: Depends on Foundational and current snapshot ownership from US1.
- **US3 (Phase 5)**: Depends on US1 and US2 because final acceptance requires both bindings.
- **US4 (Phase 6)**: Depends on immutable accepted facts from US3; tests may start against fixtures after Foundational.
- **Polish (Phase 7)**: Depends on all four stories.

### User Story Dependencies

```text
Foundational -> US1 -> US2 -> US3 -> US4 -> Polish
                  \-----------> US3
```

- US1 independently demonstrates exact-record progression blocking without accepting recruiter authority.
- US2 independently demonstrates company-contact proof against a prepared lookup.
- US3 joins the previous preparation capabilities into the authoritative Feature 006 request.
- US4 consumes accepted immutable facts and never changes Candidate preparation.

### Within Each Story

- Write focused tests and confirm the intended missing behavior before implementation.
- Implement pure contracts/gateways before services.
- Implement services/repositories before Route Handlers.
- Implement API clients before UI integration.
- Complete the story checkpoint before advancing.

## Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005, T008, and T013 can run in parallel while schema/repository work proceeds.
- US1 test tasks T015-T019 can run in parallel; provider gateway T020 and adapter T021 can run in parallel.
- US2 tests T030-T034 and utility/template work T035-T036 can run in parallel.
- US3 tests T044-T049 can run in parallel; UI sections T054-T055 can run in parallel after contracts stabilize.
- US4 tests T058-T062 can run in parallel; admin type/UI work can proceed after T063 projection shape is fixed.
- Retention, security, architecture, performance, and documentation tasks T069-T074 can run in parallel after implementation stabilizes.

## Parallel Examples

### User Story 1

```text
T015 normalization tests
T016 provider adapter tests
T017 route contract tests
T018 persistence/ownership tests
T019 Candidate UI tests
```

### User Story 2

```text
T030 token/signal tests
T031 route contract tests
T032 challenge concurrency tests
T033 email rendering tests
T034 contact UI tests
```

### User Story 3

```text
T044 submission schema tests
T045 multipart contract tests
T046 transaction tests
T047 concurrency/cleanup tests
T048 form tests
T049 accessibility tests
```

### User Story 4

```text
T058 repository privacy tests
T059 admin contract tests
T060 comparison UI tests
T061 accessibility tests
T062 approval regression tests
```

## Implementation Strategy

### Technical Checkpoint First

1. Complete Setup and Foundational.
2. Complete US1 and verify exact-record progression, failed-outcome blocking, and reset in isolation.
3. Complete US2 and verify company-email binding in isolation.
4. Complete US3 and verify authoritative atomic submission.
5. Complete US4 and verify human-only administration.
6. Complete retention/privacy/performance/release gates.

### Release Scope

All four P1 stories plus Phase 7 are required for the Feature 014 release. US1 alone is a technical checkpoint, not a constitution-complete releasable workflow.

### Commit Strategy

- Commit after each Spec Kit phase as requested.
- During implementation, commit each completed implementation phase or coherent task group with tests.
- Never stage `.claude/settings.local.json`, secrets, generated runtime data, or unrelated user changes.
- Keep every commit local; do not push.

## Notes

- `[P]` means file-level parallel work with no incomplete dependency.
- Each route/service task must preserve Candidate-origin and active-session enforcement.
- Every external provider test uses mocks; live VietQR availability is never a CI prerequisite.
- Existing Feature 006 evidence and decision behavior remains authoritative throughout.
