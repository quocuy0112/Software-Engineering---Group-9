# Quickstart: CV Upload, Parse, and Review

This is the implementation and verification runbook for Feature 004. Commands
assume the repository root and the completed Feature 004 implementation. The
default local path uses private filesystem storage and the deterministic parser,
so no AWS or OpenAI credential is required.

## Local Topology and Ports

| Process        | Bind/endpoint                         | Exposure                                        |
| -------------- | ------------------------------------- | ----------------------------------------------- |
| Next.js web    | `http://localhost:3001`               | Local browser                                   |
| PostgreSQL     | `127.0.0.1:55432` -> container `5432` | Loopback only                                   |
| ClamAV `clamd` | `/run/clamav/clamd.sock`              | Shared only with the co-located CV worker       |
| Email worker   | No listening port                     | PostgreSQL client                               |
| CV worker      | No listening port                     | PostgreSQL, storage, and private `clamd` client |

Only host ports `3001` and loopback-only `55432` are permitted for this local
stack. ClamAV must not publish either a host or container TCP port.

ClamAV publishes no host/container TCP port and has `TCPSocket`/`TCPAddr`
disabled. Local Compose shares a dedicated Unix-socket runtime volume only
between `clamd` and the containerized CV worker; production uses the same-pod/
host sidecar pattern. A dedicated shared numeric group owns the socket with mode
`0660`; web and email services do not mount it. If a configured web/database
port is already in use, change the
documented local environment value rather than killing an unrelated process.

Local `http://localhost:3001` is not the production transport model. Production
must pass the inherited HTTPS gate for trusted ingress/proxy TLS termination,
HTTP-to-HTTPS redirect, approved HSTS, and secure-cookie/origin preservation.
The external parser uses only the reviewed allowlisted HTTPS provider endpoint;
custom base URLs and non-HTTPS destinations fail configuration validation.
Feature 004 P0 exposes no route that previews, retrieves, or downloads the
original CV.

## Prerequisites

- Node.js `24.18.x` and npm `11.16.x` (root `.nvmrc`, `.node-version`, and
  `packageManager` are authoritative).
- Docker Desktop/Engine with Compose v2.
- At least 4 GiB available to the ClamAV container during signature load and
  scanning.
- A local PostgreSQL port not already occupied; ClamAV requires no TCP port.

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
CV_CLAMD_SOCKET_PATH=/run/clamav/clamd.sock
CV_CLAMD_SIGNATURE_MAX_AGE_HOURS=24
CV_PARSER_ADAPTER=deterministic
CV_OPENAI_ENABLED=false
CV_OPENAI_LOCAL_DEV_ENABLED=false
```

The local storage root must be absolute after configuration resolution, must
remain inside the intended `web/.local/` directory, and must be gitignored.
Production startup rejects this adapter and root. Compose bind-mounts that host
directory to `/app/.local/cv-storage` and overrides the worker's
`CV_STORAGE_LOCAL_ROOT` plus database endpoint to container-native paths; it
must not pass a Windows/macOS host path into the Linux worker.

To exercise the reviewed OpenAI adapter from the interactive local application,
use only a synthetic test CV and set the following matching non-secret values in
the root `.env` and `web/.env.local`. Keep the key only in the gitignored
`web/.env.local` or an approved secret manager:

```text
CV_PARSER_ADAPTER=openai
CV_OPENAI_ENABLED=true
CV_OPENAI_LOCAL_DEV_ENABLED=true
OPENAI_API_KEY=<server-only project key>
```

This local gate does not assert production DPA, cross-border, or ZDR approval.
External parsing still stops at `AWAITING_CONSENT` and cannot dispatch until the
candidate grants the exact per-upload consent. Production rejects the local gate
and continues to require every reviewed privacy assertion. In this explicit
local OpenAI mode, the upload page shows both ready choices: SmartHire
deterministic remains local/non-networked, while External OpenAI follows the
consent gate. The selected parser is stored per upload; changing the next
upload's choice does not alter earlier imports.

## 2. Start PostgreSQL and ClamAV

After Feature 004 extends `compose.yaml`, start the database and scanner
sidecar; the development supervisor starts the Compose-backed CV worker later:

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
to the implementation-reviewed digest, a persistent signature volume, a
dedicated runtime socket volume with stale-socket cleanup, `0660` group-only
permissions, `StreamMaxLength` of 6 MiB, and no TCP listener. Do not log or paste
CV content while troubleshooting.

Verify expected port owners without altering them:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3001, 55432 } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

On macOS/Linux, the equivalent read-only check is `lsof -nP -iTCP -sTCP:LISTEN`.
After the CV worker starts, run:

```powershell
docker compose exec cv-worker npm run cv:scanner:check
```

The check must confirm `/run/clamav/clamd.sock`, expected owner/group, mode
`0660`, fresh signatures, and readiness. It must also fail on a stale or
world-accessible socket, or if a scanner TCP listener/published port is configured.

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
- explicit local OpenAI mode is accepted only with the local-development gate,
  enabled adapter, server-only key, and matching root/web settings;
- missing `OPENAI_API_KEY` is accepted because external parsing is disabled;
- encryption key length/version, storage root, scanner socket, fixed caps,
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
3. the new containerized CV worker with pre-scan validation/scan, extraction,
   parse, cleanup, and reconciliation loops, sharing only the Unix-socket volume
   with `clamd` and the configured encrypted artifact mount with the web process.

Press `Ctrl+C` once to stop the supervisor. It must forward shutdown to all
children on Windows, macOS, and Linux and leave any interrupted durable lease
recoverable. A stopped worker must not leave the browser permanently pending;
after restart, expired leases are reclaimed.

For isolated debugging, `docker compose up --build postgres clamav cv-worker`
is the supported CV-worker command. Do not run the worker directly on a Windows
or macOS host and replace the Unix socket with TCP. Compose supplies the Linux
storage bind mount, container-native database URL, shared numeric socket group,
and `/run/clamav/clamd.sock`. In production, supervise the worker beside `clamd`
in the same host/pod and preserve graceful lease recovery.

## 6. Happy-Path Walkthrough

Use only a synthetic or purpose-built test CV. Do not upload a real person's CV
to a shared test environment.

1. Sign in with an active candidate and open
   `http://localhost:3001/profile/cv-imports`.
   Confirm the versioned CV-processing privacy notice is visible even for the
   internal parser; its external parser option additionally requires an
   unselected explicit consent control before dispatch.
