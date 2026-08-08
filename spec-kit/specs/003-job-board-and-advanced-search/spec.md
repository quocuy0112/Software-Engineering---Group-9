# Feature Specification: Job Board and Candidate Job Workspace

**Feature Branch**: `003-job-board-and-advanced-search`

**Created**: 2026-08-01

**Last Updated**: 2026-08-07

**Status**: Clarified

**Input**: User description: "Align Feature 003 with the implemented candidate-facing job-board capabilities while excluding recruiter and Administrator job-post management."

## Clarifications

### Session 2026-08-01

- Q: Which postings may appear in public browse, search, and detail views? → A: Only Administrator-approved postings that are currently active and within their publication window; unavailable postings use a neutral response.
- Q: How must Vietnamese job search treat text? → A: Keyword and comparable text filters are case-insensitive and Vietnamese-diacritic-insensitive while displayed content preserves its original spelling and diacritics.
- Q: Are UC-JOB-03 and UC-JOB-05 included despite being marked Should? → A: Yes. Both are included as P2 increments after the three Must workflows.
- Q: What is the initial application stage? → A: A successful submission creates exactly one application in the canonical `Applied` stage; `Submitted` is an action/result, not a second recruitment stage.
- Q: What candidate material may be submitted? → A: The Candidate must select a confirmed retained CV or use the later-approved direct retained-CV import path, then provide required answers and current consent; Feature 004 parsing remains separate.

No additional critical ambiguity remains after reconciling the requested use cases with the SmartHire constitution and approved candidate-job-journey specification.

### Session 2026-08-02

- Q: Does Feature 004 automatically provide the retained CV attachment required by UC-APP-01? → A: No. Feature 004 imports a temporary source into Candidate Profile and must delete that source; `CandidateCv` is a separate retained, confirmed application-document dependency and must never point at a temporary Feature 004 artifact.
- Q: What exact CV size bound applies at the application boundary? → A: The constitutional decimal limit is `1..5,000,000` bytes, not 5 MiB.
- Q: Which optional Job Board capabilities are included now? → A: UC-JOB-03 and UC-JOB-05 remain the selected P2/Should increments. UC-JOB-04 remains a later backlog option because canonical safe URLs already provide its prerequisite without expanding this delivery.

The specification remains clear that Feature 004 does not create retained application documents. The later direct import path satisfies this dependency through a distinct Candidate-CV consent, storage, retention, deletion, and malware-safety contract.

### Session 2026-08-07

- Q: Which implemented candidate-facing additions now belong to Feature 003? → A: Quick view, related jobs, persistent saved and hidden job state, Candidate job-preference settings, explainable suggested jobs, a retained-CV import step inside the application flow, and Candidate-owned application tracking are included.
- Q: What is explicitly excluded as job management? → A: Recruiter job creation, editing, duplication, publishing, pausing, closing, deletion, lifecycle administration, and Administrator moderation/approval interfaces are excluded.
- Q: Does Candidate application tracking allow stage changes? → A: No. Feature 003 provides Candidate-owned, read-only status and timeline views. Recruiter pipeline actions and stage-transition management belong to another feature.
- Q: How can a Candidate without a retained CV apply? → A: The application flow may import one new PDF or DOCX into the Candidate's retained CV collection under its security and retention contract, then select that confirmed record. Temporary Feature 004 artifacts remain ineligible.
- Q: How may matching or AI-derived information appear? → A: Public retrieval and ordering remain deterministic. Preference suggestions expose their job-relevant matching basis. Application scoring may be displayed only when an approved scoring capability produced it under current consent; scoring generation and recruitment decisions are outside Feature 003.

The direct retained-CV import resolves the earlier production dependency on an external `CandidateCv` creator. No critical ambiguity remains; job-post management and recruiter pipeline mutation remain separate.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse, Search, Filter, and Quickly Review Jobs (Priority: P1)

**Detailed checklist and evidence**: [US1 Browse, Search, and Filter Jobs](checklists/us1-browse-search-filter-results.md)

As a visitor or authenticated user, I can browse active approved jobs, narrow the catalogue with normalized keywords, filters, sorting, and pagination, and open a keyboard-accessible quick view so that I can compare opportunities efficiently.

**Why this priority**: Public job discovery is the entry point for the complete candidate journey and is a mandatory P0 capability.

**Independent Test**: Seed active, future, expired, closed, pending-review, rejected, removed, and unverified-company postings; search with Vietnamese text with and without diacritics; combine supported filters and sorting; paginate; open and navigate quick view; and verify that only matching active public postings appear with consistent actions.

