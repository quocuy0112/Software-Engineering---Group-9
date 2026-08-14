# Implementation Plan: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

**Branch**: `015-candidate-hybrid-ranking` | **Date**: 2026-08-14 | **Spec**: `spec-kit/specs/015-candidate-hybrid-ranking/spec.md`  
**Input**: Group 2–4 specification plus authoritative Feature 012 Group 1 artifacts and the 12-screen AI-ranking brief

## Summary

Extend the existing `JobApplication` recruitment authority with immutable, versioned scoring generations. Compute deterministic evidence first, run schema-validated AI asynchronously through a port, and publish a hybrid result only when both components share the same lineage. Add snapshot-bound score ranking, background job rescoring, AI-only retry, durable manual priority, and two server-validated stage commands using existing `ApplicationStageEvent`, `AuditEvent`, notification outbox, Group 1 document access, and tenant authorization.

## Technical Context

**Language/Version**: TypeScript on the repository-approved Node.js runtime  
**Primary Dependencies**: Next.js server routing, Prisma, PostgreSQL, Zod/shared contracts, existing worker and notification/outbox facilities, approved React/Tailwind/shadcn baseline  
**Storage**: Existing PostgreSQL and existing private application-document storage; no raw AI response object storage  
**Testing**: Existing unit, shared-contract, real-PostgreSQL integration, frontend accessibility, security, architecture, system, and performance suites  
**Target Platform**: Existing SmartHire web deployment and bounded background-worker runtime  
**Project Type**: Web application with server routes and background workers  
**Performance Goals**: Ranked/filter page P95 ≤2 seconds for one 10,000-row job; AI semantic scoring P95 ≤20 seconds asynchronously; rescore command acceptance P95 ≤2 seconds  
**Constraints**: Fixed 60/40 formula; immutable score publication; deterministic fallback; no score-driven stage mutation; provider independence; server-side tenant authorization; snapshot pagination; existing document viewer authority  
**Scale/Scope**: 10,000 applications for one job, isolated candidate failures, bounded worker concurrency, no exact-count requirement except operation scope/count summaries

## Constitution Check

### Pre-design gate

- **I — Human-Controlled Recruitment**: PASS. Scores are recommendations only. Only explicit authenticated recruiter commands can set priority or stage. Explanations, limitations, confidence, sensitive-attribute exclusion, and human-decision labels are first-class contract fields.
- **II — Security, Privacy, Tenant Isolation**: PASS. Every route reuses role + current company/job authority; evidence and internal notes remain least-privilege; provider payloads are minimized and source-derived data follows application retention.
- **III — Deterministic Core and Explainable AI**: PASS. Fixed 60/40 formula, approved bands, asynchronous AI, deterministic fallback, model/prompt/parser/config traceability, and provider boundary are explicit.
- **IV — State, Audit, Data Integrity**: PASS. Immutable generations, compare-and-set stages/priorities, canonical `ApplicationStageEvent`, outbox idempotency, and queryable audit fields preserve database authority.
- **V — Scope Discipline**: PASS. The work implements only Groups 2–4 declared by Feature 012 and does not introduce other pipeline transitions or document paths.
- **VI — Measurable Quality and Accessibility**: PASS. P95 conditions, 10,000-row evidence, typed/text labels, keyboard confirmation behavior, and no color-only status are required.
- **VII — Maintainable and Provider-Independent Architecture**: PASS. Business rules, persistence, provider port, workers, contracts, and presentation remain separated under the existing Next.js routing baseline.

### Post-design gate

PASS. Research decisions, entities, OpenAPI unions, quickstart evidence, and task ordering preserve every pre-design gate. No justified exception is required.

## Architecture

### Scoring execution and publication

Initial scoring and rescoring create `ScoringOperation` work. A worker parses/loads the exact CV/JD snapshots, creates one immutable deterministic result, then attempts AI through `AiAssessmentProviderPort`. AI payloads are schema validated and normalized. One `ApplicationScoringResult` generation is published atomically only after its internally compatible components are ready; AI failure may publish deterministic-only fallback. During rescore, `JobApplication.currentScoringResultId` continues pointing at the old published generation until successor commit.

AI retry references the published deterministic-result ID and creates only an AI attempt/successor aggregate. Lease owner, generation/config expectation, and compare-and-set publication discard stale or late workers.

### List query and pagination

Default ranking snapshot materializes a stable `rankingSnapshotId` for a job plus filter/sort generation. Rows order by `finalScore DESC`, `submittedAt DESC`, `id DESC`; non-final rows occupy an explicit trailing state group and never receive numeric zero. The opaque cursor binds snapshot, job, normalized filters, sort, page size, score/state sort key, submitted time, and ID. Rescore publication creates a newer snapshot for new traversals but cannot mutate an active snapshot. Page-size change starts a fresh traversal with an explicit anchor when supplied.

