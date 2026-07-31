# Data Model: Candidate Profile and Account Management

The authoritative schema remains `web/prisma/schema.prisma`, with reviewed
Prisma Migrate SQL under `web/prisma/migrations/`. PostgreSQL 16.12 is the only
production database. This feature extends the Feature 001 identity schema; it
does not duplicate `UserAccount`, Better Auth credentials, or Better Auth
sessions.

All IDs are server-generated opaque strings. All timestamps are UTC
`timestamptz` unless a field is explicitly a PostgreSQL `date`.

## Enums

### New enums

- `PreferenceLanguage`: `VI`, `EN` (mapped to API values `vi`, `en`)
- `EmailChangeStatus`: `PENDING`, `SUPERSEDED`, `CONSUMED`, `EXPIRED`,
  `CONFLICTED`
- `PasswordChangeOperationStatus`: `INTENT_RECORDED`, `PASSWORD_UPDATED`,
  `OTHER_SESSIONS_REVOKED`, `FAILED_RETRYABLE`, `FINALIZED`
- `PasswordChangeFailureCode`: `PASSWORD_UPDATE_FAILED`,
  `SESSION_REVOCATION_FAILED`, `SESSION_VERIFICATION_FAILED`,
  `NOTIFICATION_ENQUEUE_FAILED`, `AUDIT_FINALIZATION_FAILED`,
  `OPERATION_FINALIZATION_FAILED`

### Existing enum extensions

- Add `EMAIL_CHANGE_VERIFY` to `EmailKind`.
- Continue using `SECURITY_ALERT` for the old-address email-change notice.
- Continue using `PASSWORD_CHANGED` for password-change confirmation.

No session, credential, role, or account-state enum is introduced by this
feature.

## Existing Models Extended

### UserAccount (`user`)

`UserAccount` remains the authoritative account identity and Better Auth user
row.

Existing fields used here:

| Field | Feature 002 rule |
|---|---|
| `id` | Server-session-derived account identity; never accepted from a browser mutation |
| `name` | NFKC-normalized/sanitized Unicode plain text; 1–150 non-whitespace characters |
| `email` | Currently effective display/login email |
| `normalizedEmail` | Currently effective comparison key; unique |
| `emailVerified` | Remains true after a verified email change |
| `state` | Must be `ACTIVE` for all Feature 002 reads and writes |
| `createdAt` | Read-only account metadata |

New relations:

- optional one-to-one `preferences`
- many `emailChangeRequests`
- optional one-to-one `passwordChangeAttemptWindow`
- many `passwordChangeOperations`

The existing registration validator may keep its narrower 120-character name
limit, but the database constraint must permit the Feature 002 identity limit
of 150. Account name and email are not copied into CandidateProfile.

### CandidateIdentity

Add a required one-to-one relation to `CandidateProfile`. The migration
backfills one empty profile for every existing CandidateIdentity, and future
registration creates both rows in the existing account-creation transaction.
`CandidateIdentity.userId` remains the base Candidate key.

### EmailOutbox

Add:

| Field | Rule |
|---|---|
| `recipientCiphertext` | Nullable purpose-separated AES-256-GCM protected recipient snapshot |
| `recipientPurpose` | Nullable allowlisted purpose/version used as authenticated encryption context |

`recipientRef` remains a logical reference such as a user or email-change
request ID. The worker uses `recipientCiphertext` when present and otherwise
uses the existing UserAccount relation. It never writes a decrypted recipient
to logs or audit context.

Email-change proof ciphertext remains an allowlisted, sealed value in
`payloadRef`; no raw proof or full URL is stored. Existing outbox leasing,
idempotency, and retry fields are unchanged.

### AuditEvent

The table shape is unchanged. Extend the server allowlist with:

- `email_change.requested`
- `email_change.rejected`
- `email_change.superseded`
- `email_change.verified`
- `email_change.verification_failed`
- `password_change.intent_recorded`
- `password_change.succeeded`
- `password_change.failed`
- `password_change.locked`

Add `email_change` and `password_change` target types. Every event carries the
existing actor, action, target, result, timestamp, correlation ID, and
privacy-protected `ipPrefixDigest`. Context is allowlisted and excludes names,
emails, profile text, passwords, proofs, URLs, session tokens, raw IPs, and
request bodies.

### Better Auth Models

`AuthProviderAccount` remains the only credential record. `Session` remains the
only authenticated browser-session record. `PasswordChangeOperation` references
their logical IDs but does not duplicate passwords, hashes, cookies, tokens, or
session state.

## New Profile Models

### CandidateProfile

