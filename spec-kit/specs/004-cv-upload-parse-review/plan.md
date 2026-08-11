# Implementation Plan: CV Upload, Parse, and Review

**Branch**: `004-cv-upload-parse-review` | **Date**: 2026-08-01
**Spec**: `spec-kit/specs/004-cv-upload-parse-review/spec.md`

## Summary

Deliver Feature 004 inside the existing modular Next.js application. An active
candidate creates a bounded upload reservation, streams one PDF or DOCX into
encrypted private quarantine, and leaves the request while a PostgreSQL-leased
worker performs bounded envelope checks, scans it with private ClamAV, validates
its structure and extracts text in a resource-bounded subprocess, and invokes a
selected parser behind a strict interface. The production external adapter uses
the OpenAI Responses API only
after exact, versioned candidate consent and a deployment privacy gate; local
development defaults to a deterministic non-network adapter. An explicit
`CV_OPENAI_LOCAL_DEV_ENABLED` opt-in may exercise the external adapter locally
with a server-only key and the same per-upload consent gate; automated tests
remain deterministic except for the separately opted-in synthetic live smoke.

Parser output is validated as hostile input and persisted only as an optimistic-
concurrency CV Draft. Review compares the live Candidate Profile with proposed
values and stores candidate edits and selection decisions in the draft. Confirm
locks the profile, upload, draft, and relevant child rows, rejects stale profile
or draft revisions, applies exactly the selected changes, increments the profile
revision once, records a non-content receipt and audit outcome, and locks the
draft in one PostgreSQL transaction. Cleanup logically hides expired, deleted,
or confirmed temporary content immediately and physically removes encrypted
source, extracted text, draft payload, and provenance within the specified
deadlines.

## Technical Context

**Language/Version**: Node.js `24.18.x`, TypeScript `5.9.3`; the root `.nvmrc`
and `.node-version` remain authoritative

**Primary Dependencies**: Existing Next.js `16.2.11`, React `19.2.3`, Better
Auth `1.6.25`, Prisma/client/PG adapter `7.9.0`, Zod `4.3.6`, React Hook Form
`7.82.0`, TanStack Query `5.101.4`, Sonner `2.0.7`, Tailwind CSS `4.1.18`, and
shadcn/ui conventions plus built-in Next.js CSS Modules for co-located custom
component styles; add exact server-only `@aws-sdk/client-s3` `3.1101.0`,
`pdfjs-dist` `6.2.108`, `mammoth` `1.12.0`, `yauzl` `3.4.0`,
`fast-xml-parser` `5.10.1`, `openai` `7.3.0`, and development-only
`@types/yauzl` `3.4.0`; use Node `crypto`, `net`, streams, and child processes
for encryption, the ClamAV Unix-socket protocol, bounded upload I/O, and
extractor isolation

**Storage**: PostgreSQL `16.12` remains the authoritative relational store.
Temporary CV artifacts use a `PrivateCvStorage` boundary with an encrypted,
gitignored filesystem adapter under `web/.local/cv-storage` for local/test and
an AWS S3 private non-versioned bucket with SSE-KMS for production. Application-
level AES-256-GCM encryption protects every stored source/extracted artifact in
both adapters. No CV bytes or extracted text are stored in PostgreSQL JSON.

**Testing**: Existing Vitest `4.1.10`, Testing Library, OpenAPI 3.1 parity,
real PostgreSQL integration/concurrency tests, and Playwright `1.57.0`; add
EICAR and malicious PDF/DOCX corpora, private ClamAV integration, filesystem/S3
adapter contract tests, fake-clock lease/retention tests, deterministic parser
fixtures, an opt-in live OpenAI smoke test with synthetic data only, desktop and
320-pixel accessibility E2E, production builds, and measured P95 evidence

**Target Platform**: Node.js server runtime in the existing Next.js deployment
unit plus one CV worker process co-located with `clamd` on the same pod/host;
supported modern desktop/mobile browsers; local validation on
Windows/macOS/Linux with a containerized CV worker and ClamAV in Docker Compose;
private ClamAV `1.4` LTS (initially `1.4.5`) via the official
`clamav/clamav:1.4_base` image, whose resolved OCI digest is pinned during
implementation

**Project Type**: Modular full-stack web application in one npm workspace with
separate web, email-worker, and CV-worker processes sharing PostgreSQL and the
private artifact store

**Performance Goals**: After the last byte arrives, P95 upload finalization and
bounded pre-scan validation returns accepted/actionable feedback within 5
seconds; at least 90% of clean
supported CVs reach review-ready or an actionable terminal result within 60
seconds and all within 3 minutes under documented provider conditions; P95
review load is at most 3 seconds and P95 draft save/confirm feedback at most 2
seconds; cleanup succeeds without manual intervention in at least 99% of the
measured workload

