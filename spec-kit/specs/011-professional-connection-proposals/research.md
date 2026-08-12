# Research: Professional Connection Proposals

## Decision 1: Feature ownership

**Decision**: Feature 011 owns proposals, decisions, connection lifecycle, disconnect, notifications, and retention. Feature 006 provides administrator infrastructure; Feature 008 consumes current eligibility and archived-history access.

**Rationale**: Feature 007 is job-posting management. Keeping relationship state in 011 removes the stale temporary ownership assumption in 008 and prevents support/admin code from becoming a private-chat authority.

**Alternatives considered**: Extend Feature 008 with proposal administration; rejected because support transfer/admin consent are separate domains. Extend Feature 007; rejected because it has no relationship-management domain.

## Decision 2: Canonical unordered pairs and race authority

**Decision**: Store `participantLowId` and `participantHighId`, lock by canonical pair during creation/final acceptance, and enforce partial unique indexes for active proposals and accepted connections.

**Rationale**: Application-only duplicate checks cannot prevent A-B/B-A or concurrent writes. Partial uniqueness preserves historical revoked connections while preventing two current relationships.

**Alternatives considered**: One absolute pair unique key; rejected because reconnection needs historical rows. Serialize only in application memory; rejected because it fails across processes/restarts.

## Decision 3: Consent representation

**Decision**: Store one current decision row per participant and immutable transition history. Allowed decision transitions are absent to accepted/declined and accepted to declined before final acceptance.

**Rationale**: This supports independent consent and a final withdrawal before bilateral acceptance while keeping one authoritative current value and a complete audit trail.

**Alternatives considered**: Boolean columns on the proposal; rejected because attribution, retention, and concurrency are harder to isolate. Append-only decisions without a current row; rejected because every command would need ambiguous reduction rules.

## Decision 4: Expiry and terminal-state enforcement

**Decision**: Treat `expiresAt <= now` as expired in every read/command and persist `EXPIRED` asynchronously in bounded batches.

**Rationale**: Privacy and consent deadlines cannot depend on worker punctuality. Read-time enforcement gives exact behavior; the worker provides durable convergence and notifications.

**Alternatives considered**: Worker-only expiry; rejected because delayed workers could accept stale consent.

## Decision 5: Anti-spam controls

**Decision**: Enforce pair cooldown plus recipient and administrator rolling quotas in the same creation transaction, backed by indexed database counts and the existing rate-limit admission layer.

**Rationale**: A per-pair limit alone allows many administrators/pairs to overwhelm one recipient. Client debounce cannot protect server endpoints.

**Alternatives considered**: IP-only throttling; rejected because administrators may share networks and authenticated abuse remains possible. Client-only limits; rejected because clients are bypassable.

## Decision 6: Block and account-state races

**Decision**: Recheck both directional blocks and both account states under transaction before final acceptance. Block creation publishes a post-commit proposal invalidation and cancels active proposals neutrally.

**Rationale**: Creation-time checks alone leave a race where a blocked or suspended pair becomes connected.

**Alternatives considered**: Let Feature 008 block messages but still create the connection; rejected because it records consent completion after an explicit safety boundary invalidated the proposal.

## Decision 7: Notifications

**Decision**: Use a durable recipient notification row for in-app state and existing `EmailOutbox` intents for email. Store template kinds/references, not rendered sensitive content, and reconcile delivery independently from core state.

**Rationale**: Both recipients need reliable in-app visibility, while provider outages must not roll back consent. Symmetric template kinds prevent decline/block inference.

**Alternatives considered**: Email only; rejected because support should not require inbox access. Rendered bodies in proposal metadata; rejected because it broadens sensitive retention.

## Decision 8: Optional Support Center linkage

**Decision**: Store one nullable `sourceSupportConversationId` after verifying administrator access at creation; never copy messages, notes, requester email, or assignment data.

**Rationale**: It supports the practical support-to-proposal workflow without coupling proposal lifecycle or retention to case content.

**Alternatives considered**: Copy case context into the reason; rejected for privacy and retention mismatch. Bidirectional lifecycle coupling; rejected because case resolution does not represent participant consent.

## Decision 9: Disconnect and history

**Decision**: Revoke the connection and archive its conversations. Split Feature 008 authorization into active communication authority and participant-only archived read authority.

**Rationale**: Removing the accepted eligibility currently hides all history. A separate read path satisfies withdrawal of future contact without rewriting or deleting retained messages.

**Alternatives considered**: Hide all history; rejected by the approved product decision. Keep conversation active but disable only the composer in UI; rejected because API/socket bypass would remain possible.

## Decision 10: Reconnection

**Decision**: Each newly accepted proposal creates a new connection ID, and conversation context uniqueness uses that ID. Archived conversations remain immutable and separate.

**Rationale**: Reusing the old connection would accidentally reactivate old realtime rooms and blur consent periods.

**Alternatives considered**: Restore the revoked connection; rejected because it destroys lifecycle evidence. Merge histories into a new conversation; rejected because context and read-state become ambiguous.

## Decision 11: Retention

**Decision**: Suppress ordinary sensitive detail at 90 days, permit step-up audit access until 365 days, then delete decisions/reason/direct proposal attribution and retain a non-identifying pair digest tombstone.

**Rationale**: The system needs short-term operational accountability but must not preserve who declined whom indefinitely. Exact read-time suppression protects users if workers lag.

**Alternatives considered**: Indefinite admin history; rejected as disproportionate. Full deletion at 90 days; rejected because protected abuse investigation needs a bounded evidence window.

## Decision 12: Interfaces and UI

**Decision**: Use Next.js Route Handlers, shared Zod contracts, React Admin resource screens for administrators, and a Candidate `/connections` workspace. Mutations are pessimistic and refetch authoritative state.

**Rationale**: These are the existing project boundaries and avoid adding a second backend or client authority for consent state.

**Alternatives considered**: Generic React Admin CRUD; rejected because it could bypass transitions and consent. Socket-only commands; rejected because durable state and idempotent HTTP commands are easier to secure and recover.
