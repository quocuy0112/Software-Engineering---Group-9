# Data Model: Platform Administration and Employer Verification

**Feature**: `006-admin-management`  
**Authority**: [spec.md](./spec.md)  
**Database baseline**: PostgreSQL 16 / Prisma 7

## Modeling rules

- `UserAccount`, `CandidateIdentity`, `PlatformAdministratorGrant`, `Company`,
  and `CompanyMembership` are separate entities. No global recruiter role or
  flattened recruiter record is introduced.
- Existing Better Auth `Session`, `TwoFactor`, and credential records remain
  Better Auth-owned. New entities may reference a Session ID but never copy its
  token, factor secret, submitted code, or full network address.
- Every mutable administration aggregate has an integer `version` incremented
  by an accepted transition. Commands include the reviewed version.
- State, audit event, notification work, and privileged-rationale reference are
  committed in one PostgreSQL transaction when required by FR-058.
- User-facing/API IDs are opaque stable references. Storage locators,
  encryption material, session tokens, and raw evidence are never API IDs.
- Timestamps use UTC instants. “Calendar days” in FR-028/FR-021 are calculated
  from the persisted transition/action instant; UI localization does not change
  the deadline.

## Existing entities retained

### UserAccount

Existing model; authoritative account lifecycle.

| Field                              | Rule/change                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`                               | Existing opaque account reference                                                                                  |
| `name`, `email`, `normalizedEmail` | Existing values; admin projections mask email server-side                                                          |
| `state`                            | Existing `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `DELETED`; Feature 006 transitions only ACTIVE ↔ SUSPENDED |
| `twoFactorEnabled`                 | Must be true before an administrator session can be designated                                                     |
| `stateChangedAt`                   | Updated only with accepted account transition                                                                      |
| `createdAt`, `updatedAt`           | Existing timestamps                                                                                                |
| `adminGrant`                       | Optional one-to-one PlatformAdministratorGrant                                                                     |
| `candidateIdentity`                | Existing required base identity for normal accounts                                                                |
| `companyMemberships`               | Existing one-to-many relation                                                                                      |

Account deletion/email/profile/factor mutation is not exposed by this feature.

### CandidateIdentity

Existing one-to-one base identity keyed by `userId`. It remains present when an
account receives or loses administrator/company authority. Admin projections
expose only its existence, never Candidate Profile/CV content.

### Session

Existing Better Auth session model remains the exclusive browser-session
authority.

Existing safe inputs for admin projection are transformed to:

| Projection field                           | Derivation                                                          |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `sessionReference`                         | Non-reusable server-generated reference; never token/id if reusable |
| `deviceDescription`                        | Allowlisted user-agent family/device class                          |
| `approximateLocation`                      | Optional approved coarse location; never full address/IP            |
| `createdAt`, `lastActivityAt`, `expiresAt` | Existing timestamps                                                 |
| `revocationState`                          | Derived active/revoked/expired state                                |

`revokedAt` and non-sensitive internal revocation category remain server-side.
Revoking a designated administrator Session invalidates that same existing
Better Auth row; no administration session table/token is introduced.

### AuditEvent

Reuse the existing append-only event model. Extend the action-code/schema
allowlist for admin access, account/session, verification, membership,
moderation, notification intervention, and denied privileged attempts.

Permitted context includes reason category, prior/resulting state, version,
safe failure code, evidence/request version number, and role. It excludes
rationale text, evidence/report/private-note content, storage references,
credentials, administrator session IDs in verification history, and unnecessary
personal data.

## Administrator authority

### PlatformAdministratorGrant

Separate one-to-one platform authority; never a company role.

| Field                      | Type/rule                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `id`                       | opaque primary key                                                                      |
| `userId`                   | unique relation to UserAccount                                                          |
| `state`                    | `ACTIVE`, `SUSPENDED`, `REVOKED`, `EXPIRED`                                             |
| `activatedAt`              | required                                                                                |
| `expiresAt`                | nullable; non-null past instant makes grant unusable and transitions to/derives EXPIRED |
| `suspendedAt`, `revokedAt` | nullable lifecycle instants                                                             |
| `provenanceCode`           | non-secret allowlisted out-of-band source code                                          |
| `version`                  | optimistic concurrency integer                                                          |
| `createdAt`, `updatedAt`   | timestamps                                                                              |

