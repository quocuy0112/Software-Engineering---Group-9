# Feature Specification: Professional Connection Proposals

**Feature Branch**: `011-professional-connection-proposals`

**Created**: 2026-08-13

**Status**: Draft

**Input**: Platform administrators may propose a professional connection between two accounts, but both people must independently consent before Feature 008 permits discovery and messaging. The workflow must include lifecycle controls, notifications, abuse prevention, audit, retention, optional Support Center linkage, and safe disconnect behavior.

## User Scenarios & Testing

### User Story 1 - Administrator Proposes a Connection (Priority: P1)

As a Platform Administrator, I can select two distinct active accounts, provide a clear professional reason and expiry, and send a proposal to both people without directly creating a connection.

**Why this priority**: A safe proposal is the entry point for the entire workflow. It must preserve administrator accountability without bypassing either participant's consent.

**Independent Test**: Use an authorized Platform Administrator to find two eligible accounts, create one proposal, and verify that one active proposal exists for the canonical pair, both participants receive a safe notification, and no accepted connection or chat eligibility exists yet.

**Acceptance Scenarios**:

1. **Given** two distinct ACTIVE accounts with no block, accepted connection, active proposal, cooldown, or recipient quota conflict, **When** a Platform Administrator submits a valid reason and expiry, **Then** one `PENDING_BOTH` proposal is created and both participants are notified.
2. **Given** the same two accounts in reversed order, **When** an administrator attempts another proposal, **Then** the request is rejected as the same canonical pair without revealing unrelated account data.
3. **Given** a recruiter, support assignee without a Platform Administrator grant, or ordinary user, **When** that actor attempts to create or inspect an administrator proposal, **Then** the server denies access without returning proposal or target details.
4. **Given** a valid Support Center case visible to the administrator, **When** the administrator starts a proposal from that case, **Then** the proposal stores only the optional case reference and does not copy support messages or internal notes.

---

### User Story 2 - Participants Decide Independently (Priority: P1)

As either proposed participant, I can review proposals addressed to me and independently accept or decline each one. I may see aggregate acceptance progress, but never protected decline, block, or system-cancellation attribution about the other person.

**Why this priority**: Bilateral, informed consent is the core safety rule. A professional connection is invalid unless both participants actively accept.

**Independent Test**: Create a proposal for two accounts, accept as the first participant, then accept as the second; verify the intermediate and terminal states, exactly one accepted connection, notifications, and Feature 008 eligibility only after the second acceptance.

**Acceptance Scenarios**:

1. **Given** a `PENDING_BOTH` proposal, **When** one participant accepts, **Then** the proposal becomes `PARTIALLY_ACCEPTED`, records that participant's decision once, and creates no connection.
2. **Given** a `PARTIALLY_ACCEPTED` proposal, **When** the remaining participant accepts before expiry, **Then** the proposal and exactly one new professional connection become `ACCEPTED` atomically.
3. **Given** a pending or partially accepted proposal, **When** either participant declines, **Then** the proposal becomes `DECLINED`, no connection is created, and the other participant receives only a neutral notice that the proposal is no longer active.
4. **Given** repeated, stale, or concurrent decisions, **When** requests race, **Then** each participant has at most one authoritative decision and the server returns the current safe state without duplicate connection creation.
5. **Given** an unknown proposal or a proposal not addressed to the current user, **When** the user requests or mutates it, **Then** the response is the same neutral unavailable result.

---

### User Story 3 - Operate Proposal Lifecycle Safely (Priority: P1)

As a Platform Administrator and as a proposed participant, I receive predictable expiry, cancellation, quota, cooldown, block, account-state, and notification behavior throughout the proposal lifecycle.

**Why this priority**: Consent can still be undermined by spam, stale requests, or unsafe races unless lifecycle and abuse controls are enforced centrally.

**Independent Test**: Exercise expiry, administrator cancellation, recipient and administrator quotas, cooldowns, a messaging block, and account suspension; verify terminal states, neutral outputs, notifications, and immutable audit events.

**Acceptance Scenarios**:

1. **Given** an active proposal past its exact expiry, **When** any read, decision, or lifecycle worker evaluates it, **Then** it is treated as `EXPIRED` and can no longer be accepted.
2. **Given** a pending or partially accepted proposal, **When** any currently authorized Platform Administrator cancels it, **Then** it becomes `CANCELLED`, both participants receive a neutral notice, and any prior partial acceptance has no connection effect.
3. **Given** either directional `UserMessagingBlock` exists or is created for the pair, **When** proposal creation or acceptance is evaluated, **Then** no connection is created and any active proposal is cancelled without identifying the blocker.
4. **Given** either participant is no longer ACTIVE before final acceptance, **When** the proposal is evaluated, **Then** it becomes `CANCELLED` and neither participant can complete it.
5. **Given** a recipient, pair, or administrator has reached a defined quota or cooldown, **When** another proposal is attempted, **Then** the server rejects it with a safe retry indication and records the rejected administrative action.

---

### User Story 4 - Use and End an Accepted Connection (Priority: P1)

As either connected participant, I can discover and message the other person through Feature 008, and I can later disconnect without losing access to the prior conversation history that policy still permits me to read.

**Why this priority**: The feature is incomplete unless accepted consent activates messaging correctly and withdrawal of that relationship immediately stops new interaction.

**Independent Test**: Complete a proposal, open a Feature 008 conversation, exchange messages, disconnect as either participant, and verify immediate loss of send/presence/read capabilities with archived read-only history preserved.

**Acceptance Scenarios**:

1. **Given** a newly accepted professional connection, **When** either participant searches in Feature 008, **Then** the other becomes eligible and either participant can open one conversation for that connection.
2. **Given** an accepted connection with an existing conversation, **When** either participant disconnects, **Then** the connection becomes `REVOKED`, the conversation is archived, active realtime rooms are revoked, and new messages, typing, presence, and read-receipt writes are rejected immediately.
3. **Given** an archived conversation after disconnect, **When** either original participant opens it, **Then** policy-retained history remains readable and clearly marked read-only; no administrator gains access.
4. **Given** the same pair later completes a new proposal after all controls permit it, **When** they open messaging, **Then** a new connection and new conversation are created without merging or reactivating the archived conversation.

---

### User Story 5 - Review Accountability and Retention (Priority: P2)

As an authorized Platform Administrator or auditor, I can review an appropriate, time-bounded audit trail for proposal actions while sensitive decision details are hidden and deleted on schedule.

**Why this priority**: Administrator-initiated relationship proposals can be abused. Accountability is required, but indefinite visibility of who declined whom would create a separate privacy risk.

**Independent Test**: Create, decide, cancel, expire, and disconnect fixture records; verify allowlisted audit facts, normal and step-up access windows, content scrubbing, worker idempotency, and absence of proposal content from ordinary logs.

**Acceptance Scenarios**:

1. **Given** any proposal command or lifecycle transition, **When** it completes or is safely rejected, **Then** the audit trail records actor, action, target reference, result, time, correlation reference, and allowlisted state facts without reason text or unnecessary personal data.
2. **Given** a terminal proposal older than 90 days, **When** an ordinary administrator requests it, **Then** reason and per-party decision attribution are unavailable.
3. **Given** an authorized step-up audit review within 365 days, **When** the protected record is requested, **Then** the approved audit projection is available without support-message or private-chat content.
4. **Given** a terminal proposal at or beyond 365 days, **When** retention runs or any reader evaluates it, **Then** sensitive reason, direct participant attribution, and decision detail are deleted or irreversibly scrubbed while a minimal non-identifying integrity tombstone remains.

### Edge Cases

- The two selected account references resolve to the same account.
- The pair is supplied as A-B after B-A was already proposed or connected.
- Two administrators concurrently create proposals for the same pair.
- Both participants accept at the same instant, or acceptance races expiry, cancellation, suspension, or a new block.
- One participant accepts and later declines before the other decides.
- The creating administrator loses authority or their account is suspended while the proposal remains active.
- A linked Support Center case closes, is reassigned, or reaches content-retention deletion after proposal creation.
- Notification delivery is delayed, duplicated, or permanently unavailable after the proposal transaction commits.
- A disconnect races an in-flight message or a reconnect attempt in Feature 008.
- A participant attempts to infer who declined, blocked, or caused system cancellation from response shape, timing, email, or in-app copy.
- Retention worker retries after partial infrastructure failure or runs concurrently on the same batch.

