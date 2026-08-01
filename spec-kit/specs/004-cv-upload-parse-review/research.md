# Research: CV Upload, Parse, and Review

This document resolves the implementation choices that were intentionally left
open by the feature specification. The choices preserve the existing SmartHire
modular monolith, treat every CV and parser result as untrusted temporary data,
and keep the candidate in control of all Profile changes.

## 1. Application Boundary

**Decision**: Extend the existing Next.js application with thin Route Handlers,
CV import services and repositories, server-only provider adapters, and one
separate CV worker process. PostgreSQL remains the only authoritative database.

**Rationale**: The repository already uses Route Handler -> Service ->
Repository/Gateway boundaries and durable PostgreSQL leases for background
work. Reusing those boundaries keeps authentication, ownership, transaction,
deployment, and observability behavior consistent.

**Alternatives considered**:

- A standalone CV microservice was rejected because it would add a second auth
  boundary, deployment unit, and distributed transaction without current scale
  evidence.
- Synchronous parsing inside the upload request was rejected because scanner,
  extraction, and provider latency cannot meet a reliable request lifetime.
- Redis or a hosted queue was rejected for the P0 release because PostgreSQL
  leases already provide durable recovery and the expected throughput is bounded.

## 2. Upload Protocol, Admission, and Idempotency

**Decision**: Use a two-request, one-click browser flow. A JSON `POST` reserves
quota and creates an `AWAITING_CONTENT` import; a raw-body `PUT` streams exactly
one PDF or DOCX into encrypted quarantine. Require `Content-Length`, declared
media type, and a purpose-bound `Idempotency-Key`. Compute SHA-256 server-side.

**Rationale**: Reservation allows upload-count, attempt-rate, and byte quotas to
be locked before accepting a body. A raw stream avoids multipart buffering and
does not expose a direct storage URL. An idempotency key safely recovers browser
retries; SHA-256 verifies repeated content and later storage integrity without
being an account-crossing deduplication key.

Admission reserves the declared source bytes plus the fixed 512 KiB maximum
extracted-text allowance. Finalization/extraction atomically convert actual
stored bytes to retained usage and release unused allowance. This prevents
concurrent pipelines from crossing the 50 MiB artifact cap after admission.

**Alternatives considered**:

- Browser-to-S3 presigned uploads were rejected because the server could not
  enforce every byte and idempotency invariant before quarantine.
- Multipart form uploads were rejected because common parsers buffer untrusted
  content and add no value for a single file.
- Cross-account hash deduplication was rejected because digest matches can leak
  whether another candidate uploaded the same document.
- Reusing an old draft for a repeated digest was rejected because Profile state,
  consent, parser versions, and user intent may have changed. A new import is
  parsed independently unless it is the same idempotent operation.

## 3. Private Artifact Storage and Encryption

**Decision**: Define `PrivateCvStorage`. Local/test uses an encrypted,
gitignored filesystem root; production uses a private, non-versioned AWS S3
bucket with Block Public Access and SSE-KMS. Every source and extracted-text
artifact is additionally encrypted by the application with AES-256-GCM, a
fresh 96-bit IV, versioned keys, and authenticated artifact context.

**Rationale**: The common interface makes storage replaceable and permits local
development without cloud credentials. Application encryption provides the
same confidentiality boundary in both adapters; S3 controls add production
defense in depth. Random object keys and encrypted display filenames prevent
PII from entering provider inventories.

**Alternatives considered**:

- PostgreSQL `bytea`/JSON storage was rejected because large temporary payloads
  would enlarge backups, WAL, and query paths.
- Public or long-lived signed URLs were rejected because all bytes must pass an
  authenticated application boundary.
- S3 versioning was rejected for this temporary store because hidden versions
  complicate guaranteed erasure. Recovery is provided by idempotent processing,
  not artifact version retention.

The application cleanup worker owns exact deletion deadlines. An S3 lifecycle
rule expiring objects at 31 days and aborting incomplete multipart uploads after
one day is only a maximum-age safeguard, not the primary scheduler.

References: [S3 lifecycle management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html),
[S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html),
and [SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html).

