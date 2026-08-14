# Data Model: Protected Messaging Report Review

## MessagingReport (extended)

Existing authority for a participant-submitted messaging report.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Existing primary key |
| `reporterUserId` | String | Existing reporter relation |
| `targetUserId` | String | Existing reported participant relation |
| `conversationId` | String | Existing protected conversation relation; not returned by admin list |
| `targetType` | Enum | Existing `CONVERSATION` or `PARTICIPANT` target |
| `evidenceMessageId` | String? | Existing optional evidence relation |
| `category` | Enum | Existing moderation category |
| `normalizedDetail` | String? | Existing participant detail; protected detail only |
| `state` | Enum | `PENDING_REVIEW`, `RESOLVED`, `DISMISSED` |
| `assignedAdminUserId` | String? | Current administrator assignee |
| `handledByAdminUserId` | String? | Administrator who made terminal decision |
| `enforcementCorrelationId` | String? | Reference to separately authorized enforcement |
| `version` | Int | Starts at 1; increments once per accepted command |
| `unresolvedKey` | String? | Existing unresolved deduplication key; cleared at terminal state |
| `handledAt` | DateTime? | Existing terminal timestamp |
| `preserveUntil` | DateTime? | Existing messaging evidence preservation control |
| `createdAt`, `updatedAt` | DateTime | Existing timestamps |

Indexes: `(state, createdAt, id)`, `(assignedAdminUserId, state, createdAt, id)`, existing reporter/conversation/preservation indexes.

## MessagingReportReviewEvent (new)

Immutable record for every accepted administrator report command.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Primary key |
| `reportId` | String | Cascades with owning report |
| `actorAdminUserId` | String | Restrict-delete administrator actor relation |
| `action` | String | `assign`, `note`, `resolve`, `dismiss`, `link-enforcement` |
| `priorState` | Enum | State before command |
| `resultingState` | Enum | State after command |
| `resultingVersion` | Int | Unique with `reportId` |
| `enforcementCorrelationId` | String? | Present only for linkage action |
| `occurredAt` | DateTime | Server transaction time |

Constraints: unique `(reportId, resultingVersion)`; index `(actorAdminUserId, occurredAt)` and `(reportId, occurredAt, id)`.

## MessagingReportPrivateNote (new)

Administrator-only normalized investigation note.

| Field | Type | Rules |
|---|---|---|
| `id` | String | Primary key |
| `reportId` | String | Cascades with owning report |
| `authorAdminUserId` | String | Restrict-delete administrator author relation |
| `normalizedText` | String | 1-2,000 characters after NFKC/control/markup normalization |
| `createdAt` | DateTime | Server transaction time |

Index: `(reportId, createdAt, id)`.

## State Transitions

```text
PENDING_REVIEW --resolve--> RESOLVED
PENDING_REVIEW --dismiss--> DISMISSED
```

- `assign` and `note` preserve `PENDING_REVIEW`.
- `link-enforcement` preserves the current state and may run after terminal review.
- Resolve/dismiss set `handledAt`, `handledByAdminUserId`, clear `unresolvedKey`, and increment version.
- No transition leaves a terminal state.

## Projection Rules

**List projection**: safe participant display names/references, category, target type, state, assignee, evidence availability, creation time, age, and version. Excludes `normalizedDetail`, IDs identifying conversation/message, and all message content.

**Detail projection**: list fields plus normalized detail, exactly one evidence message if valid, review events, and private notes. Evidence includes safe sender reference/name, text, and timestamp. It excludes conversation history and direct contact details.

## Concurrency and Idempotency

`If-Match-Version` must equal the current report version. The update claims `(id, version, state)` and increments exactly once. `AdminCommandReceipt` binds administrator, command kind, report, idempotency key, and normalized body. Exact replay returns the stored result; changed body conflicts.

## Migration

All new report columns are nullable except `version`, which defaults to 1. Existing rows require no content backfill. Existing pending rows become unassigned queue items. Child tables start empty. Migration is additive and reversible operationally by disabling routes/UI; schema rollback is forward-only to preserve audit history.
