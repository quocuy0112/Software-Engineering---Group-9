# Phase 0 Research: Recruiter Header Status and Layout

**Feature**: Recruiter Base Role — Group 1 Header Layout Change  
**Date**: 2026-08-11  
**Status**: Complete — all research questions resolved

## Decision 1: Use a derived four-state header projection

**Decision**: Introduce a read-only `RecruiterHeaderStatus` projection with `NEVER_APPLIED`, `PENDING_REVIEW`, `REJECTED`, and `APPROVED`. The projection is calculated from existing company memberships, company verification state, and the user's latest recruiter-verification request. No new persistent status field is added.

The deterministic precedence is:

1. An ACTIVE account membership in an ACTIVE verified company produces `APPROVED`.
2. Otherwise, the latest request in `PENDING_CHECKS`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, or `RESUBMITTED` produces `PENDING_REVIEW`.
3. Otherwise, the latest `REJECTED` request produces `REJECTED`.
4. No request, or a latest `CANCELLED`, `EXPIRED`, or stale `APPROVED` request without current active entitlement, produces `NEVER_APPLIED`.

**Rationale**: Current membership is the constitutional authority for recruiter access. The existing verification lifecycle has more states than the four header states, so a deterministic projection is necessary. A stale approved request must never substitute for a currently active membership.

**Alternatives considered**:

- Add a recruiter-role or header-status column to `UserAccount`: rejected because it duplicates authoritative membership/request state and would require synchronization and migration.
- Derive approval solely from the latest verification request: rejected because suspended or removed membership must not retain recruiter authority.
- Expose all verification lifecycle states in the header: rejected because the approved specification requires exactly four user-facing states.

## Decision 2: Enforce one exact Candidate-host predicate on every disclosure path

**Decision**: Keep the existing proxy as the first public-page host gate, then add one pure server-only Candidate-host predicate shared by the workspace layout and `GET /api/recruiter/header-status`. The predicate compares the normalized Host header with the host component of `configuredOrigins().candidate` and rejects missing or malformed values without reading session or status data. The layout maps rejection to a neutral not-found result before `getWorkspaceContext()`; the Route Handler maps it to 404 `UNAVAILABLE`. The accepted route returns only the derived state, safe destination kind/href, and observation timestamp with `Cache-Control: no-store`.

**Rationale**: FR-016 applies to both the initial server projection and every refresh. The proxy already protects public Candidate pages but deliberately passes `/api/**` through, so a shared defense-in-depth predicate prevents the initial layout and API route from drifting while preserving neutral failure before authentication or private reads. The purpose-specific route still avoids transferring the full employer-verification list.

**Alternatives considered**:

- Reuse `GET /api/employer-verifications`: rejected because it transfers excess lifecycle and company data and makes the header own list-to-state logic.
- Reuse `GET /api/recruiter/entitlement`: rejected because it is exact-host restricted to the recruiter origin and cannot distinguish never-applied, pending, and rejected states.
- Query the database directly from the client component: rejected because browser code cannot cross the server trust boundary.
- Permit the same status path on every product host: rejected because the projection belongs to the Candidate workspace and the current proxy deliberately passes `/api/**` paths through for route-level enforcement.
- Rely only on the proxy: rejected because API paths bypass it and FR-016 requires every disclosure path to be guarded explicitly.
- Duplicate host parsing in the layout and route: rejected because configuration or malformed-host behavior could diverge.

## Decision 3: Separate repository reads from the shared status service

**Decision**: Define a narrow `RecruiterHeaderStatusRepositoryPort`, implement it with `PrismaRecruiterHeaderStatusRepository`, and inject it into a server-only `RecruiterHeaderStatusService`. Only the Prisma repository imports the database client and performs the qualifying-membership and latest-request reads. The service owns deterministic four-state mapping and configured destinations. After the shared layout host predicate succeeds, `getWorkspaceContext()` uses the service to provide an initial confirmed projection when available; the guarded route uses the same service for later revalidation. Status failure is caught separately from authentication/profile loading so the Candidate workspace remains available with a disabled placeholder.

**Rationale**: A server-rendered initial state prevents avoidable action flicker. A shared service prevents status-mapping drift between initial render and later refreshes. A repository boundary satisfies the constitution's required separation between transport, business service, and data access while enabling fake-port unit tests. Isolating status failure preserves unrelated Candidate workflows.

**Alternatives considered**:

- Client-only fetch after every page load: rejected because it always shows a placeholder and causes avoidable layout/state delay.
- Server-prop only: rejected because persistent App Router layouts can retain stale status after an administrator decision.
- Duplicate mapping in workspace context and route handler: rejected because the two paths could disagree.
- Query Prisma directly inside the service: rejected because it couples business mapping to persistence and violates the required layered separation.

## Decision 4: Revalidate on visibility/focus and a bounded interval

**Decision**: Use the initial server projection, then revalidate while the tab is visible on mount, on window focus/visibility restoration, and every 30 seconds. During revalidation, the last confirmed label remains visible but is non-actionable; a failed revalidation replaces it with the specified disabled placeholder until a later successful retry.

