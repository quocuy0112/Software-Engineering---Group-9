# Phase 0 Research: Platform Administration with React Admin

**Feature**: `006-admin-management`  
**Date**: 2026-08-10

## Decision 1: React Admin baseline and Next.js integration

**Decision**: Add React Admin `5.15.1` to the existing React `19.2.3` / Next.js
`16.3.0` application. Render the administration shell as a client-only React
Admin application inside the existing App Router application, selected only for
the exact administration origin. Pin the resolved React Admin, Material UI,
Emotion, React Router, and TanStack Query dependency graph in `package-lock.json`
and reject peer-version drift in CI.

React Admin/MUI is an isolated presentation adapter for the admin subtree. It
does not replace the repository's primary Next.js/TypeScript and Tailwind/shadcn
baseline for shared, Candidate, or recruiter-entitlement UI; MUI global styling
is contained at the admin mount and enforced by an architecture test.

**Rationale**: The current React Admin package declares React 18/19 compatibility.
Its official Next.js guide states that React Admin is an SPA and must be loaded
without server-side rendering because it depends on browser-only routing, MUI,
Emotion, and query libraries. Reusing the current Next.js deployment preserves
the constitution's approved backend routing and avoids a second backend or
session owner.

**Alternatives considered**:

- A separate Vite SPA was rejected because it would add another deployment,
  duplicate environment/origin handling, and complicate the one-session policy.
- Server-rendering React Admin was rejected because the official integration
  explicitly requires client-only rendering.
- React Admin Enterprise modules were not selected; the open-source `DataTable`,
  forms, routing, and hooks are sufficient when combined with the custom flows
  required by the specification.

**Primary references**:

- [React Admin package metadata](https://raw.githubusercontent.com/marmelab/react-admin/master/packages/react-admin/package.json)
- [Official React Admin Next.js integration](https://marmelab.com/react-admin/NextJs.html)

## Decision 2: Backend and persistence baseline

**Decision**: Keep the existing modular-monolith backend: Next.js App Router
Route Handlers call typed services, which call Prisma repositories over the
single PostgreSQL 16 database. Add one `admin-worker` process using the existing
Node/TypeScript worker convention for verification safety processing, dashboard
snapshot refresh, lifecycle deadlines, security-notification retry, and
rationale cleanup. Use the existing provider-independent email, malware scanner,
private storage, and audit boundaries.

Verification applicant notifications reuse the existing durable `EmailOutbox`
as their Notification Work authority. Each accepted verification lifecycle
event writes exactly one idempotent outbox row in the same PostgreSQL transaction
as its state/history/audit effects. `SecurityNotificationWork` remains a
separate Feature 006 authority only for the FR-022 access-notification retry and
administrator-visible manual-intervention contract.

**Rationale**: These are already constitutional and repository baselines. The
feature requires transactional state/audit/notification outcomes and multiple
hard deadlines; PostgreSQL transactions and a durable worker fit the existing
architecture without a new service framework or database.

**Alternatives considered**:

- A separate NestJS/Express backend was rejected because it would duplicate the
  approved App Router transport layer and session integration.
- Supabase/PostgREST direct browser access was rejected because generic CRUD
  cannot enforce the feature's actor, state-transition, step-up, audit, privacy,
  and all-or-nothing notification rules.
- An in-memory scheduler was rejected because restarts would lose the 15-minute,
  24-hour, 72-hour, 30-day, and 365-day deadlines.

## Decision 3: Authentication and exclusive administrator session

**Decision**: Better Auth `1.6.25` remains the only browser-session owner. The
React Admin `authProvider` is a thin adapter over same-origin admin authentication
routes using the existing HttpOnly session cookie. It stores no access token,
role, factor proof, or session identifier. Completing initial TOTP/backup-code
verification on the admin origin atomically designates the current Better Auth
`Session` in `AdministratorSessionPolicy`, records the proof time, and revokes
the prior designated Better Auth session. Step-up refreshes only the proof time
for that same designated session.

`authProvider` behavior:

- `login`: submit credentials to the existing login service; continue to the
  admin-specific two-factor screen when required; never mint a React Admin token.
- `checkAuth`: call a no-store server endpoint that revalidates ACTIVE account,
  ACTIVE grant, designated session, and initial factor completion on every
  console route boundary.
- `checkError`: clear all in-memory queries and UI state on authentication,
  designation, or grant failure; treat `STEP_UP_REQUIRED` as a recoverable
  sensitive-action challenge rather than a logout.
- `logout`: invoke the existing server logout for the current Better Auth session,
  then clear React Admin memory state.
- `getIdentity` and `canAccess`: obtain only server-derived, non-secret display
  identity and action availability; they never authorize the API.

**Rationale**: React Admin delegates authentication to a user-supplied
`authProvider`, while its access-control hooks are presentation controls. Every
data route must still enforce authorization. This design preserves the existing
opaque cookie session and meets FR-004/FR-005/FR-006/FR-062 without JWTs or
browser storage.

**Alternatives considered**:

- JWT/localStorage authentication was rejected by the constitution and FR-060.
- A dedicated React Admin session cookie was rejected as a prohibited second
  browser-session mechanism.
- Client-cached permissions were rejected because grant and account changes must
  take effect on the next request.

**Primary references**:

- [Writing a React Admin auth provider](https://marmelab.com/react-admin/AuthProviderWriting.html)
- [React Admin authorization hooks](https://marmelab.com/react-admin/Permissions.html)

## Decision 4: Custom data provider and mutation semantics

**Decision**: Implement a typed SmartHire `dataProvider`. Standard
`getList`/`getOne` are available only for allowlisted read projections. The
provider exposes typed custom methods for dashboard snapshots, session
revocation, suspension/reinstatement, membership transitions, evidence access,
verification decisions, report workflow, rationale reads, and notification
delivery status. Unsupported generic `create`, `update`, or `delete` operations
fail locally and have no catch-all server endpoint.

Every enforcement/decision call is pessimistic, explicitly confirmed, carries a
CSRF proof, idempotency key, and reviewed state version, and updates the React
Admin cache only after the authoritative response. `409`/`412` responses carry
the current safe projection and force a visible refresh workflow. AbortSignal is
supported for reads; confirmed mutations are not represented as cancelable after
server receipt.

**Rationale**: React Admin permits custom methods on a data provider. Its normal
edit flow defaults to optimistic/undoable behavior, which is incompatible with
security transitions and concurrency requirements. A closed provider surface
also prevents accidental CRUD exposure of grants, accounts, evidence,
memberships, audits, or reports.

**Alternatives considered**:

- `ra-data-simple-rest` was rejected because the domain is not generic CRUD.
- Mapping suspension to `update("accounts")` was rejected because it obscures
  confirmation, reason capture, step-up, concurrency, notification, and audit
  semantics.
- Optimistic or undoable mutations were rejected because the UI must not claim a
  privileged state before commit.

**Primary references**:

- [Writing a React Admin data provider](https://marmelab.com/react-admin/DataProviderWriting.html)
- [React Admin custom queries and mutations](https://marmelab.com/react-admin/Actions.html)

## Decision 5: Browser storage and cache policy

**Decision**: Configure `<Admin store={memoryStore()}>`, `disableTelemetry`, and
a dedicated QueryClient. Do not persist filters, selected rows, resource data,
identity, permissions, document references, report detail, or session data to
localStorage/sessionStorage/IndexedDB. Queries are stale immediately,
refetch on mount/focus/reconnect, retain no inactive sensitive query after its
screen unmounts, and do not retry authorization/validation failures. A custom
authority gate hides the console while route-level `checkAuth` runs. Logout,
grant/session errors, and designation replacement clear the entire query cache
and memory store before navigation.

**Rationale**: React Admin's default preference store is localStorage, and its
query layer may reuse prior responses. Those defaults conflict with FR-060's
post-revocation/back-navigation and client-persistence rules unless replaced.

**Alternatives considered**:

- The default localStorage store was rejected even for filters because filter
  values may contain account references, email fragments, company references,
  or moderation context.
- A five-minute React Admin application cache was rejected because current
  authority and conflict-sensitive state must be revalidated.

**Primary references**:

- [React Admin transient memory store](https://marmelab.com/react-admin/Store.html)
- [React Admin data fetching and QueryClient options](https://marmelab.com/react-admin/DataFetchingGuide.html)
- [Disabling React Admin telemetry](https://marmelab.com/react-admin/Admin.html#disabletelemetry)

## Decision 6: Dashboard snapshot and drill-down consistency

**Decision**: Treat the 60-second maximum age in FR-010–FR-012 as authoritative,
not an open question. The admin worker calculates immutable PostgreSQL snapshots
every 30 seconds. Each snapshot contains `snapshotId`, `calculatedAt`,
`stateDefinitionVersion`, count units, and filter tokens. The dashboard endpoint
returns a snapshot only while its age is at most 60 seconds; otherwise it returns
an explicit unavailable state and requests an immediate recalculation rather
than displaying stale counts.

The React Admin dashboard is a custom page using
`dataProvider.getDashboardSnapshot()`, with a 30-second refetch interval while
visible. Card drill-down links pass only a non-sensitive filter key and the
originating snapshot ID in in-memory navigation state. Each list endpoint runs a
current query, returns its own `calculatedAt`, and invokes the same versioned
server-side state-definition module used by snapshot generation. The UI compares
the live total with the originating card and displays the exact FR-012 notice.

**Rationale**: React Admin's client cache must not define business snapshot age
or metric semantics. A server snapshot plus shared filter definitions makes
SC-002/SC-003 reproducible and prevents card/list drift caused by duplicated
client filters.

**Alternatives considered**:

- Live aggregate queries on every render were rejected because the spec chose a
  periodic snapshot and the qualification dataset/concurrency target favors a
  bounded calculation path.
- A 60-second React Admin cache was rejected because the UI cache has no
  authoritative calculation timestamp or shared definition version.

## Decision 7: Protected evidence review

**Decision**: Store business-license originals and derived previews in a
purpose-specific private encrypted namespace with no public URLs. A custom
verification detail page requests evidence bytes from an authenticated,
fresh-step-up, same-origin endpoint. The server rechecks the request/evidence
state and streams `no-store` bytes. PDF preview uses the existing `pdfjs-dist`
to render canvases from an in-memory `ArrayBuffer`; safe PNG/JPEG previews use a
server-produced normalized image and a short-lived browser blob URL that is
revoked on unmount. Download is a fresh authorized response with a safe filename.
No storage locator or reusable capability reaches React Admin.

**Rationale**: `<ImageField>` and `<FileField>` expect URLs and therefore cannot
meet FR-027. An authenticated byte stream embedded in a custom Show page can
enforce current authority and outage behavior on every open/download.

**Alternatives considered**:

- Pre-signed/public URLs were rejected because they remain usable outside the
  current review and step-up decision boundary.
- Embedding raw PDF with a public/object URL was rejected; canvas rendering gives
  explicit loading, failure, page limits, and cleanup behavior under the current
  CSP.

## Decision 8: Accessibility baseline

**Decision**: Use React Admin's open-source `DataTable`, MUI form controls,
dialogs, labels, and focus primitives as the base, but do not claim SC-014 from
defaults alone. Customize the console layout, status fields, action cells,
dialogs, document viewer, step-up flow, loading/error regions, and dashboard
cards. Every state includes text (and optionally an icon), not color alone;
dialogs restore focus; grids expose keyboard-operable row/detail actions; the
viewer offers labelled page controls and a text alternative/status; route changes
move focus to the page heading; and all custom focus indicators pass contrast
checks.

Automated axe checks with zero serious/critical findings, Testing Library
keyboard tests, and Playwright end-to-end keyboard sequences cover every core
task. Manual screen-reader smoke tests cover NVDA/Firefox and VoiceOver/Safari
before release.

**Rationale**: MUI supplies accessible primitives and documented keyboard
patterns, but custom renderers are responsible for correct tab order and labels.
The framework cannot guarantee application-level keyboard completion,
non-color semantics, focus restoration, or document-viewer accessibility.

**Alternatives considered**:

- Treating MUI defaults as automatic compliance was rejected because SC-014 is
  an end-to-end task outcome.
- The Enterprise/AG grids were rejected because advanced spreadsheet behavior is
  unnecessary for 25–100-row pages and adds licensing/keyboard complexity.

**Primary references**:

- [React Admin DataTable/Datagrid guidance](https://marmelab.com/react-admin/Datagrid.html)
- [MUI Data Grid accessibility guidance for custom cells](https://mui.com/x/react-data-grid/accessibility/)

## Decision 9: Deployment origins and hosting

**Decision**: Continue the existing Linux container deployment and Next.js
process on port 3001 behind an origin-aware reverse proxy. Local DNS/hosts route
the exact `console.admin.localhost:3001` and
`console.recruiter.localhost:3001` origins to that process. Production startup
requires exact HTTPS Candidate, Administrator, and Recruiter origins; no wildcard
host is accepted. Host-routing selects an isolated admin shell, the limited
recruiter entitlement/coming-next shell, or the existing Candidate application.
All three use the same Better Auth handler, cookie policy, and PostgreSQL Session
model; host-only cookies create ordinary sessions per browser origin without
creating a second mechanism.

**Rationale**: This satisfies FR-003/FR-054, preserves the existing port and
deployment, and lets the server deny unexpected hosts before rendering or
calling business services.

**Alternatives considered**:

- Wildcard subdomain routing was rejected because the spec requires exactly one
  configured origin per environment.
- Separate admin and recruiter backend deployments were rejected because they
  would multiply session/configuration and consistency boundaries.

## Resolved external delivery gate

The repository does not yet contain the invitation/OWNER-approval authority
required by FR-024/FR-030/FR-033. Feature 006 will define and consume a typed
`CompanyRelationshipPrerequisiteGateway`, but it will not create invitations or
OWNER-approval UI. The separate company-access workflow owns the producer.
Existing-company approval remains disabled, and Feature 006 cannot be declared
complete, until the named producer version and target-environment
producer/consumer contract test pass; this gate never permits a tax-ID-only
bypass.
