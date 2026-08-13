# Data Model: Realtime Messaging and Communication

## Model goals

- Preserve one-to-one participant identity without a global Recruiter role.
- Bind every conversation to an immutable authorization context.
- Make message order, cursor pagination, unread counts, and read state exact.
- Deduplicate retries and concurrent conversation creation in PostgreSQL.
- Keep presence ephemeral and keep report/message content out of audit logs.
- Reuse existing `UserAccount`, `JobApplication`, `JobPosting`, `Company`,
  `CompanyMembership`, `AuditEvent`, `RateLimitBucket`, and moderation category
  definitions.

## Existing authoritative entities

### UserAccount

Existing account/session owner. Feature 008 adds relations only; it does not add
a `role` column. Account `state`, `deletedAt`, and the Better Auth `Session`
records remain mandatory parts of every authority decision.

### JobApplication

Existing immutable Candidate-to-job relationship. For application messaging,
`candidateUserId` identifies the Candidate, while `jobPosting.companyId`
identifies the tenant in which Recruiter membership must be validated.

### CompanyMembership

Existing user-to-company authority. Messaging accepts only current `ACTIVE`
memberships with approved recruiting roles. `SUSPENDED` and `REMOVED` rows grant
no access.

### ProfessionalConnection (Feature 007 dependency)

The repository contains neither a Feature 007 specification nor a Connection
model at the start of this remediation. A minimal Feature 007 dependency slice
therefore precedes Feature 008 and owns this durable entity:

| Field                    | Type              | Rules                                                                                   |
| ------------------------ | ----------------- | --------------------------------------------------------------------------------------- |
| `id`                     | opaque string     | Stable primary key consumed by conversation context.                                    |
| `participantLowId`       | account reference | Lexicographically lower account ID.                                                     |
| `participantHighId`      | account reference | Lexicographically higher account ID; differs from low ID.                               |
| `state`                  | enum              | Minimal dependency exposes `ACCEPTED`; other lifecycle states remain Feature 007 scope. |
| `acceptedAt`             | timestamp         | Required when state is `ACCEPTED`.                                                      |
| `createdAt`, `updatedAt` | timestamp         | Server-maintained.                                                                      |

The canonical pair is unique. Feature 008 neither creates connection invitations
nor infers a connection from search/profile visibility; it consumes only the
stable ID and accepted lookup through `canMessage()`.

### MessagingEligibilityService boundary

`canMessage(userA, userB): boolean` is a formal business service boundary, not a
temporary stub. Its initial implementation returns true when at least one
currently valid provider authorizes the pair:

1. the existing Application provider confirms Candidate ownership plus current
   Recruiter membership in the application's company; or
2. the minimal Feature 007 provider confirms the canonical pair is `ACCEPTED`.

Block, account/session state, tenant context, and conversation membership are
composed with this relationship result by the calling authorization service.
Future Feature 007 work replaces only the professional-connection provider; the
`canMessage()` signature and all messaging callers remain unchanged. Unit tests
must cover accepted connection only, application only, both, and neither.

## New enums

### MessagingConversationContextType

| Value                     | Meaning                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `APPLICATION`             | Discussion is bound to one existing application and its owning company. |
| `PROFESSIONAL_CONNECTION` | Discussion is bound to one active reciprocal professional connection.   |

### MessagingReportTargetType

| Value          | Meaning                                                         |
| -------------- | --------------------------------------------------------------- |
| `PARTICIPANT`  | Report concerns the other participant in a shared conversation. |
| `CONVERSATION` | Report concerns communication in one shared conversation.       |

`MessagingReport` reuses the existing `ModerationReportCategory` values. Its MVP
state is `PENDING_REVIEW`; no Feature 008 transition to a terminal moderation
state exists.

## New durable entities

### MessagingConversation

Represents exactly two accounts communicating inside one immutable eligibility
context.

