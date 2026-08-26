# Feature Specification: Candidate Application Tracking and Private CV Match

**Feature Branch**: `020-candidate-application-tracking-and-private-cv-match`

**Feature Directory**: `spec-kit/specs/020-candidate-application-tracking-and-private-cv-match`

**Created**: 2026-08-15

**Status**: Ready for implementation planning

**Input**: Candidate-side application review, submission, processing, status tracking, and an independent private CV match check that reuses the approved 40% automatic matching and 60% AI evaluation method without exposing or influencing recruiter-side evaluation.

## Clarifications

### Session 2026-08-15

- Q: How should a successfully withdrawn application be represented? → A: Record an immutable candidate-initiated terminal withdrawal outcome and timestamp, remove the application from active processing, and show public Outcome: Withdrawn while preserving its last canonical recruiter stage.
- Q: How long should a saved Private CV Match Check remain available? → A: Retain it for 12 months from creation unless the Candidate deletes it sooner; revoke ordinary access immediately at deletion or expiry and physically delete its private derived data within 30 days.
- Q: What scope should the email and in-app notification toggles have? → A: Store independent email and in-app preferences per submitted Application; changing one Application's settings does not affect another current or future Application.
- Q: How should saved application drafts be retained? → A: Keep at most one draft per candidate-job pair and expire it 30 days after its latest successful edit.
- Q: When Retry AI succeeds after limited mode, how should the result be retained? → A: Update the same Private CV Match Check's current display to the completed hybrid report while retaining immutable timestamps and outcomes for all prior analysis attempts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and submit an application (Priority: P1)

As a logged-in Candidate, I want to review my personal information, message, and exact application files before confirming submission so that I knowingly send a complete, immutable application to the recruiter.

**Why this priority**: A valid, informed submission is the entry point to the candidate-side recruitment workflow and an existing P0 product capability.

**Independent Test**: Complete the first two wizard steps, review the consolidated submission, accept the confirmation, submit once, and verify that exactly one application is created with immutable CV and job-description snapshots and no recruiter-internal evaluation is disclosed.

**Acceptance Scenarios**:

1. **Given** a Candidate has selected a valid CV and supplied all required personal information, **When** the Candidate opens Review and submit, **Then** the page shows the personal information, CV, optional cover letter, optional one-way recruiter message, and a consolidated files-to-be-submitted checklist, with controls to return and change editable inputs before submission.
2. **Given** the Candidate has not confirmed that the displayed information is correct, **When** the Candidate attempts to submit, **Then** submission is prevented and the confirmation requirement is identified accessibly.
3. **Given** the Candidate has confirmed a valid application, **When** the Candidate selects Submit application, **Then** exactly one authoritative Application is accepted for that candidate-job pair, starts in `Applied`, binds immutable submission-time CV and optional cover-letter snapshots plus the applicable JD version, and receives an Application ID and acceptance timestamp.
4. **Given** a submission request is repeated because of a retry, double click, or uncertain network result, **When** the same candidate-job submission is processed again, **Then** no duplicate Application is created and the Candidate is directed to the existing result.
5. **Given** the application has been accepted, **When** the Candidate later changes a profile or reusable CV, **Then** the submitted personal information and files remain version-locked and unchanged.
6. **Given** the Candidate is reviewing the submission, **When** transparency information is displayed, **Then** it states that automated tools may compare the application with job requirements, the recruiter remains the human decision-maker, sensitive personal attributes are excluded, and recruiter-side scores, rankings, and internal notes are never candidate-visible.
7. **Given** a valid in-progress application has not been submitted, **When** the Candidate chooses Save draft, **Then** the single candidate-job draft is saved or updated, its 30-day inactivity period restarts, and it can be resumed without creating an Application or starting any recruiter-side scoring.

---

### User Story 2 - Run and inspect a private CV match check (Priority: P1)

As a logged-in Candidate, I want to privately compare one of my CV versions with one job so that I can understand document fit and improve truthful evidence before deciding whether to apply.

**Why this priority**: It provides explainable candidate value while preserving human recruitment authority and strict separation from the real application pipeline.

**Independent Test**: Select an eligible job and successfully parsed owned CV, run the check with AI available, open the full report, verify the explicit 40/60 calculation and provenance, and prove that neither the recruiter nor an employer-side scoring query can discover the check or its result.