**Rationale**: This lets administrator decisions appear while the header remains mounted without introducing real-time infrastructure. Disabling the action during verification prevents stale UI from initiating a misleading destination. The recruiter origin still performs authoritative membership checks.

**Alternatives considered**:

- WebSocket or server-sent events: rejected because the repository has no matching infrastructure and Group 1 does not justify a new long-lived channel.
- No background revalidation: rejected because the specification requires confirmed status changes to update while the header is visible.
- Aggressive polling: rejected because it adds unnecessary database load for a low-frequency state.

## Decision 5: Use `aria-disabled` for pending status

**Decision**: Render pending review as a focusable control with `aria-disabled="true"`, a visible focus indicator, and activation guards for pointer, touch, Enter, and Space. Do not use the native `disabled` attribute for this state because it would remove the control from the Tab order.

**Rationale**: This implements the accepted clarification that keyboard and assistive-technology users must encounter the status in the same order as the other actions while activation remains impossible.

**Alternatives considered**:

- Native disabled button: rejected because it is normally skipped by keyboard focus.
- Plain status text: rejected because the approved UI retains a consistent button position and control shape across states.
- Enabled link to a status page: rejected because the pending state was explicitly clarified as non-actionable.

## Decision 6: Preserve one mobile action row with contained overflow

**Decision**: At 760 px and below, keep `[theme] [profile with avatar/name/email] [recruiter action]` in one non-wrapping row. The action remains rightmost and its complete label stays on one line. When the combined intrinsic width exceeds the viewport or text is enlarged, only the action row becomes horizontally scrollable; the document never gains horizontal overflow.

**Rationale**: This exactly implements the accepted mobile clarifications while retaining readable text and minimum targets. Contained overflow is the only layout behavior that can simultaneously preserve the full profile, full one-line action label, and a narrow viewport.

**Alternatives considered**:

- Stack the recruiter action on another row: rejected by clarification.
- Wrap, truncate, or replace the label with an icon: rejected by clarification.
- Hide profile name/email: rejected by clarification.
- Allow page-level horizontal scrolling: rejected because it degrades the entire Candidate workspace.

## Decision 7: Reuse existing visual tokens and add no dependency

**Decision**: Implement the action and placeholder inside a small recruiter-header feature module, using existing SmartHire CSS tokens, theme variables, Next.js navigation, React state/effects, and Zod contracts. No component library, state library, or animation package is added.

**Rationale**: The existing Candidate workspace already owns the theme toggle, profile chip, responsive CSS, and design tokens. A bounded feature component keeps `WorkspaceShell` compositional without introducing another frontend system.

**Alternatives considered**:

- Add a new UI library: rejected because existing primitives and tokens cover the requirement.
- Put all status fetching and rendering directly in `WorkspaceShell`: rejected because it would combine authentication shell, status derivation, polling, accessibility, and action rendering in one component.

## Decision 8: No schema migration or business write

**Decision**: Group 1 adds no database table, column, migration, state transition, audit event, or notification. It reads existing authoritative records and navigates only to already defined high-level destinations.

**Rationale**: Application submission, administrator decisions, membership lifecycle, recruiter workspace switching, and job posting are explicitly outside Group 1. Read-only header projection is sufficient.

**Alternatives considered**:

- Persist header interaction or last-known status: rejected because it creates stale client/server state and has no product requirement.
- Add an audit event for viewing or clicking the header action: rejected because no privileged state change occurs in Group 1.

## Decision 9: Preserve complete profile identity and explicit loading semantics

**Decision**: Keep truncated name/email values in the profile link's accessible description and expose the complete values through a non-layout-shifting disclosure on pointer hover and keyboard focus. Render the loading/unavailable placeholder with `role="status"`, a polite checking-status announcement, no confirmed-state label, no destination, and no misleading action in the Tab order.

**Rationale**: Ellipsis must not hide identity information from keyboard or assistive-technology users, and a visual skeleton alone does not communicate why the rightmost action is unavailable. The disclosure and status text meet the approved specification without changing layout or adding another control.

**Alternatives considered**:

- Rely only on the visible truncated strings: rejected because the full values would be unavailable to some users.
- Use only the native `title` attribute: rejected because keyboard and screen-reader behavior is inconsistent.
- Announce one of the four labels while loading: rejected because it guesses an unconfirmed verification state.

## Decision 10: Require constitution-complete performance evidence

**Decision**: Add a dedicated recruiter-header measurement harness and threshold validator using the specification's fixed protocol: at least 100 accounts with 25 per state; exactly 20 page and refresh warm-ups; exactly 200 measured authenticated page loads and 200 measured refresh opportunities; 20 concurrent sessions; nearest-rank percentiles; and at most 0.5 percent unplanned errors. SC-002 starts with authenticated workspace navigation and ends on the first rendered frame with operable theme/profile controls plus a visible confirmed-action or safe-placeholder footprint. Every refresh sample moves from a confirmed state to a different result whose label or availability differs; the 200-sample matrix has exactly 50 results per state, 66 or 67 samples per interval/focus/visibility trigger, and 16 or 17 samples per trigger-result cell. SC-003 begins when the client accepts the eligible opportunity and ends on the first rendered frame with the expected label and availability. HTTP duration is recorded separately as a diagnostic. Machine-readable evidence also records environment, dataset/database state, method, duration, P50/P95/P99/max, and external conditions. Missing metadata, exact quotas, or protocol conditions fail validation.

