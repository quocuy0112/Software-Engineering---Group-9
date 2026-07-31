---
description: "Dependency-ordered implementation tasks for candidate profile and account management"
---

# Tasks: Candidate Profile and Account Management

**Input**: Design documents from `spec-kit/specs/002-candidate-profile-account-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `contracts/internal-contracts.md`, and `quickstart.md`

**Tests**: Required. VR-001 through VR-006 explicitly require automated authorization, validation, security, persistence, concurrency, accessibility, and end-to-end verification. In each user-story phase, create the listed tests first and confirm that they fail for the intended missing behavior before implementing the story.

**Organization**: Tasks are grouped into shared setup/foundation work followed by one independently testable phase per user story. Every task includes an exact repository path.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no unmet dependency on another task in the same parallel group.
- **[Story]**: Maps the task to US1, US2, US3, or US4.
- Setup, foundational, and cross-cutting tasks intentionally have no story label.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the one new dependency, expose the approved server-only environment setting, and prepare reproducible Feature 002 test evidence.

- [X] T001 Pin `sanitize-html` 2.17.6 and `@types/sanitize-html` 2.16.1, add a focused `test:profile-account` script, and refresh the sole lockfile in `web/package.json` and `package-lock.json`
- [X] T002 [P] Add documented non-public `AUDIT_TRUSTED_PROXY_HOPS` defaults and validation inputs in `.env.example`, `web/.env.example`, `scripts/setup-local.mjs`, and `scripts/check-environment.mjs`
- [X] T003 [P] Add executable dependency/version/server-only compatibility coverage for the sanitizer in `web/tests/backend/compatibility/sanitize-html-2.17.6.test.ts`
- [X] T004 [P] Create deterministic two-account, multi-session, controlled-clock, and mail-capture fixture builders in `web/tests/helpers/profile-account-fixture.ts`
- [X] T005 Run the blocking sanitizer dependency gate after T001/T003: verify exact root-lockfile resolution, execute the malformed-XSS corpus and server-only import test, run TypeScript typecheck and the production build, run `npm audit --json`, reject every unreviewed critical/high finding, and record reproducible evidence in `spec-kit/specs/002-candidate-profile-account-management/checklists/sanitizer-dependency-gate.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the persistence, concurrency, security, audit, email, session, and shared navigation boundaries required by every story.

**Critical**: No user-story implementation starts until this phase passes. Foundational tests T006-T010 are written first and must fail for the missing Feature 002 behavior.

### Foundational Tests

- [X] T006 [P] Write failing PostgreSQL tests for profile backfill, one-to-one ownership, ordering/uniqueness constraints, immutable security mail, pending-email partial uniques, and rollback in `web/tests/backend/integration/db/profile-account-constraints.test.ts`
- [X] T007 [P] Write failing unit tests for NFKC plain-text sanitization, XSS removal, recipient encryption, trusted-proxy parsing, IPv4 `/24` and IPv6 `/56` protection, and controlled time in `web/tests/backend/unit/security/profile-account-security-primitives.test.ts`
- [X] T008 [P] Write failing concurrent registration/email-claim tests proving one normalized email cannot become both effective and pending and registration creates exactly one empty profile in `web/tests/backend/integration/identity/email-address-claim-coordination.test.ts`
- [X] T009 [P] Write failing audit/outbox tests for allowlisted Feature 002 events, protected recipient snapshots, exactly-once intent creation, just-in-time decryption, and secret/raw-network redaction in `web/tests/backend/integration/audit/profile-account-audit-outbox.test.ts`
- [X] T010 [P] Write failing architecture tests forbidding direct Prisma in account routes/client code, client sanitizer/crypto imports, internal HTTP from Server Components, uncoordinated email claims, and a second browser-session mechanism in `web/tests/architecture/profile-account-boundaries.test.ts`

### Foundational Implementation