**Constraints**: PDF/DOCX only, `1..5,000,000 bytes` (decimal 5 MB); PDF at most
20 pages; DOCX at most
25 MiB expanded and 1,000 entries; one active parse job/account; five upload
attempts/rolling hour; ten non-deleted imports and 50 MiB reserved plus retained
artifact storage/account; draft JSON at most 256 KiB and provenance at most 128
KiB; extracted UTF-8 text at most 512 KiB; fail-closed scanner with definitions
no older than 24 hours; one initial scan plus at most two automatic retries
(three automatic attempts total) and at most two single-attempt candidate scan
retries; parser call hard timeout 60 seconds, adapter timeout 50 seconds, one
initial parse plus at most two automatic retries and two single-attempt candidate
parse retries; a candidate retry never restarts an automatic cycle; no OCR,
automatic
cross-provider fallback, direct parser-to-profile writes, browser persistence,
public URLs, an original-CV retrieval/download endpoint, non-HTTPS or custom
provider endpoints, raw CV logging, resume rewriting, scoring, or recruitment
decisions; no Feature 004 selectors or imports in global/shared stylesheets, no
feature-level catch-all stylesheet, and custom component CSS only in an optional
same-directory, same-basename CSS Module owned by its matching TSX file

**Scale/Scope**: Five user stories, three protected pages, eleven browser API
operation families, ten new relational models plus enum/check/index extensions,
two private storage adapters, one scanner, two parser adapters (local deterministic
and consent-gated OpenAI), one CV worker with pre-scan-validation/scan/extract/
parse/cleanup loops,
five capped Profile sections, and a maximum aggregate of 50 skills, 50
experiences, 50 education rows, and 10 social links

## Dependency Decision and Gate

All new npm packages are pinned through the sole root `package-lock.json` and
are imported only from server-only CV boundaries. `pdfjs-dist`, `mammoth`,
`yauzl`, and `fast-xml-parser` run only after a clean ClamAV assessment and
inside a child process with a 15-second extraction deadline and a 192 MiB V8
old-space ceiling. `mammoth.extractRawText` is used rather than HTML conversion;
external file access, images, embedded objects, macros, active content, and
external relationships remain prohibited. The OpenAI SDK has built-in retries
disabled so every attempt is visible in SmartHire's durable job history.

Implementation cannot pass the dependency gate until the exact package set and
resolved ClamAV image digest pass Node `24.18.x`/TypeScript `5.9.3` typecheck,
server-only import checks, representative PDF/DOCX extraction tests, EICAR and
ClamAV protocol tests, production build, one-root-lockfile verification, license
review, container vulnerability review, and `npm audit --json` without an
unreviewed critical/high finding. A failure blocks schema and application work;
package/provider substitution remains possible through the documented adapters.

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Principle / gate                                   | Design evidence                                                                                                                                                                                                                                                                                     | Result |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I Human-controlled recruitment                     | Parsing only extracts candidate-provided facts into a separate draft. The candidate edits and explicitly selects every imported change; no rewrite, score, ranking, recommendation, or recruitment action exists.                                                                                   | Pass   |
| II Security, privacy, tenant isolation             | Better Auth session-derived ownership, ACTIVE-account checks, same-origin/CSRF enforcement, private encrypted quarantine, ClamAV, strict structural validation, consent, ZDR deployment gate, data minimization, no public URLs/browser persistence, and enforced deletion windows protect CV data. | Pass   |
| III Deterministic core / explainable AI            | Validation, scanning, extraction, normalization, duplicate hints, state transitions, and confirmation are deterministic. Semantic parsing is asynchronous, version-traced, replaceable, and non-authoritative; provider failure leads to retry/manual entry without automatic fallback.             | Pass   |
| IV State, audit, integrity                         | PostgreSQL is authoritative; leases and idempotency recover worker work; partial uniques prevent concurrent parse jobs; draft revisions reject stale saves; profile confirmation and audit commit atomically; append-only consent/job/confirmation evidence is retained without CV content.         | Pass   |
| V Scope / complete P0                              | The releasable P0 includes all five stories: upload/safety, review/confirmation, failure recovery, multi-device conflicts, consent/deletion/retention, and every Phase 8 quality gate. US1+US2 is only a non-release technical checkpoint. OCR, permanent CV library, recruiter access, rewriting, scoring, and admin DLQ stay excluded. | Pass   |
| VI Quality / accessibility                         | The plan evaluates latency at P95 with a documented environment, dataset, sample size, duration, concurrency, percentile method, P50/P95/P99, maximum, error rate, and cold/warm conditions; it also requires keyboard support, announced state, persistent errors, conflict recovery, reduced motion, 320-pixel validation, and the defined usability study. | Pass   |
| VII Maintainable provider-independent architecture | One App Router mechanism and Better Auth session remain. Route Handler -> Service -> Repository/Gateway layering isolates PostgreSQL, storage, ClamAV, extraction, and parsers. Initial providers/libraries and replacement boundaries are explicit.                                                | Pass   |

No waiver or complexity exception is required.

## Architecture and Pipeline

```text
Browser
  |
  +-- /profile/cv-imports/**
  +-- /api/account/cv-imports/** and /api/account/cv-drafts/**
          |
          v
      CV import services
          |
          +-- repositories -----------------------> PostgreSQL 16.12
          +-- PrivateCvStorage
          |      +-- encrypted local filesystem
          |      `-- encrypted AWS S3 + SSE-KMS
          +-- MalwareScanner ---------------------> same-host/pod clamd Unix socket
          +-- DocumentExtractor ------------------> bounded child process
          |      +-- PDF.js
          |      `-- yauzl/XML checks + Mammoth raw text
          `-- CvParser
                 +-- deterministic local/test adapter
                 `-- consent-gated OpenAI Responses adapter

CV worker
  +-- claim validation/scan/extract/parse work with SKIP LOCKED + lease
  +-- persist only safe state/result metadata
  `-- cleanup/reconcile due DB content and storage artifacts
