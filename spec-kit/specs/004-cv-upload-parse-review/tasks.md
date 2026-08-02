---
description: "Dependency-ordered implementation tasks for secure CV upload, parsing, review, and profile confirmation"
---

# Tasks: CV Upload, Parse, and Review

**Input**: Design documents from spec-kit/specs/004-cv-upload-parse-review/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, contracts/internal-contracts.md, contracts/cv-parser-output.schema.json, and quickstart.md

**Tests**: Required. The specification explicitly requires contract, authorization, malicious-file, scanner/storage, worker/retry, parser, concurrency, privacy, retention, component/accessibility, performance, and end-to-end verification. In every user-story phase, create the listed tests first and confirm that they fail for the intended missing behavior before implementing the story.

**Organization**: Tasks are grouped into shared setup/foundation work followed by one independently testable phase per user story. Every task includes an exact repository path.

## Format: [ID] [P?] [Story] Description

- **[P]**: Can run in parallel because it targets different files and has no unmet dependency on another task in the same parallel group.
- **[Story]**: Maps the task to US1, US2, US3, US4, or US5.
- Setup, foundational, and cross-cutting tasks intentionally have no story label.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the reviewed dependencies and infrastructure, expose fail-closed configuration, and make local web/worker/scanner startup reproducible.

- [x] T001 Pin @aws-sdk/client-s3 3.1101.0, pdfjs-dist 6.2.108, mammoth 1.12.0, yauzl 3.4.0, fast-xml-parser 5.10.1, openai 7.3.0, and @types/yauzl 3.4.0; add focused CV test scripts and refresh the sole lockfile in web/package.json, package.json, and package-lock.json
- [x] T002 Add documented local-safe and production-fail-closed CV storage, encryption-key-version, Unix-socket scanner path, parser, OpenAI approval, worker, exact 5,000,000-byte source limit, quota, and retention settings; reject scanner host/port/TCP configuration in .env.example, web/.env.example, scripts/setup-local.mjs, and scripts/check-environment.mjs
- [x] T003 [P] Add the private ClamAV service, persistent signature volume, dedicated `/run/clamav/clamd.sock` runtime volume, fixed shared numeric group with mode `0660`, stale-socket cleanup, 6 MiB daemon stream cap, health check, and 4 GiB resource ceiling; disable `TCPSocket`/`TCPAddr`, publish no scanner port, and resolve/pin the reviewed clamav/clamav:1.4_base image (expected engine 1.4.5) by immutable digest in compose.yaml, infra/clamav/clamd.conf, and infra/clamav/freshclam.conf
- [x] T004 Provision the absolute gitignored encrypted local artifact root web/.local/cv-storage without committing content, validate traversal/symlink-safe ownership, and document cleanup expectations in .gitignore, scripts/setup-local.mjs, and scripts/check-environment.mjs
- [x] T005 Add the containerized CV worker service/image and scanner-check command scaffolding with `postgres:5432`, `/app/.local/cv-storage`, shared socket group/volume, no scanner mount in web/email, and focused package scripts—without implementing worker runtime orchestration yet—in compose.yaml, web/Dockerfile.cv-worker, web/scripts/check-cv-scanner.mjs, web/scripts/run-cv-worker.mjs, web/package.json, and package.json
- [x] T006 Create deterministic two-account, controlled-clock, storage, scanner, extractor, parser, lease-crash, and audit-sink fixtures before any foundational test consumes them, without real personal data, in web/tests/helpers/cv-import-fixture.ts
- [x] T007 Write and run the blocking dependency/infrastructure compatibility gate after T001-T006 for exact npm versions/licenses, Node 24, server-only imports, parser JSON-Schema loading, the pinned ClamAV image, same-host/pod `0660` Unix socket with correct shared group and no TCP listener/published port, container-native database/storage paths, CV-worker image/probe startup, sole lockfile, npm audit, and container vulnerabilities; reject unreviewed high/critical findings and record commands/safe results in web/tests/backend/compatibility/cv-import/dependency-and-infrastructure.test.ts and spec-kit/specs/004-cv-upload-parse-review/checklists/dependency-infrastructure-gate.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, strict shared contracts, authorization, encryption, private storage, durable leasing, audit safety, and deterministic test controls required by every story.

**Critical**: No user-story implementation begins until this phase passes. Foundational tests T008-T015 are written first and must fail for the missing Feature 004 behavior.

### Foundational Tests

- [x] T008 [P] Write failing PostgreSQL tests for all Feature 004 tables, ownership FKs, enum/state checks, JSON byte caps, partial unique active jobs, quota counters, append-only rows, retention timestamps, immutable terminal attempts, the exact-binding/revocation-aware read-only external-consent lookup, and migration rollback in web/tests/backend/integration/cv-import/cv-import-database-constraints.test.ts
- [x] T009 [P] Write failing parity tests across OpenAPI, browser Zod schemas, internal state/error/action enums, and cv-draft-v1 JSON Schema, including strict unknown-property rejection and canonical JSON byte accounting in web/tests/backend/contract/cv-import/cv-contract-parity.test.ts
- [x] T010 [P] Write failing AES-256-GCM tests for random 12-byte IVs, 16-byte tags, versioned purpose-bound AAD, filename metadata separation, tamper rejection, streaming operation, and zero secret/plaintext logging in web/tests/backend/unit/cv-import/cv-artifact-encryption.test.ts
- [x] T011 [P] Write one failing adapter contract suite for encrypted filesystem and S3 private storage covering random locators, atomic finalize, no overwrite/public URL, traversal/symlink rejection, expected-length reads, idempotent deletion, inventory pagination, SSE-KMS, Block Public Access, and non-versioned policy in web/tests/backend/integration/cv-import/private-cv-storage.contract.test.ts
- [x] T012 [P] Write failing lease/repository tests for FOR UPDATE SKIP LOCKED claims, one active parse per account, bounded batches, duplicate delivery, lease loss, crash recovery, graceful shutdown, and database-authoritative retries in web/tests/backend/integration/cv-import/cv-work-leases.test.ts
- [x] T013 [P] Write failing two-account Foundation-level middleware test-harness tests for `CvAccountRequestBoundary` using mock Route Handler fixtures that represent upload reservation/content, parse/import status, draft review, and confirmation request shapes; apply the four inherited Feature 001 session cases—missing session with no cookie/session, an existing session beyond its idle or absolute TTL, a session revoked by logout or explicit revocation, and a session revoked by password reset—then also cover the valid ACTIVE Better Auth baseline, session-derived ownership, CSRF/origin/Fetch Metadata checks, body caps, forbidden owner/provider/storage fields, indistinguishable foreign/missing IDs, and no-store responses; this task verifies middleware logic only, MUST NOT import or invoke the real US1/US2 Route Handlers, keeps inactive-ACCOUNT coverage owned by T035 separate, and leaves real-handler wiring verification to T150 in web/tests/backend/integration/cv-import/cv-request-boundary.test.ts
- [x] T014 [P] Write failing privacy-canary tests proving CV bytes/text/values, filenames, email/phone/URLs, digests/HMACs, locators, key metadata, consent text, prompts/responses, tokens, sessions, and raw provider/scanner errors cannot enter logs, audit, metrics, traces, or exception serialization in web/tests/backend/unit/cv-import/cv-telemetry-redaction.test.ts
- [x] T015 [P] Write failing architecture tests enforcing route-to-service-to-gateway direction, parser purity, server-only provider imports, no Prisma/provider imports from routes or frontend, no browser persistence, no public file URL or original-CV retrieval/download route, no custom provider-endpoint override, no second session/JWT, and no internal HTTP from Server Components in web/tests/architecture/cv-import-boundaries.test.ts; also establish the Feature 004 stylesheet boundary harness for optional same-directory/same-basename CSS Modules, matching-owner-only imports, no `:global` or cross-component module imports, no feature-level `styles/` or catch-all stylesheet, and no Feature 004 selector/import leakage into global/shared stylesheets in web/tests/architecture/cv-import-style-boundaries.test.ts

### Foundational Implementation

