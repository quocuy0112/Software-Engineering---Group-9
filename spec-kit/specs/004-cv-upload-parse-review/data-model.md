# Data Model: CV Upload, Parse, and Review

The authoritative schema remains `web/prisma/schema.prisma`, with one reviewed
forward migration under `web/prisma/migrations/008_cv_upload_parse_review/`.
PostgreSQL 16.12 is the sole relational authority. Source files and extracted
text are encrypted private-storage artifacts; they are never stored in JSONB or
ordinary database text fields.

All identifiers are server-generated opaque strings. All timestamps are UTC
`timestamptz`. All byte counts are non-negative `bigint`. Browser requests never
provide an account, profile, storage, scanner, or provider identifier.

## Enums

### `CvDocumentKind`

- `PDF`
- `DOCX`

### `CvParserClass`

- `DETERMINISTIC_INTERNAL` -- local/test only; production startup rejects it
- `EXTERNAL_OPENAI` -- production only after the exact consent/deployment gate

The browser may select only an enabled class returned by the status resource;
it cannot submit a provider URL or arbitrary model.

### `CvUploadStatus`

- `AWAITING_CONTENT`
- `VALIDATION_QUEUED`
- `SCAN_QUEUED`
- `SCANNING`
- `EXTRACTION_QUEUED`
- `EXTRACTING`
- `AWAITING_CONSENT`
- `PARSE_QUEUED`
- `PARSING`
- `REVIEW_READY`
- `VALIDATION_FAILED`
- `INFECTED`
- `SCAN_FAILED`
- `EXTRACTION_FAILED`
- `PARSE_FAILED`
- `CONFIRMED`
- `CANCELLED`
- `DELETED`
- `EXPIRED`

This is the aggregate state exposed as a safe browser status. Detailed attempts
remain in stage-specific rows.

### `CvArtifactKind`

- `SOURCE_DOCUMENT`
- `EXTRACTED_TEXT`

### `CvArtifactStatus`

- `QUARANTINED`
- `AVAILABLE`
- `DELETE_PENDING`
- `DELETING`
- `DELETED`
- `DELETE_FAILED`

### `CvScanStatus`

- `QUEUED`
- `PROCESSING`
- `CLEAN`
- `INFECTED`
- `INDETERMINATE`
- `CANCELLED`

### `CvExtractionStatus`

- `QUEUED`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

### `CvParseStatus`

- `QUEUED`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

### `CvParseTrigger`

- `INITIAL`
- `AUTOMATIC_RETRY`
- `CANDIDATE_RETRY`

### `CvRetryStage`

- `SCAN`
- `PARSE`

### `CvDraftStatus`

- `EDITABLE`
- `CONFIRMED`
- `DELETED`
- `EXPIRED`

### `CvConsentAction`

- `GRANTED`
- `REVOKED`

## Existing Models Extended

### `UserAccount` (`user`)

Add relations only:

- optional one-to-one `cvQuota`
- many `cvUploads`
- many `cvParseJobs`
- many `cvRetryRequests`
- many `cvConsentEvents`
- many `cvConfirmations`

The existing Better Auth user/session ownership and `ACTIVE` account check stay
authoritative. Feature 004 does not add credentials, roles, or sessions.

### `CandidateProfile`

Add relations only:

- many `cvDrafts`
- many `cvConfirmations`

The existing `revision` remains the concurrency token. Confirmation increments
it exactly once regardless of how many selected sections or entries are applied.
No parser-owned field is added to Candidate Profile.

### `AuditEvent`

Extend the code/action allowlist with non-content outcomes for upload
acceptance/rejection, safe malware-scan result, parsing completion/failure/retry,
draft confirmation, consent grant/revocation, expiry, candidate deletion or
cancellation, and retention deletion. Metadata may contain opaque record IDs, action/field
names, counts, versions, safe error codes, and revisions. It must not contain
filenames, CV values, source snippets, digests, object locators, prompts,
provider responses, tokens, or consent text.

## New Models

## `CvAccountQuota`

One lock row per account, created lazily on the first import attempt.

| Field                    | Rule                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `accountId`              | Primary key and FK to `UserAccount.id`, cascade on hard account deletion      |
| `reservedBytes`          | Outstanding source/extracted artifact allowance not yet converted or released |
| `retainedBytes`          | Sum of physical source and extracted artifact plaintext sizes not yet deleted |
| `createdAt`, `updatedAt` | Server timestamps                                                             |

