# Research: In-App Notification Center

## Decision 1: Use One Unified PostgreSQL Notification Record

**Decision**: Add a single recipient-owned in-app notification model and make it the authoritative inbox/read-state source.

**Rationale**: The repository currently has `ProfessionalConnectionNotification`, which is user-visible but connection-specific, and `RecruitmentNotificationWork`, which is a delivery work queue rather than an inbox. A unified model prevents each feature from creating separate APIs, badges, retention rules, and authorization behavior.

**Alternatives considered**:

- Keep one table per feature: rejected because unread count, read-all, retention, and cross-feature UI remain fragmented.
- Derive the inbox from email outbox rows: rejected because in-app-only events have no email, challenge emails contain restricted delivery intent, and email lifecycle/status is not user read state.
- Store notifications only in client memory: rejected because PostgreSQL must be authoritative and multi-session convergence is required.

## Decision 2: Use a Central Allow-Listed Event Policy

**Decision**: Define supported event kinds in one server-only policy that owns category, severity, mandatory/optional behavior, context, safe destination, localization copy builder, safe variable schema, and email classification.

**Rationale**: A generic title/body insertion API would permit secrets, HTML, or private evidence to leak. A policy makes event coverage reviewable and deterministic and supports exhaustive tests.

**Alternatives considered**:

- Let each producer write arbitrary copy: rejected because privacy and consistency cannot be enforced centrally.
- Copy rendered email bodies: rejected because email may include delivery links or more detail than an inbox needs and the user explicitly prohibited changing existing email behavior.
- Render copy only on the client from raw payloads: rejected because raw business payloads would cross a wider trust boundary.

## Decision 3: Persist Localized Safe Copy at Event Time

**Decision**: Resolve the recipient's current language through the existing preference record and persist safe title and summary generated from application localization copy. Also persist the event kind and bounded safe context for auditability.

**Rationale**: API responses stay simple and never return raw email/business payloads. Existing notifications remain understandable even if a copy key is later removed. The event policy provides an English fallback if the selected locale is unavailable.

**Alternatives considered**:

- Persist only translation keys and variables: rejected because old records could become unrenderable after copy changes and every client would need identical rendering logic.
- Persist both English and Vietnamese bodies: rejected as unnecessary duplication for immutable event summaries.

## Decision 4: Preserve Email Production and Add Adjacent In-App Writes

**Decision**: Do not edit existing email templates, subjects, renderer logic, recipient rules, preferences, or provider workflow. Add an independent in-app write at the authoritative event producer using the same business event identity.

**Rationale**: This meets the user's non-regression requirement and keeps provider failure separate from inbox availability. Existing email tests can prove the protected behavior.

**Alternatives considered**:

- Modify the email worker to create all notifications: rejected because in-app delivery would depend on the email worker and would not cover in-app-only events.
- Replace email outbox with a generic multi-channel outbox: rejected as an over-broad migration that risks changing established email behavior.

## Decision 5: Exclude Challenge and Proof Delivery

**Decision**: Never mirror `VERIFY_EMAIL`, `EMAIL_CHANGE_VERIFY`, `RESET_PASSWORD`, or `COMPANY_EMAIL_VERIFY`. Classify `SECURITY_ALERT` by event kind so recovery confirmations/proofs remain excluded while completed state/security alerts are included.

**Rationale**: Notification data is visible after normal authentication and must not become a second storage location for credentials or one-time proofs.

**Alternatives considered**:

- Show a generic “check your email” notification: rejected for Feature 016 because it creates noisy duplicates without communicating a completed event.
- Copy links without tokens: rejected because challenge messages still represent an incomplete proof action rather than an event notification.

## Decision 6: Four-Second Polling for Freshness

**Decision**: Use TanStack Query polling every four seconds in visible authenticated shells, with immediate cache invalidation after mutations and event-driven invalidation where existing sockets already provide a safe signal.

**Rationale**: It meets the five-second P95 target without adding a new realtime namespace or placing notification business logic in the custom server. It also works for admin and ordinary workspace shells through one API.

**Alternatives considered**:

- Add a new Socket.IO notification channel: deferred because polling meets the target with less operational complexity.
- Server-sent events: rejected because it introduces another long-lived transport beside the approved socket composition.
- Refresh only on page navigation: rejected because active-session convergence would miss the freshness target.

