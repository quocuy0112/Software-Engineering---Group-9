# Speckit — Group 3: Account Suspension & Restoration

**Feature Branch**: `009-user-management-and-recruiter-verification`  
**Created**: 2026-08-12  
**Status**: Planned — Ready for implementation review  
**Input**: Admin — User Management & Recruiter Verification, Functional Group 3
— Account Suspension & Restoration. Specify suspension with a required reason,
its effect on Candidate and Recruiter access and existing content, restoration,
audit history, notifications, UI states, data model, edge cases, and acceptance
criteria. Produce no implementation output.

## Scope

This specification covers reversible account-level enforcement for registered
Candidate and recruiter-enabled accounts that do not hold current Platform
Administrator authority. A Platform Administrator can suspend an eligible
ACTIVE account after explicit confirmation and restore an eligible SUSPENDED
account after the issue or dispute has been resolved.

Account suspension affects the person's ability to authenticate and perform
protected actions in every workspace. It does not delete the account, remove
Candidate identity, rewrite company memberships, or silently moderate content.
Restoration permits a new authentication but does not recreate prior sessions
or undo separately imposed membership or content restrictions.

This group defines:

- where Suspend or Restore is available from account detail;
- required reason category, protected rationale, and confirmation;
- account state transitions and immediate session/challenge invalidation;
- what a suspended Candidate or Recruiter can see and cannot do;
- the treatment of existing profiles, applications, postings, and memberships;
- mandatory affected-user security email, delivery failure, and administrator-
  visible status;
- account-moderation audit history, privacy, retention, and concurrency rules.

This group does not suspend or remove individual company memberships, hide or
delete job postings, alter applications, delete accounts, target an account
with current Platform Administrator authority, or make an automated enforcement
decision. Administrator authority must first be revoked through its separately
authorized workflow before the account becomes eligible for Group 3.

## Clarifications

### Session 2026-08-12

- Q: May Group 3 suspend or restore an account that currently holds Platform Administrator authority? → A: No. Group 3 targets only Candidate or recruiter-enabled accounts without current Platform Administrator authority; administrator authority must be revoked through a separate workflow first.
- Q: What happens to public job postings authored by a recruiter whose account is suspended? → A: Their visibility remains governed by the current job-posting, company, and moderation states; account suspension alone does not hide or change them, and any visibility change requires the separate job-moderation workflow.
- Q: May authorized recruiters continue processing applications submitted by a Candidate whose account is SUSPENDED? → A: Yes. Candidate access and actions are blocked, but authorized recruiters may continue viewing and updating existing applications through the normal recruitment workflow; suspension itself causes no automatic application-stage or score change.
- Q: Which affected-user notification channel is required for Suspend and Restore? → A: Email is mandatory for both actions. No in-app notification is created by Group 3; the suspended-login screen independently shows current account status and the approved support/dispute path.

## Account Lifecycle and Effects

### Allowed account transitions

| Current state | Allowed Group 3 action | Result |
|---|---|---|
| ACTIVE | Suspend | SUSPENDED; all sessions and unfinished authentication challenges become unusable |
| SUSPENDED | Restore | ACTIVE; user must authenticate through a new session |

Pending Verification and Deleted are not Group 3 action states. Deleted remains
terminal under the separate account-retention lifecycle.

### Effect matrix

