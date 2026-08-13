# Implementation Plan: Protected Messaging Report Review

**Branch**: `013-messaging-report-review` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/013-messaging-report-review/spec.md`

## Summary

Feature 013 adds a dedicated administrator queue for reports created inside protected one-to-one messaging. It extends the existing `MessagingReport` authority with assignment, optimistic versioning, immutable review history, private notes, and enforcement correlation. List responses expose metadata only. A sensitive, step-up-protected detail route may return the reporter-supplied detail and exactly the referenced evidence message; it never returns conversation history or introduces a general administrator conversation-reading endpoint.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24.18.0

**Primary Dependencies**: Next.js 16.3 App Router Route Handlers, React 19.2, React Admin 5.15, Material UI, Prisma 7.9, PostgreSQL, Zod 4.3, Better Auth 1.6

**Storage**: PostgreSQL remains authoritative for messaging reports, evidence references, review state/version, private notes, immutable review history, command receipts, and audit records

**Testing**: Vitest 4.1, Testing Library, OpenAPI parity, Prisma/PostgreSQL integration and concurrency tests, administrator authorization/privacy tests, architecture tests, and focused UI accessibility tests

**Target Platform**: Existing Windows/Linux Next.js deployment, administrator console, and responsive modern browsers

**Project Type**: Modular full-stack application in the existing `web/` workspace

**Performance Goals**: Dedicated report list and protected detail become usable at P95 within 2 seconds with 10,000 messaging reports; list pages are bounded to 100 rows

**Constraints**: No full conversation access; no message content in list/search/log/audit; sensitive proof for evidence and every command; existing `MessagingReport` remains the sole authority; terminal state transitions are deterministic; all commands are idempotent and version checked; notes are private and at most 2,000 normalized characters

**Scale/Scope**: One dedicated admin resource, one report detail view, five review commands, one schema migration, and focused participant confirmation-copy improvement

## Existing-System Reconciliation

Messaging report submission already exists at `POST /api/messaging/reports` and writes `MessagingReport` with `PENDING_REVIEW`. The administrator `/moderation-reports` resource reads a separate `ModerationReport` aggregate for jobs, companies, memberships, and candidates. Feature 013 does not merge these models or reinterpret the existing moderation queue. It adds a dedicated `/api/admin/messaging-reports` resource and navigation entry while preserving the protected-messaging boundary from Feature 008.

The evidence reference already points to an optional `MessagingMessage`. If the message is later unavailable, the report remains reviewable from safe metadata and is clearly labelled as unavailable; no fallback conversation fetch is permitted.

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Design evidence | Result |
|---|---|---:|
| I. Human-controlled recruitment | The workflow is human moderation and performs no automated recruitment decision. | PASS |
| II. Security/privacy/tenant isolation | Server authorization, fresh sensitive proof, evidence-only projection, no full conversation route, no content in list/log/audit. | PASS |
| III. Deterministic core | Queue ordering, state transitions, version conflicts, and idempotent replay are deterministic and AI-free. | PASS |
| IV. State/audit/integrity | PostgreSQL owns state; each command updates report/history/note/audit atomically through the existing command receipt boundary. | PASS |
| V. Scope discipline | The feature completes the missing admin review path without broadening participant messaging or existing moderation scope. | PASS |
| VI. Quality/accessibility | P95 target, bounded pages, labelled controls, explicit empty/error/evidence-unavailable states, and focused tests are defined. | PASS |
| VII. Maintainable architecture | Existing route, service, repository, admin boundary, React Admin, and audit patterns are extended without a second messaging-report authority. | PASS |

**Post-design re-check**: PASS. Contracts and model explicitly prevent full conversation disclosure and keep participant/admin concerns separate.

## Architecture and Ownership

```text
Participant report dialog
  `-- POST /api/messaging/reports --> existing ReportMessagingService

Administrator console
  |-- GET /api/admin/messaging-reports                 (metadata only)
  |-- GET /api/admin/messaging-reports/{reportId}      (sensitive proof)
  `-- POST /api/admin/messaging-reports/{reportId}/{action}
          `-- AdminMessagingReportReviewService
                |-- PrismaAdminMessagingReportRepository
                |-- PrismaAdminCommandRepository
                `-- AuditWriter