**Acceptance Scenarios**:

1. **Given** active approved postings exist, **When** an actor opens the jobs page without criteria, **Then** the actor sees a paginated default catalogue containing only active public postings and total-result information.
2. **Given** a posting contains Vietnamese text with diacritics, **When** the actor searches using an equivalent term with different case or omitted diacritics, **Then** the posting is included without altering its displayed text.
3. **Given** filters for location, employment type, experience level, work arrangement, salary, skills/tags, and posting date, **When** the actor combines valid criteria, **Then** every displayed result satisfies all selected filters and the selected sort order.
4. **Given** one criterion is invalid, **When** the search is submitted, **Then** the invalid criterion is identified, other valid criteria are preserved, and no private or inactive posting data is disclosed.
5. **Given** no posting matches, **When** results are returned, **Then** the actor sees an accessible empty state with actions to clear or change criteria.
6. **Given** a displayed job becomes unavailable, **When** the actor requests another result page or refreshes the search, **Then** the job is omitted or clearly unavailable and cannot accept a new application.
7. **Given** a result card is visible, **When** the actor opens quick view, navigates to the previous or next result, closes it, or presses Escape, **Then** the panel shows permitted summary information, preserves the correct Save/Apply state, and returns focus to the invoking control.

---

### User Story 2 - View Job Details and Related Opportunities (Priority: P1)

**Detailed checklist and evidence**: [US2 View Job Details](checklists/us2-view-job-details-results.md)

As a visitor or authenticated user, I can open a stable public job link, review complete permitted job and company information, and inspect deterministically related opportunities so that I can decide whether to apply, save, or keep exploring.

**Why this priority**: Candidates need trustworthy details before they can make an informed application decision.

**Independent Test**: Open public links for active, expired, closed, removed, private, and unknown postings as a visitor and Candidate; verify public fields, state labels, available actions, related jobs, canonical metadata, and neutral unavailable behavior.

**Acceptance Scenarios**:

1. **Given** an active public posting, **When** the actor opens its canonical link, **Then** the page shows the approved title, public company information, location, work arrangement, employment type, salary when disclosed, description, responsibilities, requirements, benefits, skills/tags, and deadline.
2. **Given** a closed or expired public posting, **When** its link is opened, **Then** public historical details remain visible, its state is clearly labeled, and applying is unavailable.
3. **Given** a removed, private, pending-review, rejected, or unknown posting, **When** its identifier or link is requested, **Then** a neutral unavailable view reveals neither its existence nor moderation details.
4. **Given** a visitor selects Save, Report, or Apply, **When** authentication is required, **Then** the login flow retains a safe return destination and returns to the same public job after successful authentication.
5. **Given** an authenticated user has saved or applied to the job, **When** details load, **Then** the available action reflects the stored state without exposing another user's interaction.
6. **Given** other active public postings exist, **When** details load, **Then** related opportunities use approved job-relevant signals with stable tie-breaking and exclude unavailable records.

---

### User Story 3 - Apply for a Job (Priority: P1)

**Detailed checklist and evidence**: [US3 Apply for a Job](checklists/us3-apply-for-job-results.md)

As an authenticated Candidate, I can review and correct required contact/profile information, select a confirmed retained CV or import a new eligible CV, answer employer questions, add an optional cover letter, choose optional analysis consent, accept the current application consent, and submit exactly one application.

**Why this priority**: Application submission is the mandatory conversion point of the job board and a complete P0 workflow.

**Independent Test**: Apply with an existing confirmed CV and a newly imported CV; exercise contact/location validation, required and optional questions, consent choices, duplicate/concurrent submission, expired jobs, invalid files, and injected persistence/notification failures; then verify one authoritative `Applied` application and immutable evidence.

**Acceptance Scenarios**:

1. **Given** an eligible Candidate, an active posting, complete required information, a confirmed retained CV, complete required answers, and accepted current application consent, **When** the Candidate submits, **Then** exactly one application is created in `Applied` with submission snapshots and an accessible confirmation.
2. **Given** the Candidate has no suitable retained CV, **When** the Candidate imports an eligible PDF or DOCX of `1..5,000,000` bytes, **Then** it is validated and saved as a distinct confirmed Candidate CV before selection.
3. **Given** the Candidate's location is missing, **When** the Candidate explicitly saves the job location from the application flow, **Then** refreshed profile state is shown and safe form input is preserved.
4. **Given** contact data is prefilled, **When** the Candidate corrects name, email, or Vietnamese phone number, **Then** validated values are captured in the application snapshot without changing unrelated profile fields.
5. **Given** required profile data, CV, employer answer, or consent is missing or invalid, **When** submission is attempted, **Then** problems are described accessibly, the first problem is focused, safe input is preserved, and no application is created.
6. **Given** the Candidate already applied, **When** another or concurrent submission is attempted, **Then** no duplicate is created and the existing application is authoritative.
7. **Given** the posting closes or its deadline passes before final submission, **When** eligibility is rechecked, **Then** no application is created and a clear unavailable message is shown.
8. **Given** persistence fails, **When** submission ends, **Then** partial records and unused newly staged content are rolled back or removed and no success state is shown.
9. **Given** the application commits but notification or optional scoring is unavailable, **When** submission completes, **Then** the application remains valid, retryable downstream work is preserved where applicable, and confirmation is still shown.

---

### User Story 4 - Track My Applications (Priority: P1)

As an authenticated Candidate, I can view and filter my own applications, inspect each Candidate-visible timeline, and review what I submitted so that I understand the current stage and next step even when the original job is unavailable.

**Why this priority**: Candidate-side tracking completes the P0 post-submission journey without granting recruiter pipeline authority.

**Independent Test**: Create applications in every canonical stage for multiple Candidates; list, group, filter, paginate, and open details; change job availability; and verify ownership isolation, Candidate-visible event filtering, snapshots, next-step copy, and scoring-status separation.

**Acceptance Scenarios**:

1. **Given** a Candidate owns applications in different stages, **When** My Applications opens, **Then** applications are ordered by latest stage change and show company, job, stage, submission date, last update, and a human-readable next step.
2. **Given** applications span active, attention, paused, and completed groups, **When** the Candidate filters by group or exact canonical stage, **Then** only matching owned applications appear and filters can be cleared.
3. **Given** more applications exist than the page limit, **When** the Candidate loads more, **Then** the next page is appended without duplicates and retry guidance appears on failure.
4. **Given** the Candidate opens an owned application, **When** details load, **Then** the selected CV name, cover letter, submitted answers, and only Candidate-visible stage events/reasons are shown.
5. **Given** the original job becomes unavailable, **When** the Candidate views the application, **Then** the immutable record remains visible while the job is not presented as an actionable public link.
6. **Given** another Candidate's application identifier is requested, **When** ownership is checked, **Then** a neutral unavailable response reveals no application or Candidate information.
7. **Given** optional CV analysis was requested, **When** its status or approved result is available, **Then** it is labeled separately from the recruitment stage and cannot change that stage.

---

### User Story 5 - Save, Revisit, Hide, and Restore Jobs (Priority: P2)

**Detailed checklist and evidence**: [US4 Save or Remove a Job](checklists/us4-save-remove-job-results.md)

As an authenticated Candidate, I can save jobs to a dedicated collection, remove them, and hide irrelevant jobs with an undo path so that I can organize opportunities without changing the postings.

**Why this priority**: Saving improves continuity but is not required to discover, inspect, or apply for a job.

**Independent Test**: Save/remove and hide/restore jobs from results, quick view, detail, Saved Jobs, and Suggested Jobs; repeat and race actions; expire the session; make postings unavailable; and verify one Candidate-scoped authoritative state with visible recovery.

**Acceptance Scenarios**:

1. **Given** an authenticated user has not saved a valid job, **When** Save is selected, **Then** one saved relationship is created and every visible control for that job reflects the saved state.
2. **Given** the job is saved, **When** removal is confirmed, **Then** the relationship is removed and visible controls return to the unsaved state.
3. **Given** duplicate or concurrent save/remove requests, **When** they complete, **Then** the operation is idempotent and the UI reconciles to the final authoritative state.
4. **Given** persistence fails or the session expires, **When** the operation is attempted, **Then** the prior stored state remains unchanged and a retry or login action is available.
5. **Given** a saved posting later becomes unavailable, **When** its saved state is read, **Then** it may remain as a neutral historical reference but prohibited actions remain unavailable.
6. **Given** saved jobs exist, **When** the Candidate opens Saved Jobs, **Then** an accurate Candidate-scoped collection, quick view, and accessible empty state are available.
7. **Given** a Candidate hides a job, **When** the action succeeds, **Then** it is removed from personalized lists and an immediate undo restores it without deleting or moderating the posting.

---

### User Story 6 - Configure Preferences and Review Suggested Jobs (Priority: P2)

