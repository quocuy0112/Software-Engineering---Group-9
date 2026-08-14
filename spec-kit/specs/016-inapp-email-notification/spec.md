# Feature Specification: In-App Notification Center

**Feature Branch**: `015-inapp-email-notification`

**Feature Directory**: `016-inapp-email-notification`

**Created**: 2026-08-14

**Status**: Draft

**Input**: Build a complete in-app notification center without changing existing email notification behavior. Every existing event-notification email must also be represented in-app, while in-app-only events do not have to send email. Action and proof emails remain private delivery mechanisms and are not copied into the notification center.

## Clarifications

### Session 2026-08-14

- **Q: Which existing emails must also appear in-app?** → **A:** Every email that reports a completed or changed event must have a safe in-app counterpart; emails whose purpose is to deliver a token, proof, link, or one-time code are excluded.
- **Q: Does introducing in-app notification change current email behavior?** → **A:** No. Existing email recipients, content, preferences, queueing, and retries remain unchanged. In-app is the canonical user notification record for supported events, while email remains an optional or mandatory companion according to the existing event rule.
- **Q: When may a contextual notification be cleared automatically?** → **A:** Only after the represented content has loaded successfully for the authorized recipient. Route entry, failed loading, and forbidden access do not clear it.
- **Q: How long are user-visible in-app notifications retained?** → **A:** Ninety days from creation. Originating audit and workflow records keep their independent retention rules.
- **Q: Which new emails are added by this feature?** → **A:** None by default. Feature 016 adds in-app coverage and may only add a new email if a separately identified critical off-app safety gap is proven during implementation and covered by an explicit requirement update.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Security and Account Events In-App (Priority: P1)

An authenticated user receives a safe in-app record whenever an account, security, membership, or recovery event changes their access or requires their awareness. The notification clearly communicates severity and links to an appropriate safe destination without exposing credentials, tokens, recovery proofs, or private administrative evidence.

**Why this priority**: Missing security and access notifications can leave users unaware of account-impacting actions and creates a mismatch with existing email delivery.

**Independent Test**: Trigger each supported security or account event for a test account and verify that exactly one authorized notification appears, contains no secret material, has the correct severity, and opens a permitted destination.

**Acceptance Scenarios**:

1. **Given** an administrator suspends an active account, **When** the suspension succeeds, **Then** the affected user receives one critical in-app notification while the existing suspension email remains unchanged.
2. **Given** a user's password is changed successfully, **When** the event is committed, **Then** the user receives one high-severity in-app notification and the existing email continues to be delivered by its current mechanism.
3. **Given** a company-email verification link is generated, **When** the email is queued, **Then** no in-app notification contains or links to the verification token.
4. **Given** an event is retried by a worker or request handler, **When** notification creation is attempted again with the same event identity, **Then** no duplicate notification is created.

---

### User Story 2 - Use a Unified Notification Inbox (Priority: P1)

Candidates, recruiters, and administrators can open a notification control from their authenticated application shell, see an unread count, browse recent notifications, open a relevant destination, mark individual notifications as read, and mark all accessible notifications as read.

**Why this priority**: A unified, reliable inbox is the core user-visible capability and is required before event-specific integrations provide value.

**Independent Test**: Seed mixed notifications for one user and verify list ordering, pagination, unread count, individual read, read-all, deep links, empty state, loading state, and authorization isolation.

**Acceptance Scenarios**:

1. **Given** a user has unread notifications, **When** any authenticated application shell loads, **Then** the notification control displays the correct unread count without blocking the page.
2. **Given** a user opens the notification panel, **When** notifications load, **Then** they are ordered newest first and display category, severity, title, summary, relative time, and read state.
3. **Given** a user selects an unread notification, **When** its destination is accessible, **Then** the notification is marked read and navigation occurs.
4. **Given** a user attempts to read or mutate another user's notification identifier, **When** the request is evaluated, **Then** the request is rejected without revealing whether that notification exists.
5. **Given** no notifications exist, **When** the panel or notification page loads, **Then** an accessible empty state is shown without an error.

---

### User Story 3 - Follow Workflow Outcomes (Priority: P2)

Users receive in-app updates for job applications, recruiter verification, support cases, professional connections, and moderation/report outcomes that concern them. Existing event emails remain unchanged and continue to respect their existing delivery rules.

**Why this priority**: These workflows are time-sensitive and currently rely on fragmented email, projection, or feature-specific notification storage.

**Independent Test**: Complete one state transition in every supported workflow and verify recipient selection, safe content, destination, severity, email preservation, and duplicate protection.

**Acceptance Scenarios**:

1. **Given** an application stage changes, **When** the transition succeeds, **Then** the candidate receives one in-app update whether or not optional application-update email is enabled.
2. **Given** a recruiter verification request is approved, rejected, delayed, expired, cancelled, or returned for changes, **When** the state transition succeeds, **Then** the requester receives the corresponding in-app outcome.
3. **Given** a support case needs user input or is resolved, **When** support records the transition, **Then** the case owner receives an in-app notification linked to the case.
4. **Given** a professional connection proposal is created, updated, accepted, revoked, or becomes inactive, **When** the event succeeds, **Then** every intended recipient receives exactly one unified in-app notification and existing connection emails remain unchanged.
5. **Given** a user reports a conversation message, **When** the report is accepted or later resolved, **Then** the reporter receives an in-app receipt or outcome without receiving restricted moderation details.

---

### User Story 4 - Clear Notifications While Viewing Their Context (Priority: P2)

When a user successfully views the content represented by a notification, related unread notifications are cleared automatically. Merely visiting a route that fails to load, is unauthorized, or does not display the represented content does not clear them.

**Why this priority**: Unread badges must reflect information the user has actually seen, especially for messages and workflow pages.

**Independent Test**: Open an unread conversation or workflow detail, confirm the content renders, and verify only matching notifications become read; repeat with a failed or unauthorized load and verify they remain unread.

**Acceptance Scenarios**:

1. **Given** unread message notifications exist for a conversation, **When** the user opens that conversation and messages render successfully, **Then** matching message notifications are marked read.
2. **Given** multiple applications have unread updates, **When** the user views one application successfully, **Then** only notifications associated with that application are marked read.
3. **Given** a destination fails to load, **When** the error is displayed, **Then** its notifications remain unread.
4. **Given** the same account is open in two browser sessions, **When** one session marks notifications read, **Then** the other session converges to the updated unread count within the notification freshness target.

---

### User Story 5 - Receive In-App-Only Operational Updates (Priority: P3)

Users receive useful low- and medium-priority updates in-app without unnecessary email, including application submission receipts, recruiter application receipts, new-message notices, report receipts, and non-critical reminders or recommendations where supported.

**Why this priority**: In-app-only delivery reduces email fatigue while keeping operational feedback discoverable.

**Independent Test**: Trigger each in-app-only event and verify a notification is created, no email is newly queued, preferences are honored where applicable, and repeated events are grouped or deduplicated as specified.

**Acceptance Scenarios**:

1. **Given** a candidate submits an application, **When** submission succeeds, **Then** the candidate receives an in-app receipt and no new email requirement is introduced.
2. **Given** an authorized recruiter receives a new application, **When** submission succeeds, **Then** each intended recruiter recipient receives an in-app notification without exposing the application to unrelated company members.
3. **Given** a user receives multiple unread messages in one conversation before opening it, **When** notifications are listed, **Then** the user sees a bounded, comprehensible conversation update rather than an unbounded duplicate flood.
4. **Given** an optional low-priority category is disabled in user preferences, **When** such an event occurs, **Then** the disabled optional notification is not created while mandatory security notifications remain unaffected.

---

### User Story 6 - Operate Reliably During Channel Failures (Priority: P3)

Operators can diagnose notification creation and delivery failures without exposing private payloads. An email provider failure does not remove a committed in-app notification, and an in-app delivery failure does not mutate the underlying business transaction into an incorrect state.

**Why this priority**: Notification channels are secondary delivery mechanisms and must not corrupt authoritative workflow state.

**Independent Test**: Simulate email and notification-processing failures, retry processing, and verify business state correctness, recoverable delivery, deduplication, and sanitized operational logs.

**Acceptance Scenarios**:

1. **Given** an event email provider is unavailable, **When** a mirrored event occurs, **Then** the in-app notification remains available and the existing email retry behavior is preserved.
2. **Given** notification persistence fails before a transaction commits, **When** the operation returns, **Then** the system does not report a successful notification and does not leave a partial notification record.
3. **Given** a failed notification job is retried, **When** processing later succeeds, **Then** one notification is visible and operational logs identify the event without logging confidential payloads.

### Edge Cases