## Requirements

### Functional Requirements

- **FR-001**: Only a currently authorized Platform Administrator with an ACTIVE account and valid administrator session may create, list, inspect, or cancel administrator-mediated professional connection proposals; recruiter roles and Support assignments alone MUST grant no authority.
- **FR-002**: Administrator account selection MUST support exact account ID and exact normalized email search plus bounded display-name search through the protected administrator account boundary.
- **FR-003**: Proposal creation MUST require two distinct ACTIVE account references, a normalized participant-visible reason of 10–500 characters, an expiry from 1–30 days, and an idempotency key.
- **FR-004**: The default expiry MUST be seven days when the administrator does not choose another valid duration.
- **FR-005**: Every pair MUST be stored and compared in canonical unordered order so A-B and B-A are the same pair.
- **FR-006**: The system MUST permit at most one active proposal (`PENDING_BOTH` or `PARTIALLY_ACCEPTED`) per canonical pair.
- **FR-007**: The system MUST reject proposal creation when the pair already has an `ACCEPTED` professional connection.
- **FR-008**: Proposal states MUST be exactly `PENDING_BOTH`, `PARTIALLY_ACCEPTED`, `ACCEPTED`, `DECLINED`, `EXPIRED`, and `CANCELLED`, with server-validated transitions only.
- **FR-009**: Creating a proposal MUST NOT create a `ProfessionalConnection` or make either participant eligible for Feature 008 discovery or messaging.
- **FR-010**: Each participant MUST be able to list and inspect only proposals in which that account is one of the two participants.
- **FR-011**: Each participant MUST be able to record one independent `ACCEPTED` or `DECLINED` decision while the proposal is active, with idempotent retry and optimistic concurrency handling.
- **FR-012**: A participant who previously accepted MAY decline before the other participant accepts; that decline MUST terminally set the proposal to `DECLINED` and MUST NOT create a connection.
- **FR-013**: The first acceptance MUST move the proposal to `PARTIALLY_ACCEPTED` without identifying that decision to the other participant beyond the safe aggregate state.
- **FR-014**: The second valid acceptance MUST atomically set the proposal to `ACCEPTED`, create exactly one `ProfessionalConnection` in `ACCEPTED` state, and enqueue notifications to both participants.
- **FR-015**: Any valid decline MUST atomically set the proposal to `DECLINED`, prevent connection creation, and expose only neutral terminal copy to the other participant.
- **FR-016**: Any currently authorized Platform Administrator may cancel a `PENDING_BOTH` or `PARTIALLY_ACCEPTED` proposal; cancellation MUST identify the cancelling administrator in protected audit, notify both participants neutrally, and MUST NOT expose or preserve an actionable partial acceptance.
- **FR-017**: Active proposals MUST become unusable at their exact expiry even before a lifecycle worker persists `EXPIRED`; reads and commands MUST enforce the same boundary.
- **FR-018**: If either participant ceases to be ACTIVE before final acceptance, the system MUST cancel the proposal and prevent connection creation.
- **FR-019**: Either directional existing `UserMessagingBlock` MUST prevent proposal creation and final acceptance, and creation of a block MUST cancel any active proposal for the pair without revealing the blocker.
- **FR-020**: One account may participate in at most three active proposals at once.
- **FR-021**: One account may receive at most five newly created proposals across all pairs and administrators in any rolling 30-day period.
- **FR-022**: One Platform Administrator may create at most 20 proposals in any rolling 24-hour period; rejected and idempotently replayed commands MUST NOT create additional proposals.
- **FR-023**: A canonical pair MUST have a 30-day re-proposal cooldown after `DECLINED` and a seven-day cooldown after `EXPIRED` or `CANCELLED`.
- **FR-024**: Quota, cooldown, block, account-state, unknown-target, and unauthorized failures MUST use safe responses that do not reveal unrelated account existence, blocker identity, or which participant declined.
- **FR-025**: Proposal creation and terminal lifecycle changes MUST produce in-app notifications and content-minimized email intents for both participants; delivery failure MUST be retryable and MUST NOT roll back committed proposal or connection state.
- **FR-026**: Participant notification copy MUST be symmetric and MUST NOT identify who declined, blocked, failed an account-state check, or caused a system cancellation.
- **FR-027**: An administrator MAY associate a proposal with one Support Center case they are authorized to view, but only the opaque case reference may cross the boundary; support messages, notes, and assignments MUST NOT be copied.
- **FR-028**: Support-case closure, reassignment, or content deletion MUST NOT alter proposal consent or lifecycle state.
- **FR-029**: Every create, accept, decline, cancel, expire, block-cancel, account-cancel, connection-create, disconnect, retention, and rejected privileged command MUST produce an immutable, allowlisted audit event.
- **FR-030**: Proposal reason text, raw email, support content, private-chat content, and unnecessary decision attribution MUST NOT appear in ordinary application logs, realtime invalidations, notification metadata, or broad audit projections.
- **FR-031**: Ordinary administrator and participant proposal detail MUST hide terminal reason and per-party decision attribution after 90 days.
- **FR-032**: Protected audit detail MAY remain available through step-up authorization until 365 days after terminal state; at the exact 365-day boundary sensitive reason, direct participant attribution, and decision detail MUST be deleted or irreversibly scrubbed.
- **FR-033**: Retention MUST delete in-app proposal/connection notification rows no later than 90 days after notification creation, make scrubbed proposals unavailable to operational participant/admin lists and detail, and preserve only a minimal non-identifying proposal tombstone plus required connection/audit integrity references after protected deletion. Existing email-outbox retention remains authoritative for delivery records.
- **FR-034**: `ProfessionalConnection` lifecycle states MUST include `ACCEPTED` and `REVOKED`, and the database MUST prevent more than one current `ACCEPTED` connection per canonical pair while permitting historical revoked connections.
- **FR-035**: Either participant in an `ACCEPTED` connection may disconnect it; Platform Administrators MUST NOT force acceptance or use proposal administration to read, send, or impersonate private Feature 008 messages.
- **FR-036**: Disconnect MUST atomically set the connection to `REVOKED`, archive its Feature 008 conversation if one exists, and revoke active realtime authority for that relationship.
- **FR-037**: After disconnect, Feature 008 MUST reject new messages, typing, presence, read-receipt writes, conversation reactivation, and eligible-participant discovery for that revoked connection.
- **FR-038**: Original participants MUST retain read-only access to policy-retained history in the archived conversation; administrators and unrelated users MUST gain no access.
- **FR-039**: A later newly accepted connection for the same pair MUST create a new conversation context and MUST NOT merge with or reactivate prior archived history.
- **FR-040**: Proposal and disconnect reads and commands MUST use the existing exclusive server-controlled browser session, server-side authorization, strict typed validation, no-store responses, CSRF protection where applicable, idempotency, and transactional writes.
- **FR-041**: Administrator and participant interfaces MUST be responsive, keyboard operable, screen-reader labelled, and communicate state with text rather than color alone; stale and offline outcomes MUST preserve typed input where safe.
- **FR-042**: Lifecycle and retention processing MUST use bounded, retry-safe batches and MUST converge correctly when workers restart or overlap.
- **FR-043**: The system MUST provide deterministic ordering and pagination for administrator proposal lists and participant proposal lists without loading an unbounded result set into application memory.
- **FR-044**: The existing Feature 008 contract that temporarily assigns minimal Professional Connection ownership to Feature 007 MUST be superseded: Feature 011 is the sole owner of proposal, consent, connection lifecycle, and disconnect semantics; Feature 008 remains the consumer of current accepted eligibility and archived-history state.