One aggregate root per CandidateIdentity.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `candidateUserId` | Unique FK to `CandidateIdentity.userId` |
| `headline` | Nullable sanitized plain text, maximum 200 characters |
| `summary` | Nullable sanitized plain text, maximum 5,000 characters |
| `phone` | Nullable sanitized display value, maximum 32 characters and 7–15 digits |
| `location` | Nullable sanitized plain text, maximum 160 characters |
| `revision` | Non-negative integer, default 0, incremented once per accepted section save |
| `createdAt`, `updatedAt` | Server timestamps |

Relations: ordered experiences, education entries, profile-skill associations,
and social links.

There is deliberately no `complete`, `completionPercent`, eligibility, public,
or recruiter-visibility field. A row with all optional fields null and no
children is a valid empty profile.

### ProfileExperience

| Field | Rule |
|---|---|
| `id` | Primary key, stable across edits |
| `profileId` | FK to CandidateProfile, cascade on profile hard deletion |
| `title` | Required sanitized text, 1–200 characters |
| `company` | Required sanitized text, 1–200 characters |
| `description` | Nullable sanitized text, maximum 3,000 characters |
| `startDate` | PostgreSQL `date`; required and not later than the service clock's current date |
| `endDate` | Nullable PostgreSQL `date` |
| `isCurrent` | Required boolean |
| `position` | Zero-based integer ordering within the profile |
| `createdAt`, `updatedAt` | Server timestamps |

Constraints:

- unique `(profileId, position)`;
- `position` from 0 through 49;
- current rows require `endDate IS NULL`;
- non-current rows require `endDate IS NOT NULL` and
  `endDate >= startDate`;
- non-future start/end rules are enforced with the injected service Clock,
  because a time-dependent PostgreSQL CHECK would not remain immutable.

### ProfileEducation

| Field | Rule |
|---|---|
| `id` | Primary key, stable across edits |
| `profileId` | FK to CandidateProfile, cascade on profile hard deletion |
| `institution` | Required sanitized text, 1–200 characters |
| `degree` | Required sanitized text, 1–200 characters |
| `field` | Nullable sanitized text, maximum 200 characters |
| `startDate` | PostgreSQL `date`; required and not future |
| `endDate` | Nullable PostgreSQL `date`; may be a future expected completion only when current |
| `isCurrent` | Required boolean |
| `position` | Zero-based integer ordering within the profile |
| `createdAt`, `updatedAt` | Server timestamps |

Constraints:

- unique `(profileId, position)`;
- `position` from 0 through 49;
- all provided end dates satisfy `endDate >= startDate`;
- non-current rows require a non-null, non-future end date;
- current rows may omit end date or use a future expected completion.

### Skill

Reusable catalog record.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `name` | Sanitized catalog display label, 1–80 characters |
| `normalizedName` | Unique normalized comparison key |
| `createdAt`, `updatedAt` | Server timestamps |

`normalizedName` applies NFKC, surrounding-whitespace removal, internal
whitespace collapse, and locale-independent lowercase. It preserves
Vietnamese diacritics. Concurrent creation uses `INSERT ... ON CONFLICT` or a
Prisma unique-conflict retry.

### CandidateProfileSkill

Ordered many-to-many association.

| Field | Rule |
|---|---|
| `profileId` | FK to CandidateProfile |
| `skillId` | FK to Skill |
| `displayName` | Sanitized 1–80-character capitalization selected for this profile |
| `position` | Zero-based order from 0 through 49 |
| `createdAt`, `updatedAt` | Server timestamps |

Primary key `(profileId, skillId)`. Unique `(profileId, position)`. Deleting a
profile cascades associations but does not delete shared Skill rows. Orphaned
catalog skills may be removed only by a separate retention-safe cleanup, not
during an aggregate save.

### SocialLink

| Field | Rule |
|---|---|
| `id` | Primary key, stable across edits |
| `profileId` | FK to CandidateProfile, cascade on profile hard deletion |
| `url` | Validated `http`/`https` display URL, maximum 2,048 characters |
| `normalizedUrl` | Canonical WHATWG serialization used for comparison |
| `position` | Zero-based order from 0 through 9 |
| `createdAt`, `updatedAt` | Server timestamps |

Unique `(profileId, normalizedUrl)` and `(profileId, position)`. URLs with a
username/password or any non-web scheme are invalid.

## New Account Models

### AccountPreferences

One optional persisted row per UserAccount. Absence is represented externally
by the specified defaults and does not require a read-time insert.

| Field | Rule |
|---|---|
| `userId` | Primary key/FK to UserAccount |
| `language` | `VI` or `EN`, default `VI` |
| `timezone` | Validated IANA identifier, default `Asia/Ho_Chi_Minh` |
| `applicationUpdatesEmail` | Boolean, default true |
| `jobRecommendationsEmail` | Boolean, default true |
| `accountSecurityEmail` | Boolean, default true and database CHECK requiring true |
| `createdAt`, `updatedAt` | Server timestamps |

