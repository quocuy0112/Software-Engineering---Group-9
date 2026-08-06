# Data Model: Purpose-Specific OCR Parsing

This model extends the existing Prisma/PostgreSQL schema after Feature 004. It
does not replace Feature 003 job-search data or Feature 004 CV import data.
PostgreSQL stores lifecycle, ownership, versions, safe counts, consent, and
deletion evidence. Search source bytes, normalized pixels, OCR text, validated
intent values, and evidence excerpts are encrypted artifacts—not database
text/JSON fields.

All timestamps are UTC `timestamptz` through Prisma `DateTime`. All digests are
fixed-length binary values. Raw IP addresses, browser nonces, visitor
capabilities, storage locators in audit/event descriptions, and content are
never persisted outside their specifically encrypted artifact envelope.

## Existing Models Extended

### `UserAccount` (`user`)

Add relations only:

- `imageSearchQueries SearchImageQuery[]`
- `imageSearchConsents SearchProcessingConsent[]`

No Better Auth-owned field, session relation, account-state rule, or browser
credential changes.

### `CvExtraction`

Add nullable/derived OCR metadata:

| Field                        | Type                    | Rule                                                                          |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `segmentSchemaVersion`       | `String?`               | `cv-segments-v1` for unchanged native path; `cv-segments-v2` for hybrid path. |
| `eligibilityPolicyVersion`   | `String?`               | `cv-ocr-eligibility-v1` when eligibility was evaluated.                       |
| `deduplicationPolicyVersion` | `String?`               | `cv-segment-dedup-v1` for hybrid output.                                      |
| `confidencePolicyVersion`    | `String?`               | `ocr-confidence-v1` for hybrid output.                                        |
| `nativeSegmentCount`         | `Int?`                  | Nonnegative.                                                                  |
| `ocrSegmentCount`            | `Int?`                  | Nonnegative; zero for evaluated native-only documents.                        |
| `accountedUnitCount`         | `Int?`                  | Number of pages/body-image units with an outcome.                             |
| `lowConfidenceUnitCount`     | `Int?`                  | Nonnegative and no greater than accounted units.                              |
| `conflictUnitCount`          | `Int?`                  | Nonnegative and no greater than accounted units.                              |
| `ocrAttempt`                 | `OcrProcessingAttempt?` | Optional one-to-one reverse relation.                                         |

Existing `outputArtifactId` still points to a Feature 004 encrypted
`EXTRACTED_TEXT` artifact. Native-only payloads keep the exact v1 shape. Hybrid
payloads use the strict v2 segment schema. The 512-KiB artifact cap and Feature
004 quota/retention rules remain authoritative.

No `CandidateProfile`, `CvDraft`, or `CvImportConfirmation` ownership or
transaction fields change. `CvDraft` may store a validated `cv-draft-v2` payload
inside its existing bounded JSON fields, but only through the existing parser
and draft service.

## Enums

### `OcrProcessingPurpose`

- `CV_IMPORT`
- `JOB_IMAGE_SEARCH`

### `OcrAttemptStatus`

- `QUEUED`
- `PROCESSING`
- `SUCCEEDED`
- `PARTIAL_REVIEW_REQUIRED`
- `FAILED`
- `CANCELLED`

`PARTIAL_REVIEW_REQUIRED` is permitted only for CV imports where every required
unit has an explicit safe outcome and usable labeled evidence exists. Search
never exposes a partial OCR result as successful intent.

### `OcrUnitKind`

- `PDF_PAGE`
- `DOCX_BODY_IMAGE`
- `SEARCH_IMAGE`

### `OcrUnitStatus`

- `NATIVE_SUFFICIENT`
- `OCR_SUCCEEDED`
- `NON_TEXT`
- `LOW_CONFIDENCE`
- `CONFLICT`
- `DEDUPLICATED`
- `EXCLUDED`
- `UNSUPPORTED`
- `FAILED`

### `OcrSourceMethod`

- `NATIVE`
- `OCR`
- `NATIVE_AND_OCR`
- `NONE`

### `OcrAnchorQuality`

- `EXACT`
- `APPROXIMATE`
- `PAGE_ONLY`
- `NOT_APPLICABLE`

### `SearchActorClass`

- `VISITOR`
- `AUTHENTICATED`