- [X] T011 Add the ten Feature 002 models, enums, relationships, mapped names, defaults, and existing model extensions to `web/prisma/schema.prisma`
- [X] T012 Implement the reviewed forward migration with profile backfill/count guard, FKs, checks, ordering uniques, normalized-skill unique, pending-email partial uniques, recipient columns, and safe rollback comments in `web/prisma/migrations/007_candidate_profile_account_management/migration.sql`
- [X] T013 Regenerate and review the Prisma client without renaming or duplicating Better Auth-owned fields, anchored at `web/src/backend/generated/prisma/client.ts`
- [X] T014 [P] Implement injectable UTC system and controlled clock contracts in `web/src/backend/time/clock.ts`
- [X] T015 [P] Implement the server-only `PlainTextNormalizer` with field policies, NFKC normalization, safe whitespace handling, empty-to-null warnings, and no HTML output in `web/src/backend/security/plain-text/plain-text-normalizer.ts`
- [X] T016 [P] Implement purpose/version-separated AES-256-GCM protected outbox recipient sealing and unsealing in `web/src/backend/security/protected-recipient/protected-outbox-recipient.ts`
- [X] T017 Parse and fail closed on production trusted-proxy-hop configuration without echoing network evidence in `web/src/backend/env/server.ts`
- [X] T018 Implement trusted-hop address selection, validation, prefix reduction, and purpose-separated HMAC output in `web/src/backend/security/network-source/network-source-protector.ts`
- [X] T019 Implement the transaction-scoped normalized-email advisory-lock and cross-table availability coordinator in `web/src/backend/repositories/account/email-address-claim-coordinator.ts`
- [X] T020 Route registration email acceptance through the common claim coordinator and create one CandidateProfile in the registration transaction in `web/src/backend/repositories/identity/prisma-registration-repository.ts`
- [X] T021 Preserve generic registration outcomes while supplying the coordinated transaction and profile creation inputs in `web/src/backend/services/identity/register-account.ts`
- [X] T022 [P] Define strict reusable account error, field-error, idempotency-key, correlation, and retry metadata schemas in `web/src/shared/contracts/account/common.ts`
- [X] T023 Implement bounded JSON parsing, session-derived authorization, exact-origin/Fetch-Metadata/CSRF checks, ACTIVE-state recheck, safe error mapping, and no-store response helpers in `web/src/backend/security/account-request-boundary.ts`
- [X] T024 Extend the durable audit event allowlist with all specified email-change and password-change outcomes in `web/src/backend/audit/events.ts`
- [X] T025 Extend the audit repository to accept only allowlisted minimal context plus the protected network digest and never raw request/provider data in `web/src/backend/repositories/audit/prisma-audit-repository.ts`
- [X] T026 Extend outbox persistence for purpose-bound protected recipient snapshots and stable idempotency keys in `web/src/backend/repositories/email/outbox-repository.ts`
- [X] T027 Unseal `recipientCiphertext` only at the final adapter-delivery boundary, prefer the protected snapshot over the legacy UserAccount relation when present, keep plaintext out of logs/audit/retry state, and preserve allowlisted retry/dead-letter behavior in `web/src/backend/email/workers/due-outbox-processor.ts` and `web/src/backend/email/workers/email-outbox.ts`
- [X] T028 Add `/verify-email-change` to the page-level no-store route pattern while preserving CSP and `Referrer-Policy: no-referrer` in `web/next.config.ts`, and add a response-header test proving that page returns `Cache-Control: no-store` in `web/tests/backend/unit/security/verify-email-change-response-headers.test.ts`
- [X] T029 Refine ProfileNavigation to render only the implemented Professional, Security, and Sessions destinations at foundation time, preserve accessible active/mobile behavior, provide a deterministic extension point for later story links, and never emit an `href` to an absent route in `web/src/frontend/features/profile/components/profile-navigation.tsx`
- [X] T030 Run schema validation/generation, migration, registration race, security primitive, audit/outbox, page-header, and architecture tests after the already-passed T005 dependency gate and record commands/results in `spec-kit/specs/002-candidate-profile-account-management/checklists/foundation-results.md`

**Checkpoint**: The Feature 002 schema is safely migratable, registration and pending email share one claim namespace, common security boundaries pass, and all four story phases may begin independently.

---

## Phase 3: User Story 1 - Maintain a Professional Profile (Priority: P1) - MVP

**Goal**: Let an authenticated candidate view a valid empty profile and explicitly save owned basics, skills, experience, education, and social-link sections as one revisioned aggregate.

**Independent Test**: Sign in as a candidate with an empty profile, add and reorder valid data in every section, reload it unchanged, submit a stale valid section and see `conflictApplied`, then verify another account cannot read or mutate the aggregate or any child row.

### Tests for User Story 1

- [X] T031 [P] [US1] Write failing OpenAPI/Zod contract tests for GET/PATCH profile and authenticated catalog-only skill suggestions, including strict bodies, caps, no ownership IDs, no-store headers specifically on Profile GET/PATCH, and `conflictApplied` in `web/tests/backend/contract/candidate-profile.contract.test.ts`
- [X] T032 [P] [US1] Write failing unit tests for field/list limits, Unicode code-point lengths, the exact FR-017 phone grammar with every documented accepted/rejected example plus 6/7/15/16-digit boundaries, date/current rules, URL credentials/schemes/canonical duplicates, and skill normalization in `web/tests/backend/unit/profile/profile-validation.test.ts`
- [X] T033 [P] [US1] Write failing unit tests for XSS/script/style/control-character removal, Vietnamese diacritic preservation, optional-empty warnings, and required-after-sanitize errors in `web/tests/backend/unit/profile/profile-plain-text.test.ts`
- [X] T034 [P] [US1] Write failing integration tests for the canonical empty aggregate, same-account reads, forged owner identifiers, inactive sessions, and indistinguishable foreign/nonexistent child failures in `web/tests/backend/integration/profile/profile-authorization.test.ts`
- [X] T035 [P] [US1] Write failing integration tests for section-scoped create/update/delete/reorder, one revision increment, full-section rollback, ownership checks, caps, and unchanged unselected sections in `web/tests/backend/integration/profile/profile-section-save.test.ts`
- [X] T036 [P] [US1] Write failing concurrency tests for valid stale last-write-wins, visible conflict results, concurrent normalized skill upserts, and stable catalog associations in `web/tests/backend/integration/profile/profile-concurrency.test.ts`
- [X] T037 [P] [US1] Write failing component tests for loading/error/empty states, basics saving, retained failed values, explicit Save, persistent status, ARIA-live toast, and focus-on-error in `web/tests/frontend/components/profile-account/professional-profile-basics.test.tsx`
- [X] T038 [P] [US1] Write failing keyboard/mobile/accessibility tests for add/remove/reorder controls, labels, non-color state, reduced motion, and 320px overflow across all profile collections in `web/tests/frontend/accessibility/professional-profile.accessibility.test.tsx`
- [X] T039 [US1] Write the failing serial Playwright journey for empty profile through all saved sections, reload, stale-save warning, XSS non-execution, and cross-account denial in `web/tests/system/e2e/profile-account/professional-profile.spec.ts`

