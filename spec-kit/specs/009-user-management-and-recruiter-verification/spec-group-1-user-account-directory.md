# Speckit — Group 1: User Account Directory

**Feature Branch**: `009-user-management-and-recruiter-verification`  
**Created**: 2026-08-12  
**Status**: Planned — Ready for implementation review  
**Input**: Admin — User Management & Recruiter Verification, Functional Group 1
— User Account Directory. Produce only this group's full written specification;
defer Business Verification Approval and Account Suspension & Restoration until
Group 1 has been reviewed and confirmed. Produce no implementation output.

## Scope

This specification covers Group 1, the Platform Administrator's
read-only directory of registered Candidate and Recruiter-enabled accounts.
It defines the list layout, search and filters, pagination, account detail
views, activity counts, UI states, data model, privacy boundaries, and
acceptance criteria.

Business Verification Approval and Account Suspension & Restoration are later
functional groups and are intentionally not specified in this document. Group
1 may display the current account state and recruiter classification but MUST
NOT change either one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Find an account in the directory (Priority: P1)

As a Platform Administrator, I want to browse and narrow the complete account
directory so that I can locate a Candidate or Recruiter account quickly.

**Why this priority**: Reliable account discovery is the foundation for later
verification, moderation, suspension, and support workflows.

**Independent Test**: Seed accounts with mixed classifications, registration
dates, and account states. Open the directory, apply each filter independently
and in combination, and verify membership, ordering, counts, and pagination
without opening a detail view.

**Acceptance Scenarios**:

1. Given an authorized Platform Administrator opens the directory, when the
   first page loads, then the combined view shows every registered account at
   most once, ordered by registration date descending and account ID ascending
   as the deterministic tie-breaker.
2. Given an account has both Candidate and Recruiter classifications, when the
   administrator views the combined list, then both labels are shown and the
   account contributes only one row and one result to the total.
3. Given the administrator selects Candidates only, when the filter is applied,
   then every returned account retains Candidate identity and has no current
   approved recruiter authority.
4. Given the administrator selects Recruiters only, when the filter is applied,
   then every returned account has current approved recruiter authority,
   including an account whose account lifecycle is Suspended, while an account
   with only a pending or rejected verification request is excluded.
5. Given a keyword matches an account ID, display name, or email, when the
   administrator applies the search, then matching rows are returned using
   case-insensitive matching after trimming outer whitespace.
6. Given a registration date range is supplied, when the administrator applies
   it, then both boundary calendar dates are inclusive.
7. Given the administrator selects Active or Suspended status, when the status
   filter is applied, then only accounts with that account lifecycle status
   are returned; posting and verification statuses do not alter this filter.
8. Given a keyword or filter changes, when results refresh, then pagination
   resets to page 1, active values remain visible, and the total reflects the
   new query.
9. Given more results exist than fit on one page, when the administrator uses
   first, previous, next, last, or page-size controls, then the requested page
   is shown without duplicates or omissions at page boundaries.

### User Story 2 — Inspect Candidate account activity (Priority: P1)

As a Platform Administrator, I want to open a Candidate account and see its
registration and participation counts so that I can understand the account's
history before a later administrative action.

**Why this priority**: Candidate activity is necessary context for support, trust,
and future moderation decisions.

**Independent Test**: Open a Candidate-only account, a Recruiter-enabled account,
and an account with no CVs or submitted applications. Compare displayed fields
with authoritative seeded records and verify that unrelated private data is
not disclosed.

**Acceptance Scenarios**:

1. Given a Candidate account is selected, when its detail view opens, then it
   shows the common fields and Candidate fields in the Account Detail Field
   Set.
2. Given a Candidate has no CVs or submitted applications, when the detail view
   opens, then each applicable count is shown as 0, not blank, unknown, or
   omitted.
3. Given a Recruiter-enabled account is opened from All accounts or Recruiters
   only, when the detail view loads, then the base Candidate identity, CV count,
   and submitted-application count remain visible and Recruiter is an
   additional label.
4. Given an application draft has never been submitted, when counts are
   calculated, then it is excluded from the submitted-application count.

### User Story 3 — Inspect Recruiter account activity (Priority: P1)

As a Platform Administrator, I want to open a Recruiter account and see its
company authority and job-posting counts by status so that I can understand
its operational footprint.

**Why this priority**: Job-posting activity is the primary operational context
for Recruiter accounts before verification or moderation workflows are used.

