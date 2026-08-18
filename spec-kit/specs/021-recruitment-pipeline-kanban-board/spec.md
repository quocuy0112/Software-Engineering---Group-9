# Feature Specification: Recruitment Pipeline Kanban Board

**Feature Branch**: `021-recruitment-pipeline-kanban-board`

**Feature Directory**: `021-recruitment-pipeline-kanban-board`

**Created**: 2026-08-16

**Status**: Draft

**Input**: Create a complete P0, job-scoped recruitment pipeline Kanban board in the existing recruiter candidate/application workspace. Reuse the current application, stage, authorization, history, audit, notification, document, and optional scoring foundations while preserving human-controlled decisions, tenant isolation, concurrency safety, accessibility, and the nine canonical stages.

## Clarifications

### Session 2026-08-16

- Q: Which company roles may use the pipeline? → A: `OWNER` may view the board but is read-only; `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER` may view, move stages, reject, and explicitly confirm `HIRED` within their authorized company scope.
- Q: Must SmartHire contain a recorded candidate offer acceptance before an application can become `HIRED`? → A: No. Acceptance may occur inside or outside SmartHire, but only an explicit authorized recruiter-side confirmation may set `HIRED`; candidate activity and AI output cannot do so.
- Q: Does the first Kanban combine applications from multiple jobs? → A: No. Feature 019 is job-scoped; a company-wide multi-job board is outside scope.
- Q: What happens to the pipeline when the selected job is closed or later becomes unavailable? → A: Closing a job does not erase or freeze its existing application pipeline; authorized members may continue viewing it and permitted roles may continue valid stage decisions. If the job is removed, cannot be resolved uniquely, or is no longer authorized, the board fails safely and does not present its stale application data as current.
- Q: Who records `OFFER_DECLINED` in Feature 019? → A: An authorized `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER` records a known decline from `OFFERED` with the required reason; it is a terminal recruiter-side pipeline record and does not add a candidate-side offer workflow.
- Q: Which rejection reasons are accepted? → A: The existing allowlist remains authoritative: Required technical experience not demonstrated, Insufficient experience, Required skills not demonstrated, Position filled, Application withdrawn by candidate, and Other job-related reason.
- Q: What must an exact retry after a lost response do? → A: It converges on the already committed transition outcome without creating another transition or notification; a different later decision must use the latest authoritative application state.

- Q: What application volume must one job-scoped board support? → A: Preserve the existing scale baseline of up to 10,000 applications for one job. The board may reveal data incrementally, but every authorized application must remain discoverable and actionable without requiring all cards to render at once.

## User Scenarios & Testing *(mandatory)*

All stories below are P1 because they jointly form one constitution-complete P0 recruitment workflow. A visual board without secure reads, authoritative mutation, consequential-decision safeguards, recovery, accessibility, and candidate communication is not a releasable increment.

### User Story 1 - View One Authorized Job Pipeline (Priority: P1)

As an authorized company recruitment member, I want to select one job and see its applications grouped by canonical recruitment stage so that I can understand the current campaign pipeline at a glance.

**Why this priority**: Correct, tenant-isolated visibility is the foundation for every later pipeline action. No mutation is safe until the selected job and its owning company are resolved consistently.

**Independent Test**: Select jobs ranging from zero through 10,000 applications distributed across the nine stages and verify that every authorized application remains discoverable in the correct column, while empty and unauthorized jobs reveal no other application data.

**Acceptance Scenarios**:

1. **Given** an authenticated user with an active qualifying membership in a verified company, **When** the user selects a job owned by that company and opens Kanban view, **Then** the board displays that job's applications grouped into the nine canonical stage columns.
2. **Given** an authorized job with no applications, **When** the board loads, **Then** it displays a clear job-level empty state without implying a loading or authorization failure.
3. **Given** a stage containing no applications, **When** the board loads, **Then** that canonical stage remains visible with an understandable empty-column state.
4. **Given** an `OWNER` with valid company access, **When** the owner opens the board, **Then** the owner can inspect the job pipeline and existing authorized application details but cannot use stage-changing controls.
5. **Given** a job selector value that is missing, stale, ambiguous, incorrectly mapped, or belongs to another company, **When** the board is requested, **Then** the request fails safely and exposes no application or candidate information.
6. **Given** a correctly selected job that owns persisted applications, **When** the board is loaded, **Then** internal job-identifier differences do not cause the job to appear incorrectly empty.
7. **Given** a selected job is closed to new applications but remains owned by an active verified company, **When** an authorized member opens its board, **Then** its existing application pipeline remains available and permitted roles may continue valid stage decisions.
8. **Given** a previously selected job is removed, no longer resolves uniquely, or is no longer authorized, **When** the board refreshes or a mutation is attempted, **Then** it reports the unavailable state and does not continue presenting the stale application data as current.