## 4. Malware Scanning

**Decision**: Use private ClamAV `1.4` LTS, initially `1.4.5`, from the official
`clamav/clamav:1.4_base` image. Pin the resolved OCI digest during implementation.
Co-locate `clamd` and the CV worker on the same pod/host and communicate through
framed `INSTREAM` over `/run/clamav/clamd.sock`. Local Compose uses a dedicated
runtime volume shared only by those containers; production uses the equivalent
sidecar or same-host runtime volume. A dedicated numeric group shared by exactly
the worker and daemon owns the socket with mode `0660`; startup removes stale
socket entries and readiness rejects wrong ownership/mode. Disable
`TCPSocket`/`TCPAddr` and publish no scanner port.
Never mount or provide an artifact host path to `clamd`. Persist signature data
for `freshclam`, require definitions no older than 24 hours, limit the daemon
stream to 6 MiB, and time out a scan after 20 seconds.

**Rationale**: `clamd` gives a well-understood local scanning boundary without
sending candidate files to another cloud. A Unix-domain socket removes network
transport and therefore does not weaken the constitution's HTTPS requirement;
it is also lower-overhead and narrower than a TCP listener. `INSTREAM` preserves
storage abstraction and avoids path traversal. Version/digest pinning plus
signature-age checks make the dependency reproducible and fail closed.

For local filesystem parity, Compose bind-mounts the host
`web/.local/cv-storage` into the worker at `/app/.local/cv-storage` and overrides
the worker's storage root and PostgreSQL endpoint for container paths. Web and
email processes keep their host-native paths and cannot mount the scanner
socket. This avoids passing a Windows/macOS host path into the Linux worker.

**Alternatives considered**:

- VirusTotal was rejected because it adds third-party document disclosure and
  unsuitable retention/sharing semantics for private CVs.
- Provider-native asynchronous S3 scanning was not selected for the first
  implementation because it would make local parity and provider replacement
  harder; it can implement `MalwareScanner` later.
- Private-network or loopback TCP was rejected because it still creates a
  network listener, conflicts with the project's network-transport policy, and
  is unnecessary when the worker and daemon are deliberately co-located.
- Skipping scans in development was rejected. Contributors should exercise the
  same clean/infected/indeterminate transitions using EICAR fixtures.

