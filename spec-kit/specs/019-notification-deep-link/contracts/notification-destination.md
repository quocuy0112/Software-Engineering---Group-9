# Notification destination contract

`GET /api/notifications` returns the existing `NotificationItem` shape. `href` is a server-resolved transient value. `null` means “mark read only”. Clients must not construct URLs from kind or context.

`PATCH /api/notifications/:notificationId/read` stays idempotent. Item activation must not await this mutation before using non-null `href`.

Destination readers return their normal representation, a safe unavailable-content representation only after successful authorization, or a neutral 403/404 for authorization failure.
