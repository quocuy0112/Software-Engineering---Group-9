# Implementation Plan: Purpose-Specific OCR Parsing

**Branch**: `005-ocr-parsing` | **Date**: 2026-08-06 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`spec-kit/specs/005-ocr-parsing/spec.md`

## Summary

Feature 005 adds OCR in exactly two additive contexts. Clean, structurally safe
Candidate PDF/DOCX imports first retain native extraction, then selectively
render insufficient or suspicious PDF pages or traverse eligible main-body DOCX
PNG/JPEG images, recognize them, and feed ordered provenance-bearing segments
into the existing parser and Candidate review flow. The public job-search
surface accepts one ephemeral PNG/JPEG, processes it asynchronously, interprets
bounded OCR text into visible and reversible Feature 003 criteria, and sends
only those criteria through the existing deterministic job search.

The initial OCR implementation is an isolated self-hosted PaddleOCR 3.7.0 /
PP-OCRv6-medium service using ONNX Runtime over a private Unix socket. The
existing CV worker and a new independently limited image-search worker perform
all purpose, scan, decode, storage, consent, and persistence decisions. Search
artifacts use a separate encrypted namespace and hard 15-minute deletion
deadline. Image intent uses the existing OpenAI adapter and shared server-only
CV parsing API key behind a provider-independent contract and per-query
consent; ordinary text search remains available without AI consent.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`; Python `3.12` only
inside the isolated OCR-engine image

**Primary Dependencies**: Existing Next.js `16.3.0`, React `19.2.3`, Better
Auth session integration, Zod `4.3.6`, Prisma and `@prisma/adapter-pg` `7.9.0`,
`pg` `8.16.3`, TanStack Query `5.101.4`, `pdfjs-dist` `6.2.108`, Mammoth
`1.12.0`, yauzl `3.4.0`, fast-xml-parser `5.10.1`, OpenAI SDK `7.3.0`, and
ClamAV `1.4`; add exact server-only `sharp` `0.35.3` and `@napi-rs/canvas`
`1.0.2`; OCR image pins `paddleocr` `3.7.0`, `onnxruntime` `1.27.0`, FastAPI
`0.139.2`, Uvicorn `0.51.0`, and Pydantic `2.13.4`

**Storage**: PostgreSQL `16.12` remains the single relational source of truth.
Feature 004 private encrypted CV storage remains authoritative for CV source and
combined extracted segments. Search uses a separate
`PrivateSearchArtifactStorage` namespace (encrypted local filesystem in
development; private S3/SSE-KMS plus application AES-GCM in production) with a
hard 15-minute maximum. Rasterized CV pages use private process temp only.

**Testing**: Existing Vitest `4.1.10`, Testing Library `16.3.1`, Playwright
`1.57.0`, PostgreSQL integration/migration tests, OpenAPI/JSON-Schema parity,
architecture boundary tests, ClamAV EICAR/safety fixtures, accessibility checks,
and performance harnesses; add Pytest `9.1.1` for OCR service contract/model
tests and a committed synthetic Vietnamese/English/bilingual OCR/intent corpus

**Target Platform**: Responsive Next.js web application at desktop and 320 CSS
pixels; Linux Node workers and a Linux x86-64 CPU OCR sidecar under Docker
Compose locally and co-located pod/host deployment in production; Windows,
macOS, and Linux developer hosts use the containerized workers/engine

**Project Type**: Existing full-stack Next.js modular monolith with separate
email, CV, image-search, ClamAV, and OCR-engine processes sharing PostgreSQL only
where domain state requires it

**Performance Goals**: Image admission to visible validated intent/manual
fallback/actionable result P95 `<=10s`; subsequent deterministic job search P95
`<=2s`; at least 90% of representative CV fixtures review-ready/actionable in
`<=120s` and 100% in `<=180s`; OCR word accuracy at least 95% overall and at
least 90% per Vietnamese, English, and bilingual group; hard physical deletion
of every search content artifact by admission plus 15 minutes; release accuracy
uses at least 180 unique fixtures/18,000 words with the mandatory subgroup floors
from `spec.md`

**Constraints**: Candidate uploads remain PDF/DOCX only and exactly
`1..5,000,000` bytes; search accepts one static PNG/JPEG exactly
`1..5,000,000` bytes and at most 20 decoded megapixels; DOCX main-body only,
maximum 20 eligible images and 100 decoded megapixels aggregate; native-first
CV extraction; 20-second deadline per CV OCR unit, concurrency two, and one
immutable 180-second hybrid-extraction deadline shared by queueing and retries;
six-second search OCR deadline; no AI job selection/ranking; no Profile mutation
before existing Candidate confirmation; no raw content/locators/capabilities in
logs, URLs, analytics, or persistent browser storage; Better Auth remains the
exclusive browser-session owner; external dispatch requires exact current
consent and production privacy/ZDR gates

**Scale/Scope**: Four user stories; existing 100,000-posting/10,000-active-job
search baseline; visitor 3/hour under both IP and browser subjects;
authenticated 10/hour/account; one search image/query; CV maximum 20 pages;
separate search concurrency 4 and CV OCR concurrency 2 on the documented local
qualification profile; no persistent search history or image library

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Gate                                                | Design evidence                                                                                                                                                                                                                                                                                              | Status |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I. Human-controlled recruitment                     | OCR/AI create reviewable CV evidence or search-filter proposals only. Candidate Profile writes still require Feature 004 review/confirmation. AI never selects, excludes, ranks, applies to, or changes a job.                                                                                               | Pass   |
| II. Security, privacy, tenant isolation             | CV remains PDF/DOCX-only; both purposes scan before decode; engine receives only normalized PNG; purpose-specific encrypted stores/keys/rows; server authorization and consent; exact 15-minute search deletion; no biometric analysis/content telemetry; Vietnamese privacy and cross-border gate retained. | Pass   |
| III. Deterministic core and explainable AI          | Feature 003 remains the sole search authority; each criterion has visible basis/confidence/provenance and reversible selection; local interpreter/manual search and native CV path survive OCR/AI failure; versions are traceable without retaining raw search content.                                      | Pass   |
| IV. State, audit, data integrity                    | PostgreSQL owns lifecycle, admission events, leases, consent, idempotency, result consumption, and deletion evidence. Constraints prevent multiple owners/results; late work cannot commit after cancellation/deadline. Audit is content-free.                                                               | Pass   |
| V. Scope discipline/P0 completeness                 | The feature closes approved CV/image-search gaps only. No new CV format, generic OCR API, recommendations, resume rewriting, biometric analysis, or private global search enters scope. Dependencies have failure and replacement boundaries.                                                                | Pass   |
| VI. Measurable quality/accessibility                | Exact P95, accuracy, deletion, regression, responsive, keyboard, focus, and usability gates are specified with a representative corpus and evidence profile. Long work is asynchronous and manual search/Profile editing remain usable.                                                                      | Pass   |
| VII. Maintainable/provider-independent architecture | Thin App Router -> service -> repository/storage/provider layering remains. Better Auth is unchanged. OCR, normalization, storage, scanner, and AI use typed replaceable interfaces. Python is isolated behind a private OpenAPI contract.                                                                   | Pass   |

No blocking constitutional conflict exists. Phase 0 research was permitted.

## Architecture and Boundaries

```text
Browser
  |-- ordinary criteria -------------------------------> /jobs
  |                                                      JobDiscoveryService
  |                                                      -> PublicJobRepository
  |
  |-- image-search metadata/content/status/result ----> App Router handlers
                                                        -> ImageSearchService
                                                        -> Search repositories
                                                        -> encrypted search storage
                                                               |