```

- `web/src/app/` remains composition and HTTP translation only. Route Handlers
  use the Node runtime, existing account request boundary, strict shared Zod
  contracts, no-store responses, and no direct Prisma/provider calls.
- `web/src/backend/services/cv-import/` owns admission, state transitions,
  consent checks, retry policy, draft concurrency, confirmation, and deletion.
- `web/src/backend/repositories/cv-import/` owns row/advisory locks, leases,
  idempotency, partial-unique conflict mapping, and the atomic Profile import.
- `web/src/backend/cv/` owns server-only storage, scanner, extractor, parser,
  encryption, worker, retention, and safe telemetry adapters.
- `web/src/shared/contracts/cv-import/` is the strict browser/parser contract
  source aligned with `contracts/openapi.yaml` and
  `contracts/cv-parser-output.schema.json`.
- `web/src/frontend/features/cv-import/` owns in-memory upload/review state. It
  never persists CV values, source snippets, consent, keys, or tokens in a
  browser store.

### Frontend Stylesheet Ownership

- Prefer existing Tailwind utilities and shadcn/ui primitives for simple
  presentation and design-system behavior.
- A component that needs custom selectors owns an optional CSS Module beside
  its TSX file with the same basename, such as
  `cv-import-status.tsx`/`cv-import-status.module.css`; route pages may use an
  adjacent optional `page.module.css`.
- Only the matching TSX owner imports its CSS Module. Feature 004 uses no
  `:global` selectors, cross-component module imports, feature-level `styles/`
  directory, or catch-all `cv-import.css`/`cv-review.css` files.
- Feature 004 must not add selectors or imports to `app/globals.css` or the
  inherited shared `base.css`, `workspace.css`, `profile.css`, and
  `responsive.css` files. Existing tokens/custom properties remain consumable.
- A module is created only when custom CSS is necessary; utility-only
  components do not receive empty companion files.
- Architecture tests enforce co-location, basename matching, single-owner
  imports, and the absence of Feature 004 leakage into global/shared CSS.

## Upload and Quarantine Design

The browser-facing upload is a two-step, one-click UI flow:

1. `POST /api/account/cv-imports` accepts strict filename, declared media type,
   exact byte length, and selected configured parser class. Under the account
   quota-row lock it enforces the rolling attempt count, import count, and byte
   budget, creates `AWAITING_CONTENT`, and reserves the declared source bytes
   plus the fixed 512 KiB maximum extracted-text allowance. The
   `Idempotency-Key` is stored as a purpose-separated HMAC digest. Source and
   extraction completion atomically convert only actual stored bytes to retained
   usage and release unused allowance, so concurrent work cannot exceed 50 MiB.
2. `PUT /api/account/cv-imports/{uploadId}/content` accepts only the raw PDF or
   DOCX body. It requires matching `Content-Type` and `Content-Length`, streams
   at most the reserved/5,000,000-byte limit into an encrypted random quarantine
   key, computes SHA-256 over plaintext server-side, and records actual bytes. It
   does not parse a browser multipart buffer or expose a direct-storage URL.
3. Finalization verifies the create/idempotency binding. A repeated body with
   the same key is hashed in disposable quarantine: equal content returns the
   existing result and deletes the duplicate; different content returns an
   idempotency conflict and deletes the duplicate. No digest is returned.
4. The scan-stage worker first performs only bounded pre-scan envelope checks:
   exact received
   length, accepted extension/declaration, and leading PDF/DOCX magic. It does
   not open a PDF object graph, ZIP entry, XML relationship, or extractor before
   `CLEAN`. Envelope-rejected/incomplete objects are inaccessible and queued for
   deletion within 24 hours. Only an envelope-valid immutable object reaches
   the scanner; deep structure validation occurs in the post-clean extraction
   stage.

Original filenames are normalized only for safe extension/display checks,
encrypted separately with the CV metadata key, and never used in object keys.
Object keys are random, account-unrelated values. Application AES-256-GCM uses
a fresh 96-bit IV, an authenticated artifact/purpose/version context, and a
server-only versioned key; S3 additionally requires SSE-KMS and Block Public
Access. Plaintext exists only in bounded process memory/streams after owner and
job authorization.

## Malware Scan and Document Extraction

Local Compose co-locates the containerized CV worker and `clamd` through a
dedicated runtime volume at `/run/clamav/clamd.sock`; production uses the
equivalent same-host/pod sidecar runtime volume. `clamd` has no TCP listener or
published port. The socket is owned by a dedicated numeric group shared only by
those two containers, uses mode `0660`, and is rejected if world-accessible,
wrongly owned, stale, or mounted into web/email. The adapter
connects only to the configured Unix-domain socket, performs `PING`,
`VERSIONCOMMANDS`, and `VERSION` readiness checks, and streams decrypted bytes
with framed `INSTREAM`; it never gives `clamd` a host path. `StreamMaxLength` is
6 MiB, scan timeout is 20 seconds, and a signature timestamp older than 24 hours
is fail-closed. `freshclam` owns a persistent signature volume. The automatic
cycle has one initial scan and at most two automatic retries within five minutes
(three automatic attempts total). Each of the at most two explicit candidate
retries creates one scan attempt and never restarts the automatic cycle. Every
assessment records engine/signature versions and a safe result, not raw output.
The pipeline recomputes SHA-256 while decrypting for both scanning and extraction
and must match the upload/artifact digest before accepting either stage result.

After a clean result, the extractor subprocess applies format-specific rules:

- PDF.js validates the header/catalog, rejects password/encryption requests,
  limits pages to 20, rejects attachments, JavaScript/actions, launch/embedded
  content, and extracts tagged text segments by page.
- `yauzl` lazily inspects DOCX entries before Mammoth runs: normalized paths,
  no traversal/duplicates, at most 1,000 entries and 25 MiB expanded, accepted
  compression methods only, mandatory OPC/Word parts, no macros/OLE/ActiveX,
  and no external relationships after entity-disabled XML parsing.
- Mammoth is invoked only as `extractRawText` with external file access disabled.
  Output is plain tagged segments, never HTML.

The canonical extracted artifact contains segment IDs, page or paragraph
locations, and UTF-8 text, encrypted in private storage. It is capped at 512
KiB; empty/image-only or excessive output becomes a safe terminal extraction
failure with replacement/manual entry. No raw text is placed in a DB JSON,
ordinary log, trace, analytics event, or browser response.

## Parser and Consent Design

`CvParser.parse` accepts a versioned list of extracted segments and returns only
the strict parser-output schema. It cannot access repositories, storage keys,
sessions, tools, or Profile persistence. The service assigns proposal IDs,
validates every value against Feature 002 rules, verifies cited segment IDs,
derives bounded source context server-side, rejects unknown/oversized output as
a whole, and creates at most one draft/upload.

The default local/test adapter is deterministic and network-free. It supports
curated English/Vietnamese fixtures so every contributor can run the workflow
without a cloud credential; it is rejected when `APP_ENV=production`.

The initial optional production external adapter is OpenAI SDK `7.3.0` using
Responses API model snapshot `gpt-5.4-mini-2026-03-17`, Structured Outputs,
`reasoning.effort=none`, `store=false`, no background mode, tools, file upload,
conversation, or response reuse. It sends only capped tagged extracted text,
the extraction-only instruction `cv-extract-v1`, strict schema `cv-draft-v1`,
and a purpose-separated HMAC safety identifier. SDK retries are `0`; SmartHire
owns three visible attempts with 50-second adapter and 60-second hard deadlines
and bounded 2/5-second backoff, leaving margin inside the three-minute terminal
deadline.

Production enablement requires all of the following: configured API key, an
approved provider/DPA and Vietnamese cross-border/privacy assessment, an
OpenAI project verified for Zero Data Retention or equivalent approved control,
and deployment flags that exactly match the named provider/model/purpose/notice
versions. Otherwise external parsing is unavailable and the candidate receives
the internal/manual path. Before every external dispatch the worker re-checks
an append-only consent grant for the exact upload/provider/purpose/notice/text
versions and absence of revocation. Provider or version changes require a new
grant. Failure never silently chooses another parser.

The Foundation exposes only a read-only `CvConsentReadGateway` for exact live-
grant checks. US3 consumes that gateway when deciding whether an external parse
retry is eligible; US5 extends the same repository with append-only grant and
revoke mutations. US1 owns only the visible unselected control and blocked
default state, so neither US1 nor US3 depends on the full US5 consent lifecycle.

## Durable Work, Retry, and Retention

Scan assessments, extractions, and parse attempts are durable PostgreSQL queue
rows. A worker claims bounded batches with `FOR UPDATE SKIP LOCKED`, commits a
unique owner and recoverable lease before I/O, and finalizes only its own lease.
Expired leases return to due work. Each scanner/parser call is one immutable
attempt. Each initial automatic cycle permits one initial call plus at most two
automatic retries (three automatic attempts total); scanning and parsing each
permit at most two additional candidate-initiated single attempts. A candidate
retry never starts another automatic retry cycle. Every explicit retry first
creates an immutable `CvRetryRequest` bound
to the endpoint idempotency HMAC, prior terminal attempt, stage, and newly
created attempt. This makes old-key replay and rebound conflict durable across
stage changes. A PostgreSQL partial unique index permits only one
`QUEUED`/`PROCESSING` parse attempt per account. No Redis, in-memory-only queue,
or unsupported admin DLQ is introduced.

Exhausted parsing attempts set `PARSE_FAILED` immediately and preserve safe
attempt history while offering replacement, a bounded explicit retry, and the
existing Feature 002 Profile editor. Manual recovery never creates an empty CV
draft and never discards the failed import's safe status/history.

The CV worker runs independent pre-scan validation/scan, extraction, parse,
deletion, and reconciliation loops with bounded concurrency. Locally it runs in
the Compose service that shares the `clamd` socket volume and bind-mounts the
host `web/.local/cv-storage` at `/app/.local/cv-storage`; Compose overrides
`CV_STORAGE_LOCAL_ROOT` to that container path and the database endpoint to
`postgres:5432`, while the host web/email processes retain host-native paths and
loopback database settings. In production the worker is deployed beside `clamd`
on the same pod/host. The root
development supervisor starts Next.js and the existing email worker, starts and
monitors the Compose-backed CV worker/ClamAV services, and forwards
SIGINT/SIGTERM on Windows/macOS/Linux. Operational signals contain queue depth,
lease age, stage duration, safe result code, signature age, cleanup lag, and
provider/model/version identifiers only—never filenames, text, contact details,
digests, object keys, consent text, prompts/responses, or tokens.

An injected Clock drives logical expiry and cleanup:

- rejected, infected, or incomplete artifacts: delete by 24 hours;
- unconfirmed upload, extracted text, draft, and provenance: delete by 30 days
  from upload;
- after confirmation: content becomes inaccessible immediately and source,
  extracted text, draft payload, and provenance delete within 7 days;
- candidate deletion: transition active imports to `CANCELLED`, cancel work and
  deny access in the same transaction, then delete all source, extracted, draft,
  and provenance content idempotently within 24 hours and transition to
  `DELETED` only after physical/database cleanup completes.

The application cleanup worker is authoritative for exact deadlines. The S3
bucket is non-versioned and has a 31-day maximum object-expiration safeguard
plus one-day abort of incomplete multipart uploads. Reconciliation compares
safe DB artifact references with provider inventory, marks already-missing
objects idempotently, schedules known orphans for deletion, and never logs keys.

## Draft Review and Transactional Confirmation

Draft JSON stores proposed/edited values and review actions; provenance stores
only verified segment references and bounded server-derived context. Current
Profile values are loaded live and are not copied into the draft. Selection is
per scalar field, per experience/education/social-link entry, and per skill.
Structured entry fields can be edited but the entry is selected atomically. The
review derives valid scalar choices from that live Profile snapshot: an empty
field exposes `ADD`/`SKIP`, while a populated field exposes `REPLACE`/`SKIP`.
When no review payload has been saved, the server builds Profile-aware initial
decisions from the same live snapshot: unmatched values and entries default to
`ADD`; populated scalars and collection entries with exactly one normalized
match default to `REPLACE` with that owned target. Multiple collection matches
and existing skills default to `SKIP` because collection replacement would be
ambiguous and skills have no replace operation. Persisted candidate decisions
are returned unchanged and are never recalculated. These defaults do not write
Candidate Profile; only the existing explicit confirmation transaction applies
them.
The repository re-evaluates the same rule against the authoritative Profile in
the save transaction and returns an `ACTION_MISMATCH` attached to the exact
`reviewDecisions.scalars.{index}.action` path if the submitted choice is stale
or invalid.

Review validation is intentionally layered. The browser applies the shared
normalization, required-value, date, URL, collection-limit, and scalar-action
rules before PATCH where possible. The service and repository remain
authoritative, reject duplicate normalized proposed skills/social links, and
return stable `fieldErrors` with canonical proposal or decision paths. The
client preserves in-memory edits and the complete server field-error array,
clears an individual error only when its associated value or decision changes,
and focuses the first invalid control after an explicit failed save. Every
failure renders an adjacent text message and programmatic invalid state plus a
persistent summary; a bounded Sonner error toast is supplemental and never the
sole feedback channel. Component-owned CSS Modules provide the red invalid
border/background while text and ARIA associations ensure color is not the only
signal.

Every PATCH names `baseDraftRevision` and `reviewedProfileRevision`. The
repository uses a compare-and-swap update and increments the draft revision.
A stale save returns `409 DRAFT_REVISION_CONFLICT` and the latest revision;
the browser retains unsaved values in memory and offers compare/reload. A live
Profile revision change returns a fresh comparison; saving the reviewed choices
records the new reviewed profile revision and increments the draft revision.

Confirm names the exact draft, source Profile, and reviewed/current Profile
revisions and uses an idempotency key bound to those revisions plus a digest of
the saved non-content selection manifest. One transaction:

1. validates ACTIVE account/ownership and locks upload, draft, and Profile;
2. re-checks clean/unexpired state, exact revisions, consent, target child
   ownership, duplicate hints, and every Feature 002 validation rule;
3. applies only selected scalar/entry/skill operations while preserving chosen
   owned child IDs and resolving shared skills under the existing catalog rules;
4. increments CandidateProfile revision exactly once;
5. marks upload/draft confirmed and immutable, creates one non-content
   confirmation receipt, sets deletion deadlines, releases quota as content is
   physically removed, and appends the allowlisted audit outcome.

Any failure rolls back all five steps. A duplicate identical confirmation
returns the original receipt/profile revision; a rebound key fails. The receipt
contains identifiers, timestamps, action/field names, counts, and revisions but
no field values, source snippets, skipped values, content digest, or object key.

## Browser Resources and Pages

### Browser API

| Resource/action       | Method/path                                              | Boundary                                                                          |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Create/list imports   | `POST/GET /api/account/cv-imports`                       | Reserve metadata/idempotency or list at most 10 safe owned summaries              |
| Upload content        | `PUT /api/account/cv-imports/{uploadId}/content`         | Raw bounded PDF/DOCX stream into encrypted quarantine                             |
| Import status/receipt | `GET /api/account/cv-imports/{uploadId}`                 | Authoritative safe state, available actions, consent need, or non-content receipt |
| Delete import         | `DELETE /api/account/cv-imports/{uploadId}`              | `202` safe `CANCELLED`/`DELETED` lifecycle, logical denial, cleanup scheduling     |
| Grant/revoke consent  | `POST/DELETE /api/account/cv-imports/{uploadId}/consent` | Exact server-selected external processing binding                                 |
| Retry terminal stage  | `POST /api/account/cv-imports/{uploadId}/retries`        | New idempotent scan/parse retry within caps                                       |
| Read draft comparison | `GET /api/account/cv-drafts/{draftId}`                   | Owned draft plus live Profile comparison; no raw document                         |
| Save draft/review     | `PATCH /api/account/cv-drafts/{draftId}`                 | Full bounded review payload with optimistic revisions                             |
| Confirm import        | `POST /api/account/cv-drafts/{draftId}/confirm`          | Exact revisions; atomic selected Profile update                                   |

P0 intentionally exposes no browser or API route that returns, previews, or
downloads the original CV. The conditional short-lived retrieval path in
FR-024 is therefore not activated by Feature 004. Adding source retrieval later
requires a separately approved specification, authorization contract, content-
disposition policy, and retention review rather than an undocumented route.

All responses are `Cache-Control: no-store`; protected mutations require the
existing session-derived CSRF proof, exact origin, and Fetch Metadata. Unknown
and foreign IDs map to the same non-disclosing safe result. An owner may read
only a content-free `CANCELLED`/`DELETED`/`EXPIRED` tombstone so the terminal
lifecycle is visible; content remains denied from `contentInaccessibleAt`. The
contract accepts no owner/account/profile ID and no browser-selected storage
key, scanner, raw provider model, notice version, or arbitrary parser endpoint.

### App Router pages

- `/profile/cv-imports`: display the versioned CV-processing privacy notice for
  every parser class, choose the available parser independently for each
  upload, create upload, and view bounded owned history. In local development,
  enabling the external adapter does not disable the non-network deterministic
  adapter. External parsing additionally uses the separate unselected consent
  control.
- `/profile/cv-imports/[uploadId]`: persistent progress, consent, failure,
  retry/delete, manual-profile link, and confirmed receipt. External imports
  distinguish pre-dispatch preparation, awaiting consent, provider queue,
  provider request in progress, schema-validated success, safe provider failure,
  and temporary status-API failure without exposing raw provider details.
- `/profile/cv-imports/[uploadId]/review`: current-versus-proposed review,
  edits/selections, Profile-aware scalar actions, field-addressable validation
  feedback, conflicts, and confirmation. Invalid saves retain edits, focus the
  first affected control, and show both persistent and brief supplemental
  feedback.
- `/profile`: existing Feature 002 editor used for manual recovery.

Progress uses bounded in-memory polling with visibility-aware backoff; server
state is authoritative. No CV content enters localStorage, sessionStorage,
Zustand, persisted TanStack cache, service-worker cache, URL/query string, or
analytics. Sonner supplements but never replaces persistent status/error text.

## Environment Configuration

| Variable                                           | Purpose                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `CV_STORAGE_ADAPTER`                               | `filesystem` for local/test or `s3` for production; production rejects filesystem |
| `CV_STORAGE_LOCAL_ROOT`                            | Absolute per-process artifact root; host uses `web/.local/cv-storage`, Compose worker overrides to `/app/.local/cv-storage`; rejected in production |
| `CV_ARTIFACT_KEY_V1`                               | Server-only 32-byte application encryption key; never `NEXT_PUBLIC_`              |
| `CV_S3_BUCKET`, `CV_S3_REGION`, `CV_S3_KMS_KEY_ID` | Private non-versioned S3 bucket and required SSE-KMS configuration                |
| standard AWS credential variables/role             | Production S3 role; static credentials are not committed or browser-exposed       |
| `CV_CLAMD_SOCKET_PATH`                             | Same-host/pod Unix socket; fixed container default `/run/clamav/clamd.sock`; TCP values are rejected |
| `CV_CLAMD_SIGNATURE_MAX_AGE_HOURS`                 | Fixed deployment validation value `24`                                            |
| `CV_PARSER_ADAPTER`                                | `deterministic` by default for local/test, `openai` for approved production or explicit local development; local/test deterministic availability remains independent so each upload may choose either ready parser |
| `CV_OPENAI_ENABLED`, `OPENAI_API_KEY`              | Server-only external parser gate and credential                                   |
| `CV_OPENAI_LOCAL_DEV_ENABLED`                      | Local-only explicit network opt-in; forbidden in production and normal automated tests |
| `CV_OPENAI_MODEL`                                  | Must equal approved snapshot `gpt-5.4-mini-2026-03-17` for this plan              |
| `CV_OPENAI_ZDR_APPROVED`                           | Explicit production deployment assertion checked with other compliance evidence   |

Production reuses the project's HTTPS deployment gate: the trusted ingress or
proxy terminates TLS, redirects HTTP to HTTPS, emits the approved HSTS policy,
and preserves secure-cookie and origin semantics. External provider traffic is
restricted to the reviewed SDK HTTPS endpoint; custom base URLs, endpoint
overrides, and non-HTTPS destinations fail configuration validation. Release
evidence must link to the deployed ingress/proxy check rather than assuming
local HTTP behavior represents production.

Parser purpose, notice text version, instruction version, schema version, size
caps, retry caps, and retention deadlines are versioned code constants rather
than freely editable environment values. Update root/web example environments,
local secret generation, environment validation, Compose health/resources, and
README commands without printing secrets, paths, provider payloads, or CV data.

## Database Migration Strategy

Create one reviewed forward Feature 004 migration; never edit migrations
`001` through `007`.

1. Add CV enums, quota/upload/artifact/scan/extraction/parse/retry/draft/consent/
   confirmation models, relations from UserAccount/CandidateProfile, indexes,
   FK actions, JSON byte checks, and state invariants.
2. Add raw SQL partial unique indexes for one active parse/account and active
   idempotency/consent invariants that Prisma cannot express.
3. Add append-only protection for retry bindings, consent events, terminal parse
   evidence, and confirmations; permit only the documented lease-to-terminal
   transitions.
4. Add cleanup/deadline indexes and verify every content-bearing row has an
   owning upload plus logical and physical deletion evidence.
5. Regenerate Prisma, verify no Better Auth-owned field/model is changed, and
   extend AuditEvent's code allowlist without changing its table ownership.
6. Run `db:verify` from an empty database and from migrations `001..007`, inspect
   drift, and retain backup plus forward-fix recovery instructions. Rollback is
   application disablement and forward correction, not editing an applied SQL
   file or deleting stored CV content outside the cleanup contract.

There is no data backfill. Existing candidates have no imports/quota row until
first use. Disabling Feature 004 stops new uploads and parser dispatch while the
cleanup worker remains enabled until all retained temporary artifacts are
reconciled.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/004-cv-upload-parse-review/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- openapi.yaml
|   |-- internal-contracts.md
|   `-- cv-parser-output.schema.json
|-- checklists/
|   `-- requirements.md
`-- tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
compose.yaml
infra/
`-- clamav/{clamd.conf,freshclam.conf}
scripts/
|-- run-local-development.mjs
|-- setup-local.mjs
`-- check-environment.mjs