References: [ClamAV Docker images](https://docs.clamav.net/manual/Installing/Docker.html),
[ClamAV clamd protocol](https://docs.clamav.net/manual/Usage/Scanning.html#clamd),
and [official releases](https://github.com/Cisco-Talos/clamav/releases).

## 5. Structural Validation and Text Extraction

**Decision**: Run extraction only after a clean scan and in a child process
limited to 15 seconds and 192 MiB old-space. Use exact server-only packages:

- `pdfjs-dist@6.2.108` for PDF structure, page limits, and tagged text;
- `yauzl@3.4.0` for lazy ZIP-entry inspection of DOCX;
- `fast-xml-parser@5.10.1` with entities disabled for OPC relationships;
- `mammoth@1.12.0` only for `extractRawText`, with external-file access off.

PDFs are rejected when encrypted/password-protected, above 20 pages, or
containing attachments, JavaScript/actions, launch, or embedded content. DOCX
archives are rejected for traversal/duplicate paths, unsupported compression,
more than 1,000 entries, more than 25 MiB expanded data, missing required Word
parts, macros, OLE/ActiveX, or external relationships. Extracted tagged UTF-8
text is an encrypted storage artifact capped at 512 KiB, never a DB JSON field.

**Rationale**: MIME/magic checks alone do not establish that a document is safe
or usable. ZIP inspection must occur before a high-level DOCX parser. Process
isolation bounds hangs and memory bombs while segment IDs provide auditable
provenance without returning the raw CV to the browser.

**Alternatives considered**:

- LibreOffice conversion was rejected due to a much larger process and attack
  surface for extraction-only needs.
- HTML conversion was rejected because the product needs facts, not document
  rendering, and sanitizing generated HTML would add risk.
- OCR was deferred because it changes cost, privacy, abuse, and accuracy
  controls. Image-only files receive a clear manual-entry path.

References: [PDF.js API](https://mozilla.github.io/pdf.js/api/),
[Mammoth repository](https://github.com/mwilliamson/mammoth.js), and
[yauzl repository](https://github.com/thejoshwolfe/yauzl).

## 6. Durable Pipeline and Retry Ownership

**Decision**: Represent scan assessments, extraction attempts, and parser
attempts as durable PostgreSQL rows. Workers claim small batches with
`FOR UPDATE SKIP LOCKED`, commit an owner and lease before external I/O, and
finalize only the currently owned lease. Expired leases become claimable.

For each stage, allow one initial attempt plus at most two automatic retries
(three automatic attempts total), followed by at most two candidate-initiated
single attempts. A candidate retry never restarts the automatic retry cycle.
Each explicit retry has a separate immutable idempotency row bound to the prior
terminal attempt, stage, and new attempt, so an old key remains replayable and
cannot be rebound after state changes. A partial unique index permits only one
`QUEUED` or `PROCESSING` parse attempt per account. After all parser attempts
fail, the import becomes `PARSE_FAILED` and immediately offers retry (when
capacity remains), document replacement, and manual Profile entry. It does not
wait for an administrator.

**Rationale**: Immutable attempt rows preserve safe operational evidence and
make crash recovery explicit. A terminal user-facing state prevents a hidden
dead-letter queue from leaving the UI indefinitely pending.

**Alternatives considered**:

- An in-memory queue was rejected because a process restart would lose work.
- Unlimited/exponential retries were rejected because they can exceed the
  three-minute terminal bound and amplify provider incidents.
- A P0 admin retry UI was rejected as unnecessary scope. Operational staff
  can inspect non-content metrics, while candidates own the bounded retry path.

## 7. Parser Interface and Provider Choice

**Decision**: Define a server-only `CvParser` interface accepting versioned,
capped extracted segments and returning the strict `cv-draft-v1` JSON schema.
Provide two adapters:

1. A deterministic, non-network adapter for curated Vietnamese/English local
   and test fixtures. Production startup rejects this adapter.
2. An optional approved production adapter using `openai@7.3.0`, the Responses
   API, the stable `gpt-5.4-mini-2026-03-17` snapshot, Structured Outputs,
   `reasoning.effort=none`, `store=false`, no tools/files/conversation/background
   mode, and SDK retries disabled.

SmartHire owns a 50-second adapter timeout, a 60-second hard attempt deadline,
and 2/5-second retry delays. The service validates the entire result, assigns
proposal IDs, verifies cited segment IDs, applies Feature 002 caps, and rejects
unknown or oversized output. Parser output never writes a Candidate Profile.

**Rationale**: A narrow interface keeps provider replacement possible. A stable
snapshot and strict output contract improve reproducibility. The smaller model
is appropriate for bounded extraction, while deterministic fixtures keep the
repository runnable without tokens or billable services.

**Alternatives considered**:

- A flagship model was not chosen by default because the task is schema-bound
  extraction and requires predictable cost/latency more than open-ended
  reasoning.
- Tool/file upload and retained responses were rejected because only minimized
  tagged text is needed.
- Automatic fallback to another external provider was rejected because it
  would invalidate consent and produce nondeterministic privacy behavior.

Production external parsing remains disabled unless the exact provider/model/
purpose/notice versions, API key, DPA/privacy and cross-border review, and an
OpenAI project verified for Zero Data Retention or an approved equivalent are
all present. OpenAI documents that API abuse-monitoring logs may otherwise
retain content for up to 30 days, so `store=false` alone is not treated as the
deployment privacy control. See [OpenAI data controls](https://platform.openai.com/docs/guides/your-data),
[model reference](https://platform.openai.com/docs/models), and
[Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs).

## 8. Consent and Audit Evidence

**Decision**: Show a versioned CV-processing privacy notice for every parser
class and include its safe projection in the import list/status contracts. Store
append-only consent events rather than a mutable boolean only for external
transmission. An external grant or revocation is bound to the account, upload,
provider, provider class, model, purpose, notice version, and consent-text
version. Before every external dispatch the worker verifies the latest exact
grant and absence of a later revocation. A version/provider change requires a
new grant.

**Rationale**: The general notice explains CV processing even when all work is
internal; it is disclosure, not an external-transmission consent gate.
Timestamped immutable external-consent evidence answers what the candidate
agreed to and supports revocation between retries. It also prevents consent for
one upload or provider from silently authorizing another.

**Alternatives considered**:

- `aiConsentGivenAt` on `CvUpload` was rejected because it cannot represent
  revocation or the exact text/provider/version that was accepted.
- Account-wide permanent consent was rejected because the disclosed processing
  context can change.

Consent and audit records contain identifiers, versions, timestamps, and safe
outcome codes only; no CV text, filename, prompt, response, token, digest, or
object key is stored in ordinary logs or audit events.

## 9. Draft Shape, Provenance, and Concurrency

**Decision**: Persist parser results only in a `CvDraft` with three bounded JSON
documents: editable proposals/review decisions (combined maximum 256 KiB) and
verified provenance (maximum 128 KiB). Raw extracted text remains in encrypted
object storage. Current Profile values are loaded live and never copied into the
draft.

Selection granularity is one scalar field, one experience/education/social-link
entry, or one skill. Structured entries are edited field-by-field but selected
atomically. Each draft stores `revision` and `reviewedProfileRevision`; every
save uses compare-and-swap. Two tabs/devices therefore receive the same
`DRAFT_REVISION_CONFLICT` behavior, and the browser keeps unsaved values only in
memory for compare/reload.

**Rationale**: A complete server-saved review decision makes confirmation
deterministic and idempotent. Revision checks cover both concurrent draft edits
and Profile changes made while review is open.

**Alternatives considered**:

- Last-write-wins was rejected because it can silently discard review choices.
- Browser-only selections were rejected because confirmation could not bind to
  an exact saved manifest.
- Copying the entire Profile into JSON was rejected due to staleness, duplicate
  sensitive data, and payload growth.

## 10. Transactional Confirmation

**Decision**: Confirm with exact draft/Profile revisions and an idempotency key
bound to a digest of the saved non-content selection manifest. In one PostgreSQL
transaction, lock ownership rows; revalidate state, revisions, caps, and all
Feature 002 rules; apply only selected changes; increment the Profile revision
once; lock the import/draft; create a non-content receipt; set deletion
deadlines; and append an allowlisted audit outcome.

**Rationale**: A single transaction prevents partial Profile updates and makes
retry outcomes stable. The candidate can inspect and alter every proposed value
before this operation.

**Alternatives considered**:

- Applying each Profile section separately was rejected because a later failure
  would expose partial imports.
- Writing parser output directly to Profile was rejected by both product policy
  and the human-control constitution principle.
- Recording imported values in the receipt was rejected because it would create
  an unnecessary long-lived copy of temporary CV content.

## 11. Retention, Quota Release, and Reconciliation

**Decision**: Use explicit `contentInaccessibleAt`, `deleteAfter`, deletion
lease, and `deletedAt` fields on content-bearing resources/artifacts. The cleanup
worker applies these deadlines:

- rejected, infected, or incomplete artifacts: physical deletion by 24 hours;
- unconfirmed uploads/drafts/provenance: deletion by 30 days from upload;
- confirmed content: inaccessible immediately and physically deleted in 7 days;
- candidate deletion: inaccessible and work-cancelled in the transaction, then
  physically/database removed within 24 hours; the aggregate remains
  `CANCELLED` while cleanup is pending and becomes `DELETED` only after all
  temporary content is gone.

Quota reservation is released only as tracked bytes are physically deleted,
so a cleanup outage cannot create unbounded retained storage. A reconciliation
loop compares safe DB references with provider inventory, treats already absent
objects as an idempotent success, and removes orphans without logging keys.

**Rationale**: `expiresAt` alone does not perform cleanup. Explicit leases and
outcomes make retention enforceable, observable, retryable, and testable.

## 12. Browser UX, Accessibility, and Polling

**Decision**: Use three protected App Router pages for upload/history, status,
and review. Poll safe status in memory with bounded, visibility-aware backoff;
PostgreSQL remains authoritative. Persist no CV content in browser storage,
URLs, analytics, service-worker caches, or persisted query caches. All responses
are `Cache-Control: no-store`.

Status, retry, consent, conflicts, and errors have persistent text in addition
to optional toasts. Evidence explicitly displays an unavailable/missing state
when verified provenance or context is absent; the UI never implies a source
that was not verified. Keyboard operation, focus management, live-region status,
reduced motion, contrast, and a 320-pixel viewport are acceptance requirements.

**Rationale**: Polling fits the existing stack and bounded processing time
without introducing a WebSocket/SSE deployment dependency. Persistent,
announced state ensures the asynchronous flow remains understandable and
recoverable.

## 13. Dependency and Deployment Gate

**Decision**: Pin all npm packages in the sole root lockfile and import them only
inside server-only CV boundaries. Before application/schema work is accepted,
verify Node/TypeScript compatibility, representative extraction, ClamAV/EICAR,
production build, license and container review, architecture boundaries, and
`npm audit --json` with no unreviewed high/critical finding.

**Rationale**: File parsers, an antivirus daemon, object storage, and an external
AI SDK materially increase the attack and supply-chain surface. A failing gate
must allow adapter/package substitution before the data model is relied upon.

Package versions researched for this plan:

| Package              |    Version | Runtime baseline             | License      |
| -------------------- | ---------: | ---------------------------- | ------------ |
| `openai`             |    `7.3.0` | Node >=22                    | Apache-2.0   |
| `@aws-sdk/client-s3` | `3.1101.0` | Node >=20                    | Apache-2.0   |
| `pdfjs-dist`         |  `6.2.108` | Node >=22.13 or >=24         | Apache-2.0   |
| `mammoth`            |   `1.12.0` | compatible with project Node | BSD-2-Clause |
| `yauzl`              |    `3.4.0` | compatible with project Node | MIT          |
| `@types/yauzl`       |    `3.4.0` | development only             | MIT          |
| `fast-xml-parser`    |   `5.10.1` | compatible with project Node | MIT          |

## 14. Frontend Stylesheet Ownership

**Decision**: Feature 004 uses the existing Tailwind CSS and shadcn/ui
conventions for design-system primitives and simple utility styling. When a
component needs custom selectors, responsive behavior, focus treatment, or
reduced-motion rules, it may add an optional CSS Module in the same directory
with the same basename as its TSX owner, for example
`cv-upload-form.tsx`/`cv-upload-form.module.css`. A route `page.tsx` may likewise
own an optional adjacent `page.module.css`. Only the matching TSX file imports
that module.

Feature 004 does not create a feature-level `styles/` directory, catch-all
stylesheets such as `cv-import.css` or `cv-review.css`, `:global` selectors, or
cross-component CSS Module imports. It also does not add Feature 004 selectors
or imports to `app/globals.css` or the inherited shared `base.css`,
`workspace.css`, `profile.css`, and `responsive.css` files. Components may
consume existing design tokens and custom properties without taking ownership
of those shared stylesheets. A CSS Module is optional; utility-only components
do not create empty companion files.

**Rationale**: The global bootstrap is small, but broad shared stylesheets have
accumulated unrelated component rules and become merge-conflict and maintenance
hotspots. Co-locating custom CSS makes ownership, deletion, review, and parallel
implementation explicit while preserving the existing design system.

**Alternatives rejected**: Centralized Feature 004 stylesheets were rejected
because unrelated components would share a high-conflict file. Extending global
or inherited shared stylesheets was rejected because it would widen their
responsibility. Requiring a CSS file for every TSX file was rejected because
empty modules add ceremony without improving ownership.

## Resolved Unknowns

Phase 0 leaves no unresolved research item. Provider availability is a
deployment gate with a defined internal/manual recovery path, not an unresolved
product choice. OCR, an admin dead-letter console, permanent CV storage,
recruiter access, rewriting, scoring, and cross-provider fallback remain
explicitly outside Feature 004.