- [x] T016 Add the ten Feature 004 models, enums, relations, mapped names, defaults, byte/count fields, revisions, retention fields, and UserAccount/CandidateProfile/AuditEvent extensions to web/prisma/schema.prisma
- [x] T017 Implement the reviewed forward-only migration with FKs, checks, JSON byte caps, HMAC/idempotency uniqueness, active-job partial uniques, lease indexes, quota invariants, append-only/terminal-state triggers, confirmation uniqueness, and safe rollback notes in web/prisma/migrations/008_cv_upload_parse_review/migration.sql
- [x] T018 Regenerate and review the Prisma client after T016-T017 without editing migrations 001-007 or duplicating Better Auth-owned fields, anchored at web/src/backend/generated/prisma/client.ts
- [x] T019 [P] Define browser-safe branded identifiers, state/action/error enums, strict idempotency/header schemas, byte constants, bounded response metadata, and generic API errors in web/src/shared/contracts/cv-import/common.ts
- [x] T020 [P] Implement the strict cv-draft-v1 Zod representation and canonical-size/evidence helpers with executable parity to spec-kit/specs/004-cv-upload-parse-review/contracts/cv-parser-output.schema.json in web/src/shared/contracts/cv-import/parser-output.ts
- [x] T021 [P] Parse all CV settings into immutable server-only configuration; reject production deterministic parsing, mutable/unapproved OpenAI models, custom/unallowlisted or non-HTTPS provider endpoints, missing privacy assertions, public/versioned S3, stale-key setup, unsafe storage roots, and invalid caps in web/src/backend/env/server.ts and web/src/backend/cv/config.ts
- [x] T022 Implement the CvAccountRequestBoundary over the existing Better Auth boundary with exact owner derivation, mutation proof enforcement, bounded JSON/raw-body helpers, forbidden-field rejection, and no-store response defaults in web/src/backend/security/cv-account-request-boundary.ts
- [x] T023 Implement exhaustive safe service/provider-to-HTTP mapping with uniform unknown/foreign 404s, owner-only content-free `CANCELLED`/`DELETED`/`EXPIRED` tombstones, field paths without rejected values, Retry-After where defined, and no raw exception serialization in web/src/backend/services/cv-import/cv-http-errors.ts
- [x] T024 Implement streaming artifact and display-filename AES-256-GCM cryptors with versioned purpose-bound AAD, key selection, authenticated failure mapping, and buffer zeroization in web/src/backend/cv/encryption/artifact-cryptor.ts and web/src/backend/cv/encryption/metadata-cryptor.ts
- [x] T025 Define the server-only PrivateCvStorage and SensitiveStorageLocator interfaces without any browser/download URL method in web/src/backend/cv/storage/private-cv-storage.ts
- [x] T026 [P] Implement the atomic encrypted filesystem adapter under its configured absolute root with random names, exclusive finalize, traversal/symlink checks, bounded streaming reads, inventory, and idempotent delete in web/src/backend/cv/storage/filesystem.ts
- [x] T027 [P] Implement the private S3 adapter with expected-size streaming, SSE-KMS, no ACL/public URL, private-bucket startup assertions, inventory, and idempotent delete in web/src/backend/cv/storage/s3.ts
- [x] T028 Implement the common Prisma mappings for owned upload/artifact/job state, transaction-scoped locks, non-disclosing lookup, and safe projections, plus the minimal read-only CvConsentReadGateway and exact-binding live external-consent lookup required by retry/dispatch gates, in web/src/backend/repositories/cv-import/prisma-cv-import-repository.ts, web/src/backend/repositories/cv-import/cv-consent-read-gateway.ts, and web/src/backend/repositories/cv-import/prisma-cv-consent-repository.ts
- [x] T029 Implement durable stage claim/finalize/lease-loss operations and bounded retry scheduling with PostgreSQL SKIP LOCKED semantics in web/src/backend/repositories/cv-import/prisma-cv-work-repository.ts
- [x] T030 Implement injected-clock CV worker lifecycle, readiness, bounded concurrency, abort/lease recovery, and cleanup-always-enabled behavior; wire the existing Compose worker/ClamAV services into fail-fast monitoring and cross-platform supervisor shutdown in web/src/backend/cv/workers/cv-worker-runtime.ts, web/src/backend/cv/workers/pipeline.ts, web/scripts/run-cv-worker.mjs, and scripts/run-local-development.mjs
- [x] T031 [P] Extend the audit allowlist and add allowlisted CV metric/log event builders that accept only safe state, stage, version, bucket, lag, and opaque-correlation fields in web/src/backend/audit/events.ts and web/src/backend/cv/telemetry.ts
- [x] T032 After T030, add and pass a container-boundary integration check proving the CV worker and `clamd` share a correctly owned mode-`0660` `/run/clamav/clamd.sock` on the same Compose host, scanner TCP is absent, host/container storage and database paths resolve correctly, web/email cannot access the socket, and readiness fails closed for stale/wrong-mode sockets or unavailable signatures in web/tests/backend/integration/cv-import/clamav-socket-boundary.test.ts
- [x] T033 Run schema generation/validation, migration, foundational contract, encryption/storage, lease, read-only consent-gateway, the Foundation-level request-boundary middleware harness from T013, redaction, and architecture tests after the passed T007 gate; this blocking Foundation checkpoint explicitly excludes the real-Route-Handler matrix T150, which can run only after T082, and records commands/results in spec-kit/specs/004-cv-upload-parse-review/checklists/foundation-results.md

**Checkpoint**: The private storage and durable state foundation is migratable, tenant-safe, recoverable, and ready for story work.

---

## Phase 3: User Story 1 - Upload a CV and Receive a Safe Draft (Priority: P1)

**Goal**: Let an authenticated candidate upload one valid PDF/DOCX through a bounded stream and receive a safe draft only after integrity, malware, structure, extraction, and parser validation; CandidateProfile remains unchanged.

**Independent Test**: Upload a clean PDF and a clean DOCX no larger than 5,000,000 bytes with the deterministic parser, observe authoritative progress, reach REVIEW_READY within the processing window, inspect a bounded draft, and prove the CandidateProfile revision/data did not change.

### Tests for User Story 1

- [x] T034 [P] [US1] Write failing OpenAPI/Zod contract tests for POST/GET /api/account/cv-imports, PUT content, and GET status, including 1..5,000,000-byte metadata, exact headers, parser enum, a versioned CV-processing privacy notice for every parser class, strict bodies, no owner/storage fields, safe actions/states, no-store headers, and idempotency conflicts in web/tests/backend/contract/cv-import/cv-upload.contract.test.ts
- [x] T035 [P] [US1] Write failing two-account authorization tests for upload/import/job/draft identifiers, inactive accounts, forged related IDs, equal cross-account SHA-256 values, indistinguishable foreign/nonexistent lookups, and owner-only content-free terminal tombstones in web/tests/backend/integration/cv-import/cv-upload-authorization.test.ts
- [x] T036 [P] [US1] Write failing admission/quota tests for five rolling-hour attempts, ten retained imports, 50 MiB source-plus-extraction reservation, concurrent reservations, exact HMAC-bound replay, quota settlement/release, and no cross-import digest reuse in web/tests/backend/integration/cv-import/cv-upload-admission.test.ts
- [x] T037 [P] [US1] Write failing streaming receiver tests for exact Content-Length, short/extra/disconnected streams, the exact 5,000,000-byte ceiling and 5,000,001-byte rejection, declared MIME mismatch, incremental SHA-256, encryption-before-storage, disposable replay objects, integrity mismatch, DB-finalization failure cleanup, `VALIDATION_QUEUED` handoff, and no whole-file buffering in web/tests/backend/integration/cv-import/cv-content-receiver.test.ts
- [x] T038 [P] [US1] Write failing ClamAV adapter/integration tests for exactly one isolated scan assessment covering Unix-socket-only INSTREAM framing, absence/rejection of TCP configuration, EICAR detection, clean files, 20-second timeout, unavailable socket, signature age over 24 hours, raw-response containment, 6 MiB daemon cap, readiness, and parser denial before CLEAN; do not assert automatic or candidate retry orchestration in web/tests/backend/integration/cv-import/clamav-scanner.test.ts
- [x] T039 [P] [US1] Create synthetic clean/malicious fixtures and write failing extraction tests proving no PDF object/ZIP/XML parser executes before persisted CLEAN, then covering post-clean PDF/DOCX magic and structure, polyglots, encrypted/active/embedded/image-only PDFs, 20-page cap, malformed ZIP, traversal, duplicate paths, zip bombs, 1,000-entry/25 MiB caps, macros/OLE/ActiveX/external relationships, empty text, 512 KiB output cap, and 15-second/192 MiB isolation in web/tests/fixtures/cv/README.md, web/tests/fixtures/cv/clean/, web/tests/fixtures/cv/malicious/, and web/tests/backend/integration/cv-import/document-extraction.test.ts
- [x] T040 [P] [US1] Write failing parser/draft-factory tests for deterministic fixture output, prompt-injection text treated only as data, strict whole-output validation, unknown fields, collection/value caps, invalid segment citations, canonical 256 KiB draft/128 KiB provenance caps, server proposal IDs, no live-profile copy, and no Profile mutation in web/tests/backend/unit/cv-import/cv-parser-and-draft-factory.test.ts and web/tests/fixtures/cv/parser/
- [x] T041 [P] [US1] Write failing worker integration tests for bounded envelope/leading-magic checks -> scan -> post-CLEAN structure/extract -> parse ordering, integrity verification before each provider, duplicate delivery, lease expiry, one active parse per account, terminal invalid output, queue latency metadata, and no draft before all gates pass in web/tests/backend/integration/cv-import/cv-happy-path-pipeline.test.ts
- [x] T042 [P] [US1] Write failing component/accessibility tests for a visible versioned processing notice on every parser choice, a presentation-only separate external-consent control that is unselected by default and keeps external processing blocked without exercising grant/revoke lifecycle, keyboard file selection, exact type/size validation, explicit parser choice, upload progress, persistent text status/actions, polling cleanup, focus/error summary, reduced motion, no browser persistence, and 320px layout in web/tests/frontend/components/cv-import/cv-upload-and-status.test.tsx and web/tests/frontend/accessibility/cv-import/cv-upload.accessibility.test.tsx
- [x] T043 [US1] Write the failing serial Playwright journeys for clean PDF and DOCX upload through REVIEW_READY, reload/resume from server state, Profile non-mutation, unsupported/image-only replacement guidance, and cross-account denial in web/tests/system/e2e/cv-import/upload-to-draft.spec.ts

