# Tasks: Purpose-Specific OCR Parsing

**Input**: Design documents from `spec-kit/specs/005-ocr-parsing/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Tests are required because the specification defines independent acceptance tests, hard security/retention invariants, accuracy thresholds, and P95 performance targets. In every phase, create the listed tests first and confirm that they fail for the missing behavior before implementing it.

**Organization**: Tasks are grouped by shared setup, blocking foundations, and the four user stories so each story can be implemented and demonstrated independently. US1 and US2 are the two P1 functional checkpoints; US3 and US4 are mandatory recovery, privacy, and security scope for a releasable Feature 005.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can be implemented in parallel because the task changes different files and has no unfinished dependency in the same phase.
- **[Story]**: Maps a task to `US1`, `US2`, `US3`, or `US4` from `spec.md`.
- Every task names the exact repository file or directory it changes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the pinned runtimes, process entry points, local topology, configuration surface, and test-fixture structure required by both OCR purposes.

- [ ] T001 Add the exact server-only `sharp` `0.35.3` and `@napi-rs/canvas` `1.0.2` dependencies and refresh the npm lockfile in `web/package.json` and `package-lock.json`
- [ ] T002 [P] Pin the production and test Python packages selected in the plan in `ocr-engine/requirements.txt` and `ocr-engine/requirements-dev.txt`
- [ ] T003 [P] Add the immutable PaddleOCR/PP-OCRv6 engine, model, checksum, language, and policy metadata in `ocr-engine/model-manifest.json`
- [ ] T004 [P] Create the rootless, no-package-manager OCR sidecar build with pinned Python dependencies and model assets in `Dockerfile.ocr-engine`
- [ ] T005 [P] Create the isolated Node image-search worker build that excludes browser assets and unnecessary package managers in `Dockerfile.image-search-worker`
- [ ] T006 Add the `ocr-engine` and `image-search-worker` services, private Unix-socket volumes, purpose-separated storage, health dependencies, tmpfs, no published OCR port, and failure-isolated startup behavior in `compose.yaml`
- [ ] T007 [P] Document and generate all server-only OCR/search defaults, independent encryption/HMAC keys, local private roots, provider gates, and feature flags in `.env.example` and `scripts/setup-local.mjs`
- [ ] T008 [P] Add fail-closed validation for absolute Unix-socket paths, separate keys, production storage, OCR manifest pins, external-provider approvals, and prohibited `NEXT_PUBLIC_` settings in `scripts/check-environment.mjs`
- [ ] T009 [P] Add the server-only image-search worker launcher and startup diagnostics in `web/scripts/run-image-search-worker.mjs`
- [ ] T010 [P] Add a content-free OCR live/readiness/model-manifest probe over the Unix socket in `web/scripts/check-ocr-engine.mjs`
- [ ] T011 Add root/workspace commands for the OCR engine, image-search worker, probes, production storage preflight, focused tests, corpus evaluation, and performance evidence in `package.json` and `web/package.json`
- [ ] T012 [P] Create the synthetic-only corpus layout, license/provenance rules, truth-data format, and prohibited-real-user-data notice in `web/tests/fixtures/ocr-corpus/README.md` and `web/tests/fixtures/ocr-corpus/manifest.json`

**Checkpoint**: Dependencies, containers, scripts, configuration names, and safe fixture conventions exist; no user workflow is enabled yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the additive persistence, strict contracts, isolated OCR provider, safe normalization, purpose-specific storage, request boundary, and worker resource seams required before any story work.

**CRITICAL**: No user-story implementation begins until this phase is complete and its failing-first foundational tests pass.

### Foundational Tests

- [ ] T013 [P] Add migration tests for every new relation, enum, check constraint, partial/unique index, immutable deadline, and unchanged Feature 001-004 schema in `web/tests/backend/integration/ocr-image-search/purpose-specific-ocr-migration.test.ts`
- [ ] T014 [P] Add strict OCR recognition and live/readiness OpenAPI contract tests, including unknown fields and byte/line/geometry bounds, in `ocr-engine/tests/test_contract.py`
- [ ] T015 [P] Add OCR engine manifest, checksum, warm-readiness, timeout, Unicode, and bounded-output tests in `ocr-engine/tests/test_engine.py`
- [ ] T016 [P] Add cross-artifact parity tests proving the committed OpenAPI, JSON Schema, Zod, and Pydantic definitions expose identical version, field, enum, bound, and unknown-field rules without retesting CV workflow behavior in `web/tests/backend/contract/ocr-image-search/contract-parity.test.ts`
- [ ] T017 [P] Add architecture tests forbidding direct Prisma/storage/provider access from routes, purpose-crossed storage, browser bundling of Sharp/Canvas, TCP OCR, and OCR-engine database/network access in `web/tests/architecture/ocr-image-search-boundaries.test.ts`
- [ ] T018 [P] Add Sharp normalizer tests for static PNG/JPEG agreement, auto-orientation, metadata removal, sRGB output, animation/polyglot/decompression rejection, and decoded-pixel limits in `web/tests/backend/unit/ocr/image-normalizer.test.ts`
- [ ] T019 [P] Add the shared encrypted-search-storage contract suite for filesystem/S3 adapters, AES-GCM integrity, purpose/query associated data, context confusion, random locators, and already-absent deletion in `web/tests/backend/integration/image-search/private-search-storage.contract.test.ts`
- [ ] T020 [P] Add configuration tests for disabled/degraded modes, socket/manifest mismatch, separate key material, production filesystem rejection, and external privacy/ZDR gates in `web/tests/backend/unit/image-search/config.test.ts`
- [ ] T021 [P] Add mocked/live-contract production storage preflight tests for all S3 Block Public Access flags, public-policy status, least-privilege bucket/prefix and KMS permissions, exact SSE-KMS key policy, exact one-day object/noncurrent expiration and multipart-abort rules, 15-minute report freshness, and secret-free reports in `web/tests/backend/integration/image-search/production-storage-preflight.test.ts`

### Foundational Implementation

- [ ] T022 Extend `CvExtraction` and add all Feature 005 enums, OCR attempt/unit models, search query/artifact/scan/decode/intent/consent/admission models, relations, and mapped names in `web/prisma/schema.prisma`
- [ ] T023 Implement the additive tables, foreign keys, state/deadline checks, idempotency uniqueness, claim indexes, retention indexes, and immutable `deleteBy` enforcement in `web/prisma/migrations/009_purpose_specific_ocr/migration.sql`
- [ ] T024 Regenerate the checked-in Prisma client after T022-T023 and verify that only additive Feature 005 outputs change in `web/src/backend/generated/prisma/`
- [ ] T025 [P] Implement strict Zod/runtime contracts and version constants corresponding to the committed schemas in `web/src/shared/contracts/ocr/recognition.ts`, `web/src/shared/contracts/ocr/cv-segments-v2.ts`, and `web/src/shared/contracts/jobs/search-intent.ts`
- [ ] T026 [P] Implement bounded Pydantic request/result types, error envelopes, purpose profiles, image limits, and Unicode validation in `ocr-engine/src/contracts.py` and `ocr-engine/src/limits.py`
- [ ] T027 Implement checksum-verified PP-OCRv6 loading, warmed inference, line geometry/confidence normalization, deterministic model metadata, and no business/network behavior in `ocr-engine/src/engine.py`
- [ ] T028 Implement the FastAPI live/readiness/recognition application and Unix-domain-socket startup with content-free errors in `ocr-engine/src/app.py`
- [ ] T029 [P] Define the provider-neutral `OcrEngine` port, recognition failures, deadlines, purpose profiles, and confidence-policy versions in `web/src/backend/ocr/ocr-engine.ts` and `web/src/backend/ocr/policies.ts`
- [ ] T030 Implement the UDS-only OCR adapter with manifest pin verification, bounded request/response handling, abort/timeout support, and strict contract validation in `web/src/backend/ocr/unix-ocr-engine.ts`
- [ ] T031 Implement the server-worker-only Sharp image normalizer port and safe static PNG/JPEG decoder described by the internal contract in `web/src/backend/ocr/image-normalizer.ts`
- [ ] T032 Implement server configuration for OCR, search storage, worker limits, interpreter gates, rolling quotas, exact 20-second CV-unit/six-second search/immutable 180-second hybrid deadlines, and safe degraded startup in `web/src/backend/image-search/config.ts` and `web/src/backend/env/server.ts`
- [ ] T033 [P] Define the purpose-specific `PrivateSearchArtifactStorage` port, encrypted envelope/context types, integrity/deletion semantics, and its private-permission encrypted local adapter under the configured gitignored root in `web/src/backend/image-search/storage/private-search-storage.ts` and `web/src/backend/image-search/storage/filesystem.ts`
- [ ] T034 Implement the private S3/SSE-KMS plus application-AES adapter without public URLs or cross-purpose keys in `web/src/backend/image-search/storage/s3.ts`
- [ ] T035 Implement the production storage preflight against live S3/KMS state and the allowlisted least-privilege policy artifact, require exact one-day current/noncurrent expiration and incomplete-multipart abort, and emit a secret-free report valid for 15 minutes at `web/.local/evidence/image-search-storage-preflight.json`, in `web/scripts/check-image-search-production-storage.mjs` and `deploy/image-search-storage-policy.json`
- [ ] T036 [P] Implement same-origin/Fetch-Metadata/CSRF enforcement, Better Auth actor derivation, visitor capability HMAC checks, the non-auth `__Host-smarthire-image-rate` cookie, idempotency binding, and non-disclosing failures in `web/src/backend/security/image-search-request-boundary.ts`
- [ ] T037 Define only generic provider-neutral worker resource/factory abstractions parameterized over scanner, normalizer, OCR, storage, clock, interpreter, repositories, and admission-readiness ports, with no story-module imports, concrete construction, or duplicate domain-port definitions, in `web/src/backend/image-search/workers/resources.ts`
- [ ] T038 [P] Add allowlisted OCR/image-search event fields, safe failure codes, duration buckets, target HMACs, and content-excluding redaction rules in `web/src/backend/image-search/telemetry.ts`, `web/src/backend/audit/events.ts`, and `web/src/backend/security/redaction.ts`

**Checkpoint**: The database, provider/storage/request contracts, OCR sidecar, safety boundary, and dependency seams are ready. US1 and US2 implementation can now proceed in parallel.

---

## Phase 3: User Story 1 - Import Image-Bearing CV Documents (Priority: P1)

**Goal**: Let an authenticated Candidate import scanned/mixed PDF or main-body-image DOCX content through native-first selective OCR, ordered provenance, the existing parser/review flow, and explicit confirmation while standalone image CV uploads remain rejected.

**Independent Test**: Upload native, image-only, mixed/suspicious PDF, and eligible/excluded DOCX fixtures; verify every unit is accounted for in order, safe content reaches a reviewable/actionable outcome, warnings/provenance are visible, Profile data stays unchanged before confirmation, and direct PNG/JPEG CV upload is rejected.

### Tests for User Story 1

- [ ] T039 [P] [US1] Add CV-specific behavior and boundary contract tests for ordered native/OCR outcomes, provenance, confidence, conflicts, output bounds, v1-native regression, and invalid hybrid combinations without repeating cross-artifact schema parity in `web/tests/backend/contract/ocr-image-search/cv-segments-v2.contract.test.ts`
- [ ] T040 [P] [US1] Add PDF eligibility/render tests for native-sufficient, empty, sparse, suspicious/misleading, mixed, repeated, 20-page, DPI, and page-accounting cases in `web/tests/backend/unit/cv-hybrid-extraction/pdf-ocr-manifest.test.ts`
- [ ] T041 [P] [US1] Add DOCX traversal tests for body anchors/order, floating images, PNG/JPEG eligibility, headers/footers/comments/unreferenced/external/active exclusions, and 20-image/100-megapixel hard limits in `web/tests/backend/unit/cv-hybrid-extraction/docx-ocr-manifest.test.ts`
- [ ] T042 [P] [US1] Add hybrid merge tests for deterministic order, exact/overlap deduplication, repeated decorations, native/OCR conflicts, low confidence, invalid Unicode, and the 512-KiB result bound in `web/tests/backend/unit/cv-hybrid-extraction/hybrid-segments.test.ts`
- [ ] T043 [P] [US1] Add native PDF/DOCX golden regressions proving v1 extraction and drafts do not call or depend on OCR when the sidecar is down in `web/tests/backend/integration/cv-hybrid-extraction/native-regression.test.ts`
- [ ] T044 [P] [US1] Add image-only/mixed PDF and main-body DOCX integration tests covering scan prerequisite, per-unit OCR calls, outcome persistence, ordering, versions, and encrypted v2 artifacts in `web/tests/backend/integration/cv-hybrid-extraction/hybrid-extraction.test.ts`
- [ ] T045 [P] [US1] Add lease loss, timeout, worker crash, duplicate delivery, cancellation, retry, stale-result discard, temp-permission, and recursive-cleanup integration tests in `web/tests/backend/integration/cv-hybrid-extraction/hybrid-recovery.test.ts`
- [ ] T046 [P] [US1] Add parser/draft tests for v2 provenance and warnings, exact revision conflict, idempotent confirmation, atomic Profile writes, and zero pre-confirmation mutation in `web/tests/backend/integration/cv-hybrid-extraction/hybrid-draft-review.test.ts`
- [ ] T047 [P] [US1] Add component and accessibility coverage for source labels, confidence/non-color warnings, conflicts, keyboard review, retry/replacement/manual actions, and 320-pixel layout in `web/tests/frontend/components/cv-import/cv-ocr-review.test.tsx` and `web/tests/frontend/accessibility/cv-import/cv-ocr-review.accessibility.test.tsx`
- [ ] T048 [US1] Add a full Candidate PDF/DOCX upload-to-review-to-confirm E2E suite plus standalone PNG/JPEG rejection and Profile-before-confirm assertions in `web/tests/system/e2e/cv-import/ocr-hybrid-import.spec.ts`

### Implementation for User Story 1

- [ ] T049 [P] [US1] Define the versioned CV extraction manifest, unit kinds, deterministic anchors, accounting outcomes, provenance, and bounded failure types in `web/src/shared/contracts/ocr/cv-extraction.ts`
- [ ] T050 [P] [US1] Implement PDF.js native-text placement, `cv-ocr-eligibility-v1`, suspicious-layer detection, selective 200-DPI rendering, and page outcomes in `web/src/backend/cv/extraction/pdf-ocr-manifest.ts`
- [ ] T051 [P] [US1] Implement main-document DOCX relationship traversal, anchor/ordinal inventory, supported-image safety metadata, explicit exclusions, and aggregate limits in `web/src/backend/cv/extraction/docx-ocr-manifest.ts`
- [ ] T052 [P] [US1] Implement per-attempt `0700`/`0600` private raster workspaces, bounded writes, `finally` cleanup, and stale-startup cleanup in `web/src/backend/cv/extraction/private-raster-workspace.ts`
- [ ] T053 [US1] Implement `cv-segment-dedup-v1`, ordered native/OCR merging, per-unit accounting, conflict/warning production, and cumulative output enforcement in `web/src/backend/cv/extraction/hybrid-segments.ts`
- [ ] T054 [US1] Extend encrypted extraction artifact handling to write/read strict `cv-segments-v2` while leaving native-only `cv-segments-v1` byte behavior unchanged in `web/src/backend/cv/extraction/extracted-segment-store.ts`
- [ ] T055 [P] [US1] Implement transactional OCR-attempt and unit-outcome creation, lease-safe progress, finalization, and content-free failure persistence in `web/src/backend/repositories/cv-import/prisma-ocr-processing-repository.ts`
- [ ] T056 [US1] Return the manifest from the bounded extraction child, enforce structure-before-raster behavior, and preserve existing native extraction contracts in `web/src/backend/cv/extraction/document-extractor.ts`, `web/src/backend/cv/extraction/child-entry.ts`, and `web/src/backend/cv/extraction/runner.ts`
- [ ] T057 [US1] Orchestrate selective OCR with at most two concurrent units, an exact 20-second wall-clock deadline per unit, one immutable 180-second hybrid-extraction deadline shared by queueing/leases/retries from first manifest claim, remaining-time propagation, complete unit accounting, and late-output discard in `web/src/backend/cv/workers/extraction-stage.ts` and `web/src/backend/cv/workers/cv-worker-resources.ts`
- [ ] T058 [US1] Add `cv-draft-v2` parser input/output adapters that preserve OCR provenance/warnings while retaining deterministic/OpenAI provider boundaries and Profile-write prohibition in `web/src/backend/cv/parsing/cv-parser.ts`, `web/src/backend/cv/parsing/deterministic.ts`, and `web/src/backend/cv/parsing/openai.ts`
- [ ] T059 [US1] Create bounded v2 drafts and comparisons with provenance, low-confidence/conflict warnings, existing selection semantics, and unchanged atomic confirmation in `web/src/backend/services/cv-import/create-cv-draft.ts`, `web/src/backend/services/cv-import/cv-draft-comparison-service.ts`, and `web/src/backend/services/cv-import/confirm-cv-draft.ts`
- [ ] T060 [P] [US1] Extend review/status response contracts and projections with content-safe OCR stage, unit accounting, provenance, warning, and actionable outcome fields in `web/src/shared/contracts/cv-import/review.ts`, `web/src/shared/contracts/cv-import/common.ts`, and `web/src/backend/services/cv-import/cv-import-projection.ts`
- [ ] T061 [US1] Render OCR evidence, source location, confidence/conflict warnings, and retry/replacement/manual recovery without bypassing Candidate review in `web/src/frontend/features/cv-import/components/cv-evidence.tsx`, `web/src/frontend/features/cv-import/components/cv-draft-review.tsx`, `web/src/frontend/features/cv-import/components/cv-import-status.tsx`, and `web/src/frontend/features/cv-import/components/cv-failure-recovery.tsx`

**Checkpoint**: US1 works end to end as an additive Feature 004 path; native imports remain v1 and direct image CV uploads remain rejected.

---

## Phase 4: User Story 2 - Find Jobs from an Image Query (Priority: P1)

**Goal**: Let a visitor or authenticated user submit one safe PNG/JPEG, see and control validated OCR-derived job criteria, and retrieve only public active jobs through the existing deterministic Feature 003 search.

**Independent Test**: Run Vietnamese, English, and bilingual poster images as visitor and authenticated actors; verify editable/removable proposals, quota enforcement before expensive work, manual/image criteria equivalence, current-criteria conflict behavior, and exclusion of every unavailable/private job.

### Tests for User Story 2

- [ ] T062 [P] [US2] Add strict shared-schema tests for reservation, status, cancellation, content metadata, one-time result, Feature 003 criteria input, provenance, and content-free errors in `web/tests/shared/unit/contracts/jobs/image-search-contracts.test.ts`
- [ ] T063 [P] [US2] Add route/OpenAPI parity tests for all image-search endpoints, raw-stream headers, no-store responses, status transitions, idempotency, and unknown ownership-field rejection in `web/tests/backend/contract/ocr-image-search/image-search-api.contract.test.ts`
- [ ] T064 [P] [US2] Add controlled-clock/concurrency admission tests for visitor IP+browser 3/hour, authenticated account 10/hour, latest retry time, abandoned reservations, idempotent replay, multi-device, and shared-IP behavior in `web/tests/backend/integration/image-search/image-search-admission.test.ts`
- [ ] T065 [P] [US2] Add ownership tests for Better Auth account derivation, visitor capability guessing/replay/expiry, rate-cookie non-auth status, same-origin/CSRF, and non-disclosing cross-actor failures in `web/tests/backend/integration/image-search/image-search-authorization.test.ts`
- [ ] T066 [P] [US2] Add raw upload, exact-length, type/extension/signature agreement, clean-scan prerequisite, stale scanner, EICAR, malformed/animated/polyglot, 20-megapixel, and metadata-strip pipeline tests in `web/tests/backend/integration/image-search/image-admission-and-decode.test.ts`
- [ ] T067 [P] [US2] Add search-intent validation and selection-policy tests for allowed fields, evidence offsets, confidence edges, explicit/normalized/inferred bases, contradictions, excess values, job IDs, sort/ranking, and private fields in `web/tests/backend/unit/image-search/search-intent-selection.test.ts`
- [ ] T068 [P] [US2] Add worker integration tests for scan/decode/OCR/deterministic interpretation, stage leases, duplicate delivery, bounded artifacts, state guards, and result-ready finalization in `web/tests/backend/integration/image-search/image-search-pipeline.test.ts`
- [ ] T069 [P] [US2] Add one-time result-consumption tests for current visible criteria validation, scalar/query no-overwrite suggestions, set deduplication, non-persistence of manual criteria, and consume-once behavior in `web/tests/backend/integration/image-search/image-search-result-consumption.test.ts`
- [ ] T070 [P] [US2] Add equivalence/authorization regressions proving manual and image-derived criteria use identical Feature 003 normalization, ordering, pagination, visibility, and availability rules in `web/tests/backend/integration/jobs/image-search-deterministic-parity.test.ts`
- [ ] T071 [P] [US2] Add frontend tests for image selection, progress/cancel, proposal labels, selection defaults, editing/removal/clear/reverse, manual criteria preservation, quota errors, and ordinary text-search availability in `web/tests/frontend/components/jobs/image-search.test.tsx`
- [ ] T072 [P] [US2] Add keyboard, focus, live-region, non-color confidence, error recovery, reduced-motion, contrast, and 320-pixel accessibility tests in `web/tests/frontend/accessibility/jobs/image-search.accessibility.test.tsx`
- [ ] T073 [P] [US2] Add fake-clock lifecycle tests proving hard deadlines, immediate terminal/consume/cancel/expiry denial, independent cleanup retries, already-absent success, orphan reconciliation, admission rejection for unhealthy cleanup or missing/stale/mismatched production preflight, and physical absence by admission plus 15 minutes in `web/tests/backend/integration/image-search/search-retention-deletion.test.ts`
- [ ] T074 [US2] Add visitor/authenticated E2E journeys covering image upload, editable criteria, deterministic results, unavailable-job exclusion, URL safety, quota retry time, ordinary text search, and hard-deadline cleanup readiness in `web/tests/system/e2e/ocr-image-search/image-assisted-job-search.spec.ts`

### Implementation for User Story 2

- [ ] T075 [P] [US2] Implement strict request/status/result/proposal schemas, lifecycle enums, bounds, and public content-free response types in `web/src/shared/contracts/jobs/image-search.ts`
- [ ] T076 [P] [US2] Implement query, artifact, scan, decode, and intent persistence with allowlisted projections and immutable deadlines in `web/src/backend/repositories/image-search/prisma-image-search-query-repository.ts`
- [ ] T077 [P] [US2] Implement `FOR UPDATE SKIP LOCKED` stage claims, leases, expected-parent-state commit guards, idempotent completion, and late-result rejection in `web/src/backend/repositories/image-search/prisma-image-search-work-repository.ts`
- [ ] T078 [P] [US2] Implement transactional rolling-window counting/insertion for account, IP-HMAC, and browser-HMAC subjects with exact `retryAt` calculation in `web/src/backend/repositories/image-search/prisma-image-search-admission-repository.ts`
- [ ] T079 [US2] Implement atomic terminal/consume/cancel/expiry content denial, immediate deletion scheduling, immutable `deleteBy`, and typed admission readiness that combines cleanup/reconciliation health with current production-storage-preflight evidence in `web/src/backend/repositories/image-search/prisma-image-search-query-repository.ts` and `web/src/backend/services/image-search/image-search-admission-readiness.ts`
- [ ] T080 [US2] Implement independently claimed idempotent physical deletion, envelope/locator scrubbing, retry scheduling, already-absent success, content-free outcomes, and readiness heartbeat in `web/src/backend/image-search/workers/cleanup.ts`
- [ ] T081 [US2] Reconcile orphan database/object/temp entries, expired admission events, stuck leases, overdue artifacts, and late results into immediate deletion, and withhold the reconciliation component of admission readiness until an initial pass succeeds, in `web/src/backend/image-search/workers/reconciliation.ts`
- [ ] T082 [US2] Implement pre-storage admission that requires current typed cleanup/reconciliation readiness and, in production, matching storage-preflight evidence no older than 15 minutes, plus actor quotas, idempotency, immutable `admittedAt + 15 minutes`, visitor capability HMAC storage, and rate-cookie issuance in `web/src/backend/services/image-search/create-image-search.ts`
- [ ] T083 [US2] Implement the thin reservation handler with strict metadata validation, injected combined admission-readiness enforcement, and content-free no-store output in `web/src/app/api/jobs/image-searches/route.ts`
- [ ] T084 [US2] Implement exact raw-stream receipt plus its bounded route handler, including leading-signature checks, encrypted source persistence, length finalization, idempotent retry handling, no multipart decoding, request-boundary authorization, and scan queueing, in `web/src/backend/services/image-search/receive-image-search-content.ts` and `web/src/app/api/jobs/image-searches/[queryId]/content/route.ts`
- [ ] T085 [US2] Implement authorized status/cancellation services and their GET/DELETE handler, preserving immutable deletion deadlines and excluding content/capabilities from no-store responses, in `web/src/backend/services/image-search/get-image-search-status.ts`, `web/src/backend/services/image-search/cancel-image-search.ts`, and `web/src/app/api/jobs/image-searches/[queryId]/route.ts`
- [ ] T086 [P] [US2] Implement integrity-verified source reads, current ClamAV assessment persistence, stale/indeterminate fail-closed behavior, and scan-safe transitions in `web/src/backend/image-search/workers/scan-stage.ts`
- [ ] T087 [US2] Implement post-clean Sharp decode, format agreement, 20-megapixel enforcement, auto-orientation, metadata stripping, flattening, normalized sRGB PNG storage, and source-artifact retirement in `web/src/backend/image-search/workers/decode-stage.ts`
- [ ] T088 [US2] Implement the exact six-second search OCR request deadline with same-query remaining-time propagation across lease recovery, strict manifest/result validation, attempt/unit outcome persistence, 32-KiB UTF-8 text cap, encrypted ephemeral storage, and fallback/terminal classification in `web/src/backend/image-search/workers/ocr-stage.ts`
- [ ] T089 [P] [US2] Implement the conservative local `deterministic-v1` interpreter for only evidence-backed Feature 003 fields in `web/src/backend/image-search/interpretation/deterministic.ts`
- [ ] T090 [P] [US2] Implement evidence-offset verification, field/value allowlists, contradiction/excess rejection, and `search-intent-selection-v1` confidence/basis rules in `web/src/backend/image-search/interpretation/selection-policy.ts`
- [ ] T091 [US2] Define the provider-neutral interpreter port and validate/store a bounded versioned one-time candidate intent without job identifiers or ranking decisions in `web/src/backend/image-search/interpretation/search-intent-interpreter.ts` and `web/src/backend/services/image-search/validate-search-intent.ts`
- [ ] T092 [US2] Assemble concrete scanner, normalizer, OCR, storage, repository, combined admission-readiness, clock, and deterministic-interpreter dependencies only after T076-T091 exist, preserving the generic Foundation boundary, in `web/src/backend/image-search/workers/resource-factory.ts`
- [ ] T093 [US2] Compose scan, decode, OCR, deterministic interpretation, cancellation/deadline checks, and terminal content-inaccessibility transitions through the concrete resource factory in `web/src/backend/image-search/workers/pipeline.ts`
- [ ] T094 [US2] Implement concurrency-four polling, leases, heartbeats, graceful shutdown, continuously active cleanup/reconciliation, and independent worker identity in `web/src/backend/image-search/workers/runtime.ts` and `web/src/backend/image-search/workers/entry.ts`
- [ ] T095 [US2] Implement one-time result authorization/consumption, current Feature 003 criteria validation, no-silent-overwrite merge, set deduplication, non-persistence of browser criteria, and immediate deletion scheduling in `web/src/backend/services/image-search/consume-image-search-result.ts`
- [ ] T096 [US2] Implement the no-store one-time result endpoint accepting only current visible criteria and returning validated visible proposals/fallback in `web/src/app/api/jobs/image-searches/[queryId]/result/route.ts`
- [ ] T097 [P] [US2] Implement content-free status polling types and TanStack Query defaults that do not cache image/OCR/capability data persistently in `web/src/frontend/features/jobs/image-search/client/image-search-api.ts`
- [ ] T098 [US2] Implement the in-memory query controller with source/capability/interaction IDs, polling, cancellation, current-result guards, and cleanup on navigation in `web/src/frontend/features/jobs/image-search/client/use-image-search.ts`
- [ ] T099 [P] [US2] Build accessible image selection, validation, upload, progress, cancellation, and quota/error controls in `web/src/frontend/features/jobs/image-search/components/image-search-input.tsx` and `web/src/frontend/features/jobs/image-search/components/image-search-progress.tsx`
- [ ] T100 [P] [US2] Build provenance/confidence proposal chips with explicit selection defaults and edit/remove/clear/reverse controls in `web/src/frontend/features/jobs/image-search/components/image-search-proposals.tsx`
- [ ] T101 [US2] Merge selected proposals into the existing Feature 003 URL contract and expose the responsive site-wide text/image affordance while preserving manual criteria and excluding private processing data in `web/src/frontend/features/jobs/image-search/client/apply-image-search-intent.ts`, `web/src/frontend/features/jobs/components/job-search-form.tsx`, `web/src/frontend/features/jobs/image-search/components/global-image-search.tsx`, `web/src/app/layout.tsx`, `web/src/app/home/page.tsx`, and `web/src/frontend/features/jobs/components/job-board-header.tsx`

**Checkpoint**: US2 runs only after hard-deadline transitions, cleanup, reconciliation, and deletion readiness are operational; it uses deterministic Feature 003 retrieval, never returns/accepts AI job IDs or ranking, and preserves complete user control over every generated criterion.

---

## Phase 5: User Story 3 - Recover Without OCR or AI (Priority: P2)

**Goal**: Keep native CV import and ordinary text search usable through OCR/AI timeouts, invalid output, cancellation, low confidence, and process failure, with no stale result overwriting current choices.

**Independent Test**: Disable or fault OCR and interpretation at every stage; verify native CVs still reach review, OCR-required CVs receive retry/replacement/manual actions without Profile writes, search offers a one-time in-memory text/manual fallback, and cancelled/stale/superseded results never apply.

### Tests for User Story 3

- [ ] T102 [P] [US3] Add disabled/unhealthy/stale-model OCR regressions proving native CV extraction and ordinary text search remain fully available in `web/tests/backend/integration/ocr/ocr-degraded-mode.test.ts`
- [ ] T103 [P] [US3] Add CV timeout, socket failure, invalid/empty/low-confidence output, bounded retry, replacement, manual-entry, and no-Profile-mutation tests in `web/tests/backend/integration/cv-hybrid-extraction/ocr-failure-recovery.test.ts`
- [ ] T104 [P] [US3] Add AI-unavailable/invalid-output tests proving successful OCR becomes a consume-once fallback, server text is retired immediately, and deterministic manual search remains authoritative in `web/tests/backend/integration/image-search/image-search-fallback.test.ts`
- [ ] T105 [P] [US3] Add frontend race tests for manual edits, cancellation, concurrent/newer query, out-of-order response, navigation, reload, and interaction-ID mismatch in `web/tests/frontend/components/jobs/image-search-recovery.test.tsx`
- [ ] T106 [P] [US3] Add process/supervisor tests proving OCR/image-worker failure reports reduced capability without terminating web, PostgreSQL, email, native CV, or ordinary search in `web/tests/backend/integration/ocr/image-worker-supervision.test.ts`
- [ ] T107 [US3] Add E2E failure journeys for native CV with OCR down, OCR-required CV recovery, AI fallback text, OCR failure, cancel, and stale results in `web/tests/system/e2e/ocr-image-search/failure-recovery.spec.ts`

### Implementation for User Story 3

- [ ] T108 [US3] Map OCR-specific failure classes into existing bounded Candidate retry/replacement/manual-entry states without marking partial low-quality drafts complete in `web/src/backend/services/cv-import/retry-cv-import.ts` and `web/src/backend/services/cv-import/get-cv-import-status.ts`
- [ ] T109 [P] [US3] Implement cached content-free OCR live/readiness/manifest health and purpose-specific availability decisions in `web/src/backend/ocr/ocr-health.ts`
- [ ] T110 [US3] Produce a bounded consume-once OCR-text fallback when interpretation is unavailable/invalid and make server text inaccessible during consumption in `web/src/backend/services/image-search/create-image-search-fallback.ts`
- [ ] T111 [US3] Extend result consumption to return either validated proposals or the one-time fallback while preserving deletion and no-store guarantees in `web/src/backend/services/image-search/consume-image-search-result.ts` and `web/src/app/api/jobs/image-searches/[queryId]/result/route.ts`
- [ ] T112 [US3] Abort and discard memory-only bytes, OCR fallback, capabilities, and older responses on cancel, navigation, reload, manual invalidation, or a newer query in `web/src/frontend/features/jobs/image-search/client/use-image-search.ts`
- [ ] T113 [US3] Add accessible retry/manual-search/fallback-text controls that never disable the existing search form and never persist fallback text in `web/src/frontend/features/jobs/image-search/components/image-search-recovery.tsx` and `web/src/frontend/features/jobs/components/job-search-form.tsx`
- [ ] T114 [US3] Make local startup and health reporting tolerate unavailable OCR/image-search workers while keeping cleanup enabled and reporting reduced capability in `scripts/run-local-development.mjs` and `web/src/app/api/health/route.ts`

**Checkpoint**: OCR and AI are additive dependencies; their failure cannot corrupt Profile/search state or disable native/manual workflows.

---

## Phase 6: User Story 4 - Control Sensitive Image Processing (Priority: P2)

**Goal**: Add advanced purpose/provider-specific consent, prompt-inert processing, prohibited-analysis safeguards, content-safe observability, and privacy canaries on top of the hard deletion lifecycle already required by US2.

**Independent Test**: Exercise consent grant/refusal/revocation races, provider changes, prompt-like images, prohibited analysis, isolation checks, privacy UI, and content-leak canary scans; verify zero unapproved dispatch, purpose crossover, prohibited processing, or content leakage while the US2 deletion lifecycle remains unchanged.

### Tests for User Story 4

- [ ] T115 [P] [US4] Add consent API/contract tests for an initially unselected control, exact purpose/provider/model/notice/text/policy versions, refusal/revocation, and unknown-field rejection in `web/tests/backend/contract/ocr-image-search/image-search-consent.contract.test.ts`
- [ ] T116 [P] [US4] Add queue/dispatch race tests proving latest consent wins, revocation prevents future dispatch, provider/version changes invalidate consent, and no silent alternate provider is attempted in `web/tests/backend/integration/image-search/external-consent-races.test.ts`
- [ ] T117 [P] [US4] Add security tests for AES-GCM tampering, locator guessing, CV/search key and context crossover, socket permissions, content-length attacks, and terminal access denial in `web/tests/security/ocr-image-search/storage-and-capability-security.test.ts`
- [ ] T118 [P] [US4] Add prompt-injection and prohibited-analysis tests proving document instructions stay inert and no face/identity/protected-attribute/portrait analysis or tool/network request occurs in `web/tests/security/ocr-image-search/prompt-and-biometric-boundaries.test.ts`
- [ ] T119 [P] [US4] Add canary scans across logs, errors, traces, metrics, audits, URLs, responses, analytics, and browser storage for images, OCR/CV text, proposal values, evidence, prompts, payloads, locators, raw IP/nonces, capabilities, and secrets in `web/tests/security/ocr-image-search/content-leak-canary.test.ts`
- [ ] T120 [P] [US4] Add container inspection tests for no OCR TCP listener/egress/database/storage/credentials and least-privilege worker mounts in `web/tests/security/ocr-image-search/container-isolation.test.ts`
- [ ] T121 [US4] Add E2E privacy journeys for notice/consent/refusal/revocation, cancel/delete, reload memory loss, URL/browser-storage safety, and prompt-like content in `web/tests/system/e2e/ocr-image-search/consent-and-retention.spec.ts`

### Implementation for User Story 4

- [ ] T122 [P] [US4] Implement append-only grant/refuse/revoke consent events and latest-exact-consent queries without content fields in `web/src/backend/repositories/image-search/prisma-search-consent-repository.ts`
- [ ] T123 [US4] Implement consent decisions, version binding, refusal/revocation behavior, and content-free audit evidence in `web/src/backend/services/image-search/update-image-search-consent.ts`
- [ ] T124 [US4] Implement the same-origin, actor-authorized, idempotent consent endpoint in `web/src/app/api/jobs/image-searches/[queryId]/consent/route.ts`
- [ ] T125 [P] [US4] Implement the optional OpenAI text-only interpreter with strict `job-search-intent-v1`, `store=false`, tools/background/reuse disabled, retries zero, deadline, safety identifier, and validated output in `web/src/backend/image-search/interpretation/openai.ts`
- [ ] T126 [US4] Recheck exact current consent and deployment privacy/ZDR/provider/model gates immediately before external dispatch, otherwise select deterministic/manual behavior without silent failover in `web/src/backend/image-search/workers/interpret-stage.ts`
- [ ] T127 [P] [US4] Record allowlisted purpose, actor class, safe target HMAC, outcome, timing, consent, provider/model/engine/policy/schema versions, and deletion outcome in `web/src/backend/repositories/audit/prisma-audit-repository.ts` and `web/src/backend/audit/events.ts`
- [ ] T128 [P] [US4] Add clear internal/external purpose, destination, retention, unselected consent, refusal/revocation, and deletion messaging to the image-search UI in `web/src/frontend/features/jobs/image-search/components/image-search-privacy-notice.tsx` and `web/src/frontend/features/jobs/image-search/components/image-search-consent.tsx`
- [ ] T129 [US4] Harden OCR/worker runtime users, read-only mounts, socket modes, tmpfs limits, dropped capabilities, health checks, and no-egress production policy in `Dockerfile.ocr-engine`, `Dockerfile.image-search-worker`, and `compose.yaml`
- [ ] T130 [US4] Enforce advanced production rejection for unapproved external interpretation, mutable/arbitrary provider configuration, mismatched consent/notice versions, or invalid DPA/privacy/cross-border/ZDR/provider/model approvals in `scripts/check-environment.mjs` and `web/src/backend/image-search/config.ts`

**Checkpoint**: US4 demonstrates purpose separation, exact current consent, safe auditability, prompt inertness, prohibited-analysis enforcement, privacy canaries, and runtime isolation without owning or delaying the core US2 deletion lifecycle.

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Produce release evidence for regression safety, OCR/intent quality, performance, accessibility/usability, supply chain, rollback, and the complete quickstart.

- [ ] T131 [P] Implement Unicode-aware OCR/intent evaluation that rejects manifests below 180 unique fixtures/18,000 words or any language/layout/quality/security/purpose floor and reports zero-text rejections separately in `web/scripts/evaluate-ocr-corpus.mjs`
- [ ] T132 [P] Add at least 180 synthetic/licensed fixtures and 18,000 labeled words satisfying the exact 40-fixture language/layout/quality floors, 30-fixture security floor, 60-CV/60-poster purpose floors, and poster-language/intent distributions in `web/tests/fixtures/ocr-corpus/manifest.json` and `web/tests/fixtures/ocr-corpus/`
- [ ] T133 [P] Add corpus verification for every minimum count/word/distribution floor, 95% overall/90% per-language OCR accuracy, per-cohort reporting, suspicious-PDF recall, DOCX exclusions, security rejection, and 90% supported-intent accuracy in `web/tests/performance/ocr-image-search/corpus-quality.test.ts`
- [ ] T134 [P] Implement warmed/cold image-search interpretation and subsequent deterministic-search measurements over at least 100 warm samples at concurrency four with environment, P50/P95/P99/max/error evidence and the exact six-second OCR deadline in `web/scripts/measure-image-search-performance.mjs`
- [ ] T135 [P] Extend CV performance collection over at least the 60-fixture/6,000-word CV matrix at concurrency two with exact 20-second unit, immutable 180-second aggregate, 120-second 90%, and 180-second 100% gates in `web/scripts/measure-cv-import-performance.mjs` and `web/scripts/collect-cv-import-performance.mjs`
- [ ] T136 Run and preserve focused Feature 003/004 disabled/unavailable regressions plus the full Feature 005 suite through commands defined in `package.json` and `web/package.json`
- [ ] T137 [P] Add cross-browser desktop/320-pixel, keyboard-only, reduced-motion, slow-network, and navigation-cleanup E2E coverage in `web/tests/system/e2e/ocr-image-search/accessibility-and-resilience.spec.ts`
- [ ] T138 [P] Create the anonymized 30-participant protocol with at least 15 desktop and 15 320-pixel participants, first-attempt scoring rubric, consent language, and aggregate evidence template for SC-007 in `docs/testing/feature-005-image-search-usability.md`
- [ ] T139 Execute the approved usability protocol with at least 30 representative participants, at least 15 per viewport cohort, require at least 27 complete first-attempt successes, and store only anonymized aggregate counts/environment/sign-off in `docs/testing/evidence/feature-005-image-search-usability-results.md`
- [ ] T140 [P] Add pinned Python/npm dependency, model checksum/license, image provenance, SBOM, vulnerability, and browser-bundle inspection gates in `scripts/verify-ocr-supply-chain.mjs`
- [ ] T141 Add feature-flag rollout/rollback verification proving admissions and external dispatch stop while cleanup, reconciliation, native CV, and manual search remain active in `web/tests/backend/integration/ocr-image-search/feature-rollout-rollback.test.ts`
- [ ] T142 Perform final release sign-off only after T131-T141 evidence exists: run formatting/lint/typecheck/build/focused suites, verify quickstart evidence links, and close applicable release items in `spec-kit/specs/005-ocr-parsing/checklists/requirements.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 - Setup (T001-T012)**: Starts immediately. T011 follows T001 because both edit package manifests.
- **Phase 2 - Foundational (T013-T038)**: Depends on Phase 1 and blocks all user-story implementation. Tests T013-T021 are written and observed failing before T022-T038. T037 defines abstractions only, so the Foundation checkpoint compiles without story repositories or interpreters.
- **Phase 3 - US1 (T039-T061)**: Starts after Phase 2. It uses the shared OCR interfaces but does not depend on US2.
- **Phase 4 - US2 (T062-T101)**: Starts after Phase 2. Hard-deadline transitions and cleanup/reconciliation T079-T081 structurally precede admission T082-T083; no image bytes may be admitted earlier.
- **Phase 5 - US3 (T102-T114)**: Its failure tests can start after Phase 2; full acceptance requires the relevant US1/US2 happy paths to exist.
- **Phase 6 - US4 (T115-T130)**: Its advanced consent/canary tests can start after Phase 2; external dispatch integrates only after the complete US2 lifecycle exists.
- **Phase 7 - Polish (T131-T142)**: Starts after the selected story implementations; release evidence requires all four stories.