---

### User Story 2 - Move Applications Through Ordinary Stages (Priority: P1)

As an authorized HR Manager, Recruiter, or Hiring Manager, I want to move an application to an allowed stage by drag-and-drop or an accessible stage-change control so that the board reflects the team's human recruitment decision.

**Why this priority**: Moving applications is the principal value of a recruitment Kanban and must remain usable with or without a mouse.

**Independent Test**: From each non-terminal source stage, perform every allowed and disallowed ordinary transition using both drag-and-drop and the non-drag control, then verify that successful changes persist and invalid changes leave the application unchanged.

**Acceptance Scenarios**:

1. **Given** an authorized mutable role, a current application version, and an allowed destination, **When** the user moves the card and completes any required low-risk action, **Then** the application is persisted in the destination stage and the board confirms the authoritative result.
2. **Given** the same allowed transition, **When** a keyboard-only user invokes the stage-change control, selects the destination, and commits the action, **Then** the result is equivalent to a successful drag-and-drop transition.
3. **Given** a destination that is not allowed from the application's current stage, **When** the user attempts the move, **Then** no stage change is committed and the board explains that the transition is unavailable.
4. **Given** an ordinary low-risk allowed transition, **When** the user selects the destination, **Then** the workflow does not impose a consequential-decision confirmation intended for rejection or hiring.
5. **Given** a successful stage change, **When** the board reconciles, **Then** the card appears in exactly one canonical column and its scoring state is unchanged.
6. **Given** an `OWNER`, **When** the owner attempts a stage mutation through any client or direct request, **Then** the server denies the operation without changing the application.

---

### User Story 3 - Make Consequential Recruitment Decisions (Priority: P1)

As an authorized HR Manager, Recruiter, or Hiring Manager, I want explicit safeguards for rejection, offer decline, and hiring so that consequential decisions are intentional, explainable where required, and attributable to a human.

**Why this priority**: Rejection and hiring materially affect candidates and carry stronger confirmation, reason, communication, and audit obligations than ordinary pipeline progression.

**Independent Test**: Attempt rejection, offer decline, and `OFFERED → HIRED` from allowed and disallowed conditions, with missing and valid reasons, cancelled and confirmed actions, every company role, candidate activity, and score changes; verify that only an eligible human confirmation commits the intended result.

**Acceptance Scenarios**:

1. **Given** an eligible source stage and an authorized mutable role, **When** the user chooses `REJECTED`, provides an allowed rejection reason, and explicitly confirms, **Then** the rejection is committed with its required history, audit information, and configured candidate communication.
2. **Given** a rejection with no valid required reason, **When** the user attempts to confirm, **Then** the decision is blocked and no successful transition record or notification is created.
3. **Given** a rejection workflow containing an existing optional recruiter-private note, **When** the rejection commits or candidate information is later displayed, **Then** that private note is never included in candidate-visible history, messages, notifications, or application data.
4. **Given** an allowed move to `OFFER_DECLINED`, **When** the actor omits the reason required by the current recruitment domain, **Then** the transition is blocked without changing the application.
5. **Given** a candidate's decline is learned inside or outside SmartHire, **When** an authorized HR Manager, Recruiter, or Hiring Manager records the required reason and confirms `OFFERED → OFFER_DECLINED`, **Then** the application enters the terminal `OFFER_DECLINED` stage without requiring a new candidate-side offer workflow.
6. **Given** an application in `OFFERED`, **When** an authorized HR Manager, Recruiter, or Hiring Manager drags it toward `HIRED`, **Then** the system requires a separate explicit recruiter-side hiring confirmation before final commitment.
7. **Given** an authorized actor who confirms hiring, **When** the current `OFFERED → HIRED` transition succeeds, **Then** the application becomes `HIRED`, the human decision is recorded, and the required hiring confirmation email is triggered.
8. **Given** candidate offer acceptance inside SmartHire, candidate activity outside the recruiter workflow, or any AI/scoring result, **When** that event occurs without an authorized recruiter-side hiring confirmation, **Then** the application does not become `HIRED`.
9. **Given** no recorded in-app offer acceptance but an authorized actor has confirmed acceptance through an external or offline channel, **When** that actor explicitly confirms hiring, **Then** the absence of an in-app acceptance record does not by itself block an otherwise valid `OFFERED → HIRED` transition.
10. **Given** an `OWNER`, **When** the owner attempts to reject, decline an offer, or confirm hiring, **Then** the operation is denied and the current application state remains authoritative.