### Implementation for User Story 1

- [x] T044 [P] [US1] Implement strict upload reservation, content headers, import list/status, general versioned processing-notice projection for every parser, progress, safe action, and draft-ready response schemas in web/src/shared/contracts/cv-import/upload.ts
- [x] T045 [P] [US1] Implement row-locked rolling-rate/import-count/storage reservation, idempotency HMAC binding, source/extraction settlement, and once-only quota release in web/src/backend/repositories/cv-import/prisma-cv-quota-repository.ts
- [x] T046 [US1] Implement owned reservation creation with encrypted display filename, strict extension/media/size/parser admission, server-selected versioned processing-notice projection, random quarantine identity, expiry, audit intent, and upload URL/header projection in web/src/backend/services/cv-import/create-cv-import.ts
- [x] T047 [US1] Implement bounded raw streaming, exact-length enforcement, incremental digest, encrypt-and-store, disposable idempotency replay comparison, atomic artifact finalization, failure cleanup scheduling, durable scan-work creation, and `VALIDATION_QUEUED` handoff without opening PDF/ZIP/XML structures in web/src/backend/services/cv-import/receive-cv-content.ts
- [x] T048 [US1] Implement protected POST reservation and paginated safe GET import-list handling with strict parsing and no-store responses in web/src/app/api/account/cv-imports/route.ts
- [x] T049 [US1] Implement protected raw-body PUT content handling without multipart buffering, owner fields, filename headers, or request-body logging in web/src/app/api/account/cv-imports/[uploadId]/content/route.ts
- [x] T050 [US1] Implement owned GET status/receipt projection with authoritative state, stage timestamps, retry/consent/review actions, bounded polling hints, and no sensitive/internal provider data in web/src/app/api/account/cv-imports/[uploadId]/route.ts
- [x] T051 [P] [US1] Define the MalwareScanner contract and implement same-host/pod ClamAV INSTREAM/readiness over `CV_CLAMD_SOCKET_PATH` with bounded frames, no TCP fallback, hard timeout, signature-freshness fail-closed policy, and safe error mapping in web/src/backend/cv/scanning/malware-scanner.ts and web/src/backend/cv/scanning/clamav.ts
- [x] T052 [US1] Implement integrity-verified decryption reads that withhold stage completion until AES authentication, exact plaintext byte count, and SHA-256 all match, then terminally deny and schedule deletion on mismatch in web/src/backend/cv/encryption/integrity-verified-reader.ts
- [x] T053 [P] [US1] Define the DocumentExtractor contract and implement the parent/child isolation runner with bounded IPC, 15-second hard deadline, 192 MiB child heap, abort handling, whole-process-tree termination, and partial-output discard in web/src/backend/cv/extraction/document-extractor.ts, web/src/backend/cv/extraction/runner.ts, and web/src/backend/cv/extraction/child-entry.ts
- [x] T054 [P] [US1] Implement PDF.js header/catalog/page/text extraction with 1..20 pages and rejection of encryption, attachments, JavaScript/actions, launch, embedded content, malformed objects, empty/image-only text, and output overflow in web/src/backend/cv/extraction/pdf.ts
- [x] T055 [P] [US1] Implement lazy yauzl/fast-xml-parser DOCX OPC validation plus Mammoth raw-text extraction with normalized unique paths, entity/external access disabled, 1,000-entry/25 MiB caps, accepted compression only, and macro/OLE/ActiveX/external relationship rejection in web/src/backend/cv/extraction/docx.ts
- [x] T056 [US1] Implement encrypted tagged-segment writing and job-authorized streaming reads with segment-ID membership, 512 KiB enforcement, quota settlement, and no general repository/browser access in web/src/backend/cv/extraction/extracted-segment-store.ts
- [x] T057 [P] [US1] Define the side-effect-free CvParser interface and implement the network-free, fixture-versioned deterministic adapter that is allowed only outside production in web/src/backend/cv/parsing/cv-parser.ts and web/src/backend/cv/parsing/deterministic.ts
- [x] T058 [US1] Implement all-or-nothing parser output validation, Feature 002 normalization/sanitization reuse, exact evidence membership, duplicate hints, server proposal/context IDs, byte caps, draftRevision 0, and no CandidateProfile writes in web/src/backend/services/cv-import/create-cv-draft.ts
- [x] T059 [US1] Implement the scan-stage processor so claimed `VALIDATION_QUEUED` work first performs bounded length/extension/declaration/leading-magic checks, terminally rejects envelope mismatch without contacting `clamd`, then transitions valid work through `SCAN_QUEUED`/`SCANNING` with integrity reader, Unix-socket readiness/freshness gate, immutable assessment, CLEAN-only continuation, retention scheduling, safe audit/metrics, and idempotent lease finalization in web/src/backend/cv/workers/scan-stage.ts
- [x] T060 [US1] Implement the extraction stage processor with isolated structural validation, encrypted segment persistence, source/extraction metadata, quota settlement, safe terminal outcomes, and no partial continuation in web/src/backend/cv/workers/extraction-stage.ts
- [x] T061 [US1] Implement the deterministic parse stage with per-account claim control, exact extracted-artifact authorization, 60-second service deadline, strict draft creation, immutable attempt evidence, and REVIEW_READY transition in web/src/backend/cv/workers/parse-stage.ts
- [x] T062 [US1] Register the pre-scan-validation/scan, extract, and parse processors with bounded polling/backoff, readiness dependencies, and graceful shutdown in web/src/backend/cv/workers/pipeline.ts and web/src/backend/cv/workers/cv-worker-runtime.ts
- [x] T063 [P] [US1] Implement browser clients/hooks for reservation, raw PUT progress/abort, status polling, safe retry delays, reload reconciliation, and in-memory-only file/form state in web/src/frontend/features/cv-import/client/use-cv-import.ts
- [x] T064 [P] [US1] Implement the general versioned CV-processing privacy notice for every parser class, labelled upload/parser controls, and a presentation-only external-consent control that is unselected by default and keeps external processing/dispatch blocked while deferring grant/revoke side effects to US5; also implement exact 5 MB guidance, quota/list/empty states, non-color progress timeline, persistent errors/actions, Profile manual-entry fallback, and 320px-safe/focus/contrast/reduced-motion presentation in web/src/frontend/features/cv-import/components/cv-processing-notice.tsx, web/src/frontend/features/cv-import/components/cv-upload-form.tsx, web/src/frontend/features/cv-import/components/cv-import-list.tsx, and web/src/frontend/features/cv-import/components/cv-import-status.tsx, with each component owning any required custom CSS only in its adjacent same-basename `cv-processing-notice.module.css`, `cv-upload-form.module.css`, `cv-import-list.module.css`, or `cv-import-status.module.css`
- [x] T065 [US1] Add protected direct-service import list/status pages, expose navigation only when pages exist, and preserve no-store behavior in web/src/app/(workspace)/profile/cv-imports/page.tsx, web/src/app/(workspace)/profile/cv-imports/[uploadId]/page.tsx, and web/src/frontend/features/profile/components/profile-navigation.tsx
- [x] T066 [US1] After T064, complete and run the US1 stylesheet-boundary matrix proving every upload/list/status CSS Module is optional, adjacent to and basename-matched with its TSX owner, imported only by that owner, and that US1 adds no `styles/` directory, catch-all stylesheet, `:global` selector, cross-component module import, or Feature 004 selector/import in global/shared stylesheets in web/tests/architecture/cv-import-style-boundaries.test.ts
- [x] T067 [US1] Run all US1 contract, unit, PostgreSQL, storage/scanner/extraction, worker, component/accessibility, and Playwright tests; measure the upload-validation and processing targets and record the independent result in spec-kit/specs/004-cv-upload-parse-review/checklists/us1-upload-safe-draft-results.md

