# Feature 002 release compliance review

Date: 2026-07-31  
Review status: **COMPLETE — automated/code evidence passes; two human evidence
gaps remain open**

This review rechecks the constitution, FR-001 through FR-048, VR-001 through
VR-006, SC-001 through SC-010, and the approved exclusions. `PASS` means the
implementation and required executable evidence are present. `PARTIAL` means
the implementation/automated evidence is present but a required human
observation is still missing. `NOT MEASURED` is not a waiver.

Full feature acceptance must not be claimed until:

1. T136 records the live keyboard, focus, screen-reader, reduced-motion, and
   320 px observations; and
2. T137 executes the representative participant study and every primary task
   reaches the 90% SC-003 threshold.

## Evidence index

| Evidence                              | Scope                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `foundation-results.md`               | Migration foundation, registration claim coordination, security primitives, architecture |
| `us1-professional-profile-results.md` | Profile contract, validation, persistence, concurrency, UI, E2E                          |
| `us2-account-email-results.md`        | Identity/email request, proof, delivery, verification, UI, E2E                           |
| `us3-password-change-results.md`      | Policy, attempt window, durable operation, sessions, notification, UI, E2E               |
| `us4-preferences-results.md`          | Defaults, strict update, persistence, mandatory security mail, UI, E2E                   |
| `migration-results.md`                | Fresh/upgrade/backfill/drift/constraint and forward-fix verification                     |
| `dependency-security-results.md`      | Exact dependency, audit, license, and platform compatibility                             |
| `integration-results.md`              | Full PostgreSQL-backed suite and forbidden-output findings                               |
| `e2e-results.md`                      | Serial desktop/320 px story and regression journeys                                      |
| `performance-results.md`              | 100-sample view/mutation p95 and four-session revocation timing                          |
| `accessibility-results.md`            | 33 automated checks, contrast ratios, source review, open live matrix                    |
| `usability-study.md`                  | Representative-study protocol and unexecuted result matrix                               |
| `release-results.md`                  | Final format/lint/typecheck/Prisma/test/build/E2E command matrix                         |

## Functional requirements

