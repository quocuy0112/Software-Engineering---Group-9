# Feature Specification: Administrator Job-Post Review and Approval

**Feature Branch**: `017-admin-management-job-posting`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Preserve the existing job-post content persistence mechanism and add a complete workflow in which a recruiter submits a job for review, active Platform Administrators receive an in-app notification, an Administrator reviews the complete submitted posting, and explicitly approves or rejects it. Follow Spec Kit in English, resolve every analysis severity before implementation, and stop before implementation for review."

## Clarifications

### Session 2026-08-15

- Q: How should unassigned job-review work be distributed and assigned? → A: Notify every currently eligible Platform Administrator, let the first successful claim become the sole assignee, and require explicit audited reassignment.
- Q: What should happen when a Recruiter materially edits an active approved posting? → A: Create a distinct pending review version and keep the latest approved version public until the replacement version is approved.
- Q: What feedback is required when an Administrator rejects a posting? → A: Require one stable Recruiter-visible reason code and a bounded safe explanation, while storing any private Administrator note separately and excluding it from all Recruiter notifications and views.
- Q: Who receives the approval or rejection outcome when the original submitter loses company access? → A: Notify the submitter only while that person retains qualifying membership; otherwise send no direct detail and expose the outcome only to currently authorized company members in the protected workspace.
- Q: Which company information belongs in the full job-review detail? → A: Show the complete submitted job snapshot and a safe current company/submitter eligibility summary; link to the existing protected verification viewer when separately authorized, but never copy protected evidence into the review or notification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a Job for Review (Priority: P1)

As an authorized Recruiter, I can submit a complete draft job posting for Administrator review so that the posting cannot become publicly active without an explicit human quality decision.

**Why this priority**: Submission establishes the protected review boundary. Without a durable pending state and an exact submitted version, no later Administrator action can be trusted.

**Independent Test**: Create a complete draft as an authorized company member, submit it once and concurrently, and verify that exactly one reviewable pending version is created, the Recruiter sees the pending state, and incomplete or unauthorized submissions do not enter the queue.

**Acceptance Scenarios**:

1. **Given** an authorized Recruiter, an active verified company, and a complete draft, **When** the Recruiter submits the posting, **Then** one exact version enters `Pending Review`, editing of that submitted version is blocked, and it remains unavailable to the public.
2. **Given** the same submission is repeated or raced, **When** the requests complete, **Then** they converge on one pending review version without duplicate review work or notifications.
3. **Given** a draft is incomplete, the company is not active and verified, or the actor lacks an active qualifying membership, **When** submission is attempted, **Then** no review work is created and the Recruiter receives actionable safe feedback.
4. **Given** an active approved posting is materially edited, **When** the Recruiter requests publication of the edit, **Then** the edited version enters review while the last approved version remains the only public version until a new approval.

---

### User Story 2 - Discover and Claim Pending Job Reviews (Priority: P1)

As a Platform Administrator, I receive a timely in-app alert and can open a prioritized pending-job queue so that new submissions are not missed or reviewed twice.

**Why this priority**: A pending state without an actionable Administrator queue leaves the P0 publication workflow incomplete.

**Independent Test**: Submit a posting with multiple active and inactive Administrator grants, verify recipient isolation and one alert per eligible Administrator, open the linked queue item, and prove that concurrent claims result in one current assignee.

**Acceptance Scenarios**:

1. **Given** a posting enters `Pending Review`, **When** the submission commits, **Then** every currently eligible Platform Administrator receives one generic in-app review alert within the notification freshness target.
2. **Given** an Administrator opens the alert, **When** its destination loads, **Then** the alert is marked read and the Administrator reaches the exact protected job-review record.
3. **Given** two eligible Administrators attempt to claim the same unassigned review, **When** both commands complete, **Then** exactly one becomes the assignee and the other sees the current authoritative assignment.
4. **Given** an expired, revoked, or inactive Administrator grant, **When** notifications and queue data are resolved, **Then** that account receives no new alert and cannot read or mutate review data.

---