---

### User Story 4 - Recover from Concurrent and Failed Moves (Priority: P1)

As a recruitment team member, I want the board to detect stale decisions and recover from failed updates so that another person's newer decision is never silently overwritten and the board never pretends an uncommitted move succeeded.

**Why this priority**: Multiple recruitment members may work on the same job simultaneously. Lost updates would make the visible pipeline untrustworthy.

**Independent Test**: Load the same application for two authorized users, commit User A's move first, then attempt User B's stale move and inject network and server failures; verify that the newer state is preserved and every client reconciles visibly.

**Acceptance Scenarios**:

1. **Given** two users view the same current application state, **When** User A commits a valid move and User B later submits a move based on the stale state, **Then** User B's move fails without overwriting User A's decision.
2. **Given** a stale move, **When** the server returns the conflict outcome, **Then** the board explains that the application changed and reconciles the card to the latest authorized state.
3. **Given** a card is moved optimistically, **When** authorization, validation, network, or server persistence fails, **Then** the card does not remain in the unpersisted destination and the user receives a visible retry or recovery path.
4. **Given** the user cancels a confirmation, **When** the workflow closes, **Then** the card returns to or remains in its original stage and no transition history, audit-success record, or notification is produced.
5. **Given** a successful command whose response is lost and the same logical command is safely retried, **When** processing completes, **Then** the user receives or reconciles to the already committed outcome and the application has one resulting transition with no duplicate critical history, audit-success, or candidate communication.
6. **Given** a user intends a different decision after another transition has committed, **When** the user acts again, **Then** that decision is evaluated against the latest authoritative application state rather than treated as a retry of the earlier command.

---

### User Story 5 - Receive Reliable Candidate Status Communication (Priority: P1)

As a candidate, I want timely, non-duplicated communication when an authorized company member changes my application stage so that I understand the current outcome without repeatedly contacting the company.

**Why this priority**: Candidate communication is part of the P0 pipeline workflow and a mandatory consequence of status management, not an unrelated notification enhancement.

**Independent Test**: Commit each supported stage change, repeat requests, vary applicable email preferences, fail the external email channel, and verify the configured in-app and email outcomes without duplicate delivery or recruitment-state corruption.

**Acceptance Scenarios**:

1. **Given** a successful application stage transition, **When** it commits, **Then** the candidate receives the applicable in-app status notification independently of optional application-update email preferences.
2. **Given** a stage whose email communication is preference-controlled, **When** the transition commits, **Then** the existing candidate email preference is honored without suppressing required in-app communication.
3. **Given** a successful hiring confirmation, **When** `HIRED` commits, **Then** the constitution-required hiring confirmation email is triggered.
4. **Given** a retried or repeated transition request, **When** notification processing occurs, **Then** the candidate receives no more than one notification per required channel for the logical committed transition.
5. **Given** an external email delivery failure after the recruitment decision commits, **When** delivery is retried or ultimately fails, **Then** the committed recruitment stage remains correct and existing failure isolation and retry behavior are preserved.

### Edge Cases