**Acceptance Scenarios**:

1. **Given** a Candidate owns at least one eligible CV version and can view an eligible job, **When** the Candidate sets up a check, **Then** the page shows the selected job and extracted requirement chips, the selected CV's name, page count, file size and parse status, the comparison dimensions, report contents, three-step explanation, limitation warning, and private-self-assessment commitments before analysis begins.
2. **Given** a selected CV has not parsed successfully, **When** the Candidate tries Analyze my CV, **Then** analysis does not start, the Candidate receives a specific recovery path, and no zero or misleading score is produced.
3. **Given** valid inputs and an available AI evaluation service, **When** the Candidate selects Analyze my CV, **Then** a private asynchronous analysis uses the exact approved method, excludes sensitive personal attributes, and does not submit an application or create, update, or influence any recruiter-side evaluation.
4. **Given** analysis completes normally, **When** the ready view appears, **Then** it shows duration, preview hybrid score and match level, all four completed analysis steps, selected job, privacy commitments, exact CV and JD sources with parse status, report-content preview, guidance limitation, and a View full match report action.
5. **Given** the Candidate opens the full report, **When** a hybrid result is available, **Then** the report shows the hybrid score and approved match level, strongest evidence and main gap, reproducibility statement, evidence confidence as a non-core signal, Automatic matching and AI evaluation scores with their 40/60 weights and weighted contributions, evidence coverage, evidence confidence, matched requirements, required-versus-detected experience, gaps, categorized CV evidence, prioritized truthful improvement guidance, and the explicit calculation with CV, JD, scoring-config, and relevant AI provenance versions.
6. **Given** a normal result has Automatic matching score `A` and AI evaluation score `B`, **When** its calculation is displayed, **Then** it shows `Hybrid score = (A × 40%) + (B × 60%)`, the displayed contributions reconcile with the displayed hybrid score under one documented rounding rule, and the approved bands are labelled High Match for 80-100, Medium Match for 60-79, and Low Match below 60.
7. **Given** a private report is displayed, **When** the Candidate reviews its privacy notice, **Then** it states that only the Candidate can see it, it is not part of an application, it is not sent to recruiters, it does not affect recruiter ranking, sensitive attributes were excluded, and it can be deleted.
8. **Given** the Candidate selects Apply now, **When** the application wizard starts, **Then** the chosen job and CV may be preselected when still valid, but the Candidate must review and explicitly submit through User Story 1 and a fresh independent employer-side evaluation may later use the application snapshots.

---

### User Story 3 - Track a submitted application (Priority: P1)

As a Candidate, I want to see intake progress and the public recruitment stage of my submitted application so that I understand what has happened without seeing private recruiter evaluation.

**Why this priority**: Candidate-side application tracking is a constitutional P0 workflow and reduces uncertainty after submission.

**Independent Test**: Submit an application, observe intake completion, leave and return, transition it through representative canonical states, and verify accurate public stages, timestamps, updates, immutable files, and the total absence of scores or recruiter-internal information.

**Acceptance Scenarios**:

1. **Given** an application was accepted, **When** the processing page opens, **Then** it shows technical intake progress as a percentage, Application received → Checking files → Send to recruiter steps with status and available timestamps, Application ID, received files, and a statement that intake is not candidate self-scoring and exposes no score, AI score, rank, or recruiter note.
2. **Given** file checks or content extraction are still running, **When** the Candidate leaves and later returns, **Then** authoritative processing progress resumes without requiring the page to stay open or duplicating work.
3. **Given** intake completes, **When** the tracking page opens, **Then** it shows the current public status, latest-update timestamp, Application ID, public stepper, recent-updates timeline, version-locked submitted files, notification preferences, applicable withdrawal action, and permanent privacy banner.
4. **Given** the canonical state changes, **When** the Candidate views the tracker, **Then** the public stepper maps `Applied` to Application submitted; `Viewed`, `Shortlisted`, and `Waitlisted` to Under review; `Interviewing` to Interview; and `Offered`, `Hired`, `Offer Declined`, or `Rejected` to Outcome, without exposing an internal reason, relative rank, score, or note.
5. **Given** no status changed, **When** technical intake or scoring work completes or fails, **Then** no false public pipeline transition is shown and application access is not blocked by AI availability.
6. **Given** the Candidate is entitled to a status-change notification, **When** a public stage changes, **Then** the enabled email and/or in-app channel is used and the corresponding public update becomes visible within the applicable freshness target.

