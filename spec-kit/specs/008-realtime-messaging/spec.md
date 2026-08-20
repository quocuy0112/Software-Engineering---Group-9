# Feature Specification: Realtime Messaging and Communication

**Feature Branch**: `008-realtime-messaging`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "A one-to-one professional messaging MVP for
Candidates and authorized Recruiters, including durable text messages,
real-time delivery, conversation history, unread/read state, reconnect
recovery, eligible-user discovery, approximate presence, blocking, and
reporting. Group chat, attachments, typing indicators, message deletion,
pinning, calls, and realtime behavior for other modules are excluded."

## Clarifications

### Session 2026-08-11

- Q: Should realtime authentication introduce the proposed handshake JWT? → A:
  No. The existing Better Auth HttpOnly cookie is the exclusive browser session
  and must authenticate both ordinary requests and realtime connections.
- Q: Should one participant pair share one global conversation across every
  company and application? → A: No. Conversation uniqueness is scoped by the
  immutable professional-connection or application/company context to preserve
  tenant isolation.
- Q: What delivery promise applies when connectivity fails during send? → A:
  Only a durably persisted, server-acknowledged message is `Sent`; an
  unacknowledged attempt remains visibly retryable and must not be presented as
  accepted.
- Q: Does blocking hide or erase existing conversation history? → A: No.
  Authorized pre-block history remains visible for participant records and
  reporting, while all new messaging and mutual presence stop bidirectionally.
- Q: Does "stored permanently" mean messages can never be deleted? → A: No.
  Messages are durable across sessions and offline periods but remain governed
  by account/data deletion, legal preservation, consent, purpose, and disclosure
  policy.

- Q: How are active sockets protected when conversation authority changes? A:
  The server force-removes affected sockets from conversation rooms and also
  revalidates each intended recipient immediately before outbound delivery.
- Q: What is the production retention behavior? A: Messages are retained
  indefinitely by default, deleted accounts are anonymized without destroying
  thread content, and evidence related to an Administrator-handled report is
  held for at least 90 days.

## User Scenarios & Testing _(mandatory)_

Feature 008 is a complete MVP only when every in-scope story below is delivered.
Story priority controls implementation order and independent demonstration; it
does not authorize omitting P2 or P3 safety and recovery behavior from release.

### User Story 1 - Start an Eligible Professional Conversation (Priority: P1)

As an authenticated active Candidate or authorized Recruiter, I can find an
eligible person and open one context-appropriate direct conversation so that I
can discuss an application or an established professional connection without
exposing unrelated users or company data.

**Why this priority**: A secure, unambiguous conversation boundary is required
before any message can be exchanged.

**Independent Test**: Seed eligible and ineligible Candidate/Recruiter pairs
across multiple companies and applications, search and open conversations from
supported entry points, repeat and race creation, then verify eligibility,
tenant isolation, neutral denials, and duplicate prevention.

**Acceptance Scenarios**:

1. **Given** two active accounts have an approved professional connection,
   **When** either participant opens messaging from the eligible search result
   or profile, **Then** the same direct professional conversation is returned.
2. **Given** a Candidate has applied to a job and a Recruiter has a current
   approved membership with authority for that job's company, **When** either
   participant opens messaging from that application context, **Then** a direct
   conversation bound to that application and company context is returned.
3. **Given** the same two accounts have different application/company contexts,
   **When** a conversation is opened, **Then** the selected context is explicit
   and access through one company does not expose another company's
   conversation.
4. **Given** no supported relationship exists, **When** either account searches
   for or directly requests the other account, **Then** no conversation is
   created and the response does not reveal private identity, application, or
   membership information.
5. **Given** simultaneous equivalent creation requests, **When** both complete,
   **Then** one authoritative conversation exists for the participant pair and
   context.

---

### User Story 2 - Exchange Durable Text Messages (Priority: P1)

As a conversation participant, I can send and receive text messages with clear
delivery feedback so that an acknowledged message remains available whether
the other participant is online or offline.

**Why this priority**: Text exchange is the core user value of the functional
group.

