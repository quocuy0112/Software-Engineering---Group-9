# Phase 0 Research: Recruitment Pipeline Kanban Board

## Decision 1: Resolve every Recruiter job reference to one canonical `JobPosting.id`

**Decision**: Extend `RecruiterApplicationAuthorization` to return both the requested selector/catalogue job reference and the canonical persisted `JobPosting.id`. Resolve a direct `JobPosting.id` first; otherwise follow the unique `JobPostReviewAggregate.jobId -> publicJobPostingId` relation. Require the aggregate company, public job company, and authorized membership company to agree.

**Rationale**: The current selector and route use `RecruiterJob.id` from `jobs.json` (`RecruiterCandidatesPage`, `recruiterRoutes.candidateRanking`). Current authorization falls back to `authorizeLegacyRecruiterJobs` but returns that same legacy ID, while `RankedCandidateListService`, `ListSubmittedCandidatesService`, `CampaignScoringStatsService`, and `PrismaApplicationRepository` use it as `JobApplication.jobPostingId`. Feature 017 now persists the explicit mapping needed for newly reviewed jobs, whose generated `JobPosting.id` may differ. Existing seeded jobs often share IDs and therefore do not disprove the mismatch.

**Alternatives considered**:

- Guessing by slug/title/company: rejected because it can be stale or ambiguous and is not the repository's authoritative mapping.
- Changing the Recruiter selector to expose only database IDs: rejected because it would redesign the existing JSON-backed job workspace and break stable catalogue routes.
- Creating another job identity table/domain: rejected because `JobPostReviewAggregate.publicJobPostingId` already supplies the mapping.

## Decision 2: Make `ApplicationStageService` the single transition authority

**Decision**: Extend `ApplicationStageService.transition` with request-bound idempotency, target-specific confirmation/reason rules, strict mutation roles, selected-job binding, and mandatory Hired email behavior. Convert `RecruiterApplicationDecisionService` and its interview/rejection routes into thin compatibility adapters over that service.

**Rationale**: The general service already owns the complete nine-stage policy, serializable stage-version compare-and-set, stage history, in-app notification, preference-aware email outbox, and audit transaction. The decision service contributes useful idempotency, rejection allowlist, explicit confirmation, and private-note semantics but only for two targets and currently differs in CSRF, authorization, and notification behavior. Consolidating semantics into the general authority preserves more existing behavior than choosing the narrower service.

**Alternatives considered**:

- Use the decision service as the new authority: rejected because it duplicates transition source sets, supports only Interviewing/Rejected, and lacks general notification preferences and all nine transitions.
- Add a Kanban-only mutation service: rejected because it would create the divergence explicitly prohibited by the specification and constitution.
- Keep three services/routes independent: rejected because retries, reasons, permissions, and notifications would continue to vary by UI entry point.

## Decision 3: Bind idempotency to the complete normalized command without a schema change

**Decision**: Require a 16-128 character `Idempotency-Key`, calculate a deterministic digest over actor, selected/canonical job, application, expected version, target, normalized reason/note, and confirmation, and store the digest in `ApplicationStageEvent.metadata`. Replay only when the stored digest matches.

**Rationale**: `ApplicationStageEvent` already has nullable `idempotencyKey`, unique `(applicationId, idempotencyKey)`, unique `(applicationId, applicationVersion)`, and JSON metadata. These fields support exact retry convergence and changed-input conflict without a new receipt table. The event and unique notification/outbox keys also provide the one logical transition identity needed to prevent duplicate history, audit success, and delivery intents.

**Alternatives considered**:

- Replay solely by application/idempotency key: rejected because reusing a key with a different target or reason could incorrectly return an unrelated result.
- Add a new command-receipt table: rejected because existing stage-event identity and metadata are sufficient for this feature.
- Let the client infer a lost-response success after refresh: rejected because it cannot distinguish the same logical command from another actor's transition and does not guarantee duplicate-safe side effects.

## Decision 4: Use grouped counts plus independent cursor pagination per stage

**Decision**: Return board metadata/all-nine counts separately from bounded per-stage pages. Default column pages to 25 cards (maximum 100), ordered `submittedAt DESC, id DESC`, and bind signed cursors to the canonical job and stage. Fetch first pages in parallel and load later pages independently.

**Rationale**: The current ranked endpoint can project up to 10,000 rows but materializes the complete job set and ranking snapshot before returning at most 100 rows. Reusing that algorithm once per column would multiply work and couple board correctness to scoring. PostgreSQL already has `JobApplication(jobPostingId, stage, submittedAt)` and job/submission indexes; grouped counts and bounded stage queries preserve correct columns and full cursor traversal without transferring/rendering all cards. Optional score joins remain nullable.

**Alternatives considered**:

- Fetch/render all 10,000 applications: rejected by the clarified scale requirement and performance target.
- Reuse the ranked endpoint for each stage: rejected because it scans/materializes ranking state, carries unnecessary scoring/filter data, and would repeat that work nine times.
- One global page across all stages: rejected because a high-volume stage could starve other columns and make their counts/cards appear empty.
- Client-only virtualization after fetching all data: rejected because it reduces DOM work but not transfer, query, memory, or privacy exposure.

## Decision 5: Add `@dnd-kit/core@6.3.1` only at the presentation boundary

**Decision**: Add exact dependency `@dnd-kit/core@6.3.1`. Use its pointer and keyboard sensors, draggable/droppable primitives, cancellation, overlay, screen-reader instructions, and announcements. Do not add `@dnd-kit/sortable` because Feature 019 changes stages but does not introduce manual card ordering.