- The authenticated account becomes inactive, the membership is suspended or removed, or the company loses verified/active status between board load and mutation.
- A user belongs to multiple companies and selects a job whose identifier resolves outside the active company context.
- A legacy or catalogue job reference has no unique persisted job mapping, maps to the wrong company, or becomes stale after the selector was rendered.
- A job closes to new applications after the board loads; its existing authorized pipeline remains usable and is not mistaken for a removed or unauthorized job.
- A job is removed, becomes unresolvable, or becomes unauthorized after the board loads; stale application data is no longer presented as current.
- An application is deleted, retained but inaccessible, or moved by another actor before a card action completes.
- A job has no applications, one stage is empty, or all applications are in terminal stages.
- A job has up to 10,000 applications; applications remain discoverable and actionable without requiring every card to be rendered at once.
- An application has no completed candidate score, scoring is pending or failed, or the scoring service is unavailable.
- The user drops a card back into its current column or onto a disallowed destination.
- A user begins dragging and then cancels, presses Escape, loses focus, or navigates away.
- A required rejection or offer-decline reason is missing, invalid, too long, or contains content that must remain private.
- An `OWNER` manipulates the client or issues a direct mutation request despite hidden or disabled controls.
- A candidate accepts an offer while a recruiter is viewing the board; the acceptance notifies the recruiter but does not move the card to `HIRED`.
- Two authorized actors submit different destinations for the same current application version.
- The server commits a transition but the client loses the response and retries.
- In-app notification creation, email enqueueing, or external email delivery encounters a failure.
- The board contains enough cards or long candidate identities to require scrolling, truncation, or responsive layout without losing stage meaning or controls.

## Requirements *(mandatory)*

### Canonical Transition Policy

Feature 019 preserves the existing server-defined transition policy. Destination availability in the board and non-drag control must be consistent with this policy, while the server remains authoritative.

| Current stage | Allowed destination stages |
| --- | --- |
| Applied | Viewed, Shortlisted, Interviewing, Offered, Rejected, Waitlisted |
| Viewed | Shortlisted, Interviewing, Offered, Rejected, Waitlisted |
| Shortlisted | Interviewing, Offered, Rejected, Waitlisted |
| Interviewing | Offered, Rejected, Waitlisted |
| Offered | Hired, Offer Declined, Rejected, Waitlisted |
| Waitlisted | Viewed, Shortlisted, Interviewing, Offered, Rejected |
| Hired | None |
| Offer Declined | None |
| Rejected | None |

A transition to the same stage is not a stage change. Reopening a terminal application is outside Feature 019.

### Functional Requirements

