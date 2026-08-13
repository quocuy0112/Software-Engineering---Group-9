# Feature Specification: Submitted Candidates List & CV Access — Group 1

**Feature Directory**: `012-candidate-filtering-and-hybrid-scoring-system`  
**Created**: 2026-08-13  
**Status**: Ready for implementation planning  
**Scope**: Group 1 specification; later Spec-Kit artifacts may refine implementation details without expanding into Groups 2–4

## Clarifications

### Session 2026-08-13

- Q: Is a valid CV required for every candidate submission? → A: Yes. A submission without a valid CV is not accepted.
- Q: How are duplicate submissions by one candidate to the same job handled? → A: Permit exactly one Application per candidate-job pair; repeated submission attempts are idempotent and do not create another Application.
- Q: Do later Candidate Profile or CV-library changes alter the submitted documents? → A: No. The Application retains immutable snapshots of the CV and cover letter accepted at submission time.
- Q: What applicant volume and list-response target must Group 1 support? → A: Support 10,000 applications for one job; the initial and subsequent list pages must become usable at P95 within 2 seconds under documented representative conditions.
- Q: Which candidate contact details may the list expose? → A: Show the candidate's verified email and only a phone number explicitly shared for that application; expose neither unrelated profile contact fields nor cross-company data.
- Q: What state does a newly accepted Application enter? → A: Every accepted Application starts in the canonical `Applied` state; Group 1 performs no later pipeline transition.
- Q: How long are original application documents retained? → A: Retain them until 12 months after the later of job closure or the Application entering a terminal state, then deny access immediately and physically delete them within 30 days, subject only to a documented legal hold.
- Q: How are pre-cutover records handled? → A: Never fabricate submissions from `appliedJobIds[]`. An existing authoritative submission may be included only when its original evidence can be proven and safely migrated; unverifiable legacy hints remain excluded.

## 1. User Stories

### User Story 1 — View submitted candidates for a job (Priority: P1)

As an authorized Recruiter viewing a specific job posting, I want to see all candidates who submitted an application to that job so that I can begin evaluating them from one centralized place.

**Why this priority**: The job-scoped candidate list is the entry point for every later screening activity.

**Independent test**: Use a job with multiple submissions and verify that the authorized Recruiter can open its submitted-candidates view and identify every application without relying on any score.

**Acceptance scenarios**:

1. **Given** a Recruiter is authorized for a job posting with multiple authoritative submissions accepted after cutover or safely migrated with proven original evidence, **when** the Recruiter opens the submitted-candidates view, **then** every eligible submission for that job is shown once as a distinct application record.
2. **Given** applications have not been scored, **when** the list is displayed, **then** each application remains visible and usable without a score, score placeholder, rank, or color classification being required.
3. **Given** a submission belongs to another job or another company outside the Recruiter's authorized scope, **when** the list is requested, **then** that submission and its candidate information are not disclosed.

### User Story 2 — Open or download the original CV (Priority: P1)

As an authorized Recruiter, I want to open a candidate's original CV and download it when needed so that I can review the document the candidate actually submitted.

**Why this priority**: The original CV is the primary evidence available before any automated or AI-assisted evaluation exists.

**Independent test**: Select an application with an accessible CV, preview it, download it, and verify that both actions refer to the original document attached to that application.

**Acceptance scenarios**:

1. **Given** an application has a valid previewable CV, **when** the Recruiter chooses to open it, **then** the original CV is shown in an inline preview or a separate safe viewer without losing the list context.
2. **Given** an application has an accessible CV, **when** the Recruiter chooses download, **then** the original file is downloaded with a meaningful filename.
3. **Given** the CV cannot be previewed but remains safely downloadable, **when** the Recruiter attempts to open it, **then** the interface explains that preview is unavailable and offers download.

### User Story 3 — Open or download the cover letter (Priority: P1)

As an authorized Recruiter, I want to read or download the candidate's submitted cover letter so that I can review the candidate's stated motivation and context.

**Why this priority**: A submitted cover letter is part of the original application evidence and must be accessible alongside the CV.

**Independent test**: Verify text-based and file-based cover letters can be opened, file-based letters can be downloaded, and absent cover letters are represented without an error.

**Acceptance scenarios**:

1. **Given** an application contains cover-letter text, **when** the Recruiter opens it, **then** the submitted text is shown in a readable view.
2. **Given** an application contains a cover-letter file, **when** the Recruiter opens or downloads it, **then** the original file is previewed when supported or downloaded on request.
3. **Given** no cover letter was submitted, **when** the application appears in the list, **then** it is labelled `Not provided` and no open or download action is offered.

### User Story 4 — See an empty state for a job with no submissions (Priority: P1)

As an authorized Recruiter viewing a job with no submissions, I want a clear empty state so that I know the list loaded correctly and no candidates have applied yet.

**Why this priority**: A trustworthy zero-result state prevents Recruiters from confusing an empty job with a loading or system failure.

**Independent test**: Open the submitted-candidates view for an authorized job with zero applications and verify that the empty state is distinct from loading and error states.

**Acceptance scenarios**:

1. **Given** the selected job has zero submissions, **when** loading completes, **then** the interface states that no candidates have applied yet and shows no candidate rows.
2. **Given** submission retrieval fails, **when** the view cannot determine whether submissions exist, **then** an error state with a retry action is shown instead of the zero-submission message.

## 2. Scope

### In scope

- A centralized, job-scoped list of submitted candidate applications for Recruiters authorized to manage the selected job posting.
- Display of the candidate and submission information needed to identify and review each application.
- Authorized access to the original CV submitted with each application, including inline preview when supported and explicit download.
- Authorized access to an optional cover letter supplied as text or a file, including preview when supported and download for file-based letters.
- Loading, empty, populated, partial document-error, and list-retrieval error states.
- Pagination or equivalent incremental loading suitable for very large applicant volumes.
- Deterministic ordering before scoring exists.
- A neutral pre-scoring state: newly submitted or otherwise unscored candidates remain present and fully accessible; Group 1 does not calculate, infer, display, or require a score.
- Integration of the existing candidate job-application action with the authoritative Application record so new accepted submissions can populate this list without introducing a separate application experience.
- Initializing each accepted Application in the canonical `Applied` state, recording its creation audit outcome, and preserving the existing pipeline owner for every later state transition.
- Purpose-limited retention, immediate logical access denial at the applicable deadline or valid deletion event, bounded physical deletion, legal-hold handling, and operationally visible cleanup failures for original application documents.

### Out of scope

- Rule-based skill and experience matching, keyword comparison, and automatic match scores; these belong to Group 2.
- LLM-based CV analysis, per-criterion AI scores, rationales, prompt design, provider/model selection, and AI failure handling; these belong to Group 3.
- The `60% Automatic Matching + 40% AI Scoring` calculation, combined score, score ranking, score threshold filtering, and green/yellow/red score indicators; these belong to Group 4.
- Candidate shortlisting, rejection, hiring decisions, pipeline movement after initial `Applied`, notes, interviews, or other application-status changes.
- Formal Application schema, storage design, API contracts, migration strategy, and document-delivery mechanism; these are deferred to later Spec-Kit steps for Group 1.
- Groups 2–4 behavior beyond preserving a high-level extension point in the list for later scoring and ranking presentation.

## 3. Data Considerations

The original cross-module requirements identified only `appliedJobIds[]`, but the current product already has an authoritative `JobApplication` submission record. Group 1 must extend that existing authority with immutable submission evidence and recruiter-safe projections. It must not create a parallel Application aggregate, stage model, or candidate submission path. The legacy `appliedJobIds[]` values remain non-authoritative hints and cannot establish a submission.

At minimum, the existing submitted-candidate record must identify the submission and ownership context through an application identity, job identity, and candidate identity; retain an access-controlled reference to the original CV; represent an optional immutable text or file cover letter; and record one authoritative submission timestamp. Later groups require versioned evaluation provenance for automatic, AI, and combined scoring, but Group 1 neither creates, returns, displays, nor interprets score outputs or placeholders.

Every accepted Application starts in the canonical `Applied` state. Group 1 records that initial state only; later transitions among `Viewed`, `Shortlisted`, `Interviewing`, `Offered`, `Hired`, `Offer Declined`, `Rejected`, and `Waitlisted` remain outside this group's behavior and must be owned by the later recruitment-pipeline workflow.

A valid CV is mandatory for every accepted submission. The application workflow must not create an Application when the candidate has not supplied a CV that passes the approved upload validation. A cover letter remains optional.