| Area | While SUSPENDED | After Restore |
|---|---|---|
| Authentication | New login and completion of prior authentication challenges are blocked; existing sessions cannot access protected content | New login is permitted; no prior session or challenge is revived |
| Candidate workspace | Protected profile, CV, save, apply, report, application-tracking, and account-management actions are unavailable | Available again subject to current permissions and resource states |
| Public job browsing | Publicly available job information may still be browsed as an unauthenticated visitor | Normal authenticated behavior returns after new login |
| Existing Candidate profile/CVs | Preserved and not publicly exposed by suspension | Preserved state remains available subject to normal permissions |
| Existing applications | Candidate access/actions are blocked; suspension causes no automatic withdrawal, rejection, stage, or score change, while authorized recruiters may continue normal viewing and recruitment actions | The Candidate regains normal access after new login; applications retain any authoritative recruiter-made changes |
| Pending recruiter verification | Verification lifecycle state is preserved; Approve and Reject are unavailable while the account is SUSPENDED and existing deadlines continue | Returns to review only if still PENDING_REVIEW with current qualified, accessible evidence; no deadline resets |
| Recruiter workspace | All recruiter access and in-flight recruiter commands are denied because account state is not ACTIVE | Returns only for memberships that are independently ACTIVE and otherwise authorized |
| Company memberships | Records and roles are preserved; none grants effective access while the account is SUSPENDED | Independently ACTIVE memberships can grant access again; SUSPENDED or REMOVED memberships remain ineffective |
| Existing job postings | Publication and moderation states do not change merely because the author account is suspended; other authorized company members and public viewers follow the posting's own state | Posting states remain unchanged |
| Notifications and audit | One mandatory security-email event and one correlated audit outcome record the committed action; the suspended-login screen independently shows current status and support path | One new mandatory security-email event and one new correlated audit outcome record restoration |

If an administrator must hide a job, suspend a company membership, or change an
application, that action belongs to its separately authorized moderation or
membership workflow and is not implied by account suspension.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Suspend an account safely (Priority: P1)

As a Platform Administrator, I want to suspend an account that violates
community guidelines or presents a security risk so that protected access ends
immediately without destroying evidence or unrelated records.

**Why this priority**: Suspension is the immediate account-wide enforcement
control; an incorrect or partial outcome can leave access open or harm the
wrong user.

**Independent Test**: Suspend ACTIVE Candidate-only and recruiter-enabled
accounts with active sessions, unfinished authentication challenges, multiple
company memberships, active postings, and existing applications. Verify
confirmation, state, access denial, preservation, audit, and notification.

**Acceptance Scenarios**:

1. **Given** an ACTIVE account, **When** a qualified administrator selects an
   allowed reason category, enters a valid protected rationale, and explicitly
   confirms Suspend, **Then** the account becomes SUSPENDED and all existing
   sessions and unfinished authentication challenges become unusable.
2. **Given** the suspended person attempts password login, two-factor
   completion, session reuse, Candidate action, Recruiter action, or
   Administrator action, **When** current account state is evaluated, **Then**
   protected access is denied without creating a new full session.
3. **Given** the account has Candidate profile data, CVs, applications,
   memberships, or job postings, **When** suspension commits, **Then** those
   records retain their authoritative state and no application is rejected, no
   membership is rewritten, and no posting is automatically hidden.
4. **Given** an authorized recruiter has normal access to an existing
   application submitted by the suspended Candidate, **When** the recruiter
   views or performs an allowed recruitment transition, **Then** the normal
   application workflow remains available and the result follows its own
   authorization, transition, audit, and notification rules.
5. **Given** the suspended account has ACTIVE memberships in multiple
   companies, **When** any recruiter command is attempted, **Then** every
   company is inaccessible to that account while membership records remain
   independently unchanged.
6. **Given** suspension commits, **When** the administrator reviews the result,
   **Then** one account-moderation audit outcome, one protected rationale, and
   one security-email event exist under the same correlation reference.

### User Story 2 — Understand the suspended-user experience (Priority: P1)

As a suspended user, I want a clear, privacy-safe explanation and support path
so that I understand that access is locked and how to resolve a dispute without
being shown confidential moderation information.

**Why this priority**: A security control must not look like a password error or
expose internal notes, administrator identity, or investigation details.

**Independent Test**: Attempt login and protected navigation from old and new
devices after suspension, inspect the security notification, browse public job
information, and verify that protected data and private rationale remain
unavailable.

**Acceptance Scenarios**:

1. **Given** a SUSPENDED account submits otherwise correct credentials, **When**
   authentication is attempted, **Then** no full session is created and a
   consistent account-suspended outcome provides the approved support path.
2. **Given** an existing browser session was active before suspension, **When**
   the user requests protected content or uses browser history, **Then** the
   content is not restored and the user is directed to the safe suspended-
   account outcome.
3. **Given** suspension commits, **When** the affected user receives the
   mandatory security email, **Then** it includes SUSPENDED, effective time, a
   non-sensitive reason category, the support/dispute action, and confirmation
   that access is locked, but not the administrator identity or protected
   rationale.