web/
|-- Dockerfile.cv-worker
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/008_cv_upload_parse_review/
|-- scripts/
|   |-- check-cv-scanner.mjs
|   `-- run-cv-worker.mjs
|-- src/
|   |-- app/
|   |   |-- (workspace)/profile/cv-imports/
|   |   |   |-- page.tsx
|   |   |   `-- [uploadId]/{page.tsx,review/page.tsx}
|   |   `-- api/account/
|   |       |-- cv-imports/{route.ts,[uploadId]/**/route.ts}
|   |       `-- cv-drafts/[draftId]/{route.ts,confirm/route.ts}
|   |-- backend/
|   |   |-- cv/
|   |   |   |-- encryption/
|   |   |   |-- storage/{private-cv-storage.ts,filesystem.ts,s3.ts}
|   |   |   |-- scanning/{malware-scanner.ts,clamav.ts}
|   |   |   |-- extraction/{document-extractor.ts,pdf.ts,docx.ts,runner.ts}
|   |   |   |-- parsing/{cv-parser.ts,deterministic.ts,openai.ts}
|   |   |   `-- workers/{cv-worker-runtime.ts,pipeline.ts,cleanup.ts}
|   |   |-- services/cv-import/
|   |   |-- repositories/cv-import/
|   |   `-- audit/events.ts
|   |-- frontend/features/cv-import/
|   |   |-- client/
|   |   `-- components/  # *.tsx + optional same-basename *.module.css
|   `-- shared/contracts/cv-import/
`-- tests/
    |-- architecture/cv-import-boundaries.test.ts
    |-- architecture/cv-import-style-boundaries.test.ts
    |-- backend/{compatibility,unit,contract,integration}/cv-import/
    |-- frontend/{components,accessibility}/cv-import/
    |-- fixtures/cv/{clean,malicious,parser}/
    `-- system/e2e/cv-import/