### User Story 3 - Review the Complete Submission and Decide (Priority: P1)

As the assigned Platform Administrator, I can inspect the complete submitted job and its safe company context, then explicitly approve or reject the exact version so that only reviewed content becomes public.

**Why this priority**: Human approval and complete review evidence are the core quality and accountability controls for job publication.

**Independent Test**: Open a claimed review, compare every submitted field with safe company facts and prior approved content, approve and reject separate fixtures, and verify state, visibility, concurrency, reason, history, and audit outcomes.

**Acceptance Scenarios**:

1. **Given** an assigned pending review, **When** its detail opens, **Then** the Administrator sees every submitted job field, the submitting company and actor references, safe current verification and membership status, the submitted version, and any prior-approved comparison without private evidence being copied into the review.
2. **Given** the exact pending version and a still-qualified company, **When** the assigned Administrator approves it, **Then** that version becomes the active approved public version exactly once and the decision is auditable.
3. **Given** the exact pending version, **When** the assigned Administrator rejects it with a required safe reason, **Then** it becomes `Rejected`, remains non-public, and preserves both Recruiter-visible feedback and separately protected Administrator notes.
4. **Given** the review changed, was already decided, lost assignment, or no longer matches the expected version, **When** an Administrator submits a decision, **Then** the command makes no conflicting state change and returns the current safe state.
5. **Given** the company or submitting membership becomes ineligible before approval, **When** approval is attempted, **Then** approval is blocked, the posting remains non-public, and the failed decision attempt is auditable.

---

### User Story 4 - Receive the Outcome and Resubmit Safely (Priority: P1)

As the submitting Recruiter, I receive the decision, can understand a rejection, and can revise and resubmit without losing the immutable review history.

**Why this priority**: Recruiter feedback and recovery complete the human review loop; otherwise rejection becomes a dead end and approval is not visibly confirmed.

**Independent Test**: Approve and reject postings, verify outcome recipient isolation and navigation, revise a rejected posting, resubmit it, and prove that the new version is distinct while every earlier submission and decision remains traceable.

**Acceptance Scenarios**:

1. **Given** a submitted posting is approved or rejected, **When** the decision commits, **Then** the submitting Recruiter receives one in-app outcome notification with a safe link to the posting and no private Administrator note.
2. **Given** a rejected posting, **When** the Recruiter opens it, **Then** the Recruiter sees the required public reason and bounded explanation but no private review data.
3. **Given** the Recruiter corrects a rejected posting, **When** it is resubmitted, **Then** a new pending version and new review work are created while prior versions, decisions, reasons, actors, and timestamps remain immutable.
4. **Given** the original submitter no longer has access to the company, **When** an outcome is produced, **Then** no cross-tenant content is disclosed and an eligible company authority can still discover the posting state through the company workspace.

### Edge Cases

