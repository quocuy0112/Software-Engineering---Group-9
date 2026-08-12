# Socket Contract: `/chat` Namespace

## Transport boundary

- Same HTTP server and exact origin as SmartHire.
- Namespace: `/chat`.
- Authentication: existing Better Auth HttpOnly cookie in the browser handshake;
  no token field, query credential, or second browser session.
- Every client payload is strictly schema-validated before a service call.
- Every protected event revalidates current session/account and domain authority.
- Rooms are transport projections only and never grant data access.

## Common error acknowledgement

```json
{
  "ok": false,
  "error": {
    "code": "CONVERSATION_UNAVAILABLE",
    "message": "This conversation is unavailable.",
    "retryable": false,
    "retryAfterSeconds": null
  }
}
```

Allowlisted error codes:

| Code                       | Meaning                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `AUTH_REQUIRED`            | Exclusive SmartHire session is absent or invalid.                                             |
| `AUTHORITY_CHANGED`        | Account/session/membership/relationship changed; client must purge protected messaging state. |
| `CONVERSATION_UNAVAILABLE` | Neutral not-found/not-participant/context denial.                                             |
| `BLOCKED`                  | Pair cannot communicate; response does not disclose block initiator.                          |
| `VALIDATION_ERROR`         | Payload or text is invalid.                                                                   |
| `RATE_LIMITED`             | Event admission limit exceeded; safe retry time may be returned.                              |
| `CONFLICT`                 | Authoritative state changed; client must refetch.                                             |
| `PERSISTENCE_UNAVAILABLE`  | No message/read update committed; explicit retry may be offered.                              |

Unknown errors use `PERSISTENCE_UNAVAILABLE` or a generic unavailable response;
stack traces, SQL/provider errors, user existence, membership internals, and
message/report content are never returned.

## Client → Server events

### `conversation:join`

Join the transport room only after current authorization. The operation is
idempotent: opening a thread after connect succeeds even when the socket already
auto-joined that room.

Payload:

```json
{ "conversationId": "opaque-conversation-reference" }
```

Success acknowledgement:

```json
{
  "ok": true,
  "data": {
    "conversationId": "opaque-conversation-reference",
    "otherParticipantPresence": "ONLINE"
  }
}
```

`otherParticipantPresence` is `ONLINE` or `OFFLINE`, is approximate, and is
included only when presence disclosure is currently authorized.

### `conversation:leave`

Payload:

```json
{ "conversationId": "opaque-conversation-reference" }
```

Success acknowledgement:

```json
{ "ok": true, "data": { "conversationId": "opaque-conversation-reference" } }
```

Leaving a room never changes durable conversation/read state.

### `message:send`

Payload:

```json
{
  "conversationId": "opaque-conversation-reference",
  "clientOperationId": "7f3352d1-4acc-4ee3-a22e-cdeef9701a56",
  "content": "Hello, can we discuss the application?"
}
```

Rules:

- `clientOperationId` is required and scoped to the authenticated sender.
- `content` normalizes to 1–2,000 Unicode characters of plain text.
- Server persists before acknowledgement and broadcast.
- Exact retry returns the existing message; a reused operation ID with different
  content/conversation is denied.

Success acknowledgement:

```json
{
  "ok": true,
  "data": {
    "message": {
      "id": "opaque-message-reference",
      "conversationId": "opaque-conversation-reference",
      "sequence": 42,
      "senderId": "opaque-account-reference",
      "content": "Hello, can we discuss the application?",
      "createdAt": "2026-08-11T10:00:00.000Z",
      "delivery": "SENT"
    },
    "deduplicated": false
  }
}
```

## Server → Client events

### `message:new`

Emitted after commit to connected authorized sockets in the conversation room,
including the sender's other tabs. Immediately before each socket delivery, the
publisher resolves that socket's user and re-runs `canMessage(sender, member)`
plus current account/session/context checks. A socket that remained in the room
during a concurrent block or revoke receives no message content.