**Checkpoint**: US1 independently produces a private, review-ready draft and cannot mutate CandidateProfile.

---

## Phase 4: User Story 2 - Review, Edit, and Confirm Selected Profile Changes (Priority: P1)

**Goal**: Let the candidate compare a bounded draft with the live Profile, edit proposals, explicitly choose changes, and atomically confirm only saved choices as exactly one Profile revision.

**Independent Test**: Seed a REVIEW_READY draft, edit proposals and choices, reload the saved review, confirm it, verify only selected changes were applied in one transaction/revision, observe a non-content receipt, and verify source content is scheduled for seven-day deletion.

### Tests for User Story 2

- [x] T068 [P] [US2] Write failing OpenAPI/Zod contract tests for GET/PATCH draft and POST confirm, including complete bounded payloads, exact draft/profile revisions, strict decision manifests, explicit missing-provenance/context availability, idempotency binding, safe receipts/conflicts, no raw text, and no-store headers in web/tests/backend/contract/cv-import/cv-draft-review.contract.test.ts
- [x] T069 [P] [US2] Write failing authorization/comparison tests for owned review-ready drafts, live Profile loading at read time, no live-profile copy in payload, bounded verified evidence, explicit empty/missing provenance without fabricated context, foreign/expired/deleted behavior, and target-child ownership in web/tests/backend/integration/cv-import/cv-draft-comparison.test.ts
- [x] T070 [P] [US2] Write failing draft-save tests for whole-payload normalization/validation, 256 KiB draft and 128 KiB provenance caps, Profile-aware add/replace/skip scalar decisions, exact `ACTION_MISMATCH` field paths, complete compare-and-swap, revision increment, rollback, and stale save rejection in web/tests/backend/integration/cv-import/cv-draft-save.test.ts
- [x] T071 [P] [US2] Write failing confirmation tests for exact revisions, saved choices only, row locks, one Profile revision, one receipt/audit event, seven-day purge scheduling, duplicate replay, rebound key conflict, and full rollback after every failure injection point in web/tests/backend/integration/cv-import/cv-draft-confirmation.test.ts
- [x] T072 [P] [US2] Write failing confirmation concurrency tests for save-vs-confirm, confirm-vs-direct-Profile-save, duplicate confirms, deleted/expired source, changed target child, and exactly one non-mutating winner/one-revision outcome in web/tests/backend/integration/cv-import/cv-confirmation-concurrency.test.ts
- [x] T073 [P] [US2] Write failing component/accessibility tests for side-by-side comparison, proposal editing, select-all-independent controls, current-Profile-aware add/replace/skip choices, verified evidence and explicit “provenance unavailable” states, local validation without PATCH, server `fieldErrors`, brief error toast plus persistent summary, exact invalid-field text/border/ARIA/focus behavior, edit preservation, explicit save/confirm, receipt, keyboard announcements, reduced motion, and 320px layout in web/tests/frontend/components/cv-import/cv-draft-review.test.tsx and web/tests/frontend/accessibility/cv-import/cv-draft-review.accessibility.test.tsx
- [x] T074 [US2] Write the failing serial Playwright journey from a seeded REVIEW_READY draft through edit/save/reload/selective confirm, exact Profile result/revision, receipt replay, content purge schedule, and cross-account denial in web/tests/system/e2e/cv-import/review-and-confirm.spec.ts

### Implementation for User Story 2

- [x] T075 [P] [US2] Implement strict comparison view, editable proposals, review decisions, draft save, conflict metadata, confirm command, and non-content receipt schemas in web/src/shared/contracts/cv-import/review.ts
- [x] T076 [P] [US2] Implement owned draft/current-Profile comparison queries with sanitized bounded evidence and only target Profile child IDs needed for replace choices in web/src/backend/repositories/cv-import/prisma-cv-draft-query-repository.ts
- [x] T077 [US2] Implement transaction-bound complete draft payload compare-and-swap, reviewed Profile revision checks, authoritative scalar action semantics with exact `reviewDecisions.scalars.{index}.action` errors, canonical byte caps, immutable parser provenance separation, and no partial saves in web/src/backend/repositories/cv-import/prisma-cv-draft-command-repository.ts
- [x] T078 [US2] Implement comparison retrieval and save orchestration with Feature 002 validation, full-payload normalization, field-addressable validation details, duplicate normalized proposed skill/social-link rejection, safe Profile duplicate hints, current Profile comparison, and conflict metadata in web/src/backend/services/cv-import/cv-draft-comparison-service.ts
- [x] T079 [US2] Implement the atomic confirmation transaction with row locks/revalidation, saved-manifest binding, owned target checks, selected scalar/collection application, one Profile revision, frozen upload/draft, receipt/audit creation, and deletion scheduling in web/src/backend/repositories/cv-import/prisma-cv-confirmation-repository.ts
- [x] T080 [US2] Implement owned confirmation orchestration, exact idempotency binding, safe conflict mapping, post-commit receipt projection, and no alternate parser-to-Profile write path in web/src/backend/services/cv-import/confirm-cv-draft.ts
- [x] T081 [US2] Implement protected GET/PATCH draft handling with bounded complete bodies, revision preconditions, no-store responses, and safe conflict details in web/src/app/api/account/cv-drafts/[draftId]/route.ts
- [x] T082 [US2] Implement protected idempotent confirm handling with exact revision fields, mutation proof, no sensitive echo, and receipt replay in web/src/app/api/account/cv-drafts/[draftId]/confirm/route.ts
- [x] T083 [US2] Implement review query/save/confirm client state with in-memory edits, stable proposal keys, complete server `fieldErrors`, per-field error clearing on correction, idempotency reuse, duplicate-submit prevention, server revision reconciliation, and unload warning in web/src/frontend/features/cv-import/client/use-cv-draft-review.ts
- [x] T084 [P] [US2] Implement accessible current-versus-proposed scalar comparison with `ADD`/`SKIP` only for empty Profile fields and `REPLACE`/`SKIP` only for populated fields, exact value/decision error mapping, and bounded verified-evidence display including an explicit non-misleading unavailable state for missing locations/confidence/context, without raw extracted text in web/src/frontend/features/cv-import/components/cv-scalar-review.tsx and web/src/frontend/features/cv-import/components/cv-evidence.tsx; each component owns its custom presentation only in the adjacent same-basename cv-scalar-review.module.css or cv-evidence.module.css
- [x] T085 [P] [US2] Implement editable experience, education, skill, and social-link proposal lists with explicit add/replace/skip choices, target selection, caps, stable ordering, no implicit selection, exact field-level validation messages for entries and duplicates, and custom presentation owned only by the adjacent same-basename web/src/frontend/features/cv-import/components/cv-collection-review.module.css for web/src/frontend/features/cv-import/components/cv-collection-review.tsx
- [x] T086 [US2] Compose complete local review validation before PATCH, canonical field-path mapping, decision summary, explicit Save Review and Confirm actions, destructive-impact confirmation, first-invalid-control focus, text/border/ARIA feedback, edit preservation, and custom presentation owned only by the adjacent same-basename web/src/frontend/features/cv-import/components/cv-draft-review.module.css for web/src/frontend/features/cv-import/components/cv-draft-review.tsx
- [x] T087 [P] [US2] Implement persistent saved/conflict/confirm/error feedback, a bounded Sonner error toast that supplements persistent field/error summaries, and the non-content confirmation receipt with applied counts and Profile destination in web/src/frontend/features/cv-import/components/cv-review-feedback.tsx and web/src/frontend/features/cv-import/components/cv-confirmation-receipt.tsx, with custom presentation owned only by their adjacent same-basename cv-review-feedback.module.css and cv-confirmation-receipt.module.css
- [x] T088 [US2] Add the protected direct-service review page and integrate REVIEW_READY/CONFIRMED links and receipt state into the import status page in web/src/app/(workspace)/profile/cv-imports/[uploadId]/review/page.tsx and web/src/app/(workspace)/profile/cv-imports/[uploadId]/page.tsx
- [x] T089 [US2] After T084-T087, extend and run the stylesheet-boundary matrix for all US2 review components, proving their 320px/focus/contrast/error/reduced-motion CSS remains in optional adjacent same-basename modules imported only by their owners and introduces no review catch-all, `:global`, cross-component module import, or global/shared stylesheet leakage in web/tests/architecture/cv-import-style-boundaries.test.ts
- [x] T090 [US2] Run all US2 contract, PostgreSQL, rollback/concurrency, component/accessibility, and Playwright tests; measure review-load/save/confirm targets and record the independent result in spec-kit/specs/004-cv-upload-parse-review/checklists/us2-review-confirm-results.md