- A posting is submitted while its company verification or membership changes concurrently.
- Two Administrators claim or decide the same review at nearly the same time.
- A submitted job-content record is missing, malformed, duplicated, or changes unexpectedly after the review snapshot is accepted.
- Notification creation fails before the submission or decision transaction completes.
- The notification is replayed, the Administrator refreshes during a command, or a client retries after losing the response.
- A posting deadline passes while review is pending or immediately before approval.
- An approved posting is edited, closed, or removed while a replacement version is pending.
- The assigned Administrator loses authority before completing the decision.
- No eligible Administrator exists when the submission enters review.
- Recruiter-visible rejection feedback contains unsafe markup, contact information, or excessive content.
- A direct URL attempts to enumerate a job, review, notification, company, or prior version across actors or tenants.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST permit review submission only for an authenticated Recruiter with an active qualifying membership in the posting's active verified company.
- **FR-002**: The system MUST validate all required job fields and current company eligibility at submission time and MUST create no review work for an invalid submission.
- **FR-003**: A successful submission MUST identify one exact, immutable review version of the complete submitted job content.
- **FR-004**: The canonical review lifecycle MUST be `Pending Review` followed by exactly one terminal decision of `Approved` or `Rejected`; a rejected revision MUST create a new lifecycle version.
- **FR-005**: Repeated and concurrent submissions of the same job version MUST be idempotent and MUST NOT create duplicate pending reviews or notifications.
- **FR-006**: Pending and rejected versions MUST remain unavailable through all public job discovery and detail paths.
- **FR-007**: A submitted version MUST be locked against in-place Recruiter edits; revisions MUST use a distinct version.
- **FR-008**: A material edit to an active posting MUST create a distinct immutable review version, and the last approved version MUST remain the only public version until the edited version is approved; closure and expiry MAY still remove public availability without approving unpublished edits.
- **FR-009**: Submission MUST create one generic in-app review notification for each currently eligible Platform Administrator without including job content, company-private data, contact data, evidence, or internal notes.
- **FR-010**: Administrator review notifications MUST be deduplicated per recipient and submitted version.
- **FR-011**: Selecting a review notification MUST lead an authorized Administrator to the exact protected review and mark only that recipient's notification as read.
- **FR-012**: The Administrator console MUST provide a paginated review queue with state, assignment, age, company, and submission-version filters and deterministic ordering.
- **FR-013**: Every currently eligible Administrator MUST be able to discover and claim unassigned pending reviews, and concurrent claims MUST select exactly one current assignee without withdrawing the historical alert from other recipients.
- **FR-014**: Only an eligible current assignee MUST be able to approve or reject a pending review; reassignment MUST be explicit, authorized, version-checked, and auditable.
- **FR-015**: The review detail MUST show the complete immutable submitted job snapshot, safe current company and submitter eligibility context, prior-approved comparison, review version, assignment, and immutable decision history; separately authorized Administrators MAY follow a link to the existing protected verification viewer.
- **FR-016**: Review detail and notifications MUST NOT copy or disclose protected business evidence, unrestricted notes, private contact information, or unrelated company, application, candidate, or account data, and losing access to the protected verification viewer MUST NOT reveal evidence through cached review data.
- **FR-017**: Approval MUST revalidate the exact pending version, current company eligibility, current assignment, deadline viability, and expected review version before making the submitted version active.
- **FR-018**: Approval MUST make exactly one reviewed version public and MUST set its approval/publication facts consistently.
- **FR-019**: Rejection MUST require one allow-listed Recruiter-visible reason code and a normalized bounded explanation that identifies an actionable correction; any optional private Administrator note MUST remain separately protected and MUST NOT be copied into notifications, public history, or Recruiter views.
- **FR-020**: Approval and rejection commands MUST be idempotent and reject stale, conflicting, unassigned, unauthorized, or already-terminal decisions without overwriting the authoritative state.
- **FR-021**: Every submission, claim, reassignment, approval, rejection, blocked decision, and resubmission MUST produce an audit record identifying actor, action, target, result, version, and timestamp without unnecessary personal data.
- **FR-022**: A committed decision MUST create exactly one safe in-app outcome notification for the submitting Recruiter only when that person still has qualifying company membership; otherwise it MUST send no direct outcome detail and MUST expose the state only through tenant-scoped discovery by currently authorized company members.
- **FR-023**: Recruiter notifications and views MUST expose no private Administrator note, other Administrator identity, or cross-company review data.
- **FR-024**: A rejected job MUST be revisable and resubmittable by a currently authorized Recruiter as a distinct version while preserving all prior review history.
- **FR-025**: Failure to create required review state, audit evidence, or in-app notifications MUST NOT leave a posting publicly active without its matching approved decision.
- **FR-026**: The workflow MUST preserve the existing job-content persistence and existing job identifiers; migrating job content to a replacement authority is outside this feature.
- **FR-027**: Server-side authorization MUST precede every protected review read or mutation and MUST combine current Platform Administrator authority or current verified-company membership with tenant ownership.
- **FR-028**: All write operations MUST enforce same-origin request protections, strict input validation, bounded text, and safe error responses.
- **FR-029**: Review lists and details MUST provide meaningful loading, empty, success, stale-conflict, and retry states and MUST be operable with keyboard navigation, assistive technology, and non-color state cues.
- **FR-030**: The system MUST expose operational evidence for pending-review age, notification delivery failures, stale conflicts, decision failures, and unavailable-Administrator conditions without logging full job content or private review material.
- **FR-031**: Existing public job, Recruiter job-management, Administrator notification, and employer-verification behavior outside this review lifecycle MUST remain unchanged.

