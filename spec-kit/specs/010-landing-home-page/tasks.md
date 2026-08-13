# Tasks: Smart Hire Home/Landing Page

**Input**: Design documents from `spec-kit/specs/010-landing-home-page/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/home-page-contract.md`, `quickstart.md`, and the project constitution.

**Status policy**: Every task starts unchecked. Existing files are implementation
inputs, not completion evidence. Mark a task complete only after its source
change, acceptance criteria, and named automated/manual evidence all exist.

**Scope**: One shared Home route and existing product workflows only. Do not add
an API, database migration, scoring/recommendation engine, CMS, social
interaction, payment/order, chat, job-application workflow, job-post workflow,
or recruitment-management feature.

## Format: `[ID] [P?] [Story?] Description with file path — Acceptance criteria`

- `[P]` means the task can run in parallel after its stated prerequisites.
- User-story tasks use `[US1]` through `[US5]`; setup, foundation, and release
  tasks have no story label.

---

## Phase 1: Setup and Evidence Commands

**Purpose**: Establish truthful scope and separate fast validation from the
environment-dependent browser performance run.

- [X] T001 [P] Audit the Home source/scope policy in `web/src/frontend/features/home/README.md` — Acceptance: it identifies reused Jobs/Profile/Saved Job/Recruiter/Better Auth boundaries, independent public Company projection, curated display-only data, candidate-facing job recommendation rather than applicant screening, and all prohibited Home APIs/migrations/engines/workflows.
- [X] T002 Define focused scripts in `web/package.json` and document them in `spec-kit/specs/010-landing-home-page/quickstart.md` — Acceptance: `lint:home` is exactly `eslint src/app/page.tsx src/app/home/page.tsx src/backend/services/home src/backend/repositories/home src/backend/services/jobs/candidate-job-match.ts src/backend/services/jobs/job-discovery-service.ts src/frontend/features/home tests/helpers/home tests/backend/unit/home tests/backend/integration/home tests/frontend/components/home tests/frontend/accessibility/home tests/security/home tests/architecture/home-boundaries.test.ts tests/architecture/home-localization-boundary.test.ts`; fast `test:home` is exactly `vitest run tests/backend/unit/home tests/backend/integration/home tests/frontend/components/home tests/frontend/accessibility/home tests/security/home tests/architecture/home-boundaries.test.ts tests/architecture/home-localization-boundary.test.ts`, with no performance/E2E path or `--passWithNoTests`; `test:home:e2e` is exactly `playwright test tests/system/e2e/home`; `test:home:performance` is exactly `playwright test --config=playwright.home-performance.config.ts`; the quickstart lists the exact T079/T080 commands and states each command's evidence scope.

---

## Phase 2: Foundational Shared Home Contract

**Purpose**: Establish the typed, localized, independently stateful model used by
all stories.

**Critical**: Complete this phase before story implementation.

- [X] T003 Add failing model-invariant tests in `web/tests/frontend/components/home/home-page-model.test.ts` — Acceptance: tests reject private Guest/Employer fields, illegal personal-match variants, more than six jobs/spotlights, unsupported company claims, interactive display-only cards, and dishonest retry metadata.
- [X] T004 Implement the viewer, section-state, search, job, company, destination, and Smart Match contracts in `web/src/frontend/features/home/home-page-model.ts` — Acceptance: types encode Guest/Candidate/Employer, candidate-facing personal job recommendation, illustration, six search fields, loading/ready/empty/error, `reloadHome`, safe spotlight fields, and no persistent/private Home entity; T003 passes.
- [X] T005 Create typed Guest, sufficient/insufficient Candidate, Employer, expired-session, job, company, match, and source-failure builders in `web/tests/helpers/home/home-fixtures.ts` — Acceptance: builders compile against T004, contain only allowlisted public/current-viewer data, support independent failures, and contain no token, session proof, fabricated company claim, screening score, or persisted Home record.
- [X] T006 [P] Add failing bilingual catalog and curated-data completeness tests in `web/tests/backend/unit/home/home-display-data.test.ts` — Acceptance: tests enumerate required `vi`/`en` keys, require approved content categories, cap feed items at three, and reject live, endorsed, social, registration, screening, or misleading company claims.
- [X] T007 Implement the typed catalog schema/content in `web/src/frontend/features/home/home-copy.ts` and reference-only fixtures in `web/src/frontend/features/home/home-display-data.ts` — Acceptance: both locales contain the canonical copy keys, curated records reference those keys, illustration is labelled and unrelated to real jobs, and T006 passes; component migration remains in US5.
- [X] T008 [P] Add failing composition-isolation tests in `web/tests/backend/unit/home/home-page-context.test.ts` — Acceptance: tests cover independent Job/Company/Profile/Recruiter outcomes, one safe viewer model, fixed section order, and profile failure selecting illustration without failing public jobs.
- [X] T009 Refactor `web/src/backend/services/home/get-home-page-context.ts` into injectable independently settled boundaries — Acceptance: `requireSession()` resolves once; authorized sources cannot collapse unrelated sections; raw errors/private session fields never cross the model; T008 passes without a new endpoint or persistence.
- [X] T010 [P] Add failing shared-shell tests in `web/tests/frontend/components/home/home-page-view.test.tsx` — Acceptance: all 11 ordered sections render for Guest, Candidate, Employer, and expired fixtures; `/home` remains a redirect rather than a second composition.
- [X] T011 Reconcile `web/src/app/page.tsx`, `web/src/app/home/page.tsx`, and `web/src/frontend/features/home/components/home-page-view.tsx` — Acceptance: `/` renders one structure for all viewers, `/home` redirects to `/`, only authorized slots vary, and T010 passes.