4. **Given** security-email delivery is pending or has failed, **When** the
   suspended person attempts authentication, **Then** the suspended-login
   screen still derives the current account state and shows the approved
   support/dispute path without exposing email-delivery or moderation details.
5. **Given** public job information does not require authentication, **When** a
   suspended user visits it as a public visitor, **Then** browsing follows the
   same public rules as any visitor while Save, Apply, Report, and other
   protected actions remain unavailable.
6. **Given** the suspended account authored active job postings, **When** public
   or other authorized company users view those postings, **Then** visibility
   continues to follow company, posting, and moderation state rather than the
   author's account state alone.

### User Story 3 — Restore a suspended account safely (Priority: P1)

As a Platform Administrator, I want to restore an eligible suspended account
after an issue is resolved so that the person can authenticate again without
reviving obsolete credentials or unrelated authority.

**Why this priority**: Reversible enforcement needs a controlled recovery path
that does not silently undo separate security or company restrictions.

**Independent Test**: Restore SUSPENDED Candidate-only and recruiter-enabled
accounts with revoked sessions and combinations of ACTIVE, SUSPENDED, and
REMOVED memberships. Verify confirmation, new login, authority, preserved
content, audit, and notification.

**Acceptance Scenarios**:

1. **Given** a SUSPENDED account, **When** a qualified administrator selects an
   allowed reason category, enters a valid protected rationale, and explicitly
   confirms Restore, **Then** the account becomes ACTIVE and a new login is
   permitted.
2. **Given** the account had sessions or unfinished challenges before
   suspension, **When** restoration completes, **Then** none becomes usable and
   the user must authenticate through a new session.
3. **Given** the restored account has an independently SUSPENDED or REMOVED
   company membership, **When** the user signs in, **Then** that membership
   remains ineffective and only independently ACTIVE memberships may authorize
   recruiter access.
4. **Given** profile, CV, application, or posting records were preserved during
   suspension, **When** restoration completes, **Then** they retain their
   authoritative state and become accessible only through their normal current
   permissions.
5. **Given** restoration commits, **When** the affected user and administrator
   inspect the outcome, **Then** one ACCOUNT_RESTORED security-email event and
   one correlated audit outcome exist and Group 1 displays ACTIVE after its
   next confirmed read.

### User Story 4 — Prevent unsafe, duplicate, and stale enforcement (Priority: P1)

As a Platform Administrator, I want enforcement safeguards and visible
conflicts so that I cannot target any account with current Platform
Administrator authority or silently overwrite another administrator's action.

**Why this priority**: Account-level enforcement can affect every workspace and
must remain recoverable, attributable, and concurrency-safe.

**Independent Test**: Attempt Suspend and Restore against the acting
administrator and another account with current Platform Administrator
authority, wrong-state actions, invalid rationale, expired step-up proof,
duplicate retry, and concurrent Suspend/Restore from two administrators.

**Acceptance Scenarios**:

1. **Given** the target holds current Platform Administrator authority,
   including when the target is the acting administrator, **When** Suspend or
   Restore is attempted, **Then** it is denied without state change and the
   denied attempt is audited.
2. **Given** administrator authority was revoked through its separately
   authorized workflow, **When** eligibility is evaluated again, **Then** the
   account may be suspended only if it is otherwise an eligible ACTIVE
   Candidate or recruiter-enabled account.
3. **Given** category, rationale, confirmation, or fresh step-up proof is
   missing or invalid, **When** Suspend or Restore is submitted, **Then** no
   account, session, rationale, notification, or audit-success state changes.
4. **Given** two administrators act on the same reviewed account version,
   **When** their outcomes conflict, **Then** at most one transition commits and
   the later reviewer receives current state and must refresh.
5. **Given** a committed action is retried with the same operation identity,
   **When** the retry is processed, **Then** the original result is returned
   without a second transition, rationale, notification event, or audit success.

### User Story 5 — Review moderation history and delivery failures (Priority: P2)

As a Platform Administrator, I want a privacy-safe account-moderation history
and security-email status so that suspension and restoration remain accountable
even when user communication fails.