The CV and cover letter attached to an accepted Application are immutable submission-time snapshots. Later changes to the Candidate Profile, the candidate's reusable CV library, or another application must not replace or mutate those snapshots.

The existing candidate job-application action must create the authoritative Application and immutable document bindings as one accepted submission outcome. A separate or hidden write path that leaves only `appliedJobIds[]` is not sufficient after cutover.

For the Group 1 interface to function, its read view needs only:

- Candidate identity: display name and a stable application identity; an avatar may be shown only through the existing authenticated, recruiter-permitted avatar projection, otherwise a labelled fallback is used.
- Candidate contact information: the candidate's verified email and, only when explicitly shared for this application, phone number. Unrelated profile contact fields are excluded.
- Job and company scope: enough association to prove that the application belongs to the selected job and the Recruiter's authorized company context.
- Original CV reference: an access-controlled reference plus safe display metadata such as filename, type, and availability.
- Optional cover-letter reference: submitted text or an access-controlled file reference plus safe display metadata.
- Submission timestamp: the authoritative time the application was accepted.

CVs, cover letters, and candidate contact information are sensitive recruitment data. They must be disclosed only to authenticated Recruiters with current authority over the selected job and company. A client-provided job, candidate, or application identifier must never grant access by itself. Document references must not become durable public links, and ordinary logs, analytics, empty states, and error messages must not expose document contents or unnecessary personal data.

Original CV and cover-letter content remains accessible for its recruitment purpose until 12 months after the later of (a) the job closing or (b) the Application entering a terminal state. At that exact deadline, or immediately upon an earlier valid candidate/account deletion or erasure event, ordinary access is denied regardless of cleanup timing. Physical document content and document-derived private metadata are deleted within 30 days. A documented legal hold may postpone physical deletion only for the minimum required scope and duration; held content is unavailable through the ordinary recruiter list and document actions. Cleanup failures are retried and surfaced to authorized operators without exposing document content.

Application creation produces a content-minimized audit outcome identifying the authenticated actor, action, Application/job target, result, and timestamp without CV, cover-letter, contact, filename, storage-location, or scoring content. Audit metadata is retained for 365 days unless a stricter governing policy applies.

The legacy `appliedJobIds[]` list lacks trustworthy submission timestamps and immutable application documents and must never be converted into fabricated records. A pre-cutover `JobApplication` may enter the Group 1 list only when migration proves its original document bytes, binding, version, timestamp, and application identity without substituting current profile data. A pre-cutover row whose original evidence cannot be proven is marked legacy-unavailable and excluded from the complete-document list. Migration readiness must prove that no authoritative candidate-job duplicates or inconsistent stage records exist; detection blocks release for explicit operational resolution rather than silently merging rows.

The scalar score fields named for cross-group compatibility are not a complete evaluation history. Later scoring groups must define versioned evaluation records or equivalent provenance that preserves the applicable weights, thresholds, model/provider, prompt version, and policy versions; Group 1 neither creates nor exposes those results.

This section identifies required information and boundaries only; it does not formalize entities, relations, field types, indexes, retention, or storage.

## 4. UI States

### List structure

The submitted-candidates view is anchored to one clearly identified job posting. It must remain usable for a job containing up to 10,000 applications through bounded pagination or equivalent incremental loading. Each row or card shows:

- Candidate display name and available identity cue such as avatar.
- Verified candidate email and an application-shared phone number when present.
- Submission date and time.
- A clearly labelled `View CV` action and a separate `Download CV` action.
- Cover-letter status and actions: `View cover letter` plus `Download cover letter` when a file exists, a readable view action when text exists, or the non-actionable label `Not provided` when absent.
- A stable way to open the application context without requiring a score.

### Required states

- **Loading**: Shows that applications are being retrieved without prematurely claiming that no submissions exist.
- **Populated**: Shows one entry per application returned for the selected job.
- **Unscored**: Behaves the same as a normal populated entry for all Group 1 actions. It is not pushed down, hidden, disabled, or assigned an implied zero score.
- **Empty**: States that no candidates have applied to this job yet and does not show score, filter, or document controls.
- **List error**: Explains that submissions could not be loaded and offers retry without showing a false empty state.
- **Document unavailable**: Keeps the application visible, marks only the affected document as unavailable, explains the failure safely, and permits retry where appropriate.