---

## Phase 3: User Story 1 — Understand and Search Smart Hire (P1)

**Goal**: Explain Smart Hire and hand exactly six validated criteria to existing
Job Discovery without losing values during locale switching.

**Independent Test**: A first visitor sees the proposition, fills any supported
filters, switches language without data loss, and reaches `/jobs` with only
allowlisted parameters; no-result recovery stays usable.

- [X] T012 [P] [US1] Add failing search allowlist/serialization tests in `web/tests/frontend/components/home/home-search-config.test.ts` — Acceptance: tests cover only `q`, `location`, `workArrangement`, `employmentType`, `experienceLevel`, and `skills`; reuse existing validation; de-duplicate values; reject unknown, locale, session, role, membership, score, and mock keys.
- [X] T013 [US1] Implement the six-field query builder in `web/src/frontend/features/home/home-search-config.ts` — Acceptance: only populated validated values reach `/jobs`, arrays use repeated accepted keys, arbitrary current query keys are never copied, invalid input is recoverable, and T012 passes.
- [X] T014 [P] [US1] Add failing locale/search-draft tests in `web/tests/frontend/components/home/home-locale-provider.test.tsx` — Acceptance: all six values survive `vi`/`en` switching while session, authorization, recruiter state, records, and match source remain unchanged and no sensitive value enters browser storage.
- [X] T015 [US1] Refactor `web/src/frontend/features/home/client/home-locale-provider.tsx` and `web/src/frontend/features/home/components/home-language-selector.tsx` — Acceptance: provider owns locale plus complete search draft above form/selector, updates `lang`, never remounts inputs, stores no authority/credential, and T014 passes.
- [X] T016 [P] [US1] Add failing Hero/CTA tests in `web/tests/frontend/components/home/home-hero.test.tsx` — Acceptance: tests require exact English proposition and approved Vietnamese copy, six labelled controls, valid feedback, Guest `/register`, authenticated `/profile`, and recruiter-status-only Post a Job.
- [X] T017 [US1] Implement Hero, search, and CTAs in `web/src/frontend/features/home/components/home-hero-search.tsx`, `home-hero-ctas.tsx`, and `home-page-view.tsx` — Acceptance: all viewers share the structure, submit uses T013, Guest Create Profile is exactly `/register`, all copy is catalog-driven, unsupported URLs are absent, and T016 passes.
- [X] T018 [P] [US1] Add no-result integration coverage in `web/tests/backend/integration/home/home-search-handoff.integration.test.ts` — Acceptance: valid criteria are accepted by existing Job Discovery, unknown/invalid values never arrive, and empty results preserve editable discovery criteria without disabling Home.
- [X] T019 [US1] Add guest-search E2E coverage in `web/tests/system/e2e/home/guest-search.spec.ts` — Acceptance: desktop/mobile and both locales preserve all six values, emit only approved parameters, reach `/register`, and complete no-result recovery.

---

## Phase 4: User Story 2 — Use One Session-Aware Home (P1)

**Goal**: Preserve one Home while account controls, shortcuts, employer action,
logout, and private presentation follow existing Better Auth/recruiter authority.

**Independent Test**: Compare Guest, Candidate, Employer, and expired session on
`/`; verify identical section order, exact account controls, audited logout, and
no stale/private output.

