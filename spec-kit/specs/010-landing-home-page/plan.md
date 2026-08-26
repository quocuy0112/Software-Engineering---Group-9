# Implementation Plan: Smart Hire Home/Landing Page

**Branch**: `010-landing-home-page` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Amended Home/Landing Page specification at
`spec-kit/specs/010-landing-home-page/spec.md`.

## Summary

Feature 010 uses one shared `/` Home composition for guests and authenticated
users. Public opportunity and career-community content keeps the same order;
only account actions, authorized shortcuts, Post a Job state, save behavior, and
personal-versus-illustrative Smart Match vary by server-resolved session state.

The implementation reuses the existing Next.js App Router, Better Auth cookie
session, Job Discovery and Saved Job services, recruiter-header status boundary,
candidate profile data, and `vi`/`en` locale pattern. It adds no API, database
migration, recommendation engine, CMS, social interaction, payment, chat, or
recruitment-management workflow.

**Planning baseline**: Feature status remains **In Progress**. `tasks.md` is the
only task-status ledger; the regenerated task list starts unchecked and this plan
does not assert a completed/open count. A task closes only after its source
change, acceptance criteria, and required evidence exist. Release readiness
remains blocked until `release-validation.md` records all required automated and
manual evidence actually produced.

## Technical Context

**Language/Version**: Node.js 24.18.x; TypeScript 5.9.3; React 19.2.3; Next.js
16.3.0 App Router.

**Primary Dependencies**: Existing Better Auth 1.6.25, Prisma 7.9.0, PostgreSQL
driver 8.16.3, Zod 4.3.6, Tailwind CSS 4.1.18, Sonner 2.0.7, and Next.js server
components/`Link`. No new runtime dependency.

**Storage**: Existing PostgreSQL 16 remains authoritative for accounts,
database-backed Better Auth sessions, profiles, jobs, companies, saved jobs, and
memberships. Curated feed, growth, and event content is versioned TypeScript
display data and is not persisted.

**Testing**: Vitest 4.1.10, Testing Library 16.3.1, Playwright 1.57.0,
axe-core 4.12.1, existing architecture/privacy suites, and existing performance
harness patterns.

**Target Platform**: Responsive public/candidate web route on the existing
Linux-hosted Next.js process (development port 3001; existing HTTPS proxy in
production).

**Project Type**: Existing full-stack Next.js modular monolith: server-rendered
landing page with narrowly scoped interactive client components.

**Performance Goals**: Usable header and hero P95 <=3 seconds; Home search
handoff and results availability P95 <=2 seconds; documented error rate below
1%. Measure at least 100 samples with 10 concurrent visitors against at least
1,000 active public jobs in current Chrome desktop (1366x768) and mobile
(390x844) viewports. Optional section failures never block header, hero, search,
or logout.

**Constraints**: One shared layout; server-enforced session/authorization; no
browser-persisted credentials; explicit safe public projections only; personal
Smart Match only for sufficient-profile candidates; guest/employer/insufficient
states illustrative; one centralized Home text catalog; exactly six approved
search controls; locale switching preserves search values; no new endpoint,
engine, persistence, or migration.

**Scale/Scope**: One `/` route (legacy `/home` redirect retained), 11 required
sections, at most 3 feed cards, up to 6 trending jobs and employer spotlights,
and guest/candidate/employer presentation states.

## Constitution Check

*GATE: Passed before research and re-checked after design.*

| Gate | Design evidence | Status |
| --- | --- | --- |
| I. Human-controlled recruitment | Smart Match is labelled an estimate with strengths, gaps, and limitations; it makes no hiring decision. | Pass |
| II. Security, privacy, tenant isolation | Server context emits only safe public/viewer projections; existing save, session, and recruiter boundaries stay authoritative. | Pass |
| III. Deterministic core and explainability | Home reuses the existing deterministic candidate-facing job-recommendation match. It is not employer-facing applicant screening and therefore does not replace or modify the constitution-governed 40/60 screening formula. | Pass |
| IV. State, audit, data integrity | Home owns no persistence; existing Saved Job and Better Auth/session services own state. Logout continues through the audited existing identity route and client failures reconcile visibly. | Pass |
| V. Scope discipline/P0 completeness | Work is limited to Home composition/navigation; workflows and platforms outside Home are excluded. | Pass |
| VI. Measurable quality/accessibility | P95, resilience, keyboard, focus, contrast, reduced motion, and responsive evidence are explicit release gates. | Pass |
| VII. Maintainable/provider-independent architecture | Existing service/repository contracts and session owner are reused; curated data is isolated from providers. | Pass |