**Independent Test**: Seed a Recruiter with jobs in Active, Pending Review,
Rejected, Draft, and Closed states, including multiple company associations
and a Recruiter with no jobs. Verify detail values and aggregation rules.

**Acceptance Scenarios**:

1. Given a Recruiter account is selected, when its detail view opens, then it
   shows the common fields, authority summary, company authority list, and all
   five job-posting status counts in the Account Detail Field Set.
2. Given a Recruiter has no job postings, when the detail view opens, then
   Active, Pending Review, Rejected, Draft, and Closed each display 0.
3. Given a Recruiter has postings across more than one company, when counts
   are calculated, then each posting is counted once, counts aggregate across
   recruiter-authorized companies, and each included company authority is
   identified without exposing unrelated activity.
4. Given a Recruiter account is Suspended, when its detail view opens, then
   the account remains inspectable, Suspended is prominent, and historical
   counts are not silently reset to zero.
5. Given a job or account changes while the detail view is open, when the
   administrator refreshes, then counts reflect the newly authoritative state
   and a failed refresh is not represented as zero.

### User Story 4 — Read the directory safely and accessibly (Priority: P2)

As a Platform Administrator, I want clear loading, empty, error, and
responsive states so that I do not mistake missing data for zero activity.

**Why this priority**: Administrative decisions depend on accurate, private, and
understandable information.

**Independent Test**: Exercise loading, no results, failed list and detail reads,
keyboard-only navigation, and desktop and narrow-screen layouts. Verify that
each state is understandable and retryable.

**Acceptance Scenarios**:

1. Given a directory or detail read is in progress, when the page is rendered,
   then a loading state communicates progress and does not present placeholder
   counts as factual zeroes.
2. Given filters produce no accounts, when the query completes, then an
   explicit no-results state names the active context and offers Clear filters.
3. Given a list or detail read fails, when the failure is displayed, then a
   non-sensitive error and Retry action are available while current filter
   values are retained.
4. Given the administrator uses only a keyboard, when they operate filters,
   pagination, and View details, then every control is reachable in a logical
   order with visible focus and a meaningful accessible name.
5. Given the directory is viewed at a narrow supported width, when a row
   contains required identity and activity information, then the layout
   remains usable without color-only interpretation or inaccessible hidden
   values.

## UI States and Layout

### Directory list

The directory opens in the All accounts view with no keyword, no registration
date range, no status restriction, and a default page size of 25 rows.

On desktop, the directory uses a data-dense table. On narrow screens it uses
stacked labeled rows or cards. Both presentations expose the same values and
the same View details action.

| Field | Display rule |
|---|---|
| Account | Display name, masked email, and stable administrator-facing account reference |
| Account type | Candidate and, when applicable, Recruiter; both may be present |
| Registered | Registration date in the administration console's standard format |
| Status | Active or Suspended with a text label and non-color visual cue |
| Candidate activity | CVs: N; Applications submitted: N |
| Recruiter activity | Active: N; Pending Review: N; Rejected: N; Draft: N; Closed: N |
| Action | View details |

Candidates only shows accounts that do not currently have approved recruiter
authority. Recruiters only shows recruiter-enabled accounts and retains their
base Candidate identity. In the combined view, a dash means a metric is not
applicable to that classification; numeric `0` means the metric applies and no
records exist.

### Search, filters, and pagination

The filter area provides:

- Keyword, matching account reference, display name, and normalized email. A
  match does not reveal the unmasked email in the result.
- Account type: All accounts, Candidates only, or Recruiters only.
- Registration date from and registration date to, both inclusive and each
  optional.
- Account status: All statuses, Active, or Suspended.
- Apply filters and Clear filters actions.

The directory supports page sizes of 25, 50, and 100 rows. It displays the
current range, total result count, and First, Previous, Next, and Last
controls. A control that cannot act is visibly unavailable and cannot be
activated by pointer or keyboard input.

### Account Detail Field Set

Every account detail view shows exactly:

- Account reference
- Display name
- Masked email address
- Account type labels: Candidate and/or Recruiter
- Account status: Active or Suspended
- Registration date

Candidate accounts additionally show:

- Total CVs
- Total submitted applications

Recruiter accounts additionally show:

- Recruiter authority status: Verified recruiter authority, or Suspended
  account with verified recruiter authority
- Company authority list: company name, recruiter membership role, and
  membership status for each visible company association
- Job postings — Active
- Job postings — Pending Review
- Job postings — Rejected
- Job postings — Draft
- Job postings — Closed