- [X] T020 [P] [US2] Add failing server session-matrix tests in `web/tests/backend/integration/home/home-session-context.integration.test.ts` — Acceptance: Guest, Candidate, approved Employer, pending/rejected/unavailable recruiter states, and expiry map to safe viewer variants through existing `requireSession()` without guessed authority or URLs.
- [X] T021 [US2] Reconcile viewer classification in `web/src/backend/services/home/get-home-page-context.ts` — Acceptance: classification uses only existing session/recruiter membership authority; invalid session becomes Guest; Employer excludes candidate recommendation; T020 passes.
- [X] T022 [P] [US2] Add failing header/account tests in `web/tests/frontend/components/home/home-account-menu.test.tsx` — Acceptance: Guest sees Log in/Sign up; authenticated viewers see safe localized name/avatar fallback and Log out; email is never fallback; long/empty names and invalid images stay accessible.
- [X] T023 [US2] Reconcile `web/src/frontend/features/home/components/home-header.tsx`, `home-guest-actions.tsx`, and `home-account-menu.tsx` — Acceptance: controls match the viewer contract, all copy/aria labels are catalog-driven, fallback is non-identifying, and T022 passes.
- [X] T024 [P] [US2] Add failing logout concurrency/feedback tests in `web/tests/frontend/components/home/home-logout-action.test.tsx` — Acceptance: pending blocks duplicates, success requests Guest presentation, failure retains authenticated UI with localized recovery, and expiry requests safe refresh.
- [X] T025 [US2] Reconcile `web/src/frontend/features/home/components/home-logout-action.tsx` with existing `POST /api/identity/logout` — Acceptance: no auth mechanism is added, origin/CSRF/session handling remains server-owned, no token enters client state, and T024 passes.
- [X] T026 [P] [US2] Add logout audit integration evidence in `web/tests/backend/integration/home/home-logout-audit.integration.test.ts` — Acceptance: successful valid logout records exactly one `logout.succeeded` event with actor, session, result, timestamp, and no unnecessary personal data; rejected CSRF and no-session idempotent responses do not create false success audit; existing `session.revoked` policy audit remains intact.
- [X] T027 [P] [US2] Add failing shortcut/recruiter-status tests in `web/tests/frontend/components/home/home-personal-shortcuts.test.tsx` — Acceptance: Candidate gets only `/dashboard`, `/jobs/applied`, `/jobs/saved`; approved Employer gets `/dashboard` plus resolved Post a Job; other states are semantic/non-guessed; Orders is absent.
- [X] T028 [US2] Reconcile `web/src/frontend/features/home/components/home-personal-shortcuts.tsx` and `home-employer-action.tsx` — Acceptance: routes/actions meet T027, loading/unavailable/disabled states are localized and keyboard-readable, and Home constructs no recruiter/company URL.
- [X] T029 [P] [US2] Add session/private-output security tests in `web/tests/security/home/home-session-privacy.test.ts` — Acceptance: Guest/expired output has no name, avatar, email, shortcut, saved/application state, profile signal, personal score, membership, token, proof, or raw error; Employer has no candidate recommendation fields.
- [X] T030 [US2] Integrate account, shortcuts, recruiter action, and expiry reset in `web/src/frontend/features/home/components/home-page-view.tsx` and `home-authenticated-actions.tsx` — Acceptance: section order is fixed, optional failure does not block logout, protected-action `401` refreshes to Guest without stale private flash, and T029 passes.
- [ ] T031 [US2] Add session-aware E2E coverage in `web/tests/system/e2e/home/session-aware-home.spec.ts` — Acceptance: Guest/Candidate/Employer, logout success/failure, and expiry pass in both locales with exact shortcuts/actions and no stale output; backend integration evidence T026 proves audit preservation.

---

## Phase 5: User Story 3 — Evaluate Jobs and Smart Match (P1)

**Goal**: Show genuine candidate-facing job recommendations only to eligible
candidates, labelled illustration to others, bounded public jobs, and safe saves.

**Independent Test**: Compare sufficient Candidate, insufficient Candidate,
Guest, and Employer; verify recommendation source/explanation/card scores and
save success/failure/account-required behavior.

