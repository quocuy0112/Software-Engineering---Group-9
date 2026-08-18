# Data Model

## InAppNotification changes

| Field | Rule |
|---|---|
| `contextType`, `contextId` | Existing durable navigation context; both present or both absent. |
| `recipientRole` | Additive enum: `CANDIDATE`, `RECRUITER`, `ADMIN`; immutable event audience. |
| `href` | Retained nullable compatibility field; new writes are null and reads ignore it. |
| `occurrenceCount`, `lastOccurredAt` | Existing grouping inputs; resolver makes a filtered list href when count > 1. |

## ResolvedDestination (transient)

`href: string | null`, `availability: AVAILABLE | NO_SAFE_DESTINATION`; never persisted and never used as proof of authorization.
