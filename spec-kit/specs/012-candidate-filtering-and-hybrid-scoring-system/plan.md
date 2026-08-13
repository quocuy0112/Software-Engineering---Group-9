# Implementation Plan: Submitted Candidates List & CV Access — Group 1

**Branch**: `012-candidate-filtering-and-hybrid-scoring-system` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Refined Group 1 specification from `spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/spec.md`

## Summary

Group 1 extends the existing authoritative `JobApplication` aggregate rather than creating a second Application model. The existing candidate submission endpoint already enforces one candidate-job application and initializes `stage=APPLIED`; this feature replaces its mutable CV reference/plain snapshot boundary with immutable application-owned CV and optional cover-letter artifacts, records content-minimized success and failure audit outcomes, and supplies a recruiter-authorized job-scoped list with stable keyset pagination. Recruiters preview text/PDF and explicitly download original PDF/DOCX artifacts through reauthorized byte routes. A leased retention worker enforces immediate logical denial plus 30-day physical deletion after the 12-month deadline or earlier erasure event, honors restricted legal holds, deletes failed-submission orphans within 24 hours, and exposes content-free failures. Group 1 never reads or writes scoring output.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24.18.0

**Primary Dependencies**: Next.js 16.3 App Router Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, Better Auth 1.6, AWS S3 SDK 3.1101 through existing private-storage primitives

**Storage**: PostgreSQL remains authoritative for `JobApplication`, stage/history, immutable artifact metadata, retention/hold state, cleanup leases, and audit linkage. Application bytes use an encrypted purpose-separated extension of Feature 004 private storage: gitignored filesystem for local/test and private non-versioned S3 with SSE-KMS for production. No public/durable signed URL is persisted.

**Testing**: Vitest 4.1, Testing Library, Playwright 1.57, OpenAPI parity, real PostgreSQL integration/concurrency/retention tests, storage-adapter contracts, authorization/privacy/architecture tests, and deterministic 10,000-application performance evidence

**Target Platform**: Existing Windows/Linux Node web deployment, candidate job-application workflow, responsive Recruiter workspace, and one bounded application-retention worker process

**Project Type**: Modular full-stack application in the existing `web/` workspace

**Performance Goals**: With 10,000 authoritative applications for one job, initial and subsequent list pages become usable at P95 within 2 seconds; evidence records environment, dataset construction, warm-up, sample size, duration, concurrency, nearest-rank P50/P95/P99/max, maximum observed latency, error rate, and relevant external-service conditions; list reads remain bounded and do not require exact total counts

**Constraints**: Extend `JobApplication` as the sole authority; one row per candidate-job; accepted submission starts `APPLIED` with stage version 1; PDF/DOCX CV required and at most 5,000,000 bytes; optional exclusive bounded text or validated PDF/DOCX cover letter; immutable evidence; transactional allowlisted audit; current company/job authorization on every read; no public document URL/browser persistence; exact logical retention enforcement; 30-day purge and 24-hour orphan deadline; no Group 2–4 behavior

**Scale/Scope**: One existing application aggregate, one required and at most one optional immutable artifact, one job-scoped list, four document operations, one retention/reconciliation worker, 10,000 representative applications per job, and no AI or realtime dependency

## Existing-System Reconciliation

The original requirement described only `appliedJobIds[]`, but the current codebase has advanced: Prisma owns `JobApplication`, `CandidateCv`, answers, stage events and notifications; shared contracts already define all canonical stages; and `POST /api/jobs/{jobId}/applications` returns an `APPLIED` outcome. Feature 012 must extend these authorities. It must not create a parallel `Application`, duplicate stage enum, second submission route, or second candidate application service.

Existing pre-cutover `JobApplication` rows are classified by migration preflight:

- **Backfillable authoritative row**: selected `CandidateCv` bytes still exist and their digest/version agree with submission evidence. Copy the exact bytes into a new immutable application artifact and preserve original `submittedAt` and stage.
- **Legacy-unavailable row**: exact original bytes cannot be proven. Do not substitute a current profile CV. Exclude it from Group 1's complete-document recruiter list and emit a content-free migration report for product/operations handling.
- Any duplicate candidate-job row or inconsistent artifact binding blocks release. The existing database unique constraint remains final authority.