---

### User Story 4 - Continue in limited mode when AI is unavailable (Priority: P2)

As a Candidate, I want the deterministic part of my private check and the application workflow to remain usable when AI is unavailable so that an optional AI dependency never blocks me from applying.

**Why this priority**: Deterministic fallback is mandatory for trustworthy AI-assisted behavior.

**Independent Test**: Force AI evaluation failure after automatic matching succeeds and verify the limited report, complete deterministic evidence, retry behavior, preserved prior data, and uninterrupted Apply now flow.

**Acceptance Scenarios**:

1. **Given** automatic matching completed and AI evaluation failed or timed out, **When** the report loads, **Then** its title includes `limited mode`, its subtitle says `AI temporarily unavailable`, its primary result is labelled `Deterministic match` and `not a final score`, and it shows an `AI evaluation unavailable` badge.
2. **Given** limited mode, **When** metric cards are displayed, **Then** Automatic matching retains its score and 40% weight, AI evaluation displays `—` rather than zero with `AI contribution unavailable`, and no hybrid score or match band is fabricated.
3. **Given** limited mode, **When** the Candidate reads the report, **Then** matched requirements, gaps, experience comparison, and evidence found render fully from deterministic evidence, while the formula states `Hybrid score unavailable — Final score: not calculated` and `Deterministic evidence remains available`.
4. **Given** limited mode, **When** the Candidate chooses Retry AI, **Then** the same versioned inputs are retried asynchronously without losing the deterministic result, submitting an application, or affecting recruiter-side scoring or ranking.
5. **Given** a retried AI evaluation succeeds, **When** the Candidate returns to the check, **Then** the same check displays the latest completed hybrid report and retains immutable timestamps and outcomes for the earlier failed or limited attempts without creating duplicate candidate-facing reports.
6. **Given** limited mode, **When** the Candidate chooses Apply now, **Then** the application flow proceeds normally and does not wait for AI recovery.
7. **Given** AI or any scoring dependency is unavailable after an application is submitted, **When** the Candidate views intake or tracking, **Then** application receipt, public status, withdrawal eligibility, and file access remain available.

---

### User Story 5 - Control candidate-owned records (Priority: P2)

As a Candidate, I want to delete my private checks and withdraw an eligible application so that I retain control over candidate-facing data and participation.

**Why this priority**: Data control is mandatory, but follows the core create-and-view journeys.

**Independent Test**: Delete a private report, withdraw a pre-interview application, and verify authorization, confirmation, audit results, disappearance of private content, public status updates, and rejection of late withdrawal.

**Acceptance Scenarios**:

1. **Given** a Candidate owns a saved private check, **When** the Candidate confirms deletion, **Then** access to the report and its candidate-private scores, evidence, guidance, and derived result is denied immediately and deletion proceeds under the documented privacy policy without changing any application or recruiter-side record.
2. **Given** an Application has not reached `Interviewing` or any later canonical stage, **When** its Candidate confirms withdrawal, **Then** the application becomes withdrawn, the action and timestamp appear in the candidate-visible timeline, recruiters are notified of the withdrawal, and the event is auditable.
3. **Given** an Application is in `Interviewing`, `Offered`, `Hired`, `Offer Declined`, or another stage after interview began, **When** the Candidate requests withdrawal through this feature, **Then** the action is unavailable or rejected with a clear explanation and no state change.
4. **Given** a Candidate attempts to delete or withdraw another Candidate's record, **When** the request is evaluated, **Then** no existence, content, or state is disclosed and nothing changes.

---

### User Story 6 - Choose status notification channels (Priority: P3)

As a Candidate, I want to enable or disable email and in-app application-status notifications so that updates arrive through my preferred supported channels.

**Why this priority**: Preferences improve convenience after core tracking is complete.

**Independent Test**: Toggle each supported channel, cause a public-stage change, and verify delivery follows the saved settings while the tracking timeline remains authoritative.

**Acceptance Scenarios**:

1. **Given** a Candidate owns the Application, **When** the Candidate changes email or in-app toggles, **Then** the preferences are saved for that Application only, with visible success or recoverable failure feedback, persist across sessions, and do not alter another current or future Application.
2. **Given** a public-stage update occurs, **When** one channel is disabled, **Then** no optional update is sent through that channel while enabled channels continue to work.
3. **Given** all optional channels are disabled, **When** a public-stage update occurs, **Then** the update remains visible in the tracker and legally or security-required communications are not reclassified by this feature.

### Edge Cases

- A selected job closes, is withdrawn, or becomes inaccessible before private analysis or application submission; the saved private report remains reproducible against its versioned sources, but new analysis or submission is prevented with a clear explanation.
- An application draft reaches 30 days since its latest successful edit; it expires without creating an Application, and returning to the job starts a new draft rather than restoring stale personal data or files.
- A CV version is deleted or replaced after selection but before analysis or submission; the action revalidates ownership and availability and never silently substitutes another CV.
- A file passes upload validation but later intake extraction fails; the Application remains accepted, technical failure is distinguished from recruitment status, support recovery is offered, and no score is shown.
- Intake percentage or step events arrive late, repeat, or out of order; displayed progress never regresses after an authoritative completed step and duplicate timeline entries are suppressed.
- A canonical state advances while a withdrawal request is in flight; the authoritative state transition rules decide atomically, preventing withdrawal at or after `Interviewing`.
- A report is deleted while AI retry is in flight; completion cannot recreate or disclose the deleted result.
- The same CV and JD versions are checked multiple times under the same scoring configuration; the underlying deterministic score is reproducible, while separately recorded AI provenance and permitted model nondeterminism are transparently traceable rather than falsely described as byte-identical prose.
- The Candidate opens the application from a stale notification or another account; current authentication and ownership are rechecked before any data is shown.
- Evidence contains text resembling sensitive attributes; it is excluded from scoring inputs and explanations and is never used as positive or negative evidence.
- Rounding occurs near 60 or 80; one documented rule is applied consistently to displayed score, contributions, and band so the label cannot contradict the number.
- Notification delivery fails; the authoritative tracker still updates, failure does not roll back a valid pipeline transition, and retry does not duplicate an update.
- Application files reach their approved retention/deletion deadline or a legal hold applies; access and deletion follow the authoritative application-document policy without substituting current profile files.

## Requirements *(mandatory)*

### Functional Requirements

#### Application review and submission

- **FR-001**: The system MUST provide a three-step Candidate application journey ending in Review and submit and MUST preserve at most one recoverable draft per candidate-job pair for 30 days after its latest successful edit; expiry MUST discard the draft without creating an Application or starting scoring.
- **FR-002**: Review and submit MUST display the exact personal-information snapshot, selected CV, optional cover letter, optional one-way recruiter message, and consolidated files checklist proposed for submission.
- **FR-003**: Before submission, the Candidate MUST be able to return to the appropriate earlier step to change personal information or files without creating an Application.
- **FR-004**: The system MUST require explicit confirmation that the displayed information is correct before enabling a valid submission.
- **FR-005**: A valid CV in an approved PDF or DOCX format no larger than 5,000,000 bytes MUST be required; a cover letter MUST remain optional.
- **FR-006**: An accepted submission MUST create exactly one authoritative Application per candidate-job pair, start it in canonical `Applied`, assign a stable Application ID and timestamp, and treat repeated equivalent attempts idempotently.
- **FR-007**: The accepted Application MUST retain immutable submission-time snapshots or bindings for personal submission data, CV, optional cover letter, message, the exact JD version, and their relevant version identities; later profile, CV-library, or job edits MUST NOT mutate them.
- **FR-008**: Submitted files MUST be view-only to the Candidate and MUST NOT be editable or replaceable through this feature after acceptance.
- **FR-009**: The review page MUST state that automated comparison may be used, sensitive personal attributes are excluded, recruiter decisions remain human-controlled, and recruiter-internal scores, ranks, and notes are not candidate-visible.

#### Processing and public application tracking