### Implementation for User Story 1

- [X] T040 [P] [US1] Implement strict profile aggregate, discriminated section patch, response, normalization-warning, and skill-suggestion Zod contracts in `web/src/shared/contracts/account/profile.ts`
- [X] T041 [P] [US1] Implement the exact FR-017 profile-phone presentation grammar and total 7-15 ASCII-digit constraint plus ISO-date, experience, education, social-URL, skill-key, collection-cap, and owned-ID validation in `web/src/backend/services/profile/profile-validation.ts`
- [X] T042 [P] [US1] Implement owned complete-aggregate reads and canonical empty-state mapping in `web/src/backend/repositories/profile/prisma-profile-query-repository.ts`
- [X] T043 [US1] Implement row-locked transactional section replacement, owned-child checks, reorder/delete behavior, one revision increment, and stale-revision result in `web/src/backend/repositories/profile/prisma-profile-command-repository.ts`
- [X] T044 [P] [US1] Implement normalized skill catalog upsert race recovery and capped authenticated suggestions without usage/owner leakage in `web/src/backend/repositories/profile/prisma-skill-catalog-repository.ts`
- [X] T045 [US1] Implement complete aggregate loading, empty-state derivation, and response mapping in `web/src/backend/services/profile/get-profile-aggregate.ts`
- [X] T046 [US1] Implement normalize-then-validate section saves, safe warnings, ownership-safe errors, last-write-wins, and complete post-commit responses in `web/src/backend/services/profile/save-profile-section.ts`
- [X] T047 [US1] Implement thin protected GET/PATCH translation with strict parsing, body caps, CSRF/origin enforcement, and no-store responses in `web/src/app/api/account/profile/route.ts`
- [X] T048 [US1] Implement authenticated normalized/capped catalog lookup in `web/src/backend/services/profile/suggest-profile-skills.ts`
- [X] T049 [US1] Implement the authenticated catalog-only skill-suggestion GET handler without account/profile usage data in `web/src/app/api/account/profile/skills/suggestions/route.ts`
- [X] T050 [US1] Implement section-local React Hook Form state, server revision reconciliation, failed-value retention, safe duplicate-submit prevention, and refetch-after-save in `web/src/frontend/features/profile/client/use-profile-editor.ts`
- [X] T051 [P] [US1] Implement labelled headline, summary, phone, and location fields with explicit section save in `web/src/frontend/features/profile/components/profile-basics-form.tsx`
- [X] T052 [P] [US1] Implement keyboard-operable normalized skill add/remove/reorder and suggestion UI with a 50-skill cap in `web/src/frontend/features/profile/components/profile-skills-form.tsx`
- [X] T053 [P] [US1] Implement stable-ID experience add/edit/remove/reorder, current-role dates, and a 50-entry cap in `web/src/frontend/features/profile/components/profile-experience-form.tsx`
- [X] T054 [P] [US1] Implement stable-ID education add/edit/remove/reorder, expected-completion dates, and a 50-entry cap in `web/src/frontend/features/profile/components/profile-education-form.tsx`
- [X] T055 [P] [US1] Implement safe social-link add/edit/remove/reorder, scheme guidance, and a 10-link cap in `web/src/frontend/features/profile/components/profile-social-links-form.tsx`
- [X] T056 [US1] Implement persistent success/error/normalization/stale-write summaries plus ARIA-live Sonner announcements in `web/src/frontend/features/profile/components/profile-save-feedback.tsx`
- [X] T057 [US1] Compose the empty, loading, error, read, and five editable section states without a completeness gate in `web/src/frontend/features/profile/components/profile-overview.tsx`
- [X] T058 [US1] Load the aggregate directly through the service in the protected Server Component and render the professional profile view in `web/src/app/(workspace)/profile/page.tsx`
- [X] T059 [P] [US1] Add responsive 320px-safe profile section, ordered-list, focus, warning, and reduced-motion styles in `web/src/frontend/features/profile/styles/professional-profile.css`
- [X] T060 [US1] Run all US1 unit, contract, PostgreSQL integration, component/accessibility, and Playwright tests and record the independent-test result in `spec-kit/specs/002-candidate-profile-account-management/checklists/us1-professional-profile-results.md`

**Checkpoint**: US1 is independently deployable as the MVP and does not require US2, US3, or US4.

---

## Phase 4: User Story 2 - Maintain Account Identity and Change Email (Priority: P1)

**Goal**: Let an authenticated user update a sanitized full name and safely move login identity to a newly verified email while notifying both the proposed and old recipients.

**Independent Test**: Update the full name, request a new email after recent authentication, prove the old email remains effective before verification, consume the newest 30-minute proof once, then prove only the new email logs in and another account cannot redirect or inspect the change.

### Tests for User Story 2

