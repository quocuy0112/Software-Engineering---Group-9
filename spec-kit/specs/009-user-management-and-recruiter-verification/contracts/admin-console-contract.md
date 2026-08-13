# Admin Console Contract — User Management and Recruiter Verification

## Scope and inheritance

This is the React Admin and browser behavior contract for Feature 009. It is a
delta over Feature 006's `react-admin-provider.md`; Feature 006 remains
authoritative for the admin origin, exclusive Better Auth session, current
Platform Administrator checks, fresh-proof rules, CSRF, evidence capabilities,
audit correlation, and safe error envelopes.

The three functional groups remain peer specifications and share one feature
implementation surface:

- Group 1 extends the `accounts` resource with a type-aware directory/detail;
- Group 2 refines the existing `verification-requests` resource and review
  detail; and
- Group 3 adds account-detail moderation commands and history. It is not a
  generic mutable resource.

No route, URL, query parameter, browser storage key, or analytics field may
contain account email, tax code, evidence reference, reason text, session ID,
or storage locator.

## Shared provider behavior

Every provider call uses a same-origin relative URL, `credentials: "include"`,
`cache: "no-store"`, and an AbortSignal. JSON envelopes are validated with Zod
before reaching React Admin. Protected byte-stream calls accept only the
allowlisted image/PDF media types and never persist bytes or capability URLs.

The provider uses the existing memory-only React Admin store and TanStack Query
cache. It clears both before redirect after authentication/authority loss and
when the exclusive browser context switches between public and admin surfaces.

Privileged commands additionally require the current CSRF proof, a memory-only
`Idempotency-Key`, `If-Match` from the reviewed version, fresh step-up proof,
and pessimistic mutation mode. A successful command invalidates and refetches
the authoritative list/detail instead of patching cached state optimistically.

Generic `create`, `update`, `delete`, `updateMany`, and `deleteMany` are
unsupported for both resources. There are no bulk moderation or bulk
verification decisions.

## Group 1 — Account directory

### Resource operations

`accounts.getList` maps React Admin pagination and filters to:

```text
GET /api/admin/accounts?q=&type=&status=&registeredFrom=&registeredTo=&page=&pageSize=
```

The provider does not forward client sort input. The server owns the fixed
`registeredAt DESC, id ASC` order. Supported page sizes are 25, 50, and 100.

`getManagedAccount(accountId)` calls the explicit account-detail route.
Ordinary React Admin `getOne` may delegate only to that method; it must not
reuse a list row as complete detail. Moderation history is nested in detail and
has no global list endpoint.

### Filter bar

The filter bar contains:

- keyword: account reference, display name, or email, submitted on Enter or explicit Search;
- account type: All, Candidates, Recruiters;
- registration date from/to: inclusive in the Admin's displayed local date,
  serialized as date-only values;
- lifecycle status: All, Active, Suspended; and
- Reset filters.

Invalid ranges stay client-side with a field error and issue no request. Any
filter change returns to page 1. Search input is trimmed but not case-folded by
the browser; the server owns normalization.

### List projection

Every row shows account reference, display name, masked email, registration date/time, account
type, lifecycle status, and the type-specific counts:

- Candidate: total CVs and submitted applications;
- Recruiter: Active, Pending Review, Rejected, Draft, and Closed job postings.

Recruiter classification comes from current qualifying company authority, not
from a user-editable role field. Suspended accounts retain their classification.
Counts show an explicit unavailable state if aggregation fails; unavailable is
never rendered as zero. The table displays the page `calculatedAt` freshness.

The list supports loading skeleton, populated, empty-current-filter, recoverable
error, and authority-lost states. Retry preserves filters and page in memory.
Mobile presentation becomes labeled stacked rows without changing field order
or omitting counts.

### Detail projection

Account detail repeats the authoritative identity, type, status, registration,
version, counts, and freshness. Recruiter detail also lists each visible
company authority with membership and verification state. Candidate detail does
not reveal CV content, application content, or Candidate Profile fields.

The moderation panel receives explicit `canSuspend`, `canRestore`,
`protectedAdministrator`, and safe `reasonCode` fields. The UI never infers
eligibility from labels or hides a server denial. A current Platform
Administrator shows a non-actionable explanation directing the operator to the
separate authority-revocation workflow.

## Group 2 — Business verification approval

### Queue operations and defaults

`verification-requests.getList` maps to
`GET /api/admin/verification-requests`. The initial view is
`state=PENDING_REVIEW&applicantEligibility=ACTIVE_ONLY`, ordered oldest
submission first. Supported filters are lifecycle state, applicant eligibility
(Active only, Suspended only, Any), company keyword, exact tax code, submission
date/age, applicant reference, and read-only assignment metadata.

Queue rows show applicant reference, company name, tax code, lifecycle state,
applicant eligibility, submitted time/age, resubmission count, assignment when
present, and version. They never include evidence content, capability, storage
location, internal safety response, or protected notes.

A suspended applicant is excluded by default but discoverable through the
operational filter. Suspension does not change the request state or pause any
deadline.

### Review detail

`getVerificationReview(requestId)` composes:

- applicant reference and current Active/Suspended eligibility;
- company name, tax code, new/existing-company target, and prerequisite state;
- current license evidence metadata and protected viewer;
- resubmission/evidence version history;
- prior decision history, including legacy Changes Requested history;
- current read-only assignment and protected internal notes; and
- server-produced `canDecide` plus safe block reason.

Evidence preview opens only through the protected route. Images support zoom,
pan, reset, and alternative metadata. PDFs use the pinned PDF.js viewer with
page navigation, zoom, keyboard operation, and a protected download only when
the current capability permits it. Unsupported, inaccessible, deleted, failed
safety, and viewer-load states show safe recovery guidance without a locator.

### Decision controls

Feature 009 exposes exactly two current actions: Approve and Reject. Claim,
Unassign, Reassign, Request changes, generic edit, and delete controls are not
rendered. Historical Changes Requested and Resubmitted entries remain readable.

Approve uses a confirmation dialog that summarizes the company and the
authority effect. An optional protected note is allowed. Submit remains disabled
until the reviewed request/evidence version and all server eligibility facts are
present; the server rechecks every fact transactionally.

Reject requires one allowlisted category and an applicant-visible normalized
reason of 10–500 characters. A separate optional protected note is clearly
labeled as Admin-only. The UI previews the applicant-visible content and never
copies the protected note into the email payload.

While submitting, both actions are disabled and the dialog cannot create a
second command. Success refetches queue/detail, announces the resulting state,
and shows `Email queued` plus `In-app notification queued` from the same
verification outcome. Delivery retry/failure is shown per channel without
changing the committed decision. Validation errors stay attached to fields.
Version, evidence, company
prerequisite, duplicate-authority, or applicant-status conflicts force a detail
refetch and require a new deliberate confirmation.

A suspended applicant keeps the detail readable but both decisions disabled.
After restoration the UI refetches; it enables a decision only if the request is
still qualified Pending Review. It never restores expired/deleted evidence or
resets a deadline.

## Group 3 — Suspension and restoration

### Entry and dialogs

Suspend is offered only for an Active eligible account. Restore is offered only
for a Suspended eligible account. Both are blocked for every current Platform
Administrator, including the acting Admin, and remain blocked if the client has
stale eligibility.

Both dialogs require an allowlisted category and a normalized 10–500-character
reason/note. They identify the target using display name plus masked email,
describe the immediate account-state effect, and require explicit confirmation.
The Suspend dialog states that sessions will end but existing applications,
jobs, memberships, verification records, CV records, and scoring data are not
deleted. The Restore dialog states that no new session is created.

`suspendManagedAccount` and `restoreManagedAccount` call the explicit command
routes. A protected-administrator response closes no authority gap: the UI
refetches, displays the safe action block, and provides no way to revoke Admin
authority inside this feature.

### Result and cross-workflow presentation

On success, account detail shows the authoritative state/version, correlation
reference, and `Security email queued`. Email delay/failure never changes the
account result and does not create an in-app notification. Suspended-login UI is
derived independently from current account state and shows the support/dispute
destination without disclosing the internal rationale.

Suspension does not hide already-visible job postings. It blocks new actions by
the suspended Candidate/Recruiter through shared server boundaries. Other
authorized Recruiters may continue permitted processing of existing company
applications; the Admin UI must not imply those independent records were
frozen or transferred.

### Moderation history and rationale

The account timeline shows allowlisted Suspend/Restore events with actor
reference, action, prior/resulting state, category, success/denial/failure,
time, and correlation. Historical `ACCOUNT_REINSTATED` events render as
Restore; new commands use `ACCOUNT_RESTORED`.

Plaintext rationale is never included in list/detail/history responses. An
explicit reveal uses the existing fresh-proof protected rationale route, is
memory-only, and shows unavailable after the 365-day retention boundary. The UI
does not cache, print, export, or place rationale text in telemetry.

## Errors and recovery

- `400`: retain safe field errors and current input.
- `401`: clear caches and enter the existing authentication/fresh-proof flow.
- `403`: clear protected state before authority-loss navigation.
- `404`: show the generic not-found/not-disclosable state.
- `409`: refetch authoritative detail; never silently replay against a new
  version.
- `410`: close the evidence viewer and show evidence unavailable.
- `423`: show the server's safe protected-account or suspended-applicant block.
- transport/`5xx`: preserve non-sensitive dialog input in memory and allow an
  explicit retry with the same key only while the original outcome is unknown.

No UI path treats email delivery failure, worker delay, or read-aggregate
failure as permission to fabricate a successful secondary effect.

## Accessibility and responsive contract

All controls have programmatic names, visible focus, keyboard access, and
logical focus return after dialogs/viewers. Status is conveyed by text plus
color. Tables retain headers on desktop; stacked mobile records retain labels.
Dialog validation and command outcomes use an announced live region without
moving focus unexpectedly. Evidence zoom is not the sole means to access file
metadata. The target is WCAG 2.2 AA with automated axe checks and manual
keyboard/screen-reader verification for all three groups.

## Implementation order

Provider and UI work follows Group 1, then Group 2, then Group 3. A group's
contract, repository/service tests, UI states, accessibility checks, and
acceptance evidence must pass before implementation advances to the next group.