- **FR-010**: After acceptance, the system MUST show technical intake percentage and the ordered Application received, Checking files, and Send to recruiter steps with status and available timestamps.
- **FR-011**: Technical intake MUST continue independently of page presence and MUST be resumable after navigation, refresh, or a new authenticated session.
- **FR-012**: Intake MUST identify received files and MUST clearly state that it is not candidate self-scoring and discloses no score, AI score, rank, or recruiter note.
- **FR-013**: The long-lived tracker MUST show Application ID, latest public update, current public status, public stepper, recent public updates, immutable submitted files, notification controls, and withdrawal eligibility.
- **FR-014**: The public stepper MUST map canonical internal application states only into Application submitted, Under review, Interview, and Outcome and MUST NOT infer movement from scoring or technical-processing events.
- **FR-015**: Candidate-visible application timelines and status notifications MUST be generated only from allow-listed public pipeline events and candidate-safe copy; they MUST NOT serialize or derive content from recruiter-internal reasons, notes, evaluations, scores, ranking, or other candidates' records.
- **FR-016**: Application submission, intake, tracking, file access, and public pipeline state MUST remain usable when automatic matching or AI evaluation is pending, unavailable, or failed.
- **FR-017**: Every candidate-visible public stage change MUST record its effective timestamp and be available in the tracker; applicable enabled notifications MUST be emitted without becoming the authority for application state.

#### Private CV Match Check

- **FR-018**: Only an authenticated Candidate who owns the CV version and may view the job may create, view, retry, or delete the corresponding Private CV Match Check.
- **FR-019**: Set up MUST show one selected job with extracted skills and experience requirements, one owned CV with file and parse status, comparison dimensions, expected report contents, the three analysis steps, limitations, and all privacy/fairness commitments before analysis.
- **FR-020**: Private analysis MUST require a successfully parsed eligible CV and a fixed JD version; it MUST NOT silently switch either source after the Candidate starts the check.
- **FR-021**: Normal private scoring MUST reuse the approved method exactly: `Hybrid score = 40% × Automatic matching score + 60% × AI evaluation score`; it MUST retain the approved weights and bands and MUST NOT redefine mandatory job criteria.
- **FR-022**: Private and recruiter-side scoring MUST be independent pipelines. Private check inputs, jobs, results, evidence, retry state, and deletion state MUST NOT create, update, seed, cache as an employer result, or influence an Application evaluation or recruiter ranking.
- **FR-023**: Private-check records and access paths MUST be isolated from recruiter-queryable scoring records and recruiter/company authorization scopes even when both pipelines invoke the same approved scoring method or engine.
- **FR-024**: The report-ready state MUST show analysis duration, preview score and level when available, four completed steps, job identity, privacy commitments, exact source versions and parse states, report-content preview, guidance limitation, and View full match report.
- **FR-025**: A normal full report MUST show the hybrid score and approved level, summary of strongest evidence and main gap, reproducibility statement, evidence confidence disclaimer, four metric cards, matched and preferred requirements, required-versus-detected experience, specific gaps, categorized supporting CV evidence, prioritized truthful pre-application actions, explicit calculation, and provenance.
- **FR-026**: Automatic matching and AI evaluation cards MUST show their unweighted scores, weights, and weighted contributions; evidence coverage and evidence confidence MUST be presented as supporting quality signals and MUST NOT alter the core hybrid formula.
- **FR-027**: Improvement guidance MUST be derived from displayed evidence gaps, MUST encourage accurate evidence and verification, and MUST NOT fabricate qualifications or rewrite the CV on the Candidate's behalf.
- **FR-028**: Every private result MUST retain and redisplay the exact CV version, JD version, scoring-configuration version, weights, thresholds, automatic-matching provenance, and applicable AI model/provider, prompt or instruction, and input-policy versions needed for later cross-checking.
- **FR-029**: A same-input reproducibility claim MUST apply to the underlying score under the recorded method and configuration; the system MUST NOT imply that probabilistic wording is necessarily identical unless that property is actually guaranteed.
- **FR-030**: The Candidate MUST be able to enter the application flow from a report with the selected job and CV preselected only if still eligible; Apply now MUST never itself submit an Application.

#### Deterministic fallback, privacy, and control