- [X] T061 [P] [US2] Write failing OpenAPI/Zod contract tests for GET/PATCH identity and email-change request/verify, including headers, strict schemas, safe errors, no proof leakage, and no-store responses in `web/tests/backend/contract/account-identity-email-change.contract.test.ts`
- [X] T062 [P] [US2] Write failing unit tests for full-name NFKC/sanitization/length, email display/comparison normalization, idempotency binding, proof expiry/digest, and response redaction in `web/tests/backend/unit/account/identity-email-change-validation.test.ts`
- [X] T063 [P] [US2] Write failing identity integration tests for owner-only read/update, ACTIVE-state recheck, immutable metadata/email, stored XSS non-execution, and transaction rollback in `web/tests/backend/integration/account/account-identity.test.ts`
- [X] T064 [P] [US2] Write failing request-flow integration tests for recent authentication, same-key replay, changed-binding rejection, supersession, two recipient snapshots, two outbox intents, accepted/rejected audit, and provider failure isolation in `web/tests/backend/integration/account/email-change-request.test.ts`
- [X] T065 [P] [US2] Write failing concurrency tests for request-vs-registration, request-vs-request, and verification-vs-registration claims over normalized equivalent emails in `web/tests/backend/integration/account/email-change-concurrency.test.ts`
- [X] T066 [P] [US2] Write failing verification tests for latest valid proof, 30-minute expiry edges, superseded/used/malformed/conflicted proof, wrong signed-in account, single use, atomic identity update, and audit redaction in `web/tests/backend/integration/account/email-change-verification.test.ts`
- [X] T067 [P] [US2] Write failing email-worker tests proving verification targets the proposed protected snapshot, the alert targets the old protected snapshot, only the new-address verification message contains the fragment proof link, the old-address alert contains no proof/token/full verification URL, retry is idempotent, protected recipient ciphertext and sealed proof payload remain confined to the durable outbox, and no plaintext recipient, raw proof, or full verification URL enters logs, audit, or retry metadata in `web/tests/backend/integration/email/email-change-delivery.test.ts`
- [X] T068 [P] [US2] Write failing component/accessibility tests for identity save, safe pending status, email request feedback, verification action, invalid/expired/superseded proof explanations, a focusable “request a new verification email” action returning to `/profile/account`, keyboard/focus behavior, ARIA live messages, and 320px layout in `web/tests/frontend/accessibility/account-identity-email-change.accessibility.test.tsx`
- [X] T069 [US2] Write the failing serial Playwright journey for name update plus stored identity payloads such as `<img src=x onerror=...>` and `"><script>...</script>`, asserting they render only as inert text and no script/event marker executes; then cover old-login-before-proof, captured new/old mail, successful verification, new-login-after-proof, old-login rejection, reuse failure, invalid/expired/superseded proof states reaching the `/profile/account` fresh-request action, and cross-account safety in `web/tests/system/e2e/profile-account/account-identity-email-change.spec.ts`

### Implementation for User Story 2

- [X] T070 [P] [US2] Implement strict account identity read/update contracts with read-only effective email/status/created metadata and a nullable `pendingEmailChange` projection containing only `proposedEmail` and `expiresAt`, never proof/digest/outbox/session/correlation fields, in `web/src/shared/contracts/account/identity.ts`
- [X] T071 [P] [US2] Implement strict request/verify, queued-result, pending-state, idempotency, retry, and safe-error contracts with no ownership identifiers in `web/src/shared/contracts/account/email-change.ts`
- [X] T072 [P] [US2] Implement owner-scoped identity reads, latest active pending-email lookup, a safe `proposedEmail`/`expiresAt` projection excluding every secret/internal field, and transactional sanitized-name updates in `web/src/backend/repositories/account/prisma-account-identity-repository.ts`
- [X] T073 [US2] Implement identity authorization, normalization, immutable-field policy, audit-safe identity plus pending-email response mapping, and update behavior in `web/src/backend/services/account/account-identity-service.ts`
- [X] T074 [US2] Implement thin protected GET/PATCH identity handling with strict body caps, CSRF/origin checks, and no-store responses in `web/src/app/api/account/identity/route.ts`
- [X] T075 [P] [US2] Implement purpose-separated random email-change proof generation, HMAC digesting, sealed outbox payloads, 30-minute expiry, and fragment-link construction in `web/src/backend/security/email-change-proof.ts`
- [X] T076 [US2] Implement row/advisory-locked email-change request creation, idempotent replay, supersession, availability recheck, proof consumption, identity update, outbox, and audit transactions in `web/src/backend/repositories/account/prisma-email-change-repository.ts`
- [X] T077 [US2] Implement recent-auth/current-password gating, normalization, proof creation, correlation, protected recipients, safe rejection audit, and accepted queued result in `web/src/backend/services/account/request-email-change.ts`
- [X] T078 [US2] Implement proof-bound target lookup, same-origin consumption, latest/expiry/uniqueness checks, safe failures, and atomic verified-email transition in `web/src/backend/services/account/verify-email-change.ts`
- [X] T079 [US2] Implement the protected idempotent email-change request POST handler with network-source protection and no-store response in `web/src/app/api/account/email-change/request/route.ts`
- [X] T080 [US2] Implement the public same-origin/Fetch-Metadata email-change verification POST handler without accepting an owner identifier in `web/src/app/api/account/email-change/verify/route.ts`
- [X] T081 [P] [US2] Implement an accessible new-address verification React Email template whose proof appears only in a URL fragment, and an accessible old-address security-alert template containing no proof, token, or full verification URL, with no sensitive logging in `web/src/backend/email/templates/email-change-verification.tsx` and `web/src/backend/email/templates/email-change-alert.tsx`
- [X] T082 [US2] Map email-change outbox intents to their purpose-bound templates and protected payloads in `web/src/backend/email/workers/email-outbox.ts`
- [X] T083 [P] [US2] Implement identity and email-change request client state with in-memory form retention, idempotency reuse, and pending refresh in `web/src/frontend/features/profile/client/use-account-identity.ts`
- [X] T084 [P] [US2] Implement the labelled full-name form and immutable account metadata display with explicit save/status feedback in `web/src/frontend/features/profile/components/account-identity-form.tsx`
- [X] T085 [P] [US2] Implement proposed-email/current-password input, pending/superseded state, generic delivery wording, retry guidance, and duplicate-submit protection in `web/src/frontend/features/profile/components/email-change-form.tsx`
- [X] T086 [US2] Compose identity and email-change states with direct service data in `web/src/frontend/features/profile/components/profile-account-view.tsx`
- [X] T087 [P] [US2] Implement the client-only URL-fragment reader that removes the proof immediately and posts only after explicit confirmation; invalid, expired, superseded, used, or conflicted outcomes must show a safe focusable explanation and a “request a new verification email” action to `/profile/account` without echoing the proof in `web/src/frontend/features/profile/components/verify-email-change-form.tsx`
- [X] T088 [US2] Implement the public no-store verification page without server access to the URL fragment in `web/src/app/(auth)/verify-email-change/page.tsx`
- [X] T089 [US2] Load the safe account identity/pending projection directly through services in the protected Server Component in `web/src/app/(workspace)/profile/account/page.tsx`, and atomically add the now-valid Account destination in `web/src/frontend/features/profile/components/profile-navigation.tsx`
- [X] T090 [US2] Run all US2 unit, contract, PostgreSQL integration, email-worker, component/accessibility, and Playwright tests and record the independent-test result in `spec-kit/specs/002-candidate-profile-account-management/checklists/us2-account-email-results.md`

