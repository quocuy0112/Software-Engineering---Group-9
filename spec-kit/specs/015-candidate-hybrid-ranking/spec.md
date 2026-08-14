# Feature Specification: Automatic Matching, AI Scoring, Hybrid Ranking & Recruiter Decisions — Groups 2–4

**Feature Directory**: `015-candidate-hybrid-ranking`  
**Created**: 2026-08-14  
**Status**: Ready for implementation planning  
**Scope**: Groups 2–4 continuation of Feature 012 Group 1

**Directory decision**: This work uses a new sequential feature directory because repository tooling records one active `spec.md` per feature directory and Feature 012 already contains a complete, authoritative Group 1 artifact set. A new directory preserves that precedent while explicitly depending on and additively extending its `JobApplication`, `ApplicationStageEvent`, `AuditEvent`, document access, authorization, and pagination authorities.

## Clarifications

### Session 2026-08-14

- Q: Is the hybrid formula configurable for this feature? → A: No. The constitution fixes `60% deterministic + 40% AI`; configuration is versioned for audit and future migration, but changing weights requires a constitution amendment.
- Q: What does each scoring-state term mean? → A: `Not calculated` means no applicable computation has ever completed or is running; `Pending` means a final/AI computation is running; `Unavailable` means the last AI attempt failed and may be retried while deterministic output remains valid; `Processing` is the list-row presentation for an application with no published scoring result while initial scoring runs. These labels are never aliases.
- Q: Is a partial hybrid score allowed when AI fails? → A: No. Automatic match remains visible, AI is `Unavailable`, and final score is `Not calculated`; AI is never substituted with zero and no partial number is called final.
- Q: What happens to old scores during rescore? → A: The last published score remains current and fully readable until an application’s replacement aggregate commits atomically. A separate rescore status indicates work in progress.
- Q: How are partial rescore failures handled? → A: Each application completes independently. An AI failure publishes the new deterministic result with AI unavailable, while other applications publish full results; the batch completes with failure counts rather than failing wholesale.
- Q: Does manual priority affect score or rank? → A: It never mutates a score. It is a distinct recruiter override used as an explicit list ordering dimension ahead of final score when the recruiter selects manual-priority ordering; default ranking remains final-score order with a visible manual indicator.
- Q: What manual-priority values are supported? → A: `HIGH`, `NORMAL`, `LOW`, and `HOLD`. Setting or changing one requires a non-blank reason; removal also requires a non-blank reason and preserves history.
- Q: May a rejected candidate be moved directly to interview? → A: No. `REJECTED` is not an allowed source for this command. Reopening a rejected application is a separate future workflow; the action is absent or returned as unavailable with a textual reason.
- Q: Which stages may move directly to interview? → A: `APPLIED`, `VIEWED`, `SHORTLISTED`, and `WAITLISTED` may transition to canonical `INTERVIEWING`; all other source stages are rejected by server validation.
- Q: Which stages may be rejected? → A: `APPLIED`, `VIEWED`, `SHORTLISTED`, `INTERVIEWING`, `OFFERED`, and `WAITLISTED` may transition to canonical `REJECTED`; terminal or already-rejected applications cannot use this command.
- Q: Does rejection require double confirmation? → A: No. One explicit confirmation modal is sufficient; a standardized reason is mandatory, internal note is optional, destructive action is not default-focused, and Enter alone does not submit it.
- Q: Are rejected candidates hidden by default? → A: Yes, only in the `ACTIVE_PIPELINE` default status filter. The interface states that rejected candidates are excluded and provides a removable filter or `ALL`/`REJECTED` selection; direct authorized access remains available.
- Q: Is a rejection notification sent? → A: Not in this feature. Only Move to interview requires a candidate notification. Internal rejection notes are never candidate-visible or notification content.
- Q: What is low AI confidence? → A: Confidence below 70% is labelled `Low confidence` and includes a textual caution; it does not change the formula or trigger a stage action.
- Q: How many failed AI retries trigger support guidance? → A: Three consecutive failed AI attempts for the same input/config lineage display `Repeated AI failure — try later or contact support`; retries remain bounded and idempotent.
- Q: Must every action have confirmation? → A: Rescore, AI retry, priority set/change/removal, move-to-interview, and reject require an explicit confirmation intent; API writes additionally require an idempotency key and expected version where concurrency is material.

