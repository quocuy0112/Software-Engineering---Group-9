# Implementation Plan: Realtime Messaging and Communication

**Branch**: `008-realtime-messaging` | **Date**: 2026-08-11 | **Spec**:
[spec.md](./spec.md)

**Input**: Approved Feature 008 specification at
`spec-kit/specs/008-realtime-messaging/spec.md`; fixed product scope: bounded
one-to-one professional text messaging inside the existing SmartHire
application.

## Summary

Feature 008 adds a responsive `/messages` workspace for direct Candidate and
Recruiter communication. Ordinary list, create, history, read, block, and report
operations remain explicit Next.js App Router Route Handlers over typed services
and Prisma repositories. Socket.IO 4.8.3 is attached to the same underlying HTTP
server as Next.js through a small custom-server entrypoint and supplies only the
realtime transport adapter for accepted messages, read changes, approximate
presence, and enforcement signals.

The existing Better Auth opaque HttpOnly cookie is the exclusive browser
credential for both HTTP and Socket.IO. Every handshake and protected event
revalidates the account/session and the conversation's professional-connection
or application/company context. PostgreSQL is authoritative for conversations,
participant read boundaries, messages, blocks, and messaging reports. Realtime
state is recoverable from REST reads after reconnect; presence alone remains
single-instance memory state.

