# Internal Contracts: Purpose-Specific OCR Parsing

These contracts define module boundaries, not public implementation code. Exact
TypeScript names may change only if the same inputs, outputs, limits, and
authority boundaries remain explicit and contract-tested.

## 1. OCR Engine Port

```ts
type OcrPurpose = "CV_IMPORT" | "JOB_IMAGE_SEARCH";

type NormalizedPng = Readonly<{
  bytes: Uint8Array;
  width: number;
  height: number;
  decodedPixels: number;
  sha256: Uint8Array;
}>;

type OcrRecognitionRequest = Readonly<{
  attemptId: string;
  purpose: OcrPurpose;
  image: NormalizedPng;
  deadline: Date;
  expectedModelManifestSha256: string;
  signal: AbortSignal;
}>;

type OcrLine = Readonly<{
  id: string;
  order: number;
  text: string;
  confidence: number;
  polygon: readonly [Point, Point, Point, Point];
}>;

type OcrRecognitionResult = Readonly<{
  schemaVersion: "ocr-lines-v1";
  attemptId: string;
  purpose: OcrPurpose;
  engine: {
    name: "paddleocr-onnx";
    version: string;
    runtimeName: "onnxruntime";
    runtimeVersion: "1.27.0";
    modelName: "PP-OCRv6-medium";
    modelManifestSha256: string;
  };
  image: {
    width: number;
    height: number;
    decodedPixels: number;
    detectedOrientationDegrees: 0 | 90 | 180 | 270;
  };
  lines: readonly OcrLine[];
  summary: {
    lineCount: number;
    utf8Bytes: number;
    averageConfidence: number | null;
    minimumConfidence: number | null;
  };
}>;

interface OcrEngine {
  assertReady(expectedModelManifestSha256: string): Promise<void>;
  recognize(input: OcrRecognitionRequest): Promise<OcrRecognitionResult>;
}
```

Contract rules:

- The adapter accepts normalized PNG bytes only. It rejects original JPEG/PNG,
  PDF, DOCX, paths, URLs, streams without known bounds, and any request after its
  deadline.
- Caller and service both enforce 20 megapixels, 25 MiB encoded input, 2,000
  lines, and 64 KiB UTF-8 output. Search callers additionally enforce 32 KiB.
- Attempt ID, purpose, dimensions, engine/runtime/model, and manifest digest
  must round-trip exactly. A mismatch rejects the entire result.
- Line IDs/orders are unique, text is valid normalized Unicode, polygons fall
  inside image bounds, confidence is finite `[0,1]`, and summary recomputes from
  lines. Unknown fields reject the entire result.
- `UnixOcrEngine` is the initial adapter. No arbitrary socket path, base URL,
  redirect, proxy, or provider endpoint is accepted from a request.

## 2. Image Normalizer Port

```ts
type ImageNormalizationPurpose = "DOCX_BODY_IMAGE" | "JOB_IMAGE_SEARCH";

type ImageNormalizationRequest = Readonly<{
  purpose: ImageNormalizationPurpose;
  cleanAssessmentId: string;
  source: AsyncIterable<Uint8Array>;
  declaredFormat: "png" | "jpeg";
  maximumSourceBytes: number;
  maximumDecodedPixels: number;
  maximumOutputBytes: number;
  signal: AbortSignal;
}>;

type ImageNormalizationResult = Readonly<{
  format: "png";
  bytes: Uint8Array;
  sourceFormat: "png" | "jpeg";
  width: number;
  height: number;
  sourceDecodedPixels: number;
  normalizedPixels: number;
  frameCount: 1;
  metadataRemoved: true;
  autoOriented: boolean;
  downscaled: boolean;
  normalizer: "sharp";
  normalizerVersion: "0.35.3";
  rulesVersion: "search-image-normalize-v1" | "docx-image-normalize-v1";
}>;

interface ImageNormalizer {
  normalize(
    input: ImageNormalizationRequest,
  ): Promise<ImageNormalizationResult>;
}
```

The implementation requires a persisted current clean scan before opening
source bytes. Search uses a strict 20-megapixel decode limit. DOCX first applies
its aggregate 100-megapixel inventory in the isolated extraction process, then
may downscale one eligible image to 20 megapixels for the OCR request. Output
has no EXIF/ICC/XMP/IPTC/GPS or animation.

## 3. CV Extraction Manifest

The isolated document child has no network, database, storage adapter, OCR
client, or provider credential. It validates structure, extracts native text,
and produces an ephemeral manifest plus private raster/image files under the
attempt directory.

