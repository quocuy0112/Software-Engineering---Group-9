# Internal Contracts: CV Upload, Parse, and Review

These contracts define replacement boundaries and non-negotiable behavior. They
are design-level TypeScript shapes, not permission to bypass the shared Zod,
Prisma, or OpenAPI contracts during implementation. All modules in this file are
server-only unless explicitly named as browser-safe.

## Common Types

```ts
type AccountId = string & { readonly __brand: "AccountId" };
type ProfileId = string & { readonly __brand: "ProfileId" };
type CvUploadId = string & { readonly __brand: "CvUploadId" };
type CvDraftId = string & { readonly __brand: "CvDraftId" };
type ArtifactId = string & { readonly __brand: "ArtifactId" };
type LeaseOwner = string & { readonly __brand: "LeaseOwner" };

type SafeFailureCode =
  | "CONTENT_REQUIRED"
  | "CONTENT_LENGTH_MISMATCH"
  | "ARTIFACT_INTEGRITY_FAILED"
  | "UNSUPPORTED_DOCUMENT"
  | "MALFORMED_DOCUMENT"
  | "DOCUMENT_ENCRYPTED"
  | "DOCUMENT_ACTIVE_CONTENT"
  | "DOCUMENT_LIMIT_EXCEEDED"
  | "MALWARE_DETECTED"
  | "SCANNER_UNAVAILABLE"
  | "SCANNER_DEFINITIONS_STALE"
  | "EXTRACTION_EMPTY"
  | "EXTRACTION_TIMEOUT"
  | "EXTRACTION_FAILED"
  | "CONSENT_REQUIRED"
  | "CONSENT_REVOKED"
  | "PARSER_TIMEOUT"
  | "PARSER_UNAVAILABLE"
  | "PARSER_OUTPUT_INVALID"
  | "PARSER_OUTPUT_LIMIT_EXCEEDED"
  | "CV_PROCESSING_FAILED"
  | "RETRY_LIMIT_REACHED"
  | "IMPORT_EXPIRED"
  | "IMPORT_DELETED";

interface Clock {
  now(): Date;
}
```

No result type contains a raw filename, CV byte, extracted text, source snippet,
plaintext digest, storage locator, encryption material, API token, prompt, or
provider response unless that interface explicitly owns the content and marks
it as sensitive.

## 1. Authenticated Account Request Boundary

```ts
interface CvAccountRequestContext {
  accountId: AccountId;
  profileId: ProfileId;
  accountState: "ACTIVE";
  sessionId: string;
  requestId: string;
}

interface CvAccountRequestBoundary {
  requireRead(request: Request): Promise<CvAccountRequestContext>;
  requireMutation(request: Request): Promise<CvAccountRequestContext>;
}
```

`requireMutation` reuses the existing Better Auth session plus same-origin,
Fetch Metadata, and CSRF proof. It derives all ownership from the session. Route
Handlers reject any ownership/storage/provider field before calling a service.
Every browser response sets `Cache-Control: no-store`.

## 2. Upload Admission and Streaming Receiver

```ts
interface CreateCvImportCommand {
  accountId: AccountId;
  profileId: ProfileId;
  displayFilename: string;
  declaredMediaType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  declaredBytes: number;
  parserClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  idempotencyKey: string;
  now: Date;
}

interface CvUploadReservation {
  uploadId: CvUploadId;
  status: "AWAITING_CONTENT";
  contentUrl: string;
  expiresAt: Date;
  requiredHeaders: Readonly<{
    contentType: string;
    contentLength: number;
    idempotencyKey: true;
  }>;
}

interface CvImportAdmissionService {
  create(command: CreateCvImportCommand): Promise<CvUploadReservation>;
}

interface ReceiveCvContentCommand {
  accountId: AccountId;
  uploadId: CvUploadId;
  contentType: string;
  contentLength: number;
  idempotencyKey: string;
  body: ReadableStream<Uint8Array>;
  now: Date;
}

interface ReceiveCvContentOutcome {
  uploadId: CvUploadId;
  status: "VALIDATION_QUEUED";
  replayed: boolean;
}

interface CvContentReceiver {
  receive(command: ReceiveCvContentCommand): Promise<ReceiveCvContentOutcome>;
}
```