- A recipient account is deleted, suspended, or loses a company membership between event creation and notification retrieval.
- One business event targets the same user through multiple roles or memberships.
- A notification destination no longer exists, is archived, or becomes unauthorized after creation.
- A notification title or summary includes untrusted user-provided text, Unicode, or unusually long content.
- A client retries read mutations because of a network timeout.
- The unread count exceeds the compact badge display limit.
- A browser tab is offline and reconnects after notifications were read elsewhere.
- A user has thousands of retained notifications and requests a page beyond the available cursor.
- A legacy feature-specific notification exists during migration to the unified inbox.
- An email challenge expires, is replaced, or is used; no challenge secret may be copied to in-app storage at any point.
- A report contains restricted evidence; the reporter receives only status-safe content.
- An event occurs before a recipient preference row exists; mandatory defaults must be applied safely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide one unified in-app notification inbox for authenticated candidate, recruiter, and administrator experiences.
- **FR-002**: The system MUST persist recipient, event kind, category, severity, safe title, safe summary, safe destination, read timestamp, creation timestamp, expiry policy, and an idempotency identity for every unified notification.
- **FR-003**: The system MUST treat PostgreSQL notification records as the authoritative source for notification history and unread state.
- **FR-004**: The system MUST prevent duplicate notifications for the same recipient and logical business event, including request retries and worker retries.
- **FR-005**: The system MUST create an in-app notification for every existing email that communicates a completed or changed business, account, security, support, verification, application, moderation, or connection event.
- **FR-006**: The system MUST preserve the current recipient selection, templates, subjects, contents, preferences, queueing, retry, and delivery behavior of all existing email notifications.
- **FR-007**: The system MUST NOT require an email for every in-app notification.
- **FR-008**: The system MUST NOT copy action or proof emails into the notification inbox when their primary purpose is to deliver a verification token, reset token, recovery proof, one-time code, or equivalent secret.
- **FR-009**: The system MUST NOT store tokens, authentication secrets, raw recovery proofs, private moderation evidence, business-license content, or unrestricted administrator notes in notification payloads.
- **FR-010**: The system MUST generate notification text from an allow-listed event policy rather than storing arbitrary HTML or executable content.
- **FR-011**: The system MUST escape or otherwise safely render all user-originated text included in a notification.
- **FR-012**: The system MUST assign one of four user-visible severity levels—critical, high, medium, or low—according to a centrally maintained event policy.
- **FR-013**: Critical and high notifications MUST remain enabled regardless of optional marketing or recommendation preferences.
- **FR-014**: Optional medium or low notification categories MUST honor applicable user preferences, with safe defaults when no preference record exists.
- **FR-015**: The system MUST expose a paginated, newest-first list limited to notifications owned by the authenticated recipient.
- **FR-016**: The system MUST expose the authenticated recipient's unread count without returning full notification payloads.
- **FR-017**: Users MUST be able to mark one owned notification as read using an idempotent operation.
- **FR-018**: Users MUST be able to mark all accessible notifications as read using an idempotent operation.
- **FR-019**: The system MUST support marking notifications read by an allow-listed context type and context identifier after represented content is successfully displayed.
- **FR-020**: A failed, forbidden, missing, or incomplete content view MUST NOT automatically mark a notification as read.
- **FR-021**: Read-state changes MUST converge across active sessions within five seconds under normal operating conditions.
- **FR-022**: The notification control MUST display a compact unread badge, with an overflow representation rather than an unbounded number.
- **FR-023**: The notification panel and full inbox MUST provide loading, empty, error, retry, read, and unread states.
- **FR-024**: Notification links MUST use allow-listed internal destinations and MUST be re-authorized when opened.
- **FR-025**: Missing or newly forbidden destinations MUST show a safe result and allow the notification to be marked read without disclosing restricted data.
- **FR-026**: Application stage changes MUST notify the candidate in-app independently of the candidate's optional application-update email preference.
- **FR-027**: Successful application submission MUST create an in-app receipt for the candidate and an in-app new-application notice for authorized recruiter recipients without adding a mandatory email.
- **FR-028**: Recruiter verification receipt, changes requested, approved, rejected, cancelled, delayed, and expired events MUST create safe in-app notifications for the requester.
- **FR-029**: Support waiting-for-user and resolved events MUST create in-app notifications for the case owner.
- **FR-030**: Professional connection proposal created, updated, inactive, accepted, and revoked events MUST be represented in the unified inbox without changing their existing email behavior.
- **FR-031**: New conversation messages MUST produce in-app updates for offline or out-of-context recipients while avoiding unbounded duplicate notification growth for one unread conversation.
- **FR-032**: Successfully displaying a conversation MUST mark that conversation's message notifications read and synchronize the existing conversation unread indicator.
- **FR-033**: Message-report receipt and safe outcome events MUST notify the reporter in-app without exposing private moderator reasoning or evidence.
- **FR-034**: Account suspension, reinstatement, session revocation, company-membership suspension, restoration, removal, password changed, and account-recovery state events MUST create severity-appropriate in-app notifications when an authenticated recipient account remains available.
- **FR-035**: The system MUST use explicit authorized recipient rules for company-scoped events and MUST collapse duplicate recipient identities caused by multiple roles.
- **FR-036**: Notification creation MUST not convert a failed business operation into success or a successful committed business operation into an incorrect business state.
- **FR-037**: Email-channel failure MUST NOT delete or hide a committed in-app notification, and in-app-channel failure MUST NOT alter existing email retry semantics.
- **FR-038**: Notification creation, retry, deduplication, and failure MUST produce sanitized structured operational records containing event kind, recipient reference, outcome, and correlation identity but no secret payload.
- **FR-039**: The system MUST retain user-visible notifications for 90 days from creation and remove expired records without removing the authoritative audit history required by the originating feature.
- **FR-040**: The notification experience MUST be keyboard operable, expose meaningful accessible labels and live status, and not communicate severity or read state by color alone.
- **FR-041**: User-facing notification copy MUST use the application's localization mechanism and provide a safe fallback when a translation key is unavailable.
- **FR-042**: Existing feature-specific unread indicators MUST remain consistent with the unified read state during migration.
- **FR-043**: Legacy professional-connection notification data MUST be migrated or safely bridged so users do not receive duplicate visible notifications for the same event.
- **FR-044**: Existing recruitment notification work items MUST be consumed, bridged, or replaced without losing application submission, application received, or application stage-change events.
- **FR-045**: The system MUST provide deterministic test coverage for event policy, recipient authorization, idempotency, preferences, pagination, read mutations, active-context clearing, secret exclusion, and email behavior preservation.