- **FR-031**: AI evaluation MUST be asynchronous, MUST NOT block unrelated navigation or application submission, and MUST complete within 20 seconds at P95 under documented normal test conditions.
- **FR-032**: If AI evaluation is unavailable after automatic matching completes, the system MUST preserve and fully render deterministic requirements, gaps, experience, and evidence in a clearly labelled limited mode.
- **FR-033**: Limited mode MUST label the result Deterministic match and not a final score, display `—` rather than zero for AI evaluation, state that the hybrid final score was not calculated, and MUST NOT assign a hybrid band.
- **FR-034**: Limited mode MUST offer Retry AI and Apply now together; retry MUST reuse the recorded input versions, retain prior deterministic data, create no Application, and influence no recruiter-side score or rank. A successful retry MUST update the same check's current display to the latest completed hybrid report while preserving immutable timestamps and outcomes for every prior analysis attempt and MUST NOT create a duplicate candidate-facing report.
- **FR-035**: Gender, age, marital status, and all other protected or job-irrelevant sensitive personal attributes MUST be excluded from automatic and AI scoring inputs, generated explanations, confidence, gaps, and guidance in both private and employer-side uses of the shared method.
- **FR-036**: No action in either cluster may automatically submit an application, advance a pipeline stage, reject, shortlist, interview, hire, withdraw, or otherwise decide for a Candidate or Recruiter.
- **FR-037**: A Private CV Match Check MUST remain available for no more than 12 months from creation unless its Candidate deletes it sooner; at candidate deletion or automatic expiry, ordinary access to its private derived content MUST cease immediately, in-flight retry MUST not recreate it, physical deletion MUST complete within 30 days with recoverable cleanup failures, and no Application or recruiter-side data may change.
- **FR-038**: The Candidate MUST be able to withdraw an owned Application only before it reaches `Interviewing`; a successful request MUST atomically record an immutable candidate-initiated terminal withdrawal outcome and timestamp, remove the Application from active processing, preserve its last canonical recruiter stage, show public `Outcome: Withdrawn`, require confirmation, notify relevant recruiter users, and produce a candidate-visible update and audit event.
- **FR-039**: Critical submission, withdrawal, private-check deletion outcome, pipeline transition, and AI-processing failure events MUST be auditable with actor, action, target, result, and timestamp without copying unnecessary CV content, private evidence, or sensitive attributes into audit data.
- **FR-040**: All record reads and mutations MUST revalidate the authenticated Candidate and record ownership and MUST reveal no record existence or content across candidates.
- **FR-041**: Across every candidate-facing surface and channel—not only application timelines and status notifications—the portal MUST never expose recruiter-side scores, scoring status, ranking relative to other candidates, internal notes, internal rejection reasons, private company criteria, or other candidates' information through pages, downloads, errors, logs, analytics, or derived labels.

#### Notifications and experience quality

- **FR-042**: Each Application tracker MUST allow its Candidate to independently enable or disable email and in-app status notifications for that Application; the preferences MUST persist across sessions with accessible success and error feedback and MUST NOT alter another current or future Application's preferences.
- **FR-043**: Email and in-app are the only optional notification channels in this feature; disabling them MUST NOT remove tracker history or suppress legally or security-required communication managed elsewhere.
- **FR-044**: Candidate pages MUST support responsive mobile use, keyboard operation, descriptive labels, readable contrast, recoverable loading/error states, and non-color-only communication of score, stage, progress, success, and failure.
- **FR-045**: Candidate-facing pages MUST become usable within 3 seconds at P95, dashboard-to-feature navigation within 2 seconds at P95, and public in-app status updates within 5 seconds at P95 under documented representative conditions.
- **FR-046**: Private check data, application data, CV content, recruiter message, evidence, and AI inputs MUST follow purpose limitation, least privilege, protected transport, approved provider boundaries, and the applicable Vietnamese personal-data requirements.

### Key Entities