| Field                      | Type                            | Rules                                                                                                      |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                       | opaque string                   | Primary key.                                                                                               |
| `participantLowId`         | account reference               | Lexicographically lower account ID; participant cannot equal `participantHighId`.                          |
| `participantHighId`        | account reference               | Lexicographically higher account ID.                                                                       |
| `contextType`              | context enum                    | Immutable after creation.                                                                                  |
| `contextReference`         | opaque string                   | Stable application or professional-connection reference; immutable.                                        |
| `applicationId`            | application reference, nullable | Required only for `APPLICATION`; must equal `contextReference`.                                            |
| `companyId`                | company reference, nullable     | Required only for `APPLICATION`; derived from the application's job at creation and revalidated on access. |
| `professionalConnectionId` | connection reference, nullable  | Required only for `PROFESSIONAL_CONNECTION`; supplied by Feature 007.                                      |
| `nextMessageSequence`      | integer                         | Starts at 1; transactionally allocates a total conversation-local message order.                           |
| `lastMessageSequence`      | integer, nullable               | Null before the first message; updated in the same transaction as accepted send.                           |
| `lastMessageAt`            | timestamp, nullable             | Null before the first message; used with `id` for stable list ordering.                                    |
| `createdAt`                | timestamp                       | Server time.                                                                                               |
| `updatedAt`                | timestamp                       | Server-maintained metadata time.                                                                           |

**Constraints**:

- Unique `(participantLowId, participantHighId, contextType,
contextReference)` prevents duplicate direct conversations.
- Check `participantLowId < participantHighId` canonicalizes the pair and
  prevents self-chat.
- Context check requires exactly the reference set appropriate to `contextType`.
- Account deletes are restricted/soft-deleted so authorized retained history is
  not silently destroyed outside the data-deletion policy.

**Indexes**:

- `(participantLowId, lastMessageAt DESC, id)`
- `(participantHighId, lastMessageAt DESC, id)`
- `(applicationId)` and `(companyId)` for enforcement invalidation
- `(professionalConnectionId)` for connection invalidation

### MessagingConversationParticipant

Stores one read boundary for each of the two conversation participants.

| Field              | Type                   | Rules                                                                                                                  |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `conversationId`   | conversation reference | Composite primary key member.                                                                                          |
| `userId`           | account reference      | Composite primary key member; must match one canonical conversation participant.                                       |
| `lastReadSequence` | integer                | Starts at 0; monotonic and never greater than the conversation's committed last sequence.                              |
| `lastReadAt`       | timestamp, nullable    | Time the current boundary was accepted; retained for UI/audit projection, not used alone for exact unread calculation. |
| `createdAt`        | timestamp              | Server time.                                                                                                           |
| `updatedAt`        | timestamp              | Server-maintained.                                                                                                     |

**Constraints**:

- Primary key `(conversationId, userId)`.
- Exactly two participant rows are created transactionally with the
  conversation.
- A read update is `max(existingSequence, requestedAuthorizedSequence)`.
- Unread count is the number of messages with `sequence > lastReadSequence` and
  `senderId != userId`.

### MessagingMessage

Immutable plain-text message accepted by the server.

| Field               | Type                   | Rules                                                                     |
| ------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `id`                | opaque string          | Primary key.                                                              |
| `conversationId`    | conversation reference | Required.                                                                 |
| `sequence`          | integer                | Positive, conversation-local, immutable.                                  |
| `senderId`          | account reference      | Must be a current authorized participant at acceptance time.              |
| `clientOperationId` | UUID/string            | Unguessable client retry reference; never shown to the other participant. |
| `content`           | text                   | Normalized plain text, 1–2,000 Unicode characters.                        |
| `createdAt`         | timestamp              | Authoritative accepted time.                                              |

**Constraints**:

- Unique `(conversationId, sequence)` gives exact order and cursor position.
- Unique `(senderId, clientOperationId)` makes client retries idempotent.
- Messages have no persistent `status`, edit time, delete time, attachment, or
  rich-text document.