PostgreSQL <---------------- image-search-worker <-------------+
     ^                         |-- ClamAV Unix socket
     |                         |-- Sharp normalize
     |                         |-- OCR Unix socket ------> ocr-engine
     |                         `-- SearchIntentInterpreter
     |                              `-- consented OpenAI
     |
     `------------------------ cv-worker
                               |-- ClamAV Unix socket
                               |-- PDF.js/Mammoth/yauzl native extraction
                               |-- PDF.js + Canvas / DOCX body image normalize
                               |-- OCR Unix socket ------> ocr-engine
                               `-- existing parser -> draft -> Candidate review
```

### Layer ownership

- App Router handlers parse transport metadata, call request-boundary helpers,
  and serialize typed no-store responses. They do not scan, decode, call OCR/AI,
  or access Prisma/storage directly.
- Services own admission, actor/capability authorization, state transitions,
  rate limiting, consent decisions, result consumption, cancellation, and
  Feature 003 query conversion.
- Repositories own transactional PostgreSQL writes, `FOR UPDATE SKIP LOCKED`
  claims, constraints, and allowlisted projections.
- Storage adapters own encryption envelopes, integrity verification, object
  lifecycle, and no-public-URL behavior. CV and search contexts cannot be
  interchanged.
- Provider adapters implement `MalwareScanner`, `ImageNormalizer`, `OcrEngine`,
  `SearchIntentInterpreter`, `PrivateCvStorage`, and
  `PrivateSearchArtifactStorage` interfaces.
- The OCR engine recognizes pixels only. It owns no business data, database
  connection, provider credential, search query, CV parser, or deletion policy.

## Candidate CV OCR Design

### Native regression path

Feature 004's envelope, quarantine, ClamAV, PDF/DOCX structure checks, quotas,
retention, retries, parser choice, consent, draft, and confirmation remain
unchanged. A native-sufficient document continues to create
`cv-segments-v1`, selects the existing parser input/output versions, and never
requires the OCR sidecar. This is the SC-001/FR-020 regression guarantee.

### Hybrid extraction path

After a clean scan and structure validation, the extraction child returns a
versioned unit manifest rather than failing immediately on image-only content:

1. PDF.js extracts native text and visible placement per page.
2. `cv-ocr-eligibility-v1` classifies pages. Required/suspicious pages render at
   200 DPI through PDF.js and `@napi-rs/canvas` to a mode-`0600` PNG below a
   process-private `0700` attempt directory.
3. DOCX validation inventories internal main-body PNG/JPEG relationships, body
   ordinals, anchors, counts, decoded dimensions, and aggregate pixels before
   any partial OCR result is accepted. Sharp strips metadata and normalizes
   eligible images.
4. The parent CV worker calls `OcrEngine` for at most two units concurrently.
   Each unit receives at most 20 seconds and all units, queueing, leases, and
   retries share one immutable 180-second deadline starting when the first
   OCR-required manifest is claimed. A retry never resets the aggregate clock;
   the caller passes only the remaining time, enforces the cumulative 512-KiB
   segment output, and rechecks the current extraction lease.
5. `cv-segment-dedup-v1` merges only exact/overlapping duplicates and keeps an
   outcome for every eligible unit. Material native/OCR conflicts are warnings,
   never silently adjudicated facts.
6. Hybrid results are encrypted as `cv-segments-v2`; parser adapters use
   `cv-draft-v2` provenance/warnings. Existing draft save and transactional
   confirmation apply unchanged.
7. Temp rasters are zeroed where practical and recursively removed in `finally`;
   startup cleanup removes stale attempt directories. The durable source
   document permits safe lease retry without retaining raster artifacts.

### Confirmed CV status projection

This is the implementation design for FR-056. Feature 004's confirmed import
remains owner-readable through the persisted
`uploadId`, even after temporary CV content becomes inaccessible. The status route
returns the content-free lifecycle state and immutable confirmation receipt; it
does not reconstruct editable draft content. External OpenAI consent notices and
challenges are materialized only while the temporary import content is accessible
(`contentInaccessibleAt IS NULL`). Once confirmation sets that boundary, the
projection skips consent challenge issuance so a valid `CONFIRMED` import cannot
be mistaken for a missing resource. The review route may remain unavailable after
confirmation because editable draft comparison is an `EDITABLE`/`REVIEW_READY`
capability, not a status-page fallback.

`OcrProcessingAttempt` and `OcrUnitOutcome` contain only state, counts,
confidence aggregates, versions, unit locations, safe failures, and timing. Raw
text exists only inside the encrypted Feature 004 extraction artifact and draft
lifecycles already authorized for that Candidate.

### Failure behavior

- Native-sufficient pages continue if OCR is down elsewhere.
- A document that requires OCR receives bounded automatic/candidate retry rules
  through the existing extraction-stage recovery path, then replacement upload
  and manual Profile entry. No partial low-quality draft is labeled complete.
- Review-safe low-confidence text may be included only with explicit warnings;
  every unit is classified as native, OCR-derived, non-text, excluded,
  low-confidence, unsupported, or failed.
- Cancellation, expiry, integrity failure, lease loss, or Profile/import
  ownership loss discards late OCR output and follows Feature 004 cleanup.

## Image-Assisted Job Search Design

### Browser interaction

The site-wide search affordance remains a public-job search control. It provides
text and image modes, but ordinary text criteria are always usable. The image
flow is a client component so source bytes, visitor capability, interaction ID,
OCR fallback text, and uncommitted proposals stay in memory.

The browser reserves a query, uploads the raw stream, polls content-free status,
and consumes one result while submitting the currently visible, already
Feature-003-validated criteria for a non-persistent final merge. While
processing it preserves the current `/jobs` criteria. On a current valid result:

- high-confidence explicit/normalized criteria may be selected;
- broader or lower-confidence criteria are labeled suggestions;
- existing non-empty manual scalar/query values are not overwritten silently;
- the user may edit/remove/clear/reverse every proposal;
- selected validated criteria are encoded using the existing Feature 003 URL
  contract, then the server-rendered `/jobs` page and deterministic repository
  produce results.

A new query, cancellation, manual edit that invalidates the pending merge, or
navigation aborts the client controller. Query and interaction IDs must match
before applying a response. The raw image, OCR text, evidence excerpts,
capability, and processing ID never enter a URL or persistent cache.

### Server pipeline

```text
AWAITING_CONTENT
  -> SCAN_QUEUED -> SCANNING -> DECODE_QUEUED -> DECODING
  -> OCR_QUEUED -> OCR_PROCESSING
  -> [INTERPRET_QUEUED -> INTERPRETING]
  -> RESULT_READY | FALLBACK_READY
  -> CONSUMED -> DELETED