```

**Structure Decision**: Extend the existing `web/` modular monolith and its
separate worker convention. Keep thin App Router boundaries, business policy in
services, PostgreSQL ownership/transactions in repositories, provider code
under server-only `backend/cv/`, browser-safe strict contracts under `shared/`,
and all fixtures/tests under the existing test hierarchy. Custom Feature 004
styles are optional same-basename CSS Modules co-located with their TSX owners;
no feature-level or shared/global stylesheet becomes a Feature 004 ownership
boundary. No second backend, database, browser-session mechanism, public file
service, or client-side CV state store is introduced.

## Verification Strategy

- **Dependency/architecture**: exact versions and image digest, Node compatibility,
  server-only imports, no direct Prisma/providers in routes/client, no second
  session/JWT, and no internal HTTP from Server Components.
- **Contracts**: OpenAPI/Zod/JSON-Schema parity, strict unknown-property rejection,
  raw-body header/size rules, no owner IDs, no sensitive responses, exact
  state/error/action enums, and idempotency conflict behavior.
- **File security**: bounded envelope/magic checks in the scan-stage worker
  before scan; Unix-socket-only ClamAV with no TCP listener, dedicated group,
  `0660` mode, and web/email isolation; deep structure/extraction only after `CLEAN`;
  type/structure mismatches, polyglots, EICAR, encrypted and active PDFs,
  image-only PDFs, malformed/zip-bomb/traversal/external/macro DOCX, interrupted
  streams, stale signatures, scanner timeout, and no parser access before clean.
- **Worker/integration**: duplicate delivery, crash/lease expiry, retry timing,
  one active parse/account, provider timeout, strict output rejection, prompt
  injection, consent revocation before dispatch, deletion races, and no direct
  Profile write.
- **PostgreSQL concurrency**: quota races, cross-account equal digest privacy,
  two draft writers, save/confirm race, direct Profile save/confirm race,
  duplicate confirmations, exact one-revision outcome, and complete rollback.
- **Privacy/retention**: encrypted storage, S3 policy contract, no public URL,
  no original-CV retrieval route, no browser persistence, safe
  logs/audit/metrics, exact logical/physical deadlines, idempotent deletion,
  quota release, and orphan reconciliation.
- **Production transport**: link the inherited HTTPS deployment gate and prove
  trusted ingress/proxy TLS termination, HTTP-to-HTTPS redirect, approved HSTS,
  secure-cookie/origin preservation, an allowlisted HTTPS provider endpoint,
  and rejection of custom or non-HTTPS provider destinations.
- **Component/accessibility**: a versioned processing notice for every parser,
  separate unselected external consent, keyboard upload/review/actions,
  Profile-aware `ADD`/`REPLACE` availability, local and server validation mapped
  to exact fields, focus/error summary, brief error toast backed by persistent
  feedback, announced processing/save/conflict/cancellation states, explicit
  missing-provenance UI, unsaved local preservation, duplicate proposal errors,
  reduced motion/contrast, and 320-pixel layout; architecture checks
  additionally enforce same-directory/same-basename CSS Module ownership,
  matching-owner-only imports, and no Feature 004 selectors or imports in
  global/shared stylesheets.
- **E2E/performance/usability**: full valid upload-to-confirm, every terminal
  recovery path, external consent grant/revoke, multi-device review, deletion
  and expiry, `CANCELLED` to `DELETED` cleanup within 24 hours, measured P95
  5s/3s/2s targets plus the 60s/3m processing distribution, and at least 90%
  first-attempt completion in a minimum 30-person study split across desktop and
  320-pixel mobile with PDF/DOCX and Vietnamese/English/bilingual fixtures.

Runnable commands, fixtures, controlled-provider setup, expected outcomes, and
safe troubleshooting are in `quickstart.md`.

## Post-Design Constitution Re-check

All gates still pass after research, data modeling, external/internal contracts,
and validation design. Feature 004 preserves one Better Auth browser session,
one PostgreSQL authority, and one Next.js routing mechanism; every provider is
behind a server-only interface; candidate data stays private and temporary;
OpenAI requires exact consent and deployment privacy approval; parser output is
non-authoritative; confirmation remains human-controlled and atomic; and every
failure retains a bounded manual path. No constitutional waiver is required.

## Inherited Browser Session Boundary

Feature 004 defines no new browser-session mechanism. It inherits the complete
Feature 001 lifecycle, with Better Auth remaining the exclusive owner of session
creation, validation, persistence, expiration, and revocation:

- Authentication state is an opaque Better Auth session token persisted in its
  PostgreSQL `Session` row and referenced only by the server-controlled cookie.
  Production uses the `__Host-smarthire.session` cookie with `Secure`,
  `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`; local HTTP uses the
  inherited unprefixed non-`Secure` development cookie.
- Every protected request first performs Better Auth server validation and then
  applies SmartHire's account-state, 30-minute idle-expiry, and creation-plus-
  seven-day absolute-expiry checks. An invalid, naturally expired, or revoked
  session is rejected and revoked where possible; cleanup of expired/revoked
  PostgreSQL rows is defense in depth rather than the authorization boundary.
- Logout revokes the current session and clears its cookie, explicit session
  management can revoke selected sessions, and password reset revokes all Better
  Auth sessions for the account. Feature 004 does not redefine any of these
  outcomes.

Every Feature 004 CV upload, parse-status, review, and confirmation endpoint
under `/api/account/cv-imports/**` or `/api/account/cv-drafts/**` MUST pass through
the same Feature 001 session-validation middleware/boundary. There is no Feature
004 authentication cookie, JWT, session table, or alternate authentication
mechanism. The official lifecycle source is
`spec-kit/specs/001-identity-authentication-account-recovery/plan.md:146`.

## Complexity Tracking

No constitutional violation requires justification.