### User Story Dependency Graph

```text
Setup T001-T012
        |
Foundation T013-T038
   |          |
   |          +--------------------+
   v                               v
US1 T039-T061                 US2 T062-T101
   |                               |
   +---------------+---------------+
                   |
          +--------+--------+
          v                 v
   US3 T102-T114      US4 T115-T130
          +--------+--------+
                   v
             Polish T131-T142
```

### Within Each User Story

- Write the story's tests first and verify they fail for the unimplemented behavior.
- Implement strict shared/domain contracts before repositories and services.
- Implement repositories and provider adapters before orchestration and route handlers.
- Keep App Router handlers thin: validate transport/authorization, call services, serialize no-store typed responses.
- Complete server behavior before frontend integration, then run the story's independent E2E checkpoint.
- Do not treat a story as complete while its privacy, authorization, idempotency, accessibility, or fallback assertions fail.

### Critical Ordering Details

- T022 precedes T023; T023 precedes T024 and every Prisma repository task.
- T026-T028 precede T030; T029-T030 precede both T057 and T088.
- T031 precedes T050-T052 and T087; no format-aware image decode may run before persisted clean scan state.
- T033 precedes T034; T034 precedes production preflight T035; storage contract T019 and preflight test T021 must pass before production storage is ready.
- T050-T052 precede T053; T053-T057 precede T058-T061 and the US1 E2E T048.
- T075-T078 precede lifecycle tasks T079-T081. T079-T081 must be implemented, initially reconciled, and healthy before admission T082 or its route T083 can receive a query.
- T086 precedes T087, T087 precedes T088, and T088 precedes T091-T093.
- T089-T091 and repositories T076-T081 precede concrete resource assembly T092; Foundation T037 remains abstraction-only.
- T092 precedes pipeline/runtime T093-T094; Feature 003 search runs only after T095 returns visible validated criteria.
- T122-T126 and T130 precede enabling external interpretation; US4 cannot weaken or replace the US2 cleanup/readiness lifecycle.
- T131-T135 measure only a warmed, correctly pinned implementation after the functional and security tests pass.