As an authenticated Candidate, I can configure job preferences and consent choices, then review explainable suggestions based on those preferences so that I can discover relevant jobs without surrendering control of search or application decisions.

**Why this priority**: Candidate-controlled suggestions add continuity after the deterministic public search is complete.

**Independent Test**: Configure target positions, custom positions, skills, experience, desired salary, locations, relocation, and independent consent choices in Vietnamese and English; verify persistence, validation, suggestion matching, explanations, applied/hidden exclusions, ordering, and manual-search fallback.

**Acceptance Scenarios**:

1. **Given** preferences are not configured, **When** Suggested Jobs opens, **Then** an accessible empty state explains how to configure them and links to settings.
2. **Given** valid preferences and required analysis consent, **When** settings are saved, **Then** values persist, success is communicated, and Suggested Jobs opens.
3. **Given** active jobs satisfy configured job-relevant criteria, **When** suggestions are calculated, **Then** jobs show a bounded match indicator and contributing criteria with stable deterministic ordering.
4. **Given** a job is applied to, hidden, closed, expired, removed, pending review, or unavailable, **When** suggestions load, **Then** that job is excluded.
5. **Given** preferences change, **When** suggestions are revisited, **Then** current preferences are authoritative and prior suggestions do not override them.
6. **Given** analysis or notification consent is absent or revoked, **When** related processing would occur, **Then** it is not performed, the consequence is explained, and ordinary public search remains available.
7. **Given** job-irrelevant or protected Candidate attributes differ, **When** suggestions are calculated, **Then** inclusion, exclusion, score, and order do not change.

---

### User Story 7 - Report a Job Posting (Priority: P2)

**Detailed checklist and evidence**: [US5 Report a Job Posting](checklists/us5-report-job-results.md)

As an authenticated user, I can privately report a suspected fraudulent, misleading, discriminatory, duplicate, inappropriate, or policy-violating posting so that authorized moderators can review it without an automatic enforcement decision.

**Why this priority**: Reporting supports platform trust and moderation but does not block the primary discovery and application journey.

**Independent Test**: Submit every supported reason, enforce reason-specific details, repeat an unresolved duplicate, exceed the abuse limit, report a removed job, inject persistence failure, and verify privacy, pending-review state, audit evidence, and absence of automatic removal.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a public job, **When** a valid report is submitted, **Then** one private report is created in `Pending Review`, the submission is audited, and a neutral confirmation is shown.
2. **Given** a reason is missing or required details are absent, **When** submission is attempted, **Then** accessible field feedback is shown, safe form content is preserved, and no report is created.
3. **Given** the user already has an unresolved report for the same job and reason, **When** the concern is submitted again, **Then** no duplicate report is created and a neutral already-received response is shown.
4. **Given** the reporting rate limit is exceeded, **When** another report is attempted, **Then** it is temporarily rejected, an abuse-control event is recorded, and retry timing is communicated.
5. **Given** the report is accepted, **When** moderation has not yet acted, **Then** the report alone does not hide, reject, or otherwise change the posting.

### Edge Cases