```

Validation, infected/indeterminate scan, decode, OCR, interpretation,
cancellation, and expiry have explicit terminal/fallback states. Every terminal
transition makes content inaccessible and schedules immediate physical
deletion. The hard `deleteBy` remains admission plus 15 minutes regardless of
retry.

`image-search-worker` uses a separate worker identity, leases, concurrency, and
storage root. Its stages are:

1. verify encrypted source integrity and persisted clean scan prerequisite;
2. decode only a matching static PNG/JPEG with Sharp's 20-megapixel safety cap,
   auto-orient, strip metadata, flatten, and create normalized sRGB PNG;
3. call the private OCR engine with a six-second search deadline and validate
   the strict result;
4. store at most 32 KiB UTF-8 OCR text as an encrypted ephemeral artifact;
5. if exact external consent and deployment gates pass, call the OpenAI
   semantic interpreter; otherwise prepare a safe retry/ordinary-search
   recovery that never prefills recognized text into a query or filter;
6. resolve verbatim evidence excerpts to Unicode code-point ranges locally,
   verify confidence/basis, contradictions, and every value against the
   existing `jobSearchQuerySchema`; store a bounded encrypted one-time
   candidate intent;
7. finalize state only if query, lease, consent, capability/actor ownership, and
   hard deadline are current.

At result consumption, the service validates the browser's current visible
Feature 003 criteria, turns any conflicting generated scalar/query proposal into
an unselected suggestion, merges set-valued criteria without duplicates, and
does not persist that current criteria payload. When the user explicitly checks
a reviewed proposal and applies it, the browser replaces the corresponding
visible filter, preserves fields without a checked proposal, and navigates to
`/jobs` so Feature 003 runs the search immediately.

The worker never queries `JobPosting` and never returns job IDs. Job availability
is checked only later by Feature 003.

## OCR and Search-Intent Provider Boundaries

### OCR engine

`OcrEngine` accepts one normalized PNG and returns strict line geometry/text/
confidence plus engine/model manifest versions. The initial engine is the
no-egress PaddleOCR/ONNX sidecar. The contract supports a future internal engine
only after equivalent model-manifest, corpus, security, and performance tests.
No automatic external OCR fallback exists.

### Search intent

`SearchIntentInterpreter` accepts normalized OCR text, language hint, allowed
field schema, purpose/instruction/schema versions, deadline, and optional
purpose-separated safety identifier. It returns proposals only.

- `openai` receives text only and uses the existing exact SDK/model baseline
  with instruction `job-search-intent-v2`, strict public schema
  `job-search-intent-v1`, tools/background/reuse off, `store=false`, and retries
  zero.
- Production external mode additionally requires approved DPA/privacy/cross-
  border and verified ZDR/equivalent flags. If those fail, startup/dispatch
  rejects external mode and offers local/manual behavior.
- Consent identifies purpose, provider, model, notice, text, policy, and time.
  The worker rechecks the latest event immediately before dispatch. Revocation
  wins. No second provider is attempted silently.

`search-intent-selection-v2` auto-selects only evidence-verified `EXPLICIT` or
`NORMALIZED` criteria at confidence `>=0.90`; `INFERRED` and `0.60..0.899...`
criteria are unselected; lower/invalid/contradictory/excess criteria are
discarded. The interpreter supplies exact OCR excerpts, while the server—not
the model—resolves their Unicode ranges. Self-reported confidence alone never
permits selection.

## Security, Session, Capability, and Privacy Controls

### Exclusive browser session

Feature 005 defines no account session. Better Auth remains the exclusive
server-controlled browser-session owner established by Feature 001:

- its opaque cookie references the PostgreSQL `Session` row;
- server validation enforces expiration, revocation, account state, logout, and
  password-reset behavior;
- authenticated account IDs are derived from that session, never request bodies;
- Feature 005 adds no JWT browser session, session table, auth cookie, or
  localStorage/sessionStorage credential.

The optional visitor rate cookie is a non-auth signal: it grants no query access
or identity. Visitor query access requires a separate one-query, 15-minute,
memory-only opaque capability whose HMAC is stored. This is not a reusable
browser-session mechanism. It is excluded from URL, cookies, persistent stores,
logs, errors, traces, and analytics.

### Request boundaries

- All mutating routes require trusted same-origin/Fetch Metadata validation;
  authenticated routes also use the established session-bound CSRF proof.
- Strict Zod schemas reject unknown metadata and ownership fields. Content upload
  is a raw bounded stream with exact `Content-Length`; no multipart parser is
  required.
- Authenticated ownership is `accountId + queryId`; visitors require query ID,
  unexpired capability HMAC, and current query lifecycle. Failure is
  non-disclosing.
- Idempotency digests bind actor/capability subject, operation, query, body, and
  purpose. Key reuse with different input is rejected.
- Result responses, status, errors, and all image-search pages use `no-store`;
  referrer policy and CSP do not expose capability or content.

### Content security

- No format decode before a clean current ClamAV assessment.
- Search and DOCX images require extension/type/magic/actual decoder agreement.
  Animated, malformed, polyglot, oversized, embedded/active/external content
  fails closed.
- Prompt-like text remains plain untrusted data. OCR has no tool/network access;
  AI tools are disabled and its output is parsed only as a strict proposal
  schema.
- No face recognition, identity matching, protected-attribute inference,
  emotion/age/gender analysis, or portrait use exists.
- Ordinary logs record only safe codes, stage, duration bucket, purpose,
  versions, actor class, and deletion outcome. They exclude input, OCR text,
  criteria content, prompt/provider payload, IDs that reveal storage, raw IP,
  browser nonce, capability, and secrets.

## Storage, Retention, Cleanup, and Audit

CV content continues under Feature 004 deadlines and quota settlement.
Search artifacts have independent encryption context and key configuration:

- local: repo-local gitignored `web/.local/image-search-storage`, absolute path,
  private permissions, production rejected;
- production: private bucket/prefix, Block Public Access, least-privilege worker
  role, SSE-KMS, random locators, no public URL, and an exact one-day object
  expiration plus one-day incomplete-multipart-abort lifecycle backstop that is
  never relied upon for the 15-minute SLA;
- application: AES-256-GCM with purpose/query/artifact/kind associated data,
  SHA-256 integrity, exact bytes, versioned keys, no locator in API/telemetry.

Logical inaccessibility and physical deletion are distinct. Terminal/consume
sets `contentInaccessibleAt` and `deleteAfter=now`; `deleteBy` is immutable.
Cleanup claims due artifacts independently, treats already-absent as success,
retries safely, and records content-free deletion outcome. Reconciliation finds
orphan database/object/temp entries and schedules immediate deletion. Query
metadata and safe attempt evidence may remain under the audit schedule, but all
content artifact rows are scrubbed of encryption envelopes/locators after
physical deletion. Admission events expire after 65 minutes.

Production admission has a structural storage-readiness prerequisite. Before an
image-search admission flag can become effective, the content-free production
storage preflight MUST verify live S3 Block Public Access, public-policy status,
SSE-KMS bucket/key policy, an allowlisted least-privilege role scoped to the
configured bucket/prefix and KMS key, and a lifecycle backstop that removes
current/noncurrent search objects and aborts incomplete multipart uploads after
exactly one day. The
preflight writes a secret-free JSON evidence report to
`web/.local/evidence/image-search-storage-preflight.json`; a failed or stale
report, or one generated more than 15 minutes before admission startup, keeps
admission disabled. It supplements rather than replaces the application's
15-minute cleanup deadline.

Audit records purpose, actor class or HMAC-safe subject class, action, safe
target HMAC, outcome, timing, consent reference, provider/model/engine/policy/
schema versions, and deletion result. It stores no image, OCR text, generated
criteria value, evidence excerpt, prompt, provider body, IP, browser nonce,
capability, secret, or locator.

## Rate Limiting and Abuse Controls

Admission runs before storage reservation or other expensive processing in one
PostgreSQL transaction.

- Visitor: count `IP_HMAC` and `BROWSER_HMAC` events in `[now-1h, now)`; both
  must be below 3; insert both for one query.
- Authenticated: count `ACCOUNT` events in the same window; must be below 10;
  insert one.
- The browser nonce is a random non-auth `__Host-` cookie with `Secure`,
  `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`. IP and nonce are HMACed with a dedicated
  versioned server key; raw values are not persisted.
- An admitted reservation counts even if upload is abandoned. An idempotent
  replay does not count twice. A rejected attempt creates no content artifact.
- `retryAt` is the latest expiry among applicable limiting events. Ordinary text
  search is never checked against these tables.

Global infrastructure request/byte limits may be stricter during attacks, but
they cannot be represented to users as the product quota and cannot authorize
additional processing.

## Environment and Deployment Configuration

All new values are server-only; no `NEXT_PUBLIC_` OCR/search secret is allowed.
Exact names may be implemented as below unless the configuration module adopts
an equivalent consistent prefix.

| Variable                                | Purpose/gate                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `OCR_ENGINE_ENABLED`                    | Enables internal OCR only after socket/model health passes.                                  |
| `OCR_ENGINE_SOCKET_PATH`                | Absolute `/run/smarthire-ocr/ocr.sock`; no TCP/URL value accepted.                           |
| `OCR_ENGINE_NAME`, `OCR_ENGINE_VERSION` | Immutable expected engine manifest.                                                          |
| `OCR_MODEL_NAME`, `OCR_MODEL_SHA256`    | Exact PP-OCRv6 medium manifest expected from readiness/results.                              |
| `OCR_POLICY_VERSION`                    | `ocr-confidence-v1` plus purpose policy binding.                                             |
| `OCR_CV_UNIT_TIMEOUT_SECONDS`           | Exactly `20`; each unit receives the lesser of this value or remaining aggregate time.       |
| `CV_HYBRID_DEADLINE_SECONDS`            | Exactly `180`; immutable from first OCR-manifest claim across queueing and retries.          |
| `OCR_SEARCH_TIMEOUT_SECONDS`            | Exactly `6`; retry/lease recovery consumes the same query processing window.                 |
| `IMAGE_SEARCH_WORKER_ENABLED`           | Enables admission processing; cleanup remains separately enabled.                            |
| `IMAGE_SEARCH_STORAGE_ADAPTER`          | `filesystem` local; `s3` production.                                                         |
| `IMAGE_SEARCH_STORAGE_LOCAL_ROOT`       | Absolute gitignored local path; production rejected.                                         |
| `IMAGE_SEARCH_ARTIFACT_KEY_V1`          | Separate 32-byte AES key, never printed or shared with CV storage.                           |
| `IMAGE_SEARCH_RATE_HMAC_KEY_V1`         | HMAC key for IP/browser/admission subjects.                                                  |
| `IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1`   | Separate HMAC key for visitor query capabilities.                                            |
| `IMAGE_SEARCH_INTERPRETER`              | Must be `openai`; no deterministic or arbitrary module/provider URL.                         |
| `IMAGE_SEARCH_OPENAI_ENABLED`           | Must be `true` whenever image-search admission is enabled.                                   |
| `IMAGE_SEARCH_OPENAI_*_APPROVED`        | Provider/model, DPA/privacy, cross-border, ZDR/equivalent, and production enable assertions. |
| Existing `OPENAI_API_KEY`               | Reused only server-side; dispatch still requires search-specific gates/consent.              |
| Existing ClamAV variables               | Reused freshness/socket limits; no bypass or TCP fallback.                                   |

Compose adds `ocr-engine` and `image-search-worker`. The engine image is built
from `ocr-engine/`, publishes no ports, mounts only its model files/read-only
config/socket/tmpfs, and has no database/storage/ClamAV/OpenAI access. Workers
mount only the sockets and storage roots they require. Health dependencies do
not let OCR failure stop Next.js, PostgreSQL, email, ordinary text search, or
native CV extraction; supervisor messaging reports reduced capability.

## Migration, Compatibility, and Rollout

1. Add enums/tables/relations/check constraints/indexes described in
   [data-model.md](./data-model.md) in one additive migration after Feature 004.
2. Preserve all Feature 001-004 migrations byte-for-byte. Regenerate Prisma and
   confirm no Better Auth-owned field/table or Feature 003 job-search column is
   changed.
3. Add search tables disabled by feature flag; deploy hard-deadline transitions,
   cleanup/reconciliation, admission-readiness checks, production storage
   preflight, and model health first. Admission code requires the resulting
   readiness capability, so phase order cannot enable source intake earlier.
4. Deploy the OCR engine and shadow only the committed corpus/synthetic fixtures.
   No real user content is shadow-copied or used for training.
5. Enable Candidate OCR for internal test accounts, first image-only PDFs, then
   suspicious PDFs/DOCX, while retaining the native v1 path.
6. Enable OpenAI-only image search with strict quotas only after consent/UI,
   ZDR/privacy, schema, canary, and fallback gates pass.
7. Rollback disables new OCR/image admissions and semantic dispatch but leaves
   CV/search cleanup, deletion, reconciliation, and existing native/manual paths
   active until all temporary content is gone. The additive schema remains safe.

No job data is backfilled. No CV source is reprocessed automatically; Candidates
must initiate a new/retry import under current consent and policy.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/005-ocr-parsing/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- openapi.yaml
|   |-- ocr-engine.openapi.yaml
|   |-- search-intent.schema.json
|   |-- cv-segments-v2.schema.json
|   `-- internal-contracts.md
`-- tasks.md                         # generated by /speckit-tasks, not this command
```

