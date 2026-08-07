# Quickstart: Purpose-Specific OCR Parsing

This is the implementation and verification runbook for Feature 005. Commands
assume the repository root and a completed implementation. Use only committed
synthetic/licensed fixtures. Never test with a real person's CV, private job
poster, production object, or copied provider payload.

The default local path uses private filesystem artifacts, self-hosted OCR, and
the approved OpenAI search-intent interpreter. Image search reuses the same
server-only `OPENAI_API_KEY` configured for CV parsing; it has no separate API
key and requires no AWS credential.

## Local Topology

| Process             | Bind/endpoint                 | Access                                                                         |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Next.js web         | `http://localhost:3001`       | Local browser                                                                  |
| PostgreSQL          | `127.0.0.1:55432 -> 5432`     | Loopback host only                                                             |
| ClamAV              | `/run/clamav/clamd.sock`      | CV and image-search workers only                                               |
| OCR engine          | `/run/smarthire-ocr/ocr.sock` | CV and image-search workers only                                               |
| Email worker        | No listener                   | PostgreSQL client                                                              |
| CV worker           | No listener                   | PostgreSQL, CV storage, ClamAV/OCR sockets                                     |
| Image-search worker | No listener                   | PostgreSQL, search storage, ClamAV/OCR sockets, optional approved OpenAI HTTPS |

No ClamAV/OCR TCP port or host port may be published. The web and email
processes must not mount either private socket. `ocr-engine` must have no egress,
database URL, storage mount, ClamAV socket, OpenAI key, or application secret.

Production uses HTTPS ingress and secure cookies as inherited from Features 001
through 004. Local HTTP is not a production transport configuration.

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x` from the repository version files.
- Docker Desktop/Engine with Compose v2.
- At least 8 GiB RAM and 4 dedicated CPU cores available to the warmed CPU OCR
  engine for local qualification; additional resources for PostgreSQL, ClamAV,
  and Node workers.
- Enough disk for the pinned OCR image/model and private gitignored test
  artifacts.

```powershell
node --version
npm --version
docker version
docker compose version
```

On Windows, use `npm.cmd` only if execution policy blocks `npm.ps1`; it runs the
same project script.

## 1. Install and Initialize

Install the existing Node workspaces from the sole root lockfile:

```powershell
npm ci
npm run env:init
```

Python packages are not installed on the host. `Dockerfile.ocr-engine` installs
only hash-locked runtime requirements. `requirements-dev.txt` is used in a
separate test stage. There must be no nested npm lockfile or mutable unpinned pip
install.

`env:init` may create missing local values without overwriting or printing
existing secrets. Expected non-secret local selections:

```text
CV_STORAGE_ADAPTER=filesystem
CV_PARSER_ADAPTER=deterministic
CV_OPENAI_ENABLED=false

OCR_ENGINE_ENABLED=true
OCR_ENGINE_SOCKET_PATH=/run/smarthire-ocr/ocr.sock
OCR_ENGINE_NAME=paddleocr-onnx
OCR_ENGINE_VERSION=<exact service version>
OCR_MODEL_NAME=PP-OCRv6-medium
OCR_MODEL_SHA256=<committed model-manifest digest>
OCR_CV_UNIT_TIMEOUT_SECONDS=20
CV_HYBRID_DEADLINE_SECONDS=180
OCR_SEARCH_TIMEOUT_SECONDS=6

