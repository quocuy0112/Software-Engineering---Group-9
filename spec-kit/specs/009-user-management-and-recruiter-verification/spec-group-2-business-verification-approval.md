# Speckit — Group 2: Business Verification Approval

**Feature Branch**: `009-user-management-and-recruiter-verification`  
**Created**: 2026-08-12  
**Status**: Planned — Ready for implementation review  
**Input**: Admin — User Management & Recruiter Verification, Functional Group 2
— Business Verification Approval. Specify the review queue, protected
application detail, business-license review, Approve/Reject decisions, required
rejection reason, resulting authority, lifecycle, audit, and notifications.
Produce no implementation output.

## Scope

This specification covers the Platform Administrator's review of Candidate-
submitted Become a Recruiter applications. It begins when a submitted request
has entered the shared verification lifecycle and ends when the administrator
commits Approve or Reject, or the request becomes non-actionable through an
existing lifecycle outcome.

Group 2 defines:

- the review queue, filters, ordering, pagination, and exact row fields;
- the protected application detail and business-license viewer;
- the company, tax-code, relationship, evidence, submission, and decision facts
  available to an administrator;
- Approve and Reject decisions;
- company membership, verification, evidence, audit, and notification outcomes;
- compatibility with Candidate-side status, correction history, and Reapply as
  Recruiter.

Group 2 does not define Candidate-side submission forms, account suspension,
company-team administration, job-post management, or automated legitimacy
decisions. Approval is an explicit human decision and grants only company-
scoped authority; the applicant's base Candidate identity remains unchanged.

## Clarifications

### Session 2026-08-12

- Q: May an administrator approve or reject a verification request while the applicant account is SUSPENDED? → A: No. Suspension makes the request temporarily non-actionable without adding or changing its verification lifecycle state; existing deadlines continue, and restoration returns it to review only if it is still PENDING_REVIEW with current qualified, accessible evidence.

## Shared Lifecycle Contract

The Candidate-side Become/Reapply as Recruiter flow and this administrator flow
use one verification lifecycle:

| State | Meaning | Group 2 decision availability |
|---|---|---|
| PENDING_CHECKS | Current evidence is undergoing safety and reviewability checks | None |
| PENDING_REVIEW | Current evidence passed all required checks and awaits human review | Approve or Reject only while the applicant account is ACTIVE |
| CHANGES_REQUESTED | Existing correction guidance awaits applicant action | None |
| RESUBMITTED | A replacement submission was accepted and is returning to checks | None; never actionable |
| APPROVED | Company-scoped recruiter authority was granted | Terminal |
| REJECTED | The current request was rejected | Terminal; Reapply creates a new request |
| CANCELLED | The applicant cancelled an eligible non-terminal request | Terminal |
| EXPIRED | The request ended after an applicable deadline | Terminal |

Group 2 exposes only Approve and Reject. CHANGES_REQUESTED and RESUBMITTED are
retained solely because they already exist in the shared Candidate-side
lifecycle and history. This group does not introduce or redefine a Request
changes action.

After REJECTED, Reapply as Recruiter creates a new request in PENDING_CHECKS
with a new request reference. It does not reopen, overwrite, or erase the
rejected request or its decision history.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Prioritize the pending review queue (Priority: P1)

As a Platform Administrator, I want a queue of reviewable recruiter
applications so that I can process legitimate pending work in a fair and stable
order.

**Why this priority**: Unsafe evidence and non-actionable requests must never be
mistaken for approval-ready work.

**Independent Test**: Seed every lifecycle state with qualified, pending,
unsafe, superseded, expired, and inaccessible evidence. Verify default queue
membership, filters, ordering, exact row fields, totals, and pagination without
opening a request.

**Acceptance Scenarios**:

1. **Given** a request is PENDING_CHECKS and any required evidence check has not
   passed, **When** the default queue loads, **Then** the request is absent and
   no administrator decision is available.
2. **Given** the current evidence version passes malware, declared-versus-
   detected file type, structural integrity, and preview safety checks, **When**
   the request becomes PENDING_REVIEW, **Then** it appears once in the default
   queue.
3. **Given** multiple PENDING_REVIEW requests, **When** the queue loads, **Then**
   the oldest actionable request appears first and request reference ascending
   resolves equal submission times.
4. **Given** state, submitted date or age, company name, exact normalized tax
   code, applicant reference, and assignment filters, **When** any combination
   is applied, **Then** filters combine with AND semantics and pagination resets
   to page 1.