**Technical checkpoint (non-release)**: Setup + Foundation + US1 + US2 demonstrate the safe upload, human-review, and transactional-confirmation vertical slice. This checkpoint is not a releasable P0; release still requires US3-US5 and every Phase 8 quality gate.

---

## Phase 5: User Story 3 - Recover From Scan, Extraction, or Parser Failure (Priority: P2)

**Goal**: Give the candidate stable terminal outcomes, bounded candidate-owned retries where safe, replacement/manual-entry/delete actions, and no indefinite hidden dead-letter wait.

**Independent Test**: Force scanner unavailability/stale definitions, infected content, extraction rejection/timeout, parser timeout/unavailable/invalid output, and retry exhaustion; each case reaches a safe state with only the allowed retry, replace, manual Profile, or delete action.

### Tests for User Story 3

- [x] T091 [P] [US3] Write failing contract tests for POST retry, exact idempotency, retry counters, AWAITING_CONSENT behavior, state conflicts, retry exhaustion, safe Retry-After metadata, and absence of admin/DLQ/provider details in web/tests/backend/contract/cv-import/cv-import-retry.contract.test.ts
- [x] T092 [P] [US3] Write failing failure-state integration tests for infected, scanner unavailable/stale, integrity failure, encrypted/active/oversize/empty documents, extraction crash/timeout, parser timeout/unavailable/invalid/oversize output, and cleanup after every partial stage in web/tests/backend/integration/cv-import/cv-failure-outcomes.test.ts
- [x] T093 [P] [US3] Write failing controlled-clock retry tests for one initial attempt plus at most two automatic retries per scan/parse cycle (three automatic attempts total), the complete automatic scan cycle ending within five minutes of the initial assessment start, fixed bounded backoff, at most two candidate single-attempt scan retries and two candidate single-attempt parse retries, no automatic-cycle restart after candidate retry, exact live external-consent gating through the Foundation CvConsentReadGateway, immutable attempt history, exact prior/new attempt binding, duplicate retry replay, rebound conflict, expired/deleted artifact denial, lease crash recovery, and terminal cap exhaustion in web/tests/backend/integration/cv-import/cv-retry-policy.test.ts
- [x] T094 [P] [US3] Write failing component/accessibility tests for stable failure explanations, retry countdown/counter, duplicate-submit prevention, replace CV, manual Profile entry, delete, focus/announcement behavior, and no suggestion of administrator intervention in web/tests/frontend/components/cv-import/cv-failure-recovery.test.tsx and web/tests/frontend/accessibility/cv-import/cv-failure-recovery.accessibility.test.tsx
- [x] T095 [US3] Write failing serial Playwright journeys for infected rejection, scanner failure/retry, structural failure/replacement, parser timeout/retry, invalid output/manual entry, retry exhaustion, refresh persistence, and absence of a permanently processing state in web/tests/system/e2e/cv-import/failure-recovery.spec.ts

### Implementation for User Story 3

- [x] T096 [P] [US3] Implement strict retry request/outcome schemas, remaining-count projection, and safe retryable-terminal action mapping in web/src/shared/contracts/cv-import/retry.ts
- [x] T097 [US3] Implement row-locked immutable retry creation with endpoint-key HMAC binding, exact prior/new attempt links, separate scan/parse caps, artifact/expiry checks, and idempotent replay in web/src/backend/repositories/cv-import/prisma-cv-retry-repository.ts
- [x] T098 [US3] Implement candidate-owned retry authorization and policy using the read-only Foundation CvConsentReadGateway from T028 for the live exact external-consent precondition, with no dependency on US5 consent mutations; also enforce no extraction retry for unsafe structure, terminal cap behavior, and safe audit/metrics in web/src/backend/services/cv-import/retry-cv-import.ts
- [x] T099 [US3] Implement the protected idempotent retry POST handler with strict empty/metadata body rules, no-store responses, safe conflict mapping, and Retry-After where applicable in web/src/app/api/account/cv-imports/[uploadId]/retries/route.ts
- [x] T100 [US3] Complete scan/parse cycles with one initial attempt plus at most two automatic retries (three automatic attempts total), enforce the five-minute maximum automatic scan-cycle window from the initial assessment start, schedule single-attempt candidate retries without nested automatic cycles, and implement fixed bounded backoff, provider hard deadlines, retryable-versus-terminal classification, lease-expiry recovery, and stable no-hidden-DLQ outcomes in web/src/backend/cv/workers/pipeline.ts, web/src/backend/cv/workers/scan-stage.ts, and web/src/backend/cv/workers/parse-stage.ts
- [x] T101 [US3] Implement persistent failure/retry/replacement/manual-entry/delete actions with safe guidance and countdowns in web/src/frontend/features/cv-import/components/cv-failure-recovery.tsx, own its custom presentation in the adjacent same-basename web/src/frontend/features/cv-import/components/cv-failure-recovery.module.css, and integrate it into web/src/frontend/features/cv-import/components/cv-import-status.tsx while keeping any status-specific style change in cv-import-status.module.css
- [x] T102 [US3] Run all US3 contract, controlled-clock, scanner/extractor/parser failure, lease, component/accessibility, and Playwright tests and record the independent result in spec-kit/specs/004-cv-upload-parse-review/checklists/us3-failure-recovery-results.md

**Checkpoint**: Every failed import terminates in a candidate-understandable, candidate-actionable state; an administrator retry UI and direct DB edits remain out of scope.

---

## Phase 6: User Story 4 - Edit Safely Across Tabs and Devices (Priority: P2)

**Goal**: Reject stale draft/profile writes, preserve unsaved browser values in memory, and require explicit compare/reload decisions without silently overwriting either session.

**Independent Test**: Open one draft in two authenticated sessions at the same revision, save different changes, confirm the first wins and the second receives a conflict while retaining its unsaved values; then change Profile elsewhere and verify save/confirm is non-mutating until re-reviewed.

### Tests for User Story 4

- [x] T103 [P] [US4] Write failing two-session draft concurrency tests for simultaneous PATCH, exact baseDraftRevision CAS, winner-only increment, stale latest metadata, no partial merge, and save-vs-confirm ordering in web/tests/backend/integration/cv-import/cv-draft-multi-session-concurrency.test.ts
- [x] T104 [P] [US4] Write failing Profile conflict tests for direct Profile edits during review, reviewed/current/source revision mismatch, changed/deleted replacement targets, stale confirmation replay, full rollback, and one-revision invariant in web/tests/backend/integration/cv-import/cv-profile-review-conflicts.test.ts
- [x] T105 [P] [US4] Write failing component tests proving stale-save/stale-Profile conflict summaries retain every unsaved edit in memory, expose explicit compare/reload/discard choices, never write local/session storage, and restore focus correctly in web/tests/frontend/components/cv-import/cv-review-conflicts.test.tsx
- [x] T106 [US4] Write the failing multi-context Playwright journey for two tabs/devices, first-save winner, second-save preserved edits, explicit reload/reapply, direct Profile conflict, and successful confirmation only after re-review in web/tests/system/e2e/cv-import/multi-device-review.spec.ts

### Implementation for User Story 4