Admission locks the account quota row. It enforces 1..5,000,000 bytes (decimal
5 MB), PDF/DOCX
declaration, five admitted attempts per rolling hour, ten non-deleted imports,
and 50 MiB reserved plus retained storage. It reserves declared source bytes
plus 512 KiB extraction headroom; source/extraction settlement converts actual
stored bytes and releases unused allowance atomically. The idempotency key is
16..200 printable ASCII characters and is persisted only as a purpose-separated
HMAC.

The receiver requires exact `Content-Length` and streams at most the reserved
length/5,000,000-byte source limit. It computes SHA-256 over plaintext, encrypts
while writing to a random quarantine locator, and never buffers the whole body.
On an idempotent retry it uses a disposable quarantine object: equal
digest/length returns the
existing result and deletes the duplicate; mismatch deletes the duplicate and
returns `409 IDEMPOTENCY_KEY_REUSED`.

Abort, short body, extra byte, disconnect, storage error, or DB-finalization
error closes streams, leaves no accessible partial object, records a safe state,
and schedules any possible object for deletion.

## 3. Quota Repository

```ts
interface CvQuotaRepository {
  reserve(input: {
    accountId: AccountId;
    declaredBytes: number;
    idempotencyDigest: Uint8Array;
    createBindingDigest: Uint8Array;
    now: Date;
  }): Promise<"RESERVED" | "IDEMPOTENT_REPLAY">;

  finalizeReservation(input: {
    accountId: AccountId;
    uploadId: CvUploadId;
    declaredBytes: number;
    actualBytes: number;
  }): Promise<void>;

  settleExtractionReservation(input: {
    accountId: AccountId;
    uploadId: CvUploadId;
    extractedArtifactId?: ArtifactId;
    actualExtractedBytes: number;
  }): Promise<void>;

  releaseDeletedBytes(input: {
    accountId: AccountId;
    artifactId: ArtifactId;
    plaintextBytes: number;
  }): Promise<void>;
}
```

All methods are transaction-bound and idempotent. `releaseDeletedBytes` requires
the artifact's physical-deletion transition in the same database transaction;
it cannot decrement twice.

## 4. Artifact Encryption

```ts
interface CvArtifactEnvelope {
  keyVersion: string;
  iv: Uint8Array;
  authenticationTag: Uint8Array;
  ciphertextBytes: number;
}

interface CvArtifactCryptor {
  createEncryptStream(context: {
    artifactId: ArtifactId;
    uploadId: CvUploadId;
    purpose: "SOURCE_DOCUMENT" | "EXTRACTED_TEXT";
    keyVersion: string;
  }): {
    plaintext: WritableStream<Uint8Array>;
    ciphertext: ReadableStream<Uint8Array>;
    completed: Promise<CvArtifactEnvelope>;
  };

  createDecryptStream(
    envelope: CvArtifactEnvelope,
    context: {
      artifactId: ArtifactId;
      uploadId: CvUploadId;
      purpose: "SOURCE_DOCUMENT" | "EXTRACTED_TEXT";
    },
  ): TransformStream<Uint8Array, Uint8Array>;
}

interface CvMetadataCryptor {
  encryptDisplayFilename(input: {
    uploadId: CvUploadId;
    plaintext: string;
  }): Promise<{
    keyVersion: string;
    ciphertext: Uint8Array;
    iv: Uint8Array;
    authenticationTag: Uint8Array;
  }>;

  decryptDisplayFilename(input: {
    uploadId: CvUploadId;
    keyVersion: string;
    ciphertext: Uint8Array;
    iv: Uint8Array;
    authenticationTag: Uint8Array;
  }): Promise<string>;
}

interface IntegrityVerifiedCvReader {
  open(input: {
    artifactId: ArtifactId;
    uploadId: CvUploadId;
    expectedPlaintextBytes: number;
    expectedSha256: Uint8Array;
    purpose: "MALWARE_SCAN" | "DOCUMENT_EXTRACTION";
  }): Promise<{
    plaintext: ReadableStream<Uint8Array>;
    verified: Promise<{ plaintextBytes: number }>;
  }>;
}
```

Use AES-256-GCM, a cryptographically random 12-byte IV per encryption, a 16-byte
authentication tag, and authenticated data containing format version, artifact
ID, upload ID, and purpose. Display filenames use the separate upload-bound
metadata contract. Keys are server-only versioned secrets. Authentication
failure is terminal for that read and produces only a safe integrity code.
The stage result is not committed until `verified` resolves with the expected
byte count and SHA-256; mismatch discards the provider result, denies further
processing, and schedules the artifact for safe deletion.

