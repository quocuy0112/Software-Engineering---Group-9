# Implementation Plan: Notification Deep-Link

**Branch**: `016-inapp-email-notification` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

## Summary

Replace creation-time notification hrefs with a server-side destination resolver invoked while the notification list is served. The resolver receives the notification identifier, persisted context, occurrence metadata, and the recipient's effective audience, and emits a transient safe href for every item. Destination routes remain the authorization authority and add a safe unavailable-content state only after authorization succeeds.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24, Next.js App Router, React 19, Prisma/PostgreSQL, Zod, Vitest.  
**Existing boundary**: route handler -> `NotificationService` -> notification repository; account session boundary owns browser authentication.  
**Testing**: Vitest unit/contract/integration, React component/accessibility tests.  
**Performance**: notification list retains P95 <= 2 seconds for 20 items; resolver uses bounded batched reads per context type.

## Constitution Check

| Gate | Status | Evidence |
|---|---|---|
| Security and tenant isolation | PASS | Resolver derives audience from server state; href is never authorization; destination re-checks scope. |
| State and integrity | PASS | Context remains durable source; no static href write; idempotent read and reconciliation preserved. |
| Accessibility and measurable quality | PASS | Explicit keyboard/focus/name tests and list latency budget. |
| Architecture boundaries | PASS | Route handlers remain transport-only; resolver/service/repository separation is retained. |

## Architecture

```text
GET /api/notifications
  -> account request boundary (authenticated actor)
  -> NotificationService.list(actor.userId)
  -> notification rows + effective audiences
  -> NotificationDestinationResolver.resolveBatch(rows, audiences, now)
  -> transient NotificationItem.href (context-specific or notification-inbox fallback)
  -> notification center: optimistic mark-read, non-blocking navigation

Destination route
  -> normal authentication + role/membership/scope policy
  -> authorized live-state check
  -> detail/list OR safe unavailable content OR neutral 404/403
```

## Data and state design

`InAppNotification.contextType`, `contextId`, `occurrenceCount`, and `lastOccurredAt` remain the source of truth. Add a durable `recipientRole`/audience value to the notification record, populated from the authoritative event recipient audience, so a user holding multiple global capabilities cannot change the meaning of an historical notification. Do not write `href` for new records; retain the nullable column for additive migration and legacy rows. The served contract still exposes `href`, but it is computed only.

Resolver input is `{ notificationId, kind, contextType, contextId, recipientRole, occurrenceCount, lastOccurredAt }`; it returns a safe URL. It has explicit rules for candidate, recruiter, and administrator. For `occurrenceCount > 1`, it produces a bounded, encoded list URL with `jobId`/context filter, status where known, and `since=lastOccurredAt`, never a detail URL. An absent or unsupported context resolves to `/notifications?notification=<notificationId>`.

## Resolution rules

- Security/account -> `/profile/security`.
- Recruiter job-post decision -> posting or editor/review depending on current decision; candidate has no job-post-management destination.
- Recruiter application received -> pipeline filtered by job and application; candidate application stage -> candidate application detail.
- Administrator moderation report -> protected report detail; report recipients without admin audience get a recipient-safe inbox view.
- Conversation -> exact conversation URL after participant membership is confirmed.
- Support -> support workspace filtered by case for non-administrators and protected `support-cases` detail for administrators; connections -> connections workspace filtered by connection/proposal; membership and invitation outcomes -> team workspace.
- A pending company invitation opens its token-free invitation landing page; acceptance remains available only from the email token.
- Messaging reports, moderation reports, and verification requests open their protected administrator screens for administrators and a recipient-safe workspace/inbox view otherwise.
- The administrative notification service uses the same resolver so its notification items retain their deep links.
- Contexts lacking a context-specific destination resolve to the notification inbox fallback.

## Staleness and authorization

The resolver observes current resource state each list read. It returns null when no safe destination remains; it never asserts that access is authorized. The final page independently performs authorization. After authorization succeeds, archived/hidden/resolved resources return an explicit safe `content-unavailable` destination model/view. Membership/scope failure returns the existing neutral 404/403 envelope and no state-specific text. This distinction applies at every affected application, job post, report, and conversation reader.

## Frontend interaction

Notification rows use a semantic button for item activation and a nested/separate Mark as read button without propagation. A View details control exists only with href. Enter/Space use native button behavior; CSS provides `:focus-visible`. Activation applies optimistic read state, starts the ID-based mark-read request, then calls navigation immediately unless the current pathname/query already represents the href. Failed reads leave a reconciliation flag; subsequent polling/fetch replaces local unread count with the response's server count. If an unsaved-change guard is active, internal links and notification activation are deferred to one accessible SmartHire dialog mounted in the workspace shell; refresh, tab closing, and browser-controlled exits retain `beforeunload` because browsers do not permit a reliable custom replacement.

## Project Structure

```text
web/src/backend/notifications/{event-policy.ts,notification-destination-resolver.ts,notification-service.ts}
web/src/backend/repositories/notifications/prisma-notification-repository.ts
web/src/shared/contracts/notifications/index.ts
web/src/app/api/notifications/route.ts
web/src/frontend/features/notifications/{components/notification-center.tsx,client/use-notifications.ts,styles/notifications.css}
web/tests/{backend/unit/notifications,backend/contract/notifications,backend/integration/notifications,frontend/components/notifications,frontend/accessibility/notifications}
```

## Migration and rollout

Use one additive Prisma migration to introduce `recipientRole` and preserve nullable `href`. Backfill role from existing `variables.audience` when reliable and default ordinary legacy rows to `USER`; legacy null href items remain mark-read-only. Stop assigning `href` in `buildNotification`; the API resolver ignores stored href for all rows. Rollback can continue serving legacy rows with null href without corrupting notification state.

## Validation

Run contract tests for all kinds and intentional nulls, audience matrix tests, current-state/staleness and grouped-url tests, destination authorization tests, component resilience tests, accessibility tests, then the relevant notification and frontend suites.