**Independent Test**: Use two authenticated participants to send valid,
invalid, repeated, concurrent, online, and offline messages; inject persistence
and connection failures; verify authorization, exactly-once visible records,
feedback, ordering, and recovery.

**Acceptance Scenarios**:

1. **Given** both authorized participants have the conversation open, **When**
   one sends valid text, **Then** the message is durably accepted before success
   is shown and the other participant sees it in real time.
2. **Given** the recipient is offline, **When** a message is accepted, **Then**
   the recipient sees it after returning and loading the conversation.
3. **Given** delivery acknowledgement is interrupted and the client retries the
   same send, **When** the request reaches the service more than once, **Then**
   one authoritative message is visible and the sender receives its final
   status.
4. **Given** persistence fails, **When** the sender attempts to send, **Then** no
   message is broadcast as accepted and the sender receives a visible retryable
   failure.
5. **Given** a session, account, membership, relationship, conversation access,
   or block state no longer permits messaging, **When** a send is attempted,
   **Then** it is rejected before message content is persisted or disclosed.

---

### User Story 3 - Review Conversations and Read State (Priority: P1)

As a participant, I can see my conversation list, load older messages in
bounded pages, identify unread activity, and mark a conversation read so that I
can resume communication without loading all history.

**Why this priority**: Durable history and read state make offline delivery and
reconnection useful rather than transient.

**Independent Test**: Seed multiple conversations with interleaved message
times and more than one history page, exercise list/history cursors and read
updates from two devices, and verify ownership isolation, stable ordering,
unread counts, sender-visible read state, and failure recovery.

**Acceptance Scenarios**:

1. **Given** a participant has several conversations, **When** the list opens,
   **Then** only authorized conversations appear, ordered by most recent
   message, with safe participant/context summary and an accurate unread badge.
2. **Given** a conversation has more than one page of messages, **When** older
   pages are requested, **Then** bounded cursor pagination returns stable
   chronological history without omissions or duplicates.
3. **Given** unread messages exist, **When** the participant views them and the
   read update succeeds, **Then** the participant's unread count becomes zero
   through the accepted boundary and the sender sees those messages as read.
4. **Given** a stale or repeated read update arrives, **When** it is processed,
   **Then** read state never moves backward and no message is made unread again.
5. **Given** a participant reconnects after missing realtime events, **When**
   the conversation list or open conversation refreshes, **Then** authoritative
   persisted state fills the gap without duplicate messages.

---

### User Story 4 - See Approximate Availability (Priority: P3)

As a participant, I can see whether the other person is approximately online
while messaging so that I understand whether a quick reply is likely without
treating presence as an exact activity record.

**Why this priority**: Presence improves communication clarity but is not
required to persist or deliver messages.

**Independent Test**: Connect and disconnect one participant across multiple
tabs/devices and abrupt network loss, then verify authorized visibility,
multi-connection handling, an explicit approximate label, and no persisted
last-seen history.

**Acceptance Scenarios**:

1. **Given** an authorized participant has at least one active messaging
   connection, **When** the other participant views their shared conversation,
   **Then** the participant is shown as online.
2. **Given** one of several active connections closes, **When** another remains,
   **Then** the participant is not incorrectly shown as offline.
3. **Given** all connections close or expire after connection loss, **When**
   presence updates, **Then** the participant is shown as offline without an
   exact last-seen time.
4. **Given** an account has no authorized shared conversation, **When** presence
   is requested or observed indirectly, **Then** no presence information is
   disclosed.

---

### User Story 5 - Block and Unblock a Participant (Priority: P2)

As a participant, I can block or unblock the other person so that unwanted
communication stops immediately in both directions while I retain access to
the pre-block history needed for my own records or reporting.

**Why this priority**: Blocking is a required safety control for direct
communication.

**Independent Test**: Block and unblock from either side during active and
offline sessions, race block with send/read operations, and verify bidirectional
enforcement, history visibility, presence suppression, idempotency, and fresh
eligibility checks after unblock.

**Acceptance Scenarios**:

1. **Given** two participants can message, **When** either blocks the other,
   **Then** neither can send new messages to the other and no presence updates
   are shared between them.
2. **Given** a send races with a block, **When** both are processed, **Then** the
   authoritative order is explicit, no post-block message is accepted, and no
   partial state is shown as successful.
3. **Given** a conversation is blocked, **When** either participant opens it,
   **Then** pre-block history remains visible with a non-color blocked label and
   message composition is unavailable.
4. **Given** the blocker unblocks the other participant, **When** messaging is
   attempted, **Then** current relationship, account, membership, and context
   eligibility are rechecked before communication resumes.
5. **Given** the blocked participant attempts a direct operation, **When** the
   server checks the pair, **Then** the operation is denied without revealing
   who initiated the block beyond what the shared blocked state requires.

---

### User Story 6 - Report Harmful Communication (Priority: P2)

As a participant, I can report the other participant or a shared conversation
with a reason so that SmartHire retains a privacy-minimized moderation record
without granting administrators unrestricted message access.

**Why this priority**: Reporting complements blocking and provides a durable
safety signal, while administrator case processing remains outside this MVP.

**Independent Test**: Submit valid, repeated, invalid, unauthorized, and
rate-limited reports for shared conversations; verify neutral receipts,
privacy-minimized persistence, audit evidence, and absence from public,
Candidate, Recruiter, and unrestricted Administrator views.

**Acceptance Scenarios**:

1. **Given** a participant shares a conversation with the target, **When** a
   valid categorized report is submitted, **Then** one pending moderation record
   is stored and a neutral receipt is returned.
2. **Given** a report is submitted, **When** ordinary users or administrators
   without report-specific authority access messaging, **Then** report content
   and reporter identity are not disclosed.
3. **Given** an equivalent unresolved report already exists inside the dedupe
   window, **When** it is submitted again, **Then** no duplicate moderation item
   is created and the same neutral receipt is returned.
4. **Given** the reporter is not a conversation participant or exceeds the
   report limit, **When** submission is attempted, **Then** it is rejected
   without exposing target or conversation information.

### Edge Cases

- A normal account retains its base Candidate identity while Recruiter authority
  is derived from a current approved company membership, never a global role.
- One participant may have several browser tabs or devices; one disconnect must
  not make the account offline while another messaging connection remains.
- Messages created at nearly identical times retain a stable total order and
  cursor boundary.
- A conversation with no messages appears only after successful creation and
  has a deterministic position below conversations with message activity.
- Empty, whitespace-only, over-limit, unsafe, or malformed text is rejected and
  never broadcast; displayed text never executes markup.
- A participant removed or suspended from a company immediately loses access to
  application-context conversations authorized only through that membership.
- Account suspension, session revocation, block, and membership enforcement must
  take effect on existing realtime connections, not only after page refresh.
- Realtime disconnect never changes persisted message/read state and ordinary
  history/list reads remain the recovery authority.
- A deleted or unavailable profile is represented with a neutral label while
  authorized conversation history remains subject to the data-retention policy.
- Reporting failure never changes block state or message delivery state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 [Identity]**: Only an authenticated active SmartHire account MAY use
  messaging, and identity MUST be derived exclusively from the existing
  server-controlled browser session.
- **FR-002 [Authority]**: Every messaging list, history, create, send, read,
  presence, block, unblock, and report operation MUST revalidate server-side
  account and participant authority before returning protected data or changing
  state. Outbound realtime delivery MUST independently revalidate every intended
  recipient immediately before emitting protected data.
- **FR-003 [Recruiter Authority]**: Recruiter access MUST require a current
  approved company membership with the necessary company-scoped authority;
  Feature 008 MUST NOT introduce or trust a global Recruiter role.
- **FR-004 [Eligibility]**: A direct conversation MAY be created only for an
  approved professional connection or for a Candidate application whose owning
  company currently authorizes the Recruiter participant.
- **FR-005 [Context Isolation]**: Application-based conversations MUST retain
  their application and company context, and authority from one company MUST
  NOT reveal a conversation bound to another company.