### Key Entities

- **Job Posting**: The existing company-owned job content and stable identifier, including its draft, public, rejected, and closed representations.
- **Job Review Version**: An immutable identity for one exact submitted content version, including its job, company, submitter, submission time, content integrity identity, lifecycle state, and version number.
- **Job Review Assignment**: The current eligible Platform Administrator responsible for a pending review, including claim and reassignment history.
- **Job Review Decision**: The terminal human approval or rejection of one exact review version, including reason, public explanation, protected note reference, actor, time, and idempotency identity.
- **Approved Job Version**: The single review version whose content is authorized for public visibility until superseded, closed, expired, or removed.
- **In-App Notification**: A recipient-scoped, deduplicated review alert or outcome that carries only safe display data and an authorized context reference.
- **Audit Event**: Immutable operational evidence for a review command or failed attempt with bounded non-sensitive context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tested public job reads expose only the latest approved version and expose zero pending, rejected, stale, or tampered versions.
- **SC-002**: At least 95% of eligible Administrators can see a newly committed review alert and queue item within 5 seconds under the documented representative workload.
- **SC-003**: At least 95% of Administrator review-list, detail, claim, approve, and reject interactions complete with visible authoritative feedback within 2 seconds under documented representative conditions.
- **SC-004**: In 100% of repeated and concurrent submission, claim, approval, rejection, and resubmission tests, exactly one valid authoritative transition occurs and no duplicate notification or review version is created.
- **SC-005**: 100% of approval tests preserve a complete actor/action/target/result/version/timestamp audit trail and link the public posting to the exact approved review version.
- **SC-006**: 100% of rejection tests provide safe actionable Recruiter feedback while disclosing zero private Administrator notes, protected evidence, unrelated tenant data, or cross-recipient notification state.
- **SC-007**: At least 90% of representative Recruiters and Administrators complete their primary submit, discover, review, decide, and resubmit tasks on the first attempt without assistance.
- **SC-008**: All supported Administrator and Recruiter review controls pass keyboard-only operation, readable focus, non-color state communication, and automated serious/critical accessibility checks.
- **SC-009**: Recovery tests for notification failure, stale state, malformed content, lost authority, and unavailable Administrators result in zero unauthorized publication and provide a visible or operationally discoverable recovery path.
- **SC-010**: Existing job-management, job-board, notification, and employer-verification regression suites show no newly introduced failures.

## Assumptions

- The existing job-content persistence, identifiers, and Recruiter editing contract remain in place; this feature adds a protected review authority and does not migrate the content catalogue.
- Better Auth remains the exclusive browser-session owner, and current Platform Administrator grants and verified-company memberships remain the authorization authorities.
- The existing unified in-app notification center is extended; no new email delivery or realtime transport is required.
- Material edits include every field that can change the public meaning, eligibility, searchability, application requirements, compensation, location, deadline, or company presentation of a posting.
- Private business-verification evidence remains owned by its existing protected workflow and may be opened separately only by an already-authorized Administrator.
- This P0 workflow is not releasable until all four P1 user stories, their authorization rules, failure recovery, audit evidence, accessibility checks, and regression gates are complete.

## Out of Scope

- Migrating existing job content to a different persistence mechanism.
- AI-generated job descriptions, automated approval, automated rejection, risk scoring, or job quality ranking.
- Candidate application review, scoring, pipeline management, interviews, offers, or hiring decisions.
- Editing employer-verification evidence or granting/revoking company membership from the job-review screen.
- Bulk approval, bulk rejection, unaudited decisions, or public disclosure of review notes.
- New email templates or email notifications for job review.
