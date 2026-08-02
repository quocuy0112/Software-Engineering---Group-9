# Feature Specification: Job Board and Advanced Search

**Feature Branch**: `003-job-board-and-advanced-search`

**Created**: 2026-08-01

**Status**: Clarified

**Input**: User description: "Deliver a complete Spec-Kit cycle, generated tests, and corresponding source code for UC-JOB-01 Browse/Search/Filter Jobs, UC-JOB-02 View Job Details, UC-JOB-03 Save or Remove Job, UC-JOB-05 Report Job Posting, and UC-APP-01 Apply for a Job."

## Clarifications

### Session 2026-08-01

- Q: Which postings may appear in public browse, search, and detail views? → A: Only Administrator-approved postings that are currently active and within their publication window; unavailable postings use a neutral response.
- Q: How must Vietnamese job search treat text? → A: Keyword and comparable text filters are case-insensitive and Vietnamese-diacritic-insensitive while displayed content preserves its original spelling and diacritics.
- Q: Are UC-JOB-03 and UC-JOB-05 included despite being marked Should? → A: Yes. Both are included as P2 increments after the three Must workflows.
- Q: What is the initial application stage? → A: A successful submission creates exactly one application in the canonical `Applied` stage; `Submitted` is an action/result, not a second recruitment stage.
- Q: What candidate material may be submitted? → A: The candidate must select an already confirmed CV and provide the job-specific required answers and current consent; CV upload/parsing itself remains a dependency outside this feature.

No additional critical ambiguity remains after reconciling the requested use cases with the SmartHire constitution and approved candidate-job-journey specification.

### Session 2026-08-02

- Q: Does Feature 004 automatically provide the retained CV attachment required by UC-APP-01? → A: No. Feature 004 imports a temporary source into Candidate Profile and must delete that source; `CandidateCv` is a separate retained, confirmed application-document dependency and must never point at a temporary Feature 004 artifact.
- Q: What exact CV size bound applies at the application boundary? → A: The constitutional decimal limit is `1..5,000,000` bytes, not 5 MiB.
- Q: Which optional Job Board capabilities are included now? → A: UC-JOB-03 and UC-JOB-05 remain the selected P2/Should increments. UC-JOB-04 remains a later backlog option because canonical safe URLs already provide its prerequisite without expanding this delivery.

The specification is functionally clarified. Production release of UC-APP-01 remains gated on an approved upstream capability that creates retained `CandidateCv` records under its own consent, storage, retention, deletion, and malware-safety contract; controlled fixtures prove only this feature's consumer boundary.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse, Search, and Filter Jobs (Priority: P1)

**Detailed checklist and evidence**: [US1 Browse, Search, and Filter Jobs](checklists/us1-browse-search-filter-results.md)

As a visitor or authenticated user, I can browse active approved jobs and narrow the catalogue with normalized keywords, filters, sorting, and pagination so that I can find relevant opportunities efficiently.

**Why this priority**: Public job discovery is the entry point for the complete candidate journey and is a mandatory P0 capability.

**Independent Test**: Seed active, future, expired, closed, pending-review, and removed postings; search with Vietnamese text with and without diacritics; combine each supported filter and sort; paginate results; and verify that only matching active public postings appear within two seconds under documented normal load.

**Acceptance Scenarios**:

1. **Given** active approved postings exist, **When** an actor opens the jobs page without criteria, **Then** the actor sees a paginated default catalogue containing only active public postings and total-result information.
2. **Given** a posting contains Vietnamese text with diacritics, **When** the actor searches using an equivalent term with different case or omitted diacritics, **Then** the posting is included without altering its displayed text.
3. **Given** filters for location, employment type, experience level, work arrangement, salary, skills/tags, and posting date, **When** the actor combines valid criteria, **Then** every displayed result satisfies all selected filters and the selected sort order.
4. **Given** one criterion is invalid, **When** the search is submitted, **Then** the invalid criterion is identified, other valid criteria are preserved, and no private or inactive posting data is disclosed.
5. **Given** no posting matches, **When** results are returned, **Then** the actor sees an accessible empty state with actions to clear or change criteria.
6. **Given** a displayed job becomes unavailable, **When** the actor requests another result page or refreshes the search, **Then** the job is omitted or clearly unavailable and cannot accept a new application.

---