### `SearchImageStatus`

- `AWAITING_CONTENT`
- `SCAN_QUEUED`
- `SCANNING`
- `DECODE_QUEUED`
- `DECODING`
- `OCR_QUEUED`
- `OCR_PROCESSING`
- `AWAITING_CONSENT`
- `INTERPRET_QUEUED`
- `INTERPRETING`
- `RESULT_READY`
- `FALLBACK_READY`
- `VALIDATION_FAILED`
- `INFECTED`
- `SCAN_FAILED`
- `DECODE_FAILED`
- `OCR_FAILED`
- `INTERPRET_FAILED`
- `CONSUMED`
- `CANCELLED`
- `EXPIRED`
- `DELETED`

`INTERPRET_FAILED` is used only when no safe OCR fallback artifact remains.
Otherwise an interpreter failure transitions to `FALLBACK_READY`.

### `SearchArtifactKind`

- `SOURCE_IMAGE`
- `NORMALIZED_IMAGE`
- `OCR_TEXT`
- `VALIDATED_INTENT`

### `SearchArtifactStatus`

- `QUARANTINED`
- `AVAILABLE`
- `DELETE_PENDING`
- `DELETING`
- `DELETED`
- `DELETE_FAILED`

### `SearchScanStatus`

- `QUEUED`
- `PROCESSING`
- `CLEAN`
- `INFECTED`
- `INDETERMINATE`
- `CANCELLED`

### `SearchDecodeStatus`

- `QUEUED`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

### `SearchInterpreterClass`

- `DETERMINISTIC_INTERNAL`
- `EXTERNAL_OPENAI`

### `SearchIntentStatus`

- `QUEUED`
- `PROCESSING`
- `SUCCEEDED`
- `FALLBACK_READY`
- `FAILED`
- `CANCELLED`

### `SearchResultKind`

- `VALIDATED_INTENT`
- `OCR_TEXT_FALLBACK`

### `SearchConsentAction`

- `GRANTED`
- `REVOKED`

### `ImageSearchAdmissionSubject`

- `SOURCE_IP`
- `BROWSER`
- `ACCOUNT`

## New Models

## `OcrProcessingAttempt`

One aggregate OCR invocation for one existing CV extraction or one search image
query. It contains no OCR text or pixels.

| Field                      | Type                   | Constraints/meaning                                                 |
| -------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `id`                       | `String @id`           | Random UUID/CUID, never user-selected.                              |
| `purpose`                  | `OcrProcessingPurpose` | Must agree with the non-null parent.                                |
| `cvExtractionId`           | `String? @unique`      | Set only for `CV_IMPORT`; FK to `CvExtraction`, cascade.            |
| `searchQueryId`            | `String? @unique`      | Set only for `JOB_IMAGE_SEARCH`; FK to `SearchImageQuery`, cascade. |
| `status`                   | `OcrAttemptStatus`     | Durable worker state.                                               |
| `engineName`               | `String`               | Expected `paddleocr-onnx`.                                          |
| `engineVersion`            | `String`               | Package/service version.                                            |
| `modelName`                | `String`               | Exact PP-OCRv6 model manifest name.                                 |
| `modelSha256`              | `Bytes`                | Digest of the complete approved model manifest.                     |
| `runtimeName`              | `String`               | `onnxruntime`.                                                      |
| `runtimeVersion`           | `String`               | Exact runtime version.                                              |
| `eligibilityPolicyVersion` | `String?`              | Required for CV; null for direct search image.                      |
| `confidencePolicyVersion`  | `String`               | `ocr-confidence-v1`.                                                |
| `inputUnitCount`           | `Int`                  | `>=1`; exactly 1 for search.                                        |
| `succeededUnitCount`       | `Int`                  | Nonnegative.                                                        |
| `reviewUnitCount`          | `Int`                  | Nonnegative.                                                        |
| `failedUnitCount`          | `Int`                  | Nonnegative.                                                        |
| `outputLineCount`          | `Int?`                 | Safe aggregate count.                                               |
| `outputUtf8Bytes`          | `Int?`                 | Safe aggregate count; no content.                                   |
| `failureCode`              | `String?`              | Allowlisted safe code.                                              |
| `leaseOwner`               | `String?`              | Worker identity only while processing.                              |
| `leaseExpiresAt`           | `DateTime?`            | Required with owner.                                                |
| `startedAt`                | `DateTime?`            | First claim.                                                        |
| `completedAt`              | `DateTime?`            | Terminal time.                                                      |
| `createdAt`                | `DateTime`             | Default now.                                                        |