Admission locks this row and queries the same account's `CvUpload.createdAt`
within the injected-clock rolling hour. It rejects the sixth admitted attempt,
more than ten non-deleted imports, or more than 50 MiB combined reserved plus
retained bytes. The initial reservation is `declaredBytes + 512 KiB`, covering
the source and maximum extracted-text artifact, and commits with upload creation.
Source finalization atomically moves actual source bytes from reserved to
retained usage while preserving extraction headroom. Extraction success moves
its actual output bytes and releases unused headroom; terminal extraction or
no-content cleanup releases the remainder. Bytes leave retained accounting only
when physical artifact deletion is confirmed.

Checks:

- `reservedBytes >= 0`
- `retainedBytes >= 0`
- `reservedBytes + retainedBytes <= 50 MiB`; every conversion/release is checked
  and idempotent

## `CvUpload`

Aggregate root for one candidate import.

| Field                        | Rule                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `id`                         | Primary key                                                                         |
| `accountId`                  | FK to the owning `UserAccount`; denormalized for every ownership query              |
| `profileId`                  | FK to the owning `CandidateProfile` at creation                                     |
| `documentKind`               | `CvDocumentKind` derived from accepted declaration, then verified from content      |
| `parserClass`                | Enabled configured `CvParserClass`, not a raw provider/model                        |
| `status`                     | `CvUploadStatus` aggregate state                                                    |
| `declaredMediaType`          | Allowlisted `application/pdf` or DOCX media type                                    |
| `declaredBytes`              | Integer from 1 through 5,000,000 bytes (decimal 5 MB)                              |
| `actualBytes`                | Nullable until the body finalizes; then 1 through 5,000,000 and equal to received bytes |
| `quotaReservationBytes`      | Initial declared source bytes plus 512 KiB extraction allowance                     |
| `quotaReservationRemaining`  | Outstanding allowance converted/released only under the account quota lock          |
| `sourceSha256`               | Nullable 32-byte server-computed digest; never returned or logged                   |
| `displayFilenameCiphertext`  | Nullable versioned authenticated ciphertext; filename never selects an object key   |
| `idempotencyDigest`          | Purpose-separated HMAC of create/upload operation key                               |
| `createBindingDigest`        | HMAC of canonical filename/type/length/parser metadata; never returned or logged    |
| `failureCode`                | Nullable allowlisted safe code only                                                 |
| `automaticScanAttemptsUsed`  | Integer from 0 through 3; includes the initial attempt plus at most two automatic retries |
| `candidateScanRetriesUsed`   | Integer from 0 through 2                                                            |
| `automaticParseAttemptsUsed` | Integer from 0 through 3; includes the initial attempt plus at most two automatic retries |
| `candidateParseRetriesUsed`  | Integer from 0 through 2                                                            |
| `contentReceivedAt`          | Nullable completion time for the raw body                                           |
| `contentInaccessibleAt`      | Nullable logical-denial timestamp                                                   |
| `expiresAt`                  | Exactly 30 days from creation unless an earlier terminal retention rule applies     |
| `deleteAfter`                | Physical deletion deadline selected by the service clock                            |
| `deletedAt`                  | Nullable timestamp after all owned content is scrubbed/deleted                      |
| `confirmedAt`                | Nullable; set with confirmation transaction                                         |
| `createdAt`, `updatedAt`     | Server timestamps                                                                   |

Relations: zero or more stored artifacts, scan assessments, extraction attempts,
parse jobs, retry requests, and consent events; at most one draft and
confirmation.

Invariants:

- `(accountId, idempotencyDigest)` is unique for an active create operation.
- An idempotent create replay must match `createBindingDigest`; otherwise it is
  a key-reuse conflict before any new reservation/body is accepted.
- `actualBytes` and `sourceSha256` are both null before content finalization and
  both non-null afterward.
- `0 <= quotaReservationRemaining <= quotaReservationBytes`; the initial value
  equals `declaredBytes + 524288`, and terminal settlement leaves zero.
- SHA-256 is for per-operation equality and integrity only. There is no unique
  digest index, lookup endpoint, or reuse across accounts/imports.
- `CONFIRMED` requires `confirmedAt`, one confirmed draft, and one confirmation.
- `CANCELLED`/`DELETED`/`EXPIRED` require `contentInaccessibleAt`; no
  content-bearing API may return data after that timestamp even if physical
  cleanup is pending.