## 5. Private Artifact Storage

```ts
interface SensitiveStorageLocator {
  readonly value: string;
  readonly __sensitive: true;
}

interface PrivateCvStorage {
  put(input: {
    artifactId: ArtifactId;
    ciphertext: ReadableStream<Uint8Array>;
    expectedCiphertextBytes?: number;
  }): Promise<{
    locator: SensitiveStorageLocator;
    ciphertextBytes: number;
    providerVersion: string;
  }>;

  open(input: {
    locator: SensitiveStorageLocator;
    expectedCiphertextBytes: number;
  }): Promise<ReadableStream<Uint8Array>>;

  delete(input: {
    locator: SensitiveStorageLocator;
  }): Promise<"DELETED" | "ALREADY_ABSENT">;

  inventoryPage(input: { cursor?: string; limit: number }): Promise<{
    opaqueReferences: ReadonlyArray<{ locator: SensitiveStorageLocator }>;
    nextCursor?: string;
  }>;
}
```

Contract tests run unchanged against:

- encrypted filesystem storage under a configured absolute gitignored local
  root; symlinks, traversal, overwrite, and non-atomic finalize are rejected;
- a private S3 adapter requiring the configured bucket/region, SSE-KMS key,
  Block Public Access, non-versioned behavior, and no ACL/public URL.

Storage has no method that returns a browser URL. Locators are random and are
redacted by logger/inspection serializers.

## 6. Malware Scanner

```ts
type MalwareScanResult =
  | {
      kind: "CLEAN";
      engine: "clamav";
      engineVersion: string;
      signatureVersion: string;
      signaturePublishedAt: Date;
    }
  | {
      kind: "INFECTED";
      engine: "clamav";
      engineVersion: string;
      signatureVersion: string;
      signaturePublishedAt: Date;
      code: "MALWARE_DETECTED";
    }
  | {
      kind: "INDETERMINATE";
      code: "SCANNER_UNAVAILABLE" | "SCANNER_DEFINITIONS_STALE";
      retryable: boolean;
    };

interface MalwareScanner {
  readiness(
    now: Date,
  ): Promise<
    | { ready: true; engineVersion: string; signatureAgeMs: number }
    | { ready: false; code: SafeFailureCode }
  >;

  scan(input: {
    plaintext: ReadableStream<Uint8Array>;
    maximumBytes: 6291456;
    deadline: Date;
  }): Promise<MalwareScanResult>;
}
```

The ClamAV adapter connects only to `CV_CLAMD_SOCKET_PATH` on the same host/pod
and uses `INSTREAM` over that Unix-domain socket with bounded frames, a 6 MiB
daemon `StreamMaxLength`, a 20-second timeout, and
`PING`/`VERSIONCOMMANDS`/`VERSION` readiness. A dedicated shared numeric group
owns the socket with mode `0660`; readiness rejects a stale, wrongly owned, or
world-accessible socket. `TCPSocket`/`TCPAddr` are disabled, no scanner port is
published, and web/email never mount the socket volume. The client still rejects
source input above 5,000,000 bytes. Definitions older than 24 hours fail closed.
Raw daemon text is parsed inside the adapter and never propagated or logged.

## 7. Structural Validator and Extractor

```ts
interface ExtractedSegment {
  id: string;
  location:
    | { kind: "PDF_PAGE"; page: number }
    | { kind: "DOCX_PARAGRAPH"; paragraph: number };
  text: string; // sensitive; storage/parser boundary only
}

type ExtractionOutcome =
  | {
      kind: "SUCCEEDED";
      documentKind: "PDF" | "DOCX";
      segments: AsyncIterable<ExtractedSegment>;
      segmentCount: number;
      utf8Bytes: number;
      pageCount?: number;
      entryCount?: number;
      expandedBytes?: number;
      extractorVersion: string;
      rulesVersion: string;
    }
  | {
      kind: "FAILED";
      code:
        | "UNSUPPORTED_DOCUMENT"
        | "MALFORMED_DOCUMENT"
        | "DOCUMENT_ENCRYPTED"
        | "DOCUMENT_ACTIVE_CONTENT"
        | "DOCUMENT_LIMIT_EXCEEDED"
        | "EXTRACTION_EMPTY"
        | "EXTRACTION_TIMEOUT"
        | "EXTRACTION_FAILED";
    };

interface DocumentExtractor {
  extract(input: {
    declaredKind: "PDF" | "DOCX";
    declaredMediaType: string;
    plaintext: ReadableStream<Uint8Array>;
    maximumSourceBytes: 5000000;
    maximumOutputUtf8Bytes: 524288;
    deadline: Date;
  }): Promise<ExtractionOutcome>;
}
```

