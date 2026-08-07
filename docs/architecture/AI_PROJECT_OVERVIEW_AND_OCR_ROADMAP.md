# SmartHire: AI Project Overview and OCR Roadmap

> Snapshot date: 2026-08-06  
> Reviewed branch: `OCR-parsing`  
> Reviewed commit: `d928a446bbbe927b5fa999c87b9db482ad51c112`  
> Purpose: give a future coding agent a fast, reliable map of the repository and
> record an architecture proposal for OCR without changing application code.

This document is an orientation aid, not a replacement for the active Spec Kit
artifacts. If it conflicts with the constitution, an active feature spec/plan,
the Prisma schema, or executable contracts, those authoritative sources win.

## 1. Executive summary

SmartHire is a full-stack Next.js modular monolith for a Vietnamese recruitment
platform. The current repository contains implemented identity/account,
Candidate Profile, Job Board, and temporary CV-import workflows. The main
runtime is the Next.js application, with separate email and CV worker processes.
PostgreSQL is authoritative. Better Auth exclusively owns browser sessions.

The existing CV pipeline is already a strong base for OCR:

```text
upload reservation
  -> encrypted private quarantine
  -> bounded envelope validation
  -> ClamAV scan
  -> isolated PDF/DOCX text extraction
  -> encrypted text segments
  -> deterministic or consent-gated OpenAI semantic parser
  -> candidate review draft
  -> transactional selective Profile import
  -> retention/deletion cleanup
```

OCR belongs between the clean malware assessment and semantic parsing. It
should produce the same kind of versioned, encrypted text-segment artifact that
the existing `CvParser` consumes. OCR is character recognition; it should not
own Profile mutation, job search, job publication, ranking, or recruitment
decisions.

The recommended direction is:

1. Preserve native PDF/DOCX extraction as the first choice.
2. Add a replaceable `OcrEngine` behind an isolated document-text extraction
   boundary.
3. OCR only image-only or demonstrably insufficient pages at first.
4. Keep one configured OCR engine per deployment; do not silently fall back
   across providers.
5. Store page/region/confidence provenance in the encrypted extracted artifact,
   while PostgreSQL stores only safe operational metadata.
6. Reuse the OCR capability through separate purpose policies for CV import,
   recruiter job-post drafts, and future image-assisted search.
7. Require human review before OCR-derived CV facts change a Profile or
   OCR-derived job facts become a submitted/published posting.

Two scope facts must be resolved before implementation:

- Feature 004 explicitly deferred OCR and treats image-only PDFs as an
  actionable extraction failure.
- The project constitution currently limits CV uploads to PDF and DOCX, exactly
  5,000,000 bytes maximum, unless the constitution is amended. OCR inside an
  image-only PDF can remain within that file-type boundary. Accepting a direct
  PNG/JPEG CV cannot.

For that reason, implement OCR as a new approved feature and forward migration,
not as an undocumented patch to completed Feature 004 artifacts or migration
`008_cv_upload_parse_review`.

## 2. Authority and required reading

Read these in this order before changing behavior:

1. `AGENTS.md`
2. `spec-kit/.specify/memory/constitution.md`
3. The active feature's `spec.md`, `plan.md`, `data-model.md`, contracts, and
   `tasks.md`
4. `web/prisma/schema.prisma` and forward migrations
5. Shared Zod contracts under `web/src/shared/contracts/`
6. Services, repositories, provider boundaries, routes, UI, and tests for the
   affected feature

The root agent instructions require these plans for the current areas:

- `spec-kit/specs/003-job-board-and-advanced-search/plan.md`
- `spec-kit/specs/002-candidate-profile-account-management/plan.md`
- `spec-kit/specs/004-cv-upload-parse-review/plan.md`

Important constitutional rules for OCR work:

- Recruitment remains human-controlled.
- Sensitive CV and recruitment data uses least privilege and purpose-limited
  retention.
- Raw personal data must not enter ordinary logs or unapproved AI providers.
- PostgreSQL is authoritative for state and critical writes are transactional.
- Provider-specific code must remain replaceable behind an interface.
- Job search remains deterministic, case-insensitive, and
  Vietnamese-diacritic-insensitive. AI-generated search keywords are currently
  excluded.
- Direct CV image upload needs an explicit constitutional change because the
  current rule permits PDF and DOCX only.

## 3. Repository and runtime map