Relations:

- `cvExtraction CvExtraction?`
- `searchQuery SearchImageQuery?`
- `units OcrUnitOutcome[]`
- `intentAttempt SearchIntentAttempt?` (search only)

Database checks:

1. Exactly one of `cvExtractionId` and `searchQueryId` is non-null.
2. `CV_IMPORT` requires `cvExtractionId`; `JOB_IMAGE_SEARCH` requires
   `searchQueryId`.
3. All counts are nonnegative and succeeded + review + failed does not exceed
   input units.
4. Lease owner and expiry are both null or both non-null; terminal rows have no
   lease.
5. Search attempts have `inputUnitCount=1`.

Indexes:

- `(status, leaseExpiresAt, createdAt)` for claim/recovery.
- `(purpose, createdAt)` for content-free operational evidence.

## `OcrUnitOutcome`

One content-free accounting record per PDF page, eligible/excluded DOCX body
image occurrence, or search image.

| Field                      | Type               | Constraints/meaning                                |
| -------------------------- | ------------------ | -------------------------------------------------- |
| `id`                       | `String @id`       | Random identifier.                                 |
| `attemptId`                | `String`           | FK to `OcrProcessingAttempt`, cascade.             |
| `unitKey`                  | `String`           | Versioned opaque key such as `page-0001`; no text. |
| `ordinal`                  | `Int`              | Zero-based deterministic document order.           |
| `kind`                     | `OcrUnitKind`      | Unit source.                                       |
| `status`                   | `OcrUnitStatus`    | Explicit accounting outcome.                       |
| `sourceMethod`             | `OcrSourceMethod`  | Native/OCR/both/none.                              |
| `pageNumber`               | `Int?`             | One-based PDF page; otherwise null.                |
| `bodyOrdinal`              | `Int?`             | DOCX main-body occurrence; otherwise null.         |
| `imageOrdinal`             | `Int?`             | DOCX eligible image occurrence; otherwise null.    |
| `anchorQuality`            | `OcrAnchorQuality` | Exact/approximate/page-only/N/A.                   |
| `averageConfidence`        | `Decimal(5,4)?`    | `0..1`; OCR units only.                            |
| `minimumConfidence`        | `Decimal(5,4)?`    | `0..1`; OCR units only.                            |
| `recognizedCharacterCount` | `Int`              | Nonnegative safe count.                            |
| `segmentCount`             | `Int`              | Nonnegative safe count.                            |
| `deduplicatedSegmentCount` | `Int`              | Nonnegative and <= segment count before merge.     |
| `materialConflict`         | `Boolean`          | Default false.                                     |
| `failureCode`              | `String?`          | Safe unit code.                                    |
| `createdAt`                | `DateTime`         | Default now.                                       |

Constraints/indexes:

- Unique `(attemptId, unitKey)` and `(attemptId, ordinal)`.
- PDF page requires positive `pageNumber` and null DOCX ordinals.
- DOCX image requires nonnegative body/image ordinals and null page number.
- Search image requires ordinal 0 and all location fields null.
- Confidence values are in `[0,1]`; no text or bounding boxes are stored here.
- Index `(attemptId, status, ordinal)`.

## `SearchImageQuery`

Aggregate and authorization boundary for one ephemeral image-search request.