- `Sent` is derived from existence of this row. `Read` is derived when the other
  participant's `lastReadSequence >= sequence`.

**Indexes**:

- `(conversationId, sequence DESC)` for 20-message history pages.
- `(senderId, clientOperationId)` unique retry lookup.

### UserMessagingBlock

Directional safety choice with bidirectional communication effect.

| Field           | Type              | Rules                                                           |
| --------------- | ----------------- | --------------------------------------------------------------- |
| `blockerUserId` | account reference | Composite primary key member and only actor allowed to unblock. |
| `blockedUserId` | account reference | Composite primary key member; cannot equal blocker.             |
| `createdAt`     | timestamp         | Authoritative block time.                                       |

**Constraints and queries**:

- Primary key `(blockerUserId, blockedUserId)` makes block idempotent.
- Check blocker differs from blocked.
- Every access/send/presence query checks either direction:
  `(A blocks B) OR (B blocks A)`.
- Unblock deletes only the row owned by the current blocker; a reverse block, if
  present, continues to block the pair.

**Indexes**:

- `(blockedUserId, blockerUserId)` for reverse-direction checks.

### MessagingReport

Privacy-minimized report submission owned by Feature 008 and not exposed through
the current Administrator console.

| Field               | Type                         | Rules                                                                                          |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                | opaque string                | Primary key.                                                                                   |
| `reporterUserId`    | account reference            | Must be a participant in `conversationId`.                                                     |
| `targetUserId`      | account reference            | Must be the other participant.                                                                 |
| `conversationId`    | conversation reference       | Required shared context.                                                                       |
| `targetType`        | messaging report target enum | `PARTICIPANT` or `CONVERSATION`.                                                               |
| `evidenceMessageId` | message reference, nullable  | Optional selected message in the same conversation; stores a reference, not duplicate content. |
| `category`          | existing moderation category | Allowlisted.                                                                                   |
| `normalizedDetail`  | text, nullable               | 0–500 normalized characters; required minimum 10 for `OTHER`.                                  |
| `state`             | moderation state             | Created as `PENDING_REVIEW`; no Feature 008 terminal transition.                               |
| `unresolvedKey`     | digest/string                | Unique while the equivalent 24-hour report is unresolved.                                      |
| `createdAt`         | timestamp                    | Server time.                                                                                   |
| `updatedAt`         | timestamp                    | Server-maintained.                                                                             |

**Constraints**:

- Reporter, target, conversation, and optional evidence message are validated in
  one transaction.
- Equivalent reports within 24 hours return the existing neutral receipt.
- Message/report text is not copied into `AuditEvent.context`.
- Future report-specific administrators may dereference protected evidence only
  through a separately approved fresh-authorization workflow.

**Indexes**:

- `(reporterUserId, createdAt DESC)` for quota enforcement.
- `(conversationId, state, createdAt)` for future protected review.
- Unique `(unresolvedKey)`.

## Ephemeral state

### MessagingSocketRegistry and MessagingPresenceRegistry

Process-memory cache; not a Prisma table because socket identity and room
membership are valid only for the life of one application process. It is the
required mapping among `socketId`, `userId`, and `conversationId` for immediate
force-leave enforcement.

```text
userId    -> set(socketId)
sessionId -> set(socketId)
companyId -> set(socketId authorized through that company)
conversationId -> set(socketId)
socketId  -> { userId, sessionId, joinedConversationIds }
```

- Account is online when its socket set is non-empty after the disconnect grace
  period.
- Membership in these maps grants no business authority.
- Connect authentication queries all authorized conversation IDs, records them,
  and joins every corresponding room. Explicit thread joins are idempotent.
- After block, connection deletion, membership removal, session/account
  revocation, or report-driven suspension commits, the enforcement publisher
  resolves affected sockets, force-leaves each revoked room, updates both sides
  of the mapping, and emits `conversation:access_revoked` to that client.