No constitutional conflict blocks this plan.

## Architecture Overview

### Shared server composition

`web/src/app/page.tsx` remains the sole Home entry and calls an expanded
`getHomePageContext()`. The returned `HomePageModel` contains a server-derived
`viewer` discriminant (`guest`, `candidate`, or `employer`) and independently
stateful sections. `HomePageView` always renders one identical section order.
The client never derives role or authorization from URL/local state.

```text
app/page.tsx
  -> getHomePageContext()
       -> existing session boundary             resolve once
       -> JobDiscoveryService                    bounded public jobs
       -> reusable existing match helper         candidate only
       -> HomePublicCompanyRepository            safe read-only projection
       -> existing recruiter-header status       Post a Job authority
  -> HomePageView
       -> HomeHeader + AccountActions + PersonalShortcuts
       -> HeroSearch + session-aware CTAs
       -> What's New Today
       -> Smart Match
       -> Career Paths
       -> Employer Spotlight
       -> Trending Opportunities
       -> Career Growth Hub
       -> Career Events
       -> Final CTA
       -> Footer
```

Resolve the session once, then isolate public-job, public-company,
recruiter-status, and candidate-profile reads with `Promise.allSettled` or an
equivalent result boundary. Jobs/company failures become their own section
states. A profile/match failure changes only Smart Match to illustrative and
removes job-card scores. Header, hero, search, logout, and unrelated content do
not depend on either dynamic section succeeding.

### Session-aware presentation matrix

| UI | Guest | Authenticated candidate | Approved employer context |
| --- | --- | --- | --- |
| Account area | Log in and Sign up | Safe avatar/name fallback and Log out | Same safe account controls |
| Shortcuts | None | `/dashboard`, `/jobs/applied`, `/jobs/saved` | `/dashboard`; Post a Job is a separate action |
| Create Profile | `/register` with safe profile intent | `/profile` | `/profile` |
| Post a Job | Existing authentication/eligibility handoff | Existing not-applied/pending/rejected behavior | Only the destination resolved by recruiter status |
| Save job | Safe login handoff preserving job detail | Existing saved-job command | Existing saved-job command |
| Smart Match | Labelled illustration; no card score | Personal only when profile/result is valid, otherwise illustration | Labelled illustration; no candidate information/card score |

The existing recruiter-header status remains authoritative. Non-approved
signed-in users retain candidate presentation and its current eligibility state.
Home never guesses a company, membership, grant, workspace, or posting URL.

### Existing Better Auth session lifecycle

Better Auth 1.6.25 is the single browser-session owner. Feature 010 does not
create a second session mechanism, store session credentials in client state, or
change identity routes.

| Lifecycle step | Existing authoritative behavior reused by Home |
| --- | --- |
| Creation | Existing login and two-factor services call `BetterAuthSessionGateway`, which delegates to Better Auth. Better Auth creates a `Session` row only for an active account with no blocking password-reset or account-recovery operation; `SessionService.enforceCreated()` applies the existing concurrent-session cap and audit behavior. Home never creates a session. |
| Persistence | The Prisma adapter stores opaque session records in PostgreSQL. The browser receives only the configured session cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when the production environment requires it. Better Auth cookie caching is disabled, and Home never copies the token into React state, browser storage, URLs, or rendered output. |
| Validation and expiration | `getHomePageContext()` calls existing `requireSession()` once. That boundary validates the Better Auth session and the database policy: revoked/missing rows, provider expiry, seven-day absolute expiry, thirty-minute inactivity, inactive accounts, and blocking reset/recovery operations resolve as no session. Activity is touched through the existing policy interval. Home then renders the Guest model. |
| Revocation and logout | User logout stays on existing `POST /api/identity/logout`, including same-origin and CSRF proof validation. The Better Auth gateway signs out, clears the provider cookie, and `SessionService.recordLogout()` records `logout.succeeded`. Policy-invalid sessions are signed out and record `session.revoked`; existing password reset, recovery, and session-management flows retain their own revocation authority. |
| Home failure behavior | If initial validation fails, Home emits no private viewer fields. If a protected Home action reports expiry, client presentation clears private state and requests a safe server refresh; it does not manufacture or locally revoke a session. A logout failure retains the authenticated presentation and exposes localized recovery feedback. |