- **FR-001**: The system MUST provide a Kanban view inside the existing recruiter candidate/application workspace rather than creating a replacement recruiter workspace.
- **FR-002**: The board MUST operate on one explicitly selected active or closed job at a time and MUST NOT combine applications from multiple jobs; closing a job to new applications MUST NOT by itself erase, hide, or freeze its existing authorized pipeline.
- **FR-003**: For every board read or stage mutation, the selected job MUST resolve to exactly one persisted company-owned job that owns the relevant applications; missing, stale, invalid, ambiguous, or cross-company mappings MUST fail safely.
- **FR-004**: A correctly selected job with persisted applications MUST NOT appear empty because different internal job identifiers were treated as interchangeable.
- **FR-005**: Every board read and mutation MUST enforce authenticated user, active account, active membership, verified company, active company context, qualifying role, job ownership, and application ownership on the server.
- **FR-006**: A user with memberships in multiple companies MUST operate only within the company that owns the explicitly resolved selected job.
- **FR-007**: Unknown or unauthorized job/application requests MUST return a neutral failure without disclosing candidate identity, application existence, stage, score, document, or company-private information.
- **FR-008**: `OWNER`, `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER` MUST be able to view the authorized job board.
- **FR-009**: Only `HR_MANAGER`, `RECRUITER`, and `HIRING_MANAGER` MUST be able to request stage mutations, rejection, offer decline, or hiring confirmation.
- **FR-010**: `OWNER` MUST remain read-only for recruitment-pipeline decisions, and server authorization MUST reject any owner mutation regardless of client presentation.
- **FR-011**: The board MUST use exactly Applied, Viewed, Shortlisted, Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted as the canonical application stages.
- **FR-012**: Labels such as New, Screened, or Under Review MUST NOT replace a canonical label or become additional recruitment states.
- **FR-013**: The board MUST display all nine canonical columns, including understandable empty-column states, and group each accessible application into exactly one column according to authoritative recruitment stage; for a job with up to 10,000 applications, every authorized application MUST remain discoverable and actionable even when data is revealed incrementally.
- **FR-014**: Each card MUST provide application identity, sufficient candidate display identity, submission/application context, current stage, and the current concurrency state needed for a safe update.
- **FR-015**: Each card MUST preserve authorized access to existing application detail, CV, cover-letter, or equivalent application-review functionality without broadening existing data permissions.
- **FR-016**: Existing candidate score information MAY be shown when available, but a missing, pending, failed, or unavailable score MUST NOT prevent the card from appearing or the pipeline from operating.
- **FR-017**: Recruitment stage and AI/scoring processing status MUST remain visibly and behaviorally separate.
- **FR-018**: The board MUST provide clear initial loading, job-empty, column-empty, unavailable, error, retry, and stage-change-pending states.
- **FR-019**: The board MUST support drag-and-drop stage movement and an equivalent explicit non-drag stage-change control.
- **FR-020**: Keyboard-only users MUST be able to identify a card, invoke its stage-change control, select an allowed destination, complete any required reason or confirmation, and understand the result.
- **FR-021**: Every stage change MUST be initiated by an authenticated, authorized human actor and validated against the canonical transition policy by the server.
- **FR-022**: An invalid, same-stage, terminal-source, unauthorized, or stale transition MUST leave recruitment state unchanged and MUST NOT produce a successful transition history, audit-success record, or notification.
- **FR-023**: A successful transition MUST apply to exactly the intended application within the authorized selected job and company context.
- **FR-024**: A stage transition MUST change recruitment stage without changing scoring status, score values, score explanation, or scoring history.
- **FR-025**: Kanban mutations MUST use one consistent authoritative application-stage behavior and MUST NOT introduce a second board-specific shortcut that bypasses existing domain rules.
- **FR-026**: A successful stage change MUST persist the new stage and required transition history, audit information, and transaction-compatible notification intent as one consistent critical operation.
- **FR-027**: Every successful transition MUST retain the application, previous stage, new stage, human actor, timestamp, current resulting version, result, and any reason required for that decision.
- **FR-028**: Repeated, retried, or concurrent commands MUST prevent duplicate critical stage events, successful audit outcomes, and candidate communications for one logical transition. An exact retry after a lost response MUST return or reconcile to the already committed outcome rather than apply the transition again; a different later decision MUST be evaluated against the latest authoritative application state.
- **FR-029**: A stage command MUST carry or resolve the application's current concurrency state, and a stale command MUST fail without overwriting a newer committed decision.
- **FR-030**: After a stale or failed update, the board MUST visibly reconcile the card with the latest authorized server state and provide understandable recovery guidance.
- **FR-031**: If a card is moved optimistically, the visual state MUST be confirmed by the authoritative persisted result or visibly restored/reconciled when persistence fails.
- **FR-032**: Cancelling a confirmation MUST create no stage change, history event, audit-success result, or candidate notification.
- **FR-033**: Moving to `REJECTED` MUST require an explicit action by `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER`, one clear confirmation, and exactly one reason from the existing allowlist: Required technical experience not demonstrated, Insufficient experience, Required skills not demonstrated, Position filled, Application withdrawn by candidate, or Other job-related reason.
- **FR-034**: Rejection history and audit information MUST preserve the required reason, while any permitted recruiter-private note MUST remain unavailable to candidates and candidate communications.
- **FR-035**: Moving from `OFFERED` to terminal `OFFER_DECLINED` MUST be recorded by an authorized `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER`, preserve the reason requirement defined by the current recruitment domain, and remain explicitly human-controlled, validated, company-scoped, and auditable. Feature 019 MUST NOT require or create a candidate-side offer-response workflow for this record.
- **FR-036**: Only `HR_MANAGER`, `RECRUITER`, or `HIRING_MANAGER` MAY confirm `OFFERED → HIRED`; `OWNER` MUST NOT confirm hiring.
- **FR-037**: Dragging a card toward `HIRED` MUST NOT silently finalize hiring; a separate explicit recruiter-side hiring confirmation action MUST occur before commitment.
- **FR-038**: A recorded SmartHire candidate offer acceptance MUST NOT be required for an otherwise valid authorized hiring confirmation, because acceptance may occur through an external or offline channel.
- **FR-039**: Candidate offer acceptance, other candidate activity after application submission, AI output, score, score band, confidence, recommendation, or automated processing MUST NOT independently make a recruiter-controlled pipeline decision or set HIRED, REJECTED, or otherwise progress an existing application through recruiter-controlled stages without an authorized human recruitment decision.
- **FR-040**: A successful HIRED confirmation MUST set the application to HIRED, retain the human actor and required history/audit information, and trigger the constitution-required hiring confirmation email.
- **FR-041**: Successful application stage changes MUST create the applicable candidate communication through the existing notification system rather than a Kanban-specific notification subsystem.
- **FR-042**: Application stage changes MUST create an in-app candidate notification independently of optional application-update email preferences.
- **FR-043**: Email communication for ordinary stage changes MUST honor applicable existing communication preferences, while the constitution-required hiring confirmation email remains mandatory for a successful `HIRED` confirmation.
- **FR-044**: Candidate communications MUST be duplicate-safe for retries and concurrent attempts and MUST never contain recruiter-private notes or other internal-only information.
- **FR-045**: External email delivery failure MUST NOT corrupt or reverse committed recruitment state and MUST preserve the platform's existing failure isolation and retry behavior.
- **FR-046**: Correct transition history and audit persistence is part of Feature 019, but the feature MUST NOT require a new recruiter history or activity visualization.
- **FR-047**: Successful, pending, cancelled, invalid, unauthorized, stale, network-failed, and server-failed actions MUST produce distinguishable, understandable user-visible feedback.
- **FR-048**: A failed update MUST NOT leave a card displayed in a stage that the authoritative application never entered.
- **FR-049**: Focus MUST remain or return to a meaningful card or control after a successful move, cancelled confirmation, validation error, conflict, or rollback.
- **FR-050**: Stage, permission, success, warning, pending, and error states MUST NOT be communicated by color alone and MUST have descriptive text or accessible labels.
- **FR-051**: Ordinary low-risk transitions SHOULD avoid unnecessary confirmation dialogs; consequential rejection and hiring decisions MUST use their explicit confirmation behavior.
- **FR-052**: User-visible drag/move feedback MUST satisfy the project Kanban target of no more than 500 milliseconds at P95 under documented representative conditions.
- **FR-053**: Successful server persistence for a Kanban stage update MUST satisfy the project target of no more than two seconds at P95 under documented representative conditions.
- **FR-054**: Applicable committed in-app stage notifications MUST become visible within five seconds at P95 under documented representative conditions.
- **FR-055**: Feature 019 MUST reuse the existing application, stage, transition-policy, authorization, applicant retrieval, history, audit, notification, document-access, optional scoring, recruiter-workspace, and status-display foundations rather than defining replacement domain systems.

