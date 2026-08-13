# Implementation Plan: Platform Administration and Employer Verification

**Branch**: `006-admin-management` | **Date**: 2026-08-10 | **Spec**:
[spec.md](./spec.md)

**Input**: Approved Feature 006 specification at
`spec-kit/specs/006-admin-management/spec.md`; fixed frontend decision:
React Admin for `console.admin.localhost:3001`.

## Summary

Feature 006 adds a separately authorized Platform Administrator console for
dashboard operations, account/session enforcement, employer verification,
company-membership enforcement, moderation reports, notification-delivery
follow-up, and the limited recruiter-origin entitlement handoff. The console is
a client-only React Admin 5 application embedded in the existing Next.js 16 App
Router deployment. React Admin supplies read-oriented resources, lists, forms,
routing, and MUI primitives; every security-sensitive action uses a custom,
pessimistic workflow over explicit server commands rather than generic CRUD.

The existing Better Auth opaque-cookie session remains the only browser-session
mechanism. PostgreSQL remains authoritative for grants, designated administrator
sessions, two-factor proof time, account/membership/request/report states,
idempotency, audit, notification work, dashboard snapshots, and retention
deadlines. A dedicated admin worker handles safety processing and deadlines.
React Admin's authorization hooks control presentation only; each Next.js Route
Handler revalidates account, grant, designated session, step-up, target state,
and tenant relationship before returning any protected projection or committing
any command.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`, React `19.2.3`

**Primary Dependencies**: Existing Next.js `16.3.0`, Better Auth `1.6.25`, Zod
`4.3.6`, Prisma and `@prisma/adapter-pg` `7.9.0`, PostgreSQL driver `8.16.3`,
TanStack Query `5.101.4`, `pdfjs-dist` `6.2.108`, Sharp `0.35.3`, ClamAV `1.4`,
existing email/storage adapters; add React Admin `5.15.1` and lock its compatible
MUI/Emotion/React Router peers in `package-lock.json`

**Storage**: PostgreSQL `16.12` is the single relational authority. Business
evidence uses a new purpose-specific private encrypted storage namespace
(private local filesystem in development; private S3 with SSE-KMS plus
application encryption in production). No public or reusable document URL is
created.

**Testing**: Existing Vitest `4.1.10`, Testing Library `16.3.1`, Playwright
`1.57.0`, axe-core `4.12.1`, Prisma migration/integration tests, OpenAPI/Zod
contract parity, worker fake-clock tests, privacy canaries, and performance
harnesses

**Target Platform**: Data-dense desktop administration console on the existing
Linux-hosted Next.js process at port 3001 behind an exact-host reverse proxy;
local origins are `console.admin.localhost:3001` and
`console.recruiter.localhost:3001`; production requires explicit HTTPS origins

**Project Type**: Existing full-stack Next.js modular monolith plus the existing
worker-process pattern; React Admin is an isolated client-side console shell, not
a new backend application

**Performance Goals**: SC-002 P95 `<=2s` for dashboard snapshots and independently
calculated filtered lists over at least 10,000 accounts, 1,000 companies, 5,000
memberships, and 1,000 open review items with 10 active administrators and error
rate `<1%`; account/session enforcement and administrator-session replacement
take effect within 2 seconds; document and workflow deadlines remain hard
requirements from SC-004, SC-007, SC-015, SC-016, and SC-018

**Constraints**: No second browser session; no client-persistent sensitive data;
server authorization on every read/write; at most one designated administrator
session per grant; 15-minute sensitive-action proof; periodic dashboard snapshot
age `<=60s`; all enforcement commands pessimistic and concurrency checked;
evidence never public; exact retention/deletion and notification retry schedules;
no Recruiter Manager UI

**Scale/Scope**: Seven user stories, 62 Functional Requirements, 18 Success
Criteria, six primary admin resource groups, 25-row default/100-row maximum
lists, 100 concurrent clean verification documents in the qualification run,
and the representative dataset/concurrency profile from SC-002

## Constitution Check

_Gate evaluated before research and re-checked after design._

| Gate                                                | Design evidence                                                                                                                                                                                                                                                | Status |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Human-controlled recruitment                     | Administrators make all verification, moderation, and enforcement decisions; a report never changes recruitment state and no AI decision is introduced.                                                                                                        | Pass   |
| II. Security, privacy, tenant isolation             | Better Auth remains exclusive; authorization is server-side; company membership is company-scoped; evidence/rationales use private purpose-specific retention; React Admin uses memory-only state and no telemetry.                                            | Pass   |
| III. Deterministic core and explainable AI          | Feature 006 adds no AI. All state transitions, counts, priorities, quotas, and decisions are deterministic and versioned.                                                                                                                                      | Pass   |
| IV. State, audit, data integrity                    | PostgreSQL transactions bind critical state, audit, and notification work; version checks/idempotency prevent conflicts; append-only histories preserve outcomes.                                                                                              | Pass   |
| V. Scope discipline/P0 completeness                 | The plan covers administration and the recruiter entitlement boundary only; company-team creation, Recruiter Manager, deletion, export, and full job moderation remain excluded.                                                                               | Pass   |
| VI. Measurable quality/accessibility                | P95, hard deadlines, keyboard completion, focus, non-color labels, axe, screen-reader, privacy, and concurrency qualification are explicit.                                                                                                                    | Pass   |
| VII. Maintainable/provider-independent architecture | The primary application remains Next.js/TypeScript with its Tailwind/shadcn baseline; React Admin/MUI is an isolated admin-console presentation adapter, does not replace shared product UI or business boundaries, and external providers remain replaceable. | Pass   |

No constitutional violation blocks planning.

## Architecture Overview

### Runtime topology

```text
Exact Admin Origin                         Exact Recruiter Origin
console.admin.*                            console.recruiter.*
       |                                           |
       | client-only React Admin SPA               | limited entitlement page
       | authProvider + typed dataProvider          | (no Recruiter Manager)
       v                                           v
