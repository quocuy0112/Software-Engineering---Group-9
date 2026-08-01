# Quickstart: CV Upload, Parse, and Review

This is the implementation and verification runbook for Feature 004. Commands
assume the repository root and the completed Feature 004 implementation. The
default local path uses private filesystem storage and the deterministic parser,
so no AWS or OpenAI credential is required.

## Local Topology and Ports

| Process        | Bind/port                             | Exposure                                         |
| -------------- | ------------------------------------- | ------------------------------------------------ |
| Next.js web    | `http://localhost:3001`               | Local browser                                    |
| PostgreSQL     | `127.0.0.1:55432` -> container `5432` | Loopback only                                    |
| ClamAV `clamd` | `127.0.0.1:3310` -> container `3310`  | Loopback only                                    |
| Email worker   | No listening port                     | PostgreSQL client                                |
| CV worker      | No listening port                     | PostgreSQL, storage, and private `clamd` clients |

Do not expose `3310` publicly. A production `clamd` endpoint belongs only on the
private service network. If any configured port is already in use, change the
documented local environment value rather than killing an unrelated process.

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x` (root `.nvmrc`, `.node-version`, and
  `packageManager` are authoritative).
- Docker Desktop/Engine with Compose v2.
- At least 4 GiB available to the ClamAV container during signature load and
  scanning.
- A local PostgreSQL port and ClamAV port not already occupied.

Check versions:

```powershell
node --version
npm --version
docker version
docker compose version
```

On Windows PowerShell, `npm run ...` is the normal command. If local execution
policy blocks the `npm.ps1` shim, use the equivalent `npm.cmd run ...`; this does
not change the project or script being executed.

## 1. Bootstrap a Reproducible Local Environment

Install only from the root lockfile:

```powershell
npm ci
npm run env:init
```

`env:init` must create missing local values without overwriting existing secrets
and must generate a valid server-only `CV_ARTIFACT_KEY_V1` without printing it.
The expected non-secret local choices are:

```text
CV_STORAGE_ADAPTER=filesystem
CV_STORAGE_LOCAL_ROOT=<absolute repo-local gitignored web/.local/cv-storage path>
CV_CLAMD_HOST=127.0.0.1
CV_CLAMD_PORT=3310
CV_CLAMD_SIGNATURE_MAX_AGE_HOURS=24
CV_PARSER_ADAPTER=deterministic
CV_OPENAI_ENABLED=false
```

The local storage root must be absolute after configuration resolution, must
remain inside the intended `web/.local/` directory, and must be gitignored.
Production startup rejects this adapter and root.

## 2. Start PostgreSQL and ClamAV

After Feature 004 extends `compose.yaml`, start only required infrastructure:

```powershell
docker compose up -d postgres clamav
docker compose ps
```

Wait for both services to report healthy. ClamAV's first signature download can
take longer than PostgreSQL startup. Inspect safe infrastructure logs only when
needed:

```powershell
docker compose logs --tail 100 clamav
docker compose logs --tail 100 postgres
```

The ClamAV service must use the official `clamav/clamav:1.4_base` image pinned
to the implementation-reviewed digest, a persistent signature volume,
`StreamMaxLength` of 6 MiB, and loopback binding. Do not log or paste CV content
while troubleshooting.

Verify expected port owners without altering them:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3001, 3310, 55432 } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

On macOS/Linux, the equivalent read-only check is `lsof -nP -iTCP -sTCP:LISTEN`.

## 3. Apply and Verify the Database

```powershell
npm run db:migrate
npm run db:validate
npm run db:verify
```

Acceptance evidence:

- migrations `001` through `007` are unchanged;
- `008_cv_upload_parse_review` applies from an empty database and after the full
  existing chain;
- partial unique indexes, JSON byte checks, append-only triggers, retention
  indexes, and state invariants exist;
- Prisma client is generated and there is no drift;
- no Better Auth-owned column/model changed;
- no CV source/extracted text is represented as a database text/JSON field.

## 4. Validate Environment Gates

```powershell
npm run env:check
```

Local acceptance:

- filesystem storage and deterministic parser are accepted;
- missing `OPENAI_API_KEY` is accepted because external parsing is disabled;
- encryption key length/version, storage root, scanner endpoint, fixed caps,
  and local ports are validated without printing secret values.

Production-mode negative checks must reject:

- filesystem storage or deterministic parser;
- public/non-private storage configuration;
- missing S3 bucket/region/KMS configuration;
- an unapproved or mutable OpenAI model value;
- external parsing without API key, deployment enable flag, exact provider
  versions, privacy/DPA/cross-border approval, and verified ZDR/equivalent flag;
- any CV secret exposed through a `NEXT_PUBLIC_` name.

## 5. Run the Application

```powershell
npm run dev
```

The root development supervisor must start and supervise:

1. Next.js at `http://localhost:3001`;
2. the existing email worker;
3. the new CV worker with scan, extraction, parse, cleanup, and reconciliation
   loops.

