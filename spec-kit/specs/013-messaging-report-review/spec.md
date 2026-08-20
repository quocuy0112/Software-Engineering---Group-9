# Feature Specification: Protected Messaging Report Review

> Recruitment-thread messages are a separate evidence type. They may enter this workflow only through an explicit adapter that preserves application/company scope and never treats Owner oversight reads as participant evidence.

**Feature Branch**: `013-messaging-report-review`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Create feature 013 on a new branch so Platform Administrators can review reports submitted from private conversations without exposing unrestricted chat history."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review the Messaging Report Queue (Priority: P1)

As a currently authorized Platform Administrator, I can open a dedicated messaging-report queue, see pending reports in a stable priority order, filter them, and open one report without mixing it into the existing job/company/candidate moderation queue.

**Why this priority**: Reports are already accepted and retained, but no authorized operational surface currently consumes them. A visible queue is the minimum capability needed to prevent reports from remaining unreviewed.

**Independent Test**: Submit a valid conversation report, open the dedicated administrator queue, and verify that the report appears once with safe reporter, target, category, state, age, assignment, and evidence-availability metadata.

**Acceptance Scenarios**:

1. **Given** a pending messaging report, **When** an authorized Platform Administrator opens the queue, **Then** the report appears in deterministic order with no message body or unrestricted conversation history.
2. **Given** multiple reports with different states, categories, ages, and assignees, **When** the administrator applies filters, **Then** only matching reports are shown and pagination remains stable.
3. **Given** a recruiter-only user, support assignee, inactive administrator, or ordinary participant, **When** they request the queue or report detail, **Then** no protected report data is returned.

---

### User Story 2 - Inspect Only Submitted Evidence (Priority: P1)

As an authorized Platform Administrator with fresh sensitive-action proof, I can inspect the report description and the specifically referenced evidence message, while the rest of the private conversation remains unavailable.

**Why this priority**: Review decisions need evidence, but private messaging must remain least-privilege. Showing only the submitted evidence closes the operational gap without creating a general administrator chat reader.

**Independent Test**: Open a report that references one message and verify that the detail includes only that message, the report context, and safe account references; attempts to access adjacent messages or the full conversation remain unavailable.

**Acceptance Scenarios**:

1. **Given** a report with a referenced evidence message, **When** an authorized administrator with fresh proof opens protected detail, **Then** only that evidence message and bounded report context are displayed.
2. **Given** a report without a referenced message, **When** protected detail is opened, **Then** the administrator sees that no specific message was supplied and receives no conversation transcript.
3. **Given** missing or stale sensitive-action proof, **When** protected evidence is requested, **Then** the request is denied without returning report detail.

---

### User Story 3 - Assign and Resolve Reports (Priority: P1)

As an authorized Platform Administrator, I can assign a pending report to myself, add private investigation notes, resolve or dismiss it, and link a separately confirmed enforcement action with optimistic conflict protection.

**Why this priority**: A queue without accountable handling leaves reports operationally incomplete. Assignment, review history, and terminal outcomes are required for an auditable workflow.

**Independent Test**: Assign a pending report, add a note, resolve it, and verify versioned immutable history; repeat a command and verify idempotent behavior, then attempt a stale command and verify a conflict response.

**Acceptance Scenarios**:

1. **Given** an unassigned pending report, **When** an administrator assigns it to themselves, **Then** assignment, version, timestamp, and immutable history are updated atomically.
2. **Given** an assigned pending report, **When** the administrator adds a bounded private note, **Then** the note appears only in protected administrator detail and immutable history.
3. **Given** a pending report, **When** an administrator resolves or dismisses it, **Then** the report enters the selected terminal state exactly once and records the handling administrator and time.
4. **Given** a stale expected version, **When** an administrator submits a command, **Then** no partial change is committed and the current version is returned safely.
5. **Given** an enforcement action confirmed through its owning workflow, **When** the administrator links its correlation reference, **Then** the report records only the reference and does not duplicate enforcement authority.