**Checkpoint**: US2 is independently functional after the foundation and does not require the professional-profile, password-change, or preferences UI.

---

## Phase 5: User Story 3 - Change Password Securely (Priority: P1)

**Goal**: Change a password only after current-password verification, retain the initiating session, revoke every other usable session, and durably finalize exactly one mail/audit outcome through a resumable operation.

**Independent Test**: With two sessions, change to a valid different password; verify the initiating session remains usable, the other session is unusable within two seconds, the old password fails, the new password succeeds, and exactly one protected confirmation mail plus final audit exists.

### Tests for User Story 3

- [X] T091 [P] [US3] Write failing contract tests for password-change headers/body/result, strict unknown rejection, retry metadata, generic failures, and no secret/session identifier responses in `web/tests/backend/contract/password-change.contract.test.ts`
- [X] T092 [P] [US3] Write failing policy tests for 12/128 Unicode code-point boundaries, spaces/no composition rule, confirmation mismatch, common/compromised rejection, current reuse, and absence of password-history storage in `web/tests/backend/unit/account/password-change-policy.test.ts`
- [X] T093 [P] [US3] Write failing controlled-clock tests for pruning, only-wrong-current counting, concurrent fifth failure, 15-minute lock, retry seconds, lock expiry, and success clearing in `web/tests/backend/unit/account/password-change-attempt-policy.test.ts`
- [X] T094 [P] [US3] Write failing Better Auth 1.6.25 compatibility tests for classify, Unicode-safe internal update, ambiguous-write convergence, cookie-derived initiating-session match, and native other-session revocation in `web/tests/backend/compatibility/better-auth-password-change.test.ts`
- [X] T095 [P] [US3] Write failing PostgreSQL integration tests for serialized failure windows, policy/reuse errors not counting, fifth-failure audit, later operation resume despite unrelated lock, and successful clearing in `web/tests/backend/integration/account/password-change-attempt-window.test.ts`
- [X] T096 [P] [US3] Write failing failure-injection tests for intent, password-written, revocation, verification, outbox/audit finalization milestones, changed idempotency binding, wrong initiating session, ambiguous writes, and retryable `503` in `web/tests/backend/integration/account/password-change-operation.test.ts`
- [X] T097 [P] [US3] Write failing integration tests for initiating-session continuity, zero other usable sessions, old/new credential behavior, exactly-one recipient snapshot/outbox/audit, and secret/raw-error redaction in `web/tests/backend/integration/account/password-change-security-effects.test.ts`
- [X] T098 [P] [US3] Write failing component/accessibility tests for current/new/confirmation fields, autocomplete, show/hide, paste, policy errors, locked/retry states, retained values, focus summary, ARIA live feedback, and 320px layout in `web/tests/frontend/accessibility/password-change.accessibility.test.tsx`
- [X] T099 [US3] Write the failing serial two-session Playwright journey for failures one through five, lock expiry, valid change, current-session continuity, other-session rejection, old/new login, mail, and accessible feedback in `web/tests/system/e2e/profile-account/password-change.spec.ts`

### Implementation for User Story 3