If a stored timezone later becomes unsupported, reads still return it with a
`timezoneSupported: false` projection. A full-set update may preserve that
exact unchanged legacy value while changing another preference, but a newly
selected timezone must validate in the current runtime.

### EmailChangeRequest

Temporary proposed-email reservation and proof lifecycle.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `userId` | FK to UserAccount |
| `proposedEmail` | Canonical display value |
| `normalizedProposedEmail` | Comparison/reservation key |
| `tokenDigest` | Unique keyed digest; never plaintext |
| `status` | EmailChangeStatus, default `PENDING` |
| `expiresAt` | Exactly creation time plus 30 minutes |
| `consumedAt` | Set only on successful verification |
| `supersededAt` | Set when a newer request replaces it |
| `resolvedAt` | Set when it becomes expired or conflicted |
| `idempotencyKey` | Opaque browser retry identity, unique with userId |
| `correlationId` | Server correlation identity shared by the request's audit/outbox intents |
| `verificationOutboxId` | Unique nullable reference to the verification job |
| `oldEmailNoticeOutboxId` | Unique nullable reference to the security notice |
| `createdBySessionId` | Logical initiating Better Auth session ID; no token and no FK |
| `createdAt`, `updatedAt` | Server timestamps |

PostgreSQL migration indexes:

- unique `tokenDigest`;
- unique `(userId, idempotencyKey)`;
- partial unique `userId WHERE status = 'PENDING'`;
- partial unique `normalizedProposedEmail WHERE status = 'PENDING'`;
- index `(status, expiresAt)`;
- index `(userId, createdAt DESC)`.

Because partial indexes cannot use the moving current time, request and
verification transactions mark matching expired rows `EXPIRED` while holding
the normalized-email claim lock before creating or consuming a reservation.

The proposed email is personal data but is required in normalized form for the
cross-table uniqueness rule. It follows the existing privacy, retention, and
deletion policy. The raw proof and complete verification URL are never fields.

### PasswordChangeAttemptWindow

One row per account only after the first incorrect current-password attempt.

| Field | Rule |
|---|---|
| `userId` | Primary key/FK to UserAccount |
| `failureTimestamps` | Bounded PostgreSQL timestamp array containing at most five relevant failures |
| `lockedUntil` | Nullable; set to 15 minutes after the fifth failure in the rolling window |
| `updatedAt` | Server timestamp |

Every read/update is serialized by an account-scoped transaction lock. Before
append, remove timestamps older than 15 minutes. Only Better Auth's
`currentPasswordValid = false` result appends. Successful password change
clears the array and lock. Old empty rows may be deleted by cleanup.

### PasswordChangeOperation

Durable idempotent orchestration record; not a credential store.

| Field | Rule |
|---|---|
| `id` | Primary key |
| `userId` | FK to UserAccount |
| `idempotencyKey` | Browser-generated opaque request identity; unique with userId |
| `submissionBindingDigest` | Keyed digest binding operation ID/user/new submission for safe retries; not a password verifier |
| `initiatingSessionId` | Server-derived logical Better Auth session ID, never client supplied |
| `status` | PasswordChangeOperationStatus |
| `passwordUpdatedAt` | Nullable milestone |
| `otherSessionsRevokedAt` | Nullable milestone, set only after a database verification query |
| `notificationIdempotencyKey` | Unique stable outbox key |
| `notificationOutboxId` | Unique nullable reference |
| `finalAuditId` | Unique nullable audit identity |
| `failureCode` | Nullable allowlisted PasswordChangeFailureCode |
| `retryAt` | Nullable bounded retry time |
| `finalizedAt` | Nullable completion time |
| `createdAt`, `updatedAt` | Server timestamps |

Unique `(userId, idempotencyKey)`, unique `notificationIdempotencyKey`, and
indexes `(userId, status)` and `(status, retryAt)`.

The row never stores current/new passwords, Better Auth password hashes,
cookies, session tokens, request bodies, raw IPs, or email addresses. A retry
must present the same idempotency key and matching keyed submission binding.

## Aggregate Validation and Ownership

1. Every repository method receives `userId` and `sessionId` only from
   `requireSession`.
2. Browser schemas are strict and reject `userId`, `accountId`, `profileId`, or
   unexpected properties.
3. Every supplied experience, education, social-link, or existing association
   ID is verified against the caller's profile before mutation. A shared
   catalog Skill ID is not account-owned, but it must resolve to the same
   normalized submitted label. Missing and foreign owned IDs return the same
   safe error.
4. Each section array order becomes the contiguous `position` sequence.
5. Counts are validated before any write: 50 skills, 50 experiences, 50
   education rows, and 10 links maximum.
6. Sanitization and all semantic validation complete before repository writes.

## State Transitions

### EmailChangeRequest

