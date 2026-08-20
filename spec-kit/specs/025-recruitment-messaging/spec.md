# Feature Specification: Application-Scoped Recruitment Messaging

**Feature Branch**: `025-recruitment-messaging`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Build a separate recruitment messaging workflow with application-scoped Candidate-to-Recruiter/HR threads, a recruiter inbox organized by company and job, and Owner read-only oversight."

## Clarifications

### Session 2026-08-20

- Q: What is the unit of a recruitment conversation? → A: One durable recruitment thread per application; reassignment changes the responsible staff member without splitting its candidate-visible history.
- Q: When may a candidate initiate a recruitment message? → A: After an eligible Recruiter or HR Manager is assigned to the application; before assignment, the candidate sees that the recruiting team will contact them.
- Q: What access does the company Owner have? → A: Read-only oversight of threads for the Owner's server-resolved company context; opening a thread never makes the Owner a participant or changes message state.
- Q: Who may assign the staff member required to start a thread? → A: An active HR Manager assigns or reassigns an active HR Manager or Recruiter in the same company; Owners remain read-only and Recruiters act only on their assigned thread.

### Session 2026-08-21

- Opening an individual candidate detail automatically records the one-time `APPLIED` to `VIEWED` transition; it does not create a chat.
- A visible staff-only `Message candidate` action starts the chat. The first successful HR Manager or Recruiter request creates the application-keyed thread and becomes its assignee; concurrent callers receive that thread without overwriting its assignee.
- Only the current assignee sends participant messages. A non-assigned HR Manager may read and explicitly reassign or take over; a same-company Recruiter who races to start an already-created thread may open it read-only but cannot send, alter read state, report, or reassign.
- Every thread creation and reassignment creates an immutable audit event containing actor, prior/current assignee when applicable, and timestamp.
- A thread stays open when a non-terminal application moves backward in the pipeline and becomes read-only only in a terminal state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conduct an application conversation (Priority: P1)

As an active Candidate, I can communicate in the single recruitment thread for my application after a responsible hiring-team member is assigned, so that each exchange is clearly tied to the job and company.

**Why this priority**: Candidates and hiring teams need a safe, unambiguous channel while an application is active.

**Independent Test**: Create an application with an active assigned Recruiter or HR Manager, open its thread as each party, exchange messages, and verify that a different application creates a different thread.

**Acceptance Scenarios**:

1. **Given** a Candidate application has an active assigned Recruiter or HR Manager, **When** either party starts or opens recruitment messaging, **Then** one thread tied to that application is shown with the job and company context.
2. **Given** the same Candidate has two applications, **When** they open messaging for each application, **Then** the messages and unread state remain separate.
3. **Given** no eligible staff member is assigned, **When** the Candidate views the application, **Then** the Candidate cannot initiate a thread and receives a clear non-error explanation.
4. **Given** an assigned staff member is replaced, **When** the new assignee opens the thread, **Then** the candidate-visible history remains continuous and the former assignee can no longer send.

---

### User Story 2 - Manage a recruitment inbox (Priority: P1)

As an authorized Recruiter or HR Manager, I can review and filter recruitment threads for my company and permitted applications, so that I can respond with the right job and candidate context.

**Why this priority**: A recruitment inbox is valuable only if it prevents cross-company and cross-job confusion.

**Independent Test**: Seed applications across two companies, jobs, stages, and assignees; verify that each staff actor sees only permitted threads and that filters retain the correct job/application context.

**Acceptance Scenarios**:

1. **Given** an eligible staff member opens Recruiter Messages, **When** they choose a company and job filter, **Then** only permitted application threads for that company/job appear.
2. **Given** a thread is opened, **When** the header is rendered, **Then** it identifies the Candidate, job, company, application stage, and current assignee.
3. **Given** a Recruiter is limited to assigned applications, **When** they try a known unassigned application identifier, **Then** no thread content or protected metadata is disclosed.
4. **Given** a thread has unread activity, **When** the permitted staff member reads it, **Then** unread state updates only for that recipient and reconciles after a temporary failure.
5. **Given** an active HR Manager assigns or reassigns an active eligible staff member, **When** the command succeeds, **Then** the single application thread retains its history and only the new assignee may send thereafter.

---

### User Story 3 - Review without participating as Owner (Priority: P2)

As a company Owner, I can review recruitment conversations for my company in read-only mode, so that I can perform oversight without changing candidate or hiring-team communication.

**Why this priority**: Company oversight must preserve participant privacy and operational meaning.

**Independent Test**: Open the same active thread as its participants and as the company Owner; verify Owner visibility is company-scoped, read-only, audited, and causes no participant state changes.

**Acceptance Scenarios**:

1. **Given** an Owner opens their oversight inbox, **When** they filter by job or application stage, **Then** only threads belonging to the Owner's company are visible.
2. **Given** an Owner opens a thread, **When** the thread is displayed, **Then** there is no composer, assignment control, read receipt, typing signal, presence change, or participant notification caused by the view.
3. **Given** an Owner tries to use a send or application-command endpoint, **When** the server receives the request, **Then** it returns a neutral denial and records the attempted action safely.

---

### User Story 4 - Close and report recruitment communication safely (Priority: P2)

As a Candidate or permitted hiring-team member, I can retain an auditable read-only history after an application is closed and report harmful recruitment content through the protected review workflow.

**Why this priority**: Recruitment messaging must remain safe and coherent when application authority changes.

**Independent Test**: Move applications through active and terminal states, report a message, and verify messaging permissions, history, report privacy, and notifications stay correct.

**Acceptance Scenarios**:

1. **Given** an application is Applied, Viewed, Shortlisted, Interviewing, or Offered, **When** an eligible participant sends a valid message, **Then** it is accepted and delivered within its application thread.
2. **Given** an application is Hired, Offer Declined, Rejected, Waitlisted, or otherwise no longer active for messaging, **When** either participant opens the thread, **Then** its history remains available but message composition is unavailable.
3. **Given** a participant reports a recruitment message, **When** the report is accepted, **Then** only report-authorized administrators can review its protected evidence and ordinary inboxes expose no report details.

### Edge Cases

- A user may hold memberships in several companies; every list, detail, send, and reassignment decision resolves company scope server-side and does not trust a client-supplied company identifier.
- An Owner account may own several companies in the future; the server requires an explicit current owned company context rather than combining results across companies.
- Membership suspension/removal, assignment removal, application closure, account suspension, block, or session revocation immediately prevents new messages and hides or neutralizes inaccessible threads.
- Existing application conversations created under the earlier direct-message model are migrated or presented read-only without duplication before a new thread is created.
- Duplicate sends, concurrent first opens, and reassignment racing with a send must produce one authoritative order and no duplicate message or unauthorized delivery.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST create at most one recruitment thread per application and persist its application, job, company, Candidate, current assignee, lifecycle state, and message ordering.
- **FR-002**: The system MUST permit Candidate messaging only in the Candidate's own application thread and only after an active eligible Recruiter or HR Manager is assigned; Recruiters and HR Managers may initiate only where their current company membership and application authority permit it.
- **FR-003**: The system MUST authorize every recruitment list, detail, send, read, assignment, and report operation on the server using current account state, company membership, assignment, application state, and thread state.
- **FR-004**: Recruitment inboxes MUST expose the thread's Candidate, job, company, application stage, and current assignee, and MUST scope/filter results by server-authorized company, job, stage, and assignment without cross-company disclosure.
- **FR-005**: The company Owner MUST have read-only oversight only for threads in the Owner's current company context; Owner views MUST be audited and MUST NOT make the Owner a message participant or mutate participant message state.
- **FR-006**: Recruiter and HR Manager reassignment MUST preserve the single thread and its candidate-visible history while revoking former-assignee write authority according to the current assignment policy.
- **FR-007**: Active messaging is allowed only while the application is Applied, Viewed, Shortlisted, Interviewing, or Offered; terminal application states preserve authorized history in read-only mode.
- **FR-008**: The system MUST prevent duplicate messages and conflicting first-thread/reassignment writes with transactional integrity and idempotency, and MUST visibly reconcile failed client updates.
- **FR-009**: A permitted participant MUST be able to report harmful recruitment communication through the existing protected messaging-report workflow; report evidence and reporter identity MUST not appear in ordinary Candidate, Recruiter, HR Manager, or Owner inboxes.
- **FR-010**: New recruitment-message notifications MUST identify only the application-scoped thread and resolve to a destination independently authorized for the recipient; the Owner receives no participant-message notification merely from oversight access.
- **FR-011**: The recruitment messaging interface MUST provide keyboard-operable, localized, responsive controls with non-color loading, empty, read-only, success, and error feedback.
- **FR-012**: Only an active HR Manager may assign or reassign an active HR Manager or Recruiter within the same company to a recruitment thread; Owners have no assignment command and Recruiters gain no authority outside their current assignment.
- **FR-013**: A staff-only `Message candidate` action MUST be available after an application reaches `VIEWED`; it atomically creates and self-assigns the unique application thread only if one does not already exist.
- **FR-014**: Concurrent conversation-start attempts MUST return the single existing thread and MUST NOT overwrite its first assignee.
- **FR-015**: Thread creation and every assignment/reassignment MUST be written as an immutable audit event with actor, assignment context, and timestamp.

### Key Entities

- **Recruitment thread**: The unique, application-scoped communication record linking a Candidate to one job/company application, a current staff assignee, lifecycle state, and ordered messages.
- **Recruitment message**: A durable text record in one recruitment thread, attributed to its Candidate or eligible staff author and protected by the thread's current authorization state.
- **Recruitment assignment**: The current eligible Recruiter or HR Manager responsible for the application thread; assignment changes preserve history while changing send authority.
- **Owner oversight view**: An audited authorization projection over company-scoped threads that deliberately does not create participant capabilities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated authorization tests, 100% of cross-company, unassigned, terminal-state, suspended, and Owner-write attempts return no protected thread/message content and make no state change.
- **SC-002**: In automated concurrency tests, 100% of equivalent first-thread and message retries result in one thread and one authoritative message per idempotency key.
- **SC-003**: In end-to-end checks, Candidate, Recruiter/HR Manager, and Owner can complete their permitted primary inbox action in no more than three interactions after selecting the intended application/job context.
- **SC-004**: Recruitment thread list and detail reads meet P95 ≤ 2 seconds for a representative company fixture of 100 threads and 20 messages per thread.
- **SC-005**: Accessibility checks report zero serious or critical violations for candidate messaging, recruiter inbox filtering, Owner read-only viewing, and terminal read-only states.

## Assumptions

- Existing authenticated session, company membership, application lifecycle, assignment, messaging text validation, realtime delivery, unread-state, blocking, and report-review boundaries are reused where their authority rules remain valid.
- The current company context is server-derived from active membership; a future multi-owned-company switcher is an explicit extension, not a client-controlled bypass.
- No group chat, attachment, voice/video call, message editing/deletion, unrestricted staff search, export, or full administrator message browser is included in this feature.