- Candidate deletion sets `status = CANCELLED`, `contentInaccessibleAt`, and a
  `deleteAfter` no later than 24 hours after the request, cancels claimable work,
  and schedules every source/extracted/draft/provenance payload in the same
  transaction. It becomes `DELETED` only after those payloads are scrubbed and
  all tracked artifacts are physically absent.

Indexes:

- `(accountId, createdAt DESC)` for bounded history and rolling-attempt checks
- `(status, expiresAt)` for expiry
- `(deleteAfter)` where `deletedAt IS NULL`
- `(profileId)` for confirmation locking/ownership validation

## `CvStoredArtifact`

Tracks one encrypted object; no artifact bytes live in PostgreSQL.

| Field                                      | Rule                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `id`                                       | Primary key                                                                      |
| `uploadId`, `accountId`                    | Owning FKs; account ID supports isolated cleanup/quota operations                |
| `kind`                                     | `SOURCE_DOCUMENT` or `EXTRACTED_TEXT`                                            |
| `status`                                   | `CvArtifactStatus`                                                               |
| `storageAdapter`                           | Allowlisted adapter/version identifier, not browser-selectable                   |
| `storageLocator`                           | Opaque random private locator; sensitive operational data, never logged/returned |
| `encryptionKeyVersion`                     | Version identifier, never key material                                           |
| `encryptionIv`, `authenticationTag`        | Binary AES-GCM envelope metadata                                                 |
| `plaintextBytes`, `ciphertextBytes`        | Bounded non-negative sizes                                                       |
| `plaintextSha256`                          | 32-byte integrity value; source must match upload digest                         |
| `availableAt`                              | Nullable timestamp after durable write/finalization                              |
| `contentInaccessibleAt`                    | Nullable logical denial                                                          |
| `deleteAfter`                              | Required cleanup deadline once terminal or expired                               |
| `deleteLeaseOwner`, `deleteLeaseExpiresAt` | Nullable recoverable cleanup ownership                                           |
| `deleteAttempts`                           | Non-negative bounded operational counter                                         |
| `deleteFailureCode`                        | Nullable safe code                                                               |
| `deletedAt`                                | Nullable physical-deletion confirmation                                          |
| `createdAt`, `updatedAt`                   | Server timestamps                                                                |

Constraints and indexes:

- unique `(storageAdapter, storageLocator)`
- at most one non-deleted artifact of each `(uploadId, kind)`
- GCM IV is 12 bytes; authentication tag is 16 bytes; SHA-256 is 32 bytes
- `DELETED` requires `deletedAt`; other states require `deletedAt IS NULL`
- claim index `(status, deleteAfter, deleteLeaseExpiresAt)`

Deleting an already absent provider object is treated as successful and sets
`DELETED`. Reconciliation may create/schedule a safe internal orphan record but
must never copy the locator into telemetry.

## `CvScanAssessment`

One immutable scan attempt except for its lease-controlled state transition.

| Field                                       | Rule                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `id`                                        | Primary key                                                         |
| `uploadId`, `sourceArtifactId`, `accountId` | Owning references                                                   |
| `attemptNumber`                             | 1 through 5 within an upload                                        |
| `candidateInitiated`                        | False for the initial/automatic attempts; true for explicit retries |
| `status`                                    | `CvScanStatus`                                                      |
| `engineName`, `engineVersion`               | Allowlisted/capped safe scanner identifiers                         |
| `signatureVersion`, `signaturePublishedAt`  | Evidence used by the 24-hour freshness check                        |
| `failureCode`                               | Nullable safe code; no raw daemon output                            |
| `leaseOwner`, `leaseExpiresAt`              | Nullable while queued/terminal, required while processing           |
| `startedAt`, `completedAt`, `createdAt`     | Server times                                                        |

Unique `(uploadId, attemptNumber)`. A `CLEAN` result requires fresh signature
evidence and `completedAt`; `INFECTED` records only the allowlisted result code,
not a filename/signature string that may echo document content. `INDETERMINATE`
may create the next automatic attempt until the three-attempt cap, then sets
`SCAN_FAILED`. An explicit retry creates one further assessment through a
`CvRetryRequest`; at most two such assessments are permitted.

Claim index: `(status, leaseExpiresAt, createdAt)`.

## `CvExtraction`

One immutable extraction attempt after a clean assessment.

