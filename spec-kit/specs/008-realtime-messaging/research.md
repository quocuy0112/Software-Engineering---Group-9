# Phase 0 Research: Realtime Messaging and Communication

## Decision 1: Use an official reference, not a full chat template

**Decision**: Use the official MIT-licensed Socket.IO
[`chat-example`](https://github.com/socketio/chat-example) only as a learning
reference for event/room/acknowledgement mechanics. Use the official
[`How to use with Next.js`](https://socket.io/how-to/use-with-nextjs) guide as
the runtime integration reference. Do not fork or copy a complete third-party
chat application.

**Rationale**: The official example is intentionally a basic HTML/Node demo. It
does not supply SmartHire's Better Auth session boundary, Prisma/PostgreSQL
models, company-scoped authorization, validation, privacy, accessible React UI,
or test structure. A full template would bring more incompatible architecture
than reusable value. Socket.IO itself and the example are MIT licensed, so the
reference is free and does not impose a conflicting copyleft obligation.

**Alternatives considered**:

- Fork a community Next.js chat starter: rejected because current compatibility,
  license quality, auth/storage assumptions, and maintenance are less reliable
  than the official sources.
- Build on the plain official example as a separate app: rejected because it
  would create a second service/UI/auth boundary and violate the modular
  monolith constraint.
- Raw WebSocket (`ws`): rejected because rooms, acknowledgements, reconnection,
  and typed event integration would require custom transport work with no
  product benefit over the selected library.

## Decision 2: Attach Socket.IO to one custom Next.js HTTP server

**Decision**: Add a minimal `web/server.ts` entrypoint that creates one
long-lived Node HTTP server, delegates ordinary requests to Next.js, and attaches
Socket.IO 4.8.3. The `/chat` WebSocket upgrade endpoint uses the constitution's
narrow realtime exception and does not pass through a Next.js Route Handler.
Every REST endpoint remains an App Router Route Handler and every business rule
remains outside the custom server.

**Rationale**: WebSocket uses a long-lived upgraded TCP connection. Serverless
Route Handlers and edge runtimes may time out, recycle, or close the process and
do not provide the stable HTTP upgrade lifecycle required by Socket.IO. The
official Socket.IO Next.js guide supports sharing the same underlying HTTP
server with the App Router. SmartHire already targets a self-hosted long-lived
Linux Node process, so a custom server satisfies both the connection lifecycle
and the single-process constraint.

The official Next.js
[`Custom Server`](https://nextjs.org/docs/app/guides/custom-server) guide warns
that custom servers remove some automatic optimizations and are incompatible
with standalone output. The repository does not configure standalone output,
and its principal authenticated pages are dynamic. This trade-off is accepted
and must be covered by the existing page performance checks plus Feature 008
qualification.

**Alternatives considered**:

| Option                            | Result                                           | Reason                                                                                                                             |
| --------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Next.js API/Route Handler         | Rejected for `/chat`; retained for all REST APIs | It does not own a reliable long-lived upgrade lifecycle on serverless/edge runtimes.                                               |
| Same-process Node custom server   | Selected                                         | It shares one HTTP server/process with Next.js, supports WebSocket upgrades, and preserves existing service/repository boundaries. |
| External realtime service/process | Rejected                                         | It would add deployment, credentials, disclosure, failure, and synchronization boundaries without a current scaling requirement.   |

The custom server removes some Next.js automatic optimizations and cannot use
standalone output. These constraints are accepted and verified by production
build/start and page-performance tests.

## Decision 2A: Execute the TypeScript server entrypoint with production `tsx`

**Decision**: Keep `web/server.ts` as the production entrypoint, run it with
`node --conditions=react-server --import tsx server.ts`, and retain the existing
exact `tsx` `4.23.1` production dependency.

**Rationale**: SmartHire already runs production workers through the same `tsx`
loader, and `web/package.json` already declares it under `dependencies`. Keeping
one TypeScript entrypoint avoids a second bundler/configuration path and
guarantees the loader is installed when production dependencies only are
deployed.

**Alternatives considered**:

- Compile `server.ts` to `server.js` with a separate `tsc`/esbuild target:
  rejected because it adds another build artifact and module-resolution path
  that must remain synchronized with Next.js.
- Leave `tsx` in `devDependencies`: rejected because production-only installs
  would fail to start the application.

## Decision 3: Preserve Better Auth cookie authentication

**Decision**: Authenticate the Socket.IO handshake using the same first-party
cookie headers already validated by `requireSession`; do not use
`auth: { token }`, mint a JWT, or persist any socket credential in browser
storage. Revalidate the session and domain authority on each protected event.

**Rationale**: Better Auth documents server-side session resolution from request
headers and uses HttpOnly cookies. SmartHire's constitution permits exactly one
server-controlled browser-session mechanism, and the current implementation is
opaque/database-backed. A handshake JWT would be a second credential lifecycle
and would weaken revocation behavior.

References:

- [Better Auth basic usage: server-side session](https://better-auth.com/docs/basic-usage)
- [Better Auth cookies](https://better-auth.com/docs/concepts/cookies)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)

**Alternatives considered**:

- Short-lived browser JWT for Socket.IO: rejected as a second browser
  credential/session mechanism.
- User ID in handshake payload: rejected because client identity is untrusted.
- Handshake-only validation: rejected because session/account/membership/block
  authority can change while a socket remains connected.

## Decision 4: Use acknowledgement retry plus database idempotency

**Decision**: Configure bounded client-to-server acknowledgement retries for
`message:send`, require a random client operation reference, persist before ack,
and enforce a unique sender/operation constraint. Reconcile server-to-client
gaps through authoritative REST list/history reads after reconnect.

**Rationale**: Socket.IO's
[`Delivery guarantees`](https://socket.io/docs/v4/delivery-guarantees) page
states that ordering is guaranteed for events that arrive, but arrival defaults
to at-most-once. It recommends acknowledgement retries for client-to-server
at-least-once behavior and notes that pending events are still lost on browser
refresh. Database idempotency prevents duplicate rows, while the UI truthfully
distinguishes an unacknowledged local attempt from an accepted message.

**Alternatives considered**:

- Trust automatic reconnect alone: rejected because reconnect does not prove an
  in-flight message reached the server.
- Persist pending messages in localStorage: rejected because browser-persistent
  messaging state increases privacy risk and is unnecessary for the MVP.
- Add Kafka/RabbitMQ: rejected because a single database transaction plus one
  application instance satisfies the target and a broker is explicitly out of
  scope.

## Decision 5: Use conversation-local sequence boundaries

**Decision**: Keep `lastReadAt` for the requested timestamp projection, but use
an exact monotonic `lastReadSequence` against immutable conversation-local
message sequence numbers for unread counts, stable history cursors, and derived
read state. Do not store one receipt/status row per message.

**Rationale**: Timestamp-only boundaries can be ambiguous when messages and read
updates share timestamp precision. A conversation-local integer sequence makes
ordering and monotonic updates deterministic, remains much simpler than
per-message receipts, and supports exact cursor pagination and unread counts.

**Alternatives considered**:

- `lastReadAt` only: rejected because equal-time boundary behavior is harder to
  prove under concurrent tests.
- Mutable `Message.status`: rejected because read state belongs to the recipient
  boundary and would require bulk per-message updates.
- Per-message receipt table: rejected as unnecessary for one-to-one MVP scope.

## Decision 6: Keep approximate presence memory-only

**Decision**: Count authenticated sockets per account in process memory, apply a
short disconnect grace period, and disclose only coarse online/offline state to
currently authorized conversation participants. Do not persist `lastSeen` and
do not add Redis.

**Rationale**: The MVP is explicitly single-instance and does not require exact
presence. Multiple-tab counting prevents one disconnect from incorrectly making
the user offline. Memory loss after process restart safely degrades everyone to
offline until reconnect and does not affect durable messages.

**Alternatives considered**:

- Database presence heartbeat: rejected as needless write load and misleading
  precision.
- Redis adapter/presence store: rejected because horizontal scale is outside the
  MVP.
- Browser-reported presence: rejected because it is untrusted and leaks more
  activity metadata.

## Decision 7: Scope conversations by immutable eligibility context

**Decision**: Uniqueness includes participant pair plus either an application
reference/company reference or a professional-connection reference. Application
access always rechecks Candidate ownership and current Recruiter company
membership. Because the repository contains no Feature 007 specification or
Connection model, schedule a minimal Feature 007 dependency slice immediately
before Feature 008: canonical participant pair plus `ACCEPTED` state and lookup.
Feature 008 consumes both eligibility sources through
`MessagingEligibilityService.canMessage(userA, userB)`.

The frozen minimum is documented in
`contracts/professional-connection-dependency.md` so Feature 007 can expand
without changing messaging callers.

**Rationale**: A single global pair conversation would allow authority gained
through one company to expose discussion associated with another company. The
context-scoped design satisfies tenant isolation and makes list summaries and
entry points understandable.

**Alternatives considered**:

- One global conversation per pair: rejected for cross-company leakage risk.
- One conversation per message topic: rejected as excessive user and data-model
  complexity.
- Unrestricted messaging after profile search: rejected because it enables
  enumeration and spam and contradicts the approved relationship rules.

## Decision 8: Store messaging reports separately from Feature 006 moderation

**Decision**: Add `MessagingReport` with reused category, rate-limit, audit, and
dedupe patterns. Do not extend the existing `ModerationTargetType` or Admin
React contracts until a separately approved privileged review workflow exists.

**Rationale**: Feature 006 uses exhaustive allowlists for job/company/membership/
Candidate report projections. Adding a conversation target without its protected
review contract could break the admin queue or accidentally expose content.
Feature 008 only promises safe submission and persistence.

**Alternatives considered**:

- Extend `ModerationReport` immediately: rejected because it implies admin list/
  detail behavior that is expressly outside Feature 008.
- Store report text in ordinary audit context: rejected because audit logs must
  not contain report or message content.
- Omit reports if time expires: rejected because report safety is part of the
  approved MVP, not optional polish.

## Decision 9: Reuse the Candidate-origin workspace

**Decision**: Put `/messages` on the normal Candidate origin and derive any
Recruiter company authority from active memberships. Reuse existing workspace
navigation, tokens, responsive styles, locale support, and accessible UI
primitives.

**Rationale**: Every normal SmartHire account retains a Candidate identity. This
avoids adding a general Recruiter Manager surface that Feature 006 explicitly
excluded, while still allowing an account with active membership to act in the
correct company context.

**Alternatives considered**:

- New recruiter-origin chat application: rejected because it would duplicate
  exact-host routing, session bootstrap, and navigation without product value.
- Floating site-wide chat widget: rejected for MVP because it complicates focus,
  mobile layout, route lifecycle, and privacy; a dedicated workspace is simpler
  and testable.

## Decision 10: Require WebSocket transport for the MVP

**Decision**: Configure the `/chat` namespace client to use WebSocket as its
low-level transport for acceptance testing. Socket.IO remains the event,
acknowledgement, room, and reconnect layer; HTTP polling is not counted as proof
that the requested WebSocket capability works.

**Rationale**: The approved scope explicitly requires WebSocket communication,
the deployment is a long-lived self-hosted Node process, and the existing CSP
already permits `ws:`/`wss:` connections. A direct transport setting also makes
the demo and network inspection unambiguous.

**Alternatives considered**:

- Default polling then upgrade: viable Socket.IO behavior but rejected as the
  Feature 008 acceptance baseline because a successful polling session could
  conceal a broken WebSocket proxy/upgrade path.
- Polling fallback after WebSocket failure: deferred; REST history remains the
  durable recovery path and the UI must show realtime unavailable.