No third-party chat application is copied into SmartHire. The MIT-licensed
official Socket.IO chat example and official Next.js integration guide are used
as implementation references only. SmartHire keeps its existing Next.js,
Tailwind/shadcn, Better Auth, Prisma, service/repository, audit, moderation, and
test boundaries.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`, React `19.2.3`

**Primary Dependencies**: Existing Next.js `16.3.0`, Better Auth `1.6.25`, Zod
`4.3.6`, Prisma and `@prisma/adapter-pg` `7.9.0`, PostgreSQL driver `8.16.3`,
TanStack Query `5.101.4`, Tailwind CSS `4.1.18`; add exact `socket.io` and
`socket.io-client` `4.8.3`; retain existing exact `tsx` `4.23.1` in production
`dependencies` because the production entrypoint executes `server.ts` directly

**Storage**: Existing PostgreSQL `16.12` for all durable messaging state;
process memory for approximate presence and connected-socket indexes only

**Testing**: Existing Vitest `4.1.10`, Testing Library `16.3.1`, Playwright
`1.57.0`, axe-core `4.12.1`; add Socket.IO client-driven gateway integration
tests, two-browser Playwright flows, barrier-synchronized persistence tests, and
a focused messaging performance harness

**Target Platform**: Existing self-hosted Linux Node.js process on port `3001`
behind the exact-host reverse proxy; responsive Candidate-origin web UI; one
application instance for the MVP

**Project Type**: Existing full-stack Next.js modular monolith with one custom
Node HTTP entrypoint that hosts both Next.js and the replaceable realtime
transport adapter

**Performance Goals**: Accepted online messages and connected read changes P95
`<=1s`; conversation list and 20-message history page P95 `<=2s`; `<1%` error
rate in the documented qualification window

**Constraints**: One-to-one plain text only; one `/chat` namespace; no second
browser credential, broker, Redis adapter, database, microservice, or horizontal
fan-out; server authorization on every protected read/write/event; durable
acceptance before broadcast; exact duplicate prevention; no sensitive browser
persistence; no unrestricted Administrator message reader

**Scale/Scope**: Representative qualification dataset of at least 100
conversations per participant and 10,000 messages, two active participants, up
to three tabs/devices per participant, and a single application instance; six
complete user stories delivered over the realistic multi-week allocation in
`tasks.md`

## Constitution Check

_Gate evaluated before research and re-checked after design._

| Gate                                                | Design evidence                                                                                                                                                                                                                   | Status |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Human-controlled recruitment                     | Messaging communicates between humans and performs no scoring, ranking, stage transition, or autonomous recruitment decision.                                                                                                     | Pass   |
| II. Security, privacy, tenant isolation             | Better Auth cookie remains exclusive; all HTTP and realtime operations are server-authorized; application conversations carry immutable company/application context; content is absent from ordinary logs and unauthorized views. | Pass   |
| III. Deterministic core and explainable AI          | Feature 008 introduces no AI; eligibility, order, unread state, block effects, duplicate handling, and presence projection are deterministic.                                                                                     | Pass   |
| IV. State, audit, data integrity                    | PostgreSQL owns all durable state; pair/context, message sequence, and client-operation constraints prevent duplicates; acceptance, conversation activity, and audit are transactional; reconnect reads authoritative data.       | Pass   |
| V. Scope discipline/P0 completeness                 | Release includes all six in-scope stories and excludes every named Post-MVP capability. Existing P0 authority is reused rather than duplicated, and delivery uses the realistic allocation in `tasks.md`.                         | Pass   |
| VI. Measurable quality/accessibility                | P95 targets, dataset, failure/race tests, keyboard flows, live announcements, responsive behavior, and axe requirements are explicit.                                                                                             | Pass   |
| VII. Maintainable/provider-independent architecture | Ordinary HTTP endpoints remain Route Handlers. The constitution's narrow realtime exception permits `/chat` on the same-process Node custom server; Socket.IO stays behind typed ports and contains no business persistence.      | Pass   |

No constitutional violation blocks planning. The custom server uses the narrow
realtime exception in Constitution 2.2.0: it delegates every ordinary HTTP
request to Next.js and contains no messaging business rule or persistence code.

## Architecture Overview

### Runtime topology

```text
Browser /messages (Candidate-origin workspace)
  |-- HTTPS REST /api/messaging/** -- Better Auth cookie + CSRF on mutations
  |                                  |
  |                                  v
  |                         Next.js Route Handlers
  |                                  |
  |-- WSS /chat namespace -----------+--> MessagingRequestBoundary
                                     |         |
Custom Node HTTP entrypoint ---------+         v
  |-- Next.js request handler             Messaging services
  `-- Socket.IO transport adapter              |
            |                                  v
            `-- in-memory presence       Prisma repositories --> PostgreSQL
                and socket indexes
```

`web/server.ts` becomes the development and production entrypoint. It creates
one Node HTTP server, gives ordinary HTTP handling to Next.js, and attaches one
Socket.IO server. The `/chat` upgrade endpoint is intentionally not a Next.js
Route Handler. WebSocket is a long-lived upgraded connection, while serverless
Route Handlers and edge runtimes may time out, recycle, or close the underlying
process and do not expose a stable HTTP upgrade lifecycle. A long-lived custom
Node server is therefore required as the entrypoint. This follows the official
Socket.IO/Next.js pattern and does not replace App Router Route Handlers for any
REST endpoint. Serverless and edge deployment targets are unsupported for this
feature.

The root and workspace `dev:web`/`start` scripts invoke the custom entrypoint;
`next build` remains the build command. Production runs
`node --conditions=react-server --import tsx server.ts`, and the already-correct
production `tsx` dependency is retained. This keeps one source entrypoint and is
consistent with existing production worker scripts that execute TypeScript;
the alternative of adding a separate server bundle was rejected because it
would require a second build graph and deployment artifact.

### Template decision

The project MUST NOT fork a complete chat template. The recommended free
reference is the official MIT-licensed
[`socketio/chat-example`](https://github.com/socketio/chat-example), paired with
the official
[`How to use with Next.js`](https://socket.io/how-to/use-with-nextjs) guide.
Only transport lifecycle, rooms, acknowledgements, and client connection
patterns may be adapted. Authentication, authorization, data contracts,
persistence, UI, error handling, and tests are implemented inside SmartHire's
existing boundaries.

This decision avoids importing an incompatible Express identity layer, a second
database, local-storage credentials, untyped payloads, global broadcast, or CSS
that bypasses the SmartHire design system. License attribution is recorded in
`research.md`; no copied source is expected for the planned implementation.

### Exclusive authentication and request boundary

The browser sends the existing first-party Better Auth cookie automatically on
the Socket.IO handshake. No `auth.token`, JWT minting endpoint, query credential,
localStorage/sessionStorage value, or second session table is permitted.

`MessagingRequestBoundary` accepts normalized request facts rather than a
provider token. For HTTP it uses the existing `requireSession(request.headers)`
and CSRF/origin checks. For Socket.IO it builds equivalent safe headers from the
handshake, validates exact configured origin/host, calls the same session
service, and stores only `userId` and `sessionId` in server-side socket data.
Every join, send, and other protected event revalidates session/account state
and conversation authority; handshake success alone is never authority for the
life of a socket.

An in-process `MessagingSocketRegistry` indexes `userId -> Set<socketId>`,
`sessionId -> Set<socketId>`, and `socketId -> { userId, sessionId,
conversationIds }`. Existing session/account/membership services, the Feature
011 connection provider, block services, and moderation suspension flow publish
a privacy-minimized invalidation only after their transaction commits. The
gateway looks up every affected socket, force-leaves the revoked conversation
rooms immediately, and emits `conversation:access_revoked` to that client. A
missed or racing signal still cannot disclose a message because each inbound
event, REST request, and intended outbound recipient is independently
revalidated.

### Conversation eligibility and tenant isolation

Conversation eligibility has two explicit adapters:

1. `APPLICATION`: the Candidate owns the immutable application; its job owns the
   company; the other participant has a current `ACTIVE` membership in that
   company with one of the approved recruiting roles. The conversation stores
   the application and company references and rechecks them on access.
2. `PROFESSIONAL_CONNECTION`: Feature 011 owns a canonical participant pair,
   bilateral consent, and `ACCEPTED`/`REVOKED` lifecycle. Feature 008 stores the
   stable connection reference, requires `ACCEPTED` for active communication,
   and permits `REVOKED` only for participant-owned archived history reads.

`MessagingEligibilityService.canMessage(userA, userB)` is the stable business
boundary used by create, join, send, and outbound delivery. Its providers check
the existing Application relationship and the Feature 011 accepted connection
contract. Unit tests cover connection only, application only, both, and neither.
Future Feature 011 expansion changes only the connection provider behind this
boundary.

Conversation uniqueness is `(lowerParticipantId, higherParticipantId,
contextType, contextReference)`, not one global pair. This allows the same people
to communicate in separate company/application contexts without tenant leakage.
The roadmap schedules the Feature 011 persistence/lifecycle dependency
immediately before Feature 008 schema work. It includes no networking feed,
invitation UI, recommendation, or connection-management surface.

### Durable message and read-state flow

The client sends `message:send` with conversation reference, normalized text,
and a random client operation reference. The server:

1. revalidates session, conversation membership/context, and both-direction
   block state;
2. transactionally reserves the next conversation-local sequence, inserts one
   immutable message under unique constraints, and updates conversation
   last-message fields;
3. returns the existing authoritative row for an exact retry;
4. acknowledges the sender only after commit; and
5. enumerates the remaining room members and re-runs
   `canMessage(senderId, memberId)` plus current account/session/context checks
   for each intended recipient; and
6. emits the committed projection only to recipients that pass this outbound
   check, including the sender's other authorized sockets.

Socket.IO guarantees ordering for events that arrive but defaults to at-most-once
arrival. The client therefore uses bounded acknowledgement retries and the
database constraint deduplicates retries. A browser refresh can discard an
unacknowledged local attempt, so the UI never labels it `Sent`; accepted history
is the only recovery authority.

Each `ConversationParticipant` stores `lastReadSequence` and `lastReadAt`.
Sequence is the exact monotonic boundary used for unread/read calculation;
`lastReadAt` preserves the requested timestamp projection. No per-message
receipt rows or mutable message status column are introduced. `Sent` and `Read`
are derived response fields.

### Realtime rooms, reconnect, and presence

One namespace `/chat` is used with WebSocket as the required low-level transport
for the MVP; polling is not treated as acceptance evidence. After handshake
authentication, the gateway queries every currently authorized conversation ID
for the user and joins all corresponding rooms. This lets a user who remains on
the conversation list receive `message:new` without opening a thread. The
explicit `conversation:join` event remains available when a thread opens; it
revalidates access and is idempotent when the socket already joined the room.
Initial lists/history always use HTTP. Reconnect repeats the full authorized-room
join and refetches the list/open conversation from the last stable cursor/read
boundary before normal realtime rendering resumes; transient events are never a
durable inbox.

Presence is a process-memory count of authorized sockets per account, with a
short disconnect grace period to reduce transport-upgrade/reconnect flicker.
Only accounts sharing a currently authorized conversation may receive the
coarse `ONLINE`/`OFFLINE` projection. No last-seen timestamp is stored. A single
tab closing decrements the count but does not set offline while another socket
remains.

### Block and report boundaries

`UserMessagingBlock` is directional (`blocker`, `blocked`) but its communication
effect is bidirectional across every context for that pair. Creating/removing a
block is idempotent. After commit, the gateway uses the socket registry to
force-leave both accounts' affected sockets, suppresses mutual presence, and
emits `conversation:access_revoked`. Connection deletion, membership removal,
account/session suspension, and report-driven moderation suspension use the
same enforcement path. Emit-time recipient revalidation closes the race between
the authoritative write and room removal. Existing history remains readable
when policy still permits it.

Feature 008 uses a separate `MessagingReport` record rather than extending the
Feature 006 `ModerationReport` enum and React Admin contracts. This prevents a
new target type from breaking the approved admin queue while no Administrator
messaging review workflow exists. It reuses allowlisted moderation categories,
rate-limiting, audit patterns, and a 24-hour unresolved dedupe key. A future
approved admin workflow may consume the protected reference; Feature 008 exposes
no general message-reading endpoint.

### HTTP and realtime contracts

REST contracts are documented in `contracts/openapi.yaml` under
`/api/messaging/**`. Realtime events and acknowledgements are documented in
`contracts/socket-events.md`. The Feature 011 ownership/lookup boundary
is frozen in `contracts/professional-connection-dependency.md`. Shared Zod
schemas and TypeScript event maps live under
`web/src/shared/contracts/messaging/`; both Route Handlers and Socket.IO parse
those schemas before calling services.

All REST responses use no-store handling, safe stable error codes, bounded
cursors, and projections that omit raw membership/application internals. All
mutating REST routes use the existing session-bound CSRF proof. Socket.IO
handshake origin and cookie validation replaces CSRF for the bidirectional
channel; every event is schema-validated and rate-limited where abuse is
material.

### User interface boundary

The `/messages` workspace is available on the Candidate origin to every normal
account. Because every account retains Candidate identity, a user with an active
Recruiter membership can exercise company-scoped messaging without adding a
general Recruiter Manager UI or changing the Feature 006 exact-host console.

The layout reuses SmartHire tokens, Tailwind/shadcn primitives, workspace
navigation, profile-safe avatars, and locale helpers. Desktop uses conversation
list plus active thread; mobile uses list/thread navigation with preserved
selection. Message history uses a load-older control with cursor pagination,
not DOM virtualization in the MVP. The composer is plain text only. Delivery,
read, approximate presence, blocked, reconnecting, empty, and failure states use
text and live regions rather than color alone.

### Verification strategy

- Contract tests keep OpenAPI, Zod, TypeScript socket event maps, and safe error
  envelopes aligned.
- Repository/integration tests cover pair/context uniqueness, message sequence,
  idempotent send, monotonic reads, list/history cursors, block races, report
  dedupe/quota, and multi-company authorization.
- Gateway tests use real Socket.IO server/client connections for handshake
  cookie/origin denial, auto-join of all authorized rooms, list-only realtime
  delivery, idempotent explicit join, ack retry, broadcast-after-commit,
  per-recipient emit-time revalidation, force-leave races, reconnect, multi-tab
  presence, and enforcement disconnect.
- Frontend tests cover list/thread/composer states, reconciliation, retry,
  mobile layout, keyboard operation, live announcements, and privacy canaries.
- Two-browser Playwright tests prove online/offline delivery, reload recovery,
  read state, block/unblock, report, membership loss, session revocation, and
  reconnect.
- A focused performance harness records environment, dataset, samples,
  duration, concurrency, P95, maximum, and error rate for SC-002 and SC-005.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/008-realtime-messaging/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- openapi.yaml
|   |-- professional-connection-dependency.md
|   `-- socket-events.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
web/
|-- server.ts
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/023_realtime_messaging/migration.sql
|-- src/
|   |-- app/
|   |   |-- (workspace)/messages/page.tsx
|   |   `-- api/messaging/
|   |       |-- eligible-participants/route.ts
|   |       |-- conversations/route.ts
|   |       |-- conversations/[conversationId]/messages/route.ts
|   |       |-- conversations/[conversationId]/read/route.ts
|   |       |-- blocks/[targetUserId]/route.ts
|   |       `-- reports/route.ts
|   |-- backend/
|   |   |-- messaging/
|   |   |   |-- authorization/
|   |   |   |-- realtime/
|   |   |   `-- services/
|   |   `-- repositories/messaging/
|   |-- frontend/features/messaging/
|   |   |-- client/
|   |   |-- components/
|   |   `-- styles/
|   `-- shared/contracts/messaging/
|-- scripts/measure-messaging-performance.mjs
`-- tests/
    |-- backend/{unit,integration,contract}/messaging/
    |-- frontend/{components,accessibility}/messaging/
    |-- architecture/realtime-messaging-boundaries.test.ts
    |-- performance/messaging/
    `-- system/e2e/messaging/
```

**Structure Decision**: Extend the existing `web` modular monolith. REST
transport remains in `src/app/api`, business behavior in
`src/backend/messaging`, data access in `src/backend/repositories/messaging`,
shared trust-boundary contracts in `src/shared/contracts/messaging`, and UI in
`src/frontend/features/messaging`. The root `server.ts` is transport composition
only.

## Post-Design Constitution Re-check

All gates remain **Pass**. The design rejects the proposed browser JWT because
Better Auth is exclusive, replaces the global user-role assumption with
company-scoped membership checks, scopes conversations to immutable eligibility
contexts, and treats PostgreSQL—not realtime delivery—as authority. Socket.IO
is an MIT-licensed replaceable adapter inside the existing process. The custom
server trade-off is documented and qualified without introducing another
service, store, broker, or credential.

## Roadmap and Delivery Gate

The deadline extension removes the former one-day constraint. Delivery follows
the realistic week/day allocation in `tasks.md`, beginning with the minimal
Feature 011 accepted-connection dependency and then Feature 008 in priority
order: US1, US2, US3, US5, US6, US4, followed by performance and accessibility
qualification. No task or acceptance gate is removed for schedule reasons.
Out-of-scope ideas go only to the `Post-MVP` backlog.

## Complexity Tracking

No constitutional violation requires justification.