5. **Given** more than 25 matches, **When** the administrator changes page or
   selects 25, 50, or 100 rows, **Then** the correct slice and matching total
   appear without duplicate or omitted boundary records.
6. **Given** an APPROVED, REJECTED, CANCELLED, or EXPIRED request, **When** a
   matching historical-state filter is selected, **Then** the request remains
   inspectable but is not presented as pending or actionable.
7. **Given** a PENDING_REVIEW request whose applicant account is SUSPENDED,
   **When** the default queue loads, **Then** it is excluded from actionable
   results and remains available through an Applicant suspended operational
   filter without changing verification lifecycle state.

### User Story 2 — Review company facts and evidence safely (Priority: P1)

As a Platform Administrator, I want to inspect submitted company information,
the normalized tax code, and qualified business-license evidence so that I can
make an informed human legitimacy decision.

**Why this priority**: Approval grants access to company and Candidate data, so
the reviewer needs sufficient evidence without exposing the document publicly.

**Independent Test**: Open a new-company request, existing-company requests
with valid and invalid relationship prerequisites, a request with historical
submissions, and a request whose viewer becomes unavailable. Verify exact
detail fields, viewer states, decision gates, history, and privacy boundaries.

**Acceptance Scenarios**:

1. **Given** a PENDING_REVIEW request, **When** an authorized administrator
   opens detail, **Then** every field in the Application Detail Field Set and
   the current submission version are shown.
2. **Given** current PDF, PNG, or JPEG evidence passed every required check,
   **When** an administrator with fresh step-up proof previews or downloads it,
   **Then** only the current authorized copy is returned without a public or
   reusable document URL.
3. **Given** the normalized tax code matches an existing verified company,
   **When** detail loads, **Then** the administrator sees the allowed company
   match, a non-secret active-membership summary, and the validity and scope of
   the relationship prerequisite for the exact applicant, request, and role.
4. **Given** prior submission versions exist, **When** history is viewed,
   **Then** version, evidence state, applicant-visible outcomes, and decision
   history remain traceable while superseded evidence content cannot be opened.
5. **Given** current evidence is unsafe, indeterminate, superseded, deleted, or
   unavailable, **When** preview or decision is attempted, **Then** the content
   remains unavailable and Approve and Reject cannot commit.
6. **Given** current administrator authority, the designated administration
   session, or fresh step-up proof is absent, expired, suspended, or revoked,
   **When** protected evidence is requested, **Then** access is denied before
   protected content is displayed.

### User Story 3 — Approve a legitimate application (Priority: P1)

As a Platform Administrator, I want to approve a legitimate application so
that the applicant receives exactly the intended company-scoped recruiter
authority and can proceed to the Recruiter workspace.

**Why this priority**: Approval is the trust-boundary decision that enables
recruiter operations.

**Independent Test**: Approve a new-company request and an existing-company
request, then retry and concurrently repeat each decision. Verify request,
company, membership, Candidate identity, evidence, audit, and notification
outcomes.

**Acceptance Scenarios**:

1. **Given** a PENDING_REVIEW request for a legal company not known by its
   normalized tax code, **When** an administrator with fresh step-up proof
   explicitly confirms approval, **Then** one verified ACTIVE company, one
   ACTIVE OWNER membership, and one APPROVED request outcome are established.
2. **Given** a request for an existing verified company, **When** an unused,
   unrevoked, unexpired relationship prerequisite scoped to the exact
   applicant, company, request, and role is valid at confirmation, **Then** one
   ACTIVE membership with the approved role is created or restored and the
   prerequisite is consumed.
3. **Given** the existing-company prerequisite is absent, expired, mismatched,
   revoked, or consumed, **When** approval is attempted, **Then** no authority
   is granted and no company-private data beyond the allowed match summary is
   disclosed.
4. **Given** the applicant already has the intended ACTIVE membership, **When**
   approval is attempted, **Then** duplicate authority is not created and the
   current authoritative state is shown.
5. **Given** approval commits, **When** Group 1 or the Candidate-side status
   view refreshes, **Then** Candidate identity remains present, recruiter
   authority becomes visible, and the applicant sees APPROVED, decision time,
   company, approved role, and Recruiter workspace as the next action.
6. **Given** duplicate, retried, stale, or concurrent decisions target the same
   reviewed version, **When** one outcome commits, **Then** no duplicate company,
   membership, decision, audit success, or notification event is created and a
   later reviewer must refresh.
7. **Given** the applicant account becomes SUSPENDED before approval commits,
   **When** current account state is revalidated, **Then** approval is denied,
   no authority is granted, and the request lifecycle state remains unchanged.