**Why this priority**: The access decision must remain authoritative while
operations staff can identify an undelivered security message and follow up.

**Independent Test**: Create successful, denied, failed, retried, and concurrent
actions; fail notification delivery permanently and transiently; inspect audit,
protected rationale, retention, and delivery states using current and expired
step-up proof.

**Acceptance Scenarios**:

1. **Given** a committed Suspend or Restore, **When** history is viewed, **Then**
   actor reference, target reference, action, prior/resulting state, reason
   category, result, time, and correlation reference are shown without the
   rationale text in the audit event.
2. **Given** a current administrator with proof no older than 15 minutes opens
   a correlated rationale, **When** access is authorized, **Then** the normalized
   private text is shown without copying it into notification or ordinary
   telemetry.
3. **Given** rationale age reaches 365 calendar days, **When** it is requested,
   **Then** it is inaccessible and deletion completes within the following 24
   hours.
4. **Given** security-email delivery fails transiently, **When** retries occur,
   **Then** no more than five attempts follow the defined schedule and the
   originating account decision remains effective.
5. **Given** delivery fails permanently, exhausts attempts, or reaches 24 hours,
   **When** the administrator views account history, **Then**
   MANUAL_INTERVENTION_REQUIRED, last-attempt time, and a non-sensitive failure
   category are visible without reversing the action.

## UI States and Layout

### Enforcement entry point

Group 3 begins from the Group 1 account detail view. An ACTIVE account exposes
Suspend account; a SUSPENDED account exposes Restore account. The action label
and account state are text-visible and do not depend on color.

No Group 3 action appears for Pending Verification, Deleted, or an account with
current Platform Administrator authority. The account detail shows a clear
non-sensitive explanation that administrator authority must be revoked through
the separate authorized workflow before Group 3 can apply.

### Confirmation dialog

The dialog shows:

- target account reference, display name, masked email, and current state;
- action: Suspend or Restore;
- exactly one required reason category;
- one required protected rationale of 10–500 normalized Unicode characters;
- an impact summary specific to the action;
- Cancel and Confirm actions.

Suspend confirmation states that all sessions and unfinished authentication
challenges will end, new authentication and protected actions will be blocked,
and stored profiles, applications, memberships, and postings will not be
automatically deleted or changed.

Restore confirmation states that new authentication will be permitted, prior
sessions remain revoked, and separately SUSPENDED or REMOVED memberships and
separately moderated content remain unchanged.

### Account moderation history

The history list shows action, prior/resulting account state, selected category,
actor reference, result, timestamp, and correlation reference. A separate View
protected rationale action is available only with current authority and fresh
step-up proof.

The security-email status shows PENDING, RETRYING, DELIVERED, or
MANUAL_INTERVENTION_REQUIRED; attempt count; last attempt; next attempt when
applicable; and one non-sensitive failure category.

### UI states

Group 3 distinguishes Ready, Confirmation open, Validation error, Step-up
required, Action in progress, Action succeeded, Stale conflict, Action failed,
Notification pending, Notification retrying, and Manual intervention required.
Confirmation contains keyboard focus while open, Escape/Cancel makes no change,
and completion or cancellation restores focus to a meaningful account-detail
control.

## Data Model

### UserAccount

- id: stable administrator-facing account reference
- status: ACTIVE or SUSPENDED for Group 3 actions
- state_version: current version used to reject stale actions
- status_changed_at

Candidate identity, profile content, company memberships, applications, and job
postings remain separate authoritative records and are not rewritten by Group 3.

### AccountModerationLog

- account_id
- action: SUSPEND or RESTORE
- prior_status and resulting_status
- reason_category
- admin_id
- result
- timestamp
- correlation_reference

The log is append-only and excludes the rationale text, credentials, session
identifiers, and unnecessary personal data.

### PrivilegedActionRationale

- correlation_reference
- normalized_text: 10–500 Unicode characters
- created_at
- inaccessible_at: 365 calendar days after the action
- delete_after: within 24 hours after becoming inaccessible

It is available only to a current Platform Administrator with step-up proof no
older than 15 minutes and is excluded from affected-user messages, URLs,
analytics, ordinary logs, and audit-event content.

### AccountSecurityNotification