- [x] T107 [US4] Harden complete-payload draft CAS and conflict projections so stale writers never mutate data and receive only safe latest revision/timestamp metadata in web/src/backend/repositories/cv-import/prisma-cv-draft-command-repository.ts
- [x] T108 [US4] Revalidate current/reviewed Profile revision and replacement-target ownership on every read/save, returning explicit non-mutating PROFILE_REVISION_CONFLICT metadata in web/src/backend/services/cv-import/cv-draft-comparison-service.ts
- [x] T109 [US4] Harden confirmation against save/direct-Profile/delete races with deterministic lock ordering, exact manifest/revision rebinding, and idempotent winner replay in web/src/backend/repositories/cv-import/prisma-cv-confirmation-repository.ts
- [x] T110 [US4] Preserve dirty review state in React memory on 409 responses and implement explicit compare-latest, reload/discard, and reapply workflows without browser persistence in web/src/frontend/features/cv-import/client/use-cv-draft-review.ts
- [x] T111 [US4] Implement accessible draft/Profile conflict panels with latest safe metadata, unsaved-value preview, explicit user-controlled resolution, focus restoration, ARIA-live status, and custom presentation owned only by the adjacent same-basename web/src/frontend/features/cv-import/components/cv-review-conflict.module.css for web/src/frontend/features/cv-import/components/cv-review-conflict.tsx
- [x] T112 [US4] Integrate conflict resolution into the review page without automatic overwrite, confirmation retry, or navigation loss in web/src/frontend/features/cv-import/components/cv-draft-review.tsx and web/src/app/(workspace)/profile/cv-imports/[uploadId]/review/page.tsx; keep component-specific style changes in cv-draft-review.module.css and add an adjacent review/page.module.css only if the route itself requires custom layout
- [x] T113 [US4] Run all US4 concurrency, rollback, component, and multi-context Playwright tests and record the independent result in spec-kit/specs/004-cv-upload-parse-review/checklists/us4-multi-device-results.md

**Checkpoint**: Draft and Profile concurrency are explicit, lossless for unsaved browser edits, and fully server-authoritative.

---

## Phase 7: User Story 5 - Control External Processing and Data Retention (Priority: P3)

**Goal**: Require exact versioned consent and deployment approval before every external dispatch, support revocation for future work, and enforce candidate deletion plus 24-hour/30-day/7-day retention with reconciliation.

**Independent Test**: Block external parse before consent, grant the exact unselected disclosure and parse, revoke before a retry, delete the import, advance a fake clock through every retention deadline, and verify immediate logical denial, eventual physical/payload deletion, quota release, lifecycle safeguards, and safe retained non-content evidence.

### Tests for User Story 5

- [x] T114 [P] [US5] Write failing OpenAPI/Zod contract tests for POST/DELETE consent and DELETE import, including server-issued challenge, accepted=true, exact safe notice projection, empty revoke/delete bodies, idempotent `202` deletion outcome with immediate `CANCELLED`, bounded owner-only content-free tombstone polling, `DELETED` only after cleanup, no browser-selected provider/version fields, no-store responses, and generic foreign/missing ownership errors in web/tests/backend/contract/cv-import/cv-consent-and-deletion.contract.test.ts
- [x] T115 [P] [US5] Write failing append-only consent tests for exact upload/account/provider/model/purpose/notice/text binding, grant/revoke chronology, challenge replay/tamper, changed binding requiring a new grant, dispatch-time live recheck, retry gating, expiry/deletion denial, and safe audit evidence in web/tests/backend/integration/cv-import/cv-processing-consent.test.ts
- [x] T116 [P] [US5] Write failing OpenAI adapter compatibility tests for SDK 7.3.0, exact approved snapshot, strict Structured Outputs, store=false, no tools/files/conversation/background mode, reasoning effort none, SDK retries zero, safety HMAC, 50/60-second deadlines, invalid output, prompt injection, sanitized errors, and zero persistence/logging in web/tests/backend/compatibility/cv-import/openai-parser.test.ts
- [x] T117 [P] [US5] Write failing dispatch-gate tests for disabled external parsing, missing API key, deterministic parser in production, missing DPA/privacy/cross-border/ZDR assertions, grant revoked between claim and send, provider/model changes, no fallback provider, and consent ID on every transmitted attempt in web/tests/backend/integration/cv-import/cv-external-dispatch-gate.test.ts
- [x] T118 [P] [US5] Write failing fake-clock retention tests for 24-hour incomplete/rejected/infected, 30-day unconfirmed, seven-day post-confirm deadlines, and candidate deletion that becomes `CANCELLED`/inaccessible immediately, cancels queued work, physically deletes and scrubs all source/extracted/draft/provenance content within 24 hours, then becomes `DELETED`; also cover idempotency and retained minimized receipt/consent/attempt metadata in web/tests/backend/integration/cv-import/cv-retention.test.ts
- [x] T119 [P] [US5] Write failing deletion/reconciliation tests for candidate delete races with active workers, late-result discard, `CANCELLED` to `DELETED` ordering, 24-hour purge deadline, absent-object retries, once-only quota release, missing referenced objects, orphan inventory grace windows, bounded leases, cleanup lag metrics, and cleanup continuing when uploads/parser are disabled in web/tests/backend/integration/cv-import/cv-deletion-reconciliation.test.ts
- [x] T120 [P] [US5] Write failing S3 deployment-policy checks for private non-versioned bucket, Block Public Access, SSE-KMS, 31-day lifecycle safeguard, one-day multipart abort, no source/extracted version retention, and rejection of unsafe configuration in web/tests/backend/integration/cv-import/s3-retention-policy.test.ts
- [x] T121 [P] [US5] Write failing end-to-end privacy canary coverage across external adapter, worker, route, audit, logger, metric, trace, snapshots, and browser storage using synthetic PII/secrets in web/tests/backend/integration/cv-import/cv-privacy-canary.test.ts and web/tests/frontend/components/cv-import/cv-browser-data-boundary.test.tsx
- [x] T122 [P] [US5] Write failing component/accessibility tests for unselected versioned consent, purpose/provider explanation, grant/revoke effects, past-processing caveat, retention deadlines, destructive delete confirmation, persistent outcomes, keyboard/focus, and 320px layout in web/tests/frontend/components/cv-import/cv-consent-retention.test.tsx and web/tests/frontend/accessibility/cv-import/cv-consent-retention.accessibility.test.tsx
- [x] T123 [US5] Write failing serial Playwright journeys for the general processing notice on internal/external choices, pre-consent external blocking, grant and external parse, revocation-before-retry, changed-binding re-consent, candidate deletion during processing with immediate `CANCELLED`, refresh with content denied but safe owner tombstone visible, fake-clock cleanup to `DELETED` within 24 hours, and manual Profile availability; add a separate natural clock-expiry case that advances an unconfirmed import to `expiresAt` without issuing candidate DELETE and verifies `EXPIRED`, immediate content/retry/confirm denial, the safe owner tombstone, and eventual deadline-driven cleanup in web/tests/system/e2e/cv-import/consent-retention.spec.ts

### Implementation for User Story 5

