# Implementation Plan: Candidate Application Tracking and Private CV Match

**Branch**: `020-candidate-application-tracking-and-private-cv-match` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/spec.md`

## Summary

Complete the Candidate-side application workflow around the existing authoritative `JobApplication`: a 30-day resumable review draft, idempotent snapshot-bound submission, observable technical intake, safe public-stage tracking, per-application notification preferences, and race-safe pre-interview withdrawal. Add a wholly separate Candidate-private CV match aggregate whose background analysis reuses the versioned 40% deterministic/60% AI scoring engine but cannot be queried, copied, or published through employer evaluation paths. Private reports preserve deterministic limited mode, immutable attempt history and provenance, expire after 12 months, and support immediate candidate deletion with bounded cleanup.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js 24.18.x

**Primary Dependencies**: Next.js 16.3 App Router and Route Handlers, React 19.2, Prisma 7.9, PostgreSQL, Zod 4.3, TanStack Query 5.101, Better Auth 1.6.25, OpenAI SDK 7.3 through the provider-neutral AI evaluation port, existing private CV storage/extraction, and unified notification services

**Storage**: PostgreSQL through the existing Prisma client for authoritative state; existing private object storage for immutable application/CV artifacts; no browser persistence as authority

**Testing**: Vitest 4.1 for unit, integration, contract, architecture, security, accessibility, and performance suites; Playwright for targeted authenticated end-to-end flows

**Target Platform**: Responsive Candidate web workspace on the existing long-lived Node custom server hosting Next.js

**Project Type**: Existing monorepo web application with presentation, service, repository, shared-contract, background-worker, and provider-port boundaries

**Performance Goals**: Candidate pages usable P95 ≤3 seconds; navigation P95 ≤2 seconds; in-app public-stage visibility P95 ≤5 seconds; private AI evaluation P95 ≤20 seconds asynchronously; mutation acknowledgement P95 ≤2 seconds under documented representative conditions

**Constraints**: One Application per candidate-job pair; immutable submitted snapshots; exact 40/60 formula and score bands; no candidate exposure of employer evaluation; no private-to-employer data flow; AI failure never blocks applying/tracking; pre-interview withdrawal only; private reports expire at 12 months with immediate logical denial and physical deletion within 30 days

**Scale/Scope**: Seven Candidate UI states, six primary journeys, application lists at the existing 10,000-applications-per-job baseline, up to 50 retained private checks per Candidate in representative performance fixtures, bounded timelines/attempt histories, and independently retryable background work

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Gate | Status | Evidence |
|---|---|---|
| Human-controlled recruitment | PASS | No score submits, withdraws, advances, rejects, or hires. Apply now opens review; recruiter stage authority remains unchanged. |
| Security, privacy, tenant isolation | PASS | Candidate ownership is enforced server-side; application projections are allow-listed; private checks use separate tables/repositories with no recruiter relation or query port; sensitive attributes are excluded. |
| Deterministic core and explainable AI | PASS | Shared versioned engine preserves `automatic × 0.40 + AI × 0.60`, approved bands, full deterministic evidence, asynchronous AI, explicit limited mode, and retry. |
| State, audit, data integrity | PASS | Existing `JobApplication` and `ApplicationStageEvent` remain canonical; submission, withdrawal outcome, notification intent, and audit writes are transactional/idempotent with optimistic concurrency. |
| Scope discipline and complete P0 workflows | PASS | The plan completes Candidate submission/tracking and private guidance without recruiter chat, post-submit editing, scoring redesign, SMS/push, or automatic decisions. |
| Measurable quality and accessibility | PASS | P95 targets, responsive/keyboard/non-color requirements, ownership matrices, fallback tests, and reproducible measurement conditions are included. |
| Maintainable/provider-independent architecture | PASS | Existing Route Handler/service/repository layers, Better Auth session owner, PostgreSQL authority, provider ports, worker leases, and notification boundary are retained. |

**Exclusive browser-session owner**: Existing Better Auth server sessions in secure HttpOnly cookies. Every Candidate route resolves the session server-side and checks Candidate ownership; private-check identifiers, application identifiers, and CSRF proofs never grant authority by themselves.

**Initial AI provider selection**: Use the repository's approved OpenAI Responses API adapter through `AiEvaluationPort`, with the server-configured `gpt-5.4-mini-2026-03-17` model baseline and recorded provider/model/prompt/input-policy provenance. Production calls remain disabled unless the existing DPA, cross-border transfer, privacy, and zero-data-retention approval gates pass. The domain, worker, persistence, contracts, and tests depend only on the provider-neutral port, so replacing OpenAI does not change scoring policy or either persistence pipeline.

**Post-design re-check**: PASS. The data model adds no parallel Application or recruiter stage, the private aggregate has no employer-facing relation, contracts expose discriminated safe projections, and cleanup/outbox designs preserve privacy and transactional truth.

## Project Structure

### Documentation (this feature)

```text
spec-kit/specs/020-candidate-application-tracking-and-private-cv-match/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- candidate-applications-private-match.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
web/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/<timestamp>_candidate_application_tracking_private_match/migration.sql
|-- scripts/
|   |-- run-candidate-match-worker.mjs
|   |-- verify-candidate-application-private-match-migration.mjs
|   `-- measure-candidate-application-private-match-performance.mjs
|-- src/
|   |-- app/
|   |   |-- jobs/[slug]/apply/{page.tsx,review/page.tsx}
|   |   |-- jobs/applied/[applicationId]/{page.tsx,processing/page.tsx}
|   |   |-- jobs/matches/{page.tsx,[checkId]/page.tsx}
|   |   `-- api/candidate/
|   |       |-- application-drafts/route.ts
|   |       |-- applications/{route.ts,[applicationId]/**/route.ts}
|   |       `-- private-cv-matches/{route.ts,[checkId]/**/route.ts}
|   |-- backend/
|   |   |-- candidate-applications/
|   |   |   |-- application-draft-service.ts
|   |   |   |-- application-intake-service.ts
|   |   |   |-- candidate-application-tracking-service.ts
|   |   |   `-- application-withdrawal-service.ts
|   |   |-- private-cv-match/
|   |   |   |-- private-cv-match-service.ts
|   |   |   |-- private-match-projection.ts
|   |   |   |-- private-match-retention.ts
|   |   |   `-- private-match-worker.ts
|   |   |-- scoring-engine/
|   |   |   |-- automatic-matching-port.ts
|   |   |   |-- ai-evaluation-port.ts
|   |   |   `-- hybrid-score-policy.ts
|   |   `-- repositories/
|   |       |-- candidate-applications/prisma-candidate-application-repository.ts
|   |       `-- private-cv-match/prisma-private-cv-match-repository.ts
|   |-- frontend/features/
|   |   |-- candidate-applications/{client,components,styles}/
|   |   `-- private-cv-match/{client,components,styles}/
|   `-- shared/contracts/
|       |-- candidate-applications/index.ts
|       `-- private-cv-match/index.ts
`-- tests/
    |-- backend/{unit,integration,contract}/{candidate-applications,private-cv-match}/
    |-- frontend/{components,accessibility}/{candidate-applications,private-cv-match}/
    |-- architecture/candidate-application-private-match-boundaries.test.ts
    |-- security/candidate-application-private-match/
    |-- performance/candidate-application-private-match/
    `-- system/e2e/candidate-application-private-match/
```