```text
repository root
|-- web/                       main npm workspace and Next.js app
|   |-- prisma/                schema and forward-only PostgreSQL migrations
|   |-- scripts/               workers, probes, seed, and performance tools
|   |-- src/
|   |   |-- app/               App Router pages and thin Route Handlers
|   |   |-- frontend/          React presentation and client orchestration
|   |   |-- backend/           services, repositories, security, providers
|   |   `-- shared/            transport-neutral contracts and types
|   `-- tests/                 unit, contract, integration, architecture, E2E
|-- spec-kit/specs/            feature specifications and implementation plans
|-- docs/                      project, design, operations, and evidence docs
|-- scripts/                   root environment/development orchestration
|-- compose.yaml               PostgreSQL, ClamAV, and CV worker locally
|-- package.json               sole workspace/root command entry point
`-- package-lock.json          sole dependency lockfile
```

Current technical baseline:

| Area              | Current choice                                                  |
| ----------------- | --------------------------------------------------------------- |
| Web               | Next.js App Router, React, TypeScript                           |
| Runtime           | Node.js 24.18.x, npm 11.16.x                                    |
| Database          | PostgreSQL 16.12, Prisma 7.9.0, PG adapter                      |
| Authentication    | Better Auth 1.6.25, opaque DB-backed cookie session             |
| Validation        | Shared strict Zod contracts                                     |
| UI                | Tailwind CSS 4, React Hook Form, TanStack Query, Sonner         |
| File safety       | ClamAV over a private Unix-domain socket                        |
| CV extraction     | PDF.js for PDF; yauzl/XML checks and Mammoth for DOCX           |
| CV parsing        | local deterministic test/dev parser or OpenAI Responses API     |
| Private artifacts | application AES-256-GCM plus local filesystem or S3/SSE-KMS     |
| Testing           | Vitest, Testing Library, axe, real PostgreSQL tests, Playwright |

Runtime composition:

```text
Browser
  -> Next.js page / Route Handler
  -> application service
  -> repository or provider adapter
  -> PostgreSQL / private storage / email outbox

Background processes
  email worker -> PostgreSQL outbox -> capture | SMTP | Resend
  CV worker    -> PostgreSQL leases -> ClamAV/storage/extractor/parser/cleanup