| Field                     | Type                     | Constraints/meaning                                                |
| ------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `id`                      | `String @id`             | High-entropy opaque identifier.                                    |
| `actorClass`              | `SearchActorClass`       | Visitor or authenticated.                                          |
| `accountId`               | `String?`                | FK to active owning account for authenticated query.               |
| `visitorSubjectDigest`    | `Bytes?`                 | HMAC of rate-browser subject; visitor only.                        |
| `visitorCapabilityDigest` | `Bytes?`                 | HMAC of one-query capability; visitor only.                        |
| `capabilityKeyVersion`    | `Int?`                   | Required with capability digest.                                   |
| `status`                  | `SearchImageStatus`      | Aggregate lifecycle.                                               |
| `interpreterClass`        | `SearchInterpreterClass` | Selection fixed at admission.                                      |
| `declaredExtension`       | `String`                 | Canonical `png`, `jpg`, or `jpeg`.                                 |
| `declaredMediaType`       | `String`                 | `image/png` or `image/jpeg`.                                       |
| `declaredBytes`           | `Int`                    | `1..5,000,000`.                                                    |
| `actualBytes`             | `Int?`                   | Must equal declared bytes after upload.                            |
| `sourceSha256`            | `Bytes?`                 | Integrity/dedup evidence, not content.                             |
| `idempotencyDigest`       | `Bytes`                  | HMAC digest of idempotency key.                                    |
| `createBindingDigest`     | `Bytes`                  | Binds actor, metadata, purpose, interpreter, and consent versions. |
| `failureCode`             | `String?`                | Allowlisted safe error.                                            |
| `resultKind`              | `SearchResultKind?`      | Set only when deliverable/consumed.                                |
| `admittedAt`              | `DateTime`               | Starts quota and deletion clock.                                   |
| `contentReceivedAt`       | `DateTime?`              | Exact upload completion.                                           |
| `resultReadyAt`           | `DateTime?`              | Result artifact committed.                                         |
| `resultConsumedAt`        | `DateTime?`              | One-time response committed.                                       |
| `contentInaccessibleAt`   | `DateTime?`              | Required for terminal/consumed states.                             |
| `expiresAt`               | `DateTime`               | Same as immutable `deleteBy`.                                      |
| `deleteBy`                | `DateTime`               | Exactly admittedAt + 15 minutes; immutable.                        |
| `deletedAt`               | `DateTime?`              | All content artifacts physically absent/scrubbed.                  |
| `createdAt`               | `DateTime`               | Same transaction as admission.                                     |
| `updatedAt`               | `DateTime`               | Prisma updatedAt.                                                  |

Relations:

- `account UserAccount?`
- `artifacts SearchStoredArtifact[]`
- `scanAssessments SearchScanAssessment[]`
- `decodeAttempts SearchImageDecodeAttempt[]`
- `ocrAttempt OcrProcessingAttempt?`
- `intentAttempts SearchIntentAttempt[]`
- `consentEvents SearchProcessingConsent[]`
- `admissionEvents ImageSearchAdmissionEvent[]`

Checks:

1. `AUTHENTICATED` requires account and forbids visitor/capability fields.
2. `VISITOR` forbids account and requires visitor/capability digests plus key
   version.
3. Declared extension/media type pairs agree; byte values are bounded.
4. `deleteBy = admittedAt + interval '15 minutes'` and is immutable by trigger.
5. Result-ready/fallback/consumed states require a result kind and ready time.
6. Terminal/consumed/expired/deleted states require
   `contentInaccessibleAt`; `CONSUMED` requires `resultConsumedAt`.
7. `deletedAt` implies every related artifact is `DELETED` and envelopes have
   been scrubbed, enforced by cleanup transaction rather than a cross-row check.

Unique/index rules:

- Partial unique `(accountId, idempotencyDigest)` where account is non-null.
- Partial unique `(visitorSubjectDigest, idempotencyDigest)` where visitor
  subject is non-null.
- `(status, deleteBy, id)` for worker/expiry scans.
- `(accountId, createdAt desc)` for authenticated ownership.
- `(contentInaccessibleAt, deletedAt)` for reconciliation.

## `SearchStoredArtifact`

Encrypted search-only storage metadata. Its context cannot decrypt a CV
artifact and vice versa.