### Source Code (repository root)

```text
compose.yaml
Dockerfile.cv-worker
Dockerfile.image-search-worker
Dockerfile.ocr-engine
package.json
package-lock.json

ocr-engine/
|-- requirements.txt
|-- requirements-dev.txt
|-- model-manifest.json
|-- src/
|   |-- app.py
|   |-- contracts.py
|   |-- engine.py
|   `-- limits.py
`-- tests/

web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/<next>_purpose_specific_ocr/
|-- scripts/
|   |-- run-image-search-worker.mjs
|   |-- check-ocr-engine.mjs
|   |-- check-image-search-production-storage.mjs
|   `-- evaluate-ocr-corpus.mjs
|-- src/
|   |-- app/
|   |   `-- api/jobs/image-searches/
|   |       |-- route.ts
|   |       `-- [queryId]/{route.ts,content/route.ts,result/route.ts,consent/route.ts}
|   |-- backend/
|   |   |-- cv/
|   |   |   |-- extraction/{document-extractor.ts,pdf-ocr-manifest.ts,docx-ocr-manifest.ts,hybrid-segments.ts}
|   |   |   `-- workers/extraction-stage.ts
|   |   |-- ocr/{ocr-engine.ts,unix-ocr-engine.ts,policies.ts}
|   |   |-- image-search/
|   |   |   |-- config.ts
|   |   |   |-- storage/{private-search-storage.ts,filesystem.ts,s3.ts}
|   |   |   |-- interpretation/{search-intent-interpreter.ts,deterministic.ts,openai.ts,selection-policy.ts}
|   |   |   `-- workers/{resources.ts,resource-factory.ts,entry.ts,runtime.ts,pipeline.ts,scan-stage.ts,decode-stage.ts,ocr-stage.ts,interpret-stage.ts,cleanup.ts,reconciliation.ts}
|   |   |-- repositories/image-search/
|   |   |-- services/image-search/{image-search-admission-readiness.ts,...}
|   |   `-- security/image-search-request-boundary.ts
|   |-- frontend/features/jobs/image-search/
|   |   |-- client/
|   |   `-- components/
|   `-- shared/contracts/
|       |-- ocr/
|       `-- jobs/image-search.ts
`-- tests/
    |-- unit/{ocr,image-search,cv-hybrid-extraction}/
    |-- integration/{ocr,image-search,cv-hybrid-extraction}/
    |-- contract/ocr-image-search/
    |-- security/ocr-image-search/
    |-- performance/ocr-image-search/
    |-- fixtures/ocr-corpus/
    `-- e2e/ocr-image-search/