## 1. User Stories

### User Story 1 — Receive an automatic match independently of AI (Priority: P1)

As a Recruiter, I want a deterministic CV-to-JD score with skill, experience, and source evidence so that I retain useful evaluation support when AI is unavailable.

**Why this priority**: This is the reliable, explainable base for every later scoring capability.

**Independent test**: Disable the AI provider, score one valid application, and verify that a 0–100 automatic score, found/missing/preferred skills, experience outcome, evidence references, parser provenance, and incompleteness warning where applicable are returned without a hybrid score.

**Acceptance scenarios**:

1. **Given** versioned CV and JD snapshots, **when** automatic matching completes, **then** the same inputs and config produce the same 0–100 score and explanation.
2. **Given** AI is unavailable, **when** scoring runs, **then** automatic output is published and readable while AI is `Unavailable` and final score is `Not calculated`.
3. **Given** experience cannot be established, **when** evidence is returned, **then** detected experience is explicitly `Not detected` rather than inferred or blank.

### User Story 2 — Review an explainable AI assessment and hybrid score (Priority: P1)

As a Recruiter, I want a bounded AI assessment and explicit 60/40 calculation so that I can understand the recommendation without treating it as a decision.

**Why this priority**: It supplies the semantic component and auditable final ranking required by the ranking screens.

**Independent test**: With a valid provider response, verify AI score, confidence, model/prompt/provider versions, summary, evidence-based strengths, points to verify, compliance statement, suggested questions or fallback, and exact hybrid formula/provenance.

**Acceptance scenarios**:

1. **Given** automatic score 92 and AI score 88, **when** both publish, **then** final score is 90.4 and the response states `92 × 0.6 + 88 × 0.4 = 90.4` with all input/config versions.
2. **Given** confidence is below 70%, **when** assessment is read, **then** it carries an explicit low-confidence label and human-review caution without modifying the score.
3. **Given** too little evidence exists for questions, **when** the assessment is read, **then** it contains the explicit question fallback instead of an empty list.

### User Story 3 — Rank, filter, and paginate scored candidates (Priority: P1)

As a Recruiter, I want stable score-aware ranking and combined filters so that I can triage a large job fairly without losing or duplicating candidates.

**Why this priority**: Scores become useful only through a trustworthy job-scoped list.

**Independent test**: Traverse a 10,000-application job using final-score order, change page size, combine score/skill/experience/status/scoring-status filters, complete a rescore mid-browse, and verify stable snapshot traversal with no duplicate or missing row.

**Acceptance scenarios**:

1. **Given** no explicit sort, **when** the ranked list loads, **then** published hybrid scores sort descending with deterministic tie-breakers and non-final rows follow in a distinct non-numeric group.
2. **Given** a score range, **when** filtering applies, **then** rows without a published final score are excluded and the response reports how many processing rows were excluded.
3. **Given** active filters, **when** results are shown, **then** each condition is returned as a machine-readable removable chip and can be combined with the others.
4. **Given** a cursor traversal already started, **when** a rescore publishes, **then** subsequent pages use the traversal’s ranking snapshot; a fresh traversal sees the new ranking.

### User Story 4 — Rescore a job without disrupting review (Priority: P1)

As a Recruiter, I want to rescore a campaign in the background while retaining current results and manual priority so that evaluation can continue safely.

**Why this priority**: JD, parser, and scoring configuration changes require controlled recalculation at campaign scale.

**Independent test**: Start a confirmed rescore while a detail drawer is open, observe old scores until atomic replacements publish, verify manual priorities persist, and verify candidate-level AI failures do not fail the batch.

**Acceptance scenarios**:

1. **Given** an authorized confirmed request, **when** rescore starts, **then** the API returns immediately with batch identity, scope, versions, and background status.
2. **Given** a rescore is pending, **when** old results are read, **then** they remain valid and ungreyed with a separate rescore-in-progress indicator.
3. **Given** zero applications, **when** rescore is requested, **then** a completed zero-item batch and audit event are returned without worker errors.

### User Story 5 — Retry one failed AI assessment (Priority: P1)

As a Recruiter, I want to retry only the AI portion for one candidate so that a transient provider failure can recover without changing valid deterministic evidence.

**Why this priority**: Deterministic fallback needs a safe recovery path.

**Independent test**: From `Unavailable`, confirm retry and verify automatic result identity is unchanged, AI becomes pending/processing, then either a complete hybrid result publishes or fallback returns with attempt guidance.

**Acceptance scenarios**:

1. **Given** AI is `Unavailable`, **when** retry is confirmed, **then** the deterministic result is not recomputed and stays readable.
2. **Given** retry succeeds or fails, **when** the drawer is reopened, **then** it reflects the latest persisted state without requiring the original request to remain open.

### User Story 6 — Set or remove manual priority (Priority: P2)

As a Recruiter, I want a reasoned priority override distinct from scoring so that human judgment can guide review without rewriting evidence.

**Why this priority**: Human-controlled recruitment requires an explicit, durable override mechanism.

**Independent test**: Set, change, rescore, and remove priority; verify actor, reason, timestamps and history, one active priority, unchanged scores, and optimistic-concurrency conflict behavior.

**Acceptance scenarios**:

1. **Given** a value and non-blank reason, **when** priority is saved, **then** one active record and a distinct `Manually prioritized` label appear.
2. **Given** two recruiters update the same priority version, **when** both submit, **then** one succeeds and the stale write receives a conflict without overwriting the winner.

### User Story 7 — Move a candidate to interview (Priority: P2)

As a Recruiter, I want to explicitly move an eligible application to Interviewing so that the stage history and candidate notification reflect my decision.

**Why this priority**: This is the first positive recruiter-owned pipeline decision supported by this feature.

**Independent test**: Confirm from every allowed source stage and verify atomic stage/version update, `ApplicationStageEvent`, audit record, idempotent notification request, and immediate response projection.

**Acceptance scenarios**:

1. **Given** an allowed source stage and expected version, **when** an authorized recruiter confirms, **then** stage becomes canonical `INTERVIEWING`, actor/time/reason are queryable, and the candidate is notified exactly once.
2. **Given** `REJECTED` or another disallowed stage, **when** the command is attempted, **then** no write occurs and an explicit invalid-transition response is returned.

### User Story 8 — Reject a candidate with a standardized reason (Priority: P2)

As a Recruiter, I want to explicitly reject an eligible application with an allowlisted reason and optional private note so that the decision is accountable and reportable.

**Why this priority**: Rejection has serious candidate impact and requires stronger validation and privacy boundaries.

**Independent test**: Confirm rejection with and without required reason, test every allowed source stage, race it against interview transition, and verify history/audit fields while proving the internal note is absent from candidate-facing data and notifications.

**Acceptance scenarios**:

1. **Given** no allowlisted reason, **when** rejection is submitted, **then** it is blocked with no stage or audit-success mutation.
2. **Given** an allowed reason and current version, **when** rejection commits, **then** stage becomes canonical `REJECTED` with actor/time/reason and optional internal-only note.
3. **Given** reject and interview commands race on the same version, **when** one commits, **then** the other receives a conflict and no contradictory event is created.

## 2. Scope

### In scope

- Versioned deterministic, AI, and hybrid scoring against immutable Group 1 application evidence and a versioned JD snapshot.
- Parser status/provenance, skill/experience extraction, evidence excerpts, confidence, explanations, compliance statement, and interview-question generation/fallback.
- Background initial scoring, job rescore, candidate AI retry, bounded provider failure handling, and immutable published results.
- Score-aware list sorting/filtering/snapshot pagination and explicit exclusions.
- Audited manual priority and the two explicit canonical stage-transition commands.
- Reuse of Group 1 document viewers and authorization boundary.