**Structure Decision**: Extend the existing `web` workspace and current application, CV, scoring, notification, session, and worker layers. Keep reusable score calculation in a purpose-neutral engine boundary, but place employer scoring and Candidate-private orchestration in different services, repositories, tables, contracts, and route trees. Extend the existing Candidate application pages and aggregate rather than introducing a second application workflow.

## Delivery Design

### Application Submission and Intake

1. One candidate-job draft is upserted with optimistic revision, exact CV/JD selection, encrypted/private references, and a 30-day sliding expiry.
2. Review is a server-built projection from the draft and currently valid owned inputs; the submit command requires confirmation, draft revision, CSRF proof, and an idempotency key.
3. One transaction revalidates job eligibility and Candidate/CV ownership, creates the existing `JobApplication` with immutable snapshots and `APPLIED`, appends the initial stage/audit event, initializes intake steps and per-application notification settings, emits safe application receipt work, and consumes the draft.
4. Replays resolve the existing candidate-job Application; they never duplicate storage bindings, events, scoring, or notifications.
5. A leased intake worker verifies readability/extraction and advances only technical intake states. Failures surface technical recovery without changing the public pipeline or blocking the accepted Application.

### Candidate-Safe Tracking and Withdrawal

- Candidate reads use a dedicated allow-listed projection over the existing Application authority. Scores, score status, employer notes/reasons, ranking, and other-candidate facts are structurally absent.
- Canonical stages map to four public groups. Candidate-visible stage events are copied only through the public projection policy; technical intake never advances a stage.
- Poll every four seconds while processing/tracker views are visible, matching the unified notification freshness design without adding another realtime authority.
- Withdrawal locks the Application, checks candidate ownership, absence of an existing terminal withdrawal, and current stage before `INTERVIEWING`; it records a separate terminal withdrawal outcome while preserving the canonical stage, prevents future active processing, appends candidate timeline/audit records, and enqueues recruiter notification in one transaction.
- Per-application email/in-app toggles affect optional future public-stage messages only; timeline truth and mandatory communications are unchanged.