2. Choose a clean PDF or DOCX fixture between 1 and 5,000,000 bytes (decimal
   5 MB). The default local parser needs no external-transmission consent because
   it is deterministic and non-networked.
3. Submit once. Confirm the UI performs reservation then raw upload without a
   second user action.
4. Observe persistent, announced stages: validation, scan, extraction, parsing,
   and review ready. For OpenAI, verify the UI separately identifies waiting for
   consent, request queued, API request in progress, success, and safe failure.
   A status-refresh failure must say background processing may continue and
   retry automatically. Reload during processing; the server state must recover.
5. Open review. Confirm current Profile data is live, each proposal shows its
   provenance/confidence availability, and duplicate hints do not auto-select.
6. Edit proposals and select scalar fields individually, structured entries as
   whole entries, and skills individually. For a scalar with no current Profile
   value, confirm only Add and Skip are offered; for a populated scalar, confirm
   only Replace and Skip are offered. Save the complete review.
   - Before the valid save, enter one invalid date/URL or required value. Confirm
     no PATCH is sent for locally detectable invalid input, edits remain on the
     page, a brief error toast and persistent summary appear, and the exact
     control receives a text error, red invalid treatment, `aria-invalid`, and
     focus.
   - Correct that control and confirm only its field error clears. A controlled
     server-side `ACTION_MISMATCH` or duplicate proposed skill/social link must
     produce the same field-addressable behavior from the API `fieldErrors`
     response without losing edits.
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

| Fixture/condition                                                                                         | Expected terminal or recovery behavior                                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Empty, >5,000,000 bytes, wrong extension/type, mismatched length                                          | Request rejected safely; no accessible partial artifact                                                         |
| Bounded leading magic disagrees with declaration                                                          | `VALIDATION_FAILED`; never scanned/extracted; replace/manual/delete actions                                     |
| EICAR test file                                                                                           | `INFECTED`; never extracted/parsed; cleanup due within 24 hours                                                 |
| `clamd` unavailable or definitions >24h                                                                   | Fail closed; bounded retries, then `SCAN_FAILED` with retry/manual path                                         |
| Post-clean structure mismatch, password/encrypted/active PDF, or >20 pages                                | `EXTRACTION_FAILED`; explicit safe reason/action; no deep parser ran before `CLEAN`                             |
| DOCX traversal, duplicate entry, macro/OLE/ActiveX, external relation, >1,000 entries or >25 MiB expanded | `EXTRACTION_FAILED`; no Mammoth execution before checks pass                                                    |
| Image-only/empty extraction                                                                               | `EXTRACTION_FAILED`; manual Profile entry offered; no OCR                                                       |
| Extractor >15s or >192 MiB                                                                                | Child terminated; partial output destroyed; worker survives                                                     |
| Parser unknown field, invalid date/URL, excessive array, unknown segment, >256/128 KiB                    | Whole result rejected; no truncated/partial draft                                                               |
| Review scalar `ADD` for populated Profile field or `REPLACE` for empty field                             | Save rejected with exact decision-path `ACTION_MISMATCH`; edits retained and valid choices shown                |
| Invalid review value or duplicate normalized proposed skill/social link                                  | Exact field highlighted with text/ARIA error, first invalid focused, persistent summary plus brief toast        |
| Parser times out/fails all automatic attempts                                                             | `PARSE_FAILED`; up to two candidate retries, replacement, and manual entry immediately available                |
| Candidate retry cap exhausted                                                                             | Stable terminal state with replacement/manual/delete; no hidden admin wait                                      |
| Delete during processing                                                                                  | `CANCELLED` and inaccessible immediately; later result discarded; all content purged within 24h, then `DELETED` |
| Expiry during review                                                                                      | Non-disclosing not-found/expired behavior; no confirmation                                                      |