- Before `message:new`, the publisher enumerates remaining room members and
  re-runs `canMessage(senderId, memberUserId)` plus current authority checks.
  Registry membership alone never authorizes outbound delivery.
- Process restart clears all maps; clients reconnect and rebuild safe state.
- No last-seen timestamp or presence event is written to PostgreSQL/audit.

## Transaction boundaries

### Create conversation

1. Validate session/account and eligibility relationship.
2. Canonicalize participant pair and immutable context.
3. Insert conversation plus exactly two participant rows in one transaction.
4. On unique conflict, load and return the existing authorized conversation.
5. Audit creation without private application/profile content.

### Send message

1. Revalidate current participant/context and both block directions.
2. Look up `(senderId, clientOperationId)`; an exact same request returns its
   authoritative message, while a mismatched replay is denied.
3. Atomically allocate `nextMessageSequence`, insert message, and update
   `lastMessageSequence`/`lastMessageAt`.
4. Commit before acknowledgement or realtime broadcast.
5. Enumerate each remaining room member and revalidate `canMessage(sender,
member)` plus current account/session/context access immediately before emit.
6. Emit `message:new` only to recipient sockets that pass step 5.

### Mark read

1. Revalidate participant/context and requested sequence visibility.
2. Update participant boundary only when requested sequence is greater.
3. Commit before emitting the derived read event.

### Block/unblock

1. Validate current active session/account and target pair.
2. Create/delete only the actor-owned directional block idempotently.
3. Append privacy-minimized audit in the same transaction where supported.
4. After commit, publish an in-process enforcement signal that uses the socket
   registry to force-leave affected rooms and emits
   `conversation:access_revoked`; persistence remains valid if realtime
   notification fails.

### Report

1. Validate current session, shared conversation, target/evidence relationship,
   category/detail, dedupe, and quota.
2. Insert one pending protected report and audit correlation transactionally.
3. Return a neutral receipt with no target state or moderation internals.

## Lifecycle projections

### Message UI lifecycle

```text
LOCAL_PENDING --ack after commit--> SENT --recipient read boundary--> READ
      |
      `--timeout/failure--> FAILED --explicit retry, same operation id--> SENT
```

`LOCAL_PENDING` and `FAILED` are client-only presentation states. They are never
inserted as authoritative `MessagingMessage` rows.

### Conversation availability

Conversation rows do not have an editable lifecycle status. Availability is a
projection of current account, session, context relationship, membership, and
block state:

```text
AUTHORIZED <-> BLOCKED
AUTHORIZED/BLOCKED -> CONTEXT_UNAVAILABLE
```

Pre-block history remains readable. Context-unavailable history follows the
least-privilege retention/deletion policy and neutral unavailable behavior; it
does not grant send or presence authority.

### Messaging report lifecycle

Feature 008 creates only:

```text
none -> PENDING_REVIEW
```

Resolution/dismissal and protected evidence review are post-MVP Administrator
capabilities.

## Retention and deletion

- Conversation/message/read data is retained indefinitely by default and
  survives logout, process restart, offline periods, and ordinary profile
  changes.
- Account deletion anonymizes the participant identity in messaging projections
  and displays `Deleted user`. Message content and sequence remain available to
  the other authorized participant; deleted profile name, avatar, email, and
  links are not retained in the projection.
- When an Administrator handling outcome is linked to a messaging report, the
  protected report and referenced evidence are retained for at least 90 days
  from the handling timestamp, even if either participant deletes an account.
  The hold does not restore public identity or broaden evidence access.
- No ordinary log, analytics record, URL, browser store, or audit context is a
  preservation mechanism.
- Presence is erased on disconnect/process restart and has no retention job.
- The socket registry is erased on disconnect/process restart and is never
  considered durable business state.