---

### User Story 4 - Communicate Safe Submission Status (Priority: P2)

As a reporting participant, I receive clear confirmation that my report was accepted for review without learning administrator identity, assignment, internal notes, investigation progress, or enforcement details.

**Why this priority**: The current neutral receipt is safe but ambiguous. Clear wording distinguishes durable submission from immediate enforcement while preserving moderation confidentiality.

**Independent Test**: Submit a report and verify the confirmation states that it was queued for review, while no internal review data is exposed to either conversation participant.

**Acceptance Scenarios**:

1. **Given** a valid first submission, **When** it is accepted, **Then** the reporter receives neutral confirmation that it was queued for protected review.
2. **Given** an idempotent or deduplicated submission, **When** it is accepted, **Then** the reporter receives the same neutral confirmation and no duplicate active report is created.
3. **Given** any administrator review action, **When** either participant views the conversation, **Then** no administrator identity, private note, assignment, or investigation state is exposed.

### Edge Cases

- A report references an evidence message that is later removed from ordinary participant projections but remains under an authorized preservation hold.
- A report has no evidence message and must not grant access to the surrounding conversation.
- Two administrators concurrently assign, note, or close the same report.
- The assigned administrator loses authority or becomes inactive before the report is closed.
- The reporter or target account is deleted or suspended after report submission.
- A report is submitted repeatedly within the unresolved deduplication window.
- A linked enforcement reference is unknown, malformed, already linked, or belongs to an unrelated target.
- Report detail reaches its retention boundary while an administrator has the page open.
- List data changes between pages; pagination must not duplicate or skip records within the declared ordering contract.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Only a currently authorized Platform Administrator with an ACTIVE account and valid administrator session may list, inspect, assign, note, resolve, dismiss, or link enforcement to messaging reports.
- **FR-002**: Protected report evidence MUST require fresh sensitive-action proof in addition to current administrator authority.
- **FR-003**: Messaging reports MUST remain a dedicated workflow and MUST NOT be silently merged into the existing non-messaging moderation queue.
- **FR-004**: The administrator queue MUST support stable pagination and filters for state, category, assignment, age, reporter reference, and target reference.
- **FR-005**: Queue rows MUST contain only safe metadata and MUST NOT contain report detail, message content, or conversation transcript content.
- **FR-006**: Protected detail MUST expose at most the specifically referenced evidence message and MUST NOT provide adjacent messages, message search, conversation export, or unrestricted conversation history.
- **FR-007**: Reports without a referenced evidence message MUST remain reviewable through their submitted category and bounded detail without granting message access.
- **FR-008**: Assignment, private note, resolution, dismissal, and enforcement-link commands MUST require an idempotency key and expected version.
- **FR-009**: Every successful report command MUST atomically update authoritative state and append immutable, allowlisted review history.
- **FR-010**: Concurrent or stale commands MUST return a safe conflict and MUST NOT commit partial state.
- **FR-011**: A report MAY transition from `PENDING_REVIEW` to exactly one of `RESOLVED` or `DISMISSED`; terminal reports MUST NOT return to pending in this feature.
- **FR-012**: Private notes MUST be normalized, bounded to 2,000 characters, excluded from broad list projections, and visible only through protected administrator detail.
- **FR-013**: Enforcement linking MUST record only a separately confirmed correlation reference and MUST NOT itself suspend an account, block a user, delete content, or change a recruitment decision.
- **FR-014**: The system MUST preserve existing report deduplication and rate-limit behavior and MUST create no duplicate active report for an equivalent unresolved submission.
- **FR-015**: Every accepted submission and administrator command, including rejected privileged commands, MUST produce content-minimized audit evidence with actor, action, target, result, time, and correlation reference.
- **FR-016**: Ordinary logs, analytics, realtime events, broad audit projections, URLs, and browser storage MUST NOT contain message content, report detail, private notes, or unrestricted participant identifiers.
- **FR-017**: The reporter confirmation MUST state that the report was received and queued for protected review without promising immediate enforcement or exposing review progress.
- **FR-018**: Administrator assignment, notes, review state, and enforcement references MUST NOT be exposed to either messaging participant.
- **FR-019**: Existing participant messaging, block, read, and connection behavior MUST continue when a report is submitted; report submission alone MUST NOT automatically restrict either participant.
- **FR-020**: Report-driven enforcement MUST continue to occur only through a separately authorized owning workflow.
- **FR-021**: Protected evidence and review history MUST remain available for at least 90 days after handling when an enforcement outcome is linked, subject to the existing account-deletion and privacy rules.
- **FR-022**: At the applicable retention boundary, new reads MUST be denied immediately and stale open pages MUST not authorize subsequent protected actions.
- **FR-023**: The administrator interface MUST support keyboard operation, readable status text, responsive data-dense desktop use, and explicit loading, empty, conflict, and error states.
- **FR-024**: Queue and protected-detail interactions MUST meet the project administrator navigation target under the documented representative dataset.