### User Story 2 - View Job Details (Priority: P1)

**Detailed checklist and evidence**: [US2 View Job Details](checklists/us2-view-job-details-results.md)

As a visitor or authenticated user, I can open a stable public job link and review the complete permitted job and company information so that I can decide whether to apply or retain the opportunity.

**Why this priority**: Candidates need trustworthy details before they can make an informed application decision.

**Independent Test**: Open public links for active, expired, closed, removed, private, and unknown postings as a visitor and as an authenticated candidate; verify the public fields, status labels, available actions, and neutral unavailable response.

**Acceptance Scenarios**:

1. **Given** an active public posting, **When** the actor opens its canonical link, **Then** the page shows the approved title, public company information, location, work arrangement, employment type, salary when disclosed, description, responsibilities, requirements, benefits, skills/tags, and deadline.
2. **Given** a closed or expired public posting, **When** its link is opened, **Then** public historical details remain visible, its state is clearly labeled, and applying is unavailable.
3. **Given** a removed, private, pending-review, rejected, or unknown posting, **When** its identifier or link is requested, **Then** a neutral unavailable view reveals neither its existence nor moderation details.
4. **Given** a visitor selects Save, Report, or Apply, **When** authentication is required, **Then** the login flow retains a safe return destination and returns to the same public job after successful authentication.
5. **Given** an authenticated user has saved or applied to the job, **When** details load, **Then** the available action reflects the stored state without exposing another user's interaction.

---

### User Story 3 - Apply for a Job (Priority: P1)

**Detailed checklist and evidence**: [US3 Apply for a Job](checklists/us3-apply-for-job-results.md)

As an authenticated candidate, I can review my confirmed profile and CV, answer job-specific questions, accept the current consent, and submit one application so that the hiring company can evaluate my candidacy.

**Why this priority**: Application submission is the mandatory conversion point of the job board and a complete P0 workflow.

**Independent Test**: Use a candidate with a confirmed CV and eligible profile to apply to an active posting, then verify one `Applied` application, immutable submission snapshots, answers, consent version, durable notification work, audit evidence, and safe behavior for duplicate, closed-job, expired-session, and injected transaction-failure cases.

**Acceptance Scenarios**:

1. **Given** an eligible authenticated candidate, an active posting, a confirmed CV, complete required information, and accepted consent, **When** the candidate submits, **Then** exactly one application is created in the `Applied` stage with submission snapshots and an accessible confirmation.
2. **Given** required profile information, a confirmed CV, an answer, or consent is missing, **When** the candidate reviews or submits the application, **Then** the missing requirement is identified, entered non-sensitive data is preserved when safe, and no application is created.
3. **Given** the candidate already has an application for the posting, **When** another or concurrent submission is attempted, **Then** no duplicate is created and the existing application becomes the authoritative result.
4. **Given** the posting closes or its deadline passes before final submission, **When** availability is rechecked, **Then** no application is created and the candidate receives a clear unavailable message.
5. **Given** application persistence fails during submission, **When** the operation ends, **Then** all partial records are rolled back and no success state is shown.
6. **Given** the application commits but notification delivery is unavailable, **When** submission completes, **Then** the application remains valid, retryable notification work remains recorded, and confirmation is still shown.

---

### User Story 4 - Save or Remove a Job (Priority: P2)

**Detailed checklist and evidence**: [US4 Save or Remove a Job](checklists/us4-save-remove-job-results.md)

As an authenticated user, I can save a job for later or remove it from my saved collection so that I can organize opportunities without creating duplicate records.

**Why this priority**: Saving improves continuity but is not required to discover, inspect, or apply for a job.

**Independent Test**: Save and remove the same posting from result and detail views, repeat and race both operations, expire the session, make the posting unavailable, and verify one user-scoped relationship and visible reconciliation with the authoritative stored state.

**Acceptance Scenarios**:

1. **Given** an authenticated user has not saved a valid job, **When** Save is selected, **Then** one saved relationship is created and every visible control for that job reflects the saved state.
2. **Given** the job is saved, **When** removal is confirmed, **Then** the relationship is removed and visible controls return to the unsaved state.
3. **Given** duplicate or concurrent save/remove requests, **When** they complete, **Then** the operation is idempotent and the UI reconciles to the final authoritative state.
4. **Given** persistence fails or the session expires, **When** the operation is attempted, **Then** the prior stored state remains unchanged and a retry or login action is available.
5. **Given** a saved posting later becomes unavailable, **When** its saved state is read, **Then** it may remain as a neutral historical reference but prohibited actions remain unavailable.