```ts
type CvUnitClassification =
  | "NATIVE_SUFFICIENT"
  | "OCR_REQUIRED_EMPTY"
  | "OCR_REQUIRED_SPARSE"
  | "OCR_REQUIRED_SUSPICIOUS"
  | "ELIGIBLE_BODY_IMAGE"
  | "EXCLUDED_NON_BODY_IMAGE"
  | "EXCLUDED_UNSUPPORTED_IMAGE"
  | "NON_TEXT";

type CvExtractionUnit = Readonly<{
  unitKey: string;
  ordinal: number;
  kind: "PDF_PAGE" | "DOCX_BODY_IMAGE";
  classification: CvUnitClassification;
  nativeSegments: readonly NativeSegment[];
  pageNumber: number | null;
  bodyOrdinal: number | null;
  imageOrdinal: number | null;
  anchorSegmentId: string | null;
  anchorQuality: "EXACT" | "APPROXIMATE" | "PAGE_ONLY" | "NOT_APPLICABLE";
  privateNormalizedPngPath: string | null;
  sourceDecodedPixels: number | null;
}>;

type CvExtractionManifest = Readonly<{
  schemaVersion: "cv-extraction-manifest-v1";
  documentKind: "PDF" | "DOCX";
  eligibilityPolicyVersion: "cv-ocr-eligibility-v1";
  pageCount: number | null;
  entryCount: number | null;
  expandedBytes: number;
  eligibleImageCount: number;
  eligibleImageDecodedPixels: number;
  units: readonly CvExtractionUnit[];
}>;
```

Rules:

- PDF page ordinals and one-based page numbers are complete from 1 through
  `pageCount`; no page disappears.
- DOCX units derive only from `word/document.xml` and its internal relationship
  file. Main-body order and nearest anchor are deterministic.
- The child fails before accepting partial OCR work if PDF pages exceed 20,
  DOCX images exceed 20, aggregate decoded pixels exceed 100,000,000, ZIP rules
  fail, or output manifest/path bounds fail.
- Every returned file must resolve inside the exact generated attempt directory,
  be mode `0600`, be a static metadata-free PNG, and be removed by the parent in
  `finally`. Paths never enter a database or log.
- Native-only manifests can be converted to the existing v1 segments without
  initializing `OcrEngine`.

## 4. CV Hybrid Segment Merger

```ts
type HybridMergeRequest = Readonly<{
  manifest: CvExtractionManifest;
  recognizedUnits: ReadonlyMap<string, OcrRecognitionResult>;
  eligibilityPolicyVersion: "cv-ocr-eligibility-v1";
  confidencePolicyVersion: "ocr-confidence-v1";
  deduplicationPolicyVersion: "cv-segment-dedup-v1";
  maximumUtf8Bytes: 524288;
}>;

type HybridMergeResult = Readonly<{
  schemaVersion: "cv-segments-v2";
  segments: readonly CvSegmentV2[];
  units: readonly ContentFreeUnitOutcome[];
  nativeSegmentCount: number;
  ocrSegmentCount: number;
  lowConfidenceUnitCount: number;
  conflictUnitCount: number;
  utf8Bytes: number;
}>;

interface CvHybridSegmentMerger {
  merge(input: HybridMergeRequest): HybridMergeResult;
}
```

The merger is deterministic and pure. It cannot call a parser/Profile
repository. It rejects missing required units, extra/mismatched OCR results,
oversized output, invalid confidence/geometry, and any unit without accounting.
Native text remains preferred. Material conflicts keep labeled evidence from
both methods. Deduplication uses unit/anchor overlap and never fuzzy-deduplicates
unrelated CV sections.

## 5. Search Intent Interpreter Port

```ts
type SearchIntentInterpretRequest = Readonly<{
  text: string;
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  purposeVersion: "job-image-search-purpose-v1";
  inputVersion: "search-ocr-text-v1";
  instructionVersion: "job-search-intent-v2";
  schemaVersion: "job-search-intent-v1";
  allowedFields: readonly AllowedImageSearchField[];
  safetyIdentifier?: string;
  deadline: Date;
  signal: AbortSignal;
}>;

type RawIntentProposal = Readonly<{
  id: string;
  field: AllowedImageSearchField;
  stringValue: string | null;
  numberValue: number | null;
  stringValues: readonly string[];
  confidence: number;
  basis: "EXPLICIT" | "NORMALIZED" | "INFERRED";
  evidenceText: readonly string[];
}>;

interface SearchIntentInterpreter {
  readonly interpreterClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  interpret(
    input: SearchIntentInterpretRequest,
  ): Promise<readonly RawIntentProposal[]>;
}
```