- [X] T032 [P] [US3] Add failing deterministic job-recommendation helper tests in `web/tests/backend/unit/home/home-candidate-match.test.ts` — Acceptance: sufficiency is non-empty plus skill/experience/location, current `computeMatchScore` outputs/order remain, normalized matching skills and at most three missing skills are derived, and no applicant-screening/60-40 logic appears.
- [X] T033 [US3] Extract existing recommendation logic into `web/src/backend/services/jobs/candidate-job-match.ts` and reuse it from `job-discovery-service.ts` — Acceptance: both callers use one unchanged deterministic formula, output ranks jobs for the current candidate rather than candidates for employers, and no API, persistence, AI, or second engine is added; T032 passes.
- [X] T034 [P] [US3] Add failing Home match-composition tests in `web/tests/backend/integration/home/home-smart-match.integration.test.ts` — Acceptance: sufficient Candidate receives genuine per-job recommendations/highest explanation; Guest, Employer, insufficient Candidate, profile/match failure, or no result receives illustration and zero card scores.
- [X] T035 [US3] Implement Candidate-only recommendation projection in `web/src/backend/services/home/get-home-page-context.ts` — Acceptance: it invokes T033 only for current Candidate, emits skills/areas/limitations/estimate, attaches scores only to current-viewer jobs, never emits applicant-screening output, and T034 personal cases pass.
- [X] T036 [US3] Implement illustrative fallback in `web/src/frontend/features/home/home-display-data.ts` and `web/src/backend/services/home/get-home-page-context.ts` — Acceptance: Guest/Employer/insufficient/unavailable states receive catalog-backed illustration with no signals/real-job link/card score; T034 fallback cases pass.
- [X] T037 [P] [US3] Add failing Smart Match presentation tests in `web/tests/frontend/components/home/home-smart-match.test.tsx` — Acceptance: personal/illustrative labels differ; explanation and estimate/not-decision wording appear in both locales; content says job recommendation, not applicant screening; Employer has no candidate fields.
- [X] T038 [US3] Reconcile `web/src/frontend/features/home/components/home-smart-match.tsx` — Acceptance: only variant-legal fields render, all copy is centralized, detailed score has skills/areas/limitations, and T037 passes.
- [X] T039 [P] [US3] Add failing Trending Opportunities tests in `web/tests/frontend/components/home/home-trending-jobs.test.tsx` — Acceptance: at most six authorized jobs expose required fields/detail/save; under FR-024 a compact card estimate appears only for the current valid personal recommendation, is labelled as an estimate, and is clearly associated with the detailed Smart Match explanation without repeating its skills, improvement areas, or limitations.
- [X] T040 [US3] Reconcile `web/src/backend/services/home/get-home-page-context.ts` and `web/src/frontend/features/home/components/home-trending-jobs.tsx` — Acceptance: projection is allowlisted, score ownership/explanation association is server-enforced, long content wraps, and T039 passes.
- [X] T041 [P] [US3] Add failing save tests in `web/tests/frontend/components/home/home-save-job-action.test.tsx` — Acceptance: Guest gets localized account requirement and allowlisted return path; authenticated save blocks duplicates, announces success, restores prior state on failure, and handles expiry without stale save.
- [X] T042 [US3] Reconcile `web/src/frontend/features/home/components/home-save-job-action.tsx` with existing Saved Job workflow — Acceptance: no endpoint/service is added, return-path injection is rejected, failure does not block navigation, and T041 passes.
- [X] T043 [P] [US3] Add match/job privacy architecture tests in `web/tests/security/home/home-match-projection.test.ts` — Acceptance: no Guest/Employer signal/score, no illustrative card score, no persisted Home score, no screening formula/API path, and existing deterministic recommendation outputs remain stable.
- [X] T044 [US3] Add Trending/Smart Match/save E2E in `web/tests/system/e2e/home/trending-smart-match.spec.ts` — Acceptance: all viewer/profile states, source labels, card-score eligibility/explanation, estimate wording, job detail, save success/failure, and account-required flow pass in both locales.

---

## Phase 6: User Story 4 — Explore Verified Employers and Career Content (P1)

**Goal**: Show authoritative public employers and plausible display-only content
without invented claims or unavailable destinations.

**Independent Test**: Inspect every spotlight/curated card for source allowlists,
optional omissions, local states, required categories, and non-interactivity.

- [X] T045 [P] [US4] Add failing company-repository tests in `web/tests/backend/integration/home/home-public-company-repository.integration.test.ts` — Acceptance: only active verified companies and allowlisted public fields are selected; unsupported culture/badges are impossible; optional count uses all active/approved/published/non-expired jobs, never six Trending jobs.
- [X] T046 [US4] Implement `web/src/backend/repositories/home/prisma-home-public-company-repository.ts` — Acceptance: bounded query meets T045, returns no private tax/address/membership detail, adds no API/migration, and omits count unless the exact authoritative relation count exists.
- [X] T047 [P] [US4] Add failing company-composition tests in `web/tests/backend/unit/home/home-employer-spotlight-context.test.ts` — Acceptance: safe rows map to display-only cards, optional fields omit cleanly, zero rows become localized empty, failure becomes localized error, and Jobs remain independent.
- [X] T048 [US4] Integrate T046 in `web/src/backend/services/home/get-home-page-context.ts` — Acceptance: Spotlight derives nothing from Trending jobs, emits no fabricated fallback, isolates company state, and T047 passes.
- [X] T049 [P] [US4] Add Spotlight component/security tests in `web/tests/frontend/components/home/home-employer-spotlight.test.tsx` and `web/tests/security/home/home-company-projection.test.ts` — Acceptance: cards require safe identity, omit unsupported claims, label summary honestly, show only authoritative count, are display-only, and expose no private data.
- [X] T050 [US4] Reconcile `web/src/frontend/features/home/components/home-employer-spotlight.tsx` — Acceptance: ready/empty/error use no invented data, optional fields do not break layout, labels are centralized, cards are non-links, and T049 passes.
- [X] T051 [P] [US4] Add curated-content tests in `web/tests/frontend/components/home/home-community-content.test.tsx` — Acceptance: feed, six paths, four Growth categories, and four non-registering Event examples are plausible, bilingual, capped, and display-only.
- [X] T052 [US4] Reconcile `home-whats-new.tsx`, `home-career-paths.tsx`, `home-growth-hub.tsx`, and `home-career-events.tsx` under `web/src/frontend/features/home/components/` — Acceptance: T051 passes and no link/button/social/registration affordance exists.
- [X] T053 [P] [US4] Add destination tests in `web/tests/frontend/components/home/home-destinations.test.tsx` — Acceptance: `/jobs`, `#community`, `#employer-spotlight`, `#events`, `/jobs/[slug]`, `/register`, `/profile`, shortcuts, footer routes/anchors, recruiter action, and display-only items exactly match the contract.
- [X] T054 [US4] Reconcile destinations in `web/src/frontend/features/home/components/home-header.tsx`, `home-page-view.tsx`, `home-final-cta.tsx`, and `home-footer.tsx` — Acceptance: every target exists or is display-only, IDs match anchors, Post a Job remains authorized, no `/companies` or invented route exists, and T053 passes.
- [X] T055 [US4] Add employer/community E2E in `web/tests/system/e2e/home/employer-community.spec.ts` — Acceptance: both locales resolve valid targets, Spotlight data is authoritative/display-only, curated cards are non-interactive, and company empty/error leaves primary controls usable.

