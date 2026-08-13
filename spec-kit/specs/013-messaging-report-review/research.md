# Research: Protected Messaging Report Review

## Decision 1: Keep a dedicated messaging-report queue

**Decision**: Add `messaging-reports` as a separate React Admin resource and API namespace.

**Rationale**: `MessagingReport` and `ModerationReport` are separate authorities with different privacy boundaries and target models. A union queue would either leak protected messaging fields into a general projection or require brittle polymorphic behavior.

**Alternatives considered**:
- Merge rows into `/moderation-reports`: rejected because it changes the existing aggregate and weakens evidence-specific authorization.
- Copy messaging reports into `ModerationReport`: rejected because dual writes create conflicting authorities and lifecycle drift.

## Decision 2: Expose exactly one referenced evidence message

**Decision**: The protected detail query may select only `MessagingReport.evidenceMessage`; it never includes conversation messages.

**Rationale**: The participant intentionally selected a message as evidence. Review needs that bounded context, while unrestricted conversation access is disproportionate and contrary to Feature 008 privacy requirements.

**Alternatives considered**:
- Show the entire conversation: rejected as unnecessary privileged surveillance.
- Show no message content: rejected because administrators could not assess message-specific reports.
- Show surrounding messages: rejected because it silently expands disclosure beyond submitted evidence.

## Decision 3: Reuse administrator sensitive proof and command receipts

**Decision**: Use `AdminRequestBoundary.require(request, { sensitive: true })` for detail/commands and `PrismaAdminCommandRepository` for idempotency.

**Rationale**: These are established controls for privileged evidence and state-changing admin operations. Reuse preserves session/grant validation, CSRF, replay safety, correlation IDs, and consistent safe errors.

## Decision 4: Extend MessagingReport rather than create a review aggregate

**Decision**: Add assignment/version/handler/enforcement fields plus child history/note tables to `MessagingReport`.

**Rationale**: The report row already owns evidence, state, unresolved deduplication, and retention. Additive workflow fields avoid a second source of truth while normalized child tables preserve immutable history and private notes.

## Decision 5: Use offset pagination consistent with React Admin

**Decision**: Use bounded page/perPage pagination and deterministic `(createdAt ASC, id ASC)` queue order, with pending work naturally oldest first.

**Rationale**: Existing admin resources and React Admin expect total/page semantics. A composite queue index keeps the 10,000-row target practical. Filters remain server-side and inputs are allowlisted.

## Decision 6: Keep enforcement separate

**Decision**: The review workflow only links an enforcement correlation reference.

**Rationale**: Resolving a report is an investigation outcome, not implicit authority to suspend an account or delete a message. Separate confirmed enforcement preserves auditability and least privilege.

## Decision 7: Preserve report evidence retention behavior

**Decision**: Feature 013 does not change `preserveUntil` or participant deletion rules.

**Rationale**: The existing messaging feature owns preservation. Review history is metadata-only and follows the platform administrator audit/retention baseline; content is never copied into notes or audit records automatically.