### Private CV Match Isolation

- `PrivateCvMatchCheck`, attempts, evidence, and cleanup state live in candidate-owned tables with no `JobApplication`, company, recruiter, ranking-result, or employer-evaluation foreign key.
- Candidate-private routes call only the private service/repository. Recruiter modules and employer score repositories are forbidden from importing private modules by architecture tests.
- The shared engine accepts immutable sanitized `ScoringInput` values and returns purpose-neutral deterministic/AI components. It has no persistence access and cannot choose a destination pipeline.
- Private orchestration snapshots CV/JD/config provenance, stores deterministic evidence in the private aggregate, and invokes AI asynchronously through the existing provider port. Publication is atomic per attempt.
- Limited mode publishes the deterministic component with AI absent (`—`), no hybrid or band. Retry creates an immutable attempt against the same inputs and promotes the same check's current attempt only after safe publication.
- Apply now passes only candidate-visible job/CV identifiers as a prefill hint; application review revalidates them and never imports a private score, evidence row, report identifier, or attempt.

### Retention and Operational Safety

- Draft expiry denies and removes unsubmitted content after 30 days of inactivity.
- Private checks receive `expiresAt = createdAt + 12 months`. Candidate deletion or expiry atomically sets `inaccessibleAt`, cancels/invalidates leases, and schedules derived content for physical deletion within 30 days.
- Cleanup uses bounded leases, retry counters, safe failure codes, and operator-visible content-free metrics. A legal hold is separately authorized, purpose-limited, and never restores ordinary Candidate or recruiter access.
- Submitted document retention remains governed by Feature 012 and is not shortened or duplicated here.

## Validation Strategy

1. Shared contract and public-projection tests, including forbidden fields and discriminated fallback states.
2. Migration and repository tests for uniqueness, ownership, isolation, optimistic concurrency, expiry, leases, and idempotency.
3. Submission/intake/withdrawal transaction tests with duplicate requests, stage races, job closure, stale drafts, and notification failures.
4. Scoring-engine parity fixtures proving Candidate and employer invocations use the same 40/60 policy while persisting independently.
5. AI timeout/malformed response/retry tests proving deterministic evidence remains complete and no hybrid is fabricated.
6. Security and architecture tests proving recruiter/company/admin routes cannot discover private check existence or import private modules.
7. Frontend component/accessibility tests for all seven requested states, mobile layouts, keyboard controls, focus, contrast, and non-color meaning.
8. Retention tests with time control for 30-day drafts, 12-month reports, immediate denial, 30-day cleanup, and in-flight retry cancellation.
9. Performance measurements with documented fixtures and provider conditions, then typecheck, lint, focused suites, migration checks, full regression suite, and production build.
10. Moderated usability validation with a documented Candidate cohort and fixed scenarios measures first-attempt review/submission completion within three minutes and comprehension of private guidance/non-sharing; retain aggregate results only.

## Complexity Tracking

No constitution violations require justification.