- **FR-006 [Discovery]**: Eligible-person discovery MUST return only safe account
  fields and supported shared context, use bounded pagination, and return a
  neutral result for ineligible or unknown targets. Search input MUST filter
  only this server-authorized eligible set; it MUST NOT broaden account
  discovery or conversation authority.
- **FR-007 [Conversation Uniqueness]**: Repeated or concurrent equivalent opens
  MUST return one authoritative direct conversation for the same participant
  pair and immutable context.
- **FR-008 [Conversation List]**: Participants MUST be able to list only their
  currently authorized conversations ordered by descending last-message time,
  with stable ordering for empty/equal-time records and bounded pagination.
- **FR-009 [Message History]**: Participants MUST be able to load only their
  authorized conversation history through cursor pagination with a default and
  maximum page size of 20 messages.
- **FR-010 [Text Validation]**: A message MUST contain normalized non-empty plain
  text of 1 through 2,000 Unicode characters; executable markup MUST never run.
- **FR-011 [Durable Send]**: A successful send MUST persist one authoritative
  message before acknowledging or broadcasting it, and persistence failure MUST
  produce no accepted realtime event.
- **FR-012 [Send Idempotency]**: Each send attempt MUST carry an unguessable
  client-generated operation reference scoped to the sender, and duplicate
  retries MUST resolve to the same message without duplicate visible content.
- **FR-013 [Delivery State]**: The UI MUST distinguish unacknowledged/failed
  local attempts from server-accepted `Sent` messages and recipient-confirmed
  `Read` messages; failure MUST offer an explicit retry path.
- **FR-014 [Realtime Delivery]**: An accepted message MUST be pushed to every
  currently connected authorized participant view, including a participant who
  is viewing only the conversation list. After authentication, each socket MUST
  join every currently authorized conversation room; before each protected emit,
  the server MUST re-run `canMessage(sender, recipient)` for every member still
  present in the room. Persisted history remains authoritative for offline and
  reconnect recovery.
- **FR-015 [Read Boundary]**: Each participant MUST have one monotonic
  conversation read boundary; unread counts and sender-visible read state MUST
  be derived from that boundary rather than mutable per-message receipt rows.
- **FR-016 [Read Updates]**: Read updates MUST be idempotent, MUST NOT move
  backward, and MUST be pushed to the other currently connected participant
  only after the authoritative boundary is saved.
- **FR-017 [Reconnect Recovery]**: After reconnect, list and open-conversation
  state MUST reconcile from persisted authoritative records and MUST visibly
  recover missed messages/read updates without duplication.
- **FR-018 [Presence]**: Online/offline state MUST be approximate, memory-only,
  account-scoped across active connections, visible only to authorized
  conversation participants, and MUST NOT create an exact last-seen history.
- **FR-019 [Block Direction]**: A block MUST record the initiating account and
  target account, while its communication effect MUST be bidirectional across
  every direct context between the pair.
- **FR-020 [Block Enforcement]**: After block becomes authoritative, neither
  participant MAY send new messages or receive presence updates for the other;
  the realtime registry MUST immediately force affected sockets to leave every
  shared conversation room and notify the affected client with a safe access-
  revoked event. Pre-block authorized history remains readable and clearly
  labeled blocked.
- **FR-021 [Unblock]**: Only the initiating blocker MAY remove their block, and
  unblock MUST NOT bypass current conversation eligibility, membership, account,
  or session checks.
- **FR-022 [Reports]**: A participant MAY report the other participant or one of
  their shared conversations using an allowlisted reason category and an
  optional normalized rationale of at most 500 characters.
- **FR-023 [Report Safety]**: Reports MUST begin pending, deduplicate equivalent
  unresolved submissions within 24 hours, enforce the existing moderation
  submission limit where applicable, return a neutral receipt, and remain
  inaccessible outside report-specific authority.
- **FR-024 [Report Scope]**: Feature 008 MUST persist and audit reports but MUST
  NOT add an Administrator messaging browser, unrestricted message access, or a
  report-resolution UI; those capabilities require a separately approved
  privileged workflow.
