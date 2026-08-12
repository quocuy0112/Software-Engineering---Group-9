# Implementation Plan: Recruiter Base Role — Header Layout Change

**Branch**: `007-job-posting-management` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Refined Group 1 specification with stable `FR-001` through `FR-036` and `SC-001` through `SC-011` at `spec-kit/specs/007-job-posting-management/spec.md`

## Summary

Add a recruiter-status action as the rightmost element of the authenticated Candidate workspace header while preserving the exact order `[theme toggle] [profile] [action]`. The action uses a new read-only four-state projection derived from existing recruiter-verification requests and active verified company memberships. A shared server host predicate protects both the initial workspace projection and the later revalidation route before session or status access; the existing proxy remains the first page-request defense. A Prisma query repository owns bounded persistence reads, an injected server-only service owns deterministic projection rules, and both disclosure paths reuse that service. A bounded frontend component owns polling, disabled/loading behavior, one approved high-level opening, duplicate suppression and recovery, accessibility, and responsive presentation. Existing employer-verification and recruiter-origin destinations are reused without implementing destination selection/content/progress, authorization changes, route construction, workspace-switch animation, or job-post creation.

No new dependency, database migration, persistent status, business write, worker, notification, or audit event is introduced.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`, React `19.2.3`

**Primary Dependencies**: Existing Next.js `16.3.0`, React `19.2.3`, Better Auth `1.6.25`, Zod `4.3.6`, Prisma and `@prisma/adapter-pg` `7.9.0`, PostgreSQL driver `8.16.3`, Tailwind CSS `4.1.18`, existing SmartHire CSS tokens/shadcn-compatible primitives, and Next.js navigation; no new package

**Storage**: Existing PostgreSQL `16.12` records are read only. `UserAccount`, `CompanyMembership`, `Company`, and `RecruiterVerificationRequest` remain authoritative. No migration or browser-persistent feature state.

**Testing**: Existing Vitest `4.1.10`, Testing Library `16.3.1`, Playwright `1.57.0`, axe-core `4.12.1`, contract tests, architecture tests, responsive browser tests, and existing admin/profile/job-board regressions

**Target Platform**: Authenticated Candidate workspace in the existing Next.js web application at port 3001; desktop, tablet, and responsive mobile down to 320 CSS px, plus 200% text zoom and light/dark themes

**Project Type**: Existing full-stack Next.js modular monolith

**Performance Goals**: Authenticated Candidate workspace navigation start through the first rendered frame with operable theme/profile controls and a visible confirmed-action or safe-placeholder footprint remains P95 `<=3s`; accepted interval/focus/visibility refresh through the first frame with the expected visible label and availability remains P95 `<=2s`; one interval refresh per visible tab at most every 30 seconds and no overlapping request. The fixed protocol uses at least 100 accounts with 25 per state; exactly 20 warm-ups and 200 measurements for page load and refresh; a 200-sample refresh matrix with exactly 50 results per state, 66 or 67 samples per trigger, and 16 or 17 samples per trigger-result cell; 20 concurrent Candidate sessions; nearest-rank P95; and at most 0.5 percent unplanned errors. Authorization, privacy, host-boundary, and state-correctness checks remain 100-percent gates.

**Constraints**: Exactly four confirmed header states; current active membership is the only approval authority; Better Auth remains the exclusive browser session; both the initial projection and later refresh are exact-Candidate-host only before session/status access; all status responses are no-store and identifier-free; pending remains focusable with no activation; the action may request only one approved high-level opening and must release its lock when the initiating view remains available; mobile keeps theme/profile/action on one row with full avatar/name/email and a one-line action label; truncated profile values remain available without layout change; only the action row may scroll horizontally; Group 1 must not implement application content, administrator decisions, destination selection/content/progress, authorization changes, route construction, workspace selection/switch animation, or job posting

**Scale/Scope**: One global header action across authenticated Candidate workspace pages; per projection, at most one qualifying-membership existence result and one latest verification request; four state variants, one placeholder variant, seven responsive/zoom validation widths, a validation population of at least 100 accounts, 20 concurrent measurement sessions, and no unbounded data collection

## Constitution Check

*GATE evaluated before Phase 0 and re-checked after Phase 1 design.*

| Principle | Plan evidence | Status |
|---|---|---|
| I. Human-Controlled Recruitment | Group 1 performs no recruitment decision, scoring, verification decision, or AI action. | Pass |
| II. Security, Privacy, Tenant Isolation | The existing proxy rejects non-Candidate page requests, and a shared server predicate rechecks the initial layout and later route before session/status access; the exclusive Better Auth cookie session is revalidated server-side; current account-scoped active verified membership is authoritative; no identifiers or private fields leave the trust boundary; no feature state enters persistent browser storage, analytics, or ordinary logs. | Pass |
| III. Deterministic Core and Explainable AI | Four-state mapping and precedence are deterministic; no AI is introduced. | Pass |
| IV. State, Audit, Data Integrity | The feature is read-only and adds no transition, migration, recruiter-header audit event, notification, or optimistic business mutation. Existing verification/membership workflows remain authoritative, and existing session-policy auditing remains intact. | Pass |
| V. Scope Discipline and Complete P0 Workflows | Plan is limited to layout, projection, state presentation, one approved high-level opening, duplicate recovery, responsive behavior, and verification. Destination selection/content/progress, authorization changes, route construction, and later workflow groups remain excluded. | Pass |
| VI. Measurable Quality and Accessible Experience | Exact breakpoints/spacing, contained overflow, focus order, focus-visible state, `aria-disabled` pending behavior, profile-value disclosure, loading announcement, opening recovery, contrast, keyboard/touch activation, exact page/render and refresh/render timing boundaries, a fixed trigger-result sampling matrix, an eligibility-defined 20-participant usability protocol, and automated accessibility checks are defined. | Pass |
| VII. Maintainable and Provider-Independent Architecture | Existing Next.js/TypeScript, Tailwind/shadcn-compatible baseline, Zod trust-boundary schemas, one App Router Route Handler, injected service, repository port/Prisma implementation, feature component, and CSS-token patterns are reused. Only the Prisma repository imports the database client; no provider, session mechanism, routing mechanism, or UI framework is added. | Pass |

No gate violation blocks research or design.

## Exclusive Browser Session Lifecycle

Better Auth `1.6.25` remains SmartHire's single server-controlled browser-session owner. This feature reads that session through the existing `requireSession()` boundary and creates no token, cookie, cache, or alternate browser credential.

- **Creation**: Email/password sign-in uses the existing Better Auth gateway with `rememberMe` enabled. Better Auth creates an opaque PostgreSQL-backed `Session` only for an ACTIVE account with no unfinished password-reset operation and no confirmed/completing full-account-recovery hold. Two-factor accounts complete the existing Better Auth TOTP challenge before receiving the ordinary session.
- **Cookie persistence**: The opaque token is stored only in the configured session cookie. Policy is `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, no cross-subdomain cookie, and no Better Auth cookie cache. The database session remains authoritative on every server validation.
- **Expiration and activity**: Better Auth sets a sliding expiry just under seven days with a 24-hour update age. SmartHire additionally enforces a hard seven-day `absoluteExpiresAt`, a 30-minute idle limit using `lastActivityAt`, a one-minute touch interval, and the existing per-account session cap.
- **Validation and account state**: `requireSession()` validates the opaque database session, revoked/ordinary/absolute/idle expiry, ACTIVE account state, and absence of blocking password-reset or full-account-recovery operations. Failure signs out the cookie, denies the status read, and records the existing session-policy audit event.
- **Revocation and logout**: User logout uses the existing same-origin and CSRF-protected sign-out route and records `logout.succeeded`. Owned-session revocation, administrator revocation, the LRU cap, account-state enforcement, and recovery enforcement reuse existing repository/gateway paths and existing audit behavior.
- **Password security**: Password reset revokes all sessions and invalidates challenges before finalization. Authenticated password change keeps the initiating authoritative session and revokes every other usable session. Full-account recovery also revokes sessions at its existing lifecycle milestones.
- **Feature boundary**: Both the initial workspace projection and `GET /api/recruiter/header-status` reach session validation only after the shared exact Candidate-host predicate passes. Neither path refreshes credentials, alters session lifecycle, persists status, or introduces a JWT/service-to-service authorization path. Existing session-policy audit behavior remains unchanged.