deploy/
`-- image-search-storage-policy.json
```

**Structure Decision**: Extend the existing `web/` modular monolith and its
separate-worker convention. Add one small Python inference deployment unit only
because the selected OCR engine is not a Node library and must be isolated from
web/CV dependencies. Keep all purpose, authorization, storage, AI, and search
rules in the TypeScript application; Python receives normalized pixels and
returns recognized lines only.

## Verification Strategy

### Contract and architecture

- OpenAPI/Zod/JSON Schema parity for browser routes, v2 CV segments, search
  intent, and OCR UDS API; strict unknown-field and size rejection.
- Architecture tests prohibit App Router direct Prisma/storage/provider use,
  web/email mounting OCR/ClamAV sockets, OCR engine network/database/storage
  access, and purpose-crossed artifact rows/context labels.
- Build inspection proves Sharp/Canvas are server-worker only and Python/model
  files are absent from browser bundles.

### Security and privacy

- Raw streaming overflow/short body/type/magic/decode mismatch, animated/
  malformed/polyglot/decompression bomb, EICAR, stale scanner, stale model,
  socket permissions, no TCP listener/egress, temp permissions/cleanup, AES-GCM
  tamper, context confusion, capability guessing/replay, CSRF/origin, account
  ownership, and non-disclosing errors.