---

## Phase 7: User Story 5 — Navigate a Localized, Resilient Home (P1)

**Goal**: Make every Home state bilingual, responsive, accessible, visually
consistent, keyboard-operable, and resilient.

**Independent Test**: In `vi` and `en`, complete primary keyboard journeys at
desktop/tablet/mobile and 200% zoom through loading, empty, error, reload,
account-required, and expired-session states.

- [X] T056 [P] [US5] Add a failing localization-boundary test in `web/tests/architecture/home-localization-boundary.test.ts` — Acceptance: every Home-authored visible/assistive/status string resolves from the single catalog in both locales, component literals fail, and underlying records are exempt.
- [X] T057 [US5] Migrate shell/session copy in `web/src/frontend/features/home/components/home-header.tsx`, `home-guest-actions.tsx`, `home-account-menu.tsx`, `home-authenticated-actions.tsx`, `home-logout-action.tsx`, `home-personal-shortcuts.tsx`, `home-employer-action.tsx`, and `web/src/frontend/features/home/client/home-mobile-navigation.tsx` — Acceptance: navigation, account, authenticated-shell copy, avatar labels, logout, shortcuts, recruiter states, mobile menu, and feedback use catalog keys; `home-authenticated-actions.tsx` contains no hard-coded Home-authored visible or assistive string if retained; T056 passes.
- [X] T058 [P] [US5] Migrate discovery/match copy in `web/src/frontend/features/home/components/home-hero-search.tsx`, `home-hero-ctas.tsx`, `home-trending-jobs.tsx`, `home-save-job-action.tsx`, `home-smart-match.tsx`, `home-section-state.tsx`, and `home-auth-required-feedback.tsx` — Acceptance: search labels/options, CTAs, job/save/match labels, state/recovery, and account-required feedback use catalog keys and pass T056.
- [X] T059 [P] [US5] Migrate community/footer copy in `web/src/frontend/features/home/components/home-whats-new.tsx`, `home-career-paths.tsx`, `home-employer-spotlight.tsx`, `home-growth-hub.tsx`, `home-career-events.tsx`, `home-final-cta.tsx`, `home-footer.tsx`, and `home-page-view.tsx` — Acceptance: headings, cards, display-only labels, CTA/footer, and section messages use catalog/display keys and pass T056 without translating backend records.
- [X] T060 [P] [US5] Add state/recovery tests in `web/tests/frontend/components/home/home-section-state.test.tsx` — Acceptance: localized loading/empty/error, scoped retry metadata, explicit Reload Home, account-required, and expiry feedback pass; full refresh is never called section Retry.
- [X] T061 [US5] Reconcile `web/src/frontend/features/home/components/home-section-state.tsx` and `home-auth-required-feedback.tsx` — Acceptance: scoped recovery exists only when supported; otherwise labelled `router.refresh()` reloads Home; unrelated content remains; T060 passes.
- [X] T062 [P] [US5] Define Home visual tokens in `web/src/frontend/styles/home.css` and reconcile `web/src/frontend/styles/responsive.css` — Acceptance: existing font/scale, spacing, grid, controls, line heights, radii, shadows, focus, contrast, and reduced motion are normalized; conflicting obsolete rules are removed only after equivalent coverage.
- [X] T063 [US5] Refine header/Hero/account layout in `web/src/frontend/features/home/components/home-header.tsx`, `home-hero-search.tsx`, `home-hero-ctas.tsx`, `home-account-menu.tsx`, `home-personal-shortcuts.tsx`, and `home-employer-action.tsx` — Acceptance: navigation, language, six filters, CTAs, identity, shortcuts, and recruiter state align to T062 and long localized text wraps without overlap.
- [X] T064 [P] [US5] Refine card/section layout in `web/src/frontend/features/home/components/home-smart-match.tsx`, `home-trending-jobs.tsx`, `home-employer-spotlight.tsx`, `home-whats-new.tsx`, `home-career-paths.tsx`, `home-growth-hub.tsx`, and `home-career-events.tsx` — Acceptance: grids, cards, badges/skills, actions, and optional fields align to T062 with consistent density and no clipped content.
- [X] T065 [P] [US5] Refine state/final/footer layout in `web/src/frontend/features/home/components/home-section-state.tsx`, `home-auth-required-feedback.tsx`, `home-final-cta.tsx`, `home-footer.tsx`, and `home-page-view.tsx` — Acceptance: status/recovery, final CTA, section rhythm, and footer align to T062 without horizontal scroll or cramped actions.
- [X] T066 [P] [US5] Add compact-navigation keyboard tests in `web/tests/frontend/components/home/home-mobile-navigation.test.tsx` — Acceptance: localized name/expanded state, Enter/Space/Escape, focus containment/restoration, and non-hover/non-color operation pass.
- [X] T067 [US5] Reconcile `web/src/frontend/features/home/client/home-mobile-navigation.tsx` and `web/src/frontend/features/home/components/home-header.tsx` — Acceptance: T066 passes and navigation/account/language/search stay reachable without horizontal scroll at mobile and 200% zoom.
- [X] T068 [P] [US5] Add component accessibility scans in `web/tests/frontend/accessibility/home/home-accessibility.test.tsx` — Acceptance: all viewer/match/section-state fixtures have landmarks, headings, alternatives, labels, visible state text, and zero serious/critical axe violations.
- [X] T069 [P] [US5] Add responsive keyboard E2E in `web/tests/system/e2e/home/home-keyboard-responsive.spec.ts` — Acceptance: navigation, locale, search, account, save/login, logout, and recovery work keyboard-only at desktop/tablet/mobile/200% zoom with no overlap, clipped focus, or horizontal scroll.
- [ ] T070 [P] [US5] Add independent-failure E2E in `web/tests/system/e2e/home/home-resilience.spec.ts` — Acceptance: Job/Company loading/empty/error are isolated, recovery labels are honest, primary controls remain usable, and expiry returns Guest without stale data.
- [X] T071 [US5] Add bilingual E2E in `web/tests/system/e2e/home/home-localization.spec.ts` — Acceptance: representative visible/assistive/state/feedback paths pass in both locales, records remain unchanged, and locale switching preserves search/viewer/recommendation/company state.