`appliedJobIds[]` values, legacy JSON demo data, and other non-authoritative hints are never converted into JobApplication rows.

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Design evidence | Result |
|---|---|---:|
| I. Human-controlled recruitment | Group 1 exposes submitted evidence only; it performs no score, rank, rejection, advancement, or decision. | PASS |
| II. Security/privacy/tenant isolation | Better Auth plus current active company membership/job ownership guards every read; encrypted private artifacts have exact denial/deletion rules, restricted legal holds, and no public URL/log content. | PASS |
| III. Deterministic core | Submission, `APPLIED` initialization, duplicate prevention, ordering, access, retention, and cleanup are deterministic; AI/scoring is absent. | PASS |
| IV. State/audit/integrity | Existing canonical stage/version remains authoritative; submission, artifact binding, `APPLIED` stage event, idempotency and allowlisted audit commit together; database uniqueness and leases protect races. | PASS |
| V. Scope discipline | The plan completes list/document access plus required submission/retention foundations while deferring every later transition and Groups 2–4. | PASS |
| VI. Quality/accessibility | P95 ≤2 seconds at 10,000 applications, bounded pagination, keyboard-labelled UI and explicit loading/empty/error/document states are verified. | PASS |
| VII. Maintainable architecture | Existing Route Handler → service → repository/provider boundaries, PostgreSQL, Better Auth and worker runtime are extended without a second authority. | PASS |

**Post-design re-check**: PASS. Data/state, submission, audit, retention, migration, contracts and verification now address the prior analysis blockers with no waiver.

## Architecture and Ownership

```text
Candidate application UI
  `-- existing POST /api/jobs/{jobId}/applications
          `-- existing application command, extended for immutable promotion/audit

Recruiter workspace
  |-- GET /api/recruiter/jobs/{jobId}/applications
  |-- GET /api/recruiter/jobs/{jobId}/applications/{applicationId}/documents/{kind}
  `-- GET /api/recruiter/jobs/{jobId}/applications/{applicationId}/documents/{kind}/download
          `-- RecruiterApplicationService
                |-- RecruiterJobAuthorizationPort
                |-- JobApplicationRepositoryPort ----> PostgreSQL
                `-- ApplicationDocumentStoragePort --> encrypted local/private S3

Application retention worker
  `-- lease due artifacts -> enforce deny -> delete bytes/private metadata -> audit safe outcome
```

- Existing Feature 003 submission route/service remains the sole candidate write path and delegates the new immutable-promotion transaction through a narrow application-document port.
- Feature 012 recruiter Route Handlers own strict inputs, Better Auth session resolution, no-store headers, safe error translation and byte streaming; no direct Prisma/storage calls.
- The service rechecks active account, verified company, active recruiter membership, job ownership, application/job association, document purpose, access deadline and legal-hold exclusion for every request.
- Repository code alone owns list cursors, exact locks, uniqueness/idempotency mapping, stage/event persistence, cleanup leases, retention queries and transactional audit integration.
- Storage adapters receive server-resolved artifact identities only and verify application/purpose binding before opening bytes.
- Later scoring groups own versioned evaluation entities/provenance and may project summaries onto `JobApplication`; Group 1 never treats existing `aiMatchScore` as its data.

### Session authority

Better Auth remains the one exclusive server-controlled browser-session owner. Existing authentication routes create opaque database-backed sessions and issue the existing `__Host-smarthire.session` cookie with `HttpOnly`, production `Secure`, and the approved `SameSite` policy. Better Auth persists expiry and revocation state in PostgreSQL; logout, password reset, account suspension/deletion, explicit session revocation, and natural expiry invalidate server-side validation. Every candidate submission and recruiter list/document request resolves the current session at the server boundary before applying current account and company-membership checks. Feature 012 creates no token, session table, alternate cookie, client-stored credential, or second authentication mechanism.

## Submission, State and Audit Transaction

The existing `POST /api/jobs/{jobId}/applications` request continues to validate session/CSRF, active candidate, eligible job, profile revision, required confirmed CV, questions, consent and idempotency. Feature 012 adds immutable artifact promotion:

1. Validate exact selected CV bytes and optional exclusive cover-letter text/file. File artifacts must pass the approved PDF/DOCX, 5,000,000-byte, malware and structural boundary; text is normalized and limited to 10,000 Unicode characters.
2. Promote/copy exact bytes to random application-owned storage keys; record pending promotion tokens. Never bind to mutable `CandidateCv.storageKey` alone.
3. In one database transaction lock candidate/job/idempotency subjects; recheck eligibility and duplicate; insert `JobApplication` with `stage=APPLIED`, `stageVersion=1`, original `submittedAt`; bind immutable artifact metadata/text; insert the initial stage event and a content-minimized success audit outcome; and mark promotion tokens committed. The repository transaction alone owns `PROMOTED` to `COMMITTED`; the promotion service prepares objects and reconciles uncommitted orphans.
4. Exact idempotent replay returns the original outcome. Key reuse with different submission/artifacts conflicts. Concurrent duplicate attempts resolve to the unique existing application without changing timestamp/documents.
5. If promotion fails, no application commits. If the transaction fails after promotion, the object is logically denied immediately, queued for reconciliation and physically deleted within 24 hours.

Every submission attempt receives a correlation identifier before validation or promotion. Success audit commits with the accepted application. After rollback, a rejected or failed attempt writes a separate content-minimized outcome containing only the available actor, action, available job/application target context, safe result code, correlation identifier, and timestamp. Audit excludes CV/cover-letter/contact/filename/storage/score content. The shared audit-retention process deletes Feature 012 success and failure attempt metadata at the governing 365-day baseline; tests verify both outcomes without weakening any stricter platform policy.

## Authorization and Document Delivery

Every list/preview/download request derives the current user from Better Auth and verifies active account, active recruiter membership, active verified company, job-company ownership, application-job binding, artifact-application/purpose binding, current time before logical denial, and absence from ordinary access when held. Unknown, foreign, expired, deleted and unauthorized resources share a neutral unavailable projection.

List data contains application ID, current permitted display identity, verified email, application-shared phone, submitted time and document availability/type. Avatar uses the existing authenticated recruiter-permitted projection or labelled fallback. It returns no object key, private avatar locator, document content, exact total, score value or rationale.

PDF/text preview and PDF/DOCX download use authenticated server streaming with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, validated content type and safe `Content-Disposition`. DOCX preview yields `PREVIEW_UNAVAILABLE` while download remains possible. Storage outage/corruption affects only the document action.

## List Query and UI

Use keyset ordering `(jobPostingId, submittedAt DESC, id DESC)`, opaque cursor bound to job/order version, default 25 and maximum 100, returning `items` plus nullable `nextCursor` without exact count. The recruiter job management view gains a selected-job applicant panel. `SubmittedCandidatesList` owns loading/populated/empty/error/incremental states and list-position preservation. Document viewers own progress, focus restoration, fallback and isolated errors.

Unscored rows remain visible in chronological order. Group 1 renders no score, zero placeholder, rank, threshold, filter or color. `APPLIED` initialization is persisted for system integrity, but this group adds no later pipeline action.

## Retention, Erasure, Legal Hold and Reconciliation

For each application artifact, `retentionDueAt` is 12 months after the later of job closure or the application entering a terminal state. If no terminal state exists, job closure anchors the deadline. Services enforce `ordinaryAccessDeniedAt` exactly at that boundary even if the worker has not run.

An earlier valid candidate/account deletion or erasure event sets logical denial immediately and a physical deadline no later than 30 days. At normal expiry, physical bytes, encrypted filename, storage locator, digest and encrypted cover-letter text are purged within 30 days. Minimum non-content application/audit facts may remain under their separate governing policy. A legal hold records purpose, authorized issuer, start and review/end time; it never restores ordinary recruiter access and postpones only the minimum physical deletion. Purge completes within 30 days after the final hold ends.

A bounded worker claims due cleanup/reconciliation rows with leases and idempotent finalization. Failed-submission orphans have a hard 24-hour deletion deadline. Cleanup retries use bounded backoff; any item still failing at half its remaining deadline raises content-free operator status, and crossing a hard deadline raises a critical audit/operational event without content or locator leakage. S3 lifecycle is defense in depth, never the access authority.

## Data Integrity and Concurrency

