# Research: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

## Decision 1: New feature directory, additive authority

**Decision**: Use Feature 015 and treat Feature 012 Group 1 as an immutable dependency.

**Rationale**: Repository tooling tracks one complete artifact set per feature. A new directory avoids editing authoritative Group 1 while documenting the continuation.

**Alternatives considered**: Append to 012 (blurs scope and modifies precedent); fragment one artifact per group (breaks one-directory workflow).

## Decision 2: Immutable scoring generations

**Decision**: Store one published `ApplicationScoringResult` per generation with immutable component references and one current pointer on existing `JobApplication`.

**Rationale**: Audit reproduction and non-disruptive rescore require old results to stay readable until complete replacement commits.

**Alternatives considered**: Mutable scalar columns (loses lineage/history); overwrite-in-place (creates partial reads); event log without current pointer (complex hot reads).

## Decision 3: Fixed versioned formula

**Decision**: Compute `automatic × 0.40 + AI × 0.60`, round once to one decimal, and record formula/config version, exact weights, thresholds, and component lineage.

**Rationale**: The constitution fixes the formula and score bands; storing inputs makes every result reproducible.

**Alternatives considered**: Runtime recruiter weights (constitution conflict); AI-only fallback final (fabricated hybrid); rounding each contribution first (avoidable drift).

## Decision 4: Background execution with atomic publication

**Decision**: Initial scoring, full rescore, and AI retry execute as leased background operations; synchronous endpoints enqueue and return operation state.

**Rationale**: AI is asynchronous, campaign rescoring may cover 10,000 records, and request lifecycle must not own completion.

**Alternatives considered**: Synchronous provider call (blocks UI/request); one all-or-nothing batch transaction (poor isolation); client-orchestrated fan-out (weak authority/idempotency).

## Decision 5: Provider port with bounded resilience

**Decision**: Call AI only through `AiAssessmentProviderPort`; enforce deadline, schema validation, three transient attempts with exponential backoff/jitter, circuit breaking, leases, and safe failure codes.

**Rationale**: Provider failures must become `Unavailable`, not crash reads or couple domain logic to one vendor.

**Alternatives considered**: SDK calls in route/service (provider coupling); unbounded retry (cost/storm risk); no retry (poor transient recovery); storing raw responses (privacy and malformed-data risk).

## Decision 6: Deterministic evidence authority

**Decision**: A versioned parser/extractor produces required-skill, preferred-skill, experience, and source-span records from exact CV/JD snapshots before AI.

**Rationale**: The automatic score must be reproducible and useful without AI, with verifiable evidence and honest parser limitations.

**Alternatives considered**: LLM-only extraction (not deterministic); keyword count without spans (not explainable); infer missing years (misleading).

## Decision 7: Typed scoring-state projections

**Decision**: Use discriminated unions for not-calculated, pending, unavailable, processing, and scored projections, with explicit labels and only variant-valid fields.

**Rationale**: Free-text/null combinations permit ambiguous states and fabricated zero/final values.

**Alternatives considered**: Nullable score plus status string; one generic loading state; color tier tokens.

## Decision 8: Manual priority as temporal override history

**Decision**: Store immutable priority records with one active row enforced per application; change/removal closes the prior row and creates an actor/reason event under optimistic concurrency.

**Rationale**: Priority must survive rescore, remain distinct from score, and preserve accountability.

**Alternatives considered**: Field on scoring result (lost on rescore); mutable JobApplication field only (no history); priority edits score/rank (misrepresents evidence).

## Decision 9: Reuse canonical transition authority

**Decision**: Add two commands to the existing application service; update existing `JobApplication.stage` and append existing `ApplicationStageEvent`/`AuditEvent` transactionally using stage-version CAS.

**Rationale**: Feature 012 expressly reserved later transition ownership; extending it avoids parallel stages and handles races.

**Alternatives considered**: Scoring-owned stage table (duplicate authority); generic unvalidated stage PATCH (bypasses allowlists); UI-only rules (unsafe concurrency).

## Decision 10: Transactional interview notification outbox

**Decision**: Write a unique interview-notification intent in the same transaction as the stage event, then deliver asynchronously/idempotently.

**Rationale**: Stage truth must not depend on network delivery, while the notification commitment must not be lost or duplicated.

**Alternatives considered**: Send before commit; best-effort send after commit; roll back stage on transient delivery failure.

## Decision 11: Snapshot-bound ranking pagination

**Decision**: Bind opaque keyset cursors to an immutable ranking snapshot and normalized job/filter/sort/page-size context.

**Rationale**: A rescore can reorder many rows between page requests; live keysets alone can duplicate or omit them.

**Alternatives considered**: Offset pagination (drift/deep cost); live score cursor (mid-rescore gaps); lock ranking during rescore (disruptive); treat missing score as zero (semantically wrong).

## Decision 12: Processing-row filter semantics

**Decision**: Score ranges exclude every row without a published final score and return an exclusion count/label; non-score filters may include them by explicit scoring status.

**Rationale**: A missing final score cannot be compared numerically and silent exclusion misleads recruiters.

**Alternatives considered**: Treat as zero; include regardless of range; silently exclude.

## Decision 13: Evidence and assessment retention

**Decision**: Retain normalized evidence/assessment only while source application evidence is ordinarily available; deny and purge derived private content on the same deadline, while retaining content-minimized audit/provenance facts under audit policy.

**Rationale**: Derived CV content remains personal recruitment data and must not outlive its purpose merely because it is structured.

**Alternatives considered**: Permanent explanations; immediate deletion after scoring (breaks explainability); provider-hosted history as authority.

## Decision 14: Parser-failure honesty

**Decision**: Persist parser status/version/time per source and mark any affected automatic/AI/final projection `mayBeIncomplete` with text.

**Rationale**: A numeric result without input-quality disclosure invites unjustified trust.

**Alternatives considered**: Hide every result on partial parse (loses safe fallback); show score without warning; infer absent content.

## Decision 15: Reject policy

**Decision**: Use one explicit confirmation, allowlisted reportable reason, optional recruiter-only note, no notification in this feature, and default active-pipeline exclusion that is visible/removable.

**Rationale**: This balances mis-click prevention, audit quality, privacy, and recoverable discovery without inventing an undo workflow.

**Alternatives considered**: Double/type-name confirmation for every reject (excess friction); free-text reason only (poor reporting); silent default hiding; automatic rejection notification.