**Rationale**: A bare API P95 does not prove the user-visible SC-003 outcome, and a bare P95 without a fixed workload is not reproducible evidence. The constitution requires the complete context, while the specification now fixes workload, timing boundaries, percentile calculation, and error policy. Existing SmartHire performance scripts provide a compatible machine-readable pattern without adding dependencies.

**Alternatives considered**:

- Record only P95 and sample count: rejected because it omits constitution-required context and outlier/error reporting.
- Rely on manual browser impressions: rejected because results are not repeatable or threshold-enforceable.
- Reuse job-board measurements unchanged: rejected because they do not exercise the authenticated header-status projection or its polling constraints.
- Treat the route response time as SC-003: rejected because the criterion ends only after the confirmed label and availability are visibly updated.
- Leave page-load start/end or refresh “balance” to each test run: rejected because incomparable boundaries and undefined sampling tolerances cannot support a release threshold.

## Decision 11: Reuse and document the complete Better Auth session lifecycle

**Decision**: Keep Better Auth as the single browser-session owner and consume it only through the existing `requireSession()` boundary. Session creation remains the existing email/password plus optional TOTP flow; the opaque token remains in the configured HttpOnly, SameSite=Lax, production-Secure cookie while the PostgreSQL `Session` row is authoritative. Existing policy enforces a sliding expiry just under seven days, a seven-day absolute limit, a 30-minute idle limit, account-state and recovery-operation checks, explicit logout/revocation, password-reset revocation of all sessions, password-change revocation of other sessions, and existing audit events. The recruiter-header route neither creates nor refreshes credentials.

**Rationale**: The constitution requires the active plan to identify creation, persistence, expiration, revocation, logout, password-reset revocation, and account-state enforcement. The repository already implements these controls and disables Better Auth cookie caching, so the read-only feature must reuse and document them rather than introduce any session mechanism.

**Alternatives considered**:

- Add a recruiter-header JWT or secondary session cookie: rejected because SmartHire permits exactly one browser-session mechanism.
- Read only a client-cached session: rejected because current account, expiry, revocation, and recovery state must be enforced server-side.
- Reimplement session checks in the status service: rejected because authentication integration belongs to the existing boundary and business mapping should remain provider-independent.

## Decision 12: Make navigation-lock recovery event-driven and retryable

**Decision**: Set the transient opening lock only after an enabled activation accepts the one destination supplied by the server-confirmed projection. Same-origin opening releases when the pathname settles, when opening throws, or when the initiating pathname remains active after a cancelled/no-op attempt. Cross-origin handoff uses the exact configured recruiter origin; successful unload discards component state, while synchronous failure, `pageshow` restoration, or focus/visibility return to the still-active document releases the lock. The adapter cannot select another destination, construct a recruiter route, choose a company/workspace, represent destination progress/errors, change authorization, or animate a transition. Tests use controlled adapters/events rather than real timing.

**Rationale**: Duplicate suppression must not strand a persistent workspace layout in a permanently disabled state, but Group 1 is limited to requesting the already approved high-level opening. Path and document lifecycle signals distinguish a successful handoff from a failed, cancelled, same-route, or back-forward-cache return without owning Group 2 destination behavior or adding persistent state.

**Alternatives considered**:

- Never release until component unmount: rejected because App Router layouts persist and same-route navigation may not unmount.
- Use only a fixed timeout: rejected because it can unlock during a slow valid navigation or keep a failed action unavailable unnecessarily.
- Persist navigation state in browser storage: rejected because it is unnecessary, stale across tabs, and forbidden for this feature state.
- Let the adapter choose routes or workspace state: rejected because destination selection, route construction, workspace selection, authorization, and transition behavior belong to Group 2.

## Decision 13: Use an eligibility-defined usability cohort

**Decision**: Run the final study with exactly 20 uncoached participants. Each participant must have used an online job-search or application service during the previous 12 months, be able to use the product language under test, have no implementation or review role for this feature, and have no prior exposure to the study materials. Include 10 primarily mobile and 10 primarily desktop/laptop job seekers and assign exactly five participants to each confirmed state. Retain only the eligibility result, device cohort, state assignment, elapsed time, answers, and pass/fail evidence needed for SC-011.

**Rationale**: Explicit eligibility, exclusion, device, and state-allocation rules make the 18-of-20 outcome reproducible while avoiding unnecessary personal-data collection.

**Alternatives considered**:

- Use any available internal staff: rejected because feature familiarity can invalidate the uncoached identification outcome.
- Call the cohort “representative” without eligibility rules: rejected because different studies could recruit materially different populations.
- Collect detailed demographics: rejected because they are unnecessary for this narrow status-identification outcome and would expand privacy exposure.