This contract may be invoked only after a persisted `CLEAN` assessment. Before
that result, callers may perform only bounded envelope/length/leading-magic
checks and MUST NOT open PDF object graphs, ZIP entries, or XML relationships.
The production implementation launches a child process with a 15-second hard
deadline and `--max-old-space-size=192`. It accepts data through bounded IPC or
anonymous streams, not a user-controlled filesystem path. The parent kills the
entire child process tree on timeout/abort and discards partial output.

PDF rules: valid header/catalog, 1..20 pages, no encryption/password request,
attachment, JavaScript/action, launch, or embedded content. DOCX rules: lazy ZIP
inspection, normalized unique paths, no traversal, <=1,000 entries, <=25 MiB
expanded, accepted compression only, required OPC/Word parts, entity-disabled
relationship parsing, no macros/OLE/ActiveX/external relationship. Mammoth is
used only for raw text with external file access disabled.

## 8. Extracted Segment Store

```ts
interface ExtractedSegmentStore {
  writeEncrypted(input: {
    uploadId: CvUploadId;
    extractionId: string;
    segments: AsyncIterable<ExtractedSegment>;
    maximumUtf8Bytes: 524288;
  }): Promise<{
    artifactId: ArtifactId;
    segmentIds: ReadonlySet<string>;
    segmentCount: number;
    utf8Bytes: number;
  }>;

  openAuthorized(input: {
    accountId: AccountId;
    uploadId: CvUploadId;
    artifactId: ArtifactId;
    purpose: "PARSER_DISPATCH";
  }): Promise<AsyncIterable<ExtractedSegment>>;
}
```

Only a currently owned parser job may call `openAuthorized`. No browser service,
general repository, logger, trace, or analytics module receives segments.

## 9. Parser

```ts
interface CvParserInput {
  inputVersion: "cv-segments-v1";
  schemaVersion: "cv-draft-v1";
  instructionVersion: "cv-extract-v1";
  segments: ReadonlyArray<ExtractedSegment>; // sensitive and <=512 KiB total
  safetyIdentifier: string; // purpose-separated HMAC; not account ID
  deadline: Date;
}

interface CvParserResult {
  output: unknown; // must pass the strict JSON schema as a whole
  dispatch: Readonly<{
    parserClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
    provider: string;
    model: string;
    inputVersion: "cv-segments-v1";
    instructionVersion: "cv-extract-v1";
    schemaVersion: "cv-draft-v1";
  }>;
}

interface CvParser {
  readonly parserClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";

  parse(input: CvParserInput): Promise<CvParserResult>;
}
```

The deterministic adapter is network-free, fixture-versioned, and rejected at
production startup. The OpenAI adapter uses the approved SDK/model snapshot,
strict Structured Outputs, `store=false`, no tools/files/conversation/background
mode, `reasoning.effort=none`, and SDK retry count zero. It has a 50-second
adapter timeout inside the service's 60-second hard deadline.

`CvParser` cannot import Prisma, repositories, sessions, artifact locators,
Profile services, or browser types. It cannot mutate any state.

## 10. Parser Output Validation and Draft Factory

```ts
interface CvDraftFactory {
  validateAndCreate(input: {
    accountId: AccountId;
    profileId: ProfileId;
    uploadId: CvUploadId;
    parseJobId: string;
    reviewedProfileRevision: number;
    parserOutput: unknown;
    validSegmentIds: ReadonlySet<string>;
    now: Date;
  }): Promise<{ draftId: CvDraftId; draftRevision: 0 }>;
}
```

Validation is all-or-nothing and applies:

- `contracts/cv-parser-output.schema.json`, no unknown properties;
- canonical UTF-8 output/draft byte caps;
- Feature 002 normalization, sanitization, length, URL, date, and collection caps;
- exact cited-segment membership and bounded evidence count;
- duplicate hints that are advisory only;
- server-generated proposal IDs and bounded server-derived context.

No invalid element is dropped or truncated. Failure creates no draft and maps to
`PARSER_OUTPUT_INVALID` or `PARSER_OUTPUT_LIMIT_EXCEEDED`.

## 11. Consent Ledger and Gate

```ts
interface CvExternalProcessingBinding {
  uploadId: CvUploadId;
  providerClass: "EXTERNAL_OPENAI";
  provider: "openai";
  model: "gpt-5.4-mini-2026-03-17";
  purposeVersion: "cv-profile-fact-extraction-v1";
  noticeVersion: string;
  consentTextVersion: string;
}

interface CvConsentReadGateway {
  requireLiveGrant(
    input: CvExternalProcessingBinding & {
      accountId: AccountId;
      dispatchAt: Date;
    },
  ): Promise<{ consentEventId: string }>;
}

interface CvConsentLedger extends CvConsentReadGateway {
  grant(
    input: CvExternalProcessingBinding & {
      accountId: AccountId;
      occurredAt: Date;
    },
  ): Promise<{ consentEventId: string }>;

  revoke(
    input: CvExternalProcessingBinding & {
      accountId: AccountId;
      occurredAt: Date;
    },
  ): Promise<{ consentEventId: string }>;
}
```

Provider/model/purpose/notice/text versions come from reviewed server
configuration, not the browser. Every dispatch calls `requireLiveGrant` after
claiming and immediately before transmission. The deployment startup gate must
also prove API configuration, DPA/privacy/cross-border approval, and verified
ZDR/equivalent control. Foundation implements only `CvConsentReadGateway` so
retry eligibility can fail closed without depending on consent mutations; US5
extends it with the `CvConsentLedger` grant/revoke lifecycle. Consent never
overrides a failed deployment gate.

## 12. Durable Worker and Leases

```ts
interface ClaimedWork<T> {
  work: T;
  leaseOwner: LeaseOwner;
  leaseExpiresAt: Date;
}

interface CvWorkRepository<TWork, TResult> {
  claimBatch(input: {
    stage: "SCAN" | "EXTRACTION" | "PARSE" | "DELETE" | "RECONCILE";
    owner: LeaseOwner;
    limit: number;
    now: Date;
    leaseDurationMs: number;
  }): Promise<ReadonlyArray<ClaimedWork<TWork>>>;

  finalize(input: {
    workId: string;
    owner: LeaseOwner;
    result: TResult;
    now: Date;
  }): Promise<"FINALIZED" | "LEASE_LOST">;
}

interface CvWorkerRuntime {
  run(signal: AbortSignal): Promise<void>;
  readiness(): Promise<{
    database: boolean;
    storage: boolean;
    scanner: boolean;
    cleanupEnabled: true;
  }>;
}
```

Claims use `FOR UPDATE SKIP LOCKED` and commit before I/O. Each loop has bounded
batch size/concurrency and uses an injected clock. Shutdown stops claims, aborts
bounded provider work, and leaves leases recoverable. Feature disablement may
stop new upload/parser dispatch but must not disable deletion/reconciliation.

## 13. Retry Service

```ts
interface CvRetryService {
  retry(input: {
    accountId: AccountId;
    uploadId: CvUploadId;
    idempotencyKey: string;
    now: Date;
  }): Promise<{
    uploadId: CvUploadId;
    status: "SCAN_QUEUED" | "PARSE_QUEUED";
    scanRetriesRemaining: number;
    parseRetriesRemaining: number;
  }>;
}
```

Only explicitly retryable terminal scan/parse states are accepted. Each initial
stage cycle consists of one initial attempt and at most two automatic retries
(three automatic attempts total). The service
locks quota/upload, verifies ownership, expiry, artifact availability, requires
a live exact external grant before consuming a parse retry, and checks the
separate two-scan/two-parse candidate-retry caps, then creates an immutable
`CvRetryRequest` and exactly one new stage attempt in one transaction. That
candidate attempt never restarts the automatic retry cycle.
The retry row binds the account-wide endpoint key HMAC, prior terminal attempt,
stage, and new attempt. An identical key returns the same attempt even after
later state changes; a rebound key conflicts.
Extraction structural failures require document replacement/manual entry rather
than repeatedly parsing the same unsafe structure.