### Key Entities

- **Messaging Report**: A participant-submitted safety concern tied to one conversation and target participant, with category, optional bounded detail, optional evidence-message reference, lifecycle state, assignment, version, handling time, and retention facts.
- **Messaging Report Review Event**: An immutable administrator history item recording assignment, note, terminal decision, or enforcement-reference linking without copying unrelated conversation content.
- **Protected Evidence Message**: The single message explicitly referenced by the reporter and available only through fresh administrator proof; it does not grant conversation-level access.
- **Enforcement Correlation Reference**: An opaque link to a separately authorized enforcement action owned by another workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid accepted messaging reports appear exactly once in the authorized administrator queue within five seconds of submission or refresh.
- **SC-002**: Across the authorization matrix, 100% of non-administrators, inactive administrators, stale sessions, and requests without required fresh proof receive no protected report or evidence content.
- **SC-003**: For every protected-detail test, zero adjacent or unrelated conversation messages are returned; only the explicitly referenced evidence message may appear.
- **SC-004**: In 100 concurrent commands against one report version, exactly one authoritative conflicting transition is committed and every other stale command receives a conflict without partial history.
- **SC-005**: Queue and report-detail interactions complete at P95 within two seconds on a documented dataset of at least 10,000 messaging reports, including at least 1,000 pending reports.
- **SC-006**: 100% of tested assignment, note, resolution, dismissal, enforcement-link, and rejected privileged commands produce correlated content-minimized audit evidence.
- **SC-007**: Automated accessibility checks report no critical violations for the queue and protected-detail workflow, and all commands remain keyboard operable.
- **SC-008**: Participant-facing tests expose no administrator identity, assignment, private note, review state, or enforcement reference before or after report handling.

## Assumptions

- Existing Platform Administrator sessions, sensitive-action proof, CSRF protection, audit infrastructure, and administrator console navigation remain authoritative.
- Existing messaging report submission, categories, rate limits, deduplication, participant authorization, and neutral unavailable responses are reused.
- A messaging report does not by itself prove misconduct and does not automatically trigger enforcement.
- Administrators need only the specifically submitted evidence message for this workflow; full-conversation review remains out of scope.
- Existing moderation enforcement workflows remain authoritative for account suspension or other consequences.
- This feature is an additive protected review workflow and does not replace the existing moderation queue for jobs, companies, memberships, and candidates.

## Feature 016 Notification Integration

- A newly accepted messaging report creates an in-app-only neutral receipt for its reporter; deduplicated submissions reuse the original receipt.
- Resolution and dismissal create one terminal in-app outcome for the reporter without exposing administrator identity, notes, evidence content, review state internals, or enforcement references.
- No new messaging-report email is introduced.