- Empty catalogues and result sets distinguish "no active jobs" from a temporary search failure.
- Query text that is blank after normalization behaves as browse; whitespace-only, overlong, repeated, and unsupported criteria are safely bounded.
- Salary filters reject inverted ranges and compare only postings whose disclosed salary unit and currency are compatible with the selected criteria.
- Pagination is stable when postings are published, closed, or removed between page requests; duplicates are not introduced within one request sequence.
- Public job URLs never contain session credentials, private tracking data, recruiter identifiers, moderation state, or report information.
- Save, report, and apply mutations reject cross-site requests, expired/revoked sessions, suspended/deleted accounts, and client-supplied ownership identifiers.
- Free text in jobs, application answers, cover letters, and reports is validated and safely displayed; executable markup never runs.
- Application eligibility is rechecked in the committing operation, including job status, deadline, account state, CV confirmation, and duplicate ownership.
- A temporary Feature 004 upload, draft, artifact, or confirmation receipt is never a retained attachment; when no confirmed Candidate CV exists, the form offers the validated direct-import recovery and creates no application until confirmation succeeds.
- Concurrent apply, save, remove, and report requests converge through uniqueness or idempotency controls rather than timing-dependent client behavior.
- Notification-provider failure cannot corrupt or roll back a committed application.
- Loading, empty, validation, success, unavailable, and retry states are perceivable without relying only on color and remain operable by keyboard at 320 CSS pixels.
- Quick view, full details, Saved Jobs, and Suggested Jobs reconcile Save, Apply, hidden, unavailable, and session state rather than maintaining contradictory copies.
- An imported application CV that fails type, content, malware, size, storage, confirmation, or persistence checks cannot be selected and leaves no orphan retained content.
- Candidate tracking preserves immutable snapshots and permitted history when the public job changes or disappears, while suppressing recruiter-only events and data.
- Hidden jobs remain public to other actors and can be restored by the Candidate; hiding never changes moderation or lifecycle state.
- Protected or job-irrelevant Candidate attributes never contribute to suggestion inclusion, exclusion, match indicators, or ordering.
- Optional analysis, image search, and notification failure cannot disable ordinary manual search, application submission, or Candidate tracking.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 [UC-JOB-01]**: The system MUST offer public browsing without requiring authentication.
- **FR-002 [UC-JOB-01]**: The public catalogue MUST include only Administrator-approved postings from verified companies that are active, published, and still inside their application window.
- **FR-003 [UC-JOB-01]**: Keyword matching MUST be case-insensitive and Vietnamese-diacritic-insensitive across approved searchable job fields while preserving original displayed text.
- **FR-004 [UC-JOB-01]**: Actors MUST be able to filter by location, employment type, experience level, working arrangement, disclosed salary range, skills/tags, and posting date.
- **FR-005 [UC-JOB-01]**: The system MUST define and offer stable sorting by relevance, newest posting, and disclosed salary, including deterministic tie-breaking.
- **FR-006 [UC-JOB-01]**: Search criteria MUST be bounded, validated, normalized, represented in a shareable safe URL, and preserved across pagination during the current discovery flow.
- **FR-007 [UC-JOB-01]**: Results MUST provide total-result information and pagination or controlled incremental loading without disclosing private counts or records.
- **FR-008 [UC-JOB-01]**: Invalid criteria, empty results, unavailable jobs, and temporary search failures MUST have distinct accessible responses that preserve valid criteria and offer appropriate recovery actions.
- **FR-009 [UC-JOB-02]**: The system MUST expose a stable canonical public URL for every currently or historically public posting.
- **FR-010 [UC-JOB-02]**: Public details MUST include only approved job and company fields and MUST exclude recruiter contact data, internal moderation data, reports, applications, and company-private fields.
- **FR-011 [UC-JOB-02]**: Active, closed, expired, and unavailable job states MUST be clearly distinguished, and Apply MUST be unavailable whenever a job no longer accepts applications.
- **FR-012 [UC-JOB-02]**: Removed, private, pending-review, rejected, and unknown postings MUST produce the same neutral unavailable response.
- **FR-013 [UC-JOB-02]**: Available actions MUST be derived from the current session, account state, posting state, and only that actor's saved/application history.
- **FR-014 [UC-JOB-02]**: When a visitor selects a protected action, the authentication flow MUST retain only a validated internal return destination and MUST recheck authorization after login.
- **FR-015 [UC-JOB-03]**: An authenticated eligible user MUST be able to save a valid posting and remove their own saved relationship.
- **FR-016 [UC-JOB-03]**: At most one saved relationship MAY exist for a user and posting; repeated and concurrent save/remove requests MUST be idempotent and return the authoritative final state.
- **FR-017 [UC-JOB-03]**: A failed save/remove request MUST leave the prior stored state authoritative and provide visible reconciliation and retry guidance.
- **FR-018 [UC-JOB-03]**: An unavailable saved posting MAY remain as a neutral historical reference but MUST NOT expose private/removal details or permit prohibited actions.
- **FR-019 [UC-JOB-05]**: Authenticated eligible users MUST be able to select a supported report reason and provide bounded plain-text details when required for that reason.
- **FR-020 [UC-JOB-05]**: A successful report MUST begin in `Pending Review`, remain visible only to authorized moderators, and keep reporter identity and content private from public and company job-board views.
- **FR-021 [UC-JOB-05]**: The system MUST prevent more than one unresolved report by the same user for the same job and reason while returning a neutral already-received result.
- **FR-022 [UC-JOB-05]**: Report submission MUST be abuse-controlled, audited, and incapable by itself of automatically removing or changing a posting.
- **FR-023 [UC-APP-01]**: Only an authenticated active Candidate identity MAY submit an application, and ownership MUST be derived exclusively from the verified server session.
- **FR-024 [Application]**: The application flow MUST allow selection of a currently confirmed, unarchived, Candidate-owned retained CV or import of one new PDF/DOCX Candidate CV of exactly `1..5,000,000` bytes under the retained-CV validation, malware-safety, consent, storage, retention, and deletion policy.
- **FR-025 [Application]**: A newly imported application CV MUST become a distinct retained Candidate CV before selection and MUST NOT reuse or promote a temporary Feature 004 source, artifact, extracted text, draft, provenance record, or confirmation receipt.
- **FR-026 [Application]**: The application form MUST present and validate contact information, missing required profile fields, active employer questions, an optional cover letter, current application consent, and separate optional analysis consent.
- **FR-027 [Application]**: A successful submission MUST transactionally create exactly one application in canonical `Applied` with immutable/versioned profile, contact, selected-CV, job, answer, cover-letter, and consent snapshots as applicable.
- **FR-028 [UC-APP-01]**: Repeated or concurrent submissions by one candidate to one job MUST return the existing successful application and MUST NOT create duplicates.
- **FR-029 [Application]**: Application persistence failure MUST roll back partial application data and unused newly staged content; notification or approved scoring failure after commit MUST NOT invalidate the application.
- **FR-030 [Application]**: Successful submission MUST create privacy-minimized audit evidence and durable work for applicable Candidate/company notifications without exposing application content in ordinary logs.
- **FR-031 [Cross-cutting]**: All mutation inputs MUST reject unknown ownership fields, unsafe markup, and cross-site requests; server-side authentication, account-state enforcement, and authorization MUST precede protected reads and writes.
- **FR-032 [Cross-cutting]**: Job, application, CV, preference, saved/hidden state, and report data MUST follow least privilege and applicable Vietnamese consent, purpose-limitation, retention, disclosure, and deletion requirements.
- **FR-033 [Cross-cutting]**: Critical application and report events and protected-operation failures MUST record actor, action, target, result, correlation identifier, and timestamp without recording credentials, raw CV content, answers, report text, or unnecessary personal data.
- **FR-034 [Cross-cutting]**: Search, filters, sorting, pagination, quick view, job actions, forms, timelines, feedback, dialogs, and recovery MUST support keyboard operation, labels, visible focus, contrast, non-color cues, and responsive use at 320 CSS pixels.
- **FR-035 [Cross-cutting]**: Search/filter and job-detail interactions MUST meet the constitution's two-second target and public page loads MUST meet the three-second target under a documented environment, dataset, method, and supported-load condition.
- **FR-036 [Application]**: Candidate-initiated correction of a missing location from the application flow MUST use current profile state, expose conflicts or failures, and preserve safe application input.
- **FR-037 [Quick View]**: Result, Saved, and Suggested lists MUST offer a modal quick view with permitted summary fields, previous/next navigation, Escape/close behavior, focus restoration, and action state consistent with full details.
- **FR-038 [Related Jobs]**: Job details MAY show related or personalized discovery candidates only from eligible public postings; ordering MUST use approved deterministic job-relevant signals with stable tie-breaking and expose no private profile data.
- **FR-039 [Candidate Workspace]**: Authenticated Candidates MUST have coherent navigation among Find Jobs, Saved Jobs, My Applications, Suggested Jobs, and Job Recommendation Settings.
- **FR-040 [Hidden Jobs]**: Candidates MUST be able to hide and restore jobs in personalized lists; hidden state MUST be Candidate-scoped, MUST NOT mutate a posting, and MUST offer an immediate undo path.
- **FR-041 [Preferences]**: Candidate job settings MUST validate and persist bounded target positions, custom positions, skills, experience, desired minimum salary, work locations, relocation willingness, and separate analysis/notification consent choices.
- **FR-042 [Suggestions]**: Suggested Jobs MUST include only eligible public postings, exclude applied and hidden jobs, calculate a bounded match indicator from approved job-relevant preferences, expose matched criteria, and use stable deterministic ordering.
- **FR-043 [Fairness and Control]**: Protected and job-irrelevant attributes MUST NOT affect inclusion, exclusion, match indication, or order; Candidates MUST be able to update preferences, hide suggestions, and continue ordinary search without optional processing.
- **FR-044 [Application Tracking]**: Candidates MUST be able to list only their own applications, ordered by latest stage change, and filter by every canonical stage and the Active, Needs Attention, Paused, and Completed groups.
- **FR-045 [Application Tracking]**: Application lists MUST support bounded pagination without duplicates and show job/company snapshot, canonical stage, submission time, last stage-change time, availability, and a human-readable next step.
- **FR-046 [Application Tracking]**: An owned application detail MUST show its immutable selected-CV name, cover letter and submitted answers when present, plus only Candidate-visible chronological stage events and reasons.
- **FR-047 [Application Tracking]**: Application records MUST remain accessible to their Candidate when the public job becomes unavailable, while another Candidate's identifier MUST return a neutral unavailable result.
- **FR-048 [Scoring Boundary]**: Optional analysis status or results MUST be separate from recruitment stage, require approved consent and scoring policy, never fabricate a result, never change a stage, and never block submission or tracking when unavailable.
- **FR-049 [Localization]**: Candidate workspace navigation and recommendation settings MUST use the Candidate's supported language consistently, including validation, consent, loading, success, and error feedback.
- **FR-050 [Feature 005 Boundary]**: Image-assisted search is outside Feature 003; validated visible criteria from Feature 005 MUST use the same deterministic search contract as equivalent manual criteria, without raw image or OCR artifacts entering Feature 003.
- **FR-051 [Job Management Exclusion]**: Feature 003 MUST NOT expose recruiter or Administrator job create, edit, duplicate, publish, pause, close, delete, lifecycle-management, approval, rejection, or moderation-decision capabilities.
- **FR-052 [Pipeline Exclusion]**: Candidate views MUST be read-only for recruitment stages; recruiter stage transitions, Kanban/pipeline management, scoring generation, offer decisions, and hiring confirmation belong to separate approved features.
- **FR-053 [Application]**: Immediately before commit, the system MUST recheck job availability, Candidate/account eligibility, CV confirmation/ownership/archive/type/size, required answers, current consent, and duplicate-application rules.