Press `Ctrl+C` once to stop the supervisor. It must forward shutdown to all
children on Windows, macOS, and Linux and leave any interrupted durable lease
recoverable. A stopped worker must not leave the browser permanently pending;
after restart, expired leases are reclaimed.

## 6. Happy-Path Walkthrough

Use only a synthetic or purpose-built test CV. Do not upload a real person's CV
to a shared test environment.

1. Sign in with an active candidate and open
   `http://localhost:3001/profile/cv-imports`.
   Confirm the versioned CV-processing privacy notice is visible even for the
   internal parser; its external parser option additionally requires an
   unselected explicit consent control before dispatch.
2. Choose a clean PDF or DOCX fixture between 1 byte and 5 MiB. The default local
   parser needs no consent because it is deterministic and non-networked.
3. Submit once. Confirm the UI performs reservation then raw upload without a
   second user action.
4. Observe persistent, announced stages: validation, scan, extraction, parsing,
   and review ready. Reload during processing; the server state must recover.
5. Open review. Confirm current Profile data is live, each proposal shows its
   provenance/confidence availability, and duplicate hints do not auto-select.
6. Edit proposals and select scalar fields individually, structured entries as
   whole entries, and skills individually. Save the complete review.
7. Open the same draft in a second tab. Save tab A, then save tab B. Tab B must
   receive `DRAFT_REVISION_CONFLICT`, preserve unsaved values in memory, and
   offer compare/reload.
8. Change the Profile in its normal editor and attempt confirmation from the
   old review. The operation must return `PROFILE_REVISION_CONFLICT` without a
   partial Profile write.
9. Re-review, save, and confirm. Verify one Profile revision increment, exactly
   the selected changes, an immutable non-content receipt, and immediate denial
   of draft/source access.
10. Replay the same confirmation key and body; receive the same receipt. Reuse
    the key for a different revision/manifest; receive an idempotency conflict.

At no point should browser devtools show source bytes, complete extracted text,
storage locators, digests, prompt/response content, or tokens in JSON, URLs,
local/session storage, persisted query cache, or service-worker cache.

## 7. Required Failure Walkthroughs