### Notification Channel Policy

| Event family | In-app | Existing email | New email |
|---|---:|---:|---:|
| Security/account completed events | Mandatory | Preserve current behavior | None by default |
| Verification workflow outcomes | Mandatory | Preserve current behavior | None by default |
| Application stage changes | Mandatory | Preserve current preference behavior | None |
| Application submitted/received | Mandatory | Not required | None |
| Support workflow updates | Mandatory | Preserve current behavior | None |
| Professional connections | Mandatory | Preserve current behavior | None |
| New messages and report receipts | Mandatory | Not required | None |
| Optional recommendations/reminders | Preference-controlled | Not required | Only through a separately approved requirement |
| Verification, reset, recovery proof, and one-time-code delivery | Excluded | Preserve current behavior | None |

### Key Entities *(include if feature involves data)*

- **In-App Notification**: A safe, user-visible record of one event for one recipient, including category, severity, display copy, destination, context, read state, expiry, and idempotency identity.
- **Notification Event Policy**: The allow-listed definition for an event kind, including severity, eligible channels, recipients, preference behavior, safe copy builder, context type, and destination rules.
- **Notification Context**: A safe association to a conversation, application, verification request, support case, report, connection, account, or membership used for navigation and contextual read operations.
- **Recipient Preference**: A user's optional channel/category choices. Mandatory security and access notifications override optional suppression.
- **Delivery Correlation**: A non-secret identity connecting one business event to its channel attempts for deduplication and diagnostics without coupling channel success.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing event-notification email variants have a corresponding safe in-app event policy, while 0% of token/proof email variants copy their secret into notification storage.
- **SC-002**: At least 95% of committed notifications become visible to an active authenticated client within five seconds under normal local and staging load.
- **SC-003**: Replaying any supported business event or delivery attempt produces no more than one visible notification per intended recipient and logical event.
- **SC-004**: Authorization tests demonstrate that a user cannot list, count, read, or context-clear another user's notifications.
- **SC-005**: Existing email regression tests show no changed subject, body, recipient, preference, queueing, or retry behavior for current email notifications.
- **SC-006**: 100% of supported workflow transitions in the event catalog pass tests for intended recipients, severity, destination, safe content, and deduplication.
- **SC-007**: Individual read, read-all, and context-read operations remain correct when repeated and converge across two active sessions within five seconds.
- **SC-008**: The notification panel and inbox pass keyboard-only operation and automated accessibility checks for labels, focus, live status, and non-color state communication.
- **SC-009**: Failure-injection tests show that channel outages do not corrupt originating business state and recover without duplicate notifications.
- **SC-010**: All Critical, High, Medium, and Low findings from the Spec Kit consistency analysis and project validation applicable to Feature 016 are resolved before completion is reported.

## Assumptions

- The user-created branch name remains `015-inapp-email-notification`; the specification directory uses sequential Feature 016 because Feature 015 is already assigned to candidate hybrid ranking.
- Existing authentication, authorization, application shells, localization, job, messaging, support, moderation, verification, connection, and email-outbox capabilities are extended rather than replaced.
- Notification copy is a concise event summary, not a copy of an email body.
- New email templates are out of scope unless implementation analysis finds a critical off-app safety event that has no existing email and cannot be adequately handled in-app; any such addition must not alter existing templates or delivery rules.
- User-visible notifications use one 90-day retention period; cleanup scheduling is determined during planning while originating audit records retain their own policies.
- Normal freshness may use polling or an existing real-time transport; the specification requires the outcome, not a particular transport.
- Desktop and responsive web are in scope. Native mobile push notifications are out of scope.