### Stage commands

`RecruiterApplicationDecisionService` extends the existing application service boundary. It validates current tenant authority, explicit intent, reason/source-stage allowlist, idempotency key, and expected `stageVersion`; then transactionally updates `JobApplication`, appends the canonical `ApplicationStageEvent` and structured `AuditEvent`. Interview transition also writes a unique notification outbox record. No scoring service imports or invokes stage mutation.

### AI reliability boundary

`AiAssessmentProviderPort` accepts minimized, job-relevant structured evidence and returns a provider-neutral validated assessment. Adapter timeout is below the 20-second SLA envelope. Retry uses bounded exponential backoff with jitter for transient failures only, maximum three provider attempts per operation; circuit breaker opens after configured rolling failures and returns a safe unavailable code. Worker leases and idempotency prevent duplicated publication. Raw prompts/responses, protected attributes, document bytes, and internal recruiter notes are excluded from logs.

## Data, Privacy, Retention, and Recovery

- Scoring provenance is immutable and purpose-bound to an application, CV snapshot, JD version, parser/config/formula/model/prompt/policy lineage.
- Evidence excerpts are the minimum source spans needed for explanation and are denied/deleted with underlying application-document evidence; audit facts remain content-minimized under their separate policy.
- Internal rejection notes are encrypted/restricted recruiter data and never copied into candidate notification payloads.
- Migration adds nullable scoring pointers and new tables first, backfills no fabricated score, and leaves scalar legacy score fields non-authoritative.
- Rollback disables new commands/workers, preserves published results and stage/audit integrity, and proceeds via forward migration; it never rewinds committed pipeline events.
- Operational metrics expose counts, latency, safe failure codes, lease expiry, circuit state, and deadline risk without CV excerpts, prompts, notes, or identifiers beyond controlled operational correlation.

## Project Structure

### Documentation

```text
spec-kit/specs/015-candidate-hybrid-ranking/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── contracts/openapi.yaml
```

### Source Code Addendum

```text
web/
├── prisma/{schema.prisma,migrations/*_candidate_hybrid_ranking/}
├── src/app/api/recruiter/
│   ├── jobs/[jobId]/applications/route.ts              # extend Group 1 list
│   ├── jobs/[jobId]/scoring/rescore/route.ts
│   └── applications/[applicationId]/
│       ├── scoring/route.ts
│       ├── scoring/retry-ai/route.ts
│       ├── priority/route.ts
│       └── decisions/{interview,reject}/route.ts
├── src/backend/
│   ├── applications/{authorization,services}/          # extend Group 1 boundary
│   ├── scoring/{domain,services,repositories,providers,workers,pagination}/
│   └── repositories/{applications,scoring}/
├── src/frontend/features/recruiter-applications/
│   ├── candidate-ranking-list.tsx
│   ├── candidate-score-drawer.tsx
│   ├── automatic-match-tab.tsx
│   ├── ai-assessment-tab.tsx
│   ├── documents-tab.tsx                               # composes Group 1 viewers
│   ├── rescore-confirm-modal.tsx
│   ├── manual-priority-modal.tsx
│   ├── stage-transition-confirm-modal.tsx
│   └── reject-candidate-modal.tsx
├── src/shared/contracts/{applications,scoring}/
├── scripts/run-application-scoring-worker.mjs
└── tests/{shared,backend,frontend,security,performance,architecture,system}/scoring/
```

**Structure Decision**: Add a scoring bounded context and decision commands around existing application authority. Do not add a second application, stage, audit, notification, authorization, document viewer, HTTP framework, database, or direct provider call from routes/UI.

## Verification Strategy

- Contract tests validate OpenAPI/shared-schema parity and every discriminated state.
- Pure deterministic fixtures prove reproducibility, skill/experience weights, rounding, missing evidence, and parser warnings.
- Provider adapter tests cover timeout, malformed JSON/schema, circuit opening, transient retries, late responses, and redaction.
- Real PostgreSQL tests prove immutable generations, atomic publication, old-score visibility, lease fencing, batch isolation, priority CAS, stage CAS, stage event/audit/outbox atomicity, and unique notification.
- Security tests cover cross-company IDs, lost membership, internal-note leakage, evidence/document retention, cursor tampering, prompt/log redaction, and protected-attribute exclusion.
- Frontend/accessibility tests cover all 12 screen states, text/icon labels, filter chips/exclusion copy, focus trap/ESC/cancel, non-default destructive focus, live state refresh, and Group 1 viewer reuse.
- Performance evidence uses the same 10,000-application job profile as Feature 012 and records environment, dataset, warm-up, sample size, duration, concurrency, P50/P95/P99/max, error rate, provider condition, worker concurrency, throughput, and batch completion distribution.

## Complexity Tracking

No constitution violation requires justification.
