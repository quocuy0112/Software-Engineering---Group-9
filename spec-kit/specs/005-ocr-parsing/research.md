# Research: Purpose-Specific OCR Parsing

This document resolves the technical unknowns for Feature 005. It is subordinate
to the SmartHire Constitution v2.1.0 and to the approved Feature 002, 003, and
004 plans. Decisions here are implementation choices behind replaceable
boundaries; they do not widen the product scope.

## 1. Additive Boundary and Existing Authorities

**Decision**: Add two purpose-specific OCR adapters without creating a generic
upload or generic AI-search subsystem.

- Candidate CV OCR extends only Feature 004's extraction stage. Feature 004
  remains authoritative for PDF/DOCX admission, Candidate ownership, ClamAV,
  structural validation, parser consent, temporary storage, draft review,
  Profile conflict detection, confirmation, and deletion.
- Image-assisted search extends only Feature 003's public-job discovery surface.
  OCR and AI produce a candidate `JobSearchQuery`; Feature 003 remains the sole
  authority for public visibility, matching, ranking, stable ordering,
  pagination, and response allowlisting.
- Candidate OCR content never enters search tables or indexes. Search images and
  OCR text never enter CV, Profile, application, saved-job, analytics, training,
  or job-index records.

**Rationale**: The two workflows have different actors, admission rules,
retention windows, and failure consequences. They share a narrow OCR engine
contract and policy vocabulary, not storage ownership or business state.

**Alternatives rejected**:

- A generic `/api/ocr` endpoint would erase purpose and authorization context.
- Treating a search image as a CV would violate the constitutional PDF/DOCX CV
  boundary.
- Allowing OCR/AI to query postings directly would bypass Feature 003's
  deterministic visibility and ranking rules.

## 2. OCR Engine and Runtime

**Decision**: Use a self-hosted, CPU-only OCR engine service pinned to Python
3.12, `paddleocr==3.7.0`, and `onnxruntime==1.27.0`. Use the PP-OCRv6 medium
detection and recognition models through PaddleOCR's general OCR pipeline. Bake
the exact model artifacts and checksums into an immutable image; runtime model
downloads and outbound network access are disabled.