| Requirement                                                              | Decision                     | Primary evidence                                                                      |
| ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| FR-001 — reuse UC-AUTH-07 session/account-state boundaries               | PASS                         | Architecture tests, account request boundary, authorization matrix                    |
| FR-002 — derive acting account only from server session                  | PASS                         | Forged-identifier authorization matrix and strict contracts                           |
| FR-003 — owner-check every profile/account/security operation            | PASS                         | Two-account profile and full authorization integration suites                         |
| FR-004 — separate Profile, Identity, Preferences, and security actions   | PASS                         | OpenAPI parity, strict Zod contracts, architecture tests                              |
| FR-005 — server authorization/validation/anti-forgery and explicit Save  | PASS                         | Account request boundary, CSRF/origin matrix, component/E2E flows                     |
| FR-006 — live toast plus persistent, non-color, focusable result         | PASS (automated)             | Four accessibility/component suites; live announcement observation remains under T136 |
| FR-007 — keyboard, labels, focus, assistive status                       | PASS (automated)             | Four accessibility suites and semantic source review; live T136 observation pending   |
| FR-008 — view complete owned professional aggregate                      | PASS                         | Profile query/integration, contract, component, and E2E evidence                      |
| FR-009 — valid empty state and no completeness gate                      | PASS                         | Empty aggregate/component/E2E tests; scope/architecture review                        |
| FR-010 — add/edit/remove/reorder all collections                         | PASS                         | Section-save integration, accessibility controls, E2E journey                         |
| FR-011 — structured experience/education and shared skill catalog        | PASS                         | Prisma constraints, catalog repository/concurrency, suggestions contract              |
| FR-012 — atomic profile aggregate saves and rollback                     | PASS                         | PostgreSQL transaction/failure-injection/constraint tests                             |
| FR-013 — optional basics and exact limits                                | PASS                         | Profile validation/contract boundary tests                                            |
| FR-014 — collection caps, skill normalization/uniqueness/full return     | PASS                         | Validation, constraint, concurrency, max-dataset performance                          |
| FR-015 — experience fields/date/current rules/limits                     | PASS                         | Unit boundary corpus and transactional section tests                                  |
| FR-016 — education fields/date/current rules/limits                      | PASS                         | Unit boundary corpus and transactional section tests                                  |
| FR-017 — exact NFKC phone grammar and examples                           | PASS                         | Unit grammar corpus plus OpenAPI parity 6/7/15/16 boundaries                          |
| FR-018 — safe complete web social URLs                                   | PASS                         | URL validation and duplicate-canonical contract/integration tests                     |
| FR-019 — normalize/sanitize stored text and inert display                | PASS                         | Exact sanitizer corpus, plain-text tests, browser XSS journey                         |
| FR-020 — revisioned last-write-wins with visible conflict                | PASS                         | PostgreSQL concurrency, component warning, desktop/mobile E2E                         |
| FR-021 — separate effective identity/read-only metadata                  | PASS                         | Identity contract/service/component/E2E                                               |
| FR-022 — normalized/sanitized 1–150 character name                       | PASS                         | Identity validation, persistence, component/E2E                                       |
| FR-023 — normalized email uniqueness across effective/pending claims     | PASS                         | Shared advisory-lock coordinator and registration/request races                       |
| FR-024 — sensitive-action reauthentication before request                | PASS                         | Recent-auth request integration and E2E                                               |
| FR-025 — atomic 30-minute request, new proof mail, old alert             | PASS                         | Request repository/service, outbox/audit and delivery suites                          |
| FR-026 — pending email is not effective for login/recovery               | PASS                         | Email-change integration and browser journey                                          |
| FR-027 — newer request supersedes older unconsumed proof                 | PASS                         | Request/concurrency/verification tests                                                |
| FR-028 — atomic uniqueness recheck, identity switch, consumption         | PASS                         | Verification transaction/concurrency and E2E login evidence                           |
| FR-029 — invalid/expired/used/conflicted proof changes nothing           | PASS                         | Verification negative matrix and generic browser outcomes                             |
| FR-030 — no proof or full secret URL in logs                             | PASS                         | Redaction, delivery, response-header, and E2E scans                                   |
| FR-031 — independent preference view/update                              | PASS                         | Preference contract/service/component/E2E                                             |
| FR-032 — only `vi`/`en` and valid IANA timezone                          | PASS                         | Strict schema plus runtime timezone validation tests                                  |
| FR-033 — exact boolean notification categories                           | PASS                         | Strict contract/unknown/non-boolean rejection tests                                   |
| FR-034 — account security mail mandatory                                 | PASS                         | DB CHECK, server rejection, disabled/explained UI, E2E                                |
| FR-035 — exact absent-row defaults                                       | PASS                         | Repository/service/component/E2E evidence                                             |
| FR-036 — authoritative cross-session persistence                         | PASS                         | PostgreSQL persistence and second-session E2E                                         |
| FR-037 — all-or-nothing validated preference set                         | PASS                         | Repository transaction/invalid-set preservation tests                                 |
| FR-038 — protected current/new/confirmation operation                    | PASS                         | Strict password contract, route, service, UI                                          |
| FR-039 — existing auth owner and exact password policy                   | PASS                         | Better Auth compatibility, policy boundary corpus, E2E                                |
| FR-040 — only wrong current password increments                          | PASS                         | Attempt policy and PostgreSQL window tests                                            |
| FR-041 — shared rolling fifth-failure 15-minute lock                     | PASS                         | Serialized cross-session/race/expiry tests and E2E                                    |
| FR-042 — clear failures, revoke others, preserve authoritative initiator | PASS                         | Durable operation, security-effects integration, performance/E2E                      |
| FR-043 — no success while another session is usable                      | PASS                         | Failure injection, post-response session probes, safe 503 tests                       |
| FR-044 — exactly one effective-address confirmation intent               | PASS                         | Idempotent operation/outbox/audit and delivery tests                                  |
| FR-045 — allowlisted security audits with protected network evidence     | PASS                         | Event allowlist, audit repository, outcome/lock integration tests                     |
| FR-046 — secrets/bodies/session values absent from outputs               | PASS                         | Redaction and forbidden-output regression scans                                       |
| FR-047 — no raw IP; protected `/24`/`/56` digest only                    | PASS                         | Proxy/prefix/HMAC primitives, audit tests, operations runbook                         |
| FR-048 — purpose/retention/deletion/least privilege                      | PASS within feature boundary | Authorization, no public view, data-lifecycle/security runbooks                       |

## Verification requirements