Recruiter counts aggregate across all companies for which the account has
recruiter authority. The view does not display business-license files, tax
code evidence, passwords, session tokens, full IP addresses, authentication
factors, private moderation notes, or unrelated users' private activity.

Email masking preserves the domain. For a local part with two or more Unicode
characters, only its first character remains visible and the rest is replaced
with `***`; a one-character local part is displayed as `***`.

### State definitions

- Initial loading: data is being retrieved; no factual counts are shown.
- Loaded: requested rows or fields are available with a read timestamp.
- Updating: existing results remain visible while a new query is retrieved,
  with an indication that the read is being refreshed.
- No results: the query succeeded but matched no account.
- Read error: data could not be confirmed; Retry is available and zeroes are
  not substituted.
- Suspended account: the account remains readable to an authorized
  administrator with a persistent text status indicator. No suspension or
  restoration control is exposed by this group.

## Data Model

This Group 1 read model refines the suggested model to match the project's
base-Candidate plus company-authority model.

### UserAccount

- id: stable administrator-facing account reference
- display_name
- email
- registered_at
- status: ACTIVE or SUSPENDED
- candidate_identity: present for every normal account
- recruiter_authority: derived classification for at least one approved
  recruiter authority association; not a replacement for Candidate

### RecruiterAuthority

- account_id
- company_id
- company_name
- membership_role
- membership_status
- verification_reference to the approved RecruiterVerification relationship

Group 1 reads only the relationship needed for classification and display. It
does not display the verification document, tax code, or review comment.

### CandidateActivitySummary

- account_id
- cv_count
- submitted_application_count
- observed_at

CV count is the number of CV records associated with the account. Submitted
application count includes applications that reached the submitted state and
excludes drafts.

### RecruiterActivitySummary

- account_id
- active_job_count
- pending_review_job_count
- rejected_job_count
- draft_job_count
- closed_job_count
- observed_at

Each job belongs to exactly one displayed current status for counting. Counts
aggregate across the account's recruiter-authorized company associations.

### DirectoryQuery

- keyword
- account_type: ALL, CANDIDATE, or RECRUITER
- registered_from
- registered_to
- account_status: ALL, ACTIVE, or SUSPENDED
- page
- page_size: 25, 50, or 100

### Recruiter-verification compatibility

The Candidate-side recruiter-verification flow remains authoritative for its
application lifecycle. Group 1 consumes only the resulting current approved
company authority needed for classification and display. It does not define a
review queue, inspect submitted company evidence, or infer Recruiter status
from a pending or rejected request.

## Requirements *(mandatory)*

### Functional Requirements

- FR-001: The system MUST restrict the directory and detail views to an
  authenticated Platform Administrator with current administration authority.
  Denied users MUST receive no rows, counts, or detail fields.
- FR-002: The system MUST preserve the project's model in which every normal
  account has a base Candidate identity and Recruiter is an additional
  verified company-authority classification, not a replacement role.
- FR-003: The combined view MUST return each registered account at most once,
  even when it has both classifications or multiple company authorities.
- FR-004: The directory MUST support All accounts, Candidates only, and
  Recruiters only. Candidates only MUST return accounts without current
  approved recruiter authority. Recruiters only MUST return accounts with
  current approved recruiter authority, including accounts whose account
  lifecycle is Suspended, and MUST exclude accounts with only pending or
  rejected verification requests.
- FR-005: Keyword search MUST match account reference, display name, or email
  case-insensitively after trimming outer whitespace.
- FR-006: The directory MUST support an inclusive registration date range with
  either boundary optional and MUST reject a start date after the end date.
- FR-007: The status filter MUST support All statuses, Active, and Suspended,
  and MUST refer only to account lifecycle status.
- FR-008: Keyword, account type, date range, and status filters MUST combine
  with AND semantics. Any query change MUST reset pagination to page 1.
- FR-009: Default ordering MUST be registration date descending with account
  reference ascending as deterministic tie-breaker.
- FR-010: The directory MUST support page sizes 25, 50, and 100 and show the
  current range, total count, and first/previous/next/last navigation state.
- FR-011: Candidate activity counts MUST include total CV records and
  applications that reached submitted state. Unsubmitted drafts MUST be
  excluded from submitted applications.
- FR-012: Recruiter activity counts MUST report job postings exactly once by
  current status: Active, Pending Review, Rejected, Draft, or Closed. Records
  outside these statuses MUST NOT be silently assigned to a displayed count.
