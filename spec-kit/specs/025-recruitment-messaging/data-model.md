# Data Model: Application-Scoped Recruitment Messaging

## RecruitmentThread

| Field | Rule |
|---|---|
| `applicationId` | Unique: exactly one thread per application. |
| `companyId`, `jobPostingId`, `candidateUserId` | Server-derived immutable scope. |
| `assignedMembershipId` | Current active HR Manager/Recruiter; nullable before assignment and changed only by an active same-company HR Manager. |
| `state` | `OPEN` or `READ_ONLY`, derived from application authority. |
| sequences/read boundaries/version | Transactional ordering, per-participant state, and compare-and-set commands. |

Creation and assignment history is stored as immutable `AuditEvent` records targeting the recruitment thread. A concurrent start request reads the winning thread and never changes its assignment.

## RecruitmentMessage

One durable plain-text message in a thread with sender user/membership, sequence, and sender-scoped idempotency key.

## Access projection

Candidate reads/writes only own eligible application; assigned HR/Recruiter reads/writes the assigned application; Owner reads only owned-company threads and never changes message state.