| Requirement                                                           | Decision         | Evidence                                                                                                  |
| --------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| VR-001 — two-account authorization/forged ownership matrix            | PASS             | `profile-account-authorization-matrix.test.ts` and profile authorization suites pass                      |
| VR-002 — complete server-validation boundary corpus                   | PASS             | Profile/account unit, contract, CSRF/origin, duplicate-claim, and policy suites pass                      |
| VR-003 — full password-change behavior/security/accessibility         | PASS (automated) | US3 integration/E2E and automated accessibility evidence; T136 live announcement observation remains open |
| VR-004 — full email-change lifecycle/races/failure handling           | PASS             | US2 request, verification, delivery, concurrency, authorization, and E2E evidence                         |
| VR-005 — defaults, persistence, inert text, integrity, conflict       | PASS             | US1/US4 unit/integration/component/E2E evidence                                                           |
| VR-006 — keyboard/focus/live/contrast/mobile/non-color across stories | PARTIAL          | 33 automated checks and 8/8 story viewport journeys pass; required live T136 observations are pending     |

## Success criteria

| Criterion                                                                            | Decision     | Measured evidence                                                                                          |
| ------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------- |
| SC-001 — 100-sample warm view p95 <= 3 s                                             | PASS         | Profile 869.11 ms; identity 402.81 ms; preferences 116.13 ms; security 152.50 ms                           |
| SC-002 — 100-sample mutation p95 <= 2 s                                              | PASS         | Profile 461.51 ms; identity 224.81 ms; preferences 300.93 ms                                               |
| SC-003 — >= 90% representative first-attempt completion per task                     | NOT MEASURED | Protocol ready, 0 participants; T137 remains open                                                          |
| SC-004 — 100% cross-account attempts denied/no mutation                              | PASS         | Full two-account authorization matrix passes                                                               |
| SC-005 — 100% valid stale saves apply and visibly warn                               | PASS         | Concurrency integration plus both E2E projects                                                             |
| SC-006 — initiator usable, four others rejected <= 2 s, old password fails, one mail | PASS         | Four rejection probes: 33.31, 34.87, 34.83, 35.32 ms; integration/E2E credential/mail assertions pass      |
| SC-007 — old email before, new only after, proof single-use                          | PASS         | Email-change integration and both browser projects                                                         |
| SC-008 — cross-session preferences unchanged/security enabled                        | PASS         | Preference integration and both browser projects                                                           |
| SC-009 — zero stored script/markup/unsafe execution                                  | PASS         | Sanitizer corpus, redaction tests, desktop/mobile stored-XSS journey                                       |
| SC-010 — 320 px, keyboard, screen-reader results                                     | PARTIAL      | 320 px E2E and automated keyboard/semantics pass; live screen-reader/keyboard matrix under T136 is pending |

## Constitutional MUST review