- **Candidate**: The authenticated person who owns CV versions, drafts, Applications, private checks, notification preferences, and permitted candidate-facing views. Candidate ownership never grants employer authority.
- **Job / Job Description Version (JD Version)**: The target vacancy and immutable version of its approved description and structured requirements used for a submission or score. Later job edits create a new version rather than rewriting provenance.
- **CV Version**: An immutable, candidate-owned version of an approved PDF or DOCX plus parse status, page count, file size, extracted evidence reference, and version identity. A submitted snapshot and private-check source may reference the same source version but have independent purposes and access policies.
- **Application Draft**: The single candidate-job pre-submission workspace containing editable personal information, file selections, optional cover letter, one-way message, and latest-edit timestamp. It expires after 30 days without a successful edit, is not an Application, and has no recruiter-side score or pipeline state.
- **Application**: The authoritative, unique candidate-job submission with Application ID, candidate/job ownership, `Applied` initial state, immutable submission snapshots, exact CV and JD versions, public-stage projection, timestamps, and an optional candidate-initiated terminal withdrawal outcome that preserves the last canonical recruiter stage. It remains consistent with feature 012's authoritative application aggregate rather than duplicating it.
- **Application Document Snapshot**: The version-locked CV and optional cover-letter evidence accepted with an Application, including original binding and retention status; later reusable CV changes cannot replace it.
- **Application Intake Status**: Technical progress for receipt, file checking, and recruiter handoff. It is separate from recruitment pipeline state and any score.
- **Public Application Update**: A candidate-safe projection of an approved pipeline or withdrawal event with public stage, copy, and timestamp; it excludes internal rationale, scores, rank, and notes.
- **Private CV Match Check**: A candidate-only analysis request tying one Candidate, one CV Version, one JD Version, and one scoring configuration to private lifecycle, fallback, provenance, immutable analysis-attempt history, latest display state, 12-month expiry, and candidate-controlled deletion state. It is not an Application or recruiter evaluation.
- **Private Match Result**: Candidate-only automatic matching evidence and, when available, AI evaluation, hybrid score, weighted contributions, match band, evidence coverage/confidence signals, gaps, and guidance. Its storage and query boundary is separate from employer evaluation data.
- **Scoring Configuration Version**: The immutable approved method metadata including 40/60 weights, bands, deterministic rule version, thresholds, and relevant policies used to reproduce or cross-check a score.
- **Employer-Side Application Evaluation**: The recruiter-authorized scoring result associated with an actual Application. It may use the shared method but is created independently from application snapshots and is never populated from or exposed through a Private CV Match Check.
- **Notification Preference**: Candidate-owned, Application-specific email and in-app choices for optional public status updates; each Application has independent settings.
- **Audit Event**: Minimal accountability record for critical actions and failures; it is not a channel for CV contents, private report evidence, sensitive attributes, or recruiter-internal details.

## Scope Guard

### In Scope

- Candidate-side final review, draft preservation, explicit confirmation, idempotent submission, and immutable application snapshots.
- Technical post-submission intake progress and long-lived candidate-safe application tracking.
- Public pipeline projection, recent public updates, submitted-file viewing, eligible withdrawal, and email/in-app preferences.
- Candidate-only setup, normal report-ready state, full explainable report, deletion, and deterministic limited mode for Private CV Match Check.
- Reuse of the approved 40% Automatic matching and 60% AI evaluation method without modifying it.
- Strict authorization, data separation, sensitive-attribute exclusion, provenance/versioning, auditability, accessibility, and fallback behavior required for these journeys.

### Must NOT Be Built at This Stage