| Fixture/condition                                                                                         | Expected terminal or recovery behavior                                                           |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Empty, >5 MiB, wrong extension/type, mismatched length                                                    | Request rejected safely; no accessible partial artifact                                          |
| Content magic/structure disagrees with declaration                                                        | `VALIDATION_FAILED`; replace/manual/delete actions                                               |
| EICAR test file                                                                                           | `INFECTED`; never extracted/parsed; cleanup due within 24 hours                                  |
| `clamd` unavailable or definitions >24h                                                                   | Fail closed; bounded retries, then `SCAN_FAILED` with retry/manual path                          |
| Password/encrypted/active PDF or >20 pages                                                                | `EXTRACTION_FAILED`; explicit safe reason/action                                                 |
| DOCX traversal, duplicate entry, macro/OLE/ActiveX, external relation, >1,000 entries or >25 MiB expanded | `EXTRACTION_FAILED`; no Mammoth execution before checks pass                                     |
| Image-only/empty extraction                                                                               | `EXTRACTION_FAILED`; manual Profile entry offered; no OCR                                        |
| Extractor >15s or >192 MiB                                                                                | Child terminated; partial output destroyed; worker survives                                      |
| Parser unknown field, invalid date/URL, excessive array, unknown segment, >256/128 KiB                    | Whole result rejected; no truncated/partial draft                                                |
| Parser times out/fails all automatic attempts                                                             | `PARSE_FAILED`; up to two candidate retries, replacement, and manual entry immediately available |
| Candidate retry cap exhausted                                                                             | Stable terminal state with replacement/manual/delete; no hidden admin wait                       |
| Delete during processing                                                                                  | Logical denial and cancellation commit immediately; later provider result is discarded           |
| Expiry during review                                                                                      | Non-disclosing not-found/expired behavior; no confirmation                                       |

EICAR is used only through the curated test fixture and private local scanner;
never send it to an unrelated service or commit generated private artifacts.

## 8. Automated Verification

Run the baseline gate:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Run database and Feature 004 suites (paths shown are the planned test layout):

```powershell
npm run db:verify
npm run test --workspace @smarthire/web -- --run tests/backend/unit/cv-import
npm run test --workspace @smarthire/web -- --run tests/backend/contract/cv-import
npm run test --workspace @smarthire/web -- --run tests/backend/integration/cv-import
npm run test --workspace @smarthire/web -- --run tests/architecture/cv-import-boundaries.test.ts
npm run test:e2e --workspace @smarthire/web -- cv-import
```

Required coverage groups:

- API/OpenAPI and shared Zod parity, strict unknown-field rejection, `no-store`,
  session ownership, origin/CSRF/Fetch Metadata, and non-disclosing IDs;
- byte-stream abort/overflow/idempotency, AES-GCM tamper detection, filesystem
  and S3 adapter contracts, SHA-256 verification at scan/extraction boundaries,
  source-plus-extraction headroom, and quota concurrency;
- ClamAV readiness/freshness/timeout/EICAR and no host-path scanning;
- PDF/DOCX malicious corpus plus child-process memory/time bounds;
- deterministic Vietnamese/English parser fixtures and strict JSON Schema;
- lease expiry, duplicate worker, automatic/candidate retry caps, and one active
  parse per account;
- consent grant/version/revocation races and external dispatch gating;
- two draft writers, draft save/confirm race, Profile save/confirm race,
  idempotent confirmation, one revision, and transaction rollback;
- fake-clock 24-hour/30-day/7-day deletion, already-missing object, cleanup
  failure/retry, quota release, and orphan reconciliation;
- log/audit/metric canaries proving no PII/CV/token/locator content;
- keyboard/focus/live-region/contrast/reduced-motion behavior and 320-pixel E2E.

## 9. Dependency and Supply-Chain Gate

```powershell
npm ci
npm audit --json
npm run typecheck
npm run build
```

Confirm the sole root `package-lock.json` pins the reviewed server-only packages
and that there is no nested lockfile. Record review evidence for licenses,
Node/TypeScript compatibility, production server-only bundling, the resolved
ClamAV OCI digest, container vulnerabilities, PDF/DOCX representative fixtures,
and EICAR protocol behavior. Any unreviewed high/critical audit or image finding
blocks implementation acceptance and triggers dependency/provider substitution
through the documented interfaces.

## 10. Optional S3 Adapter Contract

Use a disposable private non-production bucket with no real CV content. Configure
role-based credentials and these server-only values outside committed files:

```text
CV_STORAGE_ADAPTER=s3
CV_S3_BUCKET=<disposable-private-bucket>
CV_S3_REGION=<region>
CV_S3_KMS_KEY_ID=<test-kms-key>
```

Verify Block Public Access, required SSE-KMS headers, random keys, no public URL,
non-versioned deletion, `ALREADY_ABSENT` idempotency, 31-day maximum expiration,
one-day incomplete-multipart abort, and inventory reconciliation. Destroy test
objects through the adapter/cleanup path so quota and deletion evidence remain
consistent; infrastructure teardown follows the owning environment's policy.

## 11. Optional External Parser Smoke Test

This test is off by default and must use synthetic segments only. Run it solely
in an approved non-production OpenAI project after verifying the exact model,
DPA/privacy/cross-border decision, and ZDR/equivalent deployment control. Set
secrets in the process environment or approved secret manager, never in a
committed file or command transcript.

Expected adapter behavior:

- `openai@7.3.0`, Responses API, `gpt-5.4-mini-2026-03-17`;
- strict `cv-draft-v1` Structured Output and `cv-extract-v1` instruction;
- `reasoning.effort=none`, `store=false`, no background, tools, file upload,
  conversation, or response reuse;
- SDK retries zero; SmartHire owns the visible attempt history and deadlines;
- a purpose-separated HMAC safety identifier, never the raw account ID;
- no request/response/token content in test output or logs.

Test grant, revocation before dispatch, revoked retry, provider/model/notice
version mismatch, timeout, invalid output, and the manual recovery route. Do not
enable automatic cross-provider fallback.

## 12. Retention Verification With a Fake Clock

Never wait real days in tests. Seed artifacts/drafts with an injected fake clock:

1. Advance rejected/infected/incomplete content to its 24-hour deadline.
2. Advance unconfirmed imports to 30 days from upload.
3. Confirm an import and advance to seven days.
4. Run logical expiry, physical deletion, database scrubbing, quota release, and
   reconciliation loops independently.
5. Inject provider failure and expired deletion leases; prove safe retry.
6. Return `ALREADY_ABSENT`; prove deletion and quota decrement occur once.
7. Seed a known orphan; prove it is scheduled/deleted without its locator
   appearing in telemetry.

Acceptance requires inaccessible content at the logical deadline and idempotent
physical/database purge by the relevant maximum deadline.

## 13. Performance Evidence

Use synthetic clean documents at representative sizes and controlled scanner/
parser latency. Capture safe aggregate metrics only.

- p95 upload finalization/actionable validation response <=5 seconds after the
  last byte;
- at least 90% review-ready or actionable terminal within 60 seconds and all
  within 3 minutes under documented provider conditions;
- p95 review load <=3 seconds;
- p95 draft save and confirmation feedback <=2 seconds;
- cleanup succeeds without manual intervention for at least 99% of the measured
  workload.

Evidence must state dataset size, file-size/format mix, machine/container
resources, concurrency, parser mode, warmed/cold state, and percentile method.
Reports contain only synthetic IDs, timings, byte buckets, and safe result codes.

## 14. Safe Troubleshooting

- `AWAITING_CONTENT`: check reservation expiry and client request headers, not
  the file body.
- `SCAN_FAILED`: check private reachability, ClamAV health/version, and signature
  age. Never bypass fail-closed scanning.
- `EXTRACTION_FAILED`: use safe failure code and synthetic reproduction; do not
  dump the candidate document or extracted strings.
- `PARSE_FAILED`: check deployment gate, safe provider status/code, attempt
  count, and consent binding. Candidate can retry or use manual Profile entry.
- cleanup lag: inspect due counts, lease age, storage readiness, and safe result
  counts. Never query/log object locators as a bulk troubleshooting step.
- concurrent-review conflict: preserve unsaved browser state and compare with a
  fresh no-store response; do not force last-write-wins.

If new upload/parser dispatch must be disabled, keep the CV cleanup worker
running until every retained artifact and payload is reconciled.