### User Story 4 — Reject an invalid application and enable reapplication (Priority: P1)

As a Platform Administrator, I want to reject an invalid application with a
clear applicant-visible reason so that no recruiter authority is granted and
the applicant can submit a corrected new application.

**Why this priority**: Rejection must protect the platform while providing an
understandable and traceable recovery path.

**Independent Test**: Attempt rejection with missing and invalid inputs, every
allowed category, an optional private note, stale evidence, a retry, and a
concurrent approval. Verify validation, terminal state, evidence handling,
authority, audit, notifications, privacy, and Reapply behavior.

**Acceptance Scenarios**:

1. **Given** a PENDING_REVIEW request, **When** Reject is selected, **Then** one
   allowed category and an applicant-visible reason of 10–500 normalized
   Unicode characters are required before confirmation.
2. **Given** the category or required reason is absent or invalid, **When**
   rejection is attempted, **Then** request, evidence, company, membership,
   notification, and audit-success state remain unchanged.
3. **Given** valid rejection input and fresh step-up proof, **When** rejection
   commits, **Then** the request becomes terminal REJECTED, no company or
   membership is granted, and Candidate identity remains unchanged.
4. **Given** rejection commits, **When** evidence handling begins, **Then** all
   evidence for that request becomes inaccessible immediately and is deleted
   within 24 hours.
5. **Given** an optional private note is supplied, **When** the outcome is read,
   **Then** the note is visible only in protected administrator history and is
   absent from applicant messages, audit-event context, URLs, analytics, and
   ordinary logs.
6. **Given** the applicant uses Reapply as Recruiter after rejection, **When**
   corrected company facts and evidence are accepted, **Then** a new
   PENDING_CHECKS request is created and the rejected request remains terminal
   and traceable.
7. **Given** the applicant account becomes SUSPENDED before rejection commits,
   **When** current account state is revalidated, **Then** rejection is denied
   and the request, evidence, decision, and notification state remain unchanged.

### User Story 5 — Recover from delayed, unavailable, and stale review state (Priority: P2)

As a Platform Administrator, I want explicit unavailable and conflict states so
that I never decide using incomplete or stale evidence.

**Why this priority**: Safe failure is preferable to granting recruiter
authority from unconfirmed information.

**Independent Test**: Inject delayed safety checks, a continuous viewer outage,
expired step-up proof, failed notification delivery, a stale reviewed version,
and browser history after authorization revocation. Verify deadlines, disabled
actions, retry paths, authoritative state, and absence of protected content.

**Acceptance Scenarios**:

1. **Given** a request remains PENDING_CHECKS for 15 minutes, **When** the
   deadline is reached, **Then** exactly one delay event is created; if it
   remains there for 24 hours, it becomes EXPIRED, evidence becomes
   inaccessible, and a new application is permitted.
2. **Given** qualified evidence becomes continuously unavailable during
   PENDING_REVIEW, **When** 15 minutes elapse, **Then** decisions remain disabled
   and the issue is escalated; at 24 hours one delay event is created, and at 72
   hours the request becomes EXPIRED without granting authority.
3. **Given** a reviewer submits a decision for a stale request or submission
   version, **When** current state is checked, **Then** no decision commits and
   the detail view requires refresh.
4. **Given** a decision and notification event commit but delivery is delayed,
   **When** delivery is retried, **Then** the decision remains effective and no
   duplicate applicant message event is created.
5. **Given** administrator authority is revoked or the session ends, **When**
   Back, Forward, or reload is used, **Then** previously displayed evidence and
   protected request details are not rendered.
6. **Given** a suspended applicant is restored, **When** the request remains
   PENDING_REVIEW and its current evidence remains qualified, accessible, and
   within every existing deadline, **Then** it becomes actionable again without
   a new request or lifecycle transition; otherwise its authoritative current
   state and recovery path are shown.

## UI States and Layout

### Review queue

The default page is Pending review and shows PENDING_REVIEW requests only.
Administrators may explicitly choose another lifecycle state for historical or
operational inspection.

Filters are State, applicant account eligibility (Active applicants, Applicant
suspended, or Any), submitted date or age, company name, exact normalized tax
code, applicant reference, assignment (Unassigned, Mine, Any), Apply filters,
and Clear filters. The queue defaults to 25 rows and supports 25, 50, and 100,
with current range, matching total, First, Previous, Next, and Last controls.

Every queue row shows exactly:

| Field | Display rule |
|---|---|
| Request | Stable administrator-facing verification reference |
| Applicant | Stable account reference and display name |
| Company | Submitted legal company name |
| Tax code | Exact normalized 10-ASCII-digit Vietnamese tax code |
| Requested role | Candidate-submitted role |
| State | Text lifecycle label with a non-color cue |
| Applicant eligibility | Active applicant or Applicant suspended; this is not a verification lifecycle state |
| Submission | Current version and resubmission count |
| Assignment | Assigned administrator reference or Unassigned |
| Waiting since | Original submission time and calculated age |
| Action | Review details; no inline decision |

Document content, evidence access references, private notes, and internal safety
findings do not appear in queue rows.

### Application Detail Field Set

The detail view shows exactly:

- request reference;
- applicant account reference and display name;
- submitted legal company name;
- exact normalized tax code;
- requested role and current lifecycle state;
- original submission time and latest update time;
- current submission version and resubmission count out of three;
- assigned administrator reference or Unassigned;
- existing-company match: none, or matched company reference, legal name, and
  verification state;
- non-secret active membership summary needed to identify duplicate authority;
- existing-company relationship prerequisite type, exact scope, state, and
  expiry when applicable;
- current evidence metadata: version, declared and detected media type, byte
  size, and four qualified-check results;
- protected preview and authenticated download actions for current qualified
  evidence;
- submission history and evidence accessibility state by version;
- decision history: actor reference, reviewed version, prior/resulting state,
  action, allowed category or approved role, result, and time; and
- protected private notes visible only to authorized administrators.

### Protected document viewer

The viewer distinguishes Closed, Loading, Viewable, Downloading, Unavailable,
and Unauthorized. A viewable multipage document supports page navigation and a
viewable image supports usable zoom. Loading, Unavailable, and Unauthorized
states expose no decision action.

The viewer never exposes a public document URL and never persists raw evidence,
a reusable access capability, or derived preview content in browser-persistent
storage, analytics, or ordinary logs.

### Decision panel

Approve and Reject are available only for the current PENDING_REVIEW version
when the applicant account is ACTIVE and current evidence is qualified and
accessible.

Approve requires an approved membership role, an explicit confirmation of the
company and resulting authority, fresh step-up proof, and—when joining an
existing company—a valid scoped relationship prerequisite at the decision
boundary.

Reject requires one allowed category, an applicant-visible reason of 10–500
normalized Unicode characters, an optional protected private note of at most
2,000 characters, explicit confirmation of the terminal result and evidence
handling, and fresh step-up proof.

The decision view distinguishes Ready, Validation error, Evidence unavailable,
Step-up required, Confirmation open, Decision in progress, Decision succeeded,
Stale conflict, and Decision failed.

## Data Model

### RecruiterVerification

- id: stable request reference
- recruiter_id: Candidate applicant account reference
- company_name
- tax_code: exact normalized 10-ASCII-digit Vietnamese tax code
- license_file_url: private evidence reference, never a public URL
- status: PENDING_CHECKS, PENDING_REVIEW, CHANGES_REQUESTED, RESUBMITTED,
  APPROVED, REJECTED, CANCELLED, or EXPIRED
- requested_role
- target_company_id, optional
- prerequisite_id, optional
- current_submission_version
- resubmission_count: 0 through 3
- assigned_admin_id, optional
- admin_comment: applicant-visible rejection reason when REJECTED
- reviewed_by and reviewed_at, optional until decision
- state_version: current version used to reject stale decisions
- created_at and updated_at

The fields recruiter_id, company_name, tax_code, license_file_url, status,
admin_comment, reviewed_by, and reviewed_at are the shared cross-module field
names required by the Candidate-side flow.

### BusinessLicenseEvidence

- verification_id
- submission_version
- declared_media_type and detected_media_type
- byte_size
- malware_check
- file_type_check
- structural_integrity_check
- preview_safety_check
- reviewable_at
- content_inaccessible_at
- delete_after
- superseded_at and created_at

Accepted Candidate submissions are PDF, PNG, or JPEG containing 1 through
5,000,000 bytes inclusive. Evidence becomes reviewable only when all four
required checks pass.

### CompanyRelationshipPrerequisite

- applicant_id
- company_id
- verification_id
- approved_role
- kind: Invitation or current OWNER approval
- state
- expires_at
- consumed_at

It is valid only for its exact applicant, company, request, and role and must be
current, unused, unrevoked, and unexpired when approval commits.

### VerificationDecision