### Key Entities

- **Selected Job Pipeline Context**: The one authorized job and owning company whose applications may appear on the board. It has one unambiguous persisted identity and an active company-scoped authorization context.
- **Job Application**: The existing candidate submission for one job. Its recruitment stage, concurrency version, submission context, candidate/application snapshots, documents, and optional scoring references remain authoritative inputs to the board.
- **Application Card**: The authorized board representation of one job application, containing enough identity, context, stage, and concurrency information for review and safe movement without becoming a separate application record.
- **Application Stage**: The existing nine-value recruitment lifecycle state, separate from AI/scoring processing state.
- **Stage Transition**: One authorized human decision from a current stage to an allowed destination, including expected current state, resulting state, actor, time, result, and required reason or confirmation information.
- **Stage History Record**: The immutable application-level evidence of a successful stage transition, including previous stage, new stage, actor, timestamp, resulting version, and permitted reason information.
- **Audit Record**: The security and accountability evidence for the actor, action, target application, result, and timestamp without unnecessary candidate personal data.
- **Candidate Status Communication**: The existing in-app and applicable email communication associated with one committed application-stage event, including duplicate-prevention identity and channel outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For selected authorized jobs ranging from zero through 10,000 applications, 100% of applications remain discoverable in exactly one of the nine canonical columns, with zero non-canonical recruitment states created.
- **SC-002**: Authorization tests demonstrate zero cross-company application disclosures or successful cross-company/owner-read-only mutations across all supported membership and multi-company scenarios.
- **SC-003**: A correctly selected job with existing persisted applications returns those applications in 100% of job-identity compatibility scenarios; invalid, ambiguous, stale, and mismatched mappings disclose no application data.
- **SC-004**: At least 95% of authorized board openings, including the documented 10,000-application job workload, make the pipeline usable within two seconds without requiring all cards to render before interaction.
- **SC-005**: At least 95% of card moves provide visible feedback within 500 milliseconds, and at least 95% of valid stage changes reach a confirmed persisted result within two seconds under documented representative conditions.
- **SC-006**: In 100% of tested same-version races, at most one conflicting stage decision commits; every losing client receives conflict feedback and reconciles to the winner without a lost update.
- **SC-007**: 100% of successful transitions create exactly one resulting stage/history outcome with queryable actor and timestamp and the required audit result; failed or cancelled transitions create no audit-success or transition history.
- **SC-008**: 100% of tested `HIRED` transitions require an eligible recruiter-side human confirmation, trigger the required hiring confirmation email, and cannot be caused solely by candidate activity or scoring output.
- **SC-009**: 100% of tested rejection and offer-decline attempts without required valid reasons are blocked without stage, history-success, audit-success, or notification side effects.
- **SC-010**: Replaying a committed logical transition produces no more than one candidate communication per required channel, and at least 95% of committed in-app stage notifications become visible within five seconds under documented normal conditions.
- **SC-011**: Failure-injection scenarios demonstrate that network, server, and external email-channel failures never leave the board claiming an unpersisted stage and never corrupt an already committed recruitment decision.
- **SC-012**: Keyboard-only acceptance tests complete board navigation, ordinary stage movement, rejection, hiring confirmation, cancellation, and conflict recovery without requiring drag-and-drop or a pointer device.
- **SC-013**: Stage movement tests demonstrate zero changes to scoring status, score value, score explanation, or scoring history as a consequence of a Kanban transition.