---

### User Story 5 - Report a Job Posting (Priority: P2)

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
- A temporary Feature 004 upload, draft, artifact, or confirmation receipt is never treated as a retained application attachment; absence of an approved retained `CandidateCv` produces the ordinary no-confirmed-CV recovery path.
- Concurrent apply, save, remove, and report requests converge through uniqueness or idempotency controls rather than timing-dependent client behavior.
- Notification-provider failure cannot corrupt or roll back a committed application.
- Loading, empty, validation, success, unavailable, and retry states are perceivable without relying only on color and remain operable by keyboard at 320 CSS pixels.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 [UC-JOB-01]**: The system MUST offer public browsing without requiring authentication.
- **FR-002 [UC-JOB-01]**: The public catalogue MUST include only Administrator-approved postings that are active, have reached their publication time, and have not passed their application deadline or closing time.
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
- **FR-024 [UC-APP-01]**: The application flow MUST identify missing required profile information and MUST require selection of a currently confirmed, unarchived, candidate-owned retained `CandidateCv` of `1..5,000,000` bytes; a temporary Feature 004 import artifact or confirmation receipt alone MUST NOT qualify as an application attachment.
- **FR-025 [UC-APP-01]**: The application form MUST collect all active required job-specific answers, optional supported information, and explicit acceptance of the current application-consent version.
- **FR-026 [UC-APP-01]**: Immediately before committing, the system MUST recheck job availability, deadline, candidate eligibility, retained-CV confirmation, ownership, archival and exact byte-size rules, required answers, consent, and duplicate-application rules.
- **FR-027 [UC-APP-01]**: A successful submission MUST transactionally create exactly one application in the canonical `Applied` stage together with immutable/versioned snapshots of relevant candidate profile, selected CV metadata/content reference, job information, submitted answers, and consent version.
- **FR-028 [UC-APP-01]**: Repeated or concurrent submissions by one candidate to one job MUST return the existing successful application and MUST NOT create duplicates.
- **FR-029 [UC-APP-01]**: Application persistence failure MUST roll back partial application data; notification delivery failure after commit MUST NOT invalidate the application and MUST remain retryable.
- **FR-030 [UC-APP-01]**: Successful application submission MUST create auditable submission evidence and durable work for applicable candidate and recruiter notifications without exposing sensitive application content in ordinary logs.
- **FR-031 [Cross-cutting]**: All mutation inputs MUST reject unknown ownership fields, unsafe markup, and cross-site requests; server-side authentication, account-state enforcement, and authorization MUST precede protected reads and writes.
- **FR-032 [Cross-cutting]**: Job, application, CV, saved-job, and report data MUST follow least privilege and applicable Vietnamese consent, purpose-limitation, retention, disclosure, and deletion requirements.
- **FR-033 [Cross-cutting]**: Critical application and report events and protected-operation failures MUST record actor, action, target, result, correlation identifier, and timestamp without recording credentials, raw CV content, answers, report text, or unnecessary personal data.
- **FR-034 [Cross-cutting]**: Search, filters, sorting, pagination, job actions, forms, feedback, dialogs, and error recovery MUST support keyboard operation, descriptive labels, visible focus, sufficient contrast, non-color status cues, and responsive use at 320 CSS pixels.
- **FR-035 [Cross-cutting]**: Search/filter and job-detail interactions MUST meet the constitution's two-second target and public page loads MUST meet the three-second target under a documented environment, dataset, method, and supported-load condition.

### Key Entities

