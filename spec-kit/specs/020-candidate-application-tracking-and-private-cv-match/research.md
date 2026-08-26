# Research: Candidate Application Tracking and Private CV Match

## Decision 1: Extend the authoritative Application

**Decision**: Extend existing `JobApplication`, `ApplicationStageEvent`, submission, tracking, and stage services.

**Rationale**: They already enforce candidate-job uniqueness, immutable snapshots, canonical stages, and Candidate ownership. A parallel aggregate would contradict Features 012/015.

**Alternatives considered**: New CandidateApplication table (duplicate authority); UI-only tracking (not authoritative); continue using only `appliedJobIds[]` (untrustworthy).

## Decision 2: Separate withdrawal outcome from canonical stage

**Decision**: Add an orthogonal immutable withdrawal outcome/version/timestamp to the Application and preserve its last canonical recruiter stage.

**Rationale**: The clarified spec requires `Outcome: Withdrawn` without inventing or impersonating a constitutional stage.

**Alternatives considered**: Map to `REJECTED` (false recruiter decision); add `WITHDRAWN` stage (constitution amendment); delete Application (destroys audit/history).

## Decision 3: Transactional, idempotent submission

**Decision**: Revalidate draft revision and all source ownership, then commit Application, snapshots, initial event, intake, notification preferences, audit/outbox intent, and draft consumption atomically under existing unique keys.

**Rationale**: Network retries must not create duplicate Applications or partially accepted evidence.

**Alternatives considered**: Multi-step client writes; generate snapshots asynchronously after acceptance; client-only duplicate prevention.

## Decision 4: Technical intake is not pipeline state

**Decision**: Store an independent three-step intake aggregate with monotonic progress and background leases.

**Rationale**: File checks/extraction may fail or retry without changing `APPLIED` or implying recruiter review/scoring.

**Alternatives considered**: Add intake stages to canonical pipeline; infer progress from scoring status; synchronous processing.

## Decision 5: Candidate-safe public projection

**Decision**: Construct application tracker responses from explicit allow-lists and public-stage mapping; never serialize the underlying Application object.

**Rationale**: Structural absence is safer than hiding score/note fields in UI components.

**Alternatives considered**: Shared recruiter DTO with redaction; frontend filtering; generic entity serializer.

## Decision 6: Separate persistence pipelines for private and employer scores

**Decision**: Private checks use dedicated tables, repository interface, service namespace, routes, and cleanup worker. Only pure scoring input/output ports and versioned policy code are shared.

**Rationale**: This enforces absolute separation while preventing method drift.

**Alternatives considered**: One scoring table with purpose discriminator (recruiter queries can reach private rows); application-linked private reports (creates influence path); duplicate scoring algorithms (drift).

## Decision 7: Purpose-neutral versioned scoring engine

**Decision**: Reuse deterministic extractor/matcher, AI provider port, schema validation, formula, bands, and provenance through a persistence-free engine contract.

**Rationale**: Both sides must use the exact approved method, yet the engine must be unable to publish into either pipeline.

**Alternatives considered**: Call recruiter scoring service (violates separation); copy formulas; let Candidate choose weights.

## Decision 8: Immutable private attempts with one current pointer

**Decision**: Each check fixes CV/JD/config inputs and owns immutable attempts; one current-attempt pointer changes only after an attempt safely publishes.

**Rationale**: Retry history stays auditable and limited evidence remains readable until a complete hybrid successor exists.

**Alternatives considered**: Overwrite attempt; create a new report per retry; clear limited result while retrying.

## Decision 9: Deterministic-first limited publication

**Decision**: Publish automatic evidence independently, store AI failure as an absent component and safe code, and omit hybrid/band until a valid AI component exists.

**Rationale**: `—` is semantically different from zero and the constitution forbids blocking/fabricating results.

**Alternatives considered**: Weight deterministic to 100%; treat AI as zero; hide report; block Apply now.

## Decision 10: One-time rounding and score parity fixtures

**Decision**: Calculate `automatic × 0.40 + AI × 0.60`, round the final value once to one decimal, and derive bands from the same displayed value/config.

**Rationale**: It matches Feature 015 and prevents contribution/label drift.

**Alternatives considered**: Round each contribution; integer-only score; Candidate-specific band names without canonical mapping.

## Decision 11: Existing worker and provider patterns

**Decision**: Select the repository's approved OpenAI Responses API adapter and server-configured `gpt-5.4-mini-2026-03-17` model baseline as the initial AI evaluation provider, invoked only through the provider-neutral port. Use PostgreSQL work rows, leases, bounded retry/backoff, schema-validated output, safe error codes, and mandatory DPA/cross-border/privacy/zero-data-retention approval gates.

**Rationale**: The repository already pins OpenAI SDK 7.3 and operates approved OpenAI adapter/configuration patterns for CV processing. Naming the initial provider satisfies the constitution while the port, minimized payload, provenance, and approval gates preserve replacement and privacy boundaries; no new queue/provider is justified.

**Alternatives considered**: An unnamed runtime-selected provider (unresolved planning decision); synchronous Route Handler provider calls; direct SDK coupling in domain services; client-initiated work; unbounded retries; a new broker.

## Decision 12: Four-second visible-page polling

**Decision**: Refresh intake/tracker/current private state every four seconds only while the relevant view is visible, with immediate invalidation after commands.

**Rationale**: It satisfies five-second freshness and aligns with Feature 016 without adding another socket authority.

**Alternatives considered**: New WebSocket domain flow; manual refresh; sub-second polling.

## Decision 13: Per-application notification preferences

**Decision**: Store email/in-app booleans keyed by Application and consult them when producing optional future public-stage notifications.

**Rationale**: Clarification requires independent current/future application behavior.

**Alternatives considered**: Account-global preferences; copy global defaults on every read; notification-only client settings.

## Decision 14: Bounded privacy retention

**Decision**: Drafts expire 30 days after last successful edit. Private checks expire 12 months after creation; deletion/expiry immediately denies access and schedules physical deletion within 30 days.

**Rationale**: Concrete lifecycle rules enable compliance verification and prevent indefinite private evidence storage.

**Alternatives considered**: Retain forever; delete immediately after display; tie private report lifetime to job closure.

## Decision 15: Existing unified notifications and email behavior

**Decision**: Produce safe in-app events through Feature 016 and retain existing application-stage email production, adding per-application preference evaluation without copying internal reasons.

**Rationale**: One inbox/outbox policy avoids duplicate delivery authorities and preserves current email semantics.

**Alternatives considered**: Feature-specific notification table; direct sends inside transitions; expose internal stage event payloads.

## Decision 16: Candidate-private Apply now handoff

**Decision**: Carry only job and CV identifiers as non-authoritative prefill; submission revalidates and snapshots independently.

**Rationale**: It improves continuity without transferring private report data or bypassing confirmation.

**Alternatives considered**: Link the check to Application; copy private score; auto-submit from report.