## Architecture and Data Flow

```text
Candidate workspace layout
  |
  | server request
  v
Existing proxy Candidate-host gate
  |
  v
Shared exact Candidate-host predicate
  |-- mismatch/malformed -> neutral 404; no session/status access
  `-- match
      v
getWorkspaceContext()
  |-- existing Better Auth session and safe profile projection
  `-- RecruiterHeaderStatusService.resolveForUser(userId)
         `-- RecruiterHeaderStatusRepositoryPort
                `-- PrismaRecruiterHeaderStatusRepository
                       |-- ACTIVE membership in ACTIVE verified company?
                       `-- otherwise latest applicant verification request
  |
  v
WorkspaceShell(initialRecruiterStatus)
  |
  `-- RecruiterHeaderAction
         |-- renders theme/profile/action order through WorkspaceShell
         |-- revalidates on visible 30-second interval and focus/visibility
         v
GET /api/recruiter/header-status
  |-- exact configured Candidate host
  |-- existing Better Auth session
  `-- same RecruiterHeaderStatusService
         `-- same injected repository boundary
                `-- strict RecruiterHeaderStatus response, Cache-Control: no-store
```

The initial path reaches `getWorkspaceContext()` only after the existing proxy and shared exact-host predicate accept the configured Candidate host. Host failure returns a neutral 404 before session or status access. After that guard, initial status remains best-effort: a status-read failure must not fail the Candidate layout, and a missing projection selects the disabled placeholder. Every later response is validated before it replaces UI state.

## Status Projection Design

The server applies this precedence:

| Source condition | Header state | Destination |
|---|---|---|
| ACTIVE membership in an ACTIVE verified company | `APPROVED` | Exact configured Recruiter origin |
| Latest request `PENDING_CHECKS`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, or `RESUBMITTED` | `PENDING_REVIEW` | None |
| Latest request `REJECTED` | `REJECTED` | `/dashboard/employer-verification` |
| No request, or latest `CANCELLED`, `EXPIRED`, or stale `APPROVED` without active entitlement | `NEVER_APPLIED` | `/dashboard/employer-verification` |

The active-membership check has precedence over request history. Latest request ordering is `createdAt DESC`, then `id DESC`. The service returns no source record or identifier. [data-model.md](./data-model.md) is authoritative for projection invariants.

## Server and Contract Design

### Candidate host boundary

Add `web/src/backend/auth/candidate-host-boundary.ts` as a pure server-only predicate that compares the normalized request Host header with the host component of the configured Candidate origin and returns false for a missing or malformed value. It reads no session and invokes no status dependency.

- The existing `web/src/proxy.ts` remains the first page-request gate and rejects non-Candidate or malformed public workspace hosts.
- `web/src/app/(workspace)/layout.tsx` calls the shared predicate and returns the neutral not-found outcome before `getWorkspaceContext()`; therefore no session, profile, or recruiter-status read begins on a rejected host.
- `web/src/app/api/recruiter/header-status/route.ts` calls the same predicate because API paths deliberately pass through the proxy, and maps rejection to the contract 404 `UNAVAILABLE`.
- Unit tests cover exact, case-normalized, missing, malformed, Admin, Recruiter, and unknown hosts. Architecture and browser tests prove the layout guard precedes context/session/status access and the API guard precedes every route dependency.

### Shared contract

Add `web/src/shared/contracts/recruiter-header-status.ts` with strict schemas and inferred types for:

- four-state `RecruiterHeaderState`;
- destination kind `NONE`, `EMPLOYER_VERIFICATION`, or `RECRUITER_WORKSPACE`;
- state/destination/href/observed-time response invariants;
- safe `UNAUTHORIZED`, wrong-host `UNAVAILABLE`, and `STATUS_UNAVAILABLE` failures.

### Query repository

Add `web/src/backend/recruiter-header/recruiter-header-status-repository.ts` with the narrow `RecruiterHeaderStatusRepositoryPort` consumed by the service, and add `web/src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts` as its Prisma implementation. The repository alone imports Prisma and performs:

- one account-scoped existence query for an ACTIVE membership in an ACTIVE verified company;
- one account-scoped latest-request query ordered by `createdAt DESC`, then `id DESC`;
- a minimal return projection containing only entitlement existence and the latest lifecycle state needed by business mapping.

The repository performs no write, returns no evidence or submitted business fields, and never exposes persistence identifiers beyond its data-access boundary. Integration tests exercise the Prisma implementation; service unit tests inject a fake port.

### Status service

Add `web/src/backend/recruiter-header/recruiter-header-status-service.ts` as a server-only service. It accepts a trusted user reference after session validation, receives a `RecruiterHeaderStatusRepositoryPort` through constructor injection, maps the repository result deterministically, and obtains the exact recruiter destination from existing configured origins. The service never imports Prisma or a route/presentation module.

The service does not depend on the frontend component, route transport, admin UI, or concrete database client. Unit tests use an injected fake repository; repository integration tests use the existing database-test boundary rather than browser state.

### Candidate route

Add `web/src/app/api/recruiter/header-status/route.ts`:

- GET only; no request body and no CSRF requirement for the read;
- calls the shared Candidate-host predicate before reading session or status data and returns a neutral 404 `UNAVAILABLE` on Admin, Recruiter, unknown, or malformed hosts;
- validates the existing Candidate session;
- invokes the shared service;
- validates the output schema;
- returns `Cache-Control: no-store` for success and every safe error;
- returns 401 for absent/invalid session and a neutral 503 `STATUS_UNAVAILABLE` for an unconfirmed read;
- never serializes user, company, membership, verification-request, role, evidence, or session identifiers.

The formal contract is [recruiter-header.openapi.yaml](./contracts/recruiter-header.openapi.yaml).

## Frontend Component Design

Add a bounded module under `web/src/frontend/features/recruiter-header/`:

- `components/recruiter-header-action.tsx`: state mapping, semantic control, label/icon, navigation lock, and placeholder.
- `client/use-recruiter-header-status.ts`: initial projection, validated fetch, focus/visibility refresh, 30-second visible polling, abort/stale-response protection, and failure transition.
- `client/use-recruiter-header-navigation.ts`: one-shot opening of only the server-approved destination, transient lock, pathname/document-lifecycle recovery, and an injectable boundary for deterministic failure/cancellation tests. It does not choose another destination, construct a recruiter route, select a company/workspace, represent destination progress, alter authorization, or animate a transition.

`WorkspaceShell` receives `initialRecruiterStatus` from the route-group layout and renders the action after the existing profile link. It remains responsible for overall header ordering; the feature component does not own theme/profile behavior.

When profile name or email is ellipsized, `WorkspaceShell` keeps both complete values in the profile link's accessible description and exposes a non-layout-shifting disclosure on pointer hover and keyboard focus. The disclosure is presentation-only, contains no extra action, and does not change the profile destination or visual order.

### State handling

- Known idle state: show exact label and destination.
- Revalidating: preserve label/dimensions and suppress activation.
- Loading/unavailable: reserved placeholder, no state label, announced status, no destination.
- Navigating: preserve label/dimensions and suppress duplicate activation after the one approved opening is accepted; release the lock on synchronous opening failure, a same-document result, a failed/cancelled attempt that leaves the initiating view active, or restoration through `pageshow`/focus/visibility so retry never requires reload. The hook observes only opening settlement and never owns destination selection/content/progress.
- Pending: focusable `aria-disabled` control with visible focus and activation guards; no native disabled removal from Tab order.

The header projection is presentation only. Employer Verification and Recruiter origin revalidate their own authorization and state.

The loading/unavailable placeholder uses `role="status"` with a polite announcement equivalent to `Checking recruiter status`; it exposes none of the four confirmed-state labels and is not added as a misleading action to the Tab order.

## Layout and Styling Design

Extend `web/src/frontend/styles/workspace.css` using existing tokens and breakpoint conventions.

### Desktop (`>=1024px`)

- `[theme] [profile] [action]`, centered on one row.
- 12 px gaps and 24 px right inset.
- Name/email independently ellipsize at 220 px.
- Search yields width before any action clips.

### Tablet (`761–1023px`)

- Same order with 8 px gaps and 16 px right inset.
- Theme icon-only; profile avatar/name; email hidden; name maximum 120 px.
- Full one-line action label.
- Search stays on its separate responsive row.

### Mobile (`<=760px`)

- A full-width non-wrapping action row contains theme, profile with 48 px avatar plus visible name/email, then the rightmost action.
- Name/email are separate ellipsized lines; the action label remains complete on exactly one line.
- The group uses 8 px gaps and 16 px side padding.
- When intrinsic width does not fit, the action row alone uses accessible horizontal overflow. Root layout and search never overflow horizontally.
- Existing `<=479px` rules that hide profile email are narrowed/overridden for this header because the clarification explicitly retains mobile email.

CSS state selectors cover default, hover, active, focus-visible, revalidating, navigating, pending/disabled, and placeholder states in both themes. Stable `data-recruiter-state` values support semantic tests without asserting raw colors. The full UI rules are in [header-layout-contract.md](./contracts/header-layout-contract.md).

## Reliability, Security, and Privacy

- Both initial and refreshed status paths reject a missing, malformed, Admin, Recruiter, or unknown host before session, profile, service, or repository access; wrong-host workspace pages and API requests return neutral 404 outcomes.
- A status read cannot take down the Candidate workspace; the action degrades to the disabled placeholder.
- Only one request is in flight; unmount and superseded refreshes are aborted/ignored.
- Hidden tabs stop interval refreshes and refresh immediately when visible.
- A failed or invalid refresh clears actionable state until a later confirmed response.
- The one approved same-origin opening releases its lock when the pathname settles or remains unchanged after a failed/cancelled attempt; the approved external handoff releases on synchronous failure or return to the still-active document, while successful unload discards component state. No destination selection, route construction, destination progress/error UI, authorization change, or transition animation is introduced.
- No status is persisted in localStorage, sessionStorage, Zustand, analytics, or ordinary logs.
- Exact recruiter origin comes from server configuration, never from client input.
- Current session/account and recruiter-origin membership authorization remain server-enforced.
- The UI never grants authority and no header click commits business state.

## Requirement Coverage

| Requirement IDs | Design coverage | Verification artifact |
|---|---|---|
| `FR-001`-`FR-002`, `FR-015`, `FR-025`-`FR-033` | Workspace composition, responsive layout, theme/profile preservation, complete-value disclosure, and contained overflow | `header-layout-contract.md`, component/accessibility/browser tests |
| `FR-003`-`FR-007`, `FR-034` | Account-scoped repository reads and deterministic four-state service mapping with entitlement precedence | `data-model.md`, service unit and repository integration tests |
| `FR-008`-`FR-011`, `FR-020`, `FR-024` | Exact label/destination mapping, pending non-action, destination reauthorization, and activation parity | Shared contract, action component tests, end-to-end state matrix |
| `FR-012`-`FR-014`, `FR-022`-`FR-023` | Placeholder, visible-only revalidation, single-flight reads, transient busy states, and navigation recovery | Status/navigation hook tests and live-revalidation quickstart |
| `FR-016`-`FR-019` | Existing proxy plus shared exact-host predicate for initial and refresh paths, existing session validation, identifier-free schemas, no-store outcomes, and privacy canaries | Host-predicate unit tests, layout/route ordering tests, OpenAPI/runtime contract, and privacy tests |
| `FR-021`, `FR-025`-`FR-033` | Minimum targets, focus/non-color cues, responsive values, one-line labels, and search isolation | Axe, keyboard, responsive browser, and 200-percent zoom checks |
| `FR-035`-`FR-036` | Read-only repository boundary and explicit Group 1 exclusions | Architecture/scope tests and release boundary evidence |
| `SC-001`-`SC-011` | Four-state correctness; fixed 100-account, 200-sample, 20-concurrent page and end-to-end refresh protocols with explicit rendered-frame boundaries and trigger-result quotas; privacy, resilience, accessibility, regression; and eligibility-defined 20-participant usability evidence | Phase 7 release gates, machine-readable performance evidence, `usability-validation.md`, and `quickstart.md` |

Every task generated from this plan must name at least one requirement or success-criterion range, including repository, host-boundary, profile-disclosure, and navigation-recovery work.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/007-job-posting-management/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- release-validation.md
|-- usability-validation.md
`-- contracts/
    |-- recruiter-header.openapi.yaml
    `-- header-layout-contract.md
```