### Out of scope

- Automated pipeline transitions, hiring recommendations that execute decisions, bulk rejection/advancement, or score-threshold actions.
- Changing 60/40 weights, approved score bands, canonical stage enum, or Group 1 submission/document authority.
- Reopening `REJECTED`, undo rejection, interview scheduling, candidate rejection notification, editable scoring, recruiter-authored AI text, or general pipeline/Kanban ownership.
- A second CV/JD access path, a second Application aggregate, or persistent raw provider payloads.

## 3. Functional Requirements

- **FR-001**: The system MUST compute a deterministic 0–100 automatic score from versioned required skills and relevant experience and MUST remain functional without AI.
- **FR-002**: Automatic output MUST identify found and missing required skills, neutral preferred skills, required/detected experience, and verbatim evidence with page or section references; absence MUST be explicit.
- **FR-003**: Every extraction MUST identify CV snapshot, JD version, parser name/version, parse status, processing time, and evidence schema version.
- **FR-004**: Parse states MUST be `PARSED_SUCCESSFULLY`, `PARSED_WITH_ERRORS`, or `FAILED`; affected score views MUST carry `mayBeIncomplete=true` plus a textual label when either input parse is not successful.
- **FR-005**: AI MUST run asynchronously behind a provider-independent boundary with timeout, schema validation, bounded retries/backoff, circuit breaking, and content-safe errors.
- **FR-006**: Provider timeout, malformed output, or exhausted retry MUST resolve the AI portion to `Unavailable`; it MUST NOT fail the deterministic result or synchronous recruiter read.
- **FR-007**: Successful AI assessment MUST include score 0–100, confidence 0–100, provider/model/prompt/policy versions, labelled AI summary, evidence-based strengths, points to verify, concise breakdown, and the statement `Sensitive personal attributes are excluded from scoring.`
- **FR-008**: Confidence below 70 MUST return `LOW_CONFIDENCE` and human-review guidance; confidence MUST NOT alter score weights or stage.
- **FR-009**: Suggested questions MUST trace to points-to-verify or return `INSUFFICIENT_DATA` with a non-empty fallback message.
- **FR-010**: Hybrid score MUST equal deterministic × 0.6 + AI × 0.4, rounded to one decimal using the recorded formula version, weights, thresholds, CV/JD/config versions, and computed time.
- **FR-011**: A hybrid final score MUST exist only when both component scores succeeded for the same input/config lineage.
- **FR-012**: APIs MUST represent `Not calculated`, `Pending`, `Unavailable`, and `Processing` as mutually exclusive typed variants with explicit labels; no variant may rely on a color token.
- **FR-013**: Score bands MUST be `HIGH_MATCH` 80–100, `MEDIUM_MATCH` 60–79.9, and `LOW_MATCH` below 60 with text and icon semantics in every projection.
- **FR-014**: Published score aggregates MUST be immutable. Scores MUST NOT be hand-edited; only explicit initial scoring, full rescore, or AI-only retry may publish a successor under their defined rules.
- **FR-015**: Rescore MUST return immediately, preserve the last published aggregate until an atomic successor commit, preserve manual priority, isolate per-application failure, and audit actor/time/scope/config.
- **FR-016**: AI-only retry MUST require prior `Unavailable`, preserve the automatic-result identity, be idempotent while running, and expose repeated-failure guidance after three consecutive failures.
- **FR-017**: Ranked list default order MUST be published final score descending, then submitted time descending, then application ID descending; rows without final score MUST form a labelled non-numeric group and MUST NOT be treated as zero.
- **FR-018**: Score, skill, experience, application-stage, and scoring-status filters MUST combine, be returned as removable typed chips, and remain tenant/job scoped.
- **FR-019**: A score-range filter MUST exclude rows without final score and return `processingExcludedCount` with an explicit explanation.
- **FR-020**: Score-aware cursors MUST bind job, filters, order, page size, and immutable ranking snapshot. Page-size change MUST restart from an explicit anchor or first page; it MUST NOT reinterpret an old cursor.
- **FR-021**: Manual priority set/change/remove MUST require authenticated actor, server time, non-blank reason, expected version, one active record, immutable history, and an audit event; it MUST never alter score data and MUST survive rescore.
- **FR-022**: Move-to-interview MUST validate the allowlisted source stages and expected `JobApplication.stageVersion`, atomically update canonical `JobApplication.stage`, append the existing `ApplicationStageEvent`, append audit data, and enqueue one candidate notification.
- **FR-023**: Reject MUST require an allowlisted reason, validate source stage/version, atomically update canonical stage, append existing stage/audit records, and keep optional internal note recruiter-only.
- **FR-024**: Every recruiter decision MUST persist first-class actor, action, timestamp, and applicable reason fields; free-text audit blobs alone are insufficient.
- **FR-025**: No score, band, confidence, priority, provider output, or rescore result MAY automatically change `JobApplication.stage`.
- **FR-026**: All reads/writes MUST revalidate Recruiter role plus current company/job authority; client identifiers alone grant no access.
- **FR-027**: The CV/Cover Letter tab MUST reuse Group 1 document viewer routes/components and extend `RecruiterApplicationService` authorization rather than introduce another byte-access path.
- **FR-028**: Rescore, retry, priority, interview, and reject commands MUST require explicit confirmation intent and idempotency protection; cancellation/ESC/outside close creates no write.
- **FR-029**: Rejected applications MUST be excluded only by the explicit default `ACTIVE_PIPELINE` filter, with exclusion text and accessible alternatives.
- **FR-030**: Every API score/state/tier/decision projection MUST include a machine-readable code and human-readable label; color MAY be optional presentation metadata but MUST never be the sole signal.