```

Layer rules:

- `app/` translates HTTP and composes server-side page reads. It must not own
  domain policy or call Prisma/provider SDKs directly.
- `backend/services/` owns authorization-sensitive orchestration, policies,
  state transitions, and validation beyond transport shape.
- `backend/repositories/` owns Prisma/SQL, transactions, locks, leases,
  idempotency, and database conflict mapping.
- `backend/cv/`, `backend/email/`, and `backend/auth/` isolate server-only
  providers and specialized runtimes.
- `shared/contracts/` is the typed trust-boundary source and must remain free of
  backend-only imports.
- `frontend/features/` owns presentation and ephemeral browser state. Sensitive
  CV content is not persisted to localStorage, sessionStorage, IndexedDB, or a
  persistent client store.

## 4. Implemented feature map

### 4.1 Identity and account security (Feature 001)

Implemented areas include registration, email verification, login/logout,
password reset, full account recovery, TOTP, backup codes, session listing and
revocation, CSRF/origin protection, rate limiting, and audit events.

Better Auth is the only browser-session owner. New document or OCR endpoints
must reuse the existing server validation and account-state boundary; they must
not introduce another session cookie, JWT, or session table.

Primary paths:

- `web/src/backend/auth/`
- `web/src/backend/security/`
- `web/src/backend/services/identity/`
- `web/src/app/api/identity/`
- `web/src/frontend/features/authentication/`

### 4.2 Candidate Profile and account management (Feature 002)

`CandidateProfile` owns nullable headline, summary, phone, and location plus
ordered experience, education, skill, and social-link collections. Profile
writes validate a complete section, lock the aggregate, and increment one
revision. The CV review flow imports into this aggregate only after explicit
candidate selection and confirmation.

Primary paths:

- `web/src/backend/services/profile/`
- `web/src/backend/repositories/profile/`
- `web/src/shared/contracts/profile/`
- `web/src/frontend/features/profile/`
- `spec-kit/specs/002-candidate-profile-account-management/`

### 4.3 Job Board and deterministic search (Feature 003)

The repository already contains a public `/jobs` page and
`job-search-form.tsx`. Current search is text/filter based; there is no
image-assisted search. It supports keyword, location, employment type,
experience, work arrangement, salary, skill, posted date, and stable sorting.

Search normalization performs NFD decomposition, Vietnamese `đ/Đ` mapping,
combining-mark removal, lowercasing, punctuation-to-space conversion, and
whitespace collapse. PostgreSQL searches approved active `JobPosting` rows via
normalized fields and deterministic ordering/keyset cursors.

Primary paths:

- `web/src/app/jobs/`
- `web/src/frontend/features/jobs/components/job-search-form.tsx`
- `web/src/backend/services/jobs/search-normalization.ts`
- `web/src/backend/services/jobs/job-discovery-service.ts`
- `web/src/backend/repositories/jobs/prisma-public-job-repository.ts`
- `web/src/shared/contracts/jobs/`
- `spec-kit/specs/003-job-board-and-advanced-search/`

There are `Company` and `JobPosting` persistence models and development seed
data, but recruiter-facing job creation/editing/submission APIs and pages are
not implemented in the current source tree. Recruiter job-post behavior mainly
exists in product/use-case documents under
`docs/analysis-and-design/use_cases/specification/03_Recruiter_Operations.md`.
An OCR-to-job-post feature must therefore integrate into that future draft
workflow, not write directly to currently public postings.

### 4.4 Temporary CV upload, parse, and review (Feature 004)

Feature 004 is implemented and heavily tested. It accepts only PDF/DOCX, from 1
through exactly 5,000,000 bytes. It creates temporary import sources used only
to propose changes to Candidate Profile.

Primary paths:

- HTTP: `web/src/app/api/account/cv-imports/` and
  `web/src/app/api/account/cv-drafts/`
- Services: `web/src/backend/services/cv-import/`
- Persistence: `web/src/backend/repositories/cv-import/`
- Providers/worker: `web/src/backend/cv/`
- Contracts: `web/src/shared/contracts/cv-import/`
- UI: `web/src/frontend/features/cv-import/`
- Data: CV models in `web/prisma/schema.prisma`
- Tests: CV-focused suites under `web/tests/`
- Design: `spec-kit/specs/004-cv-upload-parse-review/`

The Feature 004 source, extracted text, draft payload, and provenance are
temporary and cleanup-controlled. They must never be silently promoted into a
retained application attachment.

`CandidateCv` is a separate retained-document model consumed by the job
application workflow. Feature 004 does not create it. Production application
attachment support still needs an approved retained-CV producer/provider.

## 5. Current CV pipeline in detail

### 5.1 Admission and upload

The browser first creates a reservation and then streams the exact raw body to a
private endpoint. Contracts allow only:

- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Filename extension, declared MIME type, declared length, actual length,
idempotency binding, rolling upload count, import count, and account storage
quota are checked. Source bytes are encrypted before private storage. Random
object locators do not contain account or filename information.

Relevant files:

- `web/src/shared/contracts/cv-import/upload.ts`
- `web/src/backend/services/cv-import/create-cv-import.ts`
- `web/src/backend/services/cv-import/receive-cv-content.ts`
- `web/src/backend/cv/storage/`
- `web/src/backend/cv/encryption/`

### 5.2 Safety and integrity

The CV worker performs bounded leading-magic/envelope checks, then sends a
decrypted stream to ClamAV via a private Unix socket. Deep PDF, ZIP, and XML
inspection is forbidden before a persisted clean assessment. SHA-256 and AES
authentication are reverified before later stages accept an artifact.

The current document-kind and magic checks are hard-coded for `PDF | DOCX` in
`web/src/backend/cv/workers/scan-stage.ts`. Direct images would require an
approved expansion of contracts, enums, magic validation, structural limits,
tests, environment policy, and the constitution.

### 5.3 Native text extraction

`IsolatedDocumentExtractor` starts a bounded child process:

- 15-second deadline
- 192 MiB V8 old-space ceiling
- 512 KiB maximum extracted UTF-8 artifact
- maximum 20 PDF pages
- maximum 1,000 DOCX entries and 25 MiB expanded bytes

PDF.js rejects encryption, active content, attachments, embedded content, and
excess pages, then emits one normalized segment per page. If no PDF page has
machine-readable text it throws `IMAGE_ONLY`.

DOCX validation rejects traversal, duplicate paths, unsupported compression,
zip bombs, macros, OLE/ActiveX, external relationships, entity/doctype content,
and malformed required parts. Mammoth then extracts raw text only; embedded
images are not processed.

Relevant files:

- `web/src/backend/cv/extraction/document-extractor.ts`
- `web/src/backend/cv/extraction/runner.ts`
- `web/src/backend/cv/extraction/child-entry.ts`
- `web/src/backend/cv/extraction/pdf.ts`
- `web/src/backend/cv/extraction/docx.ts`

### 5.4 Extracted text and semantic parsing

`ExtractedSegmentStore` writes encrypted NDJSON to private storage. Each segment
currently contains:

```ts
type ExtractedSegment = {
  id: string;
  kind: "heading" | "paragraph" | "list-item";
  text: string;
};
```

The parser sees authorized segments only. The OpenAI adapter sends capped text,
uses a strict structured schema, disables SDK retries, and is gated by exact
consent and deployment privacy flags. Parser output is treated as hostile and
must cite valid segment IDs. It never writes Profile data directly.

Relevant files:

- `web/src/backend/cv/extraction/extracted-segment-store.ts`
- `web/src/backend/cv/parsing/cv-parser.ts`
- `web/src/backend/cv/parsing/deterministic.ts`
- `web/src/backend/cv/parsing/openai.ts`
- `web/src/shared/contracts/cv-import/parser-output.ts`
- `web/src/backend/services/cv-import/create-cv-draft.ts`

### 5.5 Review, confirmation, and cleanup

The candidate reviews the proposed values against the live Profile, edits them,
and selects ADD/REPLACE/SKIP operations. Draft and Profile revisions protect
multi-tab/device edits. Confirmation locks and validates the Profile, upload,
draft, and owned child rows, then applies only selected changes and creates a
non-content receipt in one transaction.

Temporary content becomes inaccessible immediately on confirmation/candidate
deletion and is physically removed within the defined deadline. Ordinary logs,
audit context, responses, and telemetry exclude raw CV text, filenames,
contacts, object keys, digests, prompts, and provider errors.

## 6. Why OCR should be a document-text capability

The three requested use cases share byte/image recognition but not their
authorization, retention, or downstream behavior:

| Purpose               | Input owner               | OCR output target           | Human gate                                  | Suggested source retention                                       |
| --------------------- | ------------------------- | --------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| CV import             | Candidate                 | CV proposal draft           | Candidate selects changes                   | Inherit Feature 004 temporary lifecycle                          |
| Job-post import       | Authorized company member | Job-post draft fields       | Recruiter reviews; moderation still applies | Bound to draft; delete source soon after confirmation/submission |
| Image-assisted search | Public or candidate actor | Editable query/filter draft | User confirms/edits query                   | Ephemeral; delete immediately or within a short hard limit       |

A single generic endpoint such as `POST /api/ocr` would erase these differences
and make authorization, quota, consent, and retention errors likely. Share the
provider and canonical text contract, but keep purpose-specific routes,
services, persistence, and policies.

Recommended conceptual split:

```text
Purpose-specific workflow
  CV import | job-post draft | search query
          |
          v