- Consent grant/refusal/revocation/provider-version races prove zero unapproved
  external dispatch and no silent alternate provider.
- Canary scans of logs, traces, metrics, audits, URLs, responses, browser
  storage, crash reports, and analytics find no source, OCR text, CV content,
  proposal values, evidence, prompts, payloads, locators, raw IP/nonces,
  capabilities, or secrets.
- Fake-clock terminal/consume/cancel/expiry tests prove immediate denial and
  physical absence of every search content copy by admission plus 15 minutes,
  including deletion failure, already-absent object, orphan, and late worker.

### CV behavior

- Native PDF/DOCX golden regression remains v1 and functions while OCR is down.
- Image-only/mixed/suspicious PDFs and eligible main-body DOCX images cover
  ordering, anchors, exclusions, 20-image/100-megapixel limits, per-unit
  accounting, confidence, conflicts, deduplication, bounded output, retries, and
  worker crash recovery.
- Draft tests prove warnings/provenance, no Profile write before confirmation,
  exact revision conflicts, idempotent atomic confirmation, and rollback.
- Confirmed external-AI imports remain readable through the canonical status route
  and immutable receipt after `contentInaccessibleAt` is set; projection tests
  prove that no new consent challenge is issued and that draft comparison remains
  unavailable after confirmation.