Only `ACTIVE` plus unexpired grants authorize the console. Provisioning,
suspension, revocation, and expiry commands are out-of-band and audited; no
React Admin mutation is exposed.

### AdministratorSessionPolicy

Exactly one row per grant.

| Field                  | Type/rule                                              |
| ---------------------- | ------------------------------------------------------ |
| `grantId`              | primary key and relation to PlatformAdministratorGrant |
| `designatedSessionId`  | nullable, unique relation to existing Session          |
| `designatedAt`         | nullable; required with designatedSessionId            |
| `lastTwoFactorProofAt` | nullable; required for admin-authorized designation    |
| `designationVersion`   | concurrency integer                                    |
| `updatedAt`            | timestamp                                              |

Designation transaction locks the grant/policy, verifies the new Session belongs
to the grant's ACTIVE UserAccount, revokes the prior designated Session if
different, sets the new designation/proof time, and writes audit. A step-up only
updates proof time after verifying the same designated Session.

## Company and membership

### Company

Extend the existing model.

| Field                        | Type/rule                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`, existing public fields | retained                                                                                                                        |
| `normalizedTaxIdentifier`    | nullable during migration, then required unique exact 10 ASCII digits for verified companies                                    |
| `verificationState`          | `UNVERIFIED`, `ACTIVE`, `INACTIVE`; Feature 006 approval sets ACTIVE, but does not provide an INACTIVE company lifecycle action |
| `verifiedAt`                 | existing/required when ACTIVE                                                                                                   |
| `verificationStateChangedAt` | lifecycle timestamp                                                                                                             |
| `version`                    | concurrency integer                                                                                                             |

Concurrent establishment locks/uniquely constrains normalizedTaxIdentifier so
only one legal Company is created.

### CompanyMembership

Extend the existing company-scoped relation.

| Field                       | Type/rule                                                |
| --------------------------- | -------------------------------------------------------- |
| `id`, `companyId`, `userId` | existing; unique `(companyId, userId)`                   |
| `role`                      | `OWNER`, `HR_MANAGER`, `RECRUITER`, `HIRING_MANAGER`     |
| `status`                    | extend existing enum to `ACTIVE`, `SUSPENDED`, `REMOVED` |
| `approvedAt`                | most recent approved authority time                      |
| `stateChangedAt`            | last lifecycle transition                                |
| `removedAt`                 | nullable; required for REMOVED                           |
| `version`                   | concurrency integer                                      |
| `createdAt`, `updatedAt`    | existing timestamps                                      |

The role is retained while SUSPENDED/REMOVED for restoration/history. Restore is
SUSPENDED → ACTIVE with the retained approved role. REMOVED → ACTIVE requires a
new valid invitation/verification approval, which may set the newly approved
role. No row is deleted by membership removal.

Last-active-OWNER enforcement locks the Company's active OWNER memberships in
the same transition transaction.

### CompanyAccessPrerequisite

Authoritative input consumed by existing-company verification; producer/UI is a
separate dependency.

| Field                                  | Type/rule                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                                   | opaque reference                                                                     |
| `type`                                 | `INVITATION`, `OWNER_APPROVAL`                                                       |
| `requestId`                            | nullable before a request is bound; OWNER_APPROVAL must bind exact request           |
| `applicantUserId`, `companyId`, `role` | exact scope                                                                          |
| `approvedByOwnerMembershipId`          | required for OWNER_APPROVAL and must reference current active OWNER at decision time |
| `state`                                | `AVAILABLE`, `USED`, `REVOKED`, `EXPIRED`                                            |
| `expiresAt`                            | required for invitation; optional policy value for request-bound OWNER approval      |
| `usedAt`, `usedByRequestId`            | set atomically with approved membership                                              |
| `version`, timestamps                  | concurrency/audit                                                                    |

“Valid” means matching applicant/company/role, AVAILABLE, unexpired, unrevoked,
unused, plus active approving OWNER for OWNER_APPROVAL. There is no bypass when
the producer is unavailable.

## Verification workflow

### RecruiterVerificationRequest

| Field                                                                      | Type/rule                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `id`                                                                       | opaque request reference                                            |
| `applicantUserId`                                                          | Candidate account relation                                          |
| `submittedCompanyName`                                                     | normalized/validated display input                                  |
| `normalizedTaxIdentifier`                                                  | exact FR-025 10-digit canonical value                               |
| `targetCompanyId`                                                          | nullable until match/approval establishes Company                   |
| `requestedRole`                                                            | OWNER for a new Company; approved allowed role for existing Company |
| `prerequisiteId`                                                           | nullable for new Company, required for existing Company approval    |
| `state`                                                                    | workflow enum below                                                 |
| `currentEvidenceId`, `currentSubmissionVersion`                            | current safety-checked version relation/counter                     |
| `resubmissionCount`                                                        | 0–3 inclusive                                                       |
| `assignedAdminUserId`                                                      | nullable current assignment                                         |
| `changesRequestedAt`, `delayedAt`, `expiredAt`, `cancelledAt`, `decidedAt` | lifecycle milestones                                                |
| `viewerUnavailableSince`, `viewerEscalatedAt`, `viewerDelayNotifiedAt`     | continuous outage milestones                                        |
| `version`                                                                  | concurrency integer                                                 |
| `createdAt`, `updatedAt`                                                   | timestamps                                                          |

`assignedAdminUserId` is read-only workload metadata in Feature 006. The admin
queue can filter by a specific value or `UNASSIGNED`, but this feature defines no
assignment transition or mutation endpoint.

At most one active request per applicant and normalized tax identifier across
PENDING_CHECKS, PENDING_REVIEW, CHANGES_REQUESTED, and RESUBMITTED. Terminal
requests do not block a new permitted request.

State transitions:

```text
PENDING_CHECKS -> PENDING_REVIEW | CANCELLED | EXPIRED
PENDING_REVIEW -> CHANGES_REQUESTED | APPROVED | REJECTED | CANCELLED | EXPIRED
CHANGES_REQUESTED -> RESUBMITTED | CANCELLED | EXPIRED
RESUBMITTED -> PENDING_CHECKS  # same transaction as accepted replacement

