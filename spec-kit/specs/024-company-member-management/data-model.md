# Data Model: Company Member Management

## CompanyInvitation

| Field | Rule |
|---|---|
| id | Stable opaque identifier |
| companyId | Company receiving the member |
| normalizedEmail | Recipient identity binding |
| role | Only `HR_MANAGER` or `RECRUITER` |
| state | `PENDING`, `REVOKED`, `ACCEPTED`, `EXPIRED` |
| tokenDigest | Hash of one-time acceptance token |
| expiresAt | Seven days after issuance |
| invitedByUserId | Active Owner who issued it |
| acceptedByUserId / acceptedAt | Acceptance evidence |
| version | Optimistic concurrency evidence |

Only one pending invitation may exist for a company/email pair. An invitation does not grant authority before acceptance.

## CompanyMembership

Existing fields remain authoritative. Feature 024 can create/re-activate `HR_MANAGER` and `RECRUITER` memberships, change only between those roles, and transition `ACTIVE ↔ SUSPENDED → REMOVED`. Owner rows are read-only to this feature.
