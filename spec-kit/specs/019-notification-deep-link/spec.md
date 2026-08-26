# Feature Specification: Notification Deep-Link

> A future recruitment-message notification must resolve server-side to `/jobs/applied/{applicationId}/messages` for Candidates or `/recruiter/messages?thread={threadId}` for assigned staff; it must never use a static or cross-company href.

**Feature Branch**: `016-inapp-email-notification`  
**Created**: 2026-08-16  
**Status**: In progress

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a safe, current notification destination (Priority: P1)

As a signed-in recipient, I can open a notification using a destination calculated from its current context and my current audience, so I am taken only to a relevant, permitted screen.

**Why this priority**: It removes incorrect and stale notification navigation without weakening destination authorization.

**Independent Test**: Create otherwise identical application notifications for a candidate and recruiter, retrieve them as each audience, and verify their destinations differ and each landing screen independently enforces access.

**Acceptance Scenarios**:

1. **Given** a recruiter receives an application notification, **When** it is served, **Then** its destination opens the pipeline filtered to the relevant job/application.
2. **Given** a candidate receives an application-stage notification, **When** it is served, **Then** its destination opens that candidate's application detail.
3. **Given** a job-post decision notification, **When** the recruiter opens it, **Then** approval opens the posting and rejection/request-for-changes opens the editable review context.
4. **Given** an administrator receives a moderation report notification, **When** it is served, **Then** it opens the protected report detail; a non-administrator never receives that administrative destination.
5. **Given** a recipient receives a support, connection, membership, invitation, or report notification, **When** it is served, **Then** it receives a safe destination to the relevant workspace, activity, or protected review screen.
6. **Given** an administrator opens a notification destination requiring fresh two-factor proof, **When** the proof has expired, **Then** the console keeps the authenticated session, prompts for step-up verification, and reloads the protected destination after success.

---

### User Story 2 - Read without losing navigation or count accuracy (Priority: P1)

As a recipient, I can activate an unread notification without waiting for the read operation, while the notification count remains reconcilable after a temporary failure.

**Why this priority**: Notification interactions must feel immediate while retaining truthful unread state.

**Independent Test**: Trigger a 500 response for the per-notification read request, activate a notification with a valid destination, and confirm navigation proceeds and the next notification fetch corrects the count.

**Acceptance Scenarios**:

1. **Given** an unread notification with a destination, **When** its item is activated, **Then** the system issues an idempotent mark-read request and navigates without waiting for its result.
2. **Given** mark-read has a temporary failure, **When** the user activates the item, **Then** navigation still occurs and a later fetch reconciles the optimistic unread count.
3. **Given** a notification has no current destination or the user is already at its context, **When** it is activated, **Then** it is marked read without reloading or navigating.
4. **Given** a recipient has unsaved in-app form changes, **When** they activate a notification or another internal link, **Then** a SmartHire confirmation dialog lets them stay or discard the changes before navigation begins.

---

### User Story 3 - Understand unavailable destinations safely (Priority: P2)

As an authorized recipient, I receive a useful unavailable-content state when a resource was legitimately archived, hidden, or resolved; as an unauthorized person, I receive only a neutral denial.

**Why this priority**: It preserves useful context while preventing a notification link from revealing resource state or scope.

**Independent Test**: Change a resource after notification creation and compare the authorized stale-state response with a recipient whose membership or scope has been revoked.

**Acceptance Scenarios**:

1. **Given** a still-authorized user opens a destination whose resource is archived, hidden, or resolved, **When** the destination is loaded, **Then** it presents “Nội dung không còn khả dụng” with only safe contextual information.
2. **Given** a user loses membership or is outside the resource scope, **When** a known notification destination is loaded, **Then** it returns a neutral 404 or 403 without explaining why.
3. **Given** a grouped notification has more than one occurrence, **When** it is served, **Then** its destination is a context-filtered list including the relevant time boundary rather than a single record.

### Edge Cases

- Legacy notifications whose stored href is null use the server-resolved notification inbox fallback; stored href values are never trusted.
- A current resource may disappear or change state between serving the notification and opening its destination; destination authorization/state checks remain authoritative.
- New messages open the exact conversation; account and security events open `/profile/security`.
- Notification item activation and its separate “Mark as read” control are keyboard operable, visibly focused, and individually named for assistive technology.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST retain notification context type, context identifier, and recipient audience as the navigation source of truth and MUST NOT persist a static href for newly created notifications.
- **FR-002**: The system MUST resolve each served href from live resource state, context, occurrence count, and recipient audience; the resolver MUST accept the recipient role/audience explicitly.
- **FR-003**: The system MUST provide a server-resolved safe href for every notification kind, including job-post approval/rejection/request-changes, application received/stage change, moderation report, message, account/security, support, connection, membership, and company-invitation events. If no context-specific destination is safe, it MUST link to the recipient's notification inbox using the notification identifier.
- **FR-004**: A href MUST NOT grant access. Every destination MUST independently re-check authentication, role, membership, scope, and resource visibility.
- **FR-004a**: A protected administrator destination returning `STEP_UP_REQUIRED` MUST preserve the authenticated administrator session, request fresh two-factor proof, and retry or reload the destination after successful verification; it MUST NOT treat that response as logout.
- **FR-005**: Destinations MUST distinguish authorized-but-no-longer-available content from authorization loss: the former may show the safe unavailable-content state; the latter MUST use a neutral 404/403 response.
- **FR-006**: A grouped notification with occurrence count greater than one MUST resolve to a filtered list using its context and last-notified time, not to an individual resource.
- **FR-007**: Activating an item MUST mark it read by notification ID idempotently, optimistically refresh unread state, and continue navigation despite a transient read failure; the next fetch MUST reconcile failed optimistic state.
- **FR-008**: An item already at its resolved context MUST only mark read and must not reload or navigate.
- **FR-009**: The interface MUST distinguish item activation from a separate Mark as read action, show View details for every served notification, and support Enter, Space, accessible names, and a clear focus indicator.
- **FR-010**: While unsaved in-app form changes are active, internal navigation—including notification activation—MUST use an accessible SmartHire confirmation dialog. Refresh, tab closing, and other browser-controlled unloads MUST retain the browser-native protection.

### Key Entities

- **Notification context**: A stable type and identifier describing the affected resource, plus occurrence and timing information.
- **Recipient audience**: The recipient's current effective candidate, recruiter, or administrator audience used to select a safe destination.
- **Resolved destination**: A transient result containing a server-resolved safe href and safe availability semantics derived at serving time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of defined notification kinds resolve to an explicitly tested safe href rule for every supported audience.
- **SC-002**: In automated current-state tests, 100% of changed-state and revoked-access scenarios expose neither stale content nor protected state details.
- **SC-003**: In interaction tests, 100% of valid notification activations navigate even when a read request fails temporarily, and the next refresh restores the server unread count.
- **SC-004**: 100% of clickable notification controls pass keyboard activation, accessible-name, and visible-focus checks.
- **SC-005**: In interaction tests, internal navigation with unsaved changes opens the custom confirmation dialog, while the browser unload listener remains active for browser-controlled exits.

## Assumptions

- Existing context columns remain the migration-safe source for legacy records; stored href values are ignored for newly served deep-link decisions.
- “Recipient role” means the recipient's effective audience for the notification context, derived server-side rather than trusted from the client.
- Existing detail/list routes will add their unavailable-content response at their authorization boundary rather than allowing notification routing to disclose state.