```json
{
  "message": {
    "id": "opaque-message-reference",
    "conversationId": "opaque-conversation-reference",
    "sequence": 42,
    "senderId": "opaque-account-reference",
    "content": "Hello, can we discuss the application?",
    "createdAt": "2026-08-11T10:00:00.000Z",
    "delivery": "SENT"
  }
}
```

The receiver deduplicates by message ID/sequence and refetches authoritative
history after reconnect. The event is not an offline queue.

### `message:read`

Emitted only after the REST read-boundary mutation commits.

```json
{
  "conversationId": "opaque-conversation-reference",
  "readerId": "opaque-account-reference",
  "lastReadSequence": 42,
  "readAt": "2026-08-11T10:00:02.000Z"
}
```

Clients apply only boundaries greater than their current projection.

### `presence:changed`

```json
{
  "userId": "opaque-account-reference",
  "presence": "OFFLINE"
}
```

Emitted only to currently authorized participants after account-level
multi-socket counting and disconnect grace. It never includes last-seen time.

### `conversation:access_revoked`

```json
{
  "conversationId": "opaque-conversation-reference",
  "code": "AUTHORITY_CHANGED"
}
```

Sent for block and every other access revocation to an affected client after the
server force-leaves that socket from the conversation room. The client disables
the composer, suppresses mutual presence, purges that conversation's protected
cache, and refetches authoritative state. The event contains no company,
application, membership, block actor, or target details. A full session or
account revoke may additionally disconnect the namespace socket after all
affected conversation notifications are emitted.

## Internal server-only enforcement event

### `internal:conversation-access-revoked`

This is an in-process service/publisher contract. It is not registered in the
client-to-server or server-to-client Socket.IO event maps and clients cannot emit
or subscribe to it.

```text
Input after authoritative transaction commit:
  { affectedUserIds, affectedConversationIds, cause, correlationId }

Flow:
  block / connection deletion / membership removal / session or account revoke /
  report-driven suspension
    -> lookup userId -> Set<socketId> in MessagingSocketRegistry
    -> intersect each socket's joinedConversationIds with affectedConversationIds
    -> socket.leave(conversationRoomId) immediately
    -> remove socketId <-> conversationId mapping on both indexes
    -> emit conversation:access_revoked to that socket
    -> disconnect only when the whole session/account is no longer valid
```

`cause` is for server-side safe audit/metrics only and MUST NOT be included in
the client payload. Delivery failure does not roll back the authoritative block
or revoke. Emit-time authorization on every protected outbound event is the
required race-condition backstop.

## Connection lifecycle

1. Client connects with credentials included implicitly by same-origin browser
   behavior.
2. Namespace middleware validates exact origin/host and the Better Auth session.
3. Gateway registers `{socketId, userId, sessionId}` and joins the private
   account room.
4. Gateway queries the database for every conversation ID currently authorized
   for the user, joins all corresponding rooms, and records the bidirectional
   `socketId <-> conversationId` mapping before connection readiness is exposed.
5. Client refetches the conversation list and current thread. Opening a thread
   may emit `conversation:join`; the server revalidates it and treats an existing
   room membership as a successful idempotent join.
6. Each join/send revalidates current authority, and every protected outbound
   emit revalidates its intended recipient.
7. On temporary disconnect, client shows reconnecting and does not claim pending
   messages are sent.
8. On reconnect, the server repeats full authorized-room auto-join; the client
   refetches authoritative REST state and resumes event handling.
9. On block/revocation/authority change, the server force-leaves affected rooms
   through the registry and emits `conversation:access_revoked`; the client
   purges affected messaging state. Full session/account invalidation also
   unregisters and disconnects the socket.

An online user who remains on the conversation list therefore receives
`message:new` for every authorized conversation without opening its thread.

## Retry configuration intent

The client uses Socket.IO's bounded `retries` and `ackTimeout` for
`message:send`. Exact numeric values are environment configuration covered by
tests; the retry window must stay short enough for visible failure feedback and
must not exceed the message admission limit. Database idempotency is mandatory
because acknowledgement retry provides at-least-once attempts, not exactly-once
execution.
