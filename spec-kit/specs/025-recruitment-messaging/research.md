# Research: Application-Scoped Recruitment Messaging

## Decision: Application-keyed aggregate beside direct messaging

Existing conversations are unique by pair/context. Recruitment needs one thread per application and a non-participant Owner viewer, so it uses a dedicated aggregate rather than changing professional-connection semantics.

## Decision: Candidate starts only after assignment

An unassigned application has no safe recipient. Requiring an eligible assignee avoids broad company delivery while preserving communication once responsibility is known.

## Decision: Terminal applications are read-only

Authorized history is retained for audit and continuity, but new communication is prevented after a terminal recruitment decision.

## Decision: Owner views are audited and state-neutral

Owner oversight derives from active ownership, never creates participant capabilities, and records actor/action/target/time without message content.