Next.js 16 Proxy: exact host routing only; never an authorization authority
       |
       +--> /api/admin/** Route Handlers
       |       -> AdminRequestBoundary
       |       -> domain services/state machines
       |       -> Prisma repositories ------------> PostgreSQL 16
       |       -> private evidence adapter --------> encrypted private storage
       |
       +--> /api/recruiter/entitlement
       |       -> current account/membership checks -> PostgreSQL 16
       |
       `--> existing Better Auth routes/services ---> Better Auth Session rows

admin-worker
  |-- dashboard snapshot refresh (every 30 seconds)
  |-- business-evidence scan/preview pipeline
  |-- request delay/expiry transitions
  |-- security notification retry/dead-letter
  `-- rationale/evidence retention cleanup
```

`web/src/proxy.ts` rejects unknown hosts and rewrites the exact Administrator and
Recruiter origins to internal route groups. This is routing defense in depth
only. Every page bootstrap and API operation independently executes the
server-side request boundary.

### React Admin application boundary

The console follows the official client-only Next.js integration: an App Router
page dynamically loads the React Admin shell with server rendering disabled.
`<Admin requireAuth disableTelemetry store={memoryStore()}>` receives a custom
layout, error page, login/two-factor pages, auth provider, data provider, and
security-configured QueryClient. No guesser, generic catch-all CRUD provider,
bulk delete, export, editable grid, optimistic mutation, or undoable mutation is
enabled.

**Constitutional UI decision**: React Admin/MUI is limited to the isolated
administration-console subtree because React Admin requires its own component
primitives. The repository's primary Next.js/TypeScript application and
Tailwind/shadcn design baseline remain authoritative for shared navigation,
Candidate pages, recruiter-entitlement pages, typography, tokens, and all
non-admin product UI. MUI global resets and theme leakage are contained inside
the admin mount; no shared business component is rewritten around MUI. An
architecture test enforces this boundary. This additive adapter interpretation
satisfies Principle VII without treating MUI as a replacement primary frontend.

Registered resources preserve domain identity:

| React Admin resource    | Domain meaning                                                  | Exposed operations                                                                                          |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `administrator-grants`  | Platform Administrator Grant, separate from user and membership | Hidden/read-only reference for current authority and safe account projection; no list/create/edit/delete UI |
| `accounts`              | User Account with base Candidate identity                       | Allowlisted list; custom account/security detail route; no edit/delete                                      |
| `candidate-identities`  | Existing base Candidate identity                                | Hidden/read-only relation proving Candidate identity; no profile content                                    |
| `companies`             | Legal company keyed by normalized tax identifier                | Read-only safe relation/list context used by verification and membership screens                            |
| `company-memberships`   | One user × one company × one approved company role              | Filtered list/show plus custom suspend/restore/remove commands; never a global recruiter record             |
| `verification-requests` | Recruiter Verification Request and safe history                 | List plus custom review detail/actions; no generic edit                                                     |
| `moderation-reports`    | Unified job/company/recruiter/Candidate moderation report       | List plus custom assignment/note/terminal-decision workflow                                                 |
| `login-sessions`        | Existing Better Auth Login Session safe projection              | Nested under account security; no global list or CRUD                                                       |
| `notification-work`     | Security-delivery state                                         | Nested read-only status in account/action details                                                           |
| `audit-events`          | Allowlisted administration audit projection                     | Correlation-specific read-only detail; no general activity-history feature                                  |

Relations use stable opaque references (`accountId`, `companyId`,
`membershipId`, `requestId`, `reportId`) but the list and detail response shapes
are deliberately separate custom methods where FR-014/FR-015/FR-027/FR-053
require different field allowlists. React Admin never receives a flattened
`recruiter` object or a document storage locator.

The read contract includes a safe `companies.getList`,
`company-memberships.getList`, and `company-memberships.getOne`. Company rows
contain only opaque company reference and public display name for authorized
filter contexts. Membership reads are company-scoped projections; lifecycle
changes remain separate commands.

### Authentication and authorization integration

The auth provider is an adapter, not a trust boundary:

1. `login` calls the existing password-login service on the admin origin. The
   response either sets the existing Better Auth HttpOnly session cookie or
   continues the existing pre-auth two-factor challenge.
2. Completing TOTP/backup-code verification creates no new token. In one
   transaction, the server verifies ACTIVE account/grant, designates the current
   Better Auth Session, records `lastTwoFactorProofAt`, and revokes the formerly
   designated Session. Candidate-only Sessions not previously designated remain
   unchanged.
3. `checkAuth` calls `/api/admin/auth/context` with credentials included and
   `cache: no-store`. The endpoint validates current account, grant, session,
   designation, and initial factor state. A route-level `AdminAuthorityGate`
   hides cached content until this check completes on every React Admin
   navigation.
4. Sensitive custom commands call `/api/admin/auth/step-up` when the server
   returns `STEP_UP_REQUIRED`. Success updates proof time for the same designated
   session; failure/abandonment sends no business command.
5. `checkError` maps expired/revoked/non-designated/denied responses to a full
   in-memory purge before redirect. `logout` invokes the existing Better Auth
   logout and performs the same purge.
6. `canAccess` may hide buttons/routes using current server-derived availability,
   but every Route Handler repeats full authorization and target checks. A forged
   direct call cannot rely on React Admin state, hostname, or hidden navigation.

Exact configured origins are added to Better Auth trusted origins and to the
server environment validator. Browser credentials remain HttpOnly, Secure in
production, SameSite=Lax, and host-only. No token, factor proof, CSRF proof,
permission set, or session reference is written to localStorage/sessionStorage.

### Data provider and server command strategy

The SmartHire provider implements allowlisted `getList`/`getOne` projections and
custom typed methods. Every call uses same-origin `fetch`, credentials, strict
JSON validation, no-store response handling, AbortSignal for reads, and a safe
error envelope. Mutations also send the existing session-bound CSRF proof, an
in-memory idempotency key, and `expectedVersion`/`If-Match` value.

Custom command families are:

- `getDashboardSnapshot`, `getCurrentDrilldown`;
- `getAccountSecurity`, `revokeSession`, `revokeAllSessions`, `suspendAccount`,
  `reinstateAccount`, `getPrivilegedRationale`;
- `getVerificationReview`, `openEvidence`, `downloadEvidence`,
  `requestVerificationChanges`, `rejectVerification`, `approveVerification`;
- `suspendMembership`, `restoreMembership`, `removeMembership`;
- `getModerationReport`, `assignReport`, `addReportNote`, `resolveReport`,
  `dismissReport`, `linkEnforcement`.

No server catch-all maps React Admin resource names to unrestricted repository
methods. Route Handlers parse explicit contracts and call one service command.
All privileged commands use pessimistic UI behavior: disable duplicate submit,
wait for commit, then invalidate/refetch affected queries. A `409`/`412` returns
only the latest authorized safe projection and a stable conflict code; the UI
announces the conflict and requires refresh/reconfirmation.

### Dashboard design

FR-010–FR-012 already settle the snapshot policy: a displayed snapshot may be
at most 60 seconds old. The plan therefore does not introduce a new TTL.

- The admin worker calculates a snapshot every 30 seconds and stores immutable
  metrics with `snapshotId`, `calculatedAt`, `expiresAt`, metric unit, canonical
  filter key, and `stateDefinitionVersion`.
- The endpoint refuses to display a snapshot older than 60 seconds. The custom
  dashboard shows an explicit unavailable/recalculating state rather than an old
  number, and polls every 30 seconds only while visible.
- Snapshot generation and each live drill-down import the same server-side
  versioned metric-definition module. The browser never reconstructs totals.
- A card navigation stores the originating snapshot ID/count only in memory.
  Every account, verification, membership, and moderation target list runs a
  current query and MUST return its own `calculatedAt` plus the required
  `stateDefinitionVersion`. Each corresponding repository imports the same
  `DashboardDefinition`; the UI rejects a missing/mismatched definition version
  and shows the required source-change notice whenever the current total differs.
- Database indexes and aggregate queries are qualified against SC-002's full
  dataset and concurrency profile. React Admin client caching is not counted as
  dashboard computation performance.

### Account, session, and membership commands

Accounts and memberships are read-oriented React Admin resources. Enforcement
buttons open a custom `SensitiveActionDialog` with exact reason category,
FR-048-normalized 10–500-character rationale, target/company summary, current
state version, explicit confirmation, and step-up state. Session rows contain
only the FR-015/Key Entity allowlist. The service executes invariants and writes
state, audit, and rationale transactionally. Account suspension, reinstatement,
and all-session revocation also create exactly one SecurityNotificationWork in
that transaction. Single-session revocation creates no FR-022 security
notification, as fixed by FR-058.

`PrivilegedActionRationale` stores application-encrypted text separately from
the audit event, linked only by correlation reference. Reads require a new
server authorization and fresh proof. Cleanup makes it inaccessible at exactly
365 days and physically deletes ciphertext within 24 hours. Notification payloads
never contain the rationale.

### Employer verification and protected evidence

Candidate submission remains a normal Candidate workflow, not a React Admin
create screen. It writes a PENDING_CHECKS request and quarantined evidence. The
admin worker performs malware, detected-type, structural, and preview-safety
checks in the request's immutable 24-hour safety deadline and applies the exact
15-minute/24-hour/72-hour/30-day transitions and notifications.

The React Admin verification list is standard read scaffolding with custom
filters/order. Review is a custom Show route because it joins current facts,
company/membership matches, invitation/OWNER prerequisite state, versioned
evidence, submission history, decision history, and outage state.

Verification assignment is nullable read-only workload metadata in Feature 006.
The queue supports the FR-029 assignment filter, including `UNASSIGNED`, but this
feature exposes no assignment mutation because no acceptance requirement defines
one. A future workload-routing feature may populate the field through its own
authorized contract without changing verification decisions.

`ProtectedEvidenceViewer` calls a same-origin byte-stream endpoint after fresh
step-up. The server revalidates the request and evidence state before every open
or download. PDF bytes render from an in-memory ArrayBuffer through the existing
PDF.js package; safe image previews use revocable in-memory blob URLs. Responses
are `no-store`; storage locators and reusable capabilities never reach the
browser. Viewer failure disables decision controls immediately and exposes only
the operational state required by FR-028.

Approval/change/reject buttons use custom pessimistic commands. New-company
approval establishes Company + OWNER membership + request outcome + audit +
one applicant Notification Work row in the existing `EmailOutbox` in one
transaction. Request-changes and rejection likewise commit request state,
decision history, audit, and exactly one applicant `EmailOutbox` row together.
Existing-company approval locks and consumes the exact valid invitation or
fulfills the exact request-specific active OWNER approval in that same
transaction. Applicant submission/resubmission receipt, applicant cancellation,
and worker-driven delay/expiry transitions each create exactly one idempotent
applicant `EmailOutbox` row in the transaction that accepts the lifecycle event.
The `CompanyRelationshipPrerequisiteGateway` has no bypass path.

The existing email worker dispatches these FR-037 applicant outbox rows through
the provider-independent email boundary. They do not use
`SecurityNotificationWork`, do not inherit FR-022's administrator-visible
manual-intervention projection, and cannot roll back their originating state
after commit. Event-specific idempotency keys prevent duplicate work during
request retries, concurrent decisions, worker lease recovery, or deadline
reconciliation.

### Moderation design

Existing Job Reports are migrated into the generalized `ModerationReport`
authority without changing their references or terminal meaning. Candidate,
company, and recruiter submissions use explicit target and qualifying
relationship references. Submission authorization, normalization, dedupe, and
rolling quota occur server-side before insertion; a report never invokes an
enforcement service.

The React Admin queue uses a standard `List`/`DataTable` shell and the exact
priority/order contract. The detail and actions are custom. Assignment,
investigation note, RESOLVED, DISMISSED, and enforcement linkage use versioned,
pessimistic commands. Terminal reports have no reopen command. The report API
projects reporter/investigation data only after current Platform Administrator
authorization.

Moderation-only assignment, note, resolution, dismissal, and enforcement-link
records do not create NotificationWork and never notify the report target.
Separately confirmed account or membership enforcement uses the underlying
account/membership command transaction and its FR-022 notification; linking the
result does not create a duplicate notification.

### Accessibility and UX design

React Admin and MUI provide accessible primitives, but they do not by themselves
prove FR-007/SC-014. The following are mandatory custom verification points:

- the custom Layout includes a skip link, unique page heading, landmark labels,
  visible focus theme, and route-change focus management;
- each status/priority/delivery state uses visible text and an icon where useful,
  never color alone;
- custom DataTable action cells have explicit accessible names and correct tab
  behavior; row click is never the only route to detail;
- sensitive dialogs label title/description/errors, trap then restore focus,
  expose character counts, and never submit on accidental Enter;
- loading, empty, success, validation, stale conflict, background refresh, and
  failure states use live regions without replacing focused controls;
- document preview has labelled page navigation, zoom controls, page count,
  download alternative, loading/failure text, and focus restoration;
- step-up preserves the pending action locally only until proof succeeds or is
  abandoned; failed proof announces the error and commits nothing;
- axe must report zero serious/critical issues, while keyboard and screen-reader
  tests prove full tasks rather than component-level assumptions.

### Background work, storage, and audit

`admin-worker` claims durable PostgreSQL work with leases and controlled clocks.
It owns no authorization decision; services persist authorized work first.
Worker responsibilities are isolated by purpose and idempotency key:

- refresh dashboard snapshots every 30 seconds;
- scan and produce safe previews for business evidence;
- apply request delay/expiry and viewer-outage milestones once;
- enqueue exactly one existing `EmailOutbox` row with each accepted verification
  receipt, cancellation, administrator decision, delay, or expiry lifecycle
  event; the existing email worker owns later applicant delivery;
- dispatch security notifications on the exact five-attempt schedule and mark
  permanent/exhausted work `MANUAL_INTERVENTION_REQUIRED` by 24 hours;
- delete expired rationales and evidence within their hard deadlines;
- reconcile abandoned work without recreating access or changing terminal state.

Audit uses the existing append-only `AuditEvent` with expanded allowlisted action
codes. It stores actor, target, result, time, correlation, safe reason category,
and version/outcome only—never rationale, document content/locator, report text,
full address, session credential, or factor data.

## Requirement-to-Implementation Traceability Table

| FR ID  | React Admin approach                                                                                                                                                                                                                                                            | Standard CRUD or Custom Component                    | Notes/Flags                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| FR-001 | Register separate `administrator-grants`, `accounts`, `candidate-identities`, and `company-memberships` domain resources backed by separate models/projections.                                                                                                                 | Server model + read-only resource registration       | React Admin resource names do not merge roles.                                            |
| FR-002 | Expose no grant create/edit/delete provider method or UI; grant provisioning and revocation are audited out-of-band terminal commands.                                                                                                                                          | Server-only invariant                                | Client-supplied roles are rejected by all schemas.                                        |
| FR-003 | Exact-host `proxy.ts` routing plus startup origin validation and per-route host enforcement.                                                                                                                                                                                    | Custom host boundary                                 | Unknown host returns no admin shell/payload.                                              |
| FR-004 | `authProvider` login/checkAuth/checkError/logout adapters; admin two-factor page; `AdminAuthorityGate`; `SensitiveActionDialog` step-up.                                                                                                                                        | Custom authentication components                     | Better Auth remains exclusive; server enforces 15-minute proof.                           |
| FR-005 | Every provider method calls an explicit route whose request boundary derives actor/session and checks authority before projection/service use.                                                                                                                                  | Server-only authorization                            | React Admin `canAccess` is display-only.                                                  |
| FR-006 | Auth boundary returns empty non-enumerating denial envelopes and clears memory on denied/expired/revoked/cross-origin errors.                                                                                                                                                   | Custom error/auth handling                           | No counts, existence, documents, reports, or audit payload on denial.                     |
| FR-007 | Custom React Admin Layout/theme, accessible navigation, focus management, labels, non-color statuses, desktop density.                                                                                                                                                          | Custom component                                     | Defaults are foundations, not automatic compliance.                                       |
| FR-008 | `checkAuth`/server authority on next request; denied privileged attempts and grant changes write allowlisted audit events.                                                                                                                                                      | Server-only + authority gate                         | No client permission cache is authoritative.                                              |
| FR-009 | Account action service rejects self-suspension and any action leaving no usable administrator; UI also disables with explanation.                                                                                                                                               | Custom action + server invariant                     | Server lock/check is authoritative under concurrency.                                     |
| FR-010 | `AdminDashboard` calls `getDashboardSnapshot`; worker refreshes every 30 seconds and endpoint displays only age `<=60s`.                                                                                                                                                        | Custom dashboard                                     | Snapshot, not live aggregate or RA cache.                                                 |
| FR-011 | `MetricCard` requires unit metadata and labels recruiter-enabled accounts as overlapping Candidate identities.                                                                                                                                                                  | Custom dashboard field                               | Unit comes from server snapshot contract.                                                 |
| FR-012 | Snapshot and drill-down share a versioned server definition module; `SnapshotDifferenceNotice` compares originating count with current result/timestamps.                                                                                                                       | Custom dashboard/list integration                    | Exact notice shown on mismatch.                                                           |
| FR-013 | `accounts` List with exact filters, 25/100 pagination, and locked server sort/tie-break.                                                                                                                                                                                        | Standard List/DataTable + custom filter schema       | Unsupported sort/page size rejected server-side.                                          |
| FR-014 | Account-list repository returns the exact allowlist and server-masked email; DataTable has only those columns.                                                                                                                                                                  | Standard read projection                             | Detail fields use a separate custom query to prevent cache overexposure.                  |
| FR-015 | `AccountSecurityShow` fetches a dedicated projection with safe account, membership, and session fields.                                                                                                                                                                         | Custom Show page                                     | Not generic account edit/show cache.                                                      |
| FR-016 | `SessionRevocationDialog` captures exact category, normalized 10–500 rationale, explicit confirmation, step-up, and expected version.                                                                                                                                           | Custom command                                       | One/all session commands are not delete CRUD.                                             |
| FR-017 | Session repository/projector excludes token, full address, factor data, codes, and raw headers; UI has no hidden fields.                                                                                                                                                        | Server projection + custom table                     | Privacy canary tests response and DOM.                                                    |
| FR-018 | `SuspendAccountDialog` invokes pessimistic `suspendAccount`; service revokes all sessions/challenges and blocks new auth atomically.                                                                                                                                            | Custom command                                       | No generic account update.                                                                |
| FR-019 | `ReinstateAccountDialog` invokes pessimistic `reinstateAccount`; service preserves revoked sessions and independent state.                                                                                                                                                      | Custom command                                       | UI refetches account/memberships after commit.                                            |
| FR-020 | Commands carry idempotency key and expected version; service locks current state; conflict component shows safe latest state and requires retry.                                                                                                                                | Custom conflict workflow                             | No optimistic/undoable mode.                                                              |
| FR-021 | `PrivilegedActionRationale` encrypted record is separate from AuditEvent; custom fresh-step-up detail; worker enforces 365-day + 24-hour deletion.                                                                                                                              | Custom protected detail + worker                     | Rationale absent from notification/audit/telemetry.                                       |
| FR-022 | Nested `NotificationDeliveryStatus` shows allowed states/times/category; durable worker executes exact retry/dead-letter rules.                                                                                                                                                 | Custom read status + worker                          | Original action never rolls back after delivery failure.                                  |
| FR-023 | No route/provider/action exists for deletion, erasure, reuse, reset, factor bypass, or Candidate profile editing.                                                                                                                                                               | Scope guard                                          | Architecture tests enforce missing capabilities.                                          |
| FR-024 | Candidate-side submission API creates request; existing-company path validates typed invitation/OWNER prerequisite; admin review displays safe validity state.                                                                                                                  | Custom Candidate flow + custom admin review          | Prerequisite producer is a blocking external dependency.                                  |
| FR-025 | Candidate contract normalizes/requires exact 10 ASCII digits and enforces PDF/PNG/JPEG 1–5,000,000 bytes before work creation.                                                                                                                                                  | Custom submission validation                         | Rechecked server-side; admin UI cannot bypass.                                            |
| FR-026 | Admin worker isolates evidence and runs four checks; state/milestone scheduler applies 15-minute delay and 24-hour expiry.                                                                                                                                                      | Custom worker pipeline                               | Unsafe/indeterminate evidence never gets a review projection.                             |
| FR-027 | `ProtectedEvidenceViewer` and authenticated byte-stream/download routes; purpose-specific encrypted store; retention cleanup.                                                                                                                                                   | Custom protected viewer                              | `<ImageField>`/`<FileField>` are prohibited because they require URLs.                    |
| FR-028 | Verification service implements the exact state machine; worker owns timed expiry; UI exposes actions only for current state and disables on viewer outage.                                                                                                                     | Custom state-machine UI + worker                     | RESUBMITTED is transactional/non-actionable.                                              |
| FR-029 | `verification-requests` List with exact filters, 25/100 paging, and locked oldest-first order.                                                                                                                                                                                  | Standard List/DataTable + custom filters             | Rows contain no document content.                                                         |
| FR-030 | `VerificationReviewShow` composes safe facts, matches, prerequisite, checked evidence, submissions, and decision history.                                                                                                                                                       | Custom Show page                                     | Multiple projections; not flat CRUD.                                                      |
| FR-031 | `VerificationDecisionPanel` implements change/reject/approve forms, categories, role allowlist, private note normalization, and resubmission limit.                                                                                                                             | Custom commands/forms                                | All commands pessimistic and step-up protected.                                           |
| FR-032 | New-company approval service transaction creates verified ACTIVE Company, OWNER Membership, terminal request, notification work, and audit.                                                                                                                                     | Server transaction + custom command                  | UI receives result only after commit.                                                     |
| FR-033 | Existing-company approval transaction revalidates/consumes invitation or fulfills request-specific OWNER approval and creates/restores exact role.                                                                                                                              | Server transaction + custom command                  | No tax-ID-only grant path.                                                                |
| FR-034 | Unique normalized tax identifier, unique active request/membership constraints, idempotency records, row locks, and version checks.                                                                                                                                             | Server-only integrity                                | Retry/concurrency qualification required.                                                 |
| FR-035 | Repository constraints and precondition service prevent duplicate active request/authority; UI renders authoritative outcome.                                                                                                                                                   | Server-only integrity                                | No duplicate create method in provider.                                                   |
| FR-036 | Read-only decision history projection with allowlisted actor/version/state/category/time/result fields.                                                                                                                                                                         | Custom history component                             | Evidence/note/session data excluded server-side.                                          |
| FR-037 | Accepted receipt, cancellation, administrator-decision, delay, and expiry transitions atomically enqueue exactly one idempotent row in the existing `EmailOutbox`; typed templates include state/time/next action and omit private signals, notes, storage, and admin identity. | Server transaction + existing email worker/template  | Separate from FR-022 `SecurityNotificationWork`; delivery cannot reverse committed state. |
| FR-038 | `company-memberships` is a first-class company-scoped resource related to `accounts` and `companies`; no `recruiters` resource exists.                                                                                                                                          | Standard relation + custom actions                   | Candidate identity is never replaced.                                                     |
| FR-039 | `SuspendMembershipDialog` captures reason/rationale/confirmation/step-up and calls versioned command for one membership.                                                                                                                                                        | Custom command                                       | Company ID and role shown explicitly.                                                     |
| FR-040 | `RestoreMembershipDialog` calls dedicated service restoring prior approved role only.                                                                                                                                                                                           | Custom command                                       | Does not edit role or other memberships.                                                  |
| FR-041 | `RemoveMembershipDialog` requires stronger confirmation and dedicated terminal command.                                                                                                                                                                                         | Custom command                                       | REMOVED is preserved; no delete CRUD.                                                     |
| FR-042 | Membership services update one locked membership and assert account/Candidate/other membership states unchanged.                                                                                                                                                                | Server-only invariant                                | Multi-company integration tests.                                                          |
| FR-043 | Recruiter entitlement and every future company command use current account/company/membership/role checks.                                                                                                                                                                      | Server-only boundary                                 | React Admin grant never substitutes.                                                      |
| FR-044 | Membership service locks active OWNER set and rejects removal/suspension of the last active OWNER.                                                                                                                                                                              | Server invariant + disabled UI state                 | Concurrent OWNER actions tested.                                                          |
| FR-045 | Versioned membership commands write audit and return current safe state on stale conflict.                                                                                                                                                                                      | Custom conflict workflow                             | No silent overwrite.                                                                      |
| FR-046 | Generalized `moderation-reports` resource preserves target/relationship context; submission service enforces OWNER/HR versus direct application authority rules.                                                                                                                | Standard admin List + custom submission/server rules | Existing job reports migrate into the same queue.                                         |
| FR-047 | Non-public report submission boundary rechecks ACTIVE account/membership/company/application authorization and uses one unavailable response.                                                                                                                                   | Server-only authorization                            | No target-existence field in failure.                                                     |
| FR-048 | Candidate/recruiter report form and service enforce category, exact normalization, limits, dedupe, 10/24h quota, neutral receipt, and retry duration.                                                                                                                           | Custom submission flow                               | Admin console only consumes accepted reports.                                             |
| FR-049 | Report creation service has no dependency on enforcement/job/application/scoring mutation services.                                                                                                                                                                             | Architecture boundary                                | Contract test proves only report/admission/audit writes.                                  |
| FR-050 | `moderation-reports` List/DataTable implements exact filters, computed priority, 25/100 paging, and locked priority/age/reference sort.                                                                                                                                         | Standard List shell + custom priority field          | Server owns priority definitions.                                                         |
| FR-051 | `ModerationReviewShow` with assignment, investigation note, resolve, dismiss, and separately confirmed enforcement link commands.                                                                                                                                               | Custom workflow                                      | No generic edit and no reopen command.                                                    |
| FR-052 | Commands carry report version; append-only state/action history preserves allowlisted references only.                                                                                                                                                                          | Custom conflict/history component                    | Unavailable/deleted target does not break history.                                        |
| FR-053 | Report detail repository requires current administrator authority and projects no data to target; reporter API returns only receipt/status.                                                                                                                                     | Server-only privacy + custom detail                  | React Admin memory purged on authority loss.                                              |
| FR-054 | Exact recruiter host routing/startup validation mirrors admin origin checks.                                                                                                                                                                                                    | Custom host boundary (non-RA page)                   | No full recruiter console is built.                                                       |
| FR-055 | Recruiter entitlement endpoint accepts only ACTIVE account with active membership and ignores admin grant.                                                                                                                                                                      | Server-only authorization                            | Candidate-only/suspended membership gets denied state.                                    |
| FR-056 | Limited entitlement page makes selected active company explicit; endpoint returns only authorized safe company options and rechecks selection.                                                                                                                                  | Custom limited Next.js page                          | No company-private dashboard/data actions.                                                |
| FR-057 | Coming-next page exposes exactly Candidate Dashboard and Employer Verification destinations and no Recruiter Manager operations.                                                                                                                                                | Custom limited Next.js page                          | Explicit scope guard tests links/routes.                                                  |
| FR-058 | The enumerated account, all-session, and membership commands use `SecurityNotificationWork`; verification approval/request-changes/rejection use the existing `EmailOutbox`. Each command commits state, AuditEvent, and exactly one idempotent Notification Work row together. | Server-only transaction                              | Single-session/moderation exclusions remain; delivery never reverses commit.              |
| FR-059 | Shared React Admin state components cover loading, empty, success, validation, stale conflict, and failure; all writes pessimistic.                                                                                                                                             | Custom UX primitives                                 | Query state is never authoritative business state.                                        |
| FR-060 | `AdminAuthorityGate`, memoryStore, zero inactive cache retention, no-store responses, full purge on auth error/logout, safe URLs/logs.                                                                                                                                          | Custom security boundary                             | Back/forward/reload must recheck before content render.                                   |
| FR-061 | Add regression suites proving existing Candidate/auth/profile/CV/search/application/session-self-service behavior is unchanged except lawful denial.                                                                                                                            | Test/architecture guard                              | React Admin bundle and routes stay isolated to admin host.                                |
| FR-062 | Initial admin 2FA transaction designates current Better Auth Session and revokes prior designated Session within 2 seconds; candidate-only sessions remain ordinary.                                                                                                            | Custom auth service + two-device tests               | Included because finalized spec contains FR-062.                                          |

## Custom Components Required

All items below are beyond typical React Admin list/create/edit/show CRUD:

1. **AdminOriginShell and AdminAuthorityGate** — client-only React Admin mount,
   exact-origin shell, route-level no-content authentication wait, cache purge,
   and post-revocation behavior.
2. **AdminLoginPage, AdminTwoFactorPage, StepUpDialog** — adapt the existing
   Better Auth login/challenge lifecycle without issuing another session or
   storing credentials/proof in React Admin.
3. **AccessibleAdminLayout** — console landmarks, skip link, menu, page-heading
   focus, visible focus theme, non-color statuses, live regions, and safe errors.
4. **AdminDashboard, MetricCard, SnapshotDifferenceNotice** — server snapshot
   timestamps/units, 30-second refresh, canonical drill-down filter, and
   snapshot-versus-current notice.
5. **AccountSecurityShow and SafeSessionTable** — distinct allowlisted detail
   query; sessions nested under an account without exposing reusable identifiers.
6. **SensitiveActionDialog family** — revoke one/all sessions, suspend/reinstate
   account, and suspend/restore/remove membership with category, normalized
   rationale, exact target, step-up, expected version, and explicit confirmation.
7. **StaleConflictPanel** — announce `409`/`412`, show current safe state, discard
   stale form state, refetch, and require a new confirmation.
8. **PrivilegedRationaleDetail** — fresh-step-up read, no cache persistence,
   expiry display, and immediate purge when access is lost.
9. **NotificationDeliveryStatus** — exact status, attempts, last/next attempt,
   deadline, and non-sensitive failure category for manual intervention.
10. **VerificationReviewShow** — facts, matches, prerequisite, history, outage
    state, checked evidence, and decisions in one review workspace.
11. **ProtectedEvidenceViewer** — authenticated streaming, PDF canvas/image blob
    rendering, accessible controls, no public URL, step-up, cleanup, and outage
    disabling.
12. **VerificationDecisionPanel** — request changes, reject, and approve commands
    with role/category/note rules, resubmission boundary, version conflict, and
    atomic result handling.
13. **MembershipLifecyclePanel** — company-explicit action eligibility, last-OWNER
    block, prior-role restoration, and multi-company isolation.
14. **ModerationReviewShow and ReportActionPanel** — assignment, normalized private
    note, terminal resolution/dismissal, enforcement linking, and immutable
    original report/history.
15. **SafeStatusField and SafePriorityField** — textual/icon states that never
    rely on color and never expose raw internal error/provider detail.
16. **RecruiterEntitlementComingNextPage** — non-React-Admin limited page for
    exact recruiter-origin access, explicit safe company context, and only the
    two permitted destinations.

## Open Questions / Flags for spec.md

1. **Dashboard TTL is already resolved**: FR-010–FR-012 explicitly set a
   60-second maximum snapshot age. This plan uses 30-second background refresh
   and refuses to show a snapshot older than 60 seconds. No spec change is
   needed unless stakeholders want a stricter maximum.
2. **Resolved delivery gate—existing-company relationship prerequisite**: The
   Company Access Prerequisite producer is owned by the separate company-access
   workflow. Feature 006 defines a versioned producer/consumer contract,
   readiness check, and integration test, but creates no invitations or OWNER
   approval UI. Existing-company approval remains disabled and Feature 006 MUST
   NOT be declared complete until that producer passes the contract in the target
   environment. A missing producer is a failed release gate, never a tax-ID-only
   fallback.
3. **Operations ownership for administrator grants**: The spec deliberately puts
   public/admin-console grant management and break-glass procedures out of scope.
   Deployment requires an approved operator and ordinary runbook for bootstrap,
   suspension, revocation, expiry, and last-usable-admin prevention. Emergency
   recovery and break-glass procedures remain excluded. The plan provides an
   audited out-of-band command only; product UI remains excluded.
4. **Production origins and hosting identifiers**: The spec requires exactly one
   admin and recruiter origin per non-local environment but does not name them.
   Operations must provide the exact HTTPS values before deployment. Wildcards
   and runtime discovery are not allowed.
5. **Resolved production gate—legal evidence policy**: The implementation must
   create `docs/policies/business-license-evidence.md` and obtain named Legal,
   Security, and Operations approvals for storage region, encryption-key owner,
   incident access, applicant/reviewer access, deletion evidence, and the event
   that marks company verification inactive. Deployment preflight fails when the
   approved policy version is absent. The policy cannot change FR-027 deadlines.

Items 2–5 are explicit delivery/operations gates. They require no further
product choice and cannot be bypassed during implementation.

## Out of Scope Confirmation

This plan explicitly excludes:

- public/self-service administrator registration, administrator invitation,
  fine-grained administrator roles, grant-management UI, and break-glass UI;
- permanent account deletion/erasure, email reuse, password/factor bypass, or
  editing Candidate profile facts;
- report-volume auto-suspension, fraud scoring, AI moderation, or AI verification;
- company deactivation/deletion, ownership-transfer UI, custom roles, recruiter
  invitation creation, OWNER-approval UI, and company-team management;
- full Recruiter Manager capabilities at `console.recruiter.localhost:3001`,
  including recruiter dashboard, job posts, applicants, scoring, Kanban,
  notifications, analytics, team management, or export;
- recruitment analytics/export beyond operational administration counts;
- full job-post approval/removal workflow beyond consuming existing reports and
  linking a separately authorized enforcement action.

Only FR-054–FR-057's recruiter-origin host, entitlement check, explicit safe
company context, and coming-next page are included.

## Data and Transaction Design

The detailed model is in [data-model.md](./data-model.md). Principal changes are:

- add Platform Administrator Grant and one-to-one Administrator Session Policy;
- preserve User Account, Candidate Identity, Company, and Company Membership as
  separate related models; add REMOVED membership state and version/history;
- add normalized tax identifier/company verification state;
- add verification request, relationship prerequisite, versioned evidence,
  safety attempts, and decision history;
- migrate existing Job Report data into a generalized Moderation Report plus
  admission/history records;
- add privileged rationale, security notification work, administrator command
  idempotency, and dashboard snapshot models; reuse the existing `EmailOutbox`
  as applicant Notification Work with event-specific idempotency and verification
  lifecycle correlation;
- reuse existing Session and AuditEvent authorities without copying credentials
  or free text into new audit/session columns.

Every security-sensitive service uses one PostgreSQL transaction with row locks,
expected versions, uniqueness/partial constraints, and a request-scoped
idempotency result. The client never chooses actor, grant, account state,
membership ownership, report relationship, or audit identity.

## API and Provider Contracts

- [admin-api.openapi.yaml](./contracts/admin-api.openapi.yaml) defines exact
  authentication, dashboard, account/session, verification, membership,
  moderation, rationale, evidence, notification, and recruiter-entitlement
  routes.
- [react-admin-provider.md](./contracts/react-admin-provider.md) defines the
  resource projections, custom method signatures, cache rules, errors,
  pagination, and mutation semantics expected by React Admin.
- [internal-contracts.md](./contracts/internal-contracts.md) defines service,
  worker, storage, scanner, prerequisite, notification, and audit boundaries.

OpenAPI/Zod/client type generation must agree in CI. Server output schemas strip
unknown fields and are projection-specific; a model field is never automatically
serializable merely because it exists.

The OpenAPI contains 32 Feature 006 paths, including safe company-reference and
company-membership list/detail reads. Every dashboard drill-down list requires
`calculatedAt` and `stateDefinitionVersion`; these fields are not optional
provider metadata.

## Migration, Rollout, and Recovery

1. Add enums/models/indexes/constraints in an additive migration; preserve all
   Better Auth-owned Session/User/TwoFactor columns and existing migrations.
2. Backfill every existing account with no data mutation to its existing
   Candidate Identity relation; create no administrator grant automatically.
3. Add `REMOVED` membership state/version fields and map existing ACTIVE/
   SUSPENDED values unchanged.
4. Introduce generalized Moderation Report storage, backfill existing Job Reports
   with stable references/category mapping, dual-read verification, then switch
   Feature 003 submission and the admin queue to the new authority. No report is
   dropped or made enforcing during migration.
5. Approve the versioned business-license evidence policy, then deploy evidence
   storage, worker, cleanup, notification retry, and dashboard snapshot generation
   with admin-origin admission disabled. Verify policy version, private
   storage/ClamAV/email readiness, and hard-deadline fake-clock tests.
6. Provision at least two test Platform Administrator grants out of band; enable
   the admin origin only after two-device session, step-up, lockout prevention,
   audit, privacy, and SC-002 performance gates pass.
7. Enable new-company verification first. Enable existing-company approval only
   after the authoritative invitation/OWNER prerequisite producer passes its
   integration contract.
8. Enable moderation and membership actions after migration parity and
   multi-company/concurrency tests pass.
9. Rollback disables new admin commands and console admission but leaves
   revocation enforcement, notification delivery, evidence/rationale cleanup,
   audit, and already-committed state active. Additive schema remains; no rollback
   may recreate sessions, memberships, authority, or terminal requests/reports.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/006-admin-management/
|-- spec.md                         # authoritative feature requirements
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- admin-api.openapi.yaml
|   |-- react-admin-provider.md
|   `-- internal-contracts.md
|-- checklists/requirements.md      # specification quality validation
`-- tasks.md                        # dependency-ordered implementation work
```

### Source Code (repository root)

```text
docs/
|-- dependencies/company-access-prerequisite.md
|-- policies/business-license-evidence.md
`-- runbooks/platform-administrator-grants.md

package.json
package-lock.json
compose.yaml
Dockerfile.admin-worker

web/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/016_admin_management/
|   |-- migrations/017_admin_account_version/
|   |-- migrations/018_moderation_priority_alignment/
|   |-- migrations/019_evidence_processing_lease/
|   `-- migrations/020_verification_outbox_event_unique/
|-- scripts/
|   |-- check-migration-sequence.mjs
|   |-- reconcile-migration-names.mjs
|   |-- run-admin-worker.mjs
|   |-- provision-platform-administrator.mjs
|   |-- revoke-platform-administrator.mjs
|   `-- measure-admin-management-performance.mjs
|-- src/
|   |-- proxy.ts
|   |-- app/
|   |   |-- (admin-console)/admin-console/page.tsx
|   |   |-- (recruiter-entitlement)/recruiter-entitlement/page.tsx
|   |   |-- api/admin/
|   |   |   |-- auth/{context,login,two-factor,step-up,logout}/route.ts
|   |   |   |-- dashboard/route.ts
|   |   |   |-- accounts/{route.ts,[accountId]/...}
|   |   |   |-- companies/route.ts
|   |   |   |-- verification-requests/{route.ts,[requestId]/...}
|   |   |   |-- company-memberships/{route.ts,[membershipId]/...}
|   |   |   |-- moderation-reports/{route.ts,[reportId]/...}
|   |   |   `-- audit-events/[correlationId]/route.ts
|   |   `-- api/recruiter/entitlement/route.ts
|   |-- backend/
|   |   |-- admin/
|   |   |   |-- authorization/
|   |   |   |-- dashboard/
|   |   |   |-- accounts/
|   |   |   |-- verification/
|   |   |   |-- memberships/
|   |   |   |-- moderation/
|   |   |   |-- notifications/
|   |   |   `-- workers/
|   |   |-- repositories/admin/
|   |   |-- storage/business-evidence/
|   |   `-- security/admin-request-boundary.ts
|   |-- frontend/features/admin/
|   |   |-- app/{admin-app.tsx,auth-provider.ts,data-provider.ts,query-client.ts}
|   |   |-- layout/
|   |   |-- dashboard/
|   |   |-- accounts/
|   |   |-- verification/
|   |   |-- memberships/
|   |   |-- moderation/
|   |   `-- shared/
|   |-- frontend/features/recruiter-entitlement/
|   `-- shared/contracts/admin/
`-- tests/
    |-- backend/{unit,integration,contract}/admin-management/
    |-- frontend/{components,accessibility}/admin-management/
    |-- architecture/admin-management-boundaries.test.ts
    |-- security/admin-management/
    |-- performance/admin-management/
    `-- system/e2e/admin-management/
```

**Structure Decision**: Extend the existing `web/` modular monolith. React Admin
is isolated under `frontend/features/admin`; business rules remain in backend
services/repositories. One admin worker is added for durable asynchronous work.
No standalone admin backend, second database, or recruiter application is added.

## Verification Strategy

### Contract and architecture

- OpenAPI/Zod/provider parity for every route, filter, field allowlist, state,
  error, and custom method; unknown fields and unsupported generic CRUD fail.
- Architecture tests prohibit React Admin/provider code from importing Prisma,
  Better Auth internals, storage, scanner, email provider, or business services.
- Server-route tests prove every handler invokes exact-host, same-origin/CSRF,
  current-session, account, grant, designation, step-up, and command authorization
  as applicable; Proxy alone never satisfies authorization.
- Bundle inspection proves evidence locators, server environment, storage keys,
  Prisma client, and provider credentials are absent from browser chunks.

### Security and privacy

- Authorization matrix covers signed-out, Candidate-only, recruiter-enabled,
  suspended account, non-active grant, non-designated session, old proof, forged
  host/origin/CSRF/version/idempotency, direct route, and stale UI cases.
- Two-browser/device tests prove atomic designation and prior-session rejection
  within 2 seconds without affecting Candidate-only sessions.
- Back/forward/reload tests prove no prior admin content renders after logout,
  account/grant/session revocation, or designation replacement.
- Storage/DOM/network/log/audit/analytics canaries find zero credentials, complete
  addresses, factor data, raw evidence/locator, report text outside authorized
  detail, rationale outside its protected response, or privileged identifiers in
  URLs/persistent browser storage.
- Fake-clock tests prove exact rationale/evidence inaccessibility/deletion,
  security-notification retry/dead-letter deadlines under
  failure/restart/reconciliation, and exactly-one applicant `EmailOutbox` rows
  for accepted verification receipts, cancellations, administrator decisions,
  delays, and expiries.

### Domain behavior

- Dashboard golden datasets prove people versus membership units, subset counts,
  role/state totals, snapshot timestamp/age, current drill-down differences, and
  shared state-definition version.
- Account/session tests cover revoke one/all, suspend/reinstate, self/last-admin
  denial, session/challenge invalidation, notification outcome, and conflicts.
- Verification tests cover 10-digit boundaries, file size/type/magic, four safety
  checks, all state transitions/deadlines, three-resubmission limit, protected
  viewer outage, concurrent tax ID/company/member creation, and exact prerequisite
  consumption.
- Membership tests cover every role/state, multiple companies, last OWNER,
  stale in-flight actions, prior-role restore, REMOVED terminal behavior, and
  Candidate identity preservation.
- Moderation tests cover every target/relationship/category, neutral denial,
  normalization Unicode/control/markup cases, dedupe/quota concurrency, priority
  order, terminal lifecycle, history retention, and zero automatic enforcement.

### Performance, accessibility, and usability

- SC-002 harness documents hardware/container resources, PostgreSQL data shape,
  indexes, cold/warm state, 15-minute duration, 10 concurrent administrators,
  sample counts, P50/P95/P99/max, and error rate for snapshots and live lists.
- Two-second revocation/designation measurements use controlled clocks plus real
  multi-browser runs; hard deadline tests remain 100% pass/fail rather than P95.
- Every core task is tested keyboard-only in Playwright, including filters,
  tables, dialogs, evidence, step-up, conflict recovery, and logout. Focus order,
  restored focus, headings, labels, live regions, and non-color states are asserted.
- Axe produces zero serious/critical findings; NVDA/Firefox and VoiceOver/Safari
  manual smoke evidence covers console navigation, tables, dialogs, errors, and
  document-review alternatives.
- Representative administrator usability sessions measure SC-006/SC-008 task
  completion thresholds without seeding prior knowledge of target positions.

### Acceptance-scenario coverage

Every numbered Acceptance Scenario remains an executable system-test case; the
rows below identify the owning suite and supporting component rather than
rephrasing or replacing the approved expected outcome.

| Approved scenarios       | Planned executable coverage                                                                                                                                                                                                          | Primary design path                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| US1-AS1 through US1-AS7  | Exact-origin authorization matrix, direct-operation denial, authority-change tests, Candidate/recruiter isolation, two-browser designation, and 15-minute step-up fake-clock/system tests                                            | `AdminRequestBoundary`, Better Auth adapter, `AdminAuthorityGate`, `StepUpDialog`                             |
| US2-AS1 through US2-AS6  | Seeded snapshot golden tests for overlapping identities, membership units/roles/states, actionable queues, drill-down filters, timestamps, and changed-source notice                                                                 | `AdminDashboard`, snapshot worker, shared metric definitions, `SnapshotDifferenceNotice`                      |
| US3-AS1 through US3-AS10 | Account search/allowlist tests, privacy canaries, revoke-one/all, suspend/reinstate, concurrency, self/last-admin protection, notification failure, and rationale-retention tests                                                    | `AccountSecurityShow`, sensitive-action dialogs, account/session services, notification worker                |
| US4-AS1 through US4-AS14 | Candidate submission, safety pipeline, protected viewer, all decision forms/states, new/existing company approval, prerequisite consumption, concurrency, cancellation, 15/24/72-hour outages, resubmission, and 30-day expiry tests | verification submission/review services, `ProtectedEvidenceViewer`, `VerificationDecisionPanel`, admin worker |
| US5-AS1 through US5-AS6  | Multi-company membership suspend/restore/remove, no-active-membership denial, last-OWNER protection, and stale in-flight recruiter command tests                                                                                     | `MembershipLifecyclePanel`, membership service, recruiter entitlement boundary                                |
| US6-AS1 through US6-AS9  | Legacy job-report migration/queue, every reporter relationship, non-enumerating denial, filters/order, moderation lifecycle/concurrency, no automatic enforcement, dedupe, and quota tests                                           | report submission boundary, `ModerationReviewShow`, report service/repository                                 |
| US7-AS1 through US7-AS4  | Active/no-active/multiple-membership entitlement tests, explicit company selection, exact two-destination state, and route/link absence tests                                                                                        | recruiter entitlement boundary and `RecruiterEntitlementComingNextPage`                                       |

### Success-criteria verification matrix

| SC ID  | Release test and pass condition                                                                                                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001 | Authorization matrix executes every named identity/session/factor state against every admin page/read/command; 100% deny before payload or mutation except the fully authorized case.                                                                                      |
| SC-002 | Fifteen-minute, 10-administrator performance run on the exact minimum dataset records usable time for snapshots and independently calculated lists; P95 is at most 2 seconds and errors are below 1%.                                                                      |
| SC-003 | Snapshot golden suite verifies exact values, displayed age at most 60 seconds, unit/subset labels, identical definitions, both calculation times, and the required difference notice in 100% of changed-source cases.                                                      |
| SC-004 | Real multi-session suspension and revoke-all tests poll protected use; every prior target session rejects within 2 seconds in 100% of runs.                                                                                                                                |
| SC-005 | Reinstatement suite proves authentication returns while all prior sessions and independently suspended/removed memberships remain unusable in 100% of cases.                                                                                                               |
| SC-006 | Moderated representative usability study measures first-attempt account/session workflow completion within 2 minutes; at least 90% succeed and no action targets the wrong membership.                                                                                     |
| SC-007 | Qualification runner processes at least 100 clean documents with 10 concurrent submissions for 30 minutes and measures the 90%/2-minute target; injected safety/viewer outages assert every 15-minute, 24-hour, and 72-hour outcome and zero unsafe authority grants.      |
| SC-008 | Representative usability study measures the 90%/3-minute review target; deterministic suites require 100% correct membership/Candidate identity, tax-ID boundary, prerequisite-denial, applicant-only cancellation, uninterrupted RESUBMITTED, and 30-day expiry outcomes. |
| SC-009 | Multi-company fixtures exercise suspend/restore/remove for every role and state; 100% preserve Candidate access and every unrelated membership.                                                                                                                            |
| SC-010 | Barrier-synchronized account, verification, membership, and report command tests require one authoritative outcome or an explicit refresh conflict in 100% of cases, with no silent overwrite.                                                                             |
| SC-011 | Report isolation/dedupe/quota/lifecycle suite requires zero automatic domain changes, identical neutral duplicate receipts, the 10-report rolling cap, correct initial/terminal states, and no reopen in 100% of cases.                                                    |
| SC-012 | Response/DOM/storage/URL/log/analytics/audit/notification canaries require zero prohibited values; fake-clock rationale tests require fresh proof, exact 365-day inaccessibility, and deletion within the following 24 hours in 100% of cases.                             |
| SC-013 | Audit correlation suite requires every tested privileged state change and denied high-risk attempt to create the six required fields; secret/evidence canaries require zero prohibited audit content.                                                                      |
| SC-014 | Keyboard system suite completes every core task with visible focus and non-color labels; the approved accessibility scan reports zero serious or critical violations.                                                                                                      |
| SC-015 | Two-device plus Candidate-session suite requires exactly one designated admin session, old-session denial within 2 seconds, no Candidate-session privilege gain, and ordinary session-limit preservation in 100% of runs.                                                  |
| SC-016 | Boundary-clock suite tests proof age through 15 minutes and at 15 minutes plus 1 second for every FR-004 sensitive action; 100% require renewal after the boundary and failed/abandoned proof changes no state.                                                            |
| SC-017 | Table-driven and concurrency tests cover all categories, normalization removals, length rules, unresolved/24-hour dedupe, 10-report quota, cross-session aggregation, and application authorization; 100% match FR-046 through FR-048 without target disclosure.           |
| SC-018 | Fake delivery provider exercises each retryable/permanent/exhausted path; 100% use at most five exact-schedule attempts, reach manual intervention by 24 hours, expose required safe fields, and preserve the originating action.                                          |

## Post-Design Constitution Re-check

The Phase 1 design remains compliant. React Admin is presentation scaffolding,
not authority, and its contained MUI subtree does not replace the primary
Next.js/TypeScript Tailwind/shadcn baseline; Better Auth remains the only session owner; PostgreSQL preserves
transactional state and tenant-scoped memberships; no AI or autonomous decision
enters the workflow; private evidence/rationale and in-memory browser state meet
privacy boundaries; exact quality/deadline tests are defined; and all providers
remain behind typed interfaces. All gates remain **Pass**.

## Complexity Tracking

No constitutional violation requires justification. The client-only React Admin
shell and one admin worker are bounded extensions of the approved Next.js
application and existing worker pattern, not additional authorities, browser
sessions, databases, or product surfaces.

## SmartHire Support Center Extension (2026-08-13)

Feature 006 adds a separate `support` domain beside `admin` and `messaging`. Candidate-origin Route Handlers use Better Auth plus CSRF proof; admin-origin handlers use `AdminRequestBoundary`. Both call support services and a Prisma support repository. Architecture tests prohibit imports from Feature 008 repositories.

`SupportConversation`, `SupportMessage`, `SupportAssignment`, `SupportInternalNote`, and `SupportConversationHistory` own durable state. Message acceptance, sequence allocation, lifecycle transitions, assignment changes, audit, and email intent are transactional. Realtime publication is content-free and after-commit.

The Socket.IO server receives a dedicated `/support` namespace. Candidate-origin sockets authenticate as requesters; admin-origin sockets additionally validate the designated Platform Administrator session and current grant. Account rooms and one admin invalidation room carry only `{ caseId, version, state, change }`; content is refetched through HTTP authorization.

React Admin receives a closed `support-cases` resource with list/detail projections and explicit claim, reassign, reply, note, resolve, and close commands. The Candidate workspace receives `/support`. Feature 008 `/messages`, `/chat`, presence, eligibility, reports, and repositories remain isolated.

Case creation consumes admission, validates the three-active and rolling five-case quotas, and inserts case, initial message, history, and audit in one transaction. Message send locks the case, checks ownership or assignment, validates state/version/idempotency, allocates one sequence, transitions state, and conditionally inserts one content-free EmailOutbox row. Claim/reassign uses optimistic versioning plus a partial unique active-assignment index. Auto-close, authority-loss requeue, and retention workers use bounded guarded claims.

Requester DTOs map every administrator-authored message to `SmartHire Support` and omit assignment/note fields. At `closedAt + 365 days`, content becomes unavailable and is removed within 24 hours. Retained metadata contains no subject, message, note, email, or session details.

Verification adds contract tests for origins/session/CSRF/grant/projections, integration tests for lifecycle/concurrency/workers/outbox, frontend/accessibility tests for both workspaces, privacy tests for redaction, and architecture tests proving no ordinary-message reader exists.