**Rationale**: Current `web/package.json` and lockfile contain no production DnD package; the only native drop code is the file-upload drop target in `apply-form-section.tsx`. The existing root `motion` dependency is an animation toolkit, not a complete multi-container DnD/accessibility contract. The stable core package is React-hook based, has TypeScript declarations, accepts React peer versions >=16.8, supports pointer and keyboard input, and exposes customizable instructions/live announcements. Official documentation identifies keyboard activation, Escape cancellation, multi-container droppables, and accessibility support: [installation](https://docs.dndkit.com/introduction/installation), [keyboard sensor](https://docs.dndkit.com/api-documentation/sensors/keyboard), [DndContext accessibility](https://docs.dndkit.com/api-documentation/context-provider), and [accessibility guide](https://docs.dndkit.com/guides/accessibility).

**Alternatives considered**:

- Native HTML5 drag events: rejected because touch/keyboard behavior, cross-column collision, cancellation, and screen-reader announcements would require substantial custom infrastructure.
- `motion`: rejected because it does not supply the required droppable target, keyboard sensor, or live-announcement semantics.
- `@dnd-kit/sortable`: rejected because ordering is deterministic and not user-customizable.
- New `@dnd-kit/react` API: considered, but the mature `@dnd-kit/core` API has a smaller migration/risk surface for this existing React codebase and fully covers non-sortable stage drops. The library stays isolated so it can be replaced later.
- React Aria collections: accessible, but adopting its collection model would be a broader UI-system change than the current workspace requires.

## Decision 6: Keep a first-class explicit stage control independent of DnD

**Decision**: Every mutable card exposes a focusable “Change stage” control populated from server-returned allowed destinations. Pointer/keyboard DnD and this control call the same client command and backend route. Consequential destinations always open the shared decision dialog; Hired never commits directly from `onDragEnd`.

**Rationale**: The specification requires keyboard-only completion and a non-drag alternative. A separate control remains operable if DnD initialization fails, is easier to test, and avoids relying solely on spatial interactions. Server-returned destinations keep the client presentation consistent with the canonical policy without making client controls authoritative.

**Alternatives considered**:

- Keyboard DnD alone: rejected because the spec explicitly requires a non-drag method and spatial movement is not equally usable for every user.
- A status dropdown that submits every selection immediately: rejected because Rejected, Offer Declined, and Hired require reason/confirmation handling.

## Decision 7: Use optimistic movement with operation-scoped rollback and targeted reconciliation

**Decision**: Keep a stable client operation record containing the original card/stage, target, expected version, normalized command, and idempotency key. Show an optimistic ordinary move, then confirm from the server response and refresh metadata plus affected columns. On failure restore/remove the optimistic copy and reload authoritative pages. On authorized 409, use the returned current stage/version and refresh affected columns; on unavailable/authorization loss, clear the board cache.

**Rationale**: This provides the required <=500 ms visual feedback while treating persistence as authoritative. Retaining the same key/payload for a retry handles a lost response. A genuinely new decision starts only after reconciliation and receives a new key/current version.

**Alternatives considered**:

- Pessimistic movement only: correct but less likely to meet the visual target and makes drag feel unresponsive.
- Optimistic movement without a saved inverse/original state: rejected because failures could leave the card in an unpersisted column.
- Full-board reload after every move: safe but unnecessary for 10,000 rows; targeted metadata/source/destination refresh provides the same authority with bounded work.

## Decision 8: Reuse the existing notification service, template, and email outbox

**Decision**: In the stage transaction create one `APPLICATION_STAGE_CHANGED` in-app notification for every committed transition. Enqueue the existing `application-stage-changed.v1` email when ordinary application-update preferences allow, and always enqueue it for Hired. Keep version-based deduplication keys and the existing outbox worker retry/failure isolation.

**Rationale**: `ApplicationStageService` already implements these channels transactionally, `createInAppNotification` has a unique deduplication key, `EmailOutbox.idempotencyKey` is unique, and the worker has exponential retry and provider isolation. The existing template explicitly states the application is now the target stage; for Hired this is the required hiring confirmation. The current decision service's no-notification rejection path is inconsistent and will disappear when routes delegate to the authority.

**Alternatives considered**:

- A Kanban notification service or queue: rejected as duplicate infrastructure.
- Direct provider send in the request transaction: rejected because external failure could extend or corrupt the critical recruitment operation.
- Honor optional email preference for Hired: rejected by the constitution and clarified specification.

## Decision 9: No database migration

**Decision**: Use the current Prisma schema and indexes. Store the command digest/source in event metadata and reuse current reason/private-note/notification fields.

**Rationale**: All canonical stages, version concurrency, job mapping, history uniqueness, audit storage, in-app dedupe, and email outbox already exist. The board is a projection and orchestration feature, not a new aggregate.

**Alternatives considered**:

- Add a Kanban card/column table: rejected because cards and columns are projections of `JobApplication.stage`.
- Add a second status/version: rejected because it would split authority and risk mixing pipeline and scoring state.
- Add a separate pipeline history table: rejected because `ApplicationStageEvent` already provides the required immutable history.

## Decision 10: Closed jobs remain operable; unavailable jobs invalidate client state

**Decision**: Permit canonical Active and Closed jobs in the resolver and mutation service. Do not gate stage changes on accepting new applications. Treat removed, unmapped, company-mismatched, inactive, or unauthorized jobs as neutral unavailable; the frontend discards cached board/application data on that result.

**Rationale**: The current campaign selector intentionally includes `active` and `closed`, and the clarified specification states closure does not freeze existing applications. `JobPosting` and review aggregates separately represent closure/removal, so the resolver can distinguish closed from unavailable without inventing a state.

**Alternatives considered**:

- Read-only closed pipelines: rejected because the clarified specification explicitly allows valid decisions.
- Continue displaying cached data after authorization/unavailable failure: rejected because it could present stale private data as current.