APPROVED | REJECTED | CANCELLED | EXPIRED are terminal
```

- only applicant command causes CANCELLED from the three allowed non-terminal
  states;
- PENDING_CHECKS delay/expiry milestones are 15 minutes/24 hours;
- continuously unavailable cleared evidence blocks decisions, escalates at 15
  minutes, notifies at 24 hours, and expires PENDING_REVIEW at 72 hours;
- unanswered CHANGES_REQUESTED expires at 30 calendar days;
- concurrent cancel/decision/resubmit accepts only one reviewed version.

### BusinessLicenseEvidence

| Field                                                             | Type/rule                                  |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `id`, `requestId`, `submissionVersion`                            | version identity; unique request/version   |
| `declaredMediaType`, `detectedMediaType`                          | PDF/PNG/JPEG allowlist agreement           |
| `byteSize`                                                        | 1–5,000,000 inclusive                      |
| `sourceSha256`                                                    | integrity/dedupe; not exposed              |
| `storageAdapter`, `storageLocator`                                | private server-only locator                |
| `encryptionKeyVersion`, `iv`, `authenticationTag`                 | encrypted envelope; never API output       |
| `malwareStatus`, `typeStatus`, `structureStatus`, `previewStatus` | `PENDING`, `PASS`, `FAIL`, `INDETERMINATE` |
| `reviewableAt`                                                    | set only after all four PASS               |
| `contentInaccessibleAt`, `deleteAfter`, `deletedAt`               | retention lifecycle                        |
| `supersededAt`                                                    | prior version marker                       |
| `createdAt`, `updatedAt`                                          | timestamps                                 |

Evidence access service never returns locator/encryption fields. Derived previews
are separate encrypted artifacts with the same request/version/purpose and no
longer retention than their source.

### VerificationSafetyAttempt

Durable worker attempt/lease with evidence ID, four safe status results,
scanner/type/structure/preview policy versions, started/completed times,
non-sensitive failure code, lease owner/expiry, and attempt count. Contains no
document content or provider error body.

### VerificationDecisionHistory

Append-only request history with request ID, submission version, actor
administrator reference, prior/result state, decision kind, rejection category,
approved role, decision result, timestamp, and correlation ID. Excludes evidence,
private note, credentials, and administrator Session ID.

Private review notes use FR-048 normalization, maximum 2,000 characters, and a
separate restricted record rather than AuditEvent context.

## Moderation

### ModerationReport

Generalized authority replacing the existing JobReport storage after migration.

| Field                                                        | Type/rule                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `id`                                                         | preserves existing job-report reference during migration              |
| `reporterUserId`                                             | reporter account relation                                             |
| `targetType`                                                 | `JOB`, `COMPANY`, `RECRUITER_MEMBERSHIP`, `CANDIDATE`                 |
| `targetReference`                                            | opaque target reference                                               |
| `companyId`, `jobPostingId`, `applicationId`, `membershipId` | nullable qualifying context as applicable                             |
| `category`                                                   | seven exact FR-048 categories                                         |
| `priority`                                                   | derived/persisted `CRITICAL`, `HIGH`, `NORMAL` under versioned policy |
| `detail`                                                     | normalized optional plain text, maximum 2,000; OTHER minimum 10       |
| `normalizationVersion`                                       | exact policy version; legacy rows retain migration provenance         |
| `status`                                                     | `PENDING_REVIEW`, `RESOLVED`, `DISMISSED`                             |
| `assigneeAdminUserId`                                        | nullable                                                              |
| `unresolvedKey`                                              | nullable unique digest for reporter/target/category while pending     |
| `resolvedAt`, `dismissedAt`                                  | terminal timestamp                                                    |
| `version`, `createdAt`, `updatedAt`                          | concurrency/timestamps                                                |

Legacy category mapping is deterministic:

| Existing JobReportReason | Moderation category                                       |
| ------------------------ | --------------------------------------------------------- |
| `FRAUD`                  | `FRAUD_OR_IMPERSONATION`                                  |
| `MISLEADING`             | `MISLEADING_CONTENT`                                      |
| `DUPLICATE`              | `SPAM_OR_DUPLICATE`                                       |
| `DISCRIMINATORY`         | `DISCRIMINATION_OR_HARASSMENT`                            |
| `INAPPROPRIATE`          | `OTHER` with content-free legacy-category history context |
| `OTHER`                  | `OTHER`                                                   |

Existing bounded plain-text detail is preserved; rendering applies the current
safe plain-text component. No migration triggers enforcement.

State transitions:

```text
create -> PENDING_REVIEW
PENDING_REVIEW -> RESOLVED | DISMISSED
# assignment, investigation note, enforcement link: state unchanged
# terminal states have no outgoing transition
```

### ModerationReportHistory

Append-only actor/action/prior-result state/result/timestamp/correlation history.
It preserves only target type/reference and applicable originating
job/application/company reference, never copied display name, email, report text,
private note, or deleted profile content.

### ModerationPrivateNote

Append-only or versioned restricted note linked to report and actor, normalized
per FR-048 and limited to 2,000 characters. It is absent from queue rows, audit,
reporter/target projections, URLs, and ordinary logs.

### ReportAdmissionEvent

Content-free accepted-report event keyed by reporter and acceptedAt, plus safe
target/category digests. Supports the rolling 10-per-account/24-hour quota and
exact retry duration. The unresolved unique key on ModerationReport plus a
transactional 24-hour lookup prevents same reporter/target/category duplicates.
All sessions aggregate by reporterUserId.

## Administration operations

### PrivilegedActionRationale

| Field                                                 | Type/rule                                                 |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `id`, `correlationId`                                 | unique link to audit/business action                      |
| `actorAdminUserId`, `targetType`, `targetReference`   | authorization context                                     |
| `ciphertext`, `keyVersion`, `iv`, `authenticationTag` | normalized 10–500-character encrypted rationale           |
| `availableUntil`                                      | exactly action timestamp + 365 calendar days              |
| `contentInaccessibleAt`                               | set at availableUntil                                     |
| `deleteAfter`                                         | same as availableUntil; physical deletion due immediately |
| `deletedAt`, `deleteAttempts`, `safeFailureCode`      | cleanup evidence                                          |
| `createdAt`                                           | action timestamp                                          |

Only current Platform Administrator + designated Session + proof age ≤15 minutes
can read decrypted content. Audit and notification reference correlation ID, not
this content.

### SecurityNotificationWork

| Field                            | Type/rule                                                            |
| -------------------------------- | -------------------------------------------------------------------- |
| `id`, `idempotencyKey`           | unique work identity                                                 |
| `originatingCorrelationId`       | action link                                                          |
| `targetUserId`, `kind`           | affected user/action; no rationale text                              |
| `payloadRef`                     | encrypted/safe template data with state/time/company when applicable |
| `status`                         | `PENDING`, `RETRYING`, `DELIVERED`, `MANUAL_INTERVENTION_REQUIRED`   |
| `attemptCount`                   | 0–5                                                                  |
| `lastAttemptAt`, `nextAttemptAt` | nullable schedule instants                                           |
| `deliveryDeadline`               | action commit + 24 hours                                             |
| `failureCategory`                | exact FR-022 allowlist                                               |
| `createdAt`, `updatedAt`         | timestamps                                                           |

Retry schedule after failure: immediate, +1 minute, +5 minutes, +30 minutes,
+2 hours. Permanent failures skip remaining attempts and enter manual
intervention. Attempt 5 failure or deadline also enters manual intervention.
Originating action state never references notification delivery as a rollback
condition after commit.

Rows are created for account suspension/reinstatement, all-session revocation,
and administrator-driven membership suspension/restoration/removal. A
single-session revocation and moderation-only assignment/note/terminal/link
command creates no SecurityNotificationWork. Verification
approval/request-changes/rejection uses applicant Notification Work with the
FR-037 content boundary. A report-linked account/membership enforcement action
uses its underlying action row and does not create a duplicate notification.

### Applicant Notification Work (existing `EmailOutbox`)

Feature 006 reuses the existing durable `EmailOutbox` rather than creating a
second applicant-delivery queue. A verification notification row contains its
existing unique idempotency key, applicant recipient relation, typed template
kind/payload, delivery state, attempt metadata, and timestamps. The payload is
limited to the FR-037 resulting state, decision/event time, and next available
applicant action.

Exactly one row is created for each accepted submission or resubmission receipt,
applicant cancellation, administrator request-changes/rejection/approval, and
worker delay/expiry milestone. Its idempotency key is derived from the immutable
verification request reference, submission version or lifecycle milestone,
resulting state, and notification kind. The originating request transition,
decision history and audit when required, and outbox row MUST commit in the same
PostgreSQL transaction. A retry, concurrent reviewer, recovered worker lease,
or deadline reconciliation therefore returns the existing outcome and cannot
create a second row.

These rows use the existing email-worker delivery policy. They are not
`SecurityNotificationWork`, do not expose FR-022 delivery fields in account or
audit views, and delivery failure after commit never reverses verification
state, company state, or membership authority.

### AdminCommandReceipt

Stores actor Session/grant subject digest, command kind, target reference,
idempotency key, normalized body digest, result code, resulting version,
correlation ID, and timestamps. Unique actor + idempotency key prevents replay;
reuse with another body/target is rejected. Contains no rationale/document/report
text.

### AdminDashboardSnapshot

| Field                    | Type/rule                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| `id`                     | snapshot reference                                                   |
| `calculatedAt`           | authoritative computation time                                       |
| `expiresAt`              | calculatedAt + 60 seconds                                            |
| `stateDefinitionVersion` | shared metric/filter rules version                                   |
| `metrics`                | validated counts with key, integer count, unit, canonical filter key |
| `calculationDurationMs`  | performance evidence                                                 |
| `createdAt`              | persistence time                                                     |

Snapshots are immutable. Worker creates every 30 seconds and cleanup retains only
the operational/audit window selected in implementation policy; the API never
returns an expired snapshot as a current count.

## Relationships

```text
UserAccount 1---1 CandidateIdentity
UserAccount 1---0..1 PlatformAdministratorGrant
PlatformAdministratorGrant 1---1 AdministratorSessionPolicy
AdministratorSessionPolicy 0..1---1 Session (designated)
UserAccount 1---* Session
UserAccount 1---* CompanyMembership *---1 Company