- [X] T100 [P] [US3] Implement strict password-change request/result/retry schemas and idempotency header parsing without client session identifiers in `web/src/shared/contracts/account/password-change.ts`
- [X] T101 [US3] Extend the authoritative policy with Unicode code-point length, confirmation, common/compromised, and current-password-difference checks without composition/history rules in `web/src/backend/auth/policy/password-policy.ts`
- [X] T102 [P] [US3] Implement row-locked rolling failure timestamps, fifth-failure lock, safe retry metadata, and transactional clearing in `web/src/backend/repositories/account/prisma-password-change-attempt-repository.ts`
- [X] T103 [P] [US3] Implement durable idempotent operation creation/loading, submission binding, milestone transitions, other-session verification, exactly-once finalization, and retryable failures in `web/src/backend/repositories/account/prisma-password-change-operation-repository.ts`
- [X] T104 [US3] Implement Better Auth classify/reverify/hash/internal-update/effectiveness/revoke-other-sessions methods with cookie-derived session matching and allowlisted errors in `web/src/backend/auth/better-auth/better-auth-password-gateway.ts`
- [X] T105 [US3] Implement the resumable password operation orchestration, attempt policy, milestone convergence, session verification, protected confirmation recipient, final audit, and safe `503` behavior in `web/src/backend/services/account/change-password.ts`
- [X] T106 [US3] Implement the protected idempotent password-change POST handler with strict body cap, CSRF/origin checks, protected network evidence, and no-store response in `web/src/app/api/account/password/change/route.ts`
- [X] T107 [P] [US3] Implement in-memory password form state, idempotent safe retry, duplicate-submit guard, lock countdown, and post-success field clearing in `web/src/frontend/features/profile/client/use-password-change.ts`
- [X] T108 [US3] Implement the accessible current/new/confirmation password form with policy hints, autocomplete, show/hide, persistent summaries, and ARIA-live feedback in `web/src/frontend/features/profile/components/password-change-form.tsx`
- [X] T109 [US3] Add password change to the existing protected security composition without disrupting TOTP/recovery/session controls in `web/src/frontend/features/profile/components/profile-security-view.tsx` and `web/src/app/(workspace)/profile/security/page.tsx`
- [X] T110 [US3] Ensure the existing password-changed template communicates the completed security event without credential/session details in `web/src/backend/email/templates/password-changed.tsx`; protected recipient snapshot selection and just-in-time delivery remain owned by T027/T105
- [X] T111 [US3] Run all US3 unit, compatibility, contract, PostgreSQL failure-injection, component/accessibility, and two-session Playwright tests and record the independent-test result in `spec-kit/specs/002-candidate-profile-account-management/checklists/us3-password-change-results.md`

**Checkpoint**: US3 is independently functional after the foundation, with no success response possible while another usable session remains.

---

## Phase 6: User Story 4 - Use Consistent Account Preferences (Priority: P2)

**Goal**: Return exact virtual defaults when no row exists and atomically persist language, timezone, and notification preferences while keeping account-security email mandatory.

**Independent Test**: Read a never-saved account and receive `vi`, `Asia/Ho_Chi_Minh`, and all notifications enabled; save another valid set, observe it unchanged in another session/device, and prove `account_security=false` is rejected by both service and database.

### Tests for User Story 4

- [X] T112 [P] [US4] Write failing OpenAPI/Zod contract tests for GET/PUT preferences, virtual defaults, complete replacement, strict unknown/category/type rejection, timezone support metadata, and immutable account security in `web/tests/backend/contract/account-preferences.contract.test.ts`
- [X] T113 [P] [US4] Write failing unit tests for `vi`/`en`, IANA timezone acceptance, unsupported stored-zone preservation, newly invalid zone rejection, defaults, and complete-set validation in `web/tests/backend/unit/account/account-preferences-validation.test.ts`
- [X] T114 [P] [US4] Write failing PostgreSQL integration tests for no-write default reads, owner-only access, atomic persistence across sessions, rollback, account-security CHECK enforcement, and legacy timezone preservation in `web/tests/backend/integration/account/account-preferences.test.ts`
- [X] T115 [P] [US4] Write failing component/accessibility tests for defaults, language/timezone controls, three labelled notifications, disabled mandatory security control, persistent feedback, keyboard/focus, ARIA live, and 320px layout in `web/tests/frontend/accessibility/account-preferences.accessibility.test.tsx`
- [X] T116 [US4] Write the failing serial Playwright journey for default read, valid update, cross-session persistence, invalid timezone, mandatory security mail, and cross-account denial in `web/tests/system/e2e/profile-account/account-preferences.spec.ts`

### Implementation for User Story 4

- [X] T117 [P] [US4] Implement strict full preference-set schemas, exact defaults, notification keys, timezone support metadata, and immutable account-security response types in `web/src/shared/contracts/account/preferences.ts`
- [X] T118 [P] [US4] Implement owner-scoped optional-row reads, complete atomic upsert, and database-invariant error mapping in `web/src/backend/repositories/account/prisma-account-preferences-repository.ts`
- [X] T119 [US4] Implement virtual defaults, `Intl.DateTimeFormat` validation, stored unsupported-zone preservation, mandatory security-mail policy, and safe response mapping in `web/src/backend/services/account/account-preferences-service.ts`
- [X] T120 [US4] Implement thin protected GET/PUT preference handling with strict complete bodies, CSRF/origin checks, ACTIVE-state recheck, and no-store responses in `web/src/app/api/account/preferences/route.ts`
- [X] T121 [P] [US4] Implement in-memory full-set preference editing, duplicate-submit prevention, retained failures, and authoritative post-save reconciliation in `web/src/frontend/features/profile/client/use-account-preferences.ts`
- [X] T122 [P] [US4] Implement labelled language and timezone controls with unsupported-stored-zone guidance in `web/src/frontend/features/profile/components/account-preferences-form.tsx`
- [X] T123 [P] [US4] Implement the three notification controls with `account_security` visibly enabled, disabled, and explained without relying on color in `web/src/frontend/features/profile/components/notification-preferences.tsx`
- [X] T124 [US4] Compose loading/default/error/saved preference states and persistent/ARIA-live feedback in `web/src/frontend/features/profile/components/profile-preferences-view.tsx`
- [X] T125 [US4] Load preferences directly through the service in the protected Server Component and render the complete form in `web/src/app/(workspace)/profile/preferences/page.tsx`, then atomically add the now-valid Preferences destination in `web/src/frontend/features/profile/components/profile-navigation.tsx`
- [X] T126 [US4] Run all US4 unit, contract, PostgreSQL integration, component/accessibility, and Playwright tests and record the independent-test result in `spec-kit/specs/002-candidate-profile-account-management/checklists/us4-preferences-results.md`