| Applicable constitutional rule group                                                    | Applicability and decision                                                             | Evidence                                                                                        |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Principle I — human-controlled recruitment and explainable AI                           | N/A — Feature 002 performs no scoring, ranking, recruitment decision, or AI processing | Scope/route/artifact review                                                                     |
| Principle II — server auth, secure exclusive cookies, no browser token storage          | PASS                                                                                   | UC-AUTH-07 reuse, architecture/client-storage tests, authorization matrix                       |
| Principle II — role/company tenant enforcement                                          | N/A to self-owned candidate resources; no recruiter/company resource is introduced     | Scope and OpenAPI review                                                                        |
| Principle II — least privilege, password protection, validated inputs, secret-safe logs | PASS                                                                                   | Better Auth ownership, strict schemas, redaction/security suites                                |
| Principle II — HTTPS/secure production configuration                                    | PASS as deployment control                                                             | Production environment validation requires HTTPS and secure cookie policy                       |
| Principle II — CV upload type/size                                                      | N/A — CV/document handling is explicitly excluded                                      | Exclusion review                                                                                |
| Principle II — purpose, consent, disclosure, retention/deletion under Vietnamese policy | PASS within implementation scope                                                       | No public/recruiter disclosure; FR-048 boundaries and data-lifecycle runbook                    |
| Principle III — deterministic/AI score formula, bands, fallback, traceability           | N/A — no AI/scoring behavior                                                           | Scope/architecture review                                                                       |
| Principle IV — transactional critical writes/referential integrity                      | PASS                                                                                   | Profile/email/password/preference PostgreSQL transactions and constraints                       |
| Principle IV — duplicate prevention/idempotency                                         | PASS                                                                                   | Uniques, advisory locks, idempotency binding, immutable outbox                                  |
| Principle IV — canonical application states/Kanban/hiring rule                          | N/A — no application pipeline state                                                    | Scope review                                                                                    |
| Principle IV — visible client reconciliation/recovery                                   | PASS                                                                                   | Revision refetch/conflict feedback and failed-value component/E2E tests                         |
| Principle IV — safe migration/recovery                                                  | PASS                                                                                   | Clean/upgrade verification, forward fix, backup/runbook guidance                                |
| Principle IV — critical audit with minimal actor/action/target/result/time              | PASS                                                                                   | Allowlisted audit events, protected network digest, redaction tests                             |
| Principle IV — job-post edit history                                                    | N/A                                                                                    | No job-post behavior                                                                            |
| Principle V — approved need, complete P0 candidate workflow, no scope re-entry          | PASS with human gates disclosed                                                        | Four complete implementation stories; exclusions preserved; no false acceptance claim           |
| Principle V — external dependency purpose/failure/replacement boundary                  | PASS                                                                                   | Exact sanitizer gate; provider-independent email and Better Auth gateway boundaries             |
| Principle VI — stated performance environment/dataset/method                            | PASS                                                                                   | 100-sample maximum-dataset performance evidence                                                 |
| Principle VI — availability is only a design target unless measured                     | PASS                                                                                   | No production availability claim is made                                                        |
| Principle VI — responsive candidate workflow/progress recovery                          | PASS (automated)                                                                       | 320 px E2E, retained failed values, server reconciliation                                       |
| Principle VI — recruiter/admin data-dense desktop                                       | N/A                                                                                    | Candidate-only feature                                                                          |
| Principle VI — typography/contrast/keyboard/labels/status/non-color                     | PARTIAL                                                                                | Automated/contrast evidence passes; live T136 observation remains                               |
| Principle VII — approved Next.js/TypeScript architecture                                | PASS                                                                                   | App Router implementation and architecture tests                                                |
| Principle VII — layered transport/service/repository separation                         | PASS                                                                                   | Static architecture enforcement and source review                                               |
| Principle VII — PostgreSQL authority/transactions/migrations                            | PASS                                                                                   | Prisma schema, constraints, clean/upgrade verification                                          |
| Principle VII — exactly one server-controlled browser session                           | PASS                                                                                   | Better Auth remains exclusive; no browser/session duplicate                                     |
| Principle VII — typed/validated trust boundaries                                        | PASS                                                                                   | OpenAPI/Zod parity for all ten operations                                                       |
| Principle VII — provider-independent services and failure isolation                     | PASS                                                                                   | Email adapters/outbox and auth gateway; provider failures do not roll back state                |
| Mandatory product boundary — base Candidate identity and candidate profile P0           | PASS                                                                                   | Registration backfill/creation and one-to-one profile constraints                               |
| Mandatory recruiter/company/employer rules                                              | N/A                                                                                    | No authority or employer capability added                                                       |
| Explicit AI/job/search/gap exclusions                                                   | PASS                                                                                   | None is implemented or reintroduced                                                             |
| Spec Kit artifact gates and governance                                                  | PASS                                                                                   | Spec, plan, tasks, checklists, runbooks, and evidence remain aligned; no constitution amendment |

## Scope and exclusion review

| Excluded capability                                            | Result                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CV upload/parsing/review and Feature 004 UI                    | Not introduced                                                             |
| Recruitment preferences beyond three named email categories    | Not introduced                                                             |
| Candidate recommendations                                      | Not introduced; label only represents the approved notification preference |
| Public/recruiter profile view                                  | Not introduced                                                             |
| Avatar/document/demographic/legal-identity fields              | Not introduced                                                             |
| Profile completeness or application eligibility gate           | Not introduced                                                             |
| Replacement registration/login/recovery/TOTP/session mechanism | Not introduced                                                             |
| Account deletion/suspension/reinstatement/admin editing        | Not introduced; lifecycle document defines only future boundaries          |
| SMS/phone authentication                                       | Not introduced                                                             |
| Password composition rules or password-history storage         | Not introduced                                                             |
| New AI/scoring behavior                                        | Not introduced                                                             |

## Unresolved evidence gaps and release decision

1. **T136 / VR-006 / SC-010:** The in-app browser was not attached to this
   execution environment. Automated semantics, focus contracts, contrast,
   reduced-motion CSS, desktop/320 px browser journeys, and source review pass,
   but live keyboard focus sequences and screen-reader announcements have not
   been observed and must not be inferred.
2. **T137 / SC-003:** No representative participants were recruited or tested.
   The 10-person minimum protocol, assistance rules, task scripts, and raw
   result template are ready; the measured rate remains absent.

Code implementation, migrations, automated security/accessibility, performance,
and regression gates are release-candidate quality. The compliance decision is
**conditional / not yet eligible for an unqualified “all requirements passed”
claim** until both human evidence gates above are completed.