### Search behavior

- Visitor IP+browser and authenticated account rolling limits use concurrency,
  controlled clocks, multi-device/shared-IP cases, idempotent replay, and exact
  retry time.
- AI outputs cover allowed fields, exact evidence excerpts and locally resolved
  Unicode ranges, threshold
  boundaries, explicit/normalized/inferred selection, manual-value conflict,
  invalid enum/range, job ID/sort/private-field rejection, stale/cancelled/
  superseded result, and one-time OCR fallback memory lifecycle.
- Equivalent manual/image criteria yield the same Feature 003 result set/order;
  all unavailable/private records remain excluded.

### Quality, performance, and accessibility

- The committed corpus contains at least 180 unique fixtures/18,000 words and
  satisfies every language, purpose, layout, quality, and security floor from
  `spec.md`. It reports Unicode-aware overall/per-cohort word accuracy,
  suspicious-page recall, DOCX exclusion correctness, and labeled search-intent
  field/value/selection accuracy without counting zero-text rejections as words.
- Performance evidence states machine/container resources, sample and dataset,
  duration, concurrency, cold/warm state, model/provider versions, percentile
  method, P50/P95/P99/max/error rate, and external conditions. It measures the
  10-second interpretation and further 2-second deterministic search separately.
- Keyboard, focus, live region, cancel/progress, non-color confidence/warnings,
  consent, error recovery, responsive 320-pixel layout, and reduced-motion tests
  cover all image controls.
- At least 30 representative participants, split between desktop and 320-pixel
  mobile, provide anonymized aggregate evidence for SC-007's 90% first-attempt
  task threshold.

## Post-Design Constitution Re-check

Phase 1 design remains compliant. The data model contains no raw OCR/search text
columns; contracts cannot express job IDs/ranking or ownership input; one-time
delivery and immutable deletion deadlines satisfy the search exception; CV
segments remain temporary draft evidence; Better Auth is still exclusive; the
Python service is isolated behind a provider interface; and the documented
verification plan covers every mandatory accuracy, fallback, privacy,
accessibility, and latency target. All gates remain **Pass**.

## Complexity Tracking

No constitutional violation requires justification. The separate OCR engine and
image-search worker are bounded deployment components, not additional browser
applications, databases, session mechanisms, or business authorities. Their
isolation is required by the selected native ML runtime and by independent
anonymous-search/Candidate resource and privacy limits.