- account_id
- event_kind: ACCOUNT_SUSPENDED or ACCOUNT_RESTORED
- delivery_channel: EMAIL
- resulting_status
- effective_at
- reason_category
- next_action
- idempotency_reference
- delivery_state: PENDING, RETRYING, DELIVERED, or
  MANUAL_INTERVENTION_REQUIRED
- attempt_count, last_attempt_at, next_attempt_at, and delivery_deadline
- failure_category, optional

Group 3 creates no in-app notification record. The authentication experience
derives the suspended-account message and support path from current account
state rather than from email-delivery state.

Allowed failure categories are DESTINATION_REJECTED, DESTINATION_DISABLED,
CONTENT_INVALID, POLICY_REFUSED, TEMPORARY_UNAVAILABLE, and
ATTEMPTS_EXHAUSTED. Notification content excludes the protected rationale,
administrator identity, credentials, session data, and unrelated private data.

## Requirements *(mandatory)*

### Functional Requirements

- **G3-FR-001**: Every Group 3 read and action MUST require a current ACTIVE
  account, current Platform Administrator authority, and the designated
  administration-authorized session; denial MUST reveal no additional target
  data and make no state change.
- **G3-FR-002**: Suspend and Restore MUST require successful administrator
  step-up proof within the preceding 15 minutes; expired, failed, or abandoned
  proof MUST leave business state unchanged.
- **G3-FR-003**: Suspend MUST be available only for an ACTIVE account and Restore
  only for a SUSPENDED account.
- **G3-FR-004**: Each action MUST require explicit confirmation, exactly one
  allowed reason category, and a required protected rationale containing
  10–500 normalized Unicode characters.
- **G3-FR-005**: Allowed reason categories MUST be SECURITY_COMPROMISE,
  POLICY_VIOLATION, USER_REQUEST, VERIFICATION_FAILURE, INCIDENT_RESOLVED,
  ACCESS_CLEANUP, or OTHER.
- **G3-FR-006**: Committed suspension MUST transition ACTIVE to SUSPENDED,
  invalidate every existing session and unfinished authentication challenge,
  block new full sessions, and deny every protected Candidate, Recruiter, and
  Administrator workflow.
- **G3-FR-007**: Suspension MUST preserve Candidate identity, profile/CV data,
  applications, company memberships, job postings, and their histories and MUST
  NOT automatically withdraw, reject, hide, close, remove, reclassify, rescore,
  or change their workflow state. This preservation rule MUST NOT block an
  independently authorized recruiter from viewing or changing an existing
  application through its normal recruitment workflow.
- **G3-FR-008**: While the account is SUSPENDED, recorded memberships MUST grant
  no effective company access but MUST retain their independent role and state.
- **G3-FR-009**: Public job visibility MUST continue to follow company,
  posting, and moderation state; account suspension alone MUST NOT alter that
  visibility.
- **G3-FR-010**: A suspended account MAY access information available to any
  unauthenticated visitor but MUST NOT Save, Apply, Report, edit Profile, manage
  CVs, track private applications, post jobs, manage applicants, or perform any
  other protected action.
- **G3-FR-011**: Committed restoration MUST transition SUSPENDED to ACTIVE and
  permit new authentication without recreating any prior session or unfinished
  challenge.
- **G3-FR-012**: Restoration MUST NOT restore an independently SUSPENDED or
  REMOVED membership, reverse content moderation, change application state, or
  bypass current resource authorization. Suspension and restoration MUST NOT
  change a recruiter-verification lifecycle state or reset its deadlines;
  Group 2 decisions are unavailable while the applicant is SUSPENDED and resume
  only when its own current eligibility gates are satisfied after restoration.
- **G3-FR-013**: The system MUST prevent Group 3 from suspending or restoring
  any account with current Platform Administrator authority, including the
  acting administrator, and MUST audit the denied attempt. Revoking
  administrator authority is a separate prerequisite workflow and is not
  performed by Group 3.
- **G3-FR-014**: Suspend and Restore MUST be idempotent, concurrency-safe, and
  evaluated against current state version; stale conflicting actions MUST NOT
  report success.