## 4. Edge Cases

- **AI timeout**: Automatic output publishes; AI becomes `Unavailable`; request threads do not wait beyond the provider deadline.
- **Malformed AI output**: Schema validation rejects it as unavailable, stores a safe failure code, and never exposes/persists raw provider text as an assessment.
- **Low confidence**: Full result may publish with warning; it never changes formula or stages.
- **Zero detected skills**: Automatic score remains deterministic; found list is empty, every required skill is missing, preferred list is neutral, and no evidence is fabricated.
- **Parser failure**: Score may use only safely extracted evidence, is marked potentially incomplete, and exposes status/version; total absence of safe inputs yields no fabricated score.
- **Open drawer during rescore**: The drawer continues serving its published aggregate and separately reports rescore progress; it moves to a successor only after complete atomic publication.
- **Concurrent priority writes**: Expected-version compare-and-set permits one winner and returns conflict plus current representation to the loser.
- **Concurrent reject/interview**: Stage-version compare-and-set and one current stage permit one winner; the loser cannot append a contradictory event or notification.
- **Zero-application rescore**: Completes successfully with counts all zero and an audit record.
- **Repeated retry click**: Same idempotency key returns the existing operation; while pending, another request does not enqueue duplicate work.
- **Rescore during initial scoring**: The newer job/config generation supersedes unpublished older work; stale workers cannot publish over it.
- **CV/JD version changes mid-run**: Result retains original lineage and publishes only if still expected; otherwise it is superseded and a new eligible operation owns publication.
- **Provider recovery after timeout**: Late responses from expired leases are discarded.
- **Notification delivery delay**: Stage commit remains authoritative; outbox retries notification without duplicating it and reports `notificationStatus` honestly.
- **Rejected default visibility**: A fresh active-pipeline view hides rejected rows with explicit exclusion copy; `ALL` and `REJECTED` retrieve them.

## 5. Acceptance Criteria