DocumentTextPipeline(policy)
  -> safe type/envelope validation
  -> malware scan where required
  -> isolated decode/rasterization
  -> native extraction first
  -> OCR on eligible pages/images
  -> normalization and quality gate
  -> encrypted/versioned TextDocument artifact
          |
          v
Purpose-specific semantic handling
  CvParser | JobPostDraftParser | editable SearchQueryDraft
```

The shared capability should expose interfaces, not a shared public API:

```ts
interface OcrEngine {
  recognize(input: OcrPageInput): Promise<OcrPageResult>;
}

interface DocumentRasterizer {
  rasterize(input: CleanDocumentInput): AsyncIterable<RasterPage>;
}

interface DocumentTextExtractor {
  extract(
    input: CleanDocumentInput,
    policy: ExtractionPolicy,
  ): Promise<TextDocumentV2>;
}
```

Provider implementations remain server-only and must not receive repository,
session, Profile, job, or publication capabilities.

## 7. Canonical OCR output proposal

Do not reduce OCR output immediately to one plain string. CVs and job notices
commonly use columns, headings, and separated regions. Preserve enough evidence
for ordering, debugging, low-confidence review, and future layout improvements.

Conceptual versioned artifact:

```ts
type TextDocumentV2 = {
  schemaVersion: "text-document-v2";
  strategy: "NATIVE" | "OCR" | "HYBRID";
  pages: Array<{
    page: number;
    width: number;
    height: number;
    segments: Array<{
      id: string;
      order: number;
      kind: "heading" | "paragraph" | "list-item" | "unknown";
      text: string;
      source: "native" | "ocr";
      bbox: { x: number; y: number; width: number; height: number } | null;
      recognitionConfidence: number | null;
    }>;
  }>;
  engine: {
    provider: string;
    model: string;
    version: string;
    languageHints: string[];
    preprocessingVersion: string;
  };
};
```

Coordinates should be normalized to a documented coordinate system rather than
provider-specific pixels. Segment IDs must remain stable within one artifact so
the existing evidence-membership design can continue.

Keep two confidence concepts separate:

- recognition confidence: how certain OCR is about characters/words;
- semantic field confidence: how certain a downstream parser is that a text
  region represents a skill, employer, date, location, and so on.

They should not be merged into one unexplained score. Low recognition
confidence should make derived fields visibly review-worthy.

## 8. Extraction strategy

### 8.1 Recommended first release

Support image-only PDF CVs before direct image CV files:

1. Preserve current upload, encryption, quota, ClamAV, ownership, consent,
   review, confirmation, and cleanup behavior.
2. Run current PDF native-text extraction first.
3. If a page has no usable native text, rasterize that page in an isolated,
   resource-bounded process.
4. OCR only the eligible page.
5. Normalize OCR output into versioned segments and continue through the
   existing parser/draft pipeline.
6. If OCR fails or quality is below an approved threshold, keep the current
   replacement/manual-entry recovery path.

This provides value without changing the constitutional PDF/DOCX file-type
limit. It also minimizes new upload attack surface and UI/contract changes.

### 8.2 Hybrid documents

Do not OCR every PDF page unconditionally. Prefer per-page classification:

- good native text -> retain native segments;
- no/insufficient native text -> OCR the rendered page;
- both present -> avoid duplicate text and define which source is authoritative;
- suspicious invisible/native text that materially disagrees with rendered OCR
  -> fail safely or require explicit review rather than silently combining it.

The first release may deliberately support only fully image-only PDFs. Mixed
native/image pages and native-versus-rendered consistency checking can follow
after fixtures and ordering rules are mature.

### 8.3 Direct PNG/JPEG input

Treat this as a later increment because it requires a constitutional amendment
and broader validation. Start with PNG and JPEG only. Avoid SVG and animated
formats. WebP/HEIC/TIFF should be separately justified.

Required structural controls include:

- verify magic bytes independently from extension/MIME;
- cap encoded bytes, decoded pixel count, dimensions, frame count, and color
  channels;
- reject animation, excessive metadata, decompression bombs, malformed color
  profiles, and unsupported encodings;
- normalize orientation and strip EXIF/GPS/metadata before OCR;
- decode/rasterize with no network access, bounded CPU/memory/time, and whole
  process termination on failure;
- never allow filenames or metadata to become storage keys or logs.

### 8.4 DOCX images

The current Feature 004 plan intentionally ignores/rejects embedded image and
object processing. OCR of pictures inside DOCX is not a small extension: it
changes the safe ZIP/relationship policy, image count/pixel quotas, ordering,
and provenance rules. Defer it until PDF/image OCR is stable unless real usage
data proves it is necessary.

## 9. OCR engine options

Engine selection must be benchmark-driven on Vietnamese/English SmartHire
fixtures, not chosen only from marketing claims.

| Option                          | Strengths                                                                                                | Costs/risks                                                                                                         | Suggested role                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Tesseract 5                     | Self-hosted, Apache 2.0, mature CLI/API, Vietnamese language data, TSV/hOCR coordinates                  | Weaker on complex CV layout, photos, and difficult typography; preprocessing-sensitive                              | Lowest-complexity baseline and possible MVP engine                |
| PaddleOCR PP-OCRv5              | Self-hosted, multilingual including Vietnamese, modern detection/recognition and document-layout options | Python/Paddle runtime, larger image/container/resource footprint, more operational work                             | Strong production-quality candidate if the benchmark justifies it |
| Google Cloud Vision/Document AI | Managed scale, layout/text APIs, official Vietnamese OCR support                                         | New external processor, PII transfer, DPA/cross-border/retention review, network/cost/vendor dependency             | Optional consent/deployment-gated adapter                         |
| Azure Document Intelligence     | Managed document OCR with words/lines/locations/confidence and multilingual support                      | Same external privacy/cost concerns; a new provider/runtime boundary                                                | Optional enterprise adapter                                       |
| Amazon Textract                 | Convenient beside S3 and good structured-document APIs                                                   | Official text-detection languages currently exclude Vietnamese                                                      | Do not select for Vietnamese-first OCR without new evidence       |
| Vision-capable LLM              | Can combine perception and semantic interpretation                                                       | Nondeterministic transcription, harder character-level evaluation/evidence, privacy/cost, prompt-injection concerns | Not the primary OCR engine; keep semantic parsing separate        |

Official references reviewed for this proposal:

- Tesseract 5 user manual and output formats:
  <https://tesseract-ocr.github.io/tessdoc/>
- Tesseract command-line hOCR/TSV behavior:
  <https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html>
- PaddleOCR PP-OCRv5 multilingual recognition and Vietnamese support:
  <https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html>
- Google Cloud Vision OCR language support:
  <https://docs.cloud.google.com/vision/docs/languages>
- Google Document AI Enterprise Document OCR:
  <https://docs.cloud.google.com/document-ai/docs/enterprise-document-ocr>
- Azure OCR overview:
  <https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr>
- Amazon Textract quotas/language limits:
  <https://docs.aws.amazon.com/textract/latest/dg/limits-document.html>

Recommended selection process:

1. Implement or prototype the provider-neutral contract.
2. Benchmark Tesseract as the low-complexity local baseline.
3. Benchmark self-hosted PaddleOCR as the quality challenger.
4. Add a managed-cloud proof only if local quality/latency is insufficient and
   the privacy gate is realistically approvable.
5. Configure one selected engine per environment. A failed call returns a safe
   retry/manual path rather than a silent provider switch.

For this repository, a self-hosted first release fits the existing private
processing posture. Tesseract is the easiest integration; PaddleOCR is the more
promising candidate for complex Vietnamese layouts. The corpus benchmark should
decide which becomes the configured production adapter.

## 10. Purpose-specific behavior

### 10.1 CV import

- Inherit existing ownership, quota, encryption, ClamAV, lease, retry, consent,
  review, and retention behavior.
- Preserve the current strict parser-output schema and source-segment evidence.
- Add recognition metadata to the encrypted text artifact and only safe engine
  metadata to PostgreSQL.
- Keep Profile mutation exclusively in transactional candidate confirmation.
- Do not create or attach a retained `CandidateCv` implicitly.

Likely source touchpoints in a future implementation:

- contracts: `web/src/shared/contracts/cv-import/common.ts` and `upload.ts`
- scanner type/magic policy: `web/src/backend/cv/workers/scan-stage.ts`
- extraction contract: `web/src/backend/cv/extraction/document-extractor.ts`
- PDF fallback: `web/src/backend/cv/extraction/pdf.ts`
- child isolation: `web/src/backend/cv/extraction/runner.ts` and
  `child-entry.ts`
- stage orchestration/metadata: `web/src/backend/cv/workers/extraction-stage.ts`
- encrypted segment artifact: `web/src/backend/cv/extraction/extracted-segment-store.ts`
- safe failures/UI projection: upload contracts, `cv-import-projection.ts`, and
  CV import components
- architecture and integration tests under `web/tests/`

Do not put OCR SDK imports in Route Handlers, shared contracts, or client code.

### 10.2 Recruiter job-post image import

Build this only as part of an authorized company-scoped job-draft feature:

```text
company member uploads image/PDF
  -> private purpose-bound processing
  -> OCR TextDocument
  -> strict JobPostDraft proposal
  -> recruiter edits and confirms
  -> ordinary validation and duplicate warning
  -> submit for moderation
  -> administrator/human approval
  -> publish