### Source Code (repository root)

```text
web/
|-- package.json
|-- src/
|   |-- app/
|   |   |-- (workspace)/layout.tsx
|   |   `-- api/recruiter/header-status/route.ts
|   |-- backend/
|   |   |-- auth/candidate-host-boundary.ts
|   |   |-- auth/get-workspace-context.ts
|   |   |-- recruiter-header/
|   |   |   |-- recruiter-header-status-repository.ts
|   |   |   `-- recruiter-header-status-service.ts
|   |   `-- repositories/recruiter-header/prisma-recruiter-header-status-repository.ts
|   |-- shared/contracts/recruiter-header-status.ts
|   `-- frontend/
|       |-- features/
|       |   |-- dashboard/components/workspace-shell.tsx
|       |   `-- recruiter-header/
|       |       |-- client/use-recruiter-header-status.ts
|       |       |-- client/use-recruiter-header-navigation.ts
|       |       `-- components/recruiter-header-action.tsx
|       `-- styles/workspace.css
`-- tests/
    |-- helpers/recruiter-header-fixture.ts
    |-- shared/unit/contracts/recruiter-header-status.test.ts
    |-- backend/
    |   |-- unit/auth/candidate-host-boundary.test.ts
    |   |-- unit/recruiter-header/status-service.test.ts
    |   |-- contract/recruiter-header/header-status.contract.test.ts
    |   |-- integration/recruiter-header/initial-host-boundary.test.ts
    |   |-- integration/recruiter-header/session-boundary.test.ts
    |   `-- integration/recruiter-header/status-projection.test.ts
    |-- frontend/
    |   |-- components/dashboard/workspace-shell-recruiter-header.test.tsx
    |   |-- components/recruiter-header/recruiter-header-action.test.tsx
    |   |-- components/recruiter-header/recruiter-header-navigation-hook.test.tsx
    |   |-- components/recruiter-header/recruiter-header-status-hook.test.tsx
    |   `-- accessibility/recruiter-header/recruiter-header-action.accessibility.test.tsx
    |-- architecture/recruiter-header-boundaries.test.ts
    |-- performance/recruiter-header/release-thresholds.test.ts
    |-- security/recruiter-header/recruiter-header-privacy.test.ts
    `-- system/e2e/recruiter-header/header-layout.spec.ts