| Field                                                           | Rule                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `id`                                                            | Primary key                                                             |
| `uploadId`, `sourceArtifactId`, `scanAssessmentId`, `accountId` | Owning/clean-input references                                           |
| `outputArtifactId`                                              | Nullable unique FK to extracted-text artifact; required only on success |
| `attemptNumber`                                                 | Bounded ordinal                                                         |
| `status`                                                        | `CvExtractionStatus`                                                    |
| `extractorName`, `extractorVersion`, `rulesVersion`             | Capped version provenance                                               |
| `pageCount`                                                     | Nullable; PDF only, 1 through 20                                        |
| `entryCount`, `expandedBytes`                                   | Nullable DOCX safety evidence, within caps                              |
| `segmentCount`, `extractedUtf8Bytes`                            | Required on success; output at most 512 KiB                             |
| `failureCode`                                                   | Nullable safe code only                                                 |
| `leaseOwner`, `leaseExpiresAt`                                  | Recoverable ownership                                                   |
| `startedAt`, `completedAt`, `createdAt`                         | Server times                                                            |

Unique `(uploadId, attemptNumber)`. `SUCCEEDED` requires a clean scan, one
available output artifact, positive segment count, bounded size, and completion
time. `FAILED` must not retain partial parser input; the runner destroys the
partial artifact and stores only its safe failure code.

Claim index: `(status, leaseExpiresAt, createdAt)`.

## `CvParseJob`

One immutable semantic-parser attempt. This table is the durable queue and safe
attempt history; there is no hidden in-memory or administrator-owned DLQ.

| Field                                   | Rule                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `id`                                    | Primary key                                                                      |
| `uploadId`, `extractionId`, `accountId` | Owning and input references                                                      |
| `consentEventId`                        | Nullable FK; required for external dispatch and must name the exact live grant   |
| `previousAttemptId`                     | Nullable self-reference forming a bounded retry chain                            |
| `attemptNumber`                         | Monotonic ordinal within the upload                                              |
| `trigger`                               | `CvParseTrigger`                                                                 |
| `status`                                | `CvParseStatus`                                                                  |
| `parserClass`                           | Configured adapter class copied from upload                                      |
| `provider`, `model`, `purposeVersion`   | Allowlisted/capped dispatch identity                                             |
| `inputVersion`                          | Canonical extracted-segment artifact format, `cv-segments-v1`                    |
| `instructionVersion`, `schemaVersion`   | Must match reviewed code constants                                               |
| `providerRequestIdHmac`                 | Nullable one-way correlation token; never raw provider ID if it may be sensitive |
| `failureCode`                           | Nullable safe mapped code only                                                   |
| `leaseOwner`, `leaseExpiresAt`          | Recoverable ownership                                                            |
| `startedAt`, `completedAt`, `createdAt` | Server times                                                                     |

Constraints/indexes:

- unique `(uploadId, attemptNumber)`
- partial unique `(accountId)` where `status IN ('QUEUED','PROCESSING')`
- claim index `(status, leaseExpiresAt, createdAt)`
- external `PROCESSING` requires an exact non-revoked grant at dispatch; the FK
  alone is evidence, not sufficient authorization
- terminal rows cannot be returned to queued; retries create a new row
- `SUCCEEDED` requires exactly one draft for the upload and completion time

After the third automatic failure, the upload becomes `PARSE_FAILED`. Each
candidate retry creates a new row, its `CvRetryRequest`, and increments the
separate parse-retry counter in one transaction. The second failed candidate
retry remains terminal with replacement and manual Profile entry actions.

## `CvRetryRequest`

Immutable idempotency binding for the candidate-facing retry endpoint. Automatic
retries do not create this row.

| Field                                       | Rule                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `id`                                        | Primary key                                                         |
| `accountId`, `uploadId`                     | Owning references                                                   |
| `stage`                                     | `SCAN` or `PARSE`                                                   |
| `idempotencyDigest`                         | Purpose-separated HMAC of the retry endpoint key                    |
| `priorScanAssessmentId`, `scanAssessmentId` | Both non-null only for `SCAN`; bind prior terminal and new attempt  |
| `priorParseJobId`, `parseJobId`             | Both non-null only for `PARSE`; bind prior terminal and new attempt |
| `createdAt`                                 | Server timestamp                                                    |

Constraints:

- unique `(accountId, idempotencyDigest)` across every explicit retry stage;
- `SCAN` requires exactly the two scan references and null parser references;
- `PARSE` requires exactly the two parser references and null scan references;
- every prior row belongs to the same upload/account and is terminal/retryable;
- every new row belongs to the same upload/account and is the next ordinal;
- an append-only trigger rejects UPDATE/DELETE outside the approved account
  retention process.

Creating a retry locks the upload and quota row, checks the relevant two-retry
counter and current terminal state, inserts this binding and the new attempt,
increments only that stage's counter, and updates aggregate state atomically.
Replaying the key returns the originally bound attempt even if later state has
changed; attempting to bind it to another prior attempt/stage returns conflict.

## `CvDraft`

At most one unconfirmed parser draft per upload. It is never a Candidate Profile
and is inaccessible after deletion, expiry, or confirmation.

| Field                                   | Rule                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                                    | Primary key                                                                              |
| `uploadId`                              | Unique FK to aggregate root                                                              |
| `accountId`, `profileId`                | Owning references used for isolated lookup/locking                                       |
| `parseJobId`                            | Unique FK to the successful parser attempt                                               |
| `status`                                | `CvDraftStatus`                                                                          |
| `schemaVersion`                         | `cv-draft-v1` for this plan                                                              |
| `revision`                              | Non-negative optimistic concurrency token, starts at 0                                   |
| `sourceProfileRevision`                 | Profile revision at draft creation                                                       |
| `reviewedProfileRevision`               | Profile revision against which saved choices were last reviewed                          |
| `proposalPayload`                       | Nullable JSONB; sanitized editable values and stable proposal IDs                        |
| `reviewPayload`                         | Nullable JSONB; complete saved action/selection manifest                                 |
| `provenancePayload`                     | Nullable JSONB; verified segment IDs, locations, confidence, and bounded derived context |
| `payloadBytes`, `provenanceBytes`       | Server-calculated canonical UTF-8 byte sizes                                             |
| `expiresAt`                             | Upload creation plus 30 days                                                             |
| `contentInaccessibleAt`                 | Set immediately on confirm/delete/expiry                                                 |
| `payloadDeleteAfter`                    | Seven days after confirm or applicable earlier deadline                                  |
| `payloadDeletedAt`                      | Set after JSON fields are nulled by cleanup                                              |
| `confirmedAt`, `createdAt`, `updatedAt` | Server timestamps                                                                        |

Database checks use `octet_length(jsonb::text)` as defense in depth:

- `proposalPayload` plus `reviewPayload` canonical serialized size <= 256 KiB
- `provenancePayload` serialized size <= 128 KiB
- all three are null when `payloadDeletedAt IS NOT NULL`
- `revision >= 0`; revisions increment exactly once per successful PATCH
- `CONFIRMED` requires `confirmedAt` and `contentInaccessibleAt`

The application additionally validates strict versioned Zod/JSON contracts,
per-field Feature 002 constraints, aggregate caps (50 experiences, 50 education,
50 unique skills, 10 unique social links), valid proposal IDs, and provenance
segment membership before insertion or save.

### Draft JSON boundaries

`proposalPayload` may contain only:

- scalar proposals for `headline`, `summary`, `phone`, and `location`;
- complete candidate-editable `ProfileExperience`, `ProfileEducation`, skill
  display name, and social-link values;
- a server-assigned proposal ID and safe duplicate hint for each proposal.

It never contains current Profile values, raw source text, filename, account
identity, source digest, storage locator, provider prompt/response, or token.

`reviewPayload` names every proposal exactly once and records:

- scalar action: `ADD`, `REPLACE`, or `SKIP` (`ADD` requires an empty current
  field; `REPLACE` requires a present current field);
- structured entry action: `ADD`, `REPLACE` (with an owned target entry ID), or
  `SKIP`;
- skill action: `ADD` or `SKIP`;
- review completion flag and the server-derived non-content manifest version.

When `reviewPayload` is null, the comparison projection derives initial actions
from the live Profile: absent scalars and unmatched entries use `ADD`, populated
scalars and uniquely normalized matching collection entries use `REPLACE`, and
ambiguous collection matches or existing skills use `SKIP`. This projection is
non-mutating. Once `reviewPayload` exists, its candidate-saved decisions remain
authoritative and are not replaced by newly derived defaults.

`provenancePayload` maps proposal IDs to verified segment IDs, document
page/paragraph locations, optional normalized confidence, and capped derived
context. Missing provenance is explicit. Source text is not copied wholesale.

## `CvProcessingConsent`

Append-only evidence for one exact external-processing choice.