| From | To | Trigger |
|---|---|---|
| none | `PENDING` | Recent-authenticated request reserves a unique proposed email and commits both outbox rows |
| `PENDING` | `SUPERSEDED` | Same account creates a newer request |
| `PENDING` | `EXPIRED` | Expiry is observed by request, verification, or cleanup |
| `PENDING` | `CONSUMED` | Latest proof verifies and UserAccount email changes atomically |
| `PENDING` | `CONFLICTED` | Proposed email is no longer uniquely available at proof consumption |

All other transitions are invalid. Proof consumption is a conditional update
from `PENDING` and succeeds once.

### PasswordChangeOperation

```text
INTENT_RECORDED
  -> PASSWORD_UPDATED
  -> OTHER_SESSIONS_REVOKED
  -> FINALIZED
```

Any incomplete provider/persistence milestone may record `FAILED_RETRYABLE`;
the retry resumes the first incomplete milestone and returns to its
corresponding forward state. `FINALIZED` is terminal. Only `FINALIZED` produces
a completed browser outcome.

## Transaction and Concurrency Boundaries

### Profile section save

1. Validate and sanitize the complete section in memory.
2. Begin transaction and select the caller's CandidateProfile `FOR UPDATE`.
3. Compare `baseRevision`; retain a stale flag but do not reject.
4. Verify all existing nested IDs are owned by the locked aggregate.
5. Upsert/update/delete/reorder only the selected section.
6. Increment `revision` once and commit.
7. Return the complete aggregate, new revision, normalization warnings, and
   `conflictApplied`.

A repository failure rolls back the section and revision together.

### Email-change request

1. Require ACTIVE Better Auth session, CSRF, recent-auth proof, valid new email,
   and protected network source.
2. Begin transaction, lock UserAccount, and take the normalized-email advisory
   claim lock.
3. Mark matching expired reservations and recheck both UserAccount effective
   emails and pending reservations.
4. Supersede this user's prior pending request.
5. Create request, sealed verification proof payload, protected new/old
   recipient snapshots, two idempotent outbox rows, and accepted audit event.
6. Commit before returning `202`; provider delivery is never awaited.

Rejected outcomes append their required audit event without storing the email.

### Email-change verification

1. Digest the body proof; never query/log by plaintext.
2. Begin transaction and lock the matching request and its UserAccount.
3. Require latest `PENDING`, unexpired, unconsumed request.
4. Take the proposed normalized-email advisory lock and recheck uniqueness.
5. Update `UserAccount.email` and `normalizedEmail`, keep
   `emailVerified = true`, mark request `CONSUMED`, and append audit.
6. Commit once. A concurrent or repeated consumer receives the same safe
   failure family and cannot mutate identity.

### Password change

1. Validate proposed-password fields and policy without changing the failure
   window.
2. Load by authenticated user plus idempotency key. A matching existing
   operation must have the same submission binding and the authoritative
   current session must equal its server-recorded `initiatingSessionId`; it
   resumes its first incomplete milestone and does not start a new attempt.
3. Only when no operation exists, lock/read the attempt window and reject while
   `lockedUntil > now`.
4. For that new operation, Better Auth classifies current validity and reuse.
   Reuse is validation; only incorrect current password appends a failure and
   audit atomically. Persist the operation intent before calling Better Auth.
5. Better Auth changes the credential while retaining the initiating session.
   Ambiguous responses converge by verifying the submitted new password.
6. Better Auth revokes other sessions using the authoritative current cookie
   only after it matches `initiatingSessionId`; repository verification must
   find zero other usable sessions.
7. One PostgreSQL transaction snapshots the current effective email, creates
   the idempotent outbox row and final audit, clears the attempt window, and
   finalizes the operation.

For an existing retry, a new password that already matches the credential
proves the ambiguous password milestone; it is not treated as a new
current-password-reuse error. An existing operation may resume mandatory
session/outbox/audit cleanup even if another later attempt activated the
account lock. No completed response is returned before step 7 commits.

## Migration and Deletion Safety

1. Add new enums/tables/nullable EmailOutbox columns without rewriting existing
   identity rows.
2. Backfill exactly one empty CandidateProfile for every CandidateIdentity and
   verify counts before adding/enforcing the required one-to-one invariant.
3. Update registration to create CandidateProfile and to participate in the
   normalized-email advisory-lock protocol.
4. Add unique, partial unique, ordering, length, and invariant constraints only
   after backfill/duplicate checks.
5. Add enum values with forward-compatible reviewed SQL; never edit an applied
   Feature 001 migration.
6. Roll forward on failure; restore from a tested backup if the backfill cannot
   be corrected safely.

Candidate profile children cascade only when the profile is physically removed
by the approved retention/deletion process. Shared Skill rows do not cascade
from one profile. UserAccount soft deletion continues to make all Feature 002
data inaccessible immediately while preserving required audit/legal records.