- verification_id and submission_version
- acting_admin_id
- prior_status and resulting_status
- action: APPROVE or REJECT
- approved_role for approval
- rejection_category for rejection
- result, decision_time, and correlation_reference

Decision history excludes raw evidence, applicant-visible reason text, private
note text, credentials, and administrator session identifiers.

### VerificationPrivateNote

- verification_id
- author_admin_id
- normalized_text: at most 2,000 Unicode characters
- created_at

The note is visible only to a current authorized administrator and is never
sent to the applicant or copied into ordinary telemetry.

### RecruiterAuthorityOutcome

- company_id and company_verification_state
- recruiter_id
- membership_role
- membership_status
- source_verification_id
- granted_at

New-company approval uses OWNER. Existing-company approval uses only the role
authorized by the relationship prerequisite. Candidate identity remains
present.

### VerificationNotificationEvent

- verification_id
- event_kind: VERIFICATION_APPROVED, VERIFICATION_REJECTED,
  VERIFICATION_DELAYED, or VERIFICATION_EXPIRED
- resulting_status and event_time
- allowed applicant-visible content and next_action
- per-channel delivery state
- idempotency reference

It excludes private notes, evidence access references, administrator identity,
internal safety signals, and company-private facts not needed by the applicant.

## Requirements *(mandatory)*

### Functional Requirements

- **G2-FR-001**: Every queue, detail, evidence, and decision access MUST require
  a current ACTIVE account, current Platform Administrator authority, and the
  designated administration-authorized session.
- **G2-FR-002**: Evidence preview/download and Approve/Reject MUST require a
  successful administrator step-up proof within the preceding 15 minutes.
- **G2-FR-003**: The default queue MUST contain only PENDING_REVIEW requests
  whose applicant account is ACTIVE and whose current evidence version passed
  all four required checks.
- **G2-FR-004**: Queue filters MUST support state, submitted date or age,
  applicant account eligibility, company, exact normalized tax code, applicant
  reference, and assignment with AND semantics and page-1 reset after a query
  change.
- **G2-FR-005**: The default queue MUST order oldest actionable request first,
  then request reference ascending, default to 25 rows, and support 25, 50, and
  100 with stable range and total information.
- **G2-FR-006**: Queue rows MUST show exactly the Review queue fields and MUST
  NOT expose document content, evidence access references, private notes, or
  internal safety findings.
- **G2-FR-007**: Detail MUST show exactly the Application Detail Field Set and
  MUST identify the current reviewed submission version.
- **G2-FR-008**: The protected viewer MUST expose only the current evidence
  version that passed every check and MUST never expose unsafe, indeterminate,
  superseded, deleted, or inaccessible evidence.
- **G2-FR-009**: Business-license content and access references MUST be absent
  from public URLs, browser-persistent storage, analytics, ordinary logs,
  applicant notifications, and audit context.
- **G2-FR-010**: Approve and Reject MUST be unavailable unless the request is
  PENDING_REVIEW, the applicant account is ACTIVE, the reviewed version is
  current, evidence is qualified and accessible, and authority plus step-up
  proof are current.
- **G2-FR-011**: New-company approval MUST establish exactly one verified
  ACTIVE company and one ACTIVE OWNER membership, finalize APPROVED, and
  preserve Candidate identity.
- **G2-FR-012**: Existing-company approval MUST require a current, unused,
  unrevoked, unexpired relationship prerequisite scoped to the exact applicant,
  company, request, and approved role at the decision boundary.
- **G2-FR-013**: Permitted existing-company approval MUST create or restore
  exactly one ACTIVE membership with the approved role, consume the
  prerequisite, avoid duplicate authority, finalize APPROVED, and preserve
  Candidate identity.
- **G2-FR-014**: Reject MUST require exactly one category from
  DOCUMENT_UNREADABLE, TAX_ID_MISMATCH, DOCUMENT_EXPIRED,
  COMPANY_INFORMATION_MISMATCH, DUPLICATE_OR_CONFLICTING_REQUEST,
  POLICY_INELIGIBLE, or OTHER.
- **G2-FR-015**: Reject MUST require an applicant-visible reason of 10–500
  normalized Unicode characters and MAY accept one protected private note of
  at most 2,000 characters; invalid input MUST be rejected without truncation.
- **G2-FR-016**: Valid rejection MUST finalize REJECTED, grant no company or
  membership authority, preserve Candidate identity, make all request evidence
  inaccessible immediately, and delete it within 24 hours. Superseded evidence
  and evidence for CANCELLED or EXPIRED requests MUST follow the same immediate-
  inaccessibility and 24-hour deletion rule.