## 14. Draft Read and Save

```ts
interface CvDraftComparisonService {
  get(input: {
    accountId: AccountId;
    draftId: CvDraftId;
  }): Promise<CvDraftComparisonView>;

  save(input: {
    accountId: AccountId;
    draftId: CvDraftId;
    baseDraftRevision: number;
    reviewedProfileRevision: number;
    proposalEdits: unknown;
    reviewDecisions: unknown;
    now: Date;
  }): Promise<{
    draftRevision: number;
    reviewedProfileRevision: number;
    savedAt: Date;
  }>;
}
```

`CvDraftComparisonView` is browser-safe: it includes sanitized proposals,
bounded verified evidence display, and the current owned Profile aggregate. It
does not include raw extracted text, a source download, hidden skipped content,
provider payloads, or internal IDs beyond owned Profile entry IDs needed for
replace choices.

If the draft has no saved review payload, the view contains server-derived
initial decisions: `ADD` for absent or unmatched Profile data, `REPLACE` for a
populated scalar or one normalized collection match, and `SKIP` only for an
ambiguous collection match or an existing skill that has no replacement
operation. A saved review payload is returned unchanged. Initial decisions are
non-mutating until the candidate completes the normal confirmation command.

Every save submits the complete bounded editable/review payload and uses
compare-and-swap. A stale draft returns `409 DRAFT_REVISION_CONFLICT` and safe
latest comparison metadata containing only the draft/Profile revisions and
their UTC `updatedAt` timestamps. A changed Profile returns
`409 PROFILE_REVISION_CONFLICT`. The client retains unsaved values in memory and
requires an explicit compare/reload action; it never silently overwrites them.

## 15. Confirmation Repository

```ts
interface ConfirmCvDraftCommand {
  accountId: AccountId;
  profileId: ProfileId;
  draftId: CvDraftId;
  draftRevision: number;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  idempotencyKey: string;
  now: Date;
}

interface CvConfirmationReceipt {
  receiptId: string;
  uploadId: CvUploadId;
  draftId: CvDraftId;
  confirmedAt: Date;
  draftRevision: number;
  sourceProfileRevision: number;
  reviewedProfileRevision: number;
  profileRevisionBefore: number;
  profileRevisionAfter: number;
  appliedCounts: Readonly<{
    scalars: number;
    experiences: number;
    education: number;
    skills: number;
    socialLinks: number;
  }>;
}

interface CvConfirmationRepository {
  confirm(command: ConfirmCvDraftCommand): Promise<CvConfirmationReceipt>;
}
```

The repository owns the atomic transaction documented in `data-model.md`. It
locks and revalidates, applies only the saved choices, increments Profile
revision once, freezes upload/draft, creates the receipt and audit event, and
schedules content deletion. An identical idempotent retry returns the original
receipt. The idempotency binding includes the exact draft, source Profile,
reviewed/current Profile revisions, and saved non-content manifest. A stale
revision or rebound key returns a non-mutating conflict. No service may apply
parser output outside this repository contract.

## 16. Cleanup and Reconciliation

```ts
interface CvRetentionService {
  cancelUploadForDeletion(input: {
    accountId: AccountId;
    uploadId: CvUploadId;
    now: Date;
  }): Promise<{
    uploadId: CvUploadId;
    status: "CANCELLED" | "DELETED";
    contentInaccessibleAt: Date;
    deleteAfter: Date;
    deletedAt: Date | null;
  }>;

  expireDue(now: Date, limit: number): Promise<number>;
  deleteDueArtifacts(now: Date, limit: number): Promise<number>;
  scrubDueDatabasePayloads(now: Date, limit: number): Promise<number>;
  reconcile(
    now: Date,
    limit: number,
  ): Promise<{
    checked: number;
    missingMarkedDeleted: number;
    orphansScheduled: number;
  }>;
}
```

Deletion first transitions an active import to `CANCELLED`, denies logical
access, and cancels queued work transactionally. Physical storage deletion and DB
payload scrubbing are separately leased and idempotent. Candidate-requested
deletion purges every source/extracted/draft/provenance payload within 24 hours
and changes the aggregate to `DELETED` only after cleanup completes. Other exact
deadlines are 24 hours for incomplete/rejected/infected content, 30 days maximum
for unconfirmed content, and seven days after confirm. Provider lifecycle rules
are safeguards only. Cleanup metrics expose counts and lag, never locators or
content.