### Key Entities

- **Public Company Profile**: The approved company identity and public fields that may be shown with a posting; private membership, business-document, and recruiter data remain separate.
- **Job Posting**: A versioned vacancy with public content, structured search/filter attributes, publication window, deadline, approval, lifecycle state, and owning company reference; Feature 003 consumes but does not manage it.
- **Job Skill/Tag**: A normalized searchable label related to one or more postings while preserving a public display label and relevance/requirement metadata.
- **Candidate Job Workspace State**: Candidate-scoped saved/hidden job identifiers, recommendation preferences, and consent choices.
- **Job Preference**: Candidate-declared target positions, skills, experience, salary, location, and relocation criteria used for explainable suggestions; protected attributes are excluded from matching.
- **Saved Job**: A user-scoped unique relationship to a posting with creation time; it may preserve a neutral reference after public availability changes.
- **Hidden Job**: Candidate-scoped suppression preference that never changes the posting and can be restored.
- **Job Report**: A private, user-scoped moderation concern with reason, bounded details, review state, timestamps, and uniqueness for unresolved duplicate concerns.
- **Candidate CV**: Candidate-owned retained application document with confirmation, versioned metadata, private storage, and a retention/deletion contract; Feature 003 may import one directly for application use but never promotes Feature 004 temporary artifacts.
- **Application Question**: A versioned posting-specific prompt with required/optional status, order, and bounded answer rules.
- **Job Application**: The unique candidate-to-posting submission with canonical recruitment stage, submission time, idempotency identity, and immutable/versioned snapshots.
- **Application Answer**: A snapshot answer tied to the exact question version presented at submission.
- **Application Consent Snapshot**: The consent version and acceptance time recorded for the application.
- **Application Stage Event**: Versioned transition record with time, source/target stage, Candidate-visibility decision, and optional Candidate-visible reason.
- **Application Scoring Status**: Optional approved analysis lifecycle/result reference that remains separate from the canonical recruitment stage.
- **Notification Work and Audit Event**: Durable, privacy-minimized evidence for asynchronous notification delivery and critical actions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 95% of supported job search/filter requests show a complete result, empty, validation, or retry state within two seconds under the documented normal-load dataset and environment.
- **SC-002**: At least 95% of public job-detail requests show the permitted detail or neutral unavailable state within two seconds, and supported public pages finish loading within three seconds under the same documented conditions.
- **SC-003**: Every equivalent Vietnamese search with case changes or omitted diacritics returns the same result set, while zero pending, rejected, removed, future, closed, expired, or unverified-company postings appear as active.
- **SC-004**: At least 90% of representative participants can find a suitable job, use quick view, understand availability, and reach the appropriate next action on their first attempt without assistance.
- **SC-005**: In 100% of duplicate and concurrent save, hide/restore, report, and apply tests, uniqueness/idempotency rules produce one authoritative Candidate state or record.
- **SC-006**: In 100% of injected application transaction failures, no partial application is visible; in 100% of injected notification-provider failures after commit, the application remains valid and retryable notification work remains recorded.
- **SC-007**: Authorization tests disclose zero other-user saved/hidden state, preferences, CVs, applications, answers, timelines, reports, or non-public company/posting fields across supported actors and account states.
- **SC-008**: All seven journeys pass keyboard-only, screen-reader semantics, focus restoration, contrast, non-color state, supported-language consistency, and 320-CSS-pixel responsive checks with meaningful feedback.
- **SC-009**: In 100% of valid new-CV application tests, an eligible PDF/DOCX becomes a distinct confirmed retained CV before submission; invalid type, content, malware, size, ownership, or persistence tests create no application or orphan retained content.
- **SC-010**: Every Candidate tracking fixture uses only the nine canonical stages, shows only Candidate-visible events, preserves unavailable-job history, and keeps scoring status separate from recruitment stage.
- **SC-011**: Every suggested-job test excludes unavailable, applied, and hidden jobs; displays contributing job-relevant criteria; produces the same order for the same inputs; and shows zero variation when only protected attributes change.
- **SC-012**: At least 90% of representative Candidates can configure preferences, understand consent and matching explanations, and update or hide an unsuitable suggestion on their first attempt without assistance.
- **SC-013**: Manual search, deterministic filtering, job details, application submission without optional scoring, and Candidate tracking remain usable in 100% of tests where optional analysis, image search, or notification delivery is unavailable.