- Existing unique `(candidateUserId, jobPostingId)` remains the final duplicate authority.
- Stage is `APPLIED`, version 1 and initial stage event at creation; Group 1 exposes no transition command.
- Application artifact metadata and cover-letter representation are immutable and exclusive after commit.
- Submission transaction binds application, initial state/event, exact artifacts, idempotency and audit atomically after successful promotion.
- Cleanup uses logical denial independent of worker timing and lease-owner guarded finalization.
- Cursor includes submitted time and ID; an unchanged traversal neither duplicates nor omits rows.
- Storage open accepts only a repository-resolved artifact/purpose binding, never a browser locator.

## Migration and Recovery Strategy

1. Preflight current `JobApplication`, `CandidateCv`, legacy hints and storage. Block on candidate-job duplicates, invalid stage/version, unverifiable bindings or retention-date derivation failure.
2. Add application artifact, encrypted cover-letter text, promotion/reconciliation, retention, legal-hold and cleanup state. Reuse existing ApplicationStage and AuditEvent authorities.
3. Backfill exact immutable artifacts only where existing selected CV bytes/digest/version are provable; preserve application ID, `APPLIED`/current stage, version and `submittedAt`. Mark other rows legacy-unavailable and exclude them from the complete-document recruiter projection.
4. Do not synthesize rows from `appliedJobIds[]` or JSON demo data. Stop any residual non-authoritative writes at cutover.
5. Deploy schema/read compatibility and worker first, then switch existing submission command atomically to immutable artifacts/audit, then enable recruiter list/document UI.
6. Monitor orphan count, cleanup deadline risk, legacy-unavailable count and authorization denials using content-free metrics.
7. Roll back by disabling new submission and recruiter entry points while leaving exact denial/cleanup active; recover through a forward migration, never destructive migration rollback or blind object deletion.

## Project Structure

### Documentation

```text
spec-kit/specs/012-candidate-filtering-and-hybrid-scoring-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/openapi.yaml
```

### Source Code

```text
web/
├── prisma/{schema.prisma,migrations/*_submitted_candidates/}
├── src/app/api/
│   ├── jobs/[jobId]/applications/route.ts
│   └── recruiter/jobs/[jobId]/applications/**
├── src/backend/
│   ├── services/jobs/                 # existing submission owner
│   ├── applications/{authorization,services,storage,workers}/
│   └── repositories/{jobs,applications}/
├── src/frontend/features/recruiter-applications/
├── src/shared/contracts/{jobs,applications}/
├── scripts/run-application-retention-worker.mjs
└── tests/{shared,backend,frontend,security,performance,architecture,system}/applications/
```

**Structure Decision**: Extend existing `JobApplication`, candidate job route, recruiter workspace, audit facility and worker runtime. No second application aggregate, session, database, service or AI provider is introduced.

## Verification Strategy

- Contract/parity tests align the existing submission contract and new recruiter list/document OpenAPI with shared schemas.
- Real PostgreSQL tests prove `APPLIED` initialization, stage event, audit atomicity, uniqueness/idempotency, promotion rollback, immutable evidence, legacy classification and migration preflight.
- Storage/retention tests use fake clocks at exact deadlines, erasure, overlapping holds, hold release, lease loss, retries, 24-hour orphan deletion and 30-day purge.
- Security tests cover cross-company/foreign IDs, authority revocation, expired/held/deleted artifacts, cursor tampering, filename/header injection and content-free telemetry.
- Frontend/accessibility tests cover populated/unscored, pagination, empty/error retry, absent/text/PDF/DOCX cover letter, preview fallback, document isolation, keyboard/focus and responsive layout.
- Performance evidence uses one job with 10,000 authoritative applications and records environment, dataset construction, warm-up, sample size, test duration, concurrency, nearest-rank P50/P95/P99/max, maximum observed latency, error rate, and relevant external-service conditions; first/subsequent pages require P95 ≤2 seconds.
- Regression tests prove candidate application tracking/stages continue, Feature 004 temporary retention is unchanged, Feature 007 job management works, and Groups 2–4 remain absent.
- Production build, migration verification, worker probe, focused suite, E2E and quickstart evidence are mandatory before implementation completion.

## Complexity Tracking

No constitution violation requires justification.