## Assumptions

- Existing authentication, active-account enforcement, company verification, company membership, recruiter application authorization, application stages, transition policy, history, audit, notifications, email delivery, applicant retrieval, document access, scoring projections, and recruiter workspace remain available and are extended rather than replaced.
- The job selector presents jobs the user may attempt to access, but every board read and mutation independently revalidates the resolved job and company context on the server.
- Card ordering within a column uses a deterministic ordering consistent with existing application-list behavior. User-customized or manual card ordering is outside Feature 019.
- Existing score information is optional card enrichment. The board remains complete when scoring is absent, pending, failed, or unavailable.
- Existing retention and privacy rules for candidate applications, documents, history, audit, and notifications remain unchanged.
- The board targets the existing responsive web recruiter experience, with data-dense desktop use as the primary environment and usable narrow-screen behavior where the existing workspace supports it.
- Existing applicant-management requirements establish a scale baseline of up to 10,000 applications for one job. The bounded or incremental presentation technique is deferred to planning provided that all authorized applications remain discoverable and actionable.

## Dependencies

- Existing job posting and recruiter job-selection capability, including a safe association between the selected job and the persisted job that owns applications.
- Existing `JobApplication` lifecycle and canonical application-stage transition policy.
- Existing company verification and company-scoped membership authorization.
- Existing applicant retrieval and authorized application/CV/detail access.
- Existing application history and audit authorities.
- Existing unified in-app notification and email delivery/retry capabilities.
- Existing recruiter candidate/application workspace and shared loading, error, and stage-display patterns.
- Existing scoring result projection only when optional score display is selected during later planning.

## Out of Scope

- New AI scoring algorithms or modification of hybrid scoring logic.
- Automatic stage movement, rejection, advancement, or hiring based on AI score, score band, confidence, recommendation, or processing result.
- A new application domain model or a second recruitment-status model.
- A new notification subsystem or replacement of the existing notification infrastructure.
- Replacement or redesign of the existing recruiter workspace.
- A company-wide board combining applications from multiple jobs.
- Customizable pipeline stages.
- Bulk stage movement, bulk rejection, or bulk hiring.
- Recruitment analytics or CSV/Excel export.
- Interview scheduling or external calendar integration.
- Candidate assignment or ownership workflows.
- A new collaborative recruiter-note feature.
- Customizable cards, saved board layouts, or saved board configurations.
- A new recruiter history/activity drawer or timeline visualization.
- Reopening `HIRED`, `OFFER_DECLINED`, or `REJECTED` applications.
- A new candidate-side offer-management or offer-acceptance system.