- FR-013: Recruiter counts MUST aggregate across the account's recruiter-
  authorized companies, and detail MUST identify each included company and
  recruiter membership role.
- FR-014: Every applicable zero count MUST display 0. A dash is reserved for a
  metric that is not applicable to the selected account classification.
- FR-015: Candidate detail MUST show exactly the common fields, masked email,
  total CVs, and total submitted applications in the Account Detail Field Set.
- FR-016: Recruiter detail MUST show exactly the common fields, authority
  summary, company authority list, and five job-posting counts in the field set.
- FR-017: Detail MUST show the current authoritative account status and retain
  historical activity counts when an account is Suspended.
- FR-018: List and detail MUST distinguish Initial loading, Loaded, Updating,
  No results, and Read error, and MUST NOT show an unconfirmed count as zero.
- FR-019: A failed read MUST provide Retry, retain current filters where
  possible, and MUST NOT reveal internal error details or sensitive data.
- FR-020: The directory MUST expose text labels, visible keyboard focus,
  accessible names, and a logical keyboard path through filters, rows, detail,
  and pagination.
- FR-021: The directory MUST remain usable at supported desktop, tablet, and
  narrow-screen widths with required values and View details available without
  color-only interpretation.
- FR-022: Group 1 MUST be read-only. It MUST NOT approve or reject verification,
  grant or remove recruiter authority, suspend or restore an account, edit
  account data, or create notifications or moderation decisions.
- FR-023: The directory MUST NOT display business-license files, tax-code
  evidence, passwords, authentication factors, session tokens, full IP
  addresses, unmasked email addresses, private moderation notes, or unrelated
  users' activity. Email masking MUST follow the Account Detail Field Set rule.
- FR-024: Group 1 MUST use the authoritative account lifecycle and recruiter-
  authority sources so later approved verification and account-state decisions
  are reflected after the next confirmed read.
- FR-025: List and detail results MUST provide a visible read timestamp or
  equivalent freshness indication and a retry or refresh path.

## Edge Cases

- A Recruiter-enabled account appears in Recruiters only and once in All
  accounts, but not in Candidates only; its detail still identifies the base
  Candidate identity.
- A Suspended Recruiter remains in Recruiters only; its status and historical
  counts remain visible.
- An account with pending or rejected verification but no approved authority
  appears as Candidate, not Recruiter.
- Multiple company authorities produce one account row, one authority entry per
  company, and aggregated job counts without double-counting a posting.
- No CVs, submitted applications, or job postings produce zeroes for every
  applicable count.
- A malformed or reversed date range is rejected before results are replaced.
- Punctuation, mixed case, or outer whitespace in a keyword follows the search
  normalization rules and is not echoed into an unsafe context.
- A filter reduces the result set below the current page; the view returns page
  1 rather than an empty page that resembles a data failure.
- A record changes between list and detail reads; detail shows the later
  confirmed state with its read timestamp.
- An unavailable count source produces Read error or an explicitly unavailable
  metric, never a fabricated zero.
- Equal registration timestamps use account reference ordering for stable pages.
- An unauthorized or expired session reveals neither rows nor account existence.
- Records removed under an approved retention process are not displayed as live
  accounts or with deleted private data.

## Acceptance Criteria

- AC-001: All accounts returns each seeded account once; Candidates only and
  Recruiters only return exactly the populations defined by FR-004.
- AC-002: Keyword, type, date range, and status filters match their defined
  semantics and combine without losing another filter.
- AC-003: Inclusive boundaries, reversed ranges, empty results, and page
  navigation produce the outcomes defined in the user stories.
- AC-004: Candidate detail shows registration date, status, CV count, and
  submitted-application count, including explicit zero values.
- AC-005: Recruiter detail shows registration date, authority summary, company
  authority list, and Active, Pending Review, Rejected, Draft, and Closed job
  counts, including explicit zero values.
- AC-006: A Recruiter-enabled account is not duplicated and a multi-company
  account does not double-count a job posting.
- AC-007: Loading, updating, no-results, and read-error states are
  distinguishable; failed data is never rendered as zero.
- AC-008: Suspended accounts remain readable with clear status and no suspension
  or restoration action is available from Group 1.
- AC-009: Non-administrator access receives no account data and prohibited
  fields in FR-023 never appear; allowed email values follow the masking rule.
- AC-010: Keyboard-only and narrow-screen checks complete filter, pagination,
  and View details tasks with visible focus and non-color cues.
