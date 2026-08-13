# Feature 011 to Feature 008 Messaging Access Contract

## Ownership

- Feature 011 owns proposal consent and `ProfessionalConnection` lifecycle.
- Feature 008 owns conversations, messages, read state, presence, typing, blocking, reporting, and message retention.
- Platform Administrator or Support authority never implies private-message access.

## Active Communication Projection

Feature 008 may authorize professional-connection communication only when all are true:

1. the referenced connection exists and its canonical participants match;
2. `ProfessionalConnection.state` is `ACCEPTED`;
3. both accounts are `ACTIVE`;
4. neither directional `UserMessagingBlock` exists;
5. the conversation is not archived.

This projection permits eligible-participant discovery, opening one conversation for the connection, send, read writes, presence, typing, room admission, and outbound delivery.

## Archived Read Projection

Feature 008 may authorize retained history reading only when all are true:

1. the conversation already exists and references the connection;
2. the current user is an original `MessagingConversationParticipant`;
3. the connection is `REVOKED`;
4. the conversation archive reason is `PROFESSIONAL_CONNECTION_REVOKED`;
5. message/conversation retention policy still permits the history.

This projection permits conversation list/detail and paginated message history only. It never permits opening/reusing a conversation, send, read-receipt writes, presence, typing, room admission, or outbound message delivery.

## Disconnect Commit

The disconnect transaction:

1. locks and validates the current accepted connection and actor membership;
2. updates it to `REVOKED` with actor/time/version;
3. archives every conversation referencing that connection;
4. writes connection/proposal-domain history and audit;
5. commits;
6. publishes content-free authority invalidation to Feature 008.

Feature 008 revalidates authority on every protected request and socket event, so a missed post-commit invalidation cannot authorize new data.

## Reconnection

A later bilateral acceptance produces a new connection ID. Conversation uniqueness uses the new connection ID as context reference; archived history remains on the old connection and is never merged or reactivated.

## Safe Projection Changes

Conversation summaries/details add:

```text
accessMode: ACTIVE | READ_ONLY
archivedAt: ISO timestamp | null
```

No proposal reason, decision attribution, administrator identity, support case reference, or connection audit detail enters Feature 008 conversation/message projections.

## Superseded Dependency

`spec-kit/specs/008-realtime-messaging/contracts/professional-connection-dependency.md` remains historical implementation context only. Its reference to Feature 007 ownership is superseded by this contract; Feature 011 is authoritative.