```

OCR must never directly create an ACTIVE `JobPosting` or populate
`searchDocumentNormalized`. The normal job-draft confirmation/submission service
must validate and normalize approved fields. Tenant authorization must derive
the company from the authenticated membership, never from a trusted client
owner ID.

Suggested structured draft fields mirror existing `JobPosting`: title,
summary, description, responsibilities, requirements, benefits, location,
employment type, experience level, work arrangement, salary/currency/period,
skills, and application deadline. Missing/ambiguous fields stay visibly empty
or low-confidence; the parser must not invent them.

### 10.3 Future image-assisted search

The existing `/jobs` text search should remain the final search engine. OCR can
help a user construct an editable query, then the confirmed text/filters pass
through the existing Zod contract and `normalizeSearchText` path.

Recommended safe flow:

```text
image upload/camera capture
  -> short-lived OCR
  -> show recognized text or proposed filters
  -> user edits/confirms
  -> existing deterministic `/jobs` search
```

Do not index private uploaded images or OCR text. Do not mix uploaded OCR text
into public `JobPosting.searchDocumentNormalized`. Apply a much shorter
retention window than CV/job drafts, and keep the search route usable when OCR
is unavailable.

The current constitution excludes AI-generated search keywords. A semantic
model that turns a job-poster image into selected keywords/filters therefore
needs an explicit approved scope change. A strictly verbatim OCR result that
the user edits before deterministic search is the smallest compatible first
step.

## 11. Persistence and state guidance

Avoid rewriting applied migrations. Add a new forward-only migration after the
approved OCR spec/data model is complete.

Two reasonable approaches exist:

### Incremental CV-first approach

Extend `CvExtraction` with additive operational metadata such as strategy,
OCR engine/model/version, OCR page count, preprocessing version, and quality
summary. Keep raw text, word boxes, and confidences inside the encrypted
`EXTRACTED_TEXT` artifact.

This is the smallest change for image-only PDF CVs but is not itself the shared
job/search persistence model.

### General document-work approach

Introduce purpose-bound generic records such as `DocumentImport`,
`DocumentArtifact`, and `TextExtractionAttempt`, linked to a purpose owner and a
purpose-specific aggregate. This better supports job-post/search usage but is a
larger migration/refactor and must not weaken Feature 004 tenant/retention
rules.

Recommendation: start CV-first at the orchestration/persistence layer while
making the in-process OCR/rasterizer/TextDocument contracts reusable. Extract a
generic durable document queue only when the second real consumer (job-post or
search) has an approved spec. This avoids a premature generic schema while
preventing provider lock-in.

Potential safe failure codes should distinguish:

- rasterization timeout/failure;
- unsupported image encoding;
- decoded pixel/dimension/frame limit;
- OCR timeout/unavailable;
- OCR output empty;
- OCR output/segment limit;
- OCR quality below threshold;
- OCR artifact integrity failure.

Retries must be durable and bounded like existing scan/parse attempts. A retry
must create observable attempt history; it must not be hidden inside an SDK.

## 12. Security and privacy checklist

OCR expands attack surface because compressed images become large decoded pixel
buffers and third-party decoders process hostile bytes. Preserve these gates:

- authorize purpose and owner before accepting content;
- stream and encrypt source bytes into private quarantine;
- validate exact content length and server-sniffed type;
- complete fail-closed malware scanning before document/image decoding;
- isolate rasterizer/decoder/OCR with time, CPU, memory, output, page, pixel,
  dimension, and frame caps;
- disable network and external-file access in processing containers/processes;
- reverify integrity before every stage consumes an artifact;
- treat OCR text as untrusted data, including instructions and prompt injection;
- use strict schemas and reject whole invalid outputs rather than accepting
  partial unsafe data;
- never log or trace raw image bytes, text, filenames, contacts, boxes, object
  locators, digests, prompts/responses, or provider errors;
- record only safe engine/version, duration, page/segment counts, result code,
  retry count, and queue/lease metrics;
- define consent and cross-border/provider gates separately for OCR and semantic
  parsing if either sends content externally;
- logically deny content immediately at deletion/confirmation deadlines and
  physically remove every derivative, thumbnail, raster page, OCR artifact,
  provider cache, and source object within the approved deadline;
- rate-limit by account/IP/purpose and include decoded-work quotas, not only
  encoded byte quotas.

Do not reuse the current OpenAI CV consent automatically for image dispatch.
The existing grant is bound to a specific provider, model, purpose, notice,
text/input, and instruction version. Sending an image or using a different OCR
provider is a new processing purpose/version and requires its own approved gate.

## 13. Quality benchmark and test plan

Build a representative, permission-safe corpus before selecting an engine. Use
synthetic or explicitly consented/redacted fixtures; do not commit real CVs or
personal job applications.

Corpus dimensions should include:

- Vietnamese, English, and bilingual pages;
- one-column and two-column CVs;
- common fonts, small text, bold headings, tables, icons, bullets, and lines;
- clean scans, phone photos, rotation/skew, perspective, blur, shadows, low
  contrast, compression, watermarks, and screenshots;
- native-only, image-only, and mixed PDF pages;
- Vietnamese diacritics, email, phone, URLs, dates, company/school names,
  salary formats, and technical skills;
- empty images, unrelated photos, handwriting if it is in scope, and unsupported
  languages;
- decompression bombs, huge dimensions, malformed images, polyglots, EICAR,
  metadata/EXIF payloads, animated files, truncated files, and timeout cases;
- prompt-injection text and native hidden text that disagrees with the rendered
  page.

Measure at least:

- character error rate (CER), preserving Vietnamese diacritics;
- word error rate (WER);
- reading-order accuracy;
- downstream field precision/recall/F1 after the semantic parser;
- blank/false-text rate on non-document images;
- P50/P95/P99 latency, maximum, error rate, memory, CPU, cold start, and queue
  time under documented concurrency;
- encrypted artifact sizes and cleanup completion;
- authorization, deletion, retry, lease-expiry, and crash recovery correctness.

Test layers should mirror current Feature 004 quality practice:

- unit: preprocessing, page classification, normalization, coordinates,
  confidence/quality policy, safe error mapping;
- provider contract: identical canonical output expectations across engines;
- integration: real bounded subprocess/container, scan-before-decode ordering,
  encryption/integrity, leases, retries, retention, privacy canaries;
- contract: Zod/OpenAPI/error parity and strict unknown-field rejection;
- architecture: provider imports remain server-only and routes/clients stay
  provider/Prisma-free;
- UI/accessibility: file/camera selection, progress, low-confidence warning,
  keyboard/focus/error summary, reduced motion, and 320 px layouts;
- E2E: image-only PDF to reviewed CV draft; failures to actionable manual path;
  future job image to editable draft; future image search to editable query.

Do not promise an accuracy threshold until the team has a labeled corpus and a
baseline. Record the approved threshold in the new feature spec and make
regression results reproducible.

## 14. Delivery roadmap

### Phase 0: specification and benchmark

- Create a new OCR feature spec rather than modifying Feature 004 history.
- Decide whether the first increment is image-only PDF only or also direct
  PNG/JPEG.
- If direct CV images are in scope, amend the constitutional PDF/DOCX limit.
- Define purpose, consent, retention, limits, states, failures, and performance
  criteria.
- Build the bilingual labeled benchmark and compare Tesseract/PaddleOCR.
- Record the engine choice and replacement boundary in the plan or an ADR.

### Phase 1: image-only PDF CV OCR

- Add rasterizer and `OcrEngine` boundaries behind the CV worker.
- Reuse the existing scan, encrypted storage, segment store, parser, draft,
  review, confirmation, retry, and cleanup paths.
- Add OCR provenance/quality metadata and actionable failures.
- Keep direct images and DOCX embedded-image OCR out of this increment.

### Phase 2: direct CV images

- Amend constitution/spec/contracts for PNG/JPEG.
- Add strict image decoding/pixel/frame/metadata controls and UI affordances.
- Revalidate quotas, latency, retention, accessibility, and mobile camera input.

### Phase 3: recruiter job-post image import

- First implement the authorized company-scoped job-draft workflow.
- Reuse the OCR/TextDocument boundary with a job-import policy and parser.
- Require recruiter edit/confirmation, then ordinary moderation and approval.
- Never publish directly from OCR.

### Phase 4: image-assisted search

- Add a short-lived image-to-editable-query workflow.
- Feed confirmed values into existing deterministic job search.
- Keep ordinary text search fully available and within the current latency SLA.
- Expand to semantic query/filter proposals only after approving the current
  AI-keyword scope conflict.

## 15. Decisions the team should make before coding

1. Is the MVP only image-only PDF, or direct PNG/JPEG too?
2. Is OCR required to be fully self-hosted, or can candidates/recruiters grant
   separate external OCR consent?
3. What languages and handwriting quality are supported? Recommended initial
   scope: printed Vietnamese and English; handwriting explicitly unsupported.
4. Which engine wins the labeled benchmark: Tesseract or PaddleOCR?
5. What are the page, pixel, dimension, image-count, timeout, memory, and output
   caps?
6. What minimum quality triggers manual recovery rather than semantic parsing?
7. How are mixed native/OCR pages and conflicting hidden/rendered text handled?
8. Does the UI expose low OCR confidence at field level or only as a document
   warning?
9. What exact retention applies to raster pages and OCR derivatives for each
   purpose?
10. Does image search remain verbatim/editable OCR only, or will the
    constitution/spec be amended to allow semantic query proposals?

## 16. Fast path for a future AI agent

For OCR/CV work, read these files first:

1. `AGENTS.md`
2. `spec-kit/.specify/memory/constitution.md`
3. `spec-kit/specs/004-cv-upload-parse-review/plan.md`
4. `spec-kit/specs/004-cv-upload-parse-review/spec.md` around FR-047 and scope
5. `web/src/backend/cv/extraction/document-extractor.ts`
6. `web/src/backend/cv/extraction/pdf.ts`
7. `web/src/backend/cv/workers/scan-stage.ts`
8. `web/src/backend/cv/workers/extraction-stage.ts`
9. `web/src/backend/cv/extraction/extracted-segment-store.ts`
10. `web/src/backend/cv/parsing/cv-parser.ts`
11. `web/src/shared/contracts/cv-import/common.ts`
12. `web/src/shared/contracts/cv-import/upload.ts`
13. CV models in `web/prisma/schema.prisma`
14. `web/tests/backend/integration/cv-import/document-extraction.test.ts`
15. `web/tests/architecture/cv-import-boundaries.test.ts`

For image-assisted job search, additionally read:

- `spec-kit/specs/003-job-board-and-advanced-search/plan.md`
- `web/src/frontend/features/jobs/components/job-search-form.tsx`
- `web/src/backend/services/jobs/search-normalization.ts`
- `web/src/backend/services/jobs/job-discovery-service.ts`
- `web/src/backend/repositories/jobs/prisma-public-job-repository.ts`
- `web/src/shared/contracts/jobs/discovery.ts`

For recruiter job-post import, additionally read:

- `docs/analysis-and-design/use_cases/specification/03_Recruiter_Operations.md`
- `JobPosting`, `JobPostingSkill`, `Company`, and moderation-related enums/models
  in `web/prisma/schema.prisma`

## 17. Common mistakes to avoid

- Calling semantic CV parsing “OCR”; they are separate stages.
- Sending images directly to the current text-only OpenAI parser under the old
  consent binding.
- Accepting PNG/JPEG CVs without amending the constitution.
- Editing the already-applied `008_cv_upload_parse_review` migration.
- Treating Feature 004 temporary storage as the retained `CandidateCv` provider.
- Adding a generic public `/api/ocr` endpoint with no purpose/retention policy.
- Decoding or rasterizing before a clean malware assessment.
- OCRing every native PDF page and creating duplicated/conflicting text.
- Writing raw OCR text, bounding boxes, filenames, images, or provider errors to
  PostgreSQL logs/telemetry/audit context.
- Letting OCR-derived job data bypass recruiter review or moderation.
- Letting OCR/AI-generated search terms bypass the current deterministic search
  contract and constitutional scope.
- Using OCR confidence as if it were semantic field confidence.
- Hiding provider retries inside an SDK or automatically changing providers.
- Adding provider imports to Route Handlers, shared contracts, or client code.

## 18. Scope of this document change

This overview was created after read-only inspection of the active plans,
constitution, repository structure, package configuration, Prisma models,
current CV pipeline, job-search pipeline, relevant UI/contracts/tests, and
official OCR provider documentation. No application source, schema, migration,
dependency, environment setting, or test was changed.