PaddleOCR 3.7.0 is the current stable release listed by PyPI and introduces the
PP-OCRv6 family. The official OCR pipeline documentation identifies
PP-OCRv6-medium as the default 3.7 pipeline, describes the medium detector as the
highest-accuracy server choice, and states that its recognition model covers 50
languages. It also documents ONNX Runtime as a supported engine. ONNX Runtime
1.27.0 is the current stable CPU runtime on PyPI. Sources:
[PaddleOCR package](https://pypi.org/project/paddleocr/),
[PaddleOCR general OCR pipeline](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md),
[ONNX Runtime package](https://pypi.org/project/onnxruntime/).

The model is an initial provider choice, not an accuracy claim. Release remains
blocked until the committed Vietnamese/English/bilingual corpus meets SC-003
and the search workload meets SC-006. Model name, artifact digest, runtime,
policy, and engine image digest are recorded per attempt. Changing the engine
requires the same contract, corpus, security, and performance gates, not a
constitutional amendment.

**Service boundary**: `OcrEngine.recognize(normalizedPng, purpose, limits)`
accepts one already-clean, already-decoded, metadata-free PNG and returns only
ordered lines, polygons, per-line confidence, detected orientation, and version
metadata. It never receives PDF, DOCX, an original search image, account data,
storage locators, prompts, or provider credentials.

**Rationale**:

- One multilingual recognition model avoids language-switch heuristics for
  bilingual Vietnamese/English content.
- ONNX Runtime avoids coupling the initial engine image to PaddlePaddle's larger
  native runtime while retaining the official pipeline interface.
- A separate image keeps Python/native ML dependencies out of the Node web and
  CV worker trust boundaries and permits independent resource limits and model
  replacement.

**Alternatives rejected**:

- External cloud OCR is unnecessary for the initial release and would add a
  second content destination, consent path, retention policy, and availability
  dependency.
- PaddleOCR-VL and PP-Structure are broader document-understanding/VLM products;
  Feature 005 needs text recognition, not generative document interpretation.
- Browser OCR is deferred despite an official browser SDK because model
  download, device performance, memory, and result consistency would be
  uncontrolled, and server-side malware/admission enforcement would still be
  required.
- Embedding the Python runtime in `cv-worker` would enlarge the CV worker image
  and couple search scale to Candidate imports.

## 3. OCR Service Isolation and Protocol

**Decision**: Run `ocr-engine` as a non-root Linux sidecar with a read-only root
filesystem, no published or container TCP port, no egress, a bounded tmpfs, and
explicit CPU/RSS/PID limits. It listens on a dedicated Unix domain socket with
group-only `0660` access. Only `cv-worker` and the new `image-search-worker`
mount that socket. Next.js and the email worker do not.

The protocol is HTTP/1.1 over the Unix socket with a small OpenAPI contract.
Requests use `Content-Type: image/png`, a declared byte length, purpose enum,
deadline, and idempotent attempt identifier. Responses are strict JSON and are
rejected if unknown, oversized, non-finite, out of bounds, or version-mismatched.
The service has no tool, URL-fetch, file-fetch, or callback capability.

Initial hard limits:

- one PNG per request;
- at most 20 decoded megapixels after normalization;
- at most 25 MiB encoded PNG input;
- 20 seconds per OCR unit for CV processing;
- 6 seconds per search OCR request, leaving time for admission, scan, decode,
  AI interpretation, and UI delivery inside the 10-second P95 target;
- at most 64 KiB UTF-8 recognized text per unit and 2,000 lines; callers also
  enforce their stricter aggregate limits.

The engine loads and warms its pinned models before readiness succeeds. A CV
hybrid extraction starts one immutable 180-second deadline when its first
OCR-required manifest is claimed. All units, queue time, leases, and retries
share that deadline; at most two units run concurrently, a unit receives the
lesser of 20 seconds or the remaining aggregate time, and no retry resets the
clock. Search uses one six-second OCR request deadline; retries or lease recovery
consume the remaining time of the same query processing window. A worker timeout
cancels the request and discards the response. Late responses cannot commit
because the owning PostgreSQL lease, immutable deadline, and current state are
rechecked.

**Rationale**: Unix-socket permissions and mount isolation provide a smaller
local trust boundary than a network service. Separate limits prevent a search
burst from exhausting the CV worker or web process.

## 4. Image Safety and Normalization

**Decision**: Reuse Feature 004's ClamAV sidecar and fresh-signature fail-closed
policy, but give search images their own scan rows, storage namespace, worker,
and lifecycle. Before a persisted `CLEAN` assessment, handlers and workers may
perform only byte count, declared extension/media type, leading magic, and
stream-integrity checks.

After `CLEAN`, add `sharp==0.35.3` as an exact direct Node dependency for static
PNG/JPEG decode and normalization. Configure `limitInputPixels: 20_000_000`,
`limitInputChannels: 4`, never enable `unlimited`, reject multi-page/animated
input, auto-orient from EXIF, flatten transparency on white, convert to sRGB,
and encode a new PNG. Sharp documents both the decoded-pixel safety option and
that output metadata is removed by default. Sources:
[Sharp constructor options](https://sharp.pixelplumbing.com/api-constructor/),
[Sharp output and metadata behavior](https://sharp.pixelplumbing.com/api-output/),
[sharp package](https://www.npmjs.com/package/sharp).

Declared extension, media type, magic, actual length, decoder format, and static
frame count must all agree. PNG permits one image only; JPEG must contain one
decodable image. ICC/EXIF/XMP/IPTC/GPS and other unrelated metadata are absent
from the normalized PNG. Only the orientation effect survives.

For DOCX images, the same decoder is used after Feature 004's safe ZIP and
relationship checks. Original eligible images count toward the 20-image and
100-megapixel aggregate limits. An individual image above 20 megapixels is
decoded under an isolated 100-megapixel aggregate budget and downscaled to at
most 20 megapixels before OCR; it is not silently omitted.

**Alternatives rejected**:

- Using metadata dimensions alone is insufficient because dimensions must be
  confirmed by a bounded decoder.
- Passing originals directly to the ML engine would duplicate format parsing
  and preserve unwanted metadata.
- Using Sharp to render PDFs is rejected because PDF support depends on how the
  system libvips was compiled; the official constructor documentation notes the
  requirement for external PDFium/Poppler/ImageMagick/GraphicsMagick support.

## 5. PDF Native-Text Classification and Rendering

**Decision**: Keep `pdfjs-dist==6.2.108` as the single PDF parser. Extend the
existing isolated extraction child to return a per-page native-text manifest and
to render only eligible pages. Add exact `@napi-rs/canvas==1.0.2` as the
server-only Canvas implementation used by PDF.js. PDF.js officially supports
page viewport rendering and points to Node examples; `@napi-rs/canvas` supplies
prebuilt Node-API Skia bindings without system Cairo dependencies. Sources:
[PDF.js examples](https://mozilla.github.io/pdf.js/examples/),
[`@napi-rs/canvas` package](https://www.npmjs.com/package/%40napi-rs/canvas).

The eligibility policy is versioned as `cv-ocr-eligibility-v1`:

1. Run the existing structural checks and native extraction first.
2. Classify each page as `NATIVE_SUFFICIENT`, `OCR_REQUIRED_EMPTY`,
   `OCR_REQUIRED_SPARSE`, or `OCR_REQUIRED_SUSPICIOUS`.
3. Empty means no normalized visible characters. Sparse means fewer than 40
   Unicode letters/digits or less than 20 letters/digits per rendered megapixel,
   unless the page is intentionally short and its native text occupies visible
   page bounds.
4. Suspicious means one or more deterministic indicators: text is predominantly
   outside the crop/media box, invisible/near-transparent, glyph replacement or
   invalid-Unicode rate exceeds 10%, more than 60% of normalized tokens repeat
   without corresponding distinct positions, or the visible-page OCR token set
   materially conflicts with the native layer.
5. Render only required/suspicious pages at 200 DPI, preserving page rotation,
   with a maximum long edge of 4,096 pixels and maximum 20 megapixels. Render to
   a private `0700` attempt directory; never persist the raster as a CV artifact.

The suspicious conflict comparison is performed after OCR. A conflict is
material when both sources contain at least 20 normalized letters/digits and
their token-set similarity is below 0.60, or when a name/contact/experience-like
line appears in only one source with confidence at least 0.90. The page keeps
both sources, prefers native text for parser input when it is otherwise valid,
and exposes a review warning; it does not assert either as verified fact.

**Rationale**: PDF.js is already the approved parser and can render the same
page model used for native text. Selective rendering avoids a second full PDF
parser and keeps native-only CVs independent of OCR.

**Alternatives rejected**:

- Sending the PDF to PaddleOCR would duplicate structural validation and allow
  a second parser to interpret active or malformed document structures.
- Rendering every page increases cost and duplicate-text risk without helping
  native-only documents.
- Poppler/MuPDF subprocesses add another document parser, binary supply chain,
  and license/deployment surface when the existing parser can render pages.

## 6. DOCX Body Traversal and OCR Eligibility

**Decision**: Extend the existing safe DOCX extraction child before Mammoth
output is finalized. Traverse `word/document.xml` in document order and resolve
only internal image relationships from `word/_rels/document.xml.rels`. Eligible
content is an `a:blip`/`v:imagedata` referenced from the main body whose target
is a safe package-local PNG or JPEG. Record a stable body ordinal and nearest
paragraph/list anchor.

Headers, footers, footnotes, endnotes, comments, text boxes outside the resolved
main-body traversal, unreferenced media, external relationships, macros, OLE,
ActiveX, SVG, GIF, TIFF, and other unsupported types are excluded or rejected
under Feature 004's existing safety policy. Repeated use of the same relationship
is represented at each body occurrence but OCR bytes are memoized within the
attempt; deduplication later prevents repeated text from becoming duplicate
parser evidence.

The child first inventories every eligible image and confirms no more than 20
images and no more than 100 decoded megapixels in aggregate. Exceeding either
limit fails the whole extraction before partial OCR output is accepted. Native
paragraph/list segments and image placeholders share one traversal sequence;
OCR replaces each placeholder with source-labeled segments. If a floating image
has no exact text anchor, its segments are placed after the nearest deterministic
body paragraph with an `APPROXIMATE_ANCHOR` flag.

**Rationale**: Relationship-aware main-body traversal enforces the clarified
scope and gives deterministic ordering that Mammoth text alone cannot provide.

## 7. CV Segment, Confidence, Deduplication, and Parser Policy

**Decision**: Preserve `cv-segments-v1` and the current parser path unchanged for
native-only documents. Hybrid documents use `cv-segments-v2` and
`cv-draft-v2`. The v2 segment envelope adds source method, document unit,
order, OCR confidence, engine/model/policy versions, anchor quality, and warning
codes. The encrypted extracted artifact remains capped at 512 KiB.

Confidence policy `ocr-confidence-v1`:

- `HIGH`: aggregate line confidence `>= 0.90`;
- `REVIEW`: `>= 0.70` and `< 0.90`;
- `LOW`: `< 0.70`, empty, or structurally incomplete.

Confidence is never converted into a verified Candidate fact. `REVIEW` and
`LOW` segments and all material conflicts are visible in draft provenance.
`LOW` content may remain available as labeled review evidence when structurally
safe, but is not used to auto-populate a proposal unless corroborated by a
distinct native/high-confidence segment.

Deduplication policy `cv-segment-dedup-v1` runs only within a document unit and
adjacent repeated headers/footers. It normalizes NFKC, whitespace, case, and
Vietnamese diacritics only for comparison. Exact normalized duplicates keep the
native source; near-duplicates (`>=0.92` token similarity) are merged only when
their bounding regions/anchors overlap. Similar text from distinct body
locations remains separate. Every original unit receives an accounting outcome
even when its text is deduplicated.

The existing CV parser continues to create only a draft. V2 parser adapters must
cite segment IDs, preserve warning/provenance, reject unknown schema fields, and
cannot write Profile records. Existing Feature 004 review, revision, selection,
idempotent confirmation, and transaction rules remain unchanged.

**Alternatives rejected**:

- Replacing native text with OCR globally would regress reliable documents.
- Flattening provenance into one string would prevent review warnings and unit
  accounting.
- Fuzzy deduplication across the entire CV could remove distinct roles, skills,
  or repeated qualifications.

## 8. Search API and Asynchronous Lifecycle

**Decision**: Use a two-step admission/upload protocol matching Feature 004,
then poll content-free status and consume the result once.

1. `POST /api/jobs/image-searches` validates bounded metadata, same-origin
   context, idempotency, rate limits, processing choice, and consent metadata,
   then creates a 15-minute query and storage reservation.
2. `PUT /api/jobs/image-searches/{queryId}/content` streams the exact raw body to
   encrypted quarantine with declared length and magic enforcement.
3. `GET /api/jobs/image-searches/{queryId}` returns only status, stage,
   timestamps, safe failure code, retry time, and available actions with
   `Cache-Control: no-store`.
4. `POST /api/jobs/image-searches/{queryId}/result` validates the browser's
   currently visible Feature 003 criteria, applies the deterministic no-silent-
   overwrite merge, and atomically consumes either a validated intent or one-
   time OCR fallback into current browser memory. The current criteria are not
   persisted by this route. The server artifact becomes inaccessible and
   deletion-due in the same transaction. A second consume returns
   `RESULT_ALREADY_CONSUMED`.
5. `POST .../{queryId}/consent` grants or revokes the exact external-AI consent;
   `DELETE .../{queryId}` cancels and schedules immediate deletion.

The browser polls with TanStack Query using bounded backoff; SSE/WebSocket is not
introduced. A client-generated monotonic interaction ID remains only in React
memory. Starting a newer query, editing image-derived state, cancelling, or
navigating invalidates the older interaction. A result is applied only when its
query ID and interaction ID still match the current controller.

The server never executes the job search from the worker. It returns a validated
intent; the browser converts selected criteria to the existing `/jobs` query
parameters, and `/api/jobs`/`JobDiscoveryService` performs the authoritative
search.

**Rationale**: Durable rows make scan/OCR/AI work recoverable, while one-time
delivery and current-memory browser state meet the short retention boundary.
Polling reuses an established project pattern and needs no new long-lived
connection infrastructure.

## 9. Search Intent and AI Provider

**Decision**: Add a provider-independent `SearchIntentInterpreter` with two
adapters:

- `deterministic-v1` is the default local/test fallback. It recognizes only
  explicit enum labels, conservative bilingual synonyms, ISO/VND salary
  expressions, explicit locations/skills, and explicit supported relative
  posting windows.
- The optional production semantic adapter reuses the existing server-only
  OpenAI SDK `7.3.0` and approved model snapshot
  `gpt-5.4-mini-2026-03-17`, but with separate purpose
  `job-image-search-purpose-v1`, instruction `job-search-intent-v2`, and strict
  JSON Schema `job-search-intent-v1`. It uses the Responses API,
  `store=false`, background disabled, tools disabled, SDK retries zero, and a
  bounded deadline.

OpenAI structured outputs support strict JSON Schema, but provider output still
passes local Zod/schema validation and deterministic evidence checks before it
can affect the UI. Source:
[OpenAI Responses structured output reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/refusal/delta?lang=curl).

External dispatch sends only normalized bounded OCR text, purpose/version
metadata, and a purpose-separated HMAC safety identifier—never the image,
account ID, IP, browser identifier, job records, or current private state.
Production external mode requires the same DPA, Vietnamese cross-border review,
and verified Zero Data Retention/equivalent deployment gate as Feature 004.
OpenAI documents that Responses API application-state retention is otherwise 30
days, so `store=false` alone is not treated as the privacy gate. Source:
[OpenAI data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).

The interpreter output contains proposals, not jobs. Allowed fields are `q`,
`location`, `employmentType`, `experienceLevel`, `workArrangement`, `skills`,
`salaryMin`, `salaryMax`, `salaryCurrency`, `salaryPeriod`, and
`postedWithinDays`. `sort`, cursor, job IDs, scores, private fields, and actions
are absent from the schema.

Selection policy `search-intent-selection-v2`:

- The provider returns short verbatim OCR excerpts rather than offsets. The
  server finds each excerpt in normalized OCR text, derives Unicode code-point
  ranges locally, and verifies values against the existing
  `jobSearchQuerySchema` limits.
- `EXPLICIT` or `NORMALIZED` criteria with verified evidence and confidence
  `>=0.90` may be selected automatically.
- `INFERRED` criteria and valid criteria with confidence `>=0.60` and `<0.90`
  are visible but unselected.
- Criteria below `0.60`, unsupported fields, contradictions, excess items,
  unverifiable evidence, or values that fail Feature 003 validation are
  discarded with safe warnings.
- Existing non-empty manual scalar/query values are never silently overwritten;
  conflicting image criteria remain unselected. Set-valued criteria are merged
  without duplicates. Unrelated manual criteria are preserved.

Confidence is one signal and cannot override evidence/type validation. The
result contains at most 20 proposals and a 32-KiB UTF-8 OCR input/output bound.
If valid intent cannot be produced, the one-time fallback is consumed for its
safe reason only. The client discards recognized text and does not prefill the
global header query or ordinary job-search filters.

Instruction v2 treats explicit role labels such as `Headline`, `Job title`,
`Position`, and their Vietnamese equivalents as strong occupation evidence. If
duties or skills imply a role without naming one, it may provide a best-effort
occupation prediction as `INFERRED`; that proposal remains unselected and the
review UI asks the user to confirm it.

**Alternatives rejected**:

- Letting the model return a `JobSearchQuery` without per-criterion provenance
  cannot distinguish explicit filters from inferences.
- Model-selected sort or job IDs would influence ranking/retrieval and violate
  the constitution.
- Silent cross-provider fallback would invalidate consent and traceability.

## 10. Search Storage, Result Delivery, and Deletion

**Decision**: Add a separate `PrivateSearchArtifactStorage` interface and
namespace with the same AES-256-GCM envelope/integrity design as Feature 004 but
different context labels, keys, database rows, local root/S3 prefix, IAM policy,
and cleanup ownership. Do not reuse a `CvStoredArtifact` row or locator.

Artifact kinds are `SOURCE_IMAGE`, `NORMALIZED_IMAGE`, `OCR_TEXT`, and
`VALIDATED_INTENT`. Source and normalized images are encrypted objects. OCR text
and intent are also encrypted artifacts, never PostgreSQL text/JSON columns.
PostgreSQL stores content-free lifecycle, byte counts, hashes, version metadata,
and deletion evidence.

All artifacts share `deleteBy = admittedAt + 15 minutes`. Success, terminal
failure, cancellation, expiry, or result consumption sets
`contentInaccessibleAt` and `deleteAfter=now` immediately. Cleanup uses short
leases and retries, but never moves `deleteBy`. Late workers must recheck both
the work lease and `deleteBy`; they cannot create or attach an artifact after
the deadline. Reconciliation treats unreferenced objects as immediate-delete
orphans.

The one-time result endpoint decrypts and validates the result, commits the
consumed/inaccessible state, and returns it with `no-store`. The browser keeps
fallback OCR text only in component memory; it is excluded from URL,
localStorage, sessionStorage, Zustand, persisted TanStack caches, service-worker
caches, crash reports, and analytics. Validated selected criteria may enter the
ordinary `/jobs` URL because they have passed Feature 003 validation; raw text,
provenance excerpts, query IDs, and capabilities do not.

**Rationale**: A durable encrypted artifact supports asynchronous recovery but
the hard deadline and one-time consumption prevent it from becoming a search
history or index.

## 11. Anonymous Ownership and Rate Limiting

**Decision**: Better Auth remains the exclusive browser-session owner.
Authenticated query ownership is derived from its server-validated active
account session. Feature 005 creates no auth session, JWT browser session, or
persistent client credential.

For visitors:

- Admission sets or reads a random `__Host-smarthire-image-rate` cookie with
  `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`, used only as
  a reset-resistant browser
  rate-limit signal. It grants no identity, account, query access, or
  authorization and is not an authentication/session token.
- The server stores only versioned HMAC digests of the browser nonce and
  normalized source IP. Raw IP and nonce are not retained in query/audit rows.
- Query creation returns a separate 256-bit opaque capability once. Only its
  HMAC digest is stored. The browser keeps it in current React memory and sends
  it in `X-Image-Search-Capability` for upload/status/result/cancel. It is never
  placed in a cookie, URL, browser storage, logs, or analytics and expires no
  later than the query's 15-minute deadline.

PostgreSQL admission events enforce a rolling window transactionally:

- visitors require both fewer than 3 IP events and fewer than 3 browser events
  in the preceding hour; one admitted query inserts both events atomically;
- authenticated users require fewer than 10 account events in the preceding
  hour;
- rejected reservations do not create content artifacts; admitted incomplete
  reservations still count, preventing cheap reservation abuse;
- the response exposes the maximum applicable `retryAt`;
- events are content-free and deleted after the rolling window plus five
  minutes of clock/reconciliation margin.

**Alternatives rejected**:

- A visitor capability cookie used for query authorization could resemble a
  second browser session and would persist query access beyond the interaction.
- IP-only limiting unfairly affects shared networks and is easy to rotate;
  browser-only limiting is easy to reset. The specification requires both.
- Redis is not needed for the stated scale; PostgreSQL transactions and indexes
  preserve one authoritative admission decision.

## 12. Worker Topology and Failure Isolation

**Decision**: Keep the existing `cv-worker` and add an independent
`image-search-worker` process/container. Both use PostgreSQL lease claims and
the private OCR socket, but they have separate claim queries, concurrency,
timeouts, storage roots, cleanup loops, and failure budgets.

- `cv-worker`: scan -> existing structural/native extraction -> selective
  render/image extraction -> OCR -> v1/v2 segment store -> existing parser and
  review. Native-sufficient documents do not call the OCR service.
- `image-search-worker`: scan -> safe decode/normalize -> OCR -> optional
  consent-gated AI interpretation -> one-time result -> cleanup.
- `ocr-engine`: normalized PNG -> bounded line result only.
- `clamav`: retains the current fresh-signature Unix-socket boundary. Both
  workers may mount it; the web process cannot.

PostgreSQL `FOR UPDATE SKIP LOCKED` claims, bounded leases, idempotent stage
finalization, and current-state/deadline guards handle duplicates and crashes.
Search work is prioritized by the 15-minute deadline and has a small independent
concurrency cap. CV extraction has the longer Feature 004 window. An OCR outage
therefore leaves native CV extraction and manual text search operational.

**Rationale**: Search latency and anonymous load must not starve Candidate CV
processing. A shared OCR implementation still provides one model and contract.

## 13. Testing, Corpus, and Performance Evidence

**Decision**: Commit only synthetic/licensed fixtures and content-free labels.
The required corpus is stratified by purpose, language (`vi`, `en`, bilingual),
quality, rotation/perspective, layout, native/mixed/image-only status, and
security case. Ground-truth text and intent labels are test data; real CVs or job
posters are prohibited.

The release corpus contains at least 180 unique fixtures and 18,000 labeled
words. Fixtures may overlap stratification axes, but the overall unique-fixture
floor is independent. Minimum cohorts are:

| Cohort                       | Fixtures | Words | Required internal distribution                                                                                                   |
| ---------------------------- | -------: | ----: | -------------------------------------------------------------------------------------------------------------------------------- |
| Vietnamese                   |       40 | 4,000 | Both CV and poster content.                                                                                                      |
| English                      |       40 | 4,000 | Both CV and poster content.                                                                                                      |
| Bilingual Vietnamese/English |       40 | 4,000 | Mixed lines and English technical terms with Vietnamese diacritics.                                                              |
| Layout variation             |       40 | 4,000 | At least 10 each: CV/resume page, job poster, structured form/table, multi-column screenshot.                                    |
| Quality variation            |       40 | 4,000 | At least 10 each: low resolution, skew/perspective, noisy/compressed, low contrast/blur.                                         |
| Security/edge                |       30 | 1,000 | At least 5 each: malicious/signature, malformed/truncated, polyglot/animated, decompression-limit, prompt-like, excluded-region. |

Purpose floors are 60 CV fixtures/6,000 words and 60 poster fixtures/6,000
words. The poster cohort contains at least 20 Vietnamese, 20 English, and 20
bilingual fixtures and covers every supported intent field with positive,
negative, and confidence-boundary labels. Structurally rejected zero-text
fixtures count only toward the security fixture floor; they are excluded from
word-accuracy denominators, while the text-bearing security subset still
provides at least 1,000 labeled words. Corpus review records fixture hashes,
license/source class, label reviewer, and an immutable manifest version before
evaluation begins.

Accuracy uses Unicode-aware word error rate after NFKC and whitespace
normalization while preserving Vietnamese diacritics in the expected/actual
text. Report overall word accuracy and each language, layout, quality, purpose,
and security cohort independently; zero-text rejection results are separate.
Search-intent scoring compares supported field/value/selection labels, not job
results generated by AI. Deterministic result equivalence is tested by sending
the final criteria through Feature 003 twice.

Performance gates use a warmed OCR engine and separately report cold startup.
The representative local qualification profile is at least 4 dedicated CPU
cores and 8 GiB RAM for `ocr-engine`, 2 cores/1 GiB for each Node worker, a
local PostgreSQL/ClamAV sidecar, 100 warm image-search samples at concurrency 4,
and the documented 60-fixture minimum CV matrix at concurrency 2. Evidence
records P50/P95/P99,
maximum, error rate, sample/dataset size, duration, resource ceiling,
provider mode, model digests, and cold/warm state. `SELF_TEST` is never release
evidence.

Required failure injection includes stale ClamAV definitions, malware,
decoder bombs, engine timeout/crash/oversized response, model mismatch, lease
expiry, external-AI timeout/invalid schema, consent revocation race, deletion
failure, late result, duplicate consume, shared-IP/browser/account quotas, and
client supersession. Log/trace/metric/URL/browser-storage canaries prove that no
content or capability leaks.

**Rationale**: Provider benchmarks do not prove the product's Vietnamese CV and
job-poster quality. The specification thresholds must be measured on the exact
pipeline and resource profile.

## 14. Dependency and Supply-Chain Gate

**Decision**: Pin all runtime artifacts exactly and review both ecosystems.

- npm: existing `pdfjs-dist==6.2.108`; direct `sharp==0.35.3`;
  `@napi-rs/canvas==1.0.2`; existing `openai==7.3.0` and other locked Feature
  003/004 dependencies. One root `package-lock.json` remains authoritative.
- Python image: Python 3.12 base by immutable digest; `paddleocr==3.7.0` and
  `onnxruntime==1.27.0`, FastAPI `0.139.2`, Uvicorn `0.51.0`, and Pydantic
  `2.13.4` from a hash-locked requirements file; Pytest `9.1.1` is test-stage
  only; no training, document-parser, VLM, translation, or other optional
  extras. Version evidence comes from the maintainers' PyPI releases:
  [FastAPI](https://pypi.org/project/fastapi/),
  [Uvicorn](https://pypi.org/project/uvicorn/),
  [Pydantic](https://pypi.org/project/pydantic/), and
  [Pytest](https://pypi.org/project/pytest/).
- Model files: exact PP-OCRv6 medium detector/recognizer/orientation assets with
  license, source URL, SHA-256, and model manifest committed as metadata, not
  mutable runtime downloads.
- Containers: base and engine images pinned by digest, SBOM generated, license
  and vulnerability review recorded, non-root/read-only/no-egress controls
  verified.

An unresolved high/critical finding, incompatible native binary, model-license
problem, corpus failure, or inability to meet the resource/latency gate blocks
the selected dependency and triggers substitution through `OcrEngine`,
`ImageNormalizer`, `SearchIntentInterpreter`, or storage interfaces.

## Resolved Unknowns

All planning unknowns are resolved:

- OCR engine/runtime/model: self-hosted PaddleOCR 3.7.0, PP-OCRv6 medium, ONNX
  Runtime 1.27.0, Python 3.12, corpus-gated.
- Engine topology: no-network Unix-socket sidecar; normalized PNG only.
- Image decoder: Sharp 0.35.3 with explicit pixel/frame/metadata policy.
- PDF renderer: existing PDF.js plus `@napi-rs/canvas` 1.0.2; selective 200-DPI
  pages only.
- DOCX scope: main-document internal PNG/JPEG relationships only, body-order
  placeholders, 20 images/100 megapixels.
- CV eligibility/confidence/dedup: versioned deterministic policies with exact
  initial thresholds and v1 native regression path.
- Search AI: provider-independent interpreter, deterministic fallback, optional
  separately consented existing OpenAI adapter, strict evidence validation.
- Search API/storage: durable asynchronous two-step upload, encrypted
  purpose-specific artifacts, one-time result delivery, hard 15-minute delete.
- Visitor ownership/rate limit: memory-only query capability plus non-auth rate
  cookie, HMAC subjects, PostgreSQL rolling events.
- Session owner: unchanged Better Auth opaque PostgreSQL-backed session.
- Worker/recovery topology: separate CV and image-search workers sharing only
  scanner/OCR contracts, not business storage or queues.
- Quality evidence: committed stratified corpus, exact accuracy/latency/failure/
  privacy gates before release.