### Candidate-facing job recommendation reuse

Refactor the existing `candidateProfileSignals`, `computeMatchScore`, and
deterministic ranking path from Job Discovery into a reusable internal Jobs
helper. Do not duplicate or alter the formula, create an endpoint, or persist a
score.

This Home Smart Match is a **candidate-facing job-fit recommendation**: it ranks
public jobs for the current candidate's own discovery experience. It is not an
employer-facing applicant/candidate screening score, does not rank candidates
for a recruiter, and does not participate in application decisions. The
constitution's 40% deterministic plus 60% AI formula and score bands govern the
separate applicant-screening capability and are neither invoked nor changed by
Feature 010. If screening output is ever added to Home, that would be a separate
scope change and must use the constitutional screening contract.

A profile is sufficient only when the current authenticated candidate profile
is not empty and contains at least one job-relevant signal: a skill, an
experience entry, or a location. The helper scores the bounded Home jobs, keeps
the highest valid result for the section example, derives matching skills by
normalized intersection, and lists at most three missing advertised skills as
improvement areas. If profile, jobs, or computation are unavailable, use fixed
labelled illustrative content and omit every job-card score. All scores are
estimates/recommendations, never hiring decisions.

### Safe Employer Spotlight projection

Add an internal read-only `HomePublicCompanyRepository` over current Prisma data;
this is not a route or API. It selects only active verified companies and the
public fields `slug`, `displayName`, `logoUrl`, `publicDescription`,
`publicLocation`, `industry`, and `size`.

Call `publicDescription` a public company summary, not verified culture. The
current schema has no authoritative culture, mentoring, internship-friendly, or
company-wide hybrid fields, so those claims are omitted. An open-position count
may appear only if computed as a complete filtered relation count using the same
active, approved, published, non-expired rules as public Job Discovery;
otherwise omit it. Never derive any spotlight field from the six Trending jobs.
Spotlight cards are display-only because no existing public company detail route
is confirmed in scope.

### Search, destinations, and localization

The final Hero UI contains exactly keyword, location, work arrangement,
employment type, experience level, and skills. A fresh `URLSearchParams` is
built from only `q`, `location`, `workArrangement`, `employmentType`,
`experienceLevel`, and `skills`, validated with the existing Job Discovery Zod
schemas. Array selections use repeated keys. Arbitrary current URL parameters
are never copied, preventing session, role, score, locale, or mock data handoff.

| Trigger | Destination/behavior |
| --- | --- |
| Explore Jobs / Hero submit | `/jobs` with only the six validated criteria |
| Job card | `/jobs/[slug]` |
| Guest save | `/login?returnTo=/jobs/[slug]` |
| Authenticated save | Existing saved-job mutation with pending/success/failure feedback |
| Guest Create Profile | `/register` with safe profile intent |
| Authenticated Create Profile | `/profile` |
| Candidate shortcuts | `/dashboard`, `/jobs/applied`, `/jobs/saved` |
| Post a Job | Existing recruiter-status-resolved destination only |
| Career Community / Companies / Events | `#community`, `#employer-spotlight`, `#events` |
| Feed/path/growth/event/spotlight cards | Display-only, not links |

`home-copy.ts` is the single typed Vietnamese/English source for every
Home-authored visible and assistive string. `home-display-data.ts` references
catalog keys for curated display-only records; components contain no literal
user-facing copy. The locale provider owns both locale and the six-field search
draft above the selector, so changing language cannot remount or clear values.
Underlying job/company records remain outside Home translation scope.

### Responsive, state, accessibility, and performance behavior

| Viewport | Required layout |
| --- | --- |
| Desktop (`>=1024px`) | Full navigation, horizontal/wrapping search cluster, 2-3 column grids, aligned account actions. |
| Tablet (`768-1023px`) | Two-column/reduced grids, wrapped search, accessible compact secondary navigation where needed. |
| Mobile (`<768px`) | Single column, focus-managed menu, stacked full-width search/CTAs, no horizontal scrolling. |