### Key Entities

- **ProfessionalConnectionProposal**: Canonical two-account proposal, creator, participant-visible reason, lifecycle state, expiry, optional Support Center reference, version, terminal and retention timestamps.
- **ProfessionalConnectionDecision**: One participant's authoritative current decision for an active proposal, including decision, version, and time; participant attribution is protected and retention-bound, while immutable transition history records any allowed withdrawal.
- **ProfessionalConnection**: The accepted relationship produced only by bilateral consent, with canonical participants, accepted/revoked lifecycle, source proposal, and disconnect facts.
- **ProfessionalConnectionProposalHistory**: Immutable allowlisted transition record used for accountability without retaining message or support content.
- **ProfessionalConnectionNotification**: Content-minimized in-app/email delivery intent for proposal and connection lifecycle changes.
- **Archived Messaging Conversation**: Existing Feature 008 conversation marked read-only when its professional connection is revoked.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In 100 concurrent creation attempts for one canonical pair, exactly one active proposal is committed and no accepted connection exists.
- **SC-002**: In 100 concurrent final-acceptance attempts, exactly one accepted connection is committed and each participant has one authoritative decision.
- **SC-003**: Across an automated authorization matrix, 100% of recruiter-only, support-assignment-only, unrelated-user, inactive-account, blocked-pair, and cross-participant access attempts return no protected proposal data.
- **SC-004**: Administrator and participant proposal list/detail interactions complete at P95 within two seconds over a documented dataset of at least 10,000 accounts, 10,000 terminal proposals, and 1,000 active proposals.
- **SC-005**: At least 95% of committed in-app proposal state changes become visible to online recipients within five seconds over a documented representative test window; delayed delivery reconciles from authoritative state after refresh.
- **SC-006**: Disconnect removes send, presence, typing, and read-write authority for every tested active socket and HTTP request while preserving authorized read-only history.
- **SC-007**: Exact-boundary retention tests show ordinary proposal-detail suppression and notification unavailability at 90 days plus irreversible proposal sensitive-detail deletion at 365 days in 100% of cases, including worker retry and overlap.
- **SC-008**: All tested proposal, decision, cancellation, expiry, connection, disconnect, and retention transitions produce one correlated allowlisted audit history without reason text, support content, or private messages.
- **SC-009**: In moderated usability tests, at least 90% of participants correctly understand that both people must accept and that a neutral terminal notice does not identify who declined or blocked.
- **SC-010**: Candidate-facing proposal and archived-chat workflows complete with no critical automated accessibility violations and remain fully operable at 320 CSS pixels and by keyboard alone.

