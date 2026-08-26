# Research: Smart Hire Home/Landing Page

## Shared route and server composition

**Decision**: Keep `/` as Home and retain `/home` only as its existing redirect.
Compose one safe Home presentation for every viewer state.

**Rationale**: One server-resolved composition avoids duplicated guest/auth
layouts and prevents a guest/private-data flash.

**Alternatives considered**: Separate guest/auth routes and client-only session
composition were rejected because they duplicate structure or expose stale
presentation risk.

## Better Auth session lifecycle

**Decision**: Reuse Better Auth 1.6.25 as the only browser-session owner and
resolve Home identity once through the existing `requireSession()` server
boundary. Existing login/two-factor services create database-backed sessions;
the Prisma adapter persists them in PostgreSQL; the configured opaque cookie is
HttpOnly, SameSite=Lax, Path=/, and Secure according to the production
environment. Home creates and stores no credential.

The existing policy rejects missing/revoked/provider-expired sessions, the
seven-day absolute limit, thirty-minute inactivity, inactive accounts, and
blocking password-reset/account-recovery operations. Logout stays on
`POST /api/identity/logout`, validates origin and CSRF proof, delegates sign-out
to Better Auth, and records `logout.succeeded`; policy rejection records
`session.revoked`. Home turns an invalid session into the Guest model and clears
private client presentation after an expired protected action.

**Rationale**: This satisfies the exclusive-session, server-validation,
cookie-security, revocation, and authentication-audit requirements without
duplicating identity behavior inside a landing page.

**Alternatives considered**: Client-decoded roles, localStorage/sessionStorage,
a Home session cookie, direct database token handling, and Home-owned revocation
were rejected as security and scope violations.

## Jobs, saves, and company projections

**Decision**: Reuse existing job discovery for bounded Trending Opportunities
and the existing saved-job boundary for saves. Obtain Employer Spotlight through
a separate explicit safe public company projection from existing authorized
data. Include each optional employer claim only when its authoritative source
supplies that exact publishable field.

The projection is an internal read-only repository, not a route or API. It
selects active verified companies and only `slug`, `displayName`, `logoUrl`,
`publicDescription`, `publicLocation`, `industry`, and `size`. The current
schema has no culture, mentoring, internship-friendly, or company-wide hybrid
field, so those claims are omitted. A position count is legal only when produced
by a complete filtered relation count using the public Job Discovery publication
rules; otherwise it is omitted. Cards remain display-only.

**Rationale**: Six Home job cards are neither a complete open-position count nor
an authoritative source for culture, mentoring, internship suitability, or
workplace claims. Independent projections prevent inferred or fabricated data.

**Alternatives considered**: Counting or inspecting Trending cards for
spotlights, creating Home-specific endpoints, and adding Home persistence were
rejected.

## Smart Match source

**Decision**: Use a genuine existing deterministic/profile-backed result only
for an authenticated candidate with sufficient existing profile signals and a
valid result. Guests, employers, and candidates without a usable result receive
clearly labelled illustrative content. Illustrative scores never appear on job
cards.

This result is a candidate-facing **job-fit recommendation** used to rank public
jobs for the current candidate. It is not employer-facing applicant screening,
does not rank applicants, and does not participate in hiring decisions. The
constitutional 40/60 deterministic-plus-AI formula remains authoritative for the
separate applicant-screening capability and is not changed or invoked here.

Refactor the existing internal `candidateProfileSignals` and ranking logic in
`job-discovery-service.ts` into a reusable internal Jobs helper that continues to
call the existing `computeMatchScore`; do not duplicate or change the formula.
A profile is sufficient only when it is not marked empty and has at least one
job-relevant signal: a skill, an experience record, or a location. Score the
bounded public Home candidates, use the highest valid result as the section
example, explain matching skills through normalized intersection, and list at
most three missing advertised skills as improvement areas. Any failed or missing
input uses the labelled illustration and suppresses all card scores.

**Rationale**: This preserves the existing matching authority, prevents
candidate-specific information from entering employer presentation, and keeps
all scores truthful and explainable.

**Alternatives considered**: A Home-owned scoring or recommendation engine,
Home match persistence, fabricated fallback personal scores, and employer access
to candidate-specific match data were rejected.

## Employer CTA

**Decision**: Reuse existing recruiter status for Post a Job state and
destination.

**Rationale**: Existing status resolves never-applied, pending, rejected, and
approved cases without Home inferring membership or constructing a workspace
URL.

**Alternatives considered**: Fixed recruiter URLs and Home-owned eligibility
logic were rejected as authorization duplication.

## Search controls

**Decision**: The final Home form supports exactly keyword, location, work
arrangement, employment type, experience level, and skills. It validates only
existing job-discovery values and preserves all values through language changes.

Construct a fresh `URLSearchParams` using only `q`, `location`,
`workArrangement`, `employmentType`, `experienceLevel`, and `skills`. Validate
with the existing Job Discovery Zod schemas; encode array selections as repeated
keys. Never copy unknown current query keys. Locale and the complete search draft
live in the same provider so a language change cannot remount or clear inputs.

**Rationale**: One explicit allowlist prevents session, role, score, and
presentation data from leaking into discovery queries.

**Alternatives considered**: Forwarding arbitrary URL parameters or keeping a
smaller UI while claiming broader filter support were rejected.

## Curated content, destinations, and locale

**Decision**: Feed, paths, growth content, events, and Employer Spotlight cards
are display-only in Feature 010. Career Community, Companies, and Events header
navigation uses matching Home anchors. Every Home-authored visible and assistive
string lives in one typed Vietnamese/English catalog.

**Rationale**: No confirmed existing public detail destinations exist for these
cards. Display-only presentation avoids broken links and keeps CMS, social, and
event workflows out of scope. A central catalog prevents partial localization.

**Alternatives considered**: Inventing detail routes, adding CMS/event/social
interfaces, translating underlying records, and component-local hard-coded text
were rejected.

## Performance and recovery

**Decision**: Keep initial content server-composed, bound job/company work, and
hydrate only required interactions. Dynamic failures remain section-local.
Recovery is source-scoped where available; otherwise it is explicitly labelled
as a full Home reload.

Resolve the session once and isolate public-job, public-company,
recruiter-status, and candidate-profile reads with `Promise.allSettled` or an
equivalent result boundary. A profile failure changes Smart Match to illustrative
without failing Jobs. Since Feature 010 adds no refresh endpoint, any recovery
that performs `router.refresh()` is labelled Reload Home rather than Retry.

**Rationale**: Bounded work and honest recovery labels support the measured
three-second usable hero while keeping unrelated primary actions available.