- [x] T124 [P] [US5] Implement strict external-consent notice/challenge/grant/outcome, `CANCELLED`/`DELETED` deletion lifecycle outcome, 24-hour candidate purge deadline, retention projection, and external binding schemas without browser-controlled provider/model/purpose/version fields in web/src/shared/contracts/cv-import/consent-retention.ts
- [x] T125 [P] [US5] Extend the read-only Foundation consent repository created by T028 with append-only exact-binding grant/revoke operations, challenge HMAC validation, chronology, upload ownership/state checks, reuse of the existing live-grant lookup, and safe consent projections in web/src/backend/repositories/cv-import/prisma-cv-consent-repository.ts
- [x] T126 [US5] Implement consent notice generation and grant/revoke orchestration with reviewed server configuration, unselected explicit acceptance, audit evidence, parse queue transition, and past-processing caveat in web/src/backend/services/cv-import/cv-consent-service.ts
- [x] T127 [US5] Implement protected POST grant and DELETE revoke handlers with mutation proof, strict bodies, no-store responses, and no provider/version override in web/src/app/api/account/cv-imports/[uploadId]/consent/route.ts
- [x] T128 [P] [US5] Implement the OpenAI CvParser adapter with exact Responses API settings, strict schema, safety identifier, bounded input/output, SDK retry zero, adapter deadline/abort, output-only return, and sanitized errors in web/src/backend/cv/parsing/openai.ts
- [x] T129 [US5] Add production parser selection and re-check the deployment gate plus exact live consent after claim and immediately before every external transmission; persist only minimal dispatch evidence and never auto-fallback in web/src/backend/cv/workers/parse-stage.ts
- [x] T130 [P] [US5] Implement distinct candidate-delete and clock-expiry orchestration: deletion transactionally sets active imports to `CANCELLED`, denies access, cancels work, and schedules every artifact/DB payload within 24 hours, while clock expiry sets `EXPIRED` and applies its existing deadline; both paths record idempotent non-content audit outcomes in web/src/backend/services/cv-import/cv-retention-service.ts
- [x] T131 [US5] Extend the owned import handler with protected idempotent DELETE returning the safe `202` cancellation/deletion outcome; preserve uniform missing/foreign behavior while allowing only the owner to poll bounded content-free `CANCELLED`/`DELETED` tombstones in web/src/app/api/account/cv-imports/[uploadId]/route.ts
- [x] T132 [US5] Implement leased expiry, physical artifact deletion, database payload scrubbing, once-only quota release, safe lag metrics, exact 24-hour/30-day/7-day rules, and the `CANCELLED` to `DELETED` transition only after all candidate-deleted content is absent in web/src/backend/cv/workers/cleanup.ts
- [x] T133 [US5] Implement bounded storage reconciliation for missing references and grace-aged orphans without exposing locators or deleting current in-flight objects in web/src/backend/cv/workers/reconciliation.ts
- [x] T134 [US5] Wire cleanup/reconciliation schedules, readiness, feature-disable behavior, abort recovery, and health projection into web/src/backend/cv/workers/pipeline.ts, web/src/backend/cv/workers/cv-worker-runtime.ts, and web/src/app/api/health/route.ts
- [x] T135 [US5] Validate/document the production private bucket, KMS, 31-day lifecycle, one-day multipart-abort, scanner signature, and OpenAI approval evidence at startup/deployment in scripts/check-environment.mjs and spec-kit/specs/004-cv-upload-parse-review/checklists/production-provider-gates.md
- [x] T136 [P] [US5] Upgrade and compose the presentation-only unselected external-consent control from T064 into the exact grant/revoke lifecycle, future-processing caveat, provider/purpose/version display, disabled-state explanation, and custom presentation owned only by the adjacent same-basename web/src/frontend/features/cv-import/components/cv-processing-consent.module.css for web/src/frontend/features/cv-import/components/cv-processing-consent.tsx, without duplicating the general processing notice
- [x] T137 [P] [US5] Implement visible retention deadlines, destructive delete confirmation, immediate cancellation acknowledgement, distinct cleanup-pending `CANCELLED` and completed `DELETED` outcomes, 24-hour purge deadline, manual Profile link, and custom presentation owned only by the adjacent same-basename web/src/frontend/features/cv-import/components/cv-retention-actions.module.css for web/src/frontend/features/cv-import/components/cv-retention-actions.tsx
- [x] T138 [US5] Integrate consent/retention/delete state and actions into the import client/status page by removing all cached content immediately, retaining only the safe owner tombstone in memory, polling `CANCELLED` until `DELETED` or the 24-hour deadline, and using no browser persistence in web/src/frontend/features/cv-import/client/use-cv-import.ts, web/src/frontend/features/cv-import/components/cv-import-status.tsx, and web/src/app/(workspace)/profile/cv-imports/[uploadId]/page.tsx; keep status-specific style changes in the adjacent cv-import-status.module.css and add an adjacent [uploadId]/page.module.css only if the route itself needs custom layout
- [x] T139 [US5] Extend allowlisted audit events for consent grant/revoke, external dispatch result, candidate deletion, expiry, physical deletion, scrub, and reconciliation without CV content or consent text in web/src/backend/audit/events.ts
- [x] T140 [US5] Run all US5 contract, consent/OpenAI, retention/reconciliation, privacy, component/accessibility, and Playwright tests and record the independent result in spec-kit/specs/004-cv-upload-parse-review/checklists/us5-consent-retention-results.md

**Checkpoint**: External processing is purpose-bound and revocable for future dispatch; all temporary CV content has an actively enforced deletion owner and deadline.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Close full-scope architecture, performance, usability, operational, privacy, and release evidence after the selected story phases pass.

- [x] T141 [P] Run and, where needed, extend full Feature 004 boundary checks for route/service/provider imports, parser purity, server-only packages, no browser persistence/public URLs, absence of any original-CV retrieval/download route, rejection of custom provider endpoints, and production bundle separation in web/tests/architecture/cv-import-boundaries.test.ts; also run the complete style-ownership gate for every Feature 004 TSX/CSS pair, same-directory/same-basename matching, matching-owner-only imports, no empty required modules, no `:global` or cross-component imports, no feature-level `styles/` or catch-all stylesheet, and no Feature 004 leakage into global/shared stylesheets in web/tests/architecture/cv-import-style-boundaries.test.ts
- [x] T142 [P] Add deterministic performance instrumentation for upload finalization/pre-scan validation, queue/stage processing, review load, save/confirm, memory caps, cleanup lag, and load-concurrent claims without content dimensions; before collecting cleanup results, define and emit the cleanup observation unit, numerator, denominator, measurement window, deadline treatment, and manual-intervention classification, plus sample size, duration, concurrency, P50/P95/P99, maximum, error rate, and cold/warm/provider conditions in web/scripts/measure-cv-import-performance.mjs and web/package.json
- [x] T143 [P] Add cross-page axe/contrast/keyboard/reduced-motion/320px checks for import list, status, review, conflicts, consent, failure, receipt, delete, and expired states in web/tests/frontend/accessibility/cv-import/cv-import-workflow.accessibility.test.tsx
- [x] T144 [P] Add an opt-in synthetic-only live OpenAI smoke test that requires an approved non-production project, never accepts real CV data, and skips safely by default in web/tests/backend/compatibility/cv-import/openai-live.synthetic.test.ts
- [x] T145 [P] Document setup, only host ports 3001/55432, same-host/pod `/run/clamav/clamd.sock` topology with no scanner TCP port, Compose-backed worker supervision, fixture-only troubleshooting, retry/no-admin-DLQ behavior, storage cleanup, the inherited production HTTPS/ingress/HSTS gate, the allowlisted HTTPS provider endpoint, the explicit absence of an original-CV retrieval/download endpoint in P0, the Tailwind/shadcn-first plus optional adjacent same-basename CSS Module convention and prohibited global/catch-all leakage, provider gates, and verification commands in README.md and spec-kit/specs/004-cv-upload-parse-review/quickstart.md
- [x] T146 Execute the representative-user upload/review/confirm study with at least 30 participants split into at least 15 desktop and 15 at 320px, cover PDF/DOCX and Vietnamese/English/bilingual fixtures, require at least 90% first-attempt completion without assistance, and record anonymized aggregate evidence or explicitly mark P0 release blocked in spec-kit/specs/004-cv-upload-parse-review/checklists/usability-results.md
- [x] T147 Run the performance harness under the documented environment and representative dataset; verify P95 pre-scan upload feedback within 5 seconds, at least 90% within 60 seconds/all within 3 minutes, P95 review load within 3 seconds, P95 save/confirm feedback within 2 seconds, resource ceilings, and 99% cleanup using the observation unit/numerator/denominator/manual-intervention definition established by T142, and record sample size, duration, concurrency, percentile method, P50/P95/P99, maximum, error rate, cold/warm/provider conditions, and non-content results in spec-kit/specs/004-cv-upload-parse-review/checklists/performance-results.md
- [x] T148 Run Prisma validate/generate, migration verification from a clean PostgreSQL 16.12 database, forward compatibility over migrations 001-007, constraint tests, and rollback-safety review; record results in spec-kit/specs/004-cv-upload-parse-review/checklists/migration-results.md
- [x] T149 Add and run one serial Playwright E2E with a real Better Auth session and deterministic parser that performs, in one uninterrupted test without seeding a draft or splitting the journey across specs, clean CV upload -> asynchronous parse to the actual generated `REVIEW_READY` draft -> review/edit/select -> confirm; verify CandidateProfile is unchanged before confirm and then receives exactly the selected values, one revision increment, and the non-content receipt in web/tests/system/e2e/cv-import/full-upload-parse-review-confirm.spec.ts
- [x] T150 After T048-T050 and T081-T082, add and run a real-Route-Handler session-boundary matrix for upload reservation/content (`POST /api/account/cv-imports`, `PUT /api/account/cv-imports/{uploadId}/content`), parse/import status (`GET /api/account/cv-imports/{uploadId}`), draft review (`GET/PATCH /api/account/cv-drafts/{draftId}`), and confirmation (`POST /api/account/cv-drafts/{draftId}/confirm`); prove every real handler applies the T022 middleware behavior established by the T013 harness and rejects missing session, an existing session beyond its idle or absolute TTL, logout/explicitly revoked session, and password-reset-revoked session while accepting the valid ACTIVE baseline, with no handler-local or alternate authentication path, in web/tests/backend/integration/cv-import/cv-route-session-boundary.test.ts
- [x] T151 After T150 passes, run format, lint, typecheck, complete Vitest suites including the real-Route-Handler session-boundary matrix, serial Playwright CV journeys, production build, npm audit review, dependency/license checks, ClamAV/S3/OpenAI configuration checks, container scan, and the inherited production HTTPS gate; link evidence for trusted ingress/proxy TLS termination, HTTP-to-HTTPS redirect, approved HSTS, secure-cookie/origin preservation, the allowlisted HTTPS provider endpoint with custom/non-HTTPS overrides rejected, and the absence of any original-CV retrieval/download route in P0, then record exact reproducible results and unresolved release blockers in spec-kit/specs/004-cv-upload-parse-review/checklists/final-quality-gate.md
- [x] T152 Trace every functional requirement, verification requirement, success criterion, consent/retention invariant, and constitution gate to an implemented task plus passing evidence; explicitly require US1-US5 and T141-T152 before P0 release, and do not claim unmet live-provider, performance, usability, or production controls in spec-kit/specs/004-cv-upload-parse-review/checklists/traceability.md

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately; T007 depends on T001-T006.
- **Foundation (Phase 2)**: Depends on the passed T007 gate. Tests T008-T015 are written first; implementation T016-T032 follows; T033 is the blocking foundation gate and runs only the T013 middleware harness, not the later real-handler matrix.
- **US1 (Phase 3)**: Depends on T033 and establishes the upload-to-draft pipeline.
- **US2 (Phase 4)**: Depends on T033 for development against a seeded REVIEW_READY draft; integrated delivery depends on US1. US1 + US2 is a non-release technical checkpoint.
- **US3 (Phase 5)**: Depends on the US1 stage pipeline and consumes only the read-only Foundation CvConsentReadGateway from T028 for external-retry eligibility; it does not depend on the later US5 grant/revoke implementation. Failure-policy tests can be prepared after T033 with controlled providers.
- **US4 (Phase 6)**: Depends on US2 draft save/confirm behavior.
- **US5 (Phase 7)**: Consent/OpenAI work can begin after T033; T125 extends T028's read-only consent repository with grant/revoke mutations and T136 activates the presentation-only control from T064. External dispatch integration depends on US1, while retention/delete integration depends on the shared artifact/job state and confirmation scheduling from US1/US2.
- **Polish (Phase 8)**: Depends on every story included in the intended release. T150 depends specifically on the real handlers from T048-T050 and T081-T082, does not gate T033, and MUST pass before T151.