- AC-011: Group 1 interaction tests leave verification, authority, account
  status, account data, notifications, and moderation records unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- SC-001: In a seeded directory of at least 10,000 accounts, at least 18 of 20
  uncoached administrators locate a known account using keyword and filters
  within 2 minutes on the first attempt.
- SC-002: In 100% of combined-view tests, each account appears once and
  Recruiter-enabled accounts are correctly represented in both type views
  without changing the combined total.
- SC-003: In 100% of seeded detail tests, CV/application and job-posting
  status counts match authoritative records, including zero and multi-company
  cases.
- SC-004: Confirmed directory search and filter results become usable within 2
  seconds at P95 in the documented validation environment.
- SC-005: At least 18 of 20 uncoached administrators identify an account's
  registration date, lifecycle status, and applicable activity counts from
  detail on the first attempt.
- SC-006: 100% of tested failures, unauthorized requests, and stale reads
  avoid prohibited fields and never present an unconfirmed value as zero.
- SC-007: All controls and detail navigation are keyboard operable with
  visible focus, and the approved accessibility check reports no serious or
  critical violations for Group 1 views.
- SC-008: 100% of Group 1 interaction tests leave verification state, recruiter
  authority, account status, account data, notifications, and moderation
  records unchanged.
- SC-009: The initial authenticated directory page becomes usable within 3
  seconds at P95 in the documented validation environment.

### Validation Protocol

- Performance validation uses at least 10,000 accounts with Candidate-only,
  recruiter-enabled, Active, Suspended, zero-activity, long-name, equal-time,
  and multi-company cases. In one fixed release-equivalent environment, each
  measured interaction type uses exactly 20 warm-ups followed by exactly 200
  measurements across 10 concurrent authenticated administrator sessions. The
  evidence records environment, dataset state, measurement boundary, duration,
  nearest-rank P95, maximum latency, unplanned error count and rate, and relevant
  external conditions; an unplanned error rate above 1% fails the validation.
- Initial-page timing starts when authenticated directory navigation begins and
  ends on the first rendered frame where the result region and primary filter
  controls are visible and operable. Query timing starts when an accepted search
  or filter change is applied and ends on the first rendered frame containing
  the confirmed rows, range, total, and operative pagination controls.
- Usability validation uses exactly 20 participants who can use the product
  language, did not implement or review this feature, and have not seen the
  study materials. Ten primarily use desktop/laptop layouts and ten primarily
  use narrow-screen layouts. Raw completion time, correctness, first-attempt
  result, device cohort, and aggregate outcome are retained without unnecessary
  personal data.

## Assumptions

- Every normal registered account has a Candidate identity. Recruiter is a
  verified company-authority classification layered on top of it.
- Recruiters only includes accounts with current approved recruiter authority.
  Candidates only includes accounts without that authority. Both classifications
  retain base Candidate identity; pending or rejected applicants remain in the
  Candidates-only result until authority is approved.
- Account status is limited to Active and Suspended for this directory. Another
  authorized workflow owns transitions; Group 1 only reads and displays them.
- Canonical job-posting labels are Active, Pending Review, Rejected, Draft, and
  Closed.
- CV count includes stored CV records. Submitted-application count includes
  applications that reached submitted state and excludes drafts.
- The administration console's standard date format and timezone already exist;
  date boundaries are interpreted as calendar dates in that standard.
- Existing authentication, Platform Administrator authorization, privacy,
  audit, and retention policies are reused; Group 1 creates no second access
  mechanism.

## Dependencies and Out of Scope

### Dependencies

- Existing account, Candidate profile/CV, application, recruiter authority,
  company membership, verification, and job-posting records.
- The Platform Administrator console and its server-enforced authorization
  boundary.
- The Candidate-side recruiter-verification lifecycle and approved-authority
  outcome, which Group 1 reads but does not define or change.
- The authoritative UserAccount lifecycle and audit trail, which Group 1 reads
  but does not define or change.

### Out of Scope

- Creating, editing, deleting, merging, or impersonating accounts.
- Approving, rejecting, requesting changes to, or resubmitting verification.
- Viewing or adjudicating tax-code or business-license evidence.
- Suspending, restoring, banning, or unlocking accounts.
- Suspending or removing company memberships or recruiter authority.
- Managing jobs, reviewing applications, changing CVs, or editing profiles.
- Dashboard analytics beyond the per-account counts required by this directory.
- Bulk actions, exports, saved searches, automated moderation, and AI-based
  account classification.