- **G2-FR-017**: REJECTED MUST be terminal. Reapply MUST create a new
  PENDING_CHECKS request without reopening, mutating, or erasing rejected
  history.
- **G2-FR-018**: Approval and rejection MUST each establish the request
  transition, company or membership effect when applicable, decision history,
  required audit event, and exactly one idempotent notification event as one
  consistent business outcome; otherwise prior business state MUST remain
  unchanged.
- **G2-FR-019**: Approval communication MUST include APPROVED, decision time,
  company, approved role, Recruiter workspace as next action, and confirmation
  that Candidate identity remains unchanged.
- **G2-FR-020**: Rejection communication MUST include REJECTED, decision time,
  category, applicant-visible reason, and Reapply as Recruiter as next action.
- **G2-FR-021**: Applicant status plus configured email and in-app channels
  MUST receive one idempotent decision outcome and MUST exclude private notes,
  administrator identity, internal signals, evidence, and storage locations.
- **G2-FR-022**: Decision history and audit MUST preserve actor reference,
  request/submission version, prior/resulting state, action, category or role,
  result, time, and correlation reference while excluding raw evidence, reason
  text, private-note text, credentials, and administrator session identifiers.
- **G2-FR-023**: Duplicate, retried, stale, and concurrent decisions MUST
  produce at most one authoritative outcome and notification event; later
  reviewers MUST refresh instead of overwriting it.
- **G2-FR-024**: A request still in PENDING_CHECKS at 15 minutes MUST create
  exactly one delay event; at 24 hours it MUST become EXPIRED, make evidence
  inaccessible, and permit a new application.
- **G2-FR-025**: During continuous PENDING_REVIEW evidence unavailability,
  decisions MUST remain disabled, escalation MUST occur at 15 minutes, exactly
  one delay event MUST be created at 24 hours, and EXPIRED MUST occur at 72
  hours without granting authority.
- **G2-FR-026**: Queue, detail, viewer, and decisions MUST distinguish Loading,
  Loaded, Empty, Evidence unavailable, Validation error, Step-up required,
  Stale conflict, Decision in progress, Decision succeeded, and Decision failed.
- **G2-FR-027**: Every Group 2 state and interaction MUST be keyboard operable,
  visibly focused, meaningfully named, and understandable without color alone.
- **G2-FR-028**: Group 2 MUST expose only Approve and Reject decisions and MUST
  NOT redefine CHANGES_REQUESTED or RESUBMITTED behavior.
- **G2-FR-029**: Group 2 MUST NOT suspend or restore accounts, administer
  memberships outside an approval outcome, manage jobs or applicants, edit
  submitted company facts, mutate verification assignment, make automated
  legitimacy decisions, or grant authority from a tax-code match alone.
- **G2-FR-030**: All protected content and decision outcomes MUST be revalidated
  against current administrator authority and request state; browser history or
  previously displayed content MUST NOT bypass current denial.
- **G2-FR-031**: Applicant account suspension MUST make a verification request
  non-actionable without changing its verification lifecycle state or pausing
  existing checking, outage, expiry, evidence-validity, or deletion deadlines.
  After restoration, it MUST become actionable again only if it remains
  PENDING_REVIEW with current qualified and accessible evidence; no new request
  or lifecycle transition is created merely by suspension or restoration.

## Edge Cases

- A request reaches PENDING_REVIEW while an old PENDING_CHECKS list is visible;
  refresh reveals one actionable row without duplication.
- Three evidence checks pass while one is pending, failed, or indeterminate;
  the request remains non-reviewable.
- Declared and detected media types differ; content is not exposed.
- The current submission version changes after detail opens; a decision is
  rejected as stale and the new version must be inspected.
- The applicant cancels before a decision commits; CANCELLED wins and the stale
  decision cannot overwrite it, and its evidence follows the immediate-
  inaccessibility and 24-hour deletion rule.
- Two administrators choose identical or different outcomes concurrently; one
  transition wins and every later attempt refreshes.
- A tax code begins with zero; its exact ten-character sequence is retained.
- A company match exists but its prerequisite belongs to another applicant,
  company, request, or role; approval is denied without private disclosure.
- A prerequisite expires, is revoked, or is consumed while confirmation is
  open; approval is denied at the decision boundary.
- The applicant already has an ACTIVE membership; no duplicate is created.
- A SUSPENDED or REMOVED membership exists; only the explicitly approved exact
  association and role may be restored by a valid approval outcome.