| Field                                 | Rule                                              |
| ------------------------------------- | ------------------------------------------------- |
| `id`                                  | Primary key                                       |
| `accountId`, `uploadId`               | Owning references                                 |
| `action`                              | `GRANTED` or `REVOKED`                            |
| `supersedesConsentId`                 | Nullable prior event in the same exact binding    |
| `provider`, `providerClass`, `model`  | Server-selected disclosed destination             |
| `purposeVersion`                      | Exact extraction purpose                          |
| `noticeVersion`, `consentTextVersion` | Exact disclosure/text accepted or revoked         |
| `occurredAt`, `createdAt`             | Server timestamps; occurred time is authoritative |

Indexes: `(uploadId, occurredAt DESC)` and `(accountId, occurredAt DESC)`.
A trigger prevents UPDATE/DELETE. A grant is live only when it exactly matches
the pending dispatch binding and no later matching revocation exists. Revoking
before dispatch cancels queued external work; revoking during an already-started
request prevents subsequent retry/reuse but cannot recall transmitted data.

The API returns the server-selected notice content separately; the row stores
only its immutable version identifiers, not the full text.

## `CvImportConfirmation`

Immutable non-content receipt for an atomic import.

| Field                                                                                                                  | Rule                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                                                                                                                   | Primary key and safe receipt ID                                                        |
| `accountId`, `profileId`, `uploadId`, `draftId`                                                                        | Owning references; upload and draft are unique                                         |
| `idempotencyDigest`                                                                                                    | Purpose-separated HMAC of confirmation key                                             |
| `selectionManifestVersion`                                                                                             | Reviewed code version                                                                  |
| `selectionManifestDigest`                                                                                              | Digest of canonical saved non-content choices                                          |
| `selectionManifest`                                                                                                    | Bounded JSONB with proposal IDs, action/field names, owned target IDs, and counts only |
| `draftRevision`                                                                                                        | Exact confirmed draft revision                                                         |
| `sourceProfileRevision`                                                                                                | Profile revision captured when the parser draft was created                            |
| `reviewedProfileRevision`                                                                                              | Current Profile revision against which choices were last saved and confirmed           |
| `profileRevisionBefore`, `profileRevisionAfter`                                                                        | `after = before + 1`                                                                   |
| `appliedScalarCount`, `appliedExperienceCount`, `appliedEducationCount`, `appliedSkillCount`, `appliedSocialLinkCount` | Non-negative safe counts within aggregate caps                                         |
| `confirmedAt`, `createdAt`                                                                                             | Server timestamps                                                                      |

Unique constraints:

- `uploadId`
- `draftId`
- `(accountId, idempotencyDigest)`

A trigger prevents UPDATE/DELETE. The manifest contains no field value, source
snippet, skipped value, source digest, filename, provider payload, or object
locator. The binding covers the candidate, exact draft/source/reviewed Profile
revisions, and manifest digest. An identical idempotent retry returns this
receipt; rebinding any component returns conflict.

## State Transitions

### Upload aggregate

```text
AWAITING_CONTENT
  -> VALIDATION_QUEUED (bounded envelope/length/magic checks only)
  -> SCAN_QUEUED
  -> SCANNING
       -> INFECTED | SCAN_FAILED
       -> EXTRACTION_QUEUED (post-CLEAN deep structure validation/extraction)
       -> EXTRACTING
            -> EXTRACTION_FAILED
            -> AWAITING_CONSENT (external only)
            -> PARSE_QUEUED
            -> PARSING
                 -> PARSE_FAILED
                 -> REVIEW_READY
                      -> CONFIRMED

Any non-confirmed state -> CANCELLED | EXPIRED
CANCELLED               -> DELETED after all physical/database content cleanup
Validation rejection    -> VALIDATION_FAILED
AWAITING_CONSENT        -> PARSE_QUEUED after exact grant
PARSE_FAILED            -> PARSE_QUEUED through a bounded candidate retry
SCAN_FAILED             -> SCAN_QUEUED through a bounded candidate retry
```

Only service methods may change aggregate state. Database checks/triggers reject
backward transitions, terminal mutation, success without its dependent row, and
lease finalization by a non-owner.

### Artifact

```text
QUARANTINED -> AVAILABLE -> DELETE_PENDING -> DELETING -> DELETED
                    \--------------------------^
DELETE_PENDING/DELETING -> DELETE_FAILED -> DELETE_PENDING
```