web/scripts/measure-recruiter-header-performance.mjs
```

**Structure Decision**: Extend the existing `web/` modular monolith. Add one pure server host predicate shared by the layout and route, keep Prisma reads in a dedicated repository implementation, deterministic mapping in an injected server-only service, the trust-boundary schema under shared contracts, and the UI in a dedicated recruiter-header feature module. Modify the existing proxy/layout/shell/styles only at their boundary or composition points. The fixture, session/host tests, and release/usability evidence paths are explicit planning artifacts. No Prisma schema or migration file changes.

## Verification Strategy

### Unit and integration

- Table-driven service tests cover active-membership precedence and every existing verification lifecycle state, including stale approved request without current entitlement.
- Deterministic tie tests cover `createdAt` plus `id` latest-request ordering.
- Repository integration tests prove account scoping, ACTIVE company/membership qualification, suspended/removed membership denial, minimal returned fields, deterministic ordering, and zero writes.
- Unit tests inject a fake repository and prove the service contains mapping rules but no Prisma dependency.
- Failure tests prove status-query failure does not fail the Candidate workspace projection.

### Contract and security

- Zod/OpenAPI parity covers success and safe error shapes.
- Host-boundary unit tests cover exact, normalized-case, missing, malformed, Admin, Recruiter, and unknown Host values without touching session or status dependencies.
- Layout integration/architecture tests prove the shared host predicate and neutral not-found outcome occur before `getWorkspaceContext()`, while browser checks prove the existing proxy rejects wrong-host public workspace requests.
- Endpoint tests cover exact Candidate-host acceptance, neutral 404 `UNAVAILABLE` on Admin/Recruiter/unknown/malformed hosts before session, service, or repository access, authenticated/unauthenticated reads, no-store headers on every outcome, invalid output failure, and exact destination allowlists.
- Privacy canaries assert that no identifier or submitted business field appears in response, DOM, URL parameters, persistent browser storage, analytics, or ordinary logs.
- Architecture tests prevent frontend imports of Prisma/server modules, prevent the status service from importing Prisma or presentation code, and confine Prisma access to the repository implementation.

### Component and accessibility

- All four state labels, tones, destinations, and loading/unavailable behavior.
- Pending control remains in Tab order, receives focus-visible style, announces disabled, and ignores click/tap/Enter/Space.
- Enabled controls accept pointer/touch/Enter/Space, suppress duplicates during navigation, and recover for retry after synchronous failure, cancelled/no-op navigation, unchanged-path return, or bfcache restoration.
- Revalidation tests cover initial status, preserved label while busy, successful change, failed/invalid response, abort, stale response, visibility/focus, interval, and no overlapping requests.
- Loading/unavailable tests assert `role="status"`, a polite checking-status announcement, no confirmed-state label, no destination, and no misleading action in the Tab order.
- Profile tests prove a truncated full name and email are available through the profile link's accessible description and a non-layout-shifting hover/focus disclosure.
- Axe reports zero serious/critical issues; status is not color-only.

### Responsive and regression

- Browser checks at 1440, 1024, 1023, 761, 760, 479, and 320 CSS px plus 200% text zoom.
- Exact element order, gaps, right insets, profile visibility/truncation, full one-line labels, contained row overflow, and absence of document overflow.
- Search remains usable and separate; theme switching and profile navigation remain unchanged.
- Existing admin-management, profile-account, and job-board suites remain green.

### Performance

- Use at least 100 authenticated Candidate accounts with at least 25 per confirmed state, covering every mapped lifecycle, no-request/stale/tied histories, active/inactive and multi-company entitlement cases, long profile values, and missing avatars.
- In one fixed release-equivalent environment, run exactly 20 page warm-ups followed by exactly 200 measured authenticated page loads at 20 concurrent sessions. Start at authenticated workspace navigation start and stop on the first animation frame where theme and profile controls are visible and operable and the recruiter-action footprint is visible as either a confirmed action or the safe checking placeholder.
- Run exactly 20 refresh warm-ups followed by exactly 200 measured refresh opportunities at 20 concurrent sessions. Every sample changes from a confirmed starting state to a different result whose label or availability differs; allocate exactly 50 samples to each result state, 66 or 67 to each interval/focus/visibility trigger, and 16 or 17 to every trigger-result-state cell.
- Measure SC-003 end to end: begin when the client accepts the eligible refresh opportunity and end on the first animation frame where the expected confirmed label and action availability are visible. Record the underlying HTTP duration separately as a diagnostic, not as the SC-003 result.
- Calculate P95 by nearest-rank over the complete sample. Record environment, dataset/database state, method, warm-up, sample size, duration, concurrency, P50/P95/P99/max, unplanned error count/rate, and external conditions in machine-readable output.
- Fail validation when metadata or sample requirements are absent, page-load P95 exceeds 3 seconds, end-to-end refresh P95 exceeds 2 seconds, unplanned errors exceed 0.5 percent, or visible polling exceeds one interval read per 30 seconds or overlaps requests. Authorization, privacy, host-boundary, and state correctness remain 100-percent gates.
- Verify visible tabs issue at most one interval read per 30 seconds and never overlap reads.

### Usability

- Conduct the study only after the final responsive and accessibility presentation is complete.
- Use exactly 20 uncoached eligible participants: each used an online job-search or application service in the previous 12 months, can use the product language under test, did not implement or review this feature, and has not seen the study materials. Include 10 primarily mobile and 10 primarily desktop/laptop job seekers, with exactly five assigned to each confirmed state.
- Begin timing when the complete header becomes visible and count success only when the participant correctly states both recruiter status and action availability within five seconds.
- Retain eligibility evidence without unnecessary personal data, device cohort, state assignment, raw elapsed time, both answers, pass/fail, aggregate count, and study conditions in `usability-validation.md`; SC-011 passes at 18 of 20 or better.

## Rollout and Recovery

1. Ship and test the shared exact-Candidate-host predicate, keeping the proxy as the first page gate and applying the predicate before both layout context and route dependencies.
2. Ship the strict shared contract, repository port/Prisma query repository, injected server status service, and exact-Candidate-host read-only route.
3. Add unit/contract/integration coverage before exposing the action.
4. Pass initial status through workspace context with failure isolation only after the layout host predicate succeeds.
5. Add the feature component and layout/CSS changes behind the existing authenticated workspace boundary.
6. Run responsive, accessibility, privacy, fixed performance/usability, and regression gates.
7. Roll back by removing the component, shared host predicate integration, route, projection service/contract, and CSS/tests. No database or data recovery action is required.

## Post-Design Constitution Re-check

Phase 1 remains compliant. The design documents and reuses the complete exclusive Better Auth session lifecycle and existing audit behavior, keeps membership authority server-side, protects both initial and refreshed disclosures with the existing proxy plus a shared host predicate before session/status access, separates the Route Handler, injected service, repository port, and Prisma repository implementation, exposes a minimal no-store projection with all three safe error codes, adds no AI or business write, limits Group 1 to one approved high-level opening with retry recovery, preserves Candidate workflows during status failure, uses the approved Next.js/TypeScript/Tailwind/shadcn-compatible baseline, and requires the fixed constitution-complete performance and usability protocols plus measurable accessibility, responsive, privacy, and regression verification. All gates remain **Pass**.

## Complexity Tracking

No constitutional violation requires justification. The pure shared host predicate, repository port/Prisma query repository, injected service, GET route, shared schema, and focused UI component are bounded layers needed to preserve disclosure ordering and separation, prevent host/status-logic drift, and avoid stale persistent-layout behavior; they add no new application, provider, database, or session mechanism.