Before Group 4 exists, the default order is `submittedAt` descending, newest submission first. Equal timestamps use a stable application-based tie-break so entries do not jump or repeat between pages. Group 1 provides no score-based sort, score filter, threshold filter, or color-coded ranking.

## 5. Interaction Behavior

- Selecting `View CV` opens a safe inline preview when the original file type can be rendered safely. A modal, drawer, or separate viewer may be chosen during visual design, but the Recruiter must be able to return to the same list position and page.
- Selecting `Download CV` explicitly downloads the authorized original submission; merely viewing a document does not trigger an automatic download.
- A text cover letter opens in a readable, non-editable view. A file-based cover letter follows the same preview-first and explicit-download behavior as the CV. Unsupported but valid preview formats fall back to download.
- Document loading has its own progress and error feedback. Failure to open one document does not remove the application, fail the complete candidate list, or expose storage details.
- Every document action revalidates current Recruiter, job, company, and application access at the time of access. Losing authority while the list is open prevents subsequent document retrieval.
- Mouse, touch, and keyboard users can reach and distinguish each document action. Controls have descriptive labels containing the document purpose and candidate context, and status is not communicated by color alone.
- Pagination or incremental loading preserves the current job context and deterministic order. Returning from a document preview preserves the current list position when the underlying submission set has not invalidated it.
- Group 1 keeps each entry structurally extensible so Group 4 can later add score status, ranking, threshold filters, and non-color score labels. Until that group is specified and implemented, those controls and indicators are absent and do not affect visibility or order.

## 6. Edge Cases

- **No cover letter**: Show `Not provided`; do not render disabled or broken document actions and do not treat the submission as invalid.
- **Corrupted or unreadable CV**: Keep the candidate entry visible, mark the CV as unavailable or unreadable, provide a safe retry where meaningful, and avoid displaying raw parser, storage, or security errors. Group 1 does not attempt to repair, parse, or score it.
- **Preview unsupported but download allowed**: Explain that preview is unavailable and retain an explicit authorized download action.
- **Document no longer available**: Keep the application record visible and show a document-specific unavailable state; do not silently substitute a profile CV or another application's file.
- **Very large applicant volume**: Support 10,000 applications for one job through pagination or equivalent bounded incremental rendering so the Recruiter does not need to load or render the entire result set at once. Ordering remains stable across page boundaries, and a candidate is neither duplicated nor skipped during an unchanged result set.
- **Duplicate submission by the same candidate to the same job**: Exactly one Application is permitted for a candidate-job pair. A repeated or concurrent submission attempt is idempotent and resolves to the existing Application without replacing its submission timestamp or immutable documents. Migration preflight blocks release if pre-existing authoritative Application duplicates are detected; they are never silently merged or exposed as a valid production result.
- **Same candidate applies to different jobs**: Each submission remains independent and appears only under its associated job.
- **Candidate details change after submission**: The application remains anchored to its stable submission identity and immutable submitted-document snapshots. The current verified email may be shown, and the phone number is shown only if it was explicitly shared for that application; profile changes must not change which application or documents are being reviewed.
- **Submission arrives while browsing**: Refresh or later pagination may reveal it in the correct default order; its arrival must not cause duplicate rows.
- **Authorization changes during a session**: Further list or document access is denied safely, and previously issued document access must not remain usable beyond its approved short access window.
- **Unsafe file or filename**: The file is not previewed or downloaded when access is not approved; filenames are rendered as text and cannot execute content or alter the interface.
- **Retention deadline or valid erasure event occurs while the list is open**: The next document request is denied immediately, the row no longer offers ordinary document access after refresh, and delayed cleanup never extends Recruiter access.
- **Legal hold**: Held content is excluded from ordinary Recruiter access after its normal deadline, is limited to the documented legal purpose, and is physically deleted within 30 days after the hold ends unless another valid hold applies.
- **Cleanup or orphan reconciliation fails**: The failure is retried and made visible to authorized operators without exposing candidate content; an object created for a failed submission is denied immediately and deleted within 24 hours.
- **Pre-cutover `appliedJobIds[]` entry**: It is not presented as a complete submitted-candidate record because no trustworthy original documents or timestamp exist; no current profile CV is substituted.

## 7. Acceptance Criteria