- **G3-FR-015**: Suspend and Restore MUST each establish the authoritative state
  transition, invalidation effect when suspending, append-only moderation log,
  protected rationale, and exactly one idempotent security-email event as one
  consistent business outcome; otherwise prior state MUST remain unchanged.
- **G3-FR-016**: The moderation log MUST identify actor, target, action,
  prior/resulting state, reason category, result, timestamp, and correlation
  reference while excluding rationale text, credentials, session identifiers,
  and unnecessary personal data.
- **G3-FR-017**: Protected rationale MUST be separate from audit and notification
  content, available only to a current administrator with proof no older than
  15 minutes, absent from URLs, analytics, and ordinary logs, inaccessible at
  365 calendar days, and deleted within the following 24 hours.
- **G3-FR-018**: Suspension MUST create exactly one mandatory security-email
  event containing SUSPENDED, effective time, non-sensitive reason category,
  support/dispute next action, and confirmation that access is locked.
- **G3-FR-019**: Restoration MUST create exactly one mandatory security-email
  event containing ACTIVE, effective time, non-sensitive reason category, Sign
  in again as next action, confirmation that old sessions remain unusable, and
  notice that separately restricted memberships/content remain unchanged.
- **G3-FR-020**: Affected-user security emails MUST NOT expose protected
  rationale, administrator identity, credentials, session data, internal
  signals, or unrelated personal/company data. Group 3 MUST NOT create an
  in-app notification for Suspend or Restore.
- **G3-FR-021**: The first security-email delivery attempt MUST be due immediately;
  retryable failures MUST schedule attempt 2 after 1 minute, attempt 3 after 5
  minutes, attempt 4 after 30 minutes, and attempt 5 after 2 hours.
- **G3-FR-022**: Permanent delivery failure, failure of attempt 5, or reaching
  24 hours without delivery MUST set MANUAL_INTERVENTION_REQUIRED without
  reversing the account outcome.
- **G3-FR-023**: Account detail/history MUST show notification state, attempt
  count, last attempt, next attempt when applicable, and one allowed non-
  sensitive failure category.
- **G3-FR-024**: The suspended-account user experience MUST distinguish account
  suspension from invalid credentials without exposing confidential moderation
  information and MUST provide the approved support path by reading current
  account state independently of security-email delivery state.
- **G3-FR-025**: Browser Back, Forward, reload, cached pages, and in-flight
  commands MUST revalidate current account state and MUST NOT restore protected
  content or commit after suspension.
- **G3-FR-026**: Group 3 actions, history, confirmations, errors, and delivery
  states MUST be keyboard operable, visibly focused, meaningfully named, and
  understandable without color alone.
- **G3-FR-027**: Confirmation MUST contain focus while open, allow cancellation
  without state change, and restore focus to a meaningful account-detail
  control after cancel, success, or recoverable failure.
- **G3-FR-028**: Group 3 MUST NOT suspend, restore, or remove a company
  membership; moderate a posting; change an application or score; edit profile
  or credential facts; grant/revoke administrator authority; delete an account;
  or make an automated enforcement decision.
- **G3-FR-029**: Group 1 MUST reflect a committed SUSPENDED or ACTIVE state on
  its next confirmed read without independently changing it.
- **G3-FR-030**: Email-provider failure MUST NOT corrupt, delay, or
  reverse a committed suspension or restoration and MUST NOT disable unrelated
  administrator reads.

## Edge Cases

- The target changes from ACTIVE to SUSPENDED while confirmation is open; the
  stale Suspend cannot report a second success.
- One administrator suspends while another attempts Restore based on an older
  state; only the action valid for the authoritative version may commit.
- The target holds current Platform Administrator authority, including when it
  is the acting administrator; Suspend and Restore remain blocked even if
  client state says otherwise.
- Administrator authority is revoked while account detail is open; Group 3
  requires a confirmed refresh and all other eligibility checks before Suspend
  becomes available.
- The rationale becomes invalid after Unicode normalization or exceeds 500
  characters; no action commits and it is not silently truncated.
- Suspension commits while an application, profile save, or recruiter command
  is in flight; the command revalidates account state and cannot commit.
- The account owns or authored the company's only active postings; account
  suspension does not automatically hide them, and separate moderation is
  required if visibility must change.