---

## Parallel Opportunities

### Setup and Foundation

- T002-T005 and T007-T010/T012 touch separate runtime/config/fixture files and can proceed in parallel; serialize T001 and T011.
- Foundational tests T013-T021 can be authored in parallel.
- After the database contract is fixed, the Python OCR service (T026-T028), TypeScript OCR boundary (T029-T031), storage/preflight work (T033-T035), and request/telemetry abstractions (T036-T038) can proceed as separate workstreams.

### User Story 1

```text
Parallel tests: T039-T047
Parallel implementation start: T049, T050, T051, T052, T055, T060
Join points: T050-T052 -> T053/T055 -> T056/T057 -> T058-T061 -> T048
```

### User Story 2

```text
Parallel tests: T062-T073
Parallel repository/contracts: T075-T078
Parallel provider/UI work after contracts: T086, T089, T090, T097, T099, T100
Join points: T076-T081 -> combined admission readiness -> T082/T083 -> T084-T092 -> T093-T101 -> T074
```

### User Story 3

```text
Parallel tests: T102-T106
Parallel implementation start: T108, T109, T110
Join points: T110 -> T111 -> T112/T113 -> T107
```

### User Story 4

```text
Parallel tests: T115-T120
Parallel implementation start: T122, T125, T127, T128
Join points: T122 -> T123/T124/T126; all advanced privacy controls -> T121
```