| Field                   | Type                   | Constraints/meaning                                         |
| ----------------------- | ---------------------- | ----------------------------------------------------------- |
| `id`                    | `String @id`           | Random artifact ID.                                         |
| `queryId`               | `String`               | FK to `SearchImageQuery`, cascade after evidence retention. |
| `kind`                  | `SearchArtifactKind`   | One of four permitted kinds.                                |
| `status`                | `SearchArtifactStatus` | Storage lifecycle.                                          |
| `storageAdapter`        | `String`               | `filesystem` or `s3`.                                       |
| `storageLocator`        | `String?`              | Private locator; scrubbed after deletion.                   |
| `encryptionKeyVersion`  | `Int?`                 | Required until deletion.                                    |
| `encryptionIv`          | `Bytes?`               | Required until deletion.                                    |
| `authenticationTag`     | `Bytes?`               | Required until deletion.                                    |
| `plaintextBytes`        | `Int`                  | Bounded by kind.                                            |
| `ciphertextBytes`       | `Int`                  | Nonnegative.                                                |
| `plaintextSha256`       | `Bytes`                | Integrity value retained as safe evidence.                  |
| `availableAt`           | `DateTime?`            | Required for available content.                             |
| `contentInaccessibleAt` | `DateTime?`            | Logical denial.                                             |
| `deleteAfter`           | `DateTime?`            | Retry scheduling, never later than deleteBy.                |
| `deleteBy`              | `DateTime`             | Copied immutable query hard deadline.                       |
| `deleteLeaseOwner`      | `String?`              | Cleanup owner.                                              |
| `deleteLeaseExpiresAt`  | `DateTime?`            | Cleanup lease.                                              |
| `deleteAttempts`        | `Int`                  | Nonnegative.                                                |
| `deleteFailureCode`     | `String?`              | Safe code.                                                  |
| `deletedAt`             | `DateTime?`            | Physical absence confirmed.                                 |
| `createdAt`             | `DateTime`             | Default now.                                                |
| `updatedAt`             | `DateTime`             | Prisma updatedAt.                                           |

Constraints/indexes:

- Unique `(queryId, kind)`; a query has at most one content object of each kind.
- Locator is unique while non-null.
- `deleteBy` equals owning query `deleteBy` at insert and is immutable.
- `deleteAfter <= deleteBy`.
- Available/quarantined content requires complete envelope/locator; `DELETED`
  requires them all null and `deletedAt` non-null.
- Kind limits: source <=5,000,000 bytes; normalized PNG <=25 MiB; OCR text
  <=32 KiB; intent <=64 KiB.
- `(status, deleteAfter, deleteBy, deleteLeaseExpiresAt)` claim index.
- `(queryId, kind)` lookup index covered by unique key.

## `SearchScanAssessment`

One or more bounded malware scan attempts for the exact source artifact.

| Field                  | Type               | Meaning                                  |
| ---------------------- | ------------------ | ---------------------------------------- |
| `id`                   | `String @id`       | Random ID.                               |
| `queryId`              | `String`           | FK to query.                             |
| `sourceArtifactId`     | `String`           | FK to `SOURCE_IMAGE`.                    |
| `attemptNumber`        | `Int`              | Starts at 1; bounded by search window.   |
| `status`               | `SearchScanStatus` | Durable scan state.                      |
| `engineName/version`   | `String?`          | ClamAV traceability.                     |
| `signatureVersion`     | `String?`          | Definition identity.                     |
| `signaturePublishedAt` | `DateTime?`        | Freshness evidence.                      |
| `failureCode`          | `String?`          | Safe code.                               |
| lease/timing fields    | nullable           | Same owner/expiry/terminal rules as OCR. |

Rules:

- Unique `(queryId, attemptNumber)`.
- Unique active attempt per query through a partial unique index on
  `QUEUED|PROCESSING`.
- Source kind/query must match, enforced in repository transaction plus trigger.
- Claim index `(status, leaseExpiresAt, createdAt)`.

## `SearchImageDecodeAttempt`

Format-aware decode is durable and may begin only after a current clean scan.

| Field                              | Type                 | Meaning                      |
| ---------------------------------- | -------------------- | ---------------------------- |
| `id`                               | `String @id`         | Random ID.                   |
| `queryId`                          | `String`             | FK to query.                 |
| `sourceArtifactId`                 | `String`             | Exact clean source.          |
| `scanAssessmentId`                 | `String`             | Exact `CLEAN` scan.          |
| `normalizedArtifactId`             | `String? @unique`    | Output `NORMALIZED_IMAGE`.   |
| `attemptNumber`                    | `Int`                | Starts at 1.                 |
| `status`                           | `SearchDecodeStatus` | Durable state.               |
| `normalizerName/version`           | `String?`            | `sharp` and exact version.   |
| `rulesVersion`                     | `String?`            | `search-image-normalize-v1`. |
| `detectedFormat`                   | `String?`            | `png` or `jpeg`.             |
| `width`, `height`, `decodedPixels` | `Int?`               | Safe dimensions/count.       |
| `frameCount`                       | `Int?`               | Must be 1.                   |
| `metadataRemoved`                  | `Boolean?`           | Must be true on success.     |
| `failureCode`                      | `String?`            | Safe code.                   |
| lease/timing fields                | nullable             | Standard rules.              |