- **Public Company Profile**: The approved company identity and public fields that may be shown with a posting; private membership, business-document, and recruiter data remain separate.
- **Job Posting**: A versioned vacancy with public content, structured search/filter attributes, publication window, deadline, moderation approval, lifecycle state, and owning company reference.
- **Job Skill/Tag**: A normalized searchable label related to one or more postings while preserving a public display label and relevance/requirement metadata.
- **Saved Job**: A user-scoped unique relationship to a posting with creation time; it may preserve a neutral reference after public availability changes.
- **Job Report**: A private, user-scoped moderation concern with reason, bounded details, review state, timestamps, and uniqueness for unresolved duplicate concerns.
- **Candidate CV**: Candidate-owned, retained application document with confirmation state, versioned metadata, private storage, and its own retention/deletion contract; this feature consumes it but does not silently promote Feature 004 temporary imports into it.
- **Application Question**: A versioned posting-specific prompt with required/optional status, order, and bounded answer rules.
- **Job Application**: The unique candidate-to-posting submission with canonical recruitment stage, submission time, idempotency identity, and immutable/versioned snapshots.
- **Application Answer**: A snapshot answer tied to the exact question version presented at submission.
- **Application Consent Snapshot**: The consent version and acceptance time recorded for the application.
- **Notification Work and Audit Event**: Durable, privacy-minimized evidence for asynchronous notification delivery and critical actions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 95% of supported job search/filter requests show a complete result, empty, validation, or retry state within two seconds under the documented normal-load dataset and environment.
- **SC-002**: At least 95% of public job-detail requests show the permitted detail or neutral unavailable state within two seconds, and supported public pages finish loading within three seconds under the same documented conditions.
- **SC-003**: Every test search using equivalent Vietnamese text with case changes or omitted diacritics returns the same result set, while no pending, rejected, removed, future, closed, or expired-only posting appears as active.
- **SC-004**: At least 90% of representative candidate participants can find a suitable job using filters, understand its availability, and reach the appropriate next action on their first attempt without assistance.
- **SC-005**: In 100% of duplicate and concurrent save, report, and apply test runs, uniqueness rules produce one authoritative saved relationship, unresolved report, or application as applicable.
- **SC-006**: In 100% of injected application transaction failures, no partial application is visible; in 100% of injected notification-provider failures after commit, the application remains valid and retryable notification work remains recorded.
- **SC-007**: Automated authorization tests disclose zero other-user saved jobs, CVs, applications, answers, reports, or non-public company/posting fields across supported actor and account-state combinations.
- **SC-008**: All five use-case journeys pass keyboard-only, screen-reader semantics, contrast, non-color state, and 320-CSS-pixel responsive checks with meaningful loading, validation, success, empty, unavailable, and recovery feedback.

## Assumptions

- Existing SmartHire authentication remains the exclusive browser-session mechanism and every normal authenticated account retains a Candidate identity.
- Job creation, company membership management, employer verification, moderation decisions, CV upload/parsing, application tracking, scoring, recruiter pipeline management, and notification consumption are separate functional groups; this feature defines only the integration boundary required to discover jobs and create notification work.
- Job-management or test fixtures provide approved active postings; this feature does not expose recruiter job-create/edit/publish APIs.
- Candidate Profile comes from Features 002/004. Feature 004 intentionally does not provide retained application documents. An approved upstream retained-document capability must create `CandidateCv` records before production UC-APP-01 release; controlled fixtures may create them only for isolated contract and application validation.
- A candidate may have at most one application per job in this release; withdrawal and reapplication rules are outside this feature.
- Salary matching uses explicitly disclosed structured salary data and a supported currency/period; postings with undisclosed or incompatible salary data do not satisfy a numeric salary filter.
- Relevance sorting is deterministic and based on approved searchable job fields; AI-generated search keywords and LLM-based recommendations are excluded.
- Search result URLs may be shared, but a dedicated share-to-external-application workflow (UC-JOB-04) is outside the requested scope.

## Scope Boundaries

### In Scope

- UC-JOB-01, UC-JOB-02, UC-JOB-03, UC-JOB-05, and UC-APP-01, including public and authenticated UI, server validation, persistence, authorization, error handling, audit evidence, tests, and performance/accessibility verification.

### Out of Scope

- UC-JOB-04 sharing controls beyond ordinary canonical URLs.
- Recruiter job creation/editing/lifecycle screens and Administrator moderation/review interfaces.
- Candidate CV upload, parsing, confirmation, application-history tracking, scoring, recommendations, pipeline transitions, and notification inbox/email delivery UI.
- Silent promotion, reuse, or long-term retention of Feature 004 temporary source files, extracted text, drafts, provenance, or confirmation receipts as application attachments.
- AI-generated keywords, semantic job recommendations, AI hiring decisions, and any automatic enforcement based solely on a report.