- **FR-025 [Session Enforcement]**: Session revocation, account suspension, and
  loss of company membership authority MUST terminate or deauthorize affected
  messaging connections and protected operations through the active socket
  registry without creating a second browser-session mechanism. Professional-
  connection deletion and moderation suspension MUST apply the same force-leave
  behavior to every affected conversation.
- **FR-026 [Privacy]**: Conversation content, read state, block actor, reports,
  application references, and non-public profile/company fields MUST NOT appear
  in public responses, ordinary logs, analytics, URLs, notifications, or
  unauthorized views.
- **FR-027 [Retention and Deletion]**: Messages and conversation metadata MUST
  persist indefinitely by default across sessions and offline periods. Account
  deletion MUST anonymize the deleted participant while retaining authorized
  thread content for the remaining participant. Evidence related to a report
  that triggers Administrator handling MUST be preserved for at least 90 days,
  independently of account deletion.
- **FR-028 [Audit]**: Conversation creation, denied high-risk access, block,
  unblock, and report events MUST record privacy-minimized actor, action, target,
  result, correlation reference, and timestamp without message or report text.
- **FR-029 [Accessibility]**: Conversation lists, history, composer, delivery and
  presence labels, unread badges, block/report dialogs, loading, empty, error,
  and reconnect states MUST support keyboard operation, programmatic labels,
  visible focus, live announcements, and non-color status communication.
- **FR-030 [Responsive Use]**: Candidate and Recruiter messaging MUST remain
  usable on supported mobile and desktop layouts without losing acknowledged
  data or hiding safety controls.
- **FR-031 [Scope Boundary]**: Feature 008 MUST NOT include group chat, typing
  indicators, attachments, message editing/deletion/unsend, pinning, voice/video
  calls, message search/export, exact last seen, or realtime feed/notification
  behavior for other modules.
- **FR-032 [Architecture Boundary]**: Messaging MUST remain part of the existing
  SmartHire application and share its authoritative identity, business data,
  relational store, and operational deployment; no independent messaging
  product, identity store, business database, or broker is introduced.

### Data Retention & Privacy

- **Default retention**: Authoritative messages, conversation metadata, and read
  boundaries are retained indefinitely unless a later approved legal or privacy
  policy requires a longer preservation hold or a lawful deletion action.
- **Deleted accounts**: When either participant deletes an account, the account
  identity is anonymized in messaging projections. Existing messages remain in
  sequence for the other authorized participant, but the sender label becomes
  `Deleted user`; the deleted account's name, avatar, email, and profile links
  MUST NOT remain accessible through messaging.
- **Report preservation**: When an Administrator handling outcome is associated
  with a messaging report, the report and its referenced conversation/message
  evidence MUST be retained for at least 90 days from the handling timestamp.
  This preservation period applies even if either participant deletes an account
  during the hold. Identity projections remain anonymized where required, while
  protected evidence stays available only to the separately authorized audit or
  moderation workflow.
- **No shadow copies**: Ordinary logs, analytics, URLs, client persistence, and
  audit context MUST NOT be used as retention or evidence stores. Presence and
  the active socket registry are ephemeral and are erased on disconnect or
  process restart.

### Key Entities

- **Direct Conversation**: A two-participant communication boundary with an
  immutable professional-connection or application/company context, creation
  time, and latest-message ordering information.
- **Conversation Participant State**: One participant's membership in a direct
  conversation, including a monotonic read boundary; it does not grant authority
  independently of the current account and relationship checks.
- **Text Message**: Immutable normalized text accepted from one participant,
  linked to a conversation and sender with a stable operation reference,
  creation order, and time.
- **User Block**: A directional safety choice from blocker to blocked account
  whose communication effect is enforced bidirectionally across the pair.
- **Messaging Report**: A privacy-minimized pending moderation record created by
  a participant against the other participant or a shared conversation.
- **Messaging Presence**: Ephemeral approximate connectivity derived from active
  authorized messaging connections; it is not persistent business data.