### User Story Dependency Graph

    Setup -> Foundation -> US1
    US1 -> US2
    US1 -> US3
    US2 -> US4
    US1 + US2 -> US5

- US2 remains independently testable with a seeded review-ready draft even though the production upload-to-confirm journey uses US1.
- US3 changes only recovery around US1 stages and never blocks the clean US1 path.
- US5 consent can be tested with a controlled external job, and retention can be tested with seeded artifacts; its final integration spans US1 and US2 content lifecycles.

### Within Each User Story

1. Write all listed tests and confirm the intended missing behavior fails.
2. Implement shared browser contracts before route/client consumers.
3. Implement gateways/repositories before business services.
4. Implement services before thin Route Handlers and Server Components.
5. Implement browser client state before composed UI/pages.
6. Run the independent checkpoint and record evidence before starting dependent story integration.

## Parallel Examples

### Foundation

    T008 database constraints
    T009 contract/schema parity
    T010 encryption
    T011 storage contracts
    T012 leases
    T013 request authorization
    T014 privacy canaries
    T015 architecture

After T025:

    T026 filesystem adapter
    T027 S3 adapter

### User Story 1

    T034 upload contracts
    T035 authorization
    T036 admission/quota
    T037 streaming receiver
    T038 ClamAV
    T039 extraction corpus
    T040 parser/draft factory
    T041 worker pipeline
    T042 component/accessibility

After their interfaces exist:

    T051 scanner adapter
    T053 isolation runner
    T057 deterministic parser
    T063 browser client
    T064 upload/status components

After T064:

    T066 US1 style-ownership verification

After T053:

    T054 PDF extractor
    T055 DOCX extractor

### User Story 2

    T068 review contracts
    T069 comparison authorization
    T070 draft save
    T071 confirmation transaction
    T072 confirmation concurrency
    T073 component/accessibility

After T075:

    T076 comparison repository
    T084 scalar/evidence UI
    T085 collection review UI
    T087 feedback/receipt UI

After T084-T087:

    T089 US2 style-ownership verification

### User Story 3

    T091 retry contract
    T092 failure outcomes
    T093 retry policy
    T094 component/accessibility

### User Story 4

    T103 draft concurrency
    T104 Profile conflict
    T105 retained-value UI

### User Story 5

    T114 consent/delete contracts
    T115 consent ledger
    T116 OpenAI compatibility
    T117 dispatch gate
    T118 retention
    T119 deletion/reconciliation
    T120 S3 policy
    T121 privacy canaries
    T122 component/accessibility

After T124:

    T125 consent repository
    T128 OpenAI adapter
    T130 retention service
    T136 consent UI
    T137 retention UI

## Implementation Strategy

### Non-Release Technical Checkpoint

1. Complete Setup and pass T007.
2. Complete Foundation and pass T033.
3. Complete US1 and pass T067.
4. Complete US2 and pass T090.
5. Stop and demonstrate the clean PDF/DOCX upload-to-review-to-confirm vertical slice, including Profile non-mutation before confirm and one transactional revision after confirm.
6. Label this evidence a technical checkpoint only; do not deploy or call it an MVP/P0 release.

### P0 Release

1. Complete and pass US3 bounded failure recovery.
2. Complete and pass US4 multi-device conflict handling.
3. Complete and pass US5 processing notice, external consent, cancellation, and retention/deletion.
4. Pass every Phase 8 task and quality gate T141-T152, including the real-Route-Handler session-boundary matrix, measured performance, and usability evidence.
5. Release only when Setup + Foundation + US1-US5 + all applicable quality gates are complete.

### Incremental Delivery

1. Demonstrate the US1 + US2 non-release technical checkpoint.
2. Add US3 bounded candidate recovery with no hidden administrator wait.
3. Add US4 multi-device conflict protection.
4. Add US5 exact external consent and actively enforced retention/deletion.
5. Run Phase 8 across the complete P0 scope and release only after every gate passes.

### Parallel Team Strategy

1. Keep one owner for shared schema/migration and generated Prisma changes.
2. After T033, prepare US2 against seeded drafts and US5 consent/provider adapters in separate lanes while the US1 pipeline is implemented.
3. Serialize edits to shared pipeline.ts, parse-stage.ts, import status route/page, audit/events.ts, environment scripts, package files, and Profile navigation.
4. Integrate only after each lane passes its independent checkpoint.

## Notes

- [P] means separate files and no unmet same-level dependency; it does not override phase gates.
- Every browser owner comes from the existing Better Auth session; no task may add account/profile/upload/artifact/job/draft/consent/confirmation ownership fields to a mutation.
- PostgreSQL is authoritative for state, leases, revisions, retries, consent evidence, deletion, and receipts.
- SHA-256 is for per-artifact integrity/replay verification only; never expose it or use it to reveal/reuse another import or account's content.
- Parser output always becomes an untrusted draft; no parser/provider module may write CandidateProfile.
- Never log or persist outside the narrow encrypted boundaries any CV bytes/text/snippets, filename, Profile value, digest/HMAC, locator, encryption material, consent text, prompt/response, raw scanner/provider error, API token, cookie/session/CSRF value, or complete personal-data body.
- The deterministic parser is local/test only. External parsing requires the exact live consent plus deployment DPA/privacy/cross-border/ZDR gate before every dispatch and has no automatic provider fallback.
- US1 owns only the visible unselected external-consent control and blocked default state; Foundation owns the read-only live-consent lookup, US3 consumes that lookup for retry eligibility, and US5 alone owns grant/revoke mutations and activates the full consent lifecycle.
- Candidate retry history is the P0 dead-letter evidence and ends in retry/replace/manual/delete actions; do not add an administrator DLQ UI or direct-database recovery workflow.
- The application cleanup worker owns exact deletion deadlines; S3 lifecycle is only a maximum-retention safeguard.
- Do not edit applied migrations web/prisma/migrations/001_identity_foundation through web/prisma/migrations/007_candidate_profile_account_management.
- Commit after a task or coherent task group only when explicitly requested.