**Checkpoint**: All four user stories are independently functional and testable.

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Prove cross-story authorization, contract parity, security, migration safety, accessibility, performance, usability, and release readiness.

- [X] T127 [P] Add the full two-account authorization matrix covering profile children, identity, preferences, pending email change, password/session state, forged IDs, inactive/expired sessions, CSRF/origin failures, and wrong-account proofs in `web/tests/backend/integration/security/profile-account-authorization-matrix.test.ts`
- [X] T128 [P] Validate all ten OpenAPI operations against strict Zod and Route Handler behavior, including status/body/header and local-reference parity; assert exact FR-017 phone parity using every documented accepted/rejected example and the 6/7/15/16-digit boundaries; and assert the reusable `NoStoreHeader` on the full nine-operation sensitive set—Profile GET/PATCH, Identity GET/PATCH, Preferences GET/PUT, email-change request/verify, and password change—in `web/tests/backend/contract/profile-account-openapi-parity.test.ts`
- [X] T129 [P] Extend static architecture enforcement for server-only sanitizer/crypto/providers, transport-service-repository layering, direct-service Server Components, one session owner, and no browser secret persistence in `web/tests/architecture/layer-boundaries.test.ts` and `web/tests/frontend/architecture/client-secret-storage.test.ts`
- [X] T130 [P] Add a Feature 002 secret/privacy regression scan for passwords, proofs, full verification links, recipient values, cookies, session/CSRF values, raw network headers, profile bodies, and provider/database errors in `web/tests/backend/unit/security/profile-account-redaction.test.ts`
- [X] T131 Verify clean-database and Feature 001-upgrade migrations, backfill counts, drift, generated-client parity, constraint behavior, and forward-fix recovery and record evidence in `spec-kit/specs/002-candidate-profile-account-management/checklists/migration-results.md`
- [X] T132 [P] Re-run the T005 dependency gate plus license, Prisma, Better Auth, Node, Next.js, and TypeScript compatibility checks as a release regression, compare the result with the pre-implementation baseline, and record accepted risks in `spec-kit/specs/002-candidate-profile-account-management/checklists/dependency-security-results.md`
- [X] T133 Run all Feature 002 unit, contract, integration, architecture, and email-worker suites against PostgreSQL and record zero forbidden output findings in `spec-kit/specs/002-candidate-profile-account-management/checklists/integration-results.md`
- [X] T134 Run the serial desktop and 320px Playwright suite with capture email and controlled accounts, including all independent story journeys and failure recovery, and record evidence in `spec-kit/specs/002-candidate-profile-account-management/checklists/e2e-results.md`
- [X] T135 Measure at least 100 warm samples per view/mutation class using a maximum Profile with 50 skills, 50 experience entries, 50 education entries, and 10 social links plus five active sessions; record p95 page-load and profile/identity/preference-save targets, and measure wall-clock time from each completed password-change response until all four other sessions reject authenticated use within 2 seconds, in `spec-kit/specs/002-candidate-profile-account-management/checklists/performance-results.md`
- [ ] T136 Perform the automated and manual keyboard, focus, screen-reader announcement, contrast, non-color cue, reduced-motion, and 320px overflow audit across all four stories in `spec-kit/specs/002-candidate-profile-account-management/checklists/accessibility-results.md`
- [ ] T137 Define and execute representative first-attempt usability studies for the four primary tasks, with participant/sample/assistance/evidence rules and the 90% threshold, in `spec-kit/specs/002-candidate-profile-account-management/checklists/usability-study.md`
- [X] T138 [P] Document trusted-proxy configuration, email-change proof/recipient handling, password-operation retry/alerting, outbox failure recovery, and privacy-safe incident response in `docs/operations/profile-account-security.md`
- [X] T139 [P] Document profile/account retention, future hard-deletion boundaries, migration backup/forward-fix procedure, shared-skill retention, and audit/outbox preservation in `docs/operations/profile-account-data-lifecycle.md`
- [X] T140 Update setup, migration, capture-email proof extraction, focused/full test commands, troubleshooting, and measurable validation instructions in `spec-kit/specs/002-candidate-profile-account-management/quickstart.md`
- [X] T141 Re-run formatting, lint, typecheck, Prisma validate/generate/status/verify, all tests, and the production build from the documented environment as the final regression gate and record the command matrix in `spec-kit/specs/002-candidate-profile-account-management/checklists/release-results.md`
- [X] T142 Re-check every applicable constitutional MUST, FR-001 through FR-048, VR-001 through VR-006, SC-001 through SC-010, exclusions, and unresolved evidence gaps in `spec-kit/specs/002-candidate-profile-account-management/checklists/release-compliance.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 - Setup**: Starts immediately. T001 and T003 establish the sanitizer pin/test, T002/T004 may proceed independently, and blocking gate T005 must pass before Phase 2 or any implementation task.
- **Phase 2 - Foundational**: Depends on Phase 1 and blocks all user stories. Write T006-T010 first; T011-T029 implement the missing behavior; T030 is the foundation gate.
- **Phase 3 - US1 (P1)**: Depends only on T030. This is the recommended MVP.
- **Phase 4 - US2 (P1)**: Depends only on T030. Its email-change code uses the shared claim, protected-recipient, audit, and outbox boundaries, not US1 code.
- **Phase 5 - US3 (P1)**: Depends only on T030. It reuses the sole Better Auth session/credential owner and existing password notification foundation, not US1 or US2.
- **Phase 6 - US4 (P2)**: Depends only on T030. It can run in parallel with US1-US3.
- **Phase 7 - Polish**: T127-T130 may be prepared once affected story code exists; release evidence T131-T142 depends on every story selected for release.

### User Story Dependency Graph

```text
Phase 1 Setup
      |
      v