### Cross-Story Work

- After Phase 2, separate developers can own US1 and US2 concurrently because they share only stable foundational ports and persistence.
- US3 failure-injection fixtures and US4 security/canary suites can be authored while US1/US2 implementation proceeds, then bound to the completed paths.
- Quality, performance, accessibility, protocol, and supply-chain tasks T131-T138/T140 are largely parallel after functional stability; usability execution T139 follows protocol T138.

---

## Implementation Strategy

### First Technical Checkpoint: Candidate Hybrid OCR

1. Complete Setup and Foundation.
2. Complete US1 tests and implementation.
3. Stop and validate native v1 regression, image-only/mixed PDF, body-image DOCX, review warnings, confirmation atomicity, and standalone-image CV rejection.
4. Treat this as a demonstrable checkpoint, not a production release of Feature 005.

### Second Technical Checkpoint: Deterministic Image Search

1. Complete US2 initially with the local deterministic interpreter.
2. Bring up hard-deadline transitions, cleanup/reconciliation, storage preflight where production applies, and combined admission readiness before enabling admission.
3. Validate visitor/auth quotas, safe image admission, physical deletion by the hard deadline, editable visible criteria, no-silent-overwrite merging, and Feature 003 result parity.
4. Keep external OpenAI interpretation disabled until US4 consent/privacy gates pass.