UserAccount 1---* RecruiterVerificationRequest
RecruiterVerificationRequest *---0..1 Company
RecruiterVerificationRequest 1---* BusinessLicenseEvidence
RecruiterVerificationRequest 0..1---1 CompanyAccessPrerequisite
RecruiterVerificationRequest 1---* VerificationDecisionHistory

UserAccount 1---* ModerationReport
ModerationReport 1---* ModerationReportHistory
ModerationReport 1---* ModerationPrivateNote

AuditEvent 1---0..1 PrivilegedActionRationale (correlation only)
AuditEvent 1---0..1 SecurityNotificationWork (correlation only)
RecruiterVerificationRequest 1---* EmailOutbox (verification lifecycle correlation)
```

## Migration and integrity gates

1. Add new enums/tables with no automatic administrator grants.
2. Add Company normalizedTaxIdentifier nullable; backfill only from verified
   authoritative facts, reject duplicate/conflicting values for manual resolution,
   then enforce unique/not-null for active verified companies.
3. Add `REMOVED`, version, and lifecycle fields to CompanyMembership without
   changing existing ACTIVE/SUSPENDED authority.
4. Backfill ModerationReport from JobReport with stable IDs and category mapping;
   compare counts/statuses/references before switching writers/readers.
5. Create no CompanyAccessPrerequisite rows without an authoritative producer.
6. Add indexes for all specified filters/orders and worker claims, including
   account state/created order, membership user/company/role/status, request
   state/age/tax/applicant/assignee, report priority/state/company/assignee/age,
   notification status/next attempt/deadline, and rationale deleteAfter.
7. Migration verification proves no Session token, factor secret, Candidate
   Profile/CV, job/application state, or existing audit record is altered.

## SmartHire Support Center Extension

### SupportConversation

- `id`: opaque case reference.
- `requesterUserId`: immutable ACTIVE account owner.
- `category`: `ACCOUNT_ACCESS | PROFILE | JOBS_APPLICATIONS | RECRUITER | MESSAGING | PRIVACY_SAFETY | OTHER`.
- `subject`: normalized requester-visible text, 5–120 characters.
- `state`: `OPEN | WAITING_FOR_USER | WAITING_FOR_SUPPORT | RESOLVED | CLOSED`.
- `version`, `nextMessageSequence`, `lastMessageAt`.
- `currentAssigneeUserId`: nullable Platform Administrator reference, never projected to requester.
- `resolvedAt`, `closedAt`, `contentDeleteAfter`, `contentDeletedAt`, `createdAt`, `updatedAt`.

Indexes support requester activity, admin state/age/assignment ordering, and retention claims. `CLOSED` is terminal. `RESOLVED` reopens only through a requester message strictly before `resolvedAt + 7 days`; otherwise a guarded worker transition closes it.

### SupportMessage

- `id`, `conversationId`, monotonic `sequence`.
- `senderKind`: `REQUESTER | ADMINISTRATOR`.
- `senderUserId`, UUID `clientOperationId`, normalized 1–4,000-character `content`, `createdAt`.

Uniqueness on `(conversationId, sequence)` and `(senderUserId, clientOperationId)` prevents duplicate visible messages. A case row lock allocates sequence and applies the matching state transition in one transaction.

### SupportAssignment

- `id`, `conversationId`, `assigneeAdminUserId`, `assignedByAdminUserId`.
- `assignedAt`, nullable `endedAt` and `endReason`: `REASSIGNED | AUTHORITY_LOST | CASE_CLOSED`.

A partial unique index permits one row with `endedAt IS NULL` per conversation. `currentAssigneeUserId` equals the active row and changes in the same transaction.

### SupportInternalNote

- `id`, `conversationId`, `authorAdminUserId`, normalized 1–2,000-character `normalizedText`, `createdAt`.
- No requester repository method selects this entity.

### SupportConversationHistory

- `id`, `conversationId`, `actorUserId`, `action`, `priorState`, `resultingState`, `resultingVersion`, `occurredAt`.
- Optional content-free assignment references and reason category are administrator-only.
- Message, subject, note, email, and session content are forbidden.

### State transitions

```text
create + initial requester message -> WAITING_FOR_SUPPORT
requester message                 -> WAITING_FOR_SUPPORT
assigned administrator reply      -> WAITING_FOR_USER
assigned administrator resolve    -> RESOLVED
requester reply before deadline   -> WAITING_FOR_SUPPORT
worker after deadline             -> CLOSED
assigned administrator close      -> CLOSED
CLOSED                             -> terminal
```

### Retention and isolation

Closing sets `contentDeleteAfter = closedAt + 365 days`. A bounded worker deletes SupportMessage and SupportInternalNote rows, sets `contentDeletedAt`, and appends content-free evidence. No Support entity relates to MessagingConversation or MessagingMessage. Realtime carries only case ID, version, state, and change kind.