IMAGE_SEARCH_WORKER_ENABLED=true
IMAGE_SEARCH_CLEANUP_ENABLED=true
IMAGE_SEARCH_STORAGE_ADAPTER=filesystem
IMAGE_SEARCH_STORAGE_LOCAL_ROOT=<absolute repo-local web/.local/image-search-storage path>
IMAGE_SEARCH_INTERPRETER=openai
IMAGE_SEARCH_OPENAI_ENABLED=true
OPENAI_API_KEY=<same server-only key used by CV parsing>
```

`env:init` generates separate server-only values for search artifact encryption,
rate-subject HMAC, and visitor-capability HMAC. It must not print them and must
not reuse the CV artifact key. Local roots must resolve inside the intended
gitignored `web/.local/` subtree. Production rejects filesystem storage,
development roots, missing S3/KMS policy, mutable model names/digests, TCP OCR
addresses, external interpretation without every approval, and every
`NEXT_PUBLIC_` secret.

## 2. Build and Verify the OCR Engine

```powershell
docker compose build --pull ocr-engine
docker compose run --rm ocr-engine python -m pytest -q
docker compose run --rm ocr-engine python -m src.verify_manifest
```

Acceptance:

- Python 3.12, PaddleOCR 3.7.0, ONNX Runtime 1.27.0, FastAPI 0.139.2,
  Uvicorn 0.51.0, Pydantic 2.13.4, and test-only Pytest 9.1.1 match hash-locked
  manifests;
- only general OCR dependencies are present—no training, VLM, PP-Structure,
  translation, document-parser, or browser package;
- PP-OCRv6-medium detector/recognizer/orientation files match every committed
  SHA-256 and license entry;
- the image starts and warms with network disabled and never downloads a model;
- root filesystem is read-only, process is non-root, tmpfs and CPU/RSS/PID
  limits are active;
- the engine rejects PDF, DOCX, JPEG originals, URL/path input, wrong purpose,
  stale deadline, wrong manifest, >20 megapixels, >25 MiB PNG, >2,000 lines, or
  > 64 KiB text;
- response strictly matches `contracts/ocr-engine.openapi.yaml`.

Review the generated SBOM and vulnerability report. An unresolved high/critical
finding, missing license, incompatible native wheel, or model-manifest mismatch
blocks the build.

## 3. Start Infrastructure

```powershell
docker compose up -d postgres clamav ocr-engine
docker compose ps
docker compose logs --tail 100 clamav
docker compose logs --tail 100 ocr-engine
```

Logs must contain only safe readiness/version information, never input or OCR
text. Wait for all three services to become healthy. ClamAV health remains
fail-closed with definitions no older than 24 hours; its entrypoint must perform
a synchronous `freshclam` update before `clamd`, then start the update daemon.

After workers start, verify both private boundaries:

```powershell
docker compose exec cv-worker npm run cv:scanner:check
docker compose exec cv-worker npm run ocr:engine:check
docker compose exec image-search-worker npm run image-search:scanner:check
docker compose exec image-search-worker npm run ocr:engine:check
```

Checks fail when a socket is missing, stale, world-accessible, owned by the wrong
group, exposed through TCP, or reports a different model/runtime manifest.

## 4. Apply and Verify the Database

Use a disposable migrated test database for destructive suites.

```powershell
npm run db:migrate
npm run db:validate
npm run db:verify
```

Acceptance:

- all earlier migrations are unchanged;
- the Feature 005 additive migration applies from an empty database and after
  the full Feature 001-004 chain;
- Prisma and database constraints agree for parent-purpose XOR, visitor/account
  ownership XOR, byte/count/confidence bounds, partial unique active work,
  idempotency, one artifact/kind, immutable `deleteBy`, append-only consent/
  admission evidence, and lease pairing;
- no Better Auth model or Feature 003 `JobPosting` search field/index changes;
- no search image, OCR text, evidence excerpt, proposal/filter value,
  capability, raw IP, or browser nonce is represented by a plaintext database
  field;
- no search table has a foreign key to `JobPosting`, Candidate Profile,
  application, or saved job.

## 5. Validate Configuration Gates

```powershell
npm run env:check
npm run ocr:config:check
npm run image-search:config:check
```

Local acceptance requires the exact internal OCR manifest, private roots,
distinct keys, the approved OpenAI interpreter with the shared server key, and
enabled cleanup. Negative production tests must reject:

- local filesystem storage or a root outside the allowlisted subtree;
- shared CV/search encryption key or storage prefix;
- OCR TCP URL, published port, writable root, egress, runtime model download,
  or unexpected model digest;
- disabled cleanup with enabled admission;
- arbitrary/mutable interpreter model/base URL;
- OpenAI mode without exact SDK/model, API key, deployment enable,
  DPA/privacy/cross-border approval, verified ZDR/equivalent flag, notice and
  consent versions;
- any OCR/search secret in a `NEXT_PUBLIC_` variable.

For a production/S3 deployment, run the additional preflight with deployment
credentials that may inspect but not mutate the configured controls:

```powershell
npm run image-search:storage:preflight --workspace @smarthire/web
```

The production storage preflight reads live S3/KMS configuration and the
allowlisted deployment policy in `deploy/image-search-storage-policy.json`. It
must verify all four S3 Block Public Access flags and non-public policy status,
the exact SSE-KMS key and key policy, a worker role limited to the configured
bucket/prefix plus required KMS operations, and an exact one-day expiration for
current/noncurrent search objects plus one-day incomplete-multipart abort. It
writes only content-free
evidence to `web/.local/evidence/image-search-storage-preflight.json`. Missing,
failed, more-than-15-minute-old, or configuration-mismatched evidence keeps image admission
disabled; the lifecycle rule never substitutes for application cleanup.

## 6. Run the Application

```powershell
npm run dev
```

The development supervisor should run Next.js and the email worker, then build/
supervise Compose-backed CV/image-search workers, ClamAV, and OCR engine. A
single `Ctrl+C` should stop child processes and release/requeue durable leases.
Cleanup/reconciliation must remain runnable independently.

For isolated infrastructure debugging:

```powershell
docker compose up --build postgres clamav ocr-engine cv-worker image-search-worker
```

Do not replace private sockets with TCP on Windows/macOS. Workers are Linux
containers and receive container-native paths and database endpoints.

If the OCR engine stops, Next.js, ordinary text search, Profile editing,
native-sufficient CV extraction, email, and PostgreSQL remain available. UI
status may report reduced image capability without stopping the application.

## 7. Candidate CV Walkthrough

Use synthetic PDF/DOCX fixtures from the committed OCR corpus.

### Native regression

1. Sign in as an active Candidate and open `/profile/cv-imports`.
2. Upload a clean native-text PDF and DOCX through the existing Feature 004
   flow.
3. Confirm scan, extraction, parser consent (when selected), draft review, and
   confirmation behavior are unchanged.
4. Verify extraction uses `cv-segments-v1`; no `OcrProcessingAttempt` is
   created/called; the flow still works while `ocr-engine` is unavailable.

### Image-only and mixed PDF

1. Upload a clean image-only Vietnamese PDF. Confirm every page is classified,
   selectively rendered, OCR-accounted, and placed in document order.
2. Upload a mixed bilingual PDF with native and image-only pages. Confirm native
   pages remain native and only eligible pages call OCR.
3. Upload a fixture with an invisible/misleading native layer. Confirm the page
   becomes suspicious, both sources remain attributable, and a material conflict
   is visible in review rather than silently resolved.
4. Inspect the v2 draft. Low/review confidence and approximate evidence use
   text/non-color cues. Candidate can edit/skip proposals.
5. Confirm Profile tables remain byte-for-byte unchanged until a valid existing
   Feature 004 confirmation, then only selected values change atomically.

### DOCX body image

1. Upload a clean DOCX containing native paragraphs plus main-body PNG/JPEG
   text images. Confirm OCR segments appear at exact/nearest body anchors.
2. Use a fixture with header/footer/comment/footnote/unreferenced media/logo/
   portrait/external relation/unsupported image. Confirm excluded regions never
   influence draft content and every unit has a safe accounting outcome.
3. Test exactly 20 eligible images/100 megapixels and one over either bound.
   The boundary succeeds; excess fails the whole extraction with replacement,
   retry, and manual Profile paths—never a partial accepted draft.

At no point may page rasters or DOCX normalized images appear in durable CV
storage, database fields, API responses, URLs, or telemetry. Private temp files
must disappear after success, failure, cancellation, timeout, and worker restart.
Each unit receives at most 20 seconds and no more than two units run at once.
From the first claimed OCR-required manifest, queueing, all units, lease recovery,
and retries share one immutable 180-second hybrid-extraction deadline. A unit
started with less than 20 seconds remaining receives only the remaining time;
expiry stops dispatch and yields an actionable outcome rather than resetting the
deadline.

## 8. Image-Assisted Search Walkthrough

### Visitor

1. Open the site-wide public-job search in a private browser window. Ordinary
   text query and filters must work before, during, and after image processing.
2. Choose image mode and attach one clean static Vietnamese/English/bilingual
   PNG/JPEG <=5,000,000 bytes and <=20 decoded megapixels.
3. Confirm the required OpenAI consent starts unselected and names the
   provider, purpose, and retention boundary. The image picker remains disabled
   until the user agrees for that request.
4. Submit. Browser performs metadata reservation then raw upload without
   placing query capability in URL, cookie, local/session storage, or persisted
   cache.
5. Observe accessible stages: upload, safety scan, image preparation, text
   recognition, interpretation, and result ready. Manual filters remain active;
   cancellation remains available.
6. Consume the result once. Confirm explicit/high-confidence normalized criteria
   are selected only when no non-empty manual scalar conflicts. Inferred/lower-
   confidence proposals are labeled and unselected.
7. Edit/remove/clear one criterion. Confirm `/jobs` contains only visible
   validated criteria; it contains no image, OCR text, evidence, capability, or
   processing ID.
8. Compare with the same manual criteria and confirm identical deterministic
   jobs/order under the same database state.

### Authenticated user

Repeat while signed in. Ownership comes from Better Auth and server CSRF proof;
no visitor capability is returned. Confirm image search creates no saved job,
application, Profile, or alternate browser session.

### AI failure fallback

Inject an interpreter timeout/invalid schema after successful OCR. Consume the
one-time fallback and confirm the client displays only a safe reason and retry
actions. It must discard recognized text immediately and must not populate the
global header query or any Feature 003 filter. The server copy is
inaccessible/deletion-due at consume time and cannot be fetched twice.

## 9. Required Failure Walkthroughs

| Fixture/condition                                                            | Expected behavior                                                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empty, >5,000,000 bytes, mismatched extension/type/length/magic              | Reject safely; no accessible partial artifact.                                                                          |
| Animated PNG, malformed/truncated JPEG, polyglot, >20 MP, decode bomb        | Fail closed after clean scan at bounded decoder; manual search stays usable.                                            |
| EICAR fixture                                                                | `INFECTED`; never decoded/OCRed; immediate logical denial/deletion due.                                                 |
| ClamAV unavailable or definitions >24h                                       | `SCAN_FAILED`; no decode; retry/manual path; no fail-open.                                                              |
| OCR socket down/model mismatch/timeout/oversized or unknown response         | Search gets actionable OCR failure; required CV gets retry/replacement/manual path; native CV/manual search unaffected. |
| OCR output empty or low confidence                                           | No silent intent/draft completeness; labeled review/fallback or actionable failure.                                     |
| AI emits sort/job IDs/private fields/invalid enum/range/unsupported evidence | Entire invalid proposal is discarded; no job authority changes.                                                         |
| AI confidence 0.8999, inferred at 0.99, explicit at 0.90                     | First unselected; inferred unselected; valid evidenced explicit may auto-select.                                        |
| Existing non-empty manual location differs from image                        | Manual value preserved; generated location is unselected conflict.                                                      |
| External consent absent/revoked/version changed before dispatch              | No external request; safe recovery without copying OCR text into search fields.                                         |
| Provider fails and another is configured                                     | No silent alternate provider.                                                                                           |
| Older query completes after new query/manual edit/cancel                     | Late result cannot alter filters, URL, or results.                                                                      |
| Result consume response lost/replayed                                        | Server remains consumed/deleting; no second content delivery; manual search remains.                                    |
| Delete fails temporarily                                                     | Content remains inaccessible; retry before immutable 15-minute deadline; incident evidence contains no locator/content. |
| Fourth visitor query in one hour by IP or browser                            | Reject before storage/scan with exact latest retry time; text search works.                                             |
| Eleventh authenticated query across devices                                  | Reject per account before expensive work; text search works.                                                            |
| Browser nonce reset on same visitor IP                                       | IP subject still enforces visitor cap.                                                                                  |
| Shared IP with distinct browsers                                             | Both required subjects are evaluated and retryAt is maximum applicable expiry.                                          |

## 10. Automated Verification

Baseline:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Focused suites (final script names must match `package.json`):

```powershell
npm run db:verify
npm run test:ocr-engine
npm run test:cv-ocr -- --pool=forks --no-file-parallelism --maxWorkers=1
npm run test:image-search -- --pool=forks --no-file-parallelism --maxWorkers=1
npm run test:ocr-security
npm run test:ocr-contracts
npm run test:ocr-e2e
```

Database suites require a unique disposable PostgreSQL database with matching
`DATABASE_URL` and `DIRECT_URL`. Do not point destructive fixtures at shared
development or production. Stop temporary servers/workers and drop only the
exact database created by the test harness.

Coverage groups:

- public/internal OpenAPI, JSON Schema, and Zod/Pydantic parity;
- Route Handler -> service -> repository boundaries and server-only bundles;
- session/capability ownership, origin/CSRF, idempotency, non-disclosing IDs;
- rolling quotas and concurrent admission;
- encrypted storage context/integrity, search/CV key separation, one artifact
  per kind, stream abort/overflow, orphan reconciliation;
- ClamAV freshness/EICAR/no TCP and no pre-clean decode;
- Sharp format/pixel/frame/metadata behavior;
- PDF page classification/render bounds and DOCX relationship/body exclusions;
- OCR UDS permissions/no egress/model readiness/schema/time/output limits;
- unit accounting, confidence, conflict, dedup, v1/v2 parser/draft behavior;
- interpreter evidence/selection/manual merge and Feature 003 result equivalence;
- consent and external deployment/provider failure gates;
- lease recovery, duplicate worker, stale result, cancellation, one-time consume;
- fake-clock hard deletion and content/secret/capability canaries;
- keyboard/focus/live-region/contrast/reduced-motion and 320-pixel E2E.

## 11. OCR Corpus and Accuracy Gate

Run the committed corpus evaluator:

```powershell
npm run ocr:corpus:evaluate
```

The corpus manifest fixes fixture license/source class, purpose, language group,
quality/layout/rotation/perspective class, expected text or intent, and exclusion
label. It contains synthetic/licensed data only and no production personal data.
Before scoring, validate at least 180 unique fixtures and 18,000 labeled words
with these non-negotiable floors:

| Cohort            | Fixtures | Words | Distribution                                                                                                 |
| ----------------- | -------: | ----: | ------------------------------------------------------------------------------------------------------------ |
| Vietnamese        |       40 | 4,000 | Both CVs and posters.                                                                                        |
| English           |       40 | 4,000 | Both CVs and posters.                                                                                        |
| Bilingual         |       40 | 4,000 | Mixed lines and technical terms.                                                                             |
| Layout variation  |       40 | 4,000 | At least 10 each: CV, poster, form/table, multi-column screenshot.                                           |
| Quality variation |       40 | 4,000 | At least 10 each: low-res, skew/perspective, noisy/compressed, low-contrast/blurred.                         |
| Security/edge     |       30 | 1,000 | At least 5 each: malicious, malformed, polyglot/animated, decompression-limit, prompt-like, excluded-region. |

The matrix also requires at least 60 CV fixtures/6,000 words and 60 poster
fixtures/6,000 words. Posters include at least 20 Vietnamese, 20 English, and 20
bilingual fixtures and cover every supported intent field plus negative and
confidence-boundary labels. Zero-text rejected fixtures do not enter word
accuracy; the text-bearing security subset still supplies 1,000 words.

OCR scoring applies NFKC and whitespace normalization for comparison but does
not strip Vietnamese diacritics from expected/actual output. Evidence must show:

- > =95% word accuracy overall;
- > =90% word accuracy independently for Vietnamese, English, and bilingual;
- every deliberate misleading/hidden native PDF fixture classified suspicious;
- no excluded DOCX non-body image affects a draft;
- every unit accounted.

Intent scoring requires at least 90% of representative posters to match the
human-labeled supported field/value intent, with zero unsupported/job-ID/ranking
criterion affecting search. Every confidence-boundary fixture must obey exact
selection rules.

A failing subgroup blocks release; do not hide it in an overall average or
change ground truth after viewing results.

## 12. Retention Verification With a Fake Clock

Never wait 15 real minutes in tests.

1. Admit a query at fixed `T0`; verify every artifact receives immutable
   `deleteBy=T0+15m`.
2. Exercise success, fallback, validation failure, infection, scan/decode/OCR/AI
   failure, cancellation, abandoned upload, expiry, and lost consume response.
3. Verify logical access denial in the terminal/consume transaction.
4. Run cleanup stages independently; inject object delete failure and expired
   cleanup lease; ensure retries do not move `deleteBy`.
5. Return `ALREADY_ABSENT`; ensure deletion/scrubbing finalizes once.
6. Seed a known database/object/temp orphan; ensure immediate cleanup without a
   locator in output.
7. Advance to `T0+15m`; prove physical storage absence and scrubbed envelope/
   locator for every server copy.
8. Advance admission events to 65 minutes; prove quota evidence deletion.
9. Verify a late worker cannot attach content at or after the deadline.

Browser tests verify fallback/provenance exists only in current React memory and
is gone after reload, navigation, cancel, newer query, or component teardown.

## 13. Performance Evidence

Warm the exact model first and report cold startup separately:

```powershell
npm run perf:image-search -- --self-test
npm run perf:image-search -- --input .local/image-search-performance-input.json
npm run perf:cv-import:collect --workspace @smarthire/web
npm run perf:cv-import --workspace @smarthire/web -- --input .local/cv-import-performance-input.json
```

`--self-test` may validate the harness but is ineligible for release evidence.
The release profile documents at least:

- 4 dedicated CPU cores/8 GiB for OCR, 2 cores/1 GiB per Node worker;
- local PostgreSQL and fresh ClamAV;
- 100 warm search samples at concurrency 4;
- representative PNG/JPEG sizes, language/quality groups, and approved OpenAI
  interpreter success/failure conditions;
- at least the 60-fixture/6,000-word CV matrix at concurrency 2, with a
  20-second per-unit deadline and immutable 180-second aggregate deadline;
- model/container digests, dataset/sample size, duration, percentile method,
  P50/P95/P99/max/error rate, RSS/CPU ceilings, and cold/warm state.

Acceptance:

- > =95% of accepted search requests produce validated intent, manual fallback,
  > or actionable terminal outcome within 10 seconds;
- > =95% of subsequent deterministic searches produce their state within a
  > further 2 seconds;
- > =90% of representative CV fixtures are review-ready/actionable within 120
  > seconds and 100% within 180 seconds;
- deletion correctness remains 100%; latency percentiles cannot excuse missed
  hard privacy/security boundaries.

## 14. Optional OpenAI Search-Intent Smoke Test

Disabled by default. Use only hardcoded synthetic OCR text in an approved
non-production project after DPA/privacy/cross-border/ZDR-equivalent review.
Inject secrets through the process environment/secret manager; never commit or
print them.

Expected adapter:

```text
openai SDK: 7.3.0
model: gpt-5.4-mini-2026-03-17
purpose: job-image-search-purpose-v1
instruction: job-search-intent-v2
schema: job-search-intent-v1
selection policy: search-intent-selection-v2
store: false
background/tools/file/image/conversation reuse: disabled
SDK retries: 0
```

Run only when the dedicated synthetic gate is set:

```powershell
npm run test:image-search:openai-synthetic
```

Test grant, no grant, revocation immediately before dispatch, provider/model/
notice mismatch, timeout, refusal, invalid/unknown/oversized output, job-ID/sort
injection, exact evidence excerpt resolution (including Vietnamese Unicode),
uncertain occupation confirmation, provider request ID HMAC handling, and
one-time OCR fallback without query or filter prefill.
No prompt, input, output, token content, or provider body may appear in test
output.

## 15. Accessibility and Usability Evidence

Automated accessibility is necessary but not sufficient. Run the complete image
search task with at least 30 representative participants, at least 15 desktop
and 15 at a 320-pixel viewport, using Vietnamese/English/bilingual fixtures.
Measure whether participants can attach an image, understand progress and
consent, identify generated vs suggested criteria, edit/remove one, and explain
why results changed on their first attempt without assistance. At least 90%
must succeed: for the minimum 30-person run, at least 27 participants overall
must complete every scored action on their first attempt. Store only anonymized
aggregate counts, cohort totals, failure categories, environment details, and
the signed-off outcome in
`docs/testing/evidence/feature-005-image-search-usability-results.md`; do not
store participant names, contact data, raw recordings, or free-form personal
responses.

Keyboard-only checks include image-mode activation, file selection label,
cancel, progress announcements without focus theft, proposal selection/edit/
remove/clear, error summary, fallback editor, and return to ordinary search.
Color is never the only confidence/conflict/state cue.

## 16. Safe Rollback and Troubleshooting

Rollback order:

1. disable new external interpretation dispatch;
2. disable new image-search admission and Candidate OCR selection;
3. keep ordinary search, native CV extraction, and manual Profile editing on;
4. keep search/CV cleanup, expiry, and reconciliation running;
5. confirm all search artifacts physically absent and no retained CV raster temp;
6. stop the OCR/image worker only after no due work/content remains.

Safe troubleshooting uses only stage, lease age, version, safe failure code,
resource count, due count, and aggregate timing:

- scanner failure: inspect socket health and signature freshness; never disable
  `FailIfCvdOlderThan 1`, enable TCP, or skip the scan;
- OCR failure: inspect readiness/model manifest/socket permissions/resource
  ceilings using a synthetic fixture; never dump normalized pixels or text;
- CV conflict/low confidence: reproduce with corpus fixture and policy versions,
  not a Candidate document;
- interpretation failure: inspect consent/config/schema/safe provider code, not
  OCR text/prompt/response;
- cleanup lag: inspect due/lease/failure counts without bulk-selecting locators;
- visitor authorization: inspect safe result and key version, never capability,
  browser nonce, or raw IP.

Do not add temporary content logging, provider replay, public object access,
longer retention, lower ClamAV freshness, or a TCP OCR endpoint to diagnose an
issue.
