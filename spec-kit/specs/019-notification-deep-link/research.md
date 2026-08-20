# Research: Notification Deep-Link

## Decision: Resolve destinations on notification retrieval

**Rationale:** Context rows are durable and current state can change; resolving in `NotificationService.list` prevents stale storage from becoming UI truth.

**Alternatives considered:** writing href at event creation (rejected: stale and audience-blind); resolving entirely in the browser (rejected: exposes policy and duplicates server decisions).

## Decision: Persist recipient audience, not client-supplied role

**Rationale:** The historical recipient audience is part of the event meaning while effective authorization is checked fresh on both resolution and destination access.

**Alternatives considered:** infer global role on every click (rejected: ambiguous for multi-role accounts); trust browser role (rejected: security boundary violation).

## Decision: Use the notification inbox as the universal safe fallback

**Rationale:** Every notification remains actionable without inventing a resource URL. The fallback identifies only the recipient's own notification, and authorization remains enforced at every context-specific destination.

## Decision: Separate stale availability from authorization loss after authorization

**Rationale:** It gives authorized users helpful feedback while maintaining neutral denial for out-of-scope users.