## Assumptions

- Existing SmartHire authentication remains the exclusive browser-session mechanism and every normal authenticated account retains a Candidate identity.
- A separate job-management feature creates, edits, publishes, closes, removes, and moderates Job Postings. Feature 003 receives approved public records and defines no management mutations.
- Full Candidate Profile and CV-library management remain separate capabilities. Feature 003 owns only the narrow application integration that can import one validated retained CV and update missing location through explicit Candidate action.
- Feature 004 temporary CV imports remain governed by their own parsing, review, retention, and deletion contract and never become application attachments by implication.
- Recruiter pipeline transitions and scoring generation are separate capabilities; Feature 003 consumes only Candidate-visible stage events and approved optional scoring status/results.
- A candidate may have at most one application per job in this release; withdrawal and reapplication rules are outside this feature.
- Salary matching uses explicitly disclosed structured salary data and a supported currency/period; postings with undisclosed or incompatible salary data do not satisfy a numeric salary filter.
- Public search, related jobs, and preference suggestions use deterministic job-relevant matching. No AI directly selects, excludes, or ranks job identifiers in Feature 003.
- Feature 005 may translate an image into visible validated search criteria, but Feature 003 remains authoritative for deterministic retrieval and ranking.
- Search result URLs may be shared, but a dedicated share-to-external-application workflow (UC-JOB-04) is outside the requested scope.