Rules:

- Unique `(queryId, attemptNumber)` and one active attempt/query.
- Success requires matching format, dimensions >0, pixels <=20,000,000,
  frameCount 1, metadata removed, and normalized output.
- Claim index `(status, leaseExpiresAt, createdAt)`.

## `SearchIntentAttempt`

One bounded deterministic or external interpretation of OCR text. It contains
no input text, proposal values, or provider response.

| Field                    | Type                     | Meaning                                 |
| ------------------------ | ------------------------ | --------------------------------------- |
| `id`                     | `String @id`             | Random ID.                              |
| `queryId`                | `String`                 | FK to query.                            |
| `ocrAttemptId`           | `String @unique`         | Exact successful search OCR attempt.    |
| `ocrTextArtifactId`      | `String`                 | Encrypted OCR text input.               |
| `resultArtifactId`       | `String? @unique`        | Encrypted validated intent on success.  |
| `consentEventId`         | `String?`                | Required for external class.            |
| `attemptNumber`          | `Int`                    | Starts at 1; no silent provider switch. |
| `status`                 | `SearchIntentStatus`     | Durable state.                          |
| `interpreterClass`       | `SearchInterpreterClass` | Fixed from query.                       |
| `provider`               | `String`                 | `smarthire` or `openai`.                |
| `model`                  | `String`                 | Exact deterministic/model version.      |
| `purposeVersion`         | `String`                 | `job-image-search-purpose-v1`.          |
| `inputVersion`           | `String`                 | `search-ocr-text-v1`.                   |
| `instructionVersion`     | `String`                 | `job-search-intent-v1`.                 |
| `schemaVersion`          | `String`                 | `job-search-intent-v1`.                 |
| `selectionPolicyVersion` | `String`                 | `search-intent-selection-v1`.           |
| `proposalCount`          | `Int?`                   | `0..20`.                                |
| `autoSelectedCount`      | `Int?`                   | `<=proposalCount`.                      |
| `suggestedCount`         | `Int?`                   | `<=proposalCount`.                      |
| `discardedCount`         | `Int?`                   | Nonnegative.                            |
| `providerRequestIdHmac`  | `Bytes?`                 | Safe provider trace only.               |
| `failureCode`            | `String?`                | Safe code.                              |
| lease/timing fields      | nullable                 | Standard rules.                         |

Rules:

- Unique `(queryId, attemptNumber)` and one active attempt/query.
- OCR parent, OCR text artifact, intent result, consent, and query must all share
  the same query and purpose.
- External class requires a latest matching granted consent and approved exact
  provider/model/purpose/version at dispatch and commit.
- `SUCCEEDED` requires a `VALIDATED_INTENT` artifact; `FALLBACK_READY` requires
  an accessible `OCR_TEXT` artifact and no result artifact.
- No second provider/class can appear for the same query.
- Claim index `(status, leaseExpiresAt, createdAt)`.

## `SearchProcessingConsent`

Append-only external-search interpretation consent evidence.

| Field                        | Type                     | Meaning                             |
| ---------------------------- | ------------------------ | ----------------------------------- |
| `id`                         | `String @id`             | Random event ID.                    |
| `queryId`                    | `String`                 | FK to one search query.             |
| `accountId`                  | `String?`                | Session-derived when authenticated. |
| `actorClass`                 | `SearchActorClass`       | Must match query.                   |
| `action`                     | `SearchConsentAction`    | Grant/revoke.                       |
| `supersedesConsentId`        | `String?`                | Previous event in same query chain. |
| `provider`                   | `String`                 | Exact destination.                  |
| `interpreterClass`           | `SearchInterpreterClass` | External only for grants.           |
| `model`                      | `String`                 | Exact snapshot.                     |
| `purposeVersion`             | `String`                 | Exact purpose.                      |
| `noticeVersion`              | `String`                 | Notice shown.                       |
| `consentTextVersion`         | `String`                 | Unselected control wording.         |
| `retentionDisclosureVersion` | `String`                 | Provider/server disclosure.         |
| `occurredAt`                 | `DateTime`               | User action time.                   |
| `createdAt`                  | `DateTime`               | Persistence time.                   |