Retries are durable, capped, candidate-visible work records. There is no P0
admin dead-letter queue, hidden admin retry, or admin-only resume dependency.
When automatic and candidate retry caps are exhausted, keep the stable safe
failure outcome and offer replacement, deletion, and the normal manual Profile
editor.

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

Run database and Feature 004 suites from the repository root. Controlled-clock
tests require UTC and database tests require a unique disposable PostgreSQL
database with both `DATABASE_URL` and `DIRECT_URL` overridden:

```powershell
npm run db:verify
$env:TZ = "UTC"
npm run test:cv-import -- --pool=forks --no-file-parallelism --maxWorkers=1
npm run test:cv-import:e2e
```

Do not point destructive fixture setup at the shared development database. Apply
migrations from `web/` to the disposable database before the suite, stop any
temporary Next/worker process afterward, and drop only the exact temporary
database name created for that run.

Required coverage groups:

- API/OpenAPI and shared Zod parity, strict unknown-field rejection, `no-store`,
  session ownership, origin/CSRF/Fetch Metadata, and non-disclosing IDs;
- byte-stream abort/overflow/idempotency, AES-GCM tamper detection, filesystem
  and S3 adapter contracts, SHA-256 verification at scan/extraction boundaries,
  source-plus-extraction headroom, and quota concurrency;
- ClamAV Unix-socket readiness/freshness/timeout/EICAR, no TCP listener, and no
  host-path scanning;
- bounded envelope checks before scan, then PDF/DOCX deep-structure malicious
  corpus only after `CLEAN`, plus child-process memory/time bounds;
- deterministic Vietnamese/English parser fixtures and strict JSON Schema;
- lease expiry, duplicate worker, automatic/candidate retry caps, and one active
  parse per account;
- consent grant/version/revocation races and external dispatch gating;
- two draft writers, draft save/confirm race, Profile save/confirm race,
  Profile-aware scalar action semantics, local validation without PATCH,
  canonical server `fieldErrors`, duplicate proposed skill/social-link errors,
  invalid-field focus/ARIA/text treatment, supplemental toast backed by a
  persistent summary, idempotent confirmation, one revision, and transaction
  rollback;
- fake-clock candidate `CANCELLED` to `DELETED` cleanup within 24 hours plus the
  24-hour/30-day/7-day retention rules, already-missing object, cleanup
  failure/retry, quota release, and orphan reconciliation;
- log/audit/metric canaries proving no PII/CV/token/locator content;
- keyboard/focus/live-region/contrast/reduced-motion behavior and 320-pixel E2E.

### Feature UI style ownership

Use existing Tailwind utilities and shadcn-style primitives first. A component
may add custom presentation only in an adjacent same-basename CSS Module, for
example `cv-import-status.tsx` with `cv-import-status.module.css`. Only that
matching owner may import the module. Do not add feature-level `styles/` or
catch-all files, empty required modules, `:global`, cross-component module
imports, or Feature 004 selectors/imports in global/shared stylesheets. Run both
Feature 004 architecture tests through `npm run test:cv-import`.

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

The live synthetic smoke remains skipped unless
`CV_OPENAI_LIVE_SYNTHETIC=1`. It additionally requires a reviewed
non-production `OPENAI_PROJECT_ID`, process-injected API key, and
`CV_OPENAI_SYNTHETIC_PROJECT_APPROVED=true`. It accepts only its hardcoded
synthetic segments—there is no filename, text, or CV override. Run the focused
compatibility test with the same single-worker Vitest flags; never place the
secret in a committed file or captured command output.

## 12. Retention Verification With a Fake Clock

Never wait real days in tests. Seed artifacts/drafts with an injected fake clock:

1. Advance rejected/infected/incomplete content to its 24-hour deadline.
2. Advance unconfirmed imports to 30 days from upload.
3. Confirm an import and advance to seven days.
4. Delete an active candidate import, verify immediate `CANCELLED`/access denial,
   advance no more than 24 hours, and verify complete physical/database purge
   before the `DELETED` transition.
5. Run logical expiry, physical deletion, database scrubbing, quota release, and
   reconciliation loops independently.
6. Inject provider failure and expired deletion leases; prove safe retry.
7. Return `ALREADY_ABSENT`; prove deletion and quota decrement occur once.
8. Seed a known orphan; prove it is scheduled/deleted without its locator
   appearing in telemetry.

Acceptance requires inaccessible content at the logical deadline and idempotent
physical/database purge by the relevant maximum deadline.

## 13. Performance Evidence

Use synthetic clean documents at representative sizes and documented scanner/
parser conditions. Capture safe aggregate metrics only.

- P95 upload finalization/actionable pre-scan validation response <=5 seconds after the
  last byte;
- at least 90% review-ready or actionable terminal within 60 seconds and all
  within 3 minutes under documented provider conditions;
- P95 review load <=3 seconds;
- P95 draft save and confirmation feedback <=2 seconds;
- cleanup succeeds without manual intervention for at least 99% of the measured
  workload.

Before collecting the cleanup percentage, the performance harness owner must
document the observation unit, numerator, denominator, measurement window,
deadline treatment, and what counts as manual intervention. The release run
must reuse that definition rather than choosing it after seeing results.

The committed harness fixes and emits that definition before aggregation and
rejects unknown/content-bearing input fields. Validate instrumentation only:

```powershell
npm run perf:cv-import --workspace @smarthire/web -- --self-test
```

`SELF_TEST` is explicitly ineligible for release evidence. A measured run uses
strict content-free observations captured from the documented synthetic
workload:

```powershell
npm run perf:cv-import:collect --workspace @smarthire/web
npm run perf:cv-import --workspace @smarthire/web -- --input .local/cv-import-performance-input.json
```

The collector requires `DATABASE_URL` and `DIRECT_URL` to point to the same
unique migrated test database, `TZ=UTC`, a ready web server, and a ready CV
worker/ClamAV boundary. Its optional `CV_PERF_*` variables predeclare journey,
claim, concurrency, cleanup, RSS-ceiling, and output-path settings. Output is
restricted to a JSON file below `web/.local`; defaults are 10 journeys, 20
claim samples at concurrency 8, 100 cleanup units, and a 512 MiB local worker
RSS ceiling.

Evidence must state dataset size, sample size, test duration, file-size/format
mix, machine/container resources, concurrency, parser mode, warmed/cold state,
external-provider conditions, and percentile method. Report P50/P95/P99,
maximum latency, and error rate. Reports contain timings, aggregate counts,
resource bytes/ceilings, controlled cleanup timestamps/classifications, and
safe result codes, but no synthetic IDs or content dimensions. Local target
success remains distinct from production release qualification.

## 14. Usability Evidence

Run the complete upload, review, and confirm protocol with at least 30
representative participants: at least 15 on desktop and 15 at a 320-pixel mobile
viewport. The fixture matrix must cover PDF and DOCX plus Vietnamese, English,
and bilingual CVs. At least 90% must complete the flow correctly on the first
attempt without assistance. Record only anonymized aggregate completion/error
counts and environment details; if the threshold is not verified, P0 release is
blocked rather than inferred.

## 15. Safe Troubleshooting

Troubleshoot only with the committed synthetic/curated fixtures. Never replay a
real candidate CV into a local/shared environment, copy raw provider payloads,
or add temporary content logging.

- `AWAITING_CONTENT`: check reservation expiry and client request headers, not
  the file body.
- `SCAN_FAILED`: check the co-located Unix socket, ClamAV health/version, and
  signature age. Never enable TCP or bypass fail-closed scanning.
- `EXTRACTION_FAILED`: use safe failure code and synthetic reproduction; do not
  dump the candidate document or extracted strings.
- `PARSE_FAILED`: check deployment gate, safe provider status/code, attempt
  count, and consent binding. Candidate can retry or use manual Profile entry.
- cleanup lag: inspect due counts, lease age, storage readiness, and safe result
  counts. Never query/log object locators as a bulk troubleshooting step.
- concurrent-review conflict: preserve unsaved browser state and compare with a
  fresh no-store response; do not force last-write-wins.

If new upload/parser dispatch must be disabled, keep the CV cleanup worker
running until every retained artifact and payload is reconciled. Setting
`CV_WORKER_ENABLED=false` disables new scan/extract/parse processing but must not
disable cleanup/reconciliation ownership.