- **Messaging Eligibility Relationship**: A current approved professional
  connection or an application plus company-membership relationship used to
  authorize conversation creation and continued access.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of the authorization matrix across participant,
  non-participant, suspended account, revoked session, company membership,
  application context, professional connection, block, and unknown-identifier
  cases, protected content is returned only to an authorized participant and
  denied cases disclose no private target data.
- **SC-002**: In a documented two-participant test window on the representative
  single-instance environment, at least 95% of accepted online messages become
  visible to the other participant within 1 second, with an error rate below 1%.
- **SC-003**: In 100% of duplicate, retry, and barrier-synchronized send tests,
  one client operation produces at most one authoritative visible message and
  every accepted message is available after reload.
- **SC-004**: In 100% of offline and reconnect scenarios, persisted messages and
  read boundaries reconcile without missing or duplicate authoritative records;
  unacknowledged local attempts are visibly retryable rather than falsely shown
  as sent.
- **SC-005**: Conversation list and 20-message history pages become usable at
  P95 within 2 seconds over at least 100 conversations per participant and
  10,000 messages in the test dataset, with error rate below 1%.
- **SC-006**: In 100% of read-boundary tests, unread counts are correct, read
  state never moves backward, and the sender sees an accepted read update within
  1 second when both participants are connected.
- **SC-007**: In 100% of block/send races, no message ordered after the
  authoritative block is accepted; both directions lose send and presence
  capability immediately and regain it only after authorized unblock and fresh
  eligibility checks.
- **SC-008**: Approximate presence is correct for all tested connect/disconnect
  sequences across up to three simultaneous tabs/devices per participant, and
  zero exact last-seen records are persisted.
- **SC-009**: In 100% of valid report tests, one privacy-minimized pending record
  and audit correlation are created; duplicate-window, quota, unauthorized, and
  privacy-canary tests reveal zero report or message text outside the protected
  record.
- **SC-010**: Keyboard-only tests complete conversation discovery, send, history
  pagination, read, block/unblock, report, reconnect recovery, and logout with
  visible focus and meaningful status announcements; automated accessibility
  checks report zero serious or critical findings.
- **SC-011**: At least 90% of representative Candidates and Recruiters complete
  the first eligible conversation and exchange an acknowledged message within
  2 minutes without assistance.
- **SC-012**: Group chat, attachments, typing indicators, message mutation,
  pinning, calls, message search/export, exact last seen, and cross-module
  realtime behavior are absent from all Feature 008 interfaces and executable
  paths.

## Assumptions

- Feature 011 owns bilateral proposals and the canonical
  `ProfessionalConnection` lifecycle. Feature 008 consumes current `ACCEPTED`
  authority and participant-only `REVOKED` archived-history access through stable
  server-only boundaries together with the existing Application eligibility path.
- Existing SmartHire authentication remains the exclusive browser-session
  owner. Realtime transport receives the same first-party cookie and does not
  create, return, or persist a JWT or other browser credential.
- The existing account, application, company-membership, moderation, audit, and
  rate-limit capabilities are reused through their service boundaries where
  their approved contracts fit; Feature 008 does not clone their business
  authority.
- The MVP operates as one application instance. Horizontal fan-out and shared
  presence infrastructure are deferred, but the realtime adapter remains
  replaceable.
- A message has no attachment, rich-text markup, edit, delete, or unsend state.
  `Sent` and `Read` are user-facing projections derived from durable acceptance
  and the recipient's read boundary.
- Administrator report review and legal-preservation procedures are separate
  privileged workflows. Feature 008 creates sufficient protected references
  for those workflows without exposing a general conversation reader.

## Feature 016 Notification Integration

- A durably accepted message creates or updates one bounded unread-conversation in-app notification for the other participant and never creates email.
- Opening successfully rendered message history atomically advances the existing participant read boundary and clears only that conversation's unified notifications; failed or forbidden loads do neither.
- Notification polling reuses safe `message:new` invalidation but does not add a second realtime transport or expose message content in notification payloads.
