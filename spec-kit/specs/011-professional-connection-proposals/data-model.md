# Data Model: Professional Connection Proposals

## Canonical Pair Rule

For two distinct account IDs, `participantLowId` is the lexicographically lower ID and `participantHighId` is the higher ID. Every proposal, connection, cooldown query, block query, and pair digest uses this ordering. A database check constraint rejects equal or reversed pairs.

## Enums

### ProfessionalConnectionProposalState

- `PENDING_BOTH`
- `PARTIALLY_ACCEPTED`
- `ACCEPTED`
- `DECLINED`
- `EXPIRED`
- `CANCELLED`

### ProfessionalConnectionDecisionKind

- `ACCEPTED`
- `DECLINED`

### ProfessionalConnectionStatus

- `ACCEPTED`
- `REVOKED`

### ProfessionalConnectionNotificationKind

- `PROPOSAL_CREATED`
- `PROPOSAL_UPDATED`
- `PROPOSAL_NO_LONGER_ACTIVE`
- `CONNECTION_ACCEPTED`
- `CONNECTION_REVOKED`

### MessagingConversationArchiveReason

- `PROFESSIONAL_CONNECTION_REVOKED`

## ProfessionalConnectionProposal

| Field                                   | Rule                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`                                    | Opaque primary reference.                                                                           |
| `participantLowId`, `participantHighId` | Nullable only after protected retention scrubbing; ACTIVE accounts and canonical order at creation. |
| `participantPairDigest`                 | Keyed digest of the canonical pair plus policy version; retained as the non-identifying tombstone.  |
| `createdByAdminUserId`                  | Platform Administrator actor; nullable after protected scrubbing.                                   |
| `sourceSupportConversationId`           | Optional Feature 006 reference; no copied case content.                                             |
| `reason`                                | Normalized participant-visible text, 10–500 characters; nullable after deletion.                    |
| `state`                                 | Proposal state machine.                                                                             |
| `expiresAt`                             | Creation plus 1–30 whole days; seven days by default.                                               |
| `version`                               | Starts at 1 and increments on every authoritative state/decision change.                            |
| `terminalAt`                            | Set once when entering any terminal state.                                                          |
| `ordinaryDetailHiddenAt`                | `terminalAt + 90 days`.                                                                             |
| `protectedDeleteAfter`                  | `terminalAt + 365 days`.                                                                            |
| `protectedDeletedAt`                    | Physical sensitive-data scrub completion.                                                           |
| `createdAt`, `updatedAt`                | Lifecycle timestamps.                                                                               |

**Indexes and constraints**:

- Check canonical non-equal participants while references are present.
- Partial unique `(participantLowId, participantHighId)` where state is `PENDING_BOTH` or `PARTIALLY_ACCEPTED`.
- Index each participant with state/expiry for owned lists and quota counts.
- Index creator with creation time for rolling administrator quota.
- Index canonical pair with terminal time/state for cooldown.
- Index `expiresAt` for active-state worker claims.
- Index `protectedDeleteAfter` where `protectedDeletedAt IS NULL`.

## ProfessionalConnectionDecision

| Field                             | Rule                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `proposalId`, `participantUserId` | Composite primary key; participant must belong to proposal.  |
| `decision`                        | Current authoritative decision.                              |
| `decidedAt`                       | Last accepted command time.                                  |
| `version`                         | Increments only for allowed accepted-to-declined withdrawal. |

The row is deleted at protected retention. Immutable decision transitions remain in proposal history until that history is scrubbed.

## ProfessionalConnectionProposalHistory

| Field                                              | Rule                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `id`, `proposalId`                                 | Immutable transition row.                                        |
| `actorUserId`                                      | Admin/participant/system actor; nullable during retention scrub. |
| `action`                                           | Allowlisted transition code.                                     |
| `priorState`, `resultingState`, `resultingVersion` | Deterministic lifecycle facts.                                   |
| `decisionKind`                                     | Present only for decision transitions; scrubbed at 365 days.     |
| `occurredAt`, `correlationId`                      | Time and operation correlation.                                  |

Reason text, email, support content, and private messages are forbidden.

## ProfessionalConnection

| Field                                   | Rule                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| `id`                                    | New ID for each consent period.                                  |
| `participantLowId`, `participantHighId` | Canonical non-equal accounts.                                    |
| `state`                                 | `ACCEPTED` or `REVOKED`.                                         |
| `sourceProposalId`                      | Unique Feature 011 proposal; null only for legacy accepted rows. |
| `acceptedAt`                            | Bilateral acceptance time.                                       |
| `revokedAt`, `revokedByUserId`          | Both set together only when either participant disconnects.      |
| `version`                               | Optimistic concurrency version.                                  |
| `createdAt`, `updatedAt`                | Lifecycle timestamps.                                            |

**Constraints**:

- Partial unique canonical pair where state is `ACCEPTED`.
- Unique non-null `sourceProposalId`.
- Revocation fields match `REVOKED` state.
- Disconnect actor is one of the two participants.

## ProfessionalConnectionNotification

| Field                        | Rule                                               |
| ---------------------------- | -------------------------------------------------- |
| `id`, `recipientUserId`      | Recipient-owned in-app item.                       |
| `proposalId`, `connectionId` | At least one context reference.                    |
| `kind`                       | Approved recipient-safe template kind.             |
| `deduplicationKey`           | Unique per recipient and lifecycle event.          |
| `readAt`, `createdAt`        | Inbox state.                                       |
| `deleteAfter`                | Hard deadline no later than `createdAt + 90 days`. |

No rendered reason, email, decision attribution, or support content is stored in notification metadata. Proposal detail is fetched separately under authorization while available. Exact read-time filtering hides expired notification rows before the bounded worker deletes them.

## EmailOutbox Extension

Add nullable `professionalConnectionProposalId` and `professionalConnectionId` references for reconciliation. Templates receive only recipient-safe template kind, public recipient display name, expiry, and deep-link reference. Provider metadata remains content-minimized.

## MessagingConversation Extension

| Field           | Rule                                                  |
| --------------- | ----------------------------------------------------- |
| `archivedAt`    | Set when a linked professional connection is revoked. |
| `archiveReason` | `PROFESSIONAL_CONNECTION_REVOKED` for Feature 011.    |

Conversation projections add `accessMode: ACTIVE | READ_ONLY`. Existing participants may list/read a `READ_ONLY` conversation. Send, read-write, presence, typing, join, and reactivation require `ACTIVE`.

## State Transitions

### Proposal

| Current              | Trigger                    | Next                 | Additional writes                                                    |
| -------------------- | -------------------------- | -------------------- | -------------------------------------------------------------------- |
| none                 | Admin creates              | `PENDING_BOTH`       | History + two notifications + email intents.                         |
| `PENDING_BOTH`       | First accept               | `PARTIALLY_ACCEPTED` | Decision + history + safe invalidation.                              |
| `PENDING_BOTH`       | Decline                    | `DECLINED`           | Decision + terminal times + neutral notifications.                   |
| `PARTIALLY_ACCEPTED` | Remaining accept           | `ACCEPTED`           | Decision + one accepted connection + terminal times + notifications. |
| `PARTIALLY_ACCEPTED` | Either declines            | `DECLINED`           | Current decision/history + terminal times + neutral notifications.   |
| active               | Exact expiry               | `EXPIRED`            | Terminal times + neutral notifications.                              |
| active               | Creator cancel             | `CANCELLED`          | Terminal times + neutral notifications.                              |
| active               | Block/account invalidation | `CANCELLED`          | System history + neutral notifications.                              |

Terminal states never reopen. Re-proposal creates a new row after cooldown.

### Connection

| Current    | Trigger                        | Next       | Additional writes                                                                          |
| ---------- | ------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| none       | Proposal reaches two accepts   | `ACCEPTED` | Notifications and Feature 008 eligibility.                                                 |
| `ACCEPTED` | Either participant disconnects | `REVOKED`  | Archive linked conversations, history/audit, realtime authority revocation, notifications. |

`REVOKED` never returns to `ACCEPTED`; reconnection creates new proposal, connection, and conversation IDs.

## Transaction Boundaries

- **Create**: lock the pair, both participant account rows, and administrator quota subject in deterministic order before account/block/current-connection/active-proposal/cooldown/quota checks and proposal/history/notification/email/audit writes.
- **Decision**: shared pair lock plus proposal and participant account locks, exact expiry/account/block recheck, decision upsert, state transition, optional connection creation, notifications/email/audit.
- **Cancel**: proposal lock, current Platform Administrator authority/version/expiry check, terminal transition, cancelling-actor audit, and notifications.
- **Block**: acquire the same pair lock before block creation and active-proposal cancellation so final acceptance and block cannot both win.
- **Disconnect**: shared connection/conversation locks, participant/version check, connection revoke plus conversation archive; realtime invalidation after commit.
- **Feature 008 write**: acquire the same connection/conversation locks and recheck accepted/unarchived authority immediately before message or read-state persistence.
- **Worker**: claim bounded IDs, lock each row, re-evaluate exact boundary, transition/scrub idempotently.

## Retention Projection Rules

1. Before 90 days: authorized operational detail includes reason and own decision; administrators see protected per-party detail only where specified.
2. At 90 days: ordinary administrator and participant terminal detail omits reason and per-party attribution even if physical rows remain; notification rows are unavailable at their individual 90-day deadline.
3. Before 365 days: step-up protected audit may expose the allowlisted investigation projection.
4. At 365 days: decisions are deleted; reason and direct proposal actor, participant, creator, and Support-case references are null; history actor/decision fields are scrubbed; tombstone remains and is excluded from operational lists/details.
5. Worker delay never extends visible access because services apply the timestamp rules directly.

## Migration Validation

- Existing `ProfessionalConnection` rows remain `ACCEPTED` with null source proposal and version 1.
- Existing professional-connection conversations remain active with null archive fields.
- The prior absolute pair unique constraint is replaced only after duplicate verification.
- Fresh and upgrade schemas both enforce active proposal/current connection partial uniqueness.
- Migration does not read, transform, or rewrite `MessagingMessage.content`.