## Decision 7: Cursor Pagination and Indexed Unread Count

**Decision**: Use a stable `(lastOccurredAt, id)` descending cursor, a bounded page size of 20 by default and 50 maximum, and recipient/read/expiry indexes. Groupable unread message bursts update `occurrenceCount`, safe summary, and `lastOccurredAt`; all other event kinds remain immutable insert-once records.

**Rationale**: Offset pagination becomes slower and unstable when new notifications arrive. The composite cursor is deterministic and supports thousands of records per user.

**Alternatives considered**:

- Offset/page pagination: rejected because inserts can cause duplicates or skipped items between requests.
- Return all retained rows: rejected because 90 days of message and application events can be large.

## Decision 8: Context Read Requires Successful Protected Content Load

**Decision**: Allow only enumerated context types. A feature view calls context-read after its protected query succeeds and the represented content is rendered; route entry alone never clears notifications.

**Rationale**: This aligns badges with content actually seen and prevents unauthorized or broken destinations from silently clearing unread state.

**Alternatives considered**:

- Mark read when the bell item is clicked: retained only for individual notification read; it cannot replace contextual clearing for direct links.
- Mark all notifications for a route: rejected because unrelated records would be cleared.

## Decision 9: Backfill and Bridge Legacy Stores

**Decision**: Additive migration backfills connection notifications and converts pending recruitment work to unified records. Old tables remain read-only for one release; no destructive drop occurs in Feature 016.

**Rationale**: Existing unread state and pending application events are preserved while rollback remains possible. Idempotency keys make the migration re-runnable.

**Alternatives considered**:

- Drop legacy tables immediately: rejected due to rollback and data-loss risk.
- Ignore old rows: rejected because users would lose unread connection and application updates.

## Decision 10: No New Email Template in Feature 016

**Decision**: Add no email template or new email event. Current event emails remain; application receipts, messages, and report receipts are in-app only.

**Rationale**: The requested model is “every notification email also in-app, but not every in-app notification by email.” Current critical account/security events already have email coverage. No uncovered critical off-app safety event was identified in the code inventory.

**Alternatives considered**:

- Email every new message/application/report: rejected because it increases email fatigue and exceeds the requested channel policy.

## Existing Event Inventory

| Source family | Existing email behavior | In-app decision |
|---|---|---|
| Registration/account email verification | Token/proof email | Exclude |
| Proposed-email verification | Token/proof email | Exclude |
| Old-address email-change alert | Existing security event email | Mirror safe alert |
| Password reset | Token/proof email | Exclude |
| Password changed | Existing event email | Mirror high severity |
| Recovery confirmation | Proof/action email | Exclude |
| Recovery pending/cancelled/completed | Existing event email variants | Mirror safe event variants |
| Company contact email verification | Token/proof email | Exclude |
| Account suspension/reinstatement/session revocation | Existing admin security email | Mirror critical/high |
| Membership suspension/restoration/removal | Existing admin security email | Mirror high |
| Application stage change | Existing preference-controlled email | Always in-app; preserve email preference |
| Recruiter verification lifecycle | Existing event emails | Mirror all seven outcomes |
| Support waiting/resolved | Existing event emails | Mirror both outcomes |
| Professional connection lifecycle | Existing email plus legacy in-app | Move visible record to unified inbox; preserve email |
| Application submitted/received | Existing recruitment work only | Convert to in-app only |
| New conversation message | Existing unread state/socket | Add grouped in-app only |
| Message report receipt/outcome | Existing report data/toast | Add safe in-app only |
| General moderation report receipt/outcome | Existing report data/toast/admin queue | Add safe in-app only |

## Recipient Rules

- Account/security: affected user account when it remains addressable.
- Candidate application update/receipt: application candidate user.
- Company application receipt: active memberships for the application company with `OWNER`, `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER`; collapse duplicate user identities.
- Verification: request applicant.
- Support: conversation requester.
- Connection: intended participants from the existing connection event.
- Message: the other active conversation participant, excluding sender.
- Messaging/general report: reporter only; administrators use their existing report queues rather than a private-evidence notification.
- Administrator account events: administrator receives the same account-level notification through their ordinary user identity when still authorized to authenticate.