- Other active company members continue authorized work on preserved postings
  and applications without inheriting the suspended account's identity.
- An application belongs to the suspended Candidate; its stage remains intact
  at suspension time, authorized recruiters retain their normal access, and a
  later authorized recruiter action may change its stage under the application
  workflow's own rules.
- Restoration occurs after a membership was separately suspended or removed;
  that membership remains ineffective.
- Restoration occurs after a posting was separately moderated; posting state
  remains unchanged.
- Security-email delivery fails permanently after suspension; access remains
  blocked and manual intervention becomes visible.
- The user follows an old protected link or uses browser history after
  suspension; no cached protected content is rendered.
- A rationale reaches the retention deadline while an administrator is viewing
  history; subsequent access is denied and deletion follows the hard deadline.
- An account is Deleted through another authorized lifecycle before Restore;
  Restore is rejected because Deleted is terminal.

## Acceptance Criteria

- **G3-AC-001**: Valid Suspend changes ACTIVE to SUSPENDED, invalidates every
  existing session and unfinished challenge, and denies new protected access.
- **G3-AC-002**: Suspension preserves Candidate identity, profiles, CVs,
  applications, memberships, postings, and histories without automatic content
  or recruitment-state changes, while independently authorized recruiters can
  continue the normal workflow for existing applications.
- **G3-AC-003**: A suspended Candidate cannot apply or use another protected
  Candidate action, and a suspended recruiter cannot access any company,
  regardless of preserved membership records.
- **G3-AC-004**: Public posting visibility remains governed by posting, company,
  and moderation state rather than author-account suspension alone.
- **G3-AC-005**: Valid Restore changes SUSPENDED to ACTIVE and permits a new
  login without reviving old sessions, old challenges, restricted memberships,
  or moderated content.
- **G3-AC-006**: Suspend and Restore against every account with current Platform
  Administrator authority, including the acting administrator, are denied,
  audited, and make no target-state change.
- **G3-AC-007**: Invalid category, rationale, confirmation, step-up proof, or
  state version prevents Suspend or Restore from committing.
- **G3-AC-008**: Duplicate, retried, stale, and concurrent actions create at
  most one authoritative transition, protected rationale, audit success, and
  notification event.
- **G3-AC-009**: Audit, rationale, and affected-user security-email projections
  include their exact allowed fields and exclude every prohibited field; Group
  3 creates no in-app notification.
- **G3-AC-010**: Rationale requires current authority and fresh proof, becomes
  inaccessible at 365 days, and is deleted within the next 24 hours.
- **G3-AC-011**: Notification retry and manual-intervention states never reverse
  the committed account lifecycle outcome or duplicate the event.
- **G3-AC-012**: Keyboard-only, narrow-screen, and accessibility checks complete
  Suspend, Restore, confirmation, step-up, history, conflict, and retry tasks
  with no serious or critical violation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **G3-SC-001**: In 100% of tested suspensions, every previously active session
  and unfinished authentication challenge rejects protected use within 2
  seconds of the committed suspension.
- **G3-SC-002**: In 100% of suspended-account tests, no Candidate, Recruiter, or
  Administrator protected action initiated by the suspended account succeeds
  while profile, CV, application, membership, posting, and history records
  receive no automatic mutation from suspension; separately authorized
  recruiters can still view and process an existing application under its own
  workflow rules.
- **G3-SC-003**: In 100% of restoration tests, a new login is possible while all
  pre-suspension sessions remain unusable and no separately SUSPENDED or REMOVED
  membership or moderated content is restored.
- **G3-SC-004**: At least 18 of 20 uncoached administrators locate a target and
  correctly complete Suspend or Restore within 2 minutes on the first attempt,
  with zero action against the wrong account.
- **G3-SC-005**: In 100% of administrator-target, invalid-input, expired-proof,
  stale, retry, and concurrent tests, the safeguards defined by this spec hold
  and no false success is shown.
- **G3-SC-006**: In 100% of authoritative actions and denied high-risk attempts,
  audit validation finds actor, target, action, result, timestamp, and
  correlation reference and finds no rationale text, credential, or session
  identifier.