Phase 2 Foundation (T030 gate)
      |
      +----------+----------+----------+
      v          v          v          v
   US1 P1     US2 P1     US3 P1     US4 P2
      \          |          |          /
       +---------+----------+---------+
                         |
                         v
               Phase 7 Release Gates
```

### Within Each User Story

1. Write the story's contract, unit, integration, component/accessibility, and E2E tests and confirm intended failures.
2. Implement strict shared contracts and story-specific validation.
3. Implement repository/concurrency behavior before services.
4. Implement services before Route Handlers and Server Component composition.
5. Implement client forms/presentation and keep sensitive form state in memory only.
6. Make the story's full test set pass and record the independent checkpoint.

### Parallel Opportunities

- Setup T002-T004 can run in parallel after task ownership is assigned; T001 exclusively owns dependency manifests, and T005 runs only after T001 and T003 complete.
- Foundational tests T006-T010 are parallel. Implementations T014-T016 and T022 are parallel after schema decisions are fixed.
- After T030, the core US1, US2, US3, and US4 work can be assigned to separate developers; serialize only T089 and T125 because each atomically enables its newly implemented route in `profile-navigation.tsx`.
- Within US1, validation/contracts/read/skill work and the five section components marked `[P]` can proceed concurrently at the stated dependency level.
- Within US2, identity contracts/repository, proof code, email templates, and UI components marked `[P]` can proceed concurrently.
- Within US3, contracts, attempt repository, operation repository, and client state marked `[P]` can proceed concurrently before orchestration composition.
- Within US4, contracts, repository, client state, and the two form components marked `[P]` can proceed concurrently.
- Cross-cutting checks T127-T130, T132, T138, and T139 target separate files and can run concurrently once required story implementations exist.

## Parallel Examples

### User Story 1

```text
T031 candidate-profile contract tests
T032 profile validation unit tests
T033 sanitizer/XSS unit tests
T034 authorization integration tests
T035 aggregate mutation integration tests
T036 concurrency integration tests
T037 basics component tests
T038 collection accessibility tests
```

After contracts/repositories are stable:

```text
T051 basics form
T052 skills form
T053 experience form
T054 education form
T055 social-links form
T059 professional-profile styles
```

### User Story 2

```text
T061 contract tests
T062 identity/email validation tests
T063 identity integration tests
T064 request-flow integration tests
T065 claim-race integration tests
T066 verification integration tests
T067 delivery integration tests
T068 accessibility tests
```

### User Story 3

```text
T091 contract tests
T092 password policy tests
T093 attempt-window tests
T094 Better Auth compatibility tests
T095 attempt integration tests
T096 operation failure-injection tests
T097 security-effect integration tests
T098 accessibility tests
```

### User Story 4

```text
T112 contract tests
T113 validation tests
T114 persistence/invariant tests
T115 accessibility tests
```

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete Phase 2 and pass T030.
3. Complete US1 tasks T031-T060.
4. Stop and validate the US1 independent test.
5. Verify navigation exposes only implemented Professional, Security, and
   Sessions routes, then demonstrate/deploy the professional-profile MVP if all
   applicable release gates pass.

### Incremental Delivery

1. Deliver Setup + Foundation.
2. Deliver US1 Professional Profile as the MVP.
3. Add US2 Account Identity and Email Change.
4. Add US3 Secure Password Change.
5. Add US4 Preferences.
6. Run Phase 7 across the selected release scope; do not claim unmet human usability or production availability evidence.

### Parallel Team Strategy

1. Collaborate on Setup and Foundation, assigning one owner to shared schema/migration files.
2. After T030, assign one independent lane per story.
3. Keep central/shared-file changes in their foundational task owner except the explicitly serialized T089/T125 navigation integrations; all other story-lane work uses story-specific modules.
4. Integrate only after each lane passes its recorded independent checkpoint.

## Notes

- `[P]` means separate files and no unmet same-level dependency; it does not override the phase gates.
- Every browser owner comes from `requireSession`; no task may add a user/profile/session owner field to a mutation.
- Better Auth remains the sole browser-session and credential owner.
- Provider delivery is asynchronous; durable outbox creation is the transaction boundary.
- Never persist or log passwords, proofs, full verification links, recipient plaintext, raw IP/proxy headers, cookies, session/CSRF values, raw provider errors, or complete personal-data request bodies.
- Do not edit applied Feature 001 migrations or the unrelated `web/prisma/migrations/20260731025418_test_ready/` worktree content.
- Commit after a task or coherent task group only when explicitly requested.