## 17. Error Mapping

Service/repository/provider errors map at the Route Handler boundary:

| HTTP | Safe code                                   | Meaning                                          |
| ---: | ------------------------------------------- | ------------------------------------------------ |
|  400 | `VALIDATION_ERROR`                          | Strict metadata/review request is invalid        |
|  401 | `AUTHENTICATION_REQUIRED`                   | No valid Better Auth session                     |
|  403 | `FORBIDDEN` / `CSRF_REJECTED`               | Inactive account or mutation proof failed        |
|  404 | `CV_IMPORT_NOT_FOUND`                       | Unknown/foreign ID or purged tombstone           |
|  409 | `IDEMPOTENCY_KEY_REUSED`                    | Same key is bound to different input             |
|  409 | `DRAFT_REVISION_CONFLICT`                   | Another tab/device saved first                   |
|  409 | `PROFILE_REVISION_CONFLICT`                 | Candidate Profile changed after review           |
|  409 | `IMPORT_STATE_CONFLICT`                     | Action is invalid for current state              |
|  413 | `PAYLOAD_TOO_LARGE`                         | Declared/streamed body or JSON cap exceeded      |
|  415 | `UNSUPPORTED_MEDIA_TYPE`                    | Content-Type is not accepted                     |
|  422 | `DOCUMENT_REJECTED`                         | Safe terminal document/parser validation outcome |
|  429 | `UPLOAD_RATE_LIMITED` / `CV_QUOTA_EXCEEDED` | Rolling rate or account quota reached            |
|  503 | `CV_PROCESSING_UNAVAILABLE`                 | Configured scanner/provider gate unavailable     |

Unknown and foreign IDs share the same non-disclosing 404. An authenticated
owner may receive only the bounded content-free `CANCELLED`/`DELETED`/`EXPIRED`
tombstone defined by OpenAPI so cancellation and cleanup can be observed; no
source, draft, provenance, filename, or provider detail is recoverable. Error
details contain field paths and safe actions only, never rejected values or
document/provider content.

Draft-save validation uses canonical paths from the complete PATCH body. Scalar
choices that disagree with the authoritative current Profile return
`VALIDATION_ERROR` with field code `ACTION_MISMATCH` at
`reviewDecisions.scalars.{index}.action`. Normalized duplicate proposed skills
or social links return a safe duplicate code at the affected proposal field.
These are validation results, not concurrency conflicts; no partial draft write
or revision increment occurs.

## 18. Telemetry and Redaction Contract

Allowed dimensions:

- stage and safe state/result code;
- duration bucket, queue depth, lease age, retry ordinal;
- scanner engine/signature versions and calculated age;
- parser class/provider/model/instruction/schema versions;
- artifact kind and byte-size bucket;
- cleanup lag and idempotent outcome;
- opaque request/upload/job IDs only when approved for operational correlation.

Forbidden everywhere outside the narrow content interfaces:

- source/extracted bytes or snippets;
- original/display filename;
- email, phone, URL, name, employer, school, skill, or any Profile value;
- SHA-256/HMAC values, storage locator, IV/tag/key version combined with locator;
- consent text, prompt, response, raw scanner output, API key/token;
- exception serialization or request-body logging from content-owning code.

The logger uses allowlisted event builders, not object spreading. Provider and
parser errors are mapped before logging. Tests seed canary PII/secrets and fail
if any sink, snapshot, trace, or analytics event contains them.

## 19. Dependency Direction Rules

```text
app Route Handlers
  -> services
     -> repositories / abstract gateways
        -> Prisma, storage, ClamAV, extraction, parser implementations

frontend feature
  -> browser client + shared browser contracts only
```

- `frontend/**` cannot import `backend/**`, Node built-ins, Prisma, OpenAI, AWS,
  PDF.js, Mammoth, yauzl, ClamAV, encryption, or environment secrets.
- `app/**/route.ts` cannot import Prisma/provider implementations directly.
- parser implementations cannot import repositories/Profile mutation services.
- shared contracts cannot expose sensitive storage/parser-internal types.
- dependency checks run in architecture tests and the production build.