```

- Route Handlers own authorization, strict request parsing, safe error translation, no-store responses, command headers, and sensitive-proof requirements.
- The list repository selects only report metadata and safe account identity. It must not join `MessagingMessage.content`.
- The detail repository selects the one `evidenceMessage` relation by the stored reference and verifies its conversation binding. It must not select `MessagingConversation.messages`.
- The service owns allowed states, normalized notes, state/version changes, immutable history, enforcement linkage, and allowlisted audit context.
- Existing `AdminCommandReceipt` provides idempotent replay and body-conflict detection. Database version matching resolves concurrent review attempts.
- React Admin owns list filters, detail rendering, explicit command confirmation, stale/error recovery, and refresh after successful commands.

## Authorization and Privacy Boundary

Every route requires an active platform administrator grant through `AdminRequestBoundary`. List access uses ordinary administrator authorization because it contains no message content. Detail and all commands require `sensitive: true`, which enforces the existing fresh-proof policy.

The list may expose report ID, safe reporter/target display identity and account reference, target type, category, state, assignee reference, evidence availability, age, creation time, and version. It must not expose report detail, message text, conversation ID, message ID, email, or participant contact data.

The detail may expose the normalized reporter detail and one evidence record containing safe sender identity, message text, and sent time. The stored evidence message must belong to the report conversation; a mismatch is treated as unavailable. There is no endpoint to navigate before/after messages, fetch arbitrary messages, or read a conversation by administrator privilege.

Responses use `Cache-Control: private, no-store`; content is absent from telemetry, audit context, and safe errors. Unknown and unauthorized references use the same unavailable projection.

## Review State and Commands

`MessagingReport.state` remains `PENDING_REVIEW`, `RESOLVED`, or `DISMISSED`. Assignment and notes are allowed only while pending. Resolve/dismiss transition once from pending and clear `unresolvedKey`; terminal commands set `handledAt` and handler identity. Enforcement linking records only an already-authorized correlation reference and does not perform account or message enforcement itself.

Each command requires `If-Match-Version`, `Idempotency-Key`, and `{ confirmation: true }`. The transaction checks the current row, applies one version increment, writes an immutable review event, optionally writes a private note, appends an allowlisted audit event, and stores the command outcome. Exact retries return the original outcome; reused keys with different bodies conflict; stale versions return the current version without applying changes.

## Data and Migration Strategy

1. Add nullable assignee/handler/enforcement references and `version=1` to existing reports without changing state or evidence.
2. Add `MessagingReportReviewEvent` and `MessagingReportPrivateNote` tables with cascading report ownership and administrator actor references.
3. Add queue and history indexes. Existing pending rows immediately appear unassigned in the new queue.
4. Deploy schema and server routes before exposing the React Admin resource.
5. Roll back UI/routes by feature removal while retaining additive columns/history. Recover schema through a forward migration; do not delete review evidence.

## Project Structure

### Documentation

```text
spec-kit/specs/013-messaging-report-review/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
└── tasks.md
```

### Source Code

```text
web/
├── prisma/{schema.prisma,migrations/*_messaging_report_review/}
├── src/app/api/admin/messaging-reports/**
├── src/backend/admin/messaging-reports/**
├── src/backend/repositories/admin/prisma-admin-messaging-report-repository.ts
├── src/frontend/features/admin/messaging-reports/**
├── src/shared/contracts/admin/messaging-reports.ts
└── tests/{shared,backend,frontend,security,architecture}/**
```

**Structure Decision**: Extend the existing protected messaging report, administrator command, authorization, audit, and React Admin boundaries. Do not merge with general moderation reports and do not add administrator conversation browsing.

## Verification Strategy

- Contract tests validate Zod/OpenAPI list, detail, commands, safe errors, and no-store behavior.
- Repository integration tests prove deterministic filtering/order, evidence-only projection, message/conversation mismatch denial, exact idempotent replay, stale conflict, atomic history/note/state/audit writes, and terminal-state rules.
- Security/architecture tests prove the list contains no report/message content and no administrator endpoint or repository query can fetch conversation history.
- Frontend tests cover pending/populated/empty/error queues, evidence unavailable, protected detail, note length, commands, stale recovery, labels, keyboard use, and responsive rendering.
- Participant UI tests verify successful submission says it is queued for protected review without promising a particular outcome.
- Performance evidence seeds 10,000 reports and records environment, warm-up, sample size, concurrency, P50/P95/P99/max, and error rate with P95 at or below 2 seconds.

## Complexity Tracking

No constitution violation or additional complexity waiver is required.