## Scope Boundaries

### In Scope

- Public browse, Vietnamese-aware search, filtering, sorting, pagination, quick view, canonical details, and deterministic related jobs.
- Candidate Saved Jobs, hide/restore, recommendation settings, explainable Suggested Jobs, and supported-language workspace navigation.
- Candidate application form, retained CV selection/import boundary, contact/location completion, questions, cover letter, consent, idempotent submission, audit, and notification work.
- Candidate-owned application list, filtering, pagination, immutable detail, Candidate-visible timeline, unavailable-job preservation, and approved optional scoring-status display.
- Private job reporting, authorization, privacy, accessibility, recovery, and measurable quality evidence for these journeys.

### Out of Scope

- Recruiter/Administrator job creation, editing, duplication, publishing, pausing, closing, deletion, lifecycle management, moderation review, approval, and rejection.
- Recruiter application queues, scoring generation, pipeline/Kanban transitions, interviews, offers, hiring confirmation, exports, and employer analytics.
- Candidate withdrawal, reapplication, offer response, and direct messaging.
- Full Candidate Profile/CV-library management, CV parsing/review, automatic Profile enrichment, and reuse of temporary Feature 004 artifacts as application documents.
- Image upload, OCR, image-search consent/retention, and intent interpretation, which belong to Feature 005; Feature 003 consumes only visible validated criteria.
- AI-generated job descriptions, autonomous job selection/ranking, autonomous recruitment decisions, and automatic enforcement based solely on a report.
- Dedicated UC-JOB-04 external sharing controls beyond ordinary canonical URLs.