---

## Phase 8: Cross-Cutting Scope and Release Evidence

**Purpose**: Prove complete Feature 010 behavior without converting partial or
unexecuted checks into evidence.

- [X] T072 [P] Strengthen `web/tests/architecture/home-boundaries.test.ts` — Acceptance: it fails on a Home API/migration/table/new match engine or persistence/CMS/social/payment/order/chat/CV/video/pipeline/recruitment workflow/duplicate auth mechanism while allowing existing adapters.
- [X] T073 [P] Add rendered privacy coverage in `web/tests/security/home/home-rendered-data.test.ts` — Acceptance: Guest/expired HTML, URLs, feedback, and client data contain no identity/profile/recommendation/save/application/membership/token/proof/raw error; Employer has no candidate-specific recommendation; Company matches allowlist.
- [X] T074 [P] Implement Chromium performance configuration and harnesses in `web/playwright.home-performance.config.ts`, `web/tests/performance/home/home-page-performance.spec.ts`, and `home-resilience.spec.ts` — Acceptance: the separate config targets only performance tests, uses Chromium projects at 1366x768 and 390x844, drives 10 concurrent visitors and at least 100 measured samples against at least 1,000 active jobs, and records environment, duration, P95 method, maximum, error rate, and external conditions.
- [ ] T075 Execute `npm --prefix web run test:home:performance` and record actual output in `spec-kit/specs/010-landing-home-page/release-validation.md` — Acceptance: Header/Hero P95 is evaluated against 3 seconds and search handoff/results against 2 seconds in both projects; failed/unexecuted conditions remain open and are not inferred from fast `test:home`.
- [X] T076 [P] Define moderated first-visit protocol in `web/tests/usability/home/home-first-visit-protocol.md` — Acceptance: at least 10 job seekers and 10 eligible employers, representative devices, five-second proposition, 30-second search/Post a Job tasks, first-attempt rules, timings, and 90% thresholds are defined.
- [ ] T077 Conduct the study and record `web/tests/usability/home/home-first-visit-results.md` — Acceptance: actual participant/aggregate SC-001–SC-003 evidence is recorded; missing/below-threshold results remain open and automated tests are not substituted.
- [ ] T078 [P] Record manual visual/accessibility review in `web/tests/usability/home/home-visual-review.md` — Acceptance: both locales at desktop/tablet/mobile/200% zoom cover typography, spacing, hierarchy, wrapping, contrast, focus, reduced motion, overlap, and horizontal scroll with unresolved defects open.
- [X] T079 Run `npm --prefix web run typecheck`, `npm --prefix web run lint:home`, and `npm --prefix web run test:home`, then update `spec-kit/specs/010-landing-home-page/release-validation.md` — Acceptance: exact date/command/scope/count/pass-fail is recorded, performance is not claimed, and failed/unexecuted checks remain open.
- [ ] T080 Run `npm --prefix web run test:home:e2e`, `npm --prefix web run lint`, `npm --prefix web run test -- --exclude "tests/performance/home/**"`, and `npm --prefix web run test:e2e`, then update `spec-kit/specs/010-landing-home-page/release-validation.md` — Acceptance: the targeted command records the Home viewer matrix, recommendation variants, company projection, filters/locale, destinations, recovery, save/logout, responsive keyboard, and privacy flows; the repository commands record full lint, non-Home-performance Vitest regression, and full default Playwright regression separately; logout audit evidence remains owned by T026; every exact command/date/scope/count/pass-fail is recorded without overstating coverage, and failed or unexecuted commands stay open.
- [X] T081 Reconcile `spec-kit/specs/010-landing-home-page/tasks.md` and `release-validation.md` — Acceptance: each checkbox closes only when source and named evidence exist; Feature remains In Progress and release-ready No while any P1, automated, performance, accessibility, privacy, responsive, or usability evidence is open.