- No modification, replacement, reweighting, or new thresholds for existing recruiter-side scoring logic; this feature only reuses the approved method.
- No two-way direct recruiter chat or recruiter response workflow. The application has only a one-way submission-time message; Contact support is technical help, not recruiter chat.
- No recruiter, company member, or administrator view of, response to, export of, discovery of, or use of a Candidate's Private CV Match Check.
- No editing, replacing, or appending files or personal data after application submission; only eligible withdrawal is supported.
- No SMS, mobile push, or other notification channel beyond email and in-app.
- No automatic application submission, automatic candidate action, automatic recruiter decision, automatic shortlist/rejection/hire, or score-driven pipeline advancement.
- No candidate view of recruiter-side scores, relative rank, internal notes, internal rejection reasons, private criteria, or other applicants.
- No transfer, reconciliation, comparison, or synchronization between a private result and an employer-side result, even when their source versions happen to match.
- No AI resume rewriting or qualification fabrication. Prioritized guidance remains part of the private score explanation, not a separate resume-enhancement feature.
- No redesign of the recruiter pipeline, canonical application states, recruiter decision controls, or feature 012 evaluation experience.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of usability-test Candidates with valid inputs complete Review and submit successfully on their first attempt within 3 minutes.
- **SC-002**: In 100% of tested retries, double submissions, and ambiguous network-response cases, one candidate-job pair produces no more than one authoritative Application.
- **SC-003**: In 100% of tested candidate, recruiter, company, export, notification, error, and identifier-tampering paths, Private CV Match Check content is accessible only to its owning Candidate and does not alter or populate employer-side evaluation data.
- **SC-004**: In 100% of tested candidate-facing screens and notification payloads, no recruiter score, relative rank, internal note, internal rejection reason, private criterion, or other-candidate information is disclosed.
- **SC-005**: Under documented normal conditions, 95% of private AI evaluations complete within 20 seconds; when they do not, 100% of checks with completed automatic matching expose a usable limited report and Apply now remains available.
- **SC-006**: For 100% of normal reports, displayed weighted contributions reconcile with the hybrid score under the documented rounding rule and the displayed High/Medium/Low band matches the approved thresholds.
- **SC-007**: For 100% of sampled private results and Applications, reviewers can identify and redisplay the exact CV version, JD version, and relevant scoring configuration or submission provenance used at the time.
- **SC-008**: Candidate-facing feature pages become usable within 3 seconds at P95, navigation into them within 2 seconds at P95, and in-app public status changes become visible within 5 seconds at P95 under documented representative conditions.
- **SC-009**: In 100% of tested AI-failure cases, application submission, intake, tracking, submitted-file access, and eligible withdrawal continue without waiting for AI.
- **SC-010**: In 100% of tested withdrawal races, Applications at or beyond `Interviewing` are not withdrawn, while eligible confirmed withdrawals produce one authoritative transition, candidate-visible update, recruiter notification, and audit result.
- **SC-011**: In 100% of tested private-report deletions and 12-month expiries, candidate access to private derived content ends immediately, an in-flight retry does not recreate it, physical deletion completes within 30 days, and no Application or employer-side evaluation changes.
- **SC-012**: All seven specified candidate UI states can be completed using keyboard-only navigation at supported responsive sizes, with every score, stage, progress, and failure understandable without color alone.
- **SC-013**: At least 90% of usability-test Candidates correctly identify the private check as guidance rather than a hiring decision and correctly state that it is not shared with recruiters or used in their real application ranking.

## Assumptions

- The existing authentication, Candidate profile/CV library, job visibility, authoritative Application aggregate, canonical recruiter pipeline, audit capability, and email/in-app notification foundations are reused rather than duplicated.
- Feature 012's authoritative Application and immutable submitted-document semantics remain the source of truth; this feature adds the complete candidate submission and tracking experience around that same aggregate.
- Each Candidate may retain at most one draft for a given job; every successful draft edit restarts its 30-day inactivity period, while expiry creates no Application and triggers no scoring.
- `Interviewing` is the constitutional canonical state represented by the user-facing Interview stage; withdrawal is allowed only before entry into it, regardless of the broader public-stage label.
- A withdrawn application retains its last canonical recruiter stage and records a separate immutable candidate-initiated terminal withdrawal outcome and timestamp; it is removed from active processing and displayed to the Candidate as `Outcome: Withdrawn`, without adding or impersonating a canonical recruiter stage.
- The short conclusion may use candidate-friendly wording such as Strong potential match, but the scored band must remain semantically mapped to the approved High Match, Medium Match, and Low Match thresholds.
- Evidence confidence measures clarity of supporting evidence and evidence coverage measures the share of criteria with clear evidence; neither contributes to the hybrid score.
- The underlying score reproducibility claim assumes the same immutable CV version, JD version, scoring configuration, deterministic rules, and recorded AI conditions. Natural-language wording may vary where the AI component is probabilistic.
- Existing application-document retention and legal-hold policy governs submitted snapshots. Private checks expire 12 months after creation unless deleted sooner; ordinary access ends immediately at expiry or deletion and private derived data is physically deleted within 30 days, subject only to a documented legal hold required by applicable law.
- Notification preferences are stored per Application and apply only to its optional status updates. The tracking page remains authoritative, and mandatory security or legal messages outside this feature retain their existing rules.
- Contact support, where presented for technical processing problems, uses the existing support capability and does not create a recruiter conversation.