Allowed fields are exactly:

```text
q, location, employmentType, experienceLevel, workArrangement, skills,
salaryMin, salaryMax, salaryCurrency, salaryPeriod, postedWithinDays
```

`sort`, cursor, limit, job IDs, company/private fields, result lists, ranking,
scores, recommendations, Candidate/Profile/application data, and actions cannot
be represented by the type or provider JSON Schema.

The external adapter receives only the bounded normalized text, field schema,
purpose/version data, and HMAC safety identifier after a current consent check.
Tools, image/file input, background processing, response reuse, and SDK retries
are disabled. Provider output is untrusted until local selection policy succeeds.

## 6. Search Intent Selection Policy

```ts
type ExistingManualSearch = Readonly<{
  q: string;
  location: string;
  employmentType: readonly string[];
  experienceLevel: readonly string[];
  workArrangement: readonly string[];
  skills: readonly string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: string;
  postedWithinDays?: number;
  sort: "RELEVANCE" | "NEWEST" | "SALARY_DESC";
}>;

type ValidatedIntent = Readonly<{
  schemaVersion: "job-search-intent-v1";
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  proposals: readonly ValidatedIntentProposal[];
  warnings: readonly SearchIntentWarning[];
}>;

interface SearchIntentSelectionPolicy {
  validateAndSelect(input: {
    ocrText: string;
    proposals: readonly RawIntentProposal[];
    policyVersion: "search-intent-selection-v2";
  }): ValidatedIntent;
  mergeForDelivery(input: {
    intent: ValidatedIntent;
    existingManualSearch: ExistingManualSearch;
    policyVersion: "search-intent-selection-v2";
  }): ValidatedIntent;
}
```

The policy must:

1. find every exact provider-supplied evidence excerpt in the normalized OCR
   input, derive Unicode code-point ranges locally, and reject unverifiable
   excerpts instead of trusting provider-calculated offsets;
2. validate each carrier/field/value against the existing Feature 003 Zod
   schemas, including enum, array, currency, salary-range, and posting-window
   bounds;
3. reject any unknown, contradictory, excessive, duplicate, or unverifiable
   proposal;
4. auto-select only `EXPLICIT|NORMALIZED` plus confidence `>=0.90` plus verified
   evidence and no manual scalar conflict;
5. keep `INFERRED` or confidence `[0.60,0.90)` unselected;
6. discard confidence `<0.60`;
7. during one-time delivery, validate the browser's current visible criteria
   with the existing Feature 003 schema, preserve non-empty manual scalar/query
   values, and merge set fields without duplicates; generated conflicts remain
   unselected, but a later explicit user selection replaces that corresponding
   form field when the browser starts the reviewed search;
8. produce at most 20 proposals and validate both the stored candidate intent
   and final delivered intent against
   `search-intent.schema.json`.

The worker runs `validateAndSelect` without private/current job data. The result
service runs `mergeForDelivery` using `currentCriteria` from the consume request
without persisting those criteria. The policy does not execute a search. A
separate UI mapper converts selected visible proposals into the existing
`JobSearchQuery`, preserving the user's current sort. That query returns through
`JobDiscoveryService` unchanged.

## 7. Purpose-Specific Storage Ports

Feature 004's `PrivateCvStorage` remains unchanged. Search uses a separate type
so a CV locator cannot be passed accidentally.

```ts
type SearchStorageContext = Readonly<{
  queryId: string;
  artifactId: string;
  kind: "SOURCE_IMAGE" | "NORMALIZED_IMAGE" | "OCR_TEXT" | "VALIDATED_INTENT";
}>;

interface PrivateSearchArtifactStorage {
  assertReady(): Promise<void>;
  put(input: {
    source: AsyncIterable<Uint8Array>;
    expectedBytes: number;
    context: SearchStorageContext;
  }): Promise<{ locator: SearchArtifactLocator; bytes: number }>;
  open(locator: SearchArtifactLocator): AsyncIterable<Uint8Array>;
  delete(locator: SearchArtifactLocator): Promise<"DELETED" | "ALREADY_ABSENT">;
}
```

`SearchArtifactLocator` and CV locator types are distinct branded types.
Encryption uses `search-image-artifact-v1` associated-data context and a search
keyring. Search code cannot import the CV keyring/storage root, and CV code
cannot import the search keyring/storage root. Neither returns a public URL.

## 8. Query Authorization Port

