# Internal Contract: Feature 011 Professional Connection Dependency

## Ownership and roadmap position

Feature 011 owns bilateral proposals, decisions, connection lifecycle,
disconnect, and retention. Feature 008 owns only private conversations/messages
and consumes the minimum current-authority and archived-history projections.

## Durable record

An accepted professional connection has:

- an opaque stable ID;
- a canonical unique pair `(participantLowId, participantHighId)`;
- state `ACCEPTED`; and
- an `acceptedAt` timestamp.

Both user IDs refer to active SmartHire accounts. Self-connections are invalid.
Deleting or revoking the connection publishes an after-commit authority-change
signal for every messaging conversation that references the connection.

## Provider boundary

The Feature 011 provider exposes a server-only lookup equivalent to:

```text
findAcceptedConnection(userA, userB)
  -> { id, participantLowId, participantHighId, acceptedAt } | null
```

Inputs are canonicalized by the provider. The provider returns only `ACCEPTED`
records and never treats profile visibility, search results, invitations, or
pending records as messaging authority.

Feature 008 calls this provider only through
`MessagingEligibilityService.canMessage(userA, userB)`. That service also checks
the existing Application eligibility provider and returns true when at least one
provider currently authorizes the pair. Account/session, block, tenant context,
and conversation membership checks remain separate mandatory gates.

## Compatibility and tests

Feature 011 may later expand its schema and lifecycle without changing the
messaging-facing provider or `canMessage()` contract. Compatibility tests must
cover:

1. accepted connection only -> allowed;
2. valid Application only -> allowed;
3. both providers valid -> allowed;
4. neither provider valid -> denied; and
5. deleted/revoked connection with no Application path -> denied and active
   sockets are force-removed from referenced conversation rooms.