- **G3-SC-007**: Automated privacy checks find zero protected rationale,
  administrator identity, credentials, session data, internal signals, or
  unrelated private data in public URLs, browser-persistent storage, analytics,
  ordinary logs, or affected-user security emails, and find zero Group 3 in-app
  notification records.
- **G3-SC-008**: In 100% of rationale-retention tests, access requires current
  authority and proof no older than 15 minutes, rationale becomes inaccessible
  at 365 calendar days, and deletion completes within the following 24 hours.
- **G3-SC-009**: In 100% of injected security-email failures, retryable attempts
  follow no more than the five defined attempts, permanent/exhausted failures
  reach MANUAL_INTERVENTION_REQUIRED within 24 hours, and the account outcome
  remains effective.
- **G3-SC-010**: All core Group 3 tasks are keyboard-completable with visible
  focus and non-color state labels, and approved automated accessibility checks
  report zero serious or critical violations.
- **G3-SC-011**: Group 3 account detail and history navigation becomes usable
  within 2 seconds at P95, and its initial authenticated page becomes usable
  within 3 seconds at P95, in the documented validation environment.

### Validation Protocol

- Use at least 1,000 accounts spanning Candidate-only, recruiter-enabled,
  ACTIVE, SUSPENDED, multi-company, active-content, active-session, unfinished-
  challenge, and current-administrator-authority protection cases.
- Performance validation uses exactly 20 warm-ups followed by exactly 200
  measured detail/history interactions and 200 initial page loads across 10
  concurrent authenticated administrator sessions. Evidence records environment,
  dataset state, timing boundaries, duration, nearest-rank P95, maximum latency,
  unplanned error count/rate, and external conditions. More than 1% unplanned
  errors fails validation.
- Initial timing starts at authenticated Group 3 navigation and ends on the
  first rendered frame where account state and the eligible action are operable.
  Interaction timing starts at an accepted detail/history navigation and ends
  when the confirmed content and controls are rendered.
- Usability validation uses exactly 20 participants who can use the product
  language, did not implement or review Group 3, and have not seen the study
  materials. Ten primarily use desktop/laptop and ten use narrow-screen layouts.
- Authorization, session invalidation, state correctness, privacy,
  transactional integrity, audit completeness, and retention deadlines are
  100% gates rather than percentile targets.

## Assumptions

- ACTIVE and SUSPENDED are the Group 3 account states. Suspension is indefinite
  until an authorized restoration; scheduled suspension is deferred.
- Every normal account retains Candidate identity. Recruiter authority is one
  or more company-scoped memberships with an independent lifecycle.
- Existing exclusive authentication, designated administrator session,
  15-minute step-up, session/challenge invalidation, audit, private rationale,
  and security-email policies are reused.
- Public job browsing is allowed without an authenticated account; every
  Candidate or Recruiter mutation remains protected.
- A posting is a company resource whose visibility follows its own company,
  posting, and moderation state, not solely the state of the account that
  authored it.
- The support/dispute destination and public copy are existing approved product
  content; Group 3 does not create a dispute-adjudication workflow.
- Permanent account deletion and legal erasure are separate authorized
  retention workflows.

## Dependencies and Out of Scope

### Dependencies

- Group 1 account search and detail as the enforcement entry point.
- Existing account lifecycle, sessions, unfinished authentication challenges,
  Candidate identity, profiles/CVs, applications, company memberships, job
  postings, audit, protected rationale, and security-email records.
- Current acting and target Platform Administrator authority, designated
  administration session, and fresh step-up proof.
- Existing safe suspended-account guidance and support destination.

### Out of Scope

- Individual session revocation as a separate administrator action.
- Company-membership suspension, restoration, or removal.
- Job hiding, closing, deletion, or moderation.
- Application withdrawal, rejection, stage change, or score change.
- Editing profile, CV, email, password, factor, or account facts.
- Suspension or restoration of an account with current Platform Administrator
  authority; authority revocation belongs to a separate authorized workflow.
- Public administrator promotion or administrator-grant management.
- Automated, AI-made, report-count-based, or scheduled suspension/restoration.
- Permanent account deletion, legal erasure, or email reuse.
- Dispute investigation or adjudication beyond linking the approved support
  path.