- A new-company applicant requested RECRUITER; initial authority is OWNER because
  the applicant establishes the legal company.
- Evidence becomes unavailable while confirmation is open; no partial decision
  commits.
- A rejection reason contains markup, prohibited control characters, or more
  than 500 normalized characters; it is rejected without truncation.
- Notification delivery is delayed after commit; authority and request state
  remain effective and no duplicate notification event is created.
- A submission version is superseded or a request becomes EXPIRED; affected
  evidence becomes inaccessible immediately and is deleted within 24 hours.
- Browser history is used after authority revocation; protected content is not
  restored from a prior view.
- The applicant becomes SUSPENDED while detail or confirmation is open; both
  decisions fail current-state revalidation without changing request state.
- A suspended applicant is restored after the request expired or its evidence
  became invalid or inaccessible; restoration does not revive the request or
  reset any deadline.

## Acceptance Criteria

- **G2-AC-001**: Only qualified PENDING_REVIEW requests appear in the default
  queue, oldest first with stable pagination.
- **G2-AC-002**: Every queue filter returns exactly matching requests and list
  rows expose no document content or access reference.
- **G2-AC-003**: Detail shows every specified applicant, company, tax-code,
  prerequisite, evidence, submission, decision, assignment, and note field.
- **G2-AC-004**: Only current qualified evidence is previewable or downloadable
  by a current administrator with fresh step-up proof.
- **G2-AC-005**: New-company approval creates one verified ACTIVE company and
  one ACTIVE OWNER membership, finalizes APPROVED, and preserves Candidate
  identity.
- **G2-AC-006**: Existing-company approval succeeds only with a valid exact-
  scope prerequisite and creates or restores one membership without duplicate
  authority.
- **G2-AC-007**: Reject cannot commit without an allowed category and valid
  applicant-visible reason, and a valid rejection grants no authority.
- **G2-AC-008**: Rejection finalizes REJECTED, immediately prevents evidence
  access, preserves Candidate identity, and enables Reapply through a new
  request.
- **G2-AC-009**: Approve and Reject each produce one consistent state,
  authority, decision, audit, and notification outcome; retries and concurrency
  produce no duplicates.
- **G2-AC-010**: Applicant communications contain only the allowed resulting
  state, decision facts, and next action and no private note, administrator
  identity, evidence reference, or internal signal.
- **G2-AC-011**: Processing and viewer outage deadlines disable unsafe
  decisions, create one defined delay event, expire without authority, and
  permit the specified recovery.
- **G2-AC-012**: Keyboard-only, narrow-screen, and accessibility checks complete
  queue, detail, viewer, confirmation, conflict, and retry tasks with no serious
  or critical violation.
- **G2-AC-013**: A SUSPENDED applicant's request retains its lifecycle state but
  cannot be approved or rejected; restoration returns it to actionable review
  only when it still satisfies every PENDING_REVIEW evidence and deadline gate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **G2-SC-001**: During a documented qualification run of at least 100 clean,
  complete documents with 10 concurrent submissions and no declared checking
  outage, at least 90% become available in the review queue within 2 minutes.
- **G2-SC-002**: At least 18 of 20 uncoached administrators open, review, and
  correctly approve or reject a representative request within 3 minutes on the
  first attempt.
- **G2-SC-003**: In 100% of approval tests, exactly one intended membership is
  ACTIVE, no duplicate company or authority exists, and Candidate identity
  remains present.
- **G2-SC-004**: In 100% of existing-company tests, an absent, expired,
  mismatched, revoked, or consumed prerequisite prevents membership creation
  and reveals no company-private data.
- **G2-SC-005**: In 100% of rejection tests, input validation is enforced, no
  authority is granted, evidence becomes inaccessible immediately, and Reapply
  creates a new request without changing rejected history.
- **G2-SC-006**: In 100% of stale, duplicate, retry, and concurrent-decision
  tests, at most one authoritative decision, authority change, audit success,
  and notification event exists.
- **G2-SC-007**: In 100% of injected PENDING_CHECKS outages, one delay event
  exists by 15 minutes and EXPIRED is reached by 24 hours; during continuous
  PENDING_REVIEW viewer outage, decisions remain disabled, escalation occurs by
  15 minutes, one delay event exists by 24 hours, and EXPIRED is reached by 72
  hours.
- **G2-SC-008**: Automated privacy checks find zero raw documents, reusable
  evidence capabilities, storage locations, private notes, administrator
  identities, credentials, or internal safety signals in public URLs, browser-
  persistent storage, analytics, ordinary logs, applicant notifications, or
  audit context.
