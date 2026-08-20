# Notification destination contract

**Superseding rule (2026-08-20):** `href` is a server-resolved transient safe URL for every notification item. An absent or unsupported context resolves to `/notifications?notification=<notificationId>`; stored href values and browser-constructed URLs are never trusted.

`GET /api/notifications` returns the existing `NotificationItem` shape. Clients consume the served `href` and must not construct URLs from kind or context.

`PATCH /api/notifications/:notificationId/read` stays idempotent. Item activation must not await this mutation before using the served `href`.

Destination readers return their normal representation, a safe unavailable-content representation only after successful authorization, or a neutral 403/404 for authorization failure.