### Releasable Feature 005 Scope

1. Complete both P1 workflows: US1 and US2.
2. Complete US3 so OCR/AI failure cannot disable native CV import or manual text search and stale results cannot apply.
3. Complete US4 so advanced consent, purpose separation, isolation, audit safety, and canary guarantees hold without changing US2 deletion behavior.
4. Pass the corpus, performance, accessibility/usability, regression, supply-chain, rollout/rollback, and quickstart gates in Phase 7.
5. Enable Candidate OCR gradually, then deterministic image search, and only then optional consented external interpretation as described in `plan.md`.

### Parallel Team Strategy

1. The team completes Setup/Foundation and freezes the contracts.
2. One workstream implements US1; another implements US2.
3. Security/reliability workstreams prepare US3/US4 tests against the frozen contracts and integrate after the happy paths exist.
4. Release evidence is collected only from the integrated all-story build under the documented environment and dataset.

---

## Notes

- `[P]` means different files and no unfinished dependency; it does not waive review of shared contracts or generated files.
- Do not commit real CVs, job posters, user content, model secrets, storage keys, or provider payloads as fixtures or evidence.
- Preserve Feature 003 deterministic retrieval/ranking and Feature 004 PDF/DOCX admission/confirmation as authoritative baselines.
- Keep `cv-segments-v1` for native-sufficient documents; use v2 only for hybrid extraction.
- Search content is processing data, never persistent search history; `deleteBy = admittedAt + 15 minutes` is immutable and cleanup remains active during rollback.
- Every external-dispatch task remains disabled until exact consent and production privacy/ZDR gates are implemented and tested.
- Commit after each task or coherent task group, but never combine unrelated working-tree changes.