- Loading skeletons preserve section geometry and are shown only during a real
  refresh/deferred read, not simulated on an already server-resolved page.
- Empty and error states are localized and section-specific. If no scoped retry
  exists, `router.refresh()` is labelled **Reload Home**, never **Retry**.
- Save/logout `401` handling clears private client presentation and performs a
  safe server refresh. Expired state cannot retain identity, shortcuts, saved
  state, personal match, or membership.
- Use semantic landmarks, one H1, ordered headings, meaningful accessible names,
  visible focus, non-color state labels, avatar/image alternatives, live regions
  only for meaningful feedback, and reduced-motion-compatible transitions.
- Consolidate Home styling around the existing font and design variables. Define
  one typography scale and normalized spacing, grid gaps, control heights, line
  heights, radii, and shadows. Verify desktop/tablet/mobile and 200% zoom for no
  overlap, clipped focus, or horizontal scroll.
- Server-render the hero and curated content, bound dynamic lists, avoid client
  fetch waterfalls, reserve media dimensions, and keep interactive islands
  limited to locale/search, menu/account/logout, recovery, and save actions.

## MVP vs Future Enhancements

| MVP | Explicitly deferred |
| --- | --- |
| Shared Home; session-aware account controls and shortcuts; public Job/Company projection; display-only feed/growth/event content; existing save and deterministic profile match; bilingual Home copy; existing CTA routes | CMS; event registration; likes/comments/shares; personalized social feed; real-time chat; new recommendation service; job-post workflow; employer administration; AI CV parsing; video interviews; pipeline management; payments/orders; full social network |

## Project Structure

### Documentation

```text
spec-kit/specs/010-landing-home-page/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- release-validation.md
|-- contracts/home-page-contract.md
`-- tasks.md
```

### Source code

```text
web/
|-- src/app/
|   |-- page.tsx
|   `-- home/page.tsx                         # legacy redirect
|-- src/backend/
|   |-- services/home/get-home-page-context.ts
|   |-- services/jobs/                        # reuse extracted match helper
|   |-- repositories/home/                    # safe company projection
|   `-- recruiter-header/                     # existing Post a Job authority
|-- src/frontend/features/home/
|   |-- components/
|   |-- client/
|   |-- home-page-model.ts
|   |-- home-copy.ts
|   |-- home-display-data.ts
|   `-- home-search-config.ts
|-- src/frontend/styles/home.css
`-- tests/{architecture,backend,frontend,security,system,performance}/home/
```

**Structure decision**: Keep the existing modular monolith. Presentation stays
in `frontend/features/home`, composition in `backend/services/home`, public
company access behind a repository, and auth/jobs/recruiter operations behind
their established boundaries. No new application, worker, or API surface is
warranted.

## Implementation Phases and Verification

1. **Foundation**: typed Home model, centralized catalog, safe company
   repository, reusable existing match helper, and independently failing server
   composition. Unit, integration, and privacy tests are acceptance work.
2. **P1 journeys**: six-field search; shared session-aware header; account,
   logout, shortcuts, recruiter CTA; Trending Jobs; Smart Match; saved-job
   adapter. Complete guest, candidate, employer, expired-session, security,
   component, keyboard, and E2E coverage before closing tasks.
3. **Public content and visual system**: display-only community/employer/growth/
   event cards, consistent visual tokens, responsive layouts, honest recovery,
   accessibility, and scope-boundary tests.
4. **Release gate**: run typecheck, focused Home lint/tests, applicable E2E and
   accessibility suites, then performance and moderated usability protocols.
   Record only actual output in `release-validation.md`; leave unexecuted,
   failed, or blocked checks open.

## Post-Design Constitution Re-check

The design retains Better Auth as the sole cookie/database session owner and
documents its creation, persistence, validation, expiry, revocation, logout, and
audit behavior. It projects only allowlisted public/company data, never grants
employer access through Home UI, treats Smart Match solely as deterministic
candidate-facing job recommendation rather than applicant screening, and keeps
locale/curated content inside presentation boundaries. All gates remain
**Pass**.

## Complexity Tracking

No constitutional violation or unjustified complexity is introduced.
