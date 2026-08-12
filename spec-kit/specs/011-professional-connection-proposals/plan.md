# Implementation Plan: Professional Connection Proposals

**Branch**: `011-professional-connection-proposals` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/011-professional-connection-proposals/spec.md`

## Summary

Feature 011 makes administrator-mediated professional relationships consent-based. A current Platform Administrator creates a canonical two-account proposal, each participant decides independently, and only the transaction that observes two valid acceptances creates one current `ProfessionalConnection`. The implementation extends the existing Next.js/TypeScript application, PostgreSQL schema, Feature 006 administration/audit/email/worker boundaries, and Feature 008 messaging eligibility/realtime boundaries. Disconnect revokes current messaging authority while preserving an explicitly archived, participant-only read path for retained history.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.x

**Primary Dependencies**: Next.js 16.3 App Router Route Handlers, React 19.2, React Admin 5.15, Prisma 7.9, PostgreSQL, Zod 4.3, Better Auth 1.6, Socket.IO 4.8, React Email 2.1

**Storage**: PostgreSQL through the existing Prisma adapter; `EmailOutbox` for durable email delivery; no new database or cache

**Testing**: Vitest 4.1, Testing Library, Playwright, architecture/privacy tests, PostgreSQL integration tests, deterministic concurrency and performance harnesses

**Target Platform**: Existing Windows/Linux Node web deployment with same-origin Candidate workspace, exact-host Platform Administrator console, and the approved custom Node realtime entrypoint

**Project Type**: Full-stack web application in the existing `web/` workspace

**Performance Goals**: Proposal list/detail and administrator account selection P95 <= 2 seconds with 10,000 accounts, 10,000 terminal proposals, and 1,000 active proposals; 95% of online in-app changes visible within five seconds; bounded retention cycles

**Constraints**: Bilateral consent; no administrator force-connect; canonical unordered pairs; one active proposal and one current accepted connection per pair; exact expiry/retention enforcement on reads; no ordinary-chat admin reader; content-free invalidations and email metadata; immediate messaging authority revocation on disconnect

**Scale/Scope**: Two responsive workspaces, ten Route Handler operations, six proposal states, two connection states, three rolling abuse limits, one lifecycle/retention worker, Feature 006 and Feature 008 integration, and representative 10,000-account validation

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle                               | Design evidence                                                                                                                                                                                        | Result |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----: |
| I. Human-controlled recruitment         | No AI or automated recruitment decision is introduced. Administrator initiation cannot create a connection; both people decide.                                                                        |   PASS |
| II. Security, privacy, tenant isolation | Better Auth remains exclusive; all authorization is server-side; participant queries are ownership-scoped; admin cannot read private chat; reasons and decisions have bounded visibility and deletion. |   PASS |
| III. Deterministic core                 | State transitions, quotas, cooldowns, expiry, pair ordering, and eligibility are deterministic; no AI dependency.                                                                                      |   PASS |
| IV. State, audit, integrity             | Critical transitions use transactions, row locks/version checks, partial uniqueness, idempotency, immutable history, and allowlisted audit facts.                                                      |   PASS |
| V. Scope discipline                     | The feature completes the explicitly approved proposal-to-messaging workflow and does not add discovery feeds, groups, recommendations, or force-connect.                                              |   PASS |
| VI. Quality/accessibility               | Spec defines P95 conditions, concurrency evidence, exact retention checks, mobile/keyboard/accessibility outcomes, and explicit error states.                                                          |   PASS |
| VII. Maintainable architecture          | Route Handlers call typed services and repositories; existing provider ports are reused; Socket.IO remains transport composition only; PostgreSQL is the sole authority.                               |   PASS |

**Post-design re-check**: PASS. Research, data model, REST contracts, messaging-access contract, retention design, and task strategy preserve every gate without an exception.

## Architecture and Ownership

### Feature ownership

Feature 011 is the sole owner of proposal, bilateral decision, `ProfessionalConnection` lifecycle, proposal notifications, proposal retention, and disconnect commands. Feature 006 supplies Platform Administrator authentication/authorization, account lookup, audit writing, email outbox, worker runtime, and optional `SupportConversation` linkage. Feature 008 remains the sole owner of private conversations/messages and consumes two explicit Feature 011 projections:

1. **Current messaging eligibility**: only a current `ACCEPTED` connection permits discovery, open, send, presence, typing, and read writes.
2. **Archived history access**: a revoked connection may permit its original participants to read an existing archived conversation, but it never grants active messaging authority.

This supersedes the temporary Feature 008 document reference assigning its minimal connection slice to Feature 007. Feature 007 remains job-posting management and receives no connection responsibility.

### Command and transaction model

All commands use strict Zod schemas, the current Better Auth session, CSRF proof for browser mutations, a UUID idempotency key, and expected version where a proposal or connection already exists. Creation acquires database transaction locks for the canonical pair, both participant account rows, and the administrator quota subject in deterministic order before counting active/rolling quotas. Decision and block creation acquire the same pair lock; final acceptance also locks the proposal and both account rows before rechecking account state, active block, cooldown, expiry, and current accepted connection. Database partial unique indexes are the final race authority for one active proposal and one accepted connection.

The second acceptance transaction writes the participant decision, proposal history, proposal terminal state, one accepted connection, in-app notifications, email intents, and audit event as one core-state transaction. External email delivery happens afterward and may retry independently.

### Abuse and neutral failure boundary

Creation uses three cumulative controls: maximum three active proposals per participant, five received proposals per participant in a rolling 30 days, and 20 creations per administrator in a rolling 24 hours. Pair cooldown is 30 days after decline and seven days after expiry/cancellation. Block, unknown, ineligible, and unauthorized participant results share neutral unavailable projections. Administrator responses may state a safe policy category and retry duration only after authority and account references are validated through the protected admin boundary.

### Notification and realtime boundary

`ProfessionalConnectionNotification` is the durable in-app notification authority and stores only an approved template kind plus references needed to render recipient-safe copy. Email uses the existing `EmailOutbox` renderer registry and stores no reason or decision attribution in metadata. Proposal UI may refresh through a content-free invalidation (`proposalId`, `version`, aggregate state, change); no proposal reason, email, participant decision, support content, or message content crosses realtime events.

Feature 011 calls the existing Feature 008 authority-enforcement port after disconnect or block cancellation so affected sockets leave private rooms immediately and receive the existing access-revoked signal. Proposal invalidation uses the existing Socket.IO server through a narrowly separated `/connections` namespace; initial and recovery reads remain REST-authoritative.

### Disconnect and archived history

`MessagingConversation` receives explicit archive fields and a read/write access mode in projections. Disconnect sets `ProfessionalConnection.state=REVOKED`, records actor/time, archives all conversations tied to that connection, and commits an authority invalidation. Disconnect and every professional-connection message/read write acquire the same connection/conversation transaction locks and recheck current accepted/unarchived authority immediately before persistence, so a write cannot commit after revocation wins the lock. Feature 008 services split their current eligibility check:

- list/detail/history may include an archived professional-connection conversation only for an original participant;
- open/send/read-write/presence/typing/realtime room admission require current accepted eligibility and an unarchived conversation.

Archived conversation projections clearly expose `READ_ONLY`; composers and active-status controls are disabled. A future accepted connection has a new source proposal and connection ID, so the existing conversation uniqueness key naturally creates a new conversation and never reactivates the archived one.

### Retention

Terminal proposal detail remains in ordinary admin and participant projections for 90 days. After that exact boundary, service projections suppress reason and per-party attribution regardless of worker timing. Recipient notification rows have a hard 90-day deletion deadline. Step-up protected audit detail remains until the exact 365-day boundary. A bounded worker then deletes decisions and reason, nulls direct proposal participant, creator, Support-case, and other sensitive references, scrubs sensitive history attribution, and retains only state, timestamps, canonical pair digest, policy version, and integrity references. Operational list/detail queries exclude protected-deleted tombstones. Reads enforce deletion semantics before physical cleanup. Existing email-outbox retention and Feature 008 connection/message retention remain authoritative in their domains.

## Project Structure

### Documentation

```text
spec-kit/specs/011-professional-connection-proposals/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── openapi.yaml
│   └── messaging-access.md
└── tasks.md
```

### Source Code

```text
web/
├── prisma/
│   ├── schema.prisma
│   └── migrations/*_professional_connection_proposals/
├── src/app/
│   ├── (workspace)/connections/page.tsx
│   └── api/
│       ├── connections/
│       └── admin/professional-connection-proposals/
├── src/backend/
│   ├── connections/
│   │   ├── authorization/
│   │   ├── http/
│   │   ├── notifications/
│   │   ├── realtime/
│   │   ├── services/
│   │   └── workers/
│   ├── repositories/connections/
│   └── messaging/
│       ├── authorization/
│       ├── realtime/
│       └── services/
├── src/frontend/features/
│   ├── connections/
│   ├── admin/professional-connections/
│   └── messaging/
├── src/shared/contracts/connections/
└── tests/
    ├── shared/unit/connections/
    ├── backend/{unit,contract,integration}/connections/
    ├── frontend/{components,accessibility}/connections/
    ├── security/connections/
    ├── performance/connections/
    ├── architecture/professional-connection-boundaries.test.ts
    └── system/e2e/connections/
```

**Structure Decision**: Extend the existing single `web/` application. Feature 011 gets its own contracts, services, repositories, UI, and tests; integrations occur only through existing Feature 006 and 008 ports. No new service, session mechanism, database, or provider is introduced.

## Migration and Recovery Strategy

1. Add proposal, decision, history, and notification enums/tables plus nullable archive/revocation fields.
2. Change `ProfessionalConnection` pair uniqueness from absolute uniqueness to a partial unique index for current `ACCEPTED` rows; existing rows remain accepted and valid.
3. Backfill no proposal for legacy accepted connections; mark their source as `LEGACY_MIGRATION` through a nullable source proposal and policy version.
4. Add partial active-proposal and current-assignment indexes in raw migration SQL after Prisma table creation.
5. Keep new archive fields null for existing conversations; null means active under the legacy behavior.
6. Verify fresh migration, upgrade from the Feature 008 schema, duplicate-pair protection, rollback-by-forward-fix instructions, and no private-message rewrite.

## Verification Strategy

- Contract tests keep OpenAPI, Zod, React Admin data-provider paths, safe errors, and realtime invalidations aligned.
- PostgreSQL integration tests use real transactions for canonical-pair creation races, final acceptance races, expiry/block/suspension races, quota/cooldown boundaries, disconnect/send races, and exact retention.
- Security tests prove administrator authority, participant ownership, neutral non-enumeration, no support-content copy, no private-message reader, and content-free logs/events.
- Feature 008 regressions prove application-context messaging is unchanged, accepted connection messaging works, revoked history is read-only, and new connections create new conversations.
- Component/accessibility tests cover admin proposal creation/list/detail, participant decision/inbox, disconnect confirmation, archived-chat states, mobile width, keyboard use, labels, live feedback, and text-based status.
- Performance evidence documents environment, dataset, sample count, duration, concurrency, P50/P95/P99/max, and errors for administrator account search and proposal lists.
- Production build, migration status, worker probe, Feature 006 regression, Feature 008 regression, and focused Feature 011 suite are mandatory before implementation commit.

## Complexity Tracking

No constitution violation requires justification.