## Assumptions

- Existing Feature 001 Better Auth sessions and account `ACTIVE` state remain authoritative.
- Existing Feature 006 Platform Administrator grants, step-up authorization, audit infrastructure, notification outbox, admin account search, worker runtime, and Support Center are reused rather than duplicated.
- Existing Feature 008 `UserMessagingBlock`, Socket.IO transport, conversation/message retention, and private-message privacy boundary remain authoritative.
- Proposal reason is deliberately participant-visible and must contain only professional context suitable for both recipients; administrators receive UI guidance not to enter sensitive support or recruitment evidence.
- The default proposal expiry is seven days; an administrator may choose any whole-day duration from one through 30 days.
- Cooldowns start at the terminal transition time. Recipient and administrator quotas use rolling windows, not calendar dates.
- Any currently authorized Platform Administrator may cancel an active proposal. Loss of the creator's authority does not itself alter participant consent; the proposal continues until decision, cancellation by an authorized administrator, safety/account invalidation, or expiry.
- Either participant may disconnect an accepted professional connection. Administrative enforcement and messaging blocks remain separate safety mechanisms.
- Notification provider outages do not weaken committed consent or disconnect state; users can always reconcile through authoritative in-app reads.

## Dependencies

- Feature 001: exclusive browser session, account state, CSRF, and identity.
- Feature 006: Platform Administrator boundary, account lookup, audit, notification outbox, workers, and optional `SupportConversation` reference.
- Feature 008: accepted-connection eligibility adapter, messaging block, conversation archive/read-only behavior, realtime authority revocation, and message retention.

## Out of Scope

- Administrator force-acceptance, automatic acceptance, or creation of an already accepted connection.
- Recruiter-admin authority to create platform proposals solely because of a company role.
- Administrator access to ordinary Feature 008 message content, message search, impersonation, or private-chat export.
- Public people discovery, follower/friend graphs, unsolicited direct messaging, or fuzzy email discovery for ordinary users.
- AI-generated relationship recommendations or automated matching between people.
- Group conversations, multi-party proposals, connection endorsements, and professional-network feeds.
- Copying Support Center transcripts or internal notes into proposals.

## Change Log

- **2026-08-13** — Initial Feature 011 specification created from the approved bilateral-consent, lifecycle, privacy, retention, Support linkage, and Feature 008 disconnect decisions.