```ts
type ImageSearchActor =
  | Readonly<{ kind: "AUTHENTICATED"; accountId: string; sessionId: string }>
  | Readonly<{
      kind: "VISITOR";
      browserSubjectDigest: Uint8Array;
      capability: string;
    }>;

interface ImageSearchAuthorization {
  authorize(input: {
    actor: ImageSearchActor;
    queryId: string;
    operation: "UPLOAD" | "STATUS" | "CONSENT" | "RESULT" | "CANCEL";
    now: Date;
  }): Promise<AuthorizedImageSearchQuery>;
}
```

Authenticated actors come only from Better Auth server validation. Visitor
capability is accepted only from `X-Image-Search-Capability`, compared through a
constant-time HMAC, and never returned after creation. Authorization rejects
expired, inaccessible, deleted, wrong-actor, or wrong-capability queries with a
non-disclosing result.

The rate cookie is not an authorization input. It is not sufficient to access a
query.

## 9. Admission Repository Contract

```ts
interface ImageSearchAdmissionRepository {
  admit(input: {
    actor:
      | { kind: "AUTHENTICATED"; accountId: string }
      | {
          kind: "VISITOR";
          sourceIpDigest: Uint8Array;
          browserDigest: Uint8Array;
          capabilityDigest: Uint8Array;
          capabilityKeyVersion: number;
        };
    metadata: CreateImageSearchMetadata;
    idempotencyDigest: Uint8Array;
    bindingDigest: Uint8Array;
    now: Date;
  }): Promise<
    | { kind: "ADMITTED"; query: SearchImageReservation; replay: boolean }
    | { kind: "LIMITED"; retryAt: Date }
  >;
}
```

The repository uses transaction-scoped advisory locks for all applicable
subject digests, counts events in `[now-1h, now)`, and atomically creates 2
visitor events or 1 account event. Limits are 3 and 10 respectively. Identical
idempotency replay returns the same query and does not insert new events; changed
binding rejects.

## 10. Work Claim and Commit Guards

Every search/CV OCR worker write uses a guard containing:

```ts
type OcrStageCommitGuard = Readonly<{
  purpose: "CV_IMPORT" | "JOB_IMAGE_SEARCH";
  workId: string;
  parentId: string;
  expectedParentState: readonly string[];
  leaseOwner: string;
  now: Date;
  hardDeadline?: Date;
  consentEventId?: string;
}>;
```

The repository must atomically prove:

- work is `PROCESSING`, owned by the caller, and lease expiry is after `now`;
- parent still belongs to the expected account/purpose and is accessible;
- parent state is one of the exact predecessor states;
- search `now < deleteBy` and no cancellation/expiry/consume occurred;
- clean scan/source/output relationships match;
- external consent is still the latest grant for the exact destination and no
  later revocation exists;
- output artifact kind/context/query is exact;
- attaching output and moving/queuing state happens once.

Failure is `STAGE_RESULT_DISCARDED`; the worker deletes any unattached object
and does not retry a stale result.

## 11. One-Time Result Contract

`consumeResult` returns only after a transaction changes the query to
`CONSUMED`, sets content inaccessible, and makes all artifacts immediately due.
The response is one of the two public schemas in `openapi.yaml`.

- `VALIDATED_INTENT`: final locally validated proposal artifact. Selected
  criteria may be mapped to `/jobs`; evidence excerpts remain browser memory.
- `OCR_TEXT_FALLBACK`: at most 32 KiB of bounded recognized text plus safe
  warnings. The client uses only the safe warning to explain why AI filters were
  not created, discards the text immediately, and never copies it into the
  global header query or Feature 003 filters.

If response transmission fails after commit, the content is not re-delivered.
The UI reports that the one-time result is unavailable and keeps ordinary manual
search enabled. This fail-closed behavior is preferable to extending server
retention or making the capability replayable.

## 12. Safe Telemetry Contract

Permitted dimensions:

- purpose, actor class, stage, safe result/failure code;
- queue/processing/deletion duration and bounded byte/pixel/count buckets;
- engine/runtime/model/policy/schema/instruction versions;
- consent present/absent/revoked as booleans;
- attempt number, retry/lease outcome, deletion result.

Prohibited dimensions/payloads:

- source or normalized image bytes;
- CV/native/OCR text, proposals, filter values, evidence, prompts, provider
  request/response bodies, filenames;
- account email/name, Profile/application/company/private data;
- raw account/session ID, IP, browser nonce, visitor capability, idempotency key,
  provider key/request ID, storage locator, encryption material, digests usable
  as stable cross-purpose identifiers.

Audit targets use a purpose-separated short HMAC reference, never a storage or
content identifier. Contract tests seed canaries in every prohibited category
and scan all observable sinks.