Visitor ownership is established through the query capability at write time;
no capability or visitor digest is copied to this row. Checks/triggers enforce:

- same query/actor/account relationship;
- superseded event belongs to same query and cannot already be superseded;
- append-only immutability;
- indexes `(queryId, occurredAt desc)` and `(accountId, occurredAt desc)`.

## `ImageSearchAdmissionEvent`

Content-free rolling-window quota evidence.

| Field           | Type                          | Meaning                                              |
| --------------- | ----------------------------- | ---------------------------------------------------- |
| `id`            | `String @id`                  | Random ID.                                           |
| `queryId`       | `String`                      | FK to admitted query; query metadata outlives event. |
| `subjectKind`   | `ImageSearchAdmissionSubject` | IP, browser, or account.                             |
| `subjectDigest` | `Bytes`                       | Dedicated HMAC; never raw subject.                   |
| `keyVersion`    | `Int`                         | HMAC key version.                                    |
| `admittedAt`    | `DateTime`                    | Window timestamp.                                    |
| `expiresAt`     | `DateTime`                    | `admittedAt + 65 minutes`.                           |
| `createdAt`     | `DateTime`                    | Same admission transaction.                          |

Rules:

- Unique `(queryId, subjectKind)`.
- Visitor query has exactly `SOURCE_IP` and `BROWSER` events.
- Authenticated query has exactly one `ACCOUNT` event.
- Append-only; cleanup deletes at `expiresAt`.
- Claim/count index `(subjectKind, subjectDigest, admittedAt)` and cleanup index
  `(expiresAt)`.

## State Transitions

### Search aggregate

```text
AWAITING_CONTENT
  -> SCAN_QUEUED
  -> CANCELLED | EXPIRED | VALIDATION_FAILED

SCAN_QUEUED -> SCANNING
SCANNING -> DECODE_QUEUED | INFECTED | SCAN_FAILED | CANCELLED | EXPIRED

DECODE_QUEUED -> DECODING
DECODING -> OCR_QUEUED | DECODE_FAILED | CANCELLED | EXPIRED

OCR_QUEUED -> OCR_PROCESSING
OCR_PROCESSING
  -> AWAITING_CONSENT
  -> INTERPRET_QUEUED
  -> FALLBACK_READY
  -> OCR_FAILED | CANCELLED | EXPIRED

AWAITING_CONSENT -> INTERPRET_QUEUED | FALLBACK_READY | CANCELLED | EXPIRED
INTERPRET_QUEUED -> INTERPRETING
INTERPRETING
  -> RESULT_READY | FALLBACK_READY | INTERPRET_FAILED | CANCELLED | EXPIRED

RESULT_READY | FALLBACK_READY -> CONSUMED | CANCELLED | EXPIRED

all content-bearing or terminal states -> DELETED after physical cleanup
```

Only services/repositories may transition aggregate state. A worker finalizes a
stage in the same transaction that attaches its output and queues the next
stage. Any transition after `deleteBy`, `contentInaccessibleAt`, cancellation,
ownership loss, consent mismatch, or expired lease is rejected as stale.

### Search artifact

```text
QUARANTINED -> AVAILABLE -> DELETE_PENDING -> DELETING -> DELETED
QUARANTINED ----------------> DELETE_PENDING
AVAILABLE ------------------> DELETE_PENDING
DELETE_FAILED --------------> DELETING
DELETING -- lease expiry ---> DELETE_PENDING
```

`DELETE_FAILED` never restores accessibility and never moves `deleteBy`.

### OCR attempt

```text
QUEUED -> PROCESSING
PROCESSING -> SUCCEEDED | PARTIAL_REVIEW_REQUIRED | FAILED | CANCELLED
PROCESSING -- lease expiry --> QUEUED only while parent/deadline remain valid
```

Search OCR cannot use `PARTIAL_REVIEW_REQUIRED`. A CV attempt can use it only
when unit accounting is complete and v2 review warnings exist.

## Transaction and Concurrency Boundaries

### Admission

One serializable/retry-safe transaction:

1. validate actor/session or visitor rate cookie input and idempotency;
2. lock/count applicable admission subjects in the rolling window;
3. reject with the maximum exact retry time or create the query;
4. insert both visitor events or the account event;
5. store only capability HMAC for visitors;
6. return an existing identical reservation on idempotent replay.

Advisory transaction locks keyed by the subject digests serialize concurrent
first-time events without creating a counter table. No artifact is created in
this transaction.

### Content finalization

The stream goes directly into an encrypted quarantine object. Finalization
locks the query, verifies state/deadline/ownership/declared vs actual bytes,
persists the source artifact, and queues the first scan in one transaction. On
any failure the object is deleted or recorded as an immediate orphan cleanup
candidate.

### Worker claim/finalize

Each stage uses `FOR UPDATE SKIP LOCKED`, a short lease, and bounded batch. The
worker reads content only after an integrity/authorization query joins the exact
parent and prior successful stage. Finalization checks owner, unexpired lease,
current parent state, current consent where relevant, accessible content, and
hard deadline before attaching output.

### Result consumption

The service verifies actor/capability, validates the request's currently visible
Feature 003 criteria, decrypts and validates the exact result, applies the
deterministic no-silent-overwrite merge without persisting the current criteria,
then locks the query. It changes `RESULT_READY|FALLBACK_READY -> CONSUMED`, sets
`resultConsumedAt`/`contentInaccessibleAt`, marks every artifact delete-pending
with `deleteAfter=now`, and records a content-free audit event atomically. Only
after commit is the already-bounded result returned with `no-store`. A second
request receives a stable already-consumed response and no content.

### Cancellation/expiry

Cancellation and expiry lock the query, set logical inaccessibility, revoke any
active work through parent-state checks, and make every artifact immediately
delete-pending. Workers may finish computation but cannot commit. Expiry sweeps
run more frequently than the 15-minute deadline and cleanup also independently
claims any artifact at `deleteBy` even if aggregate expiry lagged.

## Retention and Deletion Ownership

| Data                                         | Logical inaccessibility                                            | Physical/database handling                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| CV source/extracted/draft content            | Existing Feature 004 rules                                         | Existing Feature 004 cleanup/quota ownership.                                                   |
| CV raster temp                               | End/abort/timeout of extraction attempt                            | Process `finally`; startup orphan sweep; never durable artifact.                                |
| Search source/normalized/OCR/intent artifact | Result consume, terminal failure, cancel, expiry, or hard deadline | Immediate cleanup retry; absolutely absent by `admittedAt+15m`; envelope/locator scrubbed.      |
| Browser OCR fallback                         | Cancel/newer query/navigation/reload/component teardown            | Memory only; no persistence/API recovery.                                                       |
| Search query lifecycle/attempt/unit metadata | Content fields already absent                                      | Retained under safe operational/audit schedule; contains no content/value/capability plaintext. |
| Admission events                             | N/A (content-free)                                                 | Deleted after 65 minutes.                                                                       |
| Consent/audit evidence                       | Per approved audit schedule                                        | Append-only, content-free version/action evidence.                                              |

The application cleanup worker is authoritative for the 15-minute promise.
Object-store lifecycle is only a defense-in-depth orphan backstop. A physical
delete failure is an operational incident but never restores access.

## Migration and Compatibility Rules

1. Add all enums/tables/columns/indexes/checks/triggers in a new additive
   migration after Feature 004. Do not edit migrations `001` through the current
   Feature 004 migration.
2. Add nullable CV extraction columns first; existing rows remain valid and are
   interpreted as `cv-segments-v1` by absence/default compatibility logic.
3. Add search tables with no job-posting foreign key. A database relation to
   `JobPosting`, Candidate Profile, application, or saved job is prohibited.
4. Add PostgreSQL checks/partial unique indexes/immutability triggers with raw
   SQL where Prisma cannot express them. Verify from empty and fully migrated
   databases.
5. Regenerate Prisma and diff Better Auth models and Feature 003 job tables;
   any ownership/session/search semantic change blocks the migration.
6. Feature flags default off. Deploy deletion/reconciliation before admission.
7. Rollback stops new OCR/search work and external dispatch but leaves cleanup
   and reconciliation enabled. Additive rows/tables remain until all content is
   deleted and the normal schema rollback procedure is separately approved.