---

## Dependencies and Execution Order

```text
Phase 1 Setup
  -> Phase 2 Shared Contract
       -> US1 Search
       -> US2 Session-aware Home and logout audit
       -> US3 Job recommendation and saves
       -> US4 Employers and career content
       -> US5 Localization, resilience, visuals, accessibility
            -> Phase 8 Release evidence
```

- T001 and T002 may run in parallel. T003 precedes T004; T005 follows T004;
  T006 precedes T007; T008 precedes T009; T010 precedes T011.
- After Phase 2, story test files may be authored independently. Shared-file
  implementation follows US1 -> US2 -> US3 -> US4 -> US5 to avoid conflicts.
- T026 tests the existing server logout route independently and may run in
  parallel with T025; US2 cannot close without its audit evidence.
- T057-T059 may run in parallel after T056/T007. T063-T065 may run in parallel
  after T062 and the corresponding components stabilize.
- T074 is separate from fast T079. T075 runs only through
  `test:home:performance`; T079 must not run performance tests.
- T072-T078 may begin after relevant interfaces stabilize. T079/T080 follow
  implementation; T081 is always last.

## Parallel Opportunities by User Story

| Story | Parallel work after prerequisites |
| --- | --- |
| US1 | T012, T014, T016, and T018 tests; T013 and T015 use separate files. |
| US2 | T020, T022, T024, T026, T027, and T029 tests; T023, T025, and T028 use separate components. |
| US3 | T032, T034, T037, T039, T041, and T043 tests; presentation/action files can follow their server contracts separately. |
| US4 | T045, T047, T049, T051, and T053 tests; curated work is independent from repository work. |
| US5 | T057-T059 localization groups, T063-T065 visual groups, and T066/T068-T070 tests use disjoint files after their shared prerequisites. |

## Independent Test Criteria Summary

| Story | Passing checkpoint |
| --- | --- |
| US1 | Visitor understands Smart Hire, retains six filters across locale, reaches Job Discovery with only allowlisted values, and recovers from no results. |
| US2 | All session states share section order while controls follow authority; logout behavior and `logout.succeeded` audit are proven. |
| US3 | Sufficient Candidate gets deterministic job recommendation; others get illustration/no card score; save is safe and recoverable. |
| US4 | Spotlight is active/verified/allowlisted and independent; unsupported claims are absent; career cards are display-only. |
| US5 | Both locales and keyboard journeys work at all target widths/200% zoom through dynamic and expired states without accessibility/layout failure. |

## Functional Requirement Traceability