Logical access is denied by `contentInaccessibleAt` independently of physical
state. `DELETE_FAILED` is retryable and observable without exposing the locator.

### Draft

```text
EDITABLE -> CONFIRMED
EDITABLE -> DELETED | EXPIRED
```

No state can return to `EDITABLE`. Confirmed JSON is scrubbed by the deadline,
but the immutable non-content confirmation receipt remains.

## Concurrency and Transaction Boundaries

### Upload reservation

Lock `CvAccountQuota`, evaluate the rolling one-hour count, active import count,
and byte budget including 512 KiB extraction headroom, then create `CvUpload`
and increment `reservedBytes` atomically. Idempotency conflict mapping occurs
inside the same boundary. Source/extraction settlement locks the same quota and
upload rows, converts actual bytes to retained usage, and releases unused
allowance exactly once.

### Worker claim/finalize

Each stage claims rows with `FOR UPDATE SKIP LOCKED`, assigns a unique owner and
lease expiry, commits, then performs provider I/O. Finalization uses
`WHERE id = ? AND leaseOwner = ? AND status = 'PROCESSING'`; a zero-row update
means lease ownership was lost and the result is discarded.

### Draft save

Update with `WHERE id = ? AND accountId = ? AND status = 'EDITABLE' AND
revision = baseDraftRevision`. Validate the live Profile revision before save.
Revalidate scalar actions against the live Profile (`ADD` only for an empty
field, `REPLACE` only for a populated field) and reject normalized duplicate
proposed skills/social links. Semantic failures return canonical proposal or
decision paths, including `ACTION_MISMATCH` at
`reviewDecisions.scalars.{index}.action`, without writing the payload. Success
writes the full bounded review payload and increments `revision` once.
A zero-row update maps to `409 DRAFT_REVISION_CONFLICT` with the latest safe
revision/comparison; unsaved browser values are not submitted automatically.

### Confirmation

One serializable/retry-safe PostgreSQL transaction:

1. derive the active account and lock upload, draft, and Candidate Profile;
2. verify ownership, unexpired/clean state, exact draft and Profile revisions,
   complete review choices, optional exact consent, caps, target child ownership,
   duplicates, and Feature 002 validators;
3. apply exactly the selected scalar/entry/skill operations, preserving selected
   target IDs and resolving shared skills with the existing normalized catalog;
4. increment Profile revision exactly once;
5. mark upload/draft confirmed and inaccessible, insert the immutable receipt
   and allowlisted audit event, assign seven-day content deadlines, and commit.

Any error rolls back every step. Artifact quota is not decremented in this
transaction; it is decremented when physical deletion later succeeds.

## Retention and Deletion Ownership

| Content                                       | Logical denial              | Physical/database purge deadline       | Owner                                |
| --------------------------------------------- | --------------------------- | -------------------------------------- | ------------------------------------ |
| Incomplete/rejected/infected source           | On terminal decision        | Within 24 hours                        | cleanup worker + storage adapter     |
| Unconfirmed source and extracted text         | At delete/expiry            | 30 days from upload at latest          | cleanup worker + S3 31-day safeguard |
| Editable draft/provenance                     | At delete/expiry            | 30 days from upload at latest          | cleanup worker                       |
| Confirmed source/text/draft/provenance        | In confirmation transaction | Within 7 days                          | cleanup worker                       |
| Candidate-deleted source/text/draft/provenance | In cancellation transaction | Within 24 hours of deletion request    | cleanup worker + storage adapter     |
| Consent/attempt metadata/confirmation receipt | Not CV content; minimized   | Project account/audit retention policy | database retention owner             |

Cleanup uses leases and idempotent outcomes. The worker nulls encrypted display
filename, source digest, draft/provenance JSON, and other temporary content when
their purge succeeds. Append-only consent and receipt rows remain non-content.

## Migration and Compatibility Rules

- Do not edit migrations `001` through `007`.
- No data backfill is required; existing candidates receive a quota row lazily.
- Add Prisma-supported definitions first, then reviewed SQL for partial unique
  indexes, JSON byte checks, append-only triggers, and state invariants.
- Verify migration from an empty database and from the full existing migration
  chain, regenerate Prisma, run drift checks, and confirm no Better Auth-owned
  column/model changes.
- Rollback means disabling new upload/parser dispatch while leaving cleanup on,
  followed by a forward migration. It never means deleting an applied migration
  or abandoning retained artifacts.