- [ ] Automatic matching returns a deterministic 0–100 result and complete explanation without AI.
- [ ] The same CV/JD/config/parser lineage reproduces the same automatic score.
- [ ] Found, missing and preferred skills are distinct; preferred skills are neutral.
- [ ] Experience is a value with evidence or the explicit label `Not detected`.
- [ ] Evidence excerpts are verbatim and carry page or section references plus snapshot/parser provenance.
- [ ] Parser success/error/failure is explicit and affected scores say they may be incomplete.
- [ ] AI output contains score, confidence, versions, summary, strengths, verification points, breakdown, and sensitive-attribute exclusion statement.
- [ ] Malformed, timed-out, or failed AI cannot block or erase deterministic output.
- [ ] Confidence below 70 has a non-color textual warning and no automated consequence.
- [ ] Suggested questions derive from verification points or show an explicit insufficient-data fallback.
- [ ] Every final score exposes the exact 60/40 calculation, weights, thresholds, CV/JD/config/model/prompt provenance, and computed time.
- [ ] No hybrid number is returned until compatible deterministic and AI components both succeed.
- [ ] `Not calculated`, `Pending`, `Unavailable`, and `Processing` are distinct typed states and labels.
- [ ] No state, tier, success, warning, or failure relies on color alone.
- [ ] No code path changes an application stage purely because of score, band, confidence, priority, or AI output.
- [ ] Scores support decisions only; every decision endpoint requires an authenticated human actor and explicit confirmation.
- [ ] Published score records are immutable and replaced only through an explicit authorized scoring operation.
- [ ] Job rescore is background, keeps old results readable, preserves manual priority, isolates failures, and handles zero applications.
- [ ] AI retry recomputes only AI and preserves the automatic-result identity.
- [ ] Default score sorting never treats processing/unavailable rows as score zero.
- [ ] Combined filters are reflected as typed removable chips.
- [ ] Score filtering excludes non-final rows and reports the exclusion count and reason.
- [ ] Snapshot-bound pagination has no duplicate/missing row when a rescore commits mid-traversal.
- [ ] Changing page size cannot reinterpret an incompatible cursor.
- [ ] Manual priority has one active value, required reason, actor/time/version/history, distinct label, and survives rescore without score mutation.
- [ ] Move-to-interview accepts only allowed source stages, writes canonical stage/event/audit atomically, and notifies exactly once.
- [ ] A rejected application cannot move directly to interview through this feature.
- [ ] Reject requires an allowlisted reason, stores optional note internally only, and writes canonical stage/event/audit atomically.
- [ ] Racing stage decisions yield one current stage and no contradictory event or duplicate notification.
- [ ] Default active-pipeline filtering explicitly excludes rejected rows and offers retrieval alternatives.
- [ ] Cross-company, stale-membership, and foreign-ID access reveals no score, evidence, note, document, or decision data.
- [ ] CV/Cover Letter access uses the existing Group 1 viewer/authorization boundary.

## 6. Success Criteria

- **SC-001**: For 100% of tested AI failure modes, Recruiters receive valid deterministic output without a fabricated final score.
- **SC-002**: 100% of published final scores reproduce from stored component values, weights, rounding rule, and provenance.
- **SC-003**: AI scoring completes asynchronously at P95 within 20 seconds under documented normal test conditions.
- **SC-004**: Ranked/filter pages for a 10,000-application job become usable at P95 within 2 seconds under documented representative conditions.
- **SC-005**: A 10,000-application rescore accepts the command within 2 seconds, continues in background, and reports accurate per-outcome counts; processing throughput and completion time are documented rather than hidden.
- **SC-006**: Across repeated snapshot traversals with a rescore mid-browse, zero duplicate or missing application occurs.
- **SC-007**: 100% of priority and pipeline decisions retain queryable actor/time/reason fields and pass tenant authorization tests.
- **SC-008**: 100% of interview transitions create exactly one stage event, one success audit, and one idempotent candidate-notification intent.

## 7. Assumptions and Dependencies

- Feature 012 Group 1 is implemented or its documented authorities are available: immutable application documents, job-scoped authorization, `RecruiterApplicationService`, canonical stages/events/audit, and document viewers.
- JD snapshots and structured required/preferred criteria can be versioned without changing candidate-facing job history.
- The shared audit retention baseline remains 365 days unless a stricter policy applies; evidence/assessment retention follows the application-document purpose deadline and is denied/deleted with its source evidence.
- `ACTIVE_PIPELINE` is a filter policy, not a new application stage.