- **G2-SC-009**: All core Group 2 tasks are keyboard-completable with visible
  focus and non-color state labels, and approved automated accessibility checks
  report zero serious or critical violations.
- **G2-SC-010**: Queue/filter and detail navigation become usable within 2
  seconds at P95 in the documented validation environment containing at least
  1,000 open or historical requests and 10 concurrent administrators.
- **G2-SC-011**: The initial authenticated Group 2 page becomes usable within 3
  seconds at P95 in the documented validation environment.
- **G2-SC-012**: In 100% of suspension-before-decision and restoration tests,
  no decision commits for a SUSPENDED applicant, no verification state changes
  merely because of account suspension/restoration, no deadline resets, and
  only still-qualified PENDING_REVIEW requests become actionable again.

### Validation Protocol

- Performance validation uses exactly 20 warm-ups followed by exactly 200
  measurements for initial page load and 200 for queue/filter or detail
  navigation across 10 concurrent authenticated administrator sessions.
  Evidence records environment, dataset state, timing boundary, duration,
  nearest-rank P95, maximum latency, unplanned error count/rate, and external
  conditions. More than 1% unplanned errors fails validation.
- Initial timing starts at authenticated Group 2 navigation and ends on the
  first rendered frame where queue context and primary controls are operable.
  Interaction timing starts when an accepted queue/filter/detail action begins
  and ends on the first rendered frame with confirmed result and controls.
- Usability validation uses exactly 20 participants who can use the product
  language, did not implement or review Group 2, and have not seen the study
  materials. Ten primarily use desktop/laptop and ten use narrow-screen layouts.
- Authorization, state correctness, evidence safety, privacy, transactional
  integrity, and deletion deadlines are 100% gates rather than percentile
  targets.

## Assumptions

- The Candidate-side flow is enriched by Feature 014. It supplies the submitted
  and registry business facts, registry source/outcome/check time, exact
  normalized Vietnamese tax code, verified company email and non-decisive
  domain signals, normalized unverified phone, optional normalized website,
  applicant relationship/title/explanation, mismatch explanation, consent
  metadata, requested role, and one PDF, PNG, or JPEG business-license file
  containing 1 through 5,000,000 bytes.
- Feature 014 registry and contact signals support human review only and never
  replace Group 2 evidence, applicant-eligibility, relationship-prerequisite,
  concurrency, or explicit administrator-decision gates.
- Candidate-side status is authoritative for receipt, pending, rejection,
  delay, expiry, cancellation, and Reapply as Recruiter.
- Every normal account retains Candidate identity; recruiter authority is one
  or more company-scoped memberships.
- New-company approval grants OWNER. Existing-company approval grants only the
  role authorized by a valid invitation or current OWNER approval.
- Existing administrator authority, designated session, 15-minute step-up,
  audit, private evidence storage, checking, and notification policies are
  reused.
- Verification assignment is nullable read-only workload metadata populated by
  its separately authorized routing owner. Group 2 may display and filter it but
  exposes no Claim, Unassign, or Reassign action.
- Evidence for APPROVED requests remains available only while its associated
  company verification is ACTIVE; after supersession or deactivation it becomes
  inaccessible immediately and is deleted within 30 days.
- CHANGES_REQUESTED permits at most three replacement submissions under the
  existing Candidate correction flow; Group 2 does not add a correction action.

## Dependencies and Out of Scope

### Dependencies

- Candidate-side Become a Recruiter, correction, cancellation, status, and
  Reapply as Recruiter flows.
- Existing UserAccount, Company, Company Membership, relationship prerequisite,
  RecruiterVerification, BusinessLicenseEvidence, decision history, private
  note, audit, and notification records.
- Private evidence storage, malware checking, type detection, structural
  validation, protected preview, and evidence retention.
- Current Platform Administrator authority, designated administration session,
  and fresh step-up proof.
- Group 1's recruiter-enabled classification after a confirmed approval read.

### Out of Scope

- Candidate-side application or evidence-upload forms.
- Request changes as a Group 2 administrator action.
- Account suspension, restoration, or session management.
- Membership suspension, removal, or company-team management outside a valid
  approval outcome.
- Job moderation, job management, applicant review, recruitment scoring,
  pipelines, analytics, or export.
- Editing submitted company facts during review.
- Claiming, unassigning, or reassigning a verification request.
- Automatic, AI-made, tax-match-only, or report-volume-based decisions.
- Public business-license links or evidence sharing outside protected review.
- Permanent account deletion or personal-data erasure.