| Requirement | Implementation task(s) | Verification/evidence task(s) |
| --- | --- | --- |
| FR-001 | T009, T011, T030 | T005, T008, T010, T031 |
| FR-002 | T023, T054, T057 | T022, T053, T068, T069, T070, T071 |
| FR-003 | T021, T023 | T020, T022, T029, T031 |
| FR-004 | T023, T025, T057 | T022, T024, T026, T031 |
| FR-005 | T028 | T027, T031 |
| FR-006 | T021, T025, T030 | T020, T024, T029, T031, T070 |
| FR-007 | T007, T017, T058 | T006, T016, T019, T071 |
| FR-008 | T004, T013, T017 | T003, T012, T019 |
| FR-009 | T013 | T012, T018, T019 |
| FR-010 | T013 | T012, T018, T019 |
| FR-011 | T015 | T014, T019, T071 |
| FR-012 | T017 | T018, T019 |
| FR-013 | T054 | T053, T055 |
| FR-014 | T040 | T039, T044, T053 |
| FR-015 | T017, T054 | T016, T019, T053 |
| FR-016 | T028 | T027, T031, T053 |
| FR-017 | T028, T054 | T020, T027, T031, T053 |
| FR-018 | T050, T052, T054 | T049, T051, T053, T055 |
| FR-019 | T054 | T053, T055 |
| FR-020 | T033, T035 | T005, T032, T034, T043, T044 |
| FR-021 | T036, T038 | T005, T034, T037, T043, T044 |
| FR-022 | T033 | T032, T043, T072 |
| FR-023 | T035, T038 | T034, T037, T044 |
| FR-024 | T035, T040 | T005, T034, T039, T043, T044 |
| FR-025 | T036, T040 | T034, T039, T043, T044 |
| FR-026 | T021, T035, T036 | T005, T020, T029, T034, T043, T044 |
| FR-027 | T046, T048 | T005, T045, T047, T055 |
| FR-028 | T046, T050 | T045, T049, T073 |
| FR-029 | T046, T048 | T045, T047, T049 |
| FR-030 | T046, T050 | T045, T047, T049 |
| FR-031 | T046, T048, T050 | T045, T047, T049, T073 |
| FR-032 | T048, T050 | T047, T049, T055, T070 |
| FR-033 | T007, T052, T059 | T006, T051, T071 |
| FR-034 | T007, T052, T059 | T006, T051, T071 |
| FR-035 | T040, T042, T058 | T039, T041, T044 |
| FR-036 | T007, T052, T059 | T006, T051, T071 |
| FR-037 | T007, T052, T059 | T006, T051, T071 |
| FR-038 | T017, T054, T059 | T016, T053, T055 |
| FR-039 | T007, T052 | T006, T051, T072 |
| FR-040 | T057, T058, T059 | T056, T060, T068, T071 |
| FR-041 | T007, T057, T058, T059 | T006, T056 |
| FR-042 | T057, T058, T059 | T056, T071 |
| FR-043 | T015, T057, T058, T059 | T014, T020, T034, T047, T071 |
| FR-044 | T004, T009, T048, T061 | T003, T005, T008, T047, T060, T070 |
| FR-045 | T061 | T060, T070 |
| FR-046 | T009, T048, T061 | T008, T047, T070 |
| FR-047 | T042, T061 | T041, T060, T070 |
| FR-048 | T025, T042 | T005, T024, T026, T041, T044 |
| FR-049 | T009, T021, T035, T046 | T005, T029, T043, T049, T073 |
| FR-050 | T062, T063, T064, T065 | T068, T069, T078 |
| FR-051 | T062, T063, T064, T065 | T069, T078 |
| FR-052 | T063, T064, T065 | T068, T069, T078 |
| FR-053 | T062, T063, T064, T065, T067 | T069, T078 |
| FR-054 | T062, T063, T064, T065, T067 | T066, T068, T069 |
| FR-055 | T062, T063, T064, T065, T067 | T066, T068, T069, T078 |
| FR-056 | T002 | T003, T006, T008, T010, T012, T014, T016, T018, T020, T022, T024, T026, T027, T029, T032, T034, T037, T039, T041, T043, T045, T047, T049, T051, T053, T056, T060, T066, T068, T069, T070, T071, T072, T073, T074, T075, T076, T077, T078, T079, T080 |
| FR-057 | T001, T021, T030 | T020, T029, T031, T034, T044, T070, T073 |
| FR-058 | T001, T013, T015, T023, T025, T028, T033, T035, T036, T040, T042, T046, T048, T050, T054, T061, T067 | T005, T012, T014, T022, T024, T026, T027, T032, T034, T037, T039, T041, T045, T049, T053, T060, T066, T068, T069, T070, T071, T073 |
| FR-059 | T002 | T079, T080 |
| FR-060 | T062, T063, T064, T065 | T075, T076, T077, T078 |
| FR-061 | T081 | T075, T077, T078, T079, T080, T081 |

## Success Criterion Traceability

| Criterion | Implementation/preparation task(s) | Verification/evidence task(s) |
| --- | --- | --- |
| SC-001 | T007, T017, T076 | T077 |
| SC-002 | T013, T017, T076 | T019, T077 |
| SC-003 | T028, T054, T076 | T031, T055, T077 |
| SC-004 | T074 | T075 |
| SC-005 | T013, T074 | T018, T075 |
| SC-006 | T021, T023, T028, T030 | T020, T022, T027, T029, T031, T073 |
| SC-007 | T033, T035, T036, T040 | T032, T034, T037, T039, T043, T044 |
| SC-008 | T046, T048, T050 | T045, T047, T049, T055, T073 |
| SC-009 | T013, T015 | T012, T014, T019, T071 |
| SC-010 | T017, T028, T040, T050, T052, T054 | T019, T027, T039, T049, T051, T053, T055 |
| SC-011 | T062, T063, T064, T065, T067 | T069, T078 |
| SC-012 | T057, T058, T059, T061, T062, T063, T064, T065, T067 | T066, T068, T069, T078 |
| SC-013 | T009, T048, T061 | T008, T047, T060, T070 |
| SC-014 | T081 | T075, T077, T078, T079, T080, T081 |

## Implementation Strategy

### Technical MVP checkpoint

1. Complete Setup and Foundation.
2. Complete US1 for the public search demonstration.
3. Complete US2 and US3 for the minimum session-aware recommendation MVP.
4. Do not call Feature 010 releasable until US4, US5, and Phase 8 pass; all five
   stories are P1.

### Completion discipline

- Write/confirm named failing tests before implementation.
- Reuse correct existing source; do not rewrite only because a task exists.
- Fast, E2E, performance, manual, and full-regression evidence remain separate.
- Keep every checkbox open until source and named evidence exist; T081 performs
  final reconciliation.