- [ ] An authenticated Recruiter with current authority over a job can open one centralized list containing all and only eligible authoritative `JobApplication` submissions accepted after cutover or migrated with proven original evidence.
- [ ] A Recruiter cannot obtain application rows, candidate contact data, CVs, or cover letters for a job or company outside their current authority, including by changing a client-supplied identifier.
- [ ] Each populated entry shows candidate identity, approved contact information, authoritative submission date/time, CV actions, and the correct optional cover-letter state.
- [ ] A submission without a CV that passes the approved upload validation is not accepted and does not appear as an Application; a cover letter remains optional.
- [ ] Every accepted Application is created in the canonical `Applied` state, and Group 1 performs no later pipeline-state transition.
- [ ] The existing candidate job-application action creates the authoritative Application and immutable document bindings; it does not continue writing only `appliedJobIds[]` after cutover.
- [ ] The CV and cover letter associated with an accepted Application remain the exact submission-time snapshots after Candidate Profile, CV-library, or other-application documents change.
- [ ] The list exposes the candidate's verified email and only a phone number explicitly shared for that application; it exposes no unrelated profile contact fields or cross-company contact data.
- [ ] The default pre-scoring order is newest submission first, with a stable tie-break that prevents row movement, duplication, or omission across an unchanged paginated result set.
- [ ] A newly submitted candidate with no automatic, AI, or combined score remains visible and has all Group 1 document actions available subject only to authorization and document availability.
- [ ] Group 1 shows no inferred zero score, score rank, threshold filter, or green/yellow/red score indicator.
- [ ] For a valid previewable CV, `View CV` presents the original submitted document and allows the Recruiter to return to the same list context.
- [ ] For an accessible CV, `Download CV` downloads the original submitted file with a meaningful safe filename.
- [ ] When CV preview is unsupported but download is permitted, the interface explains the limitation and offers download.
- [ ] A text cover letter can be opened in a readable, non-editable view.
- [ ] A file-based cover letter can be previewed when supported and downloaded explicitly.
- [ ] An application without a cover letter shows `Not provided` and no cover-letter open or download action.
- [ ] A corrupted, unreadable, unsafe, missing, or inaccessible document produces a document-specific safe error while the application and rest of the list remain usable.
- [ ] A job with zero submissions shows a clear `no candidates have applied yet` empty state only after retrieval completes successfully.
- [ ] A list retrieval failure shows an error and retry action and is never represented as a zero-submission state.
- [ ] Document access is reauthorized when requested; revoked Recruiter, job, or company authority prevents subsequent access.
- [ ] Document links are not durable public references, and document contents or unnecessary candidate personal data do not appear in ordinary logs, analytics, or error messages.
- [ ] Repeated and concurrent submission attempts cannot create more than one Application for the same candidate-job pair and cannot replace the existing Application's timestamp or immutable documents; pre-existing inconsistent duplicates are not silently merged.
- [ ] Migration readiness blocks release when pre-existing authoritative Application duplicates are detected and produces a content-free operational report for explicit resolution.
- [ ] With 10,000 applications for one job, applications are delivered through bounded pagination or equivalent incremental loading, and both the initial page and each subsequent page become usable at P95 within 2 seconds under documented representative conditions.
- [ ] All list and document controls are keyboard reachable, descriptively labelled, and understandable without relying on color.
- [ ] Group 1 introduces no matching, AI analysis, score calculation, ranking, score filtering, score colors, recruitment decision, or pipeline-state transition beyond initializing an accepted Application as `Applied`.
- [ ] At 12 months after the later of job closure or terminal Application state, ordinary document access is denied immediately and all original document content/private metadata is physically deleted within 30 days unless a documented legal hold applies.
- [ ] A valid earlier candidate/account deletion or erasure event denies ordinary document access immediately and completes physical deletion within 30 days unless a documented legal hold applies.
- [ ] An orphan application-document object from a failed submission is inaccessible immediately, physically deleted within 24 hours, and produces content-free operator-visible failure status if cleanup does not succeed.
- [ ] Every successful or failed Application creation attempt records a content-minimized audit outcome with actor, action, available target context, result, and timestamp, retains that metadata for exactly the governing 365-day baseline, and contains no candidate document, contact, filename, storage, or score content.
- [ ] Pre-cutover `appliedJobIds[]` values are not converted into fabricated Applications and no current Candidate Profile CV is substituted for missing original submission evidence.
- [ ] If no permitted avatar projection exists, the list uses a labelled fallback and discloses no private avatar storage reference.
