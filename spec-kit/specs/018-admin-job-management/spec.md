# Feature Specification: Administrator Job Post Management

**Feature Branch**: `018-admin-job-management`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Build post-publication job management for administrators, including visibility and application lifecycle controls, featured placement, report triage links, enforcement audit, and revision requests that preserve a live approved version."

## Clarifications

### Session 2026-08-16

- Q: Is a job's operational status one combined lifecycle? -> A: No. Candidate visibility and application intake are independent state dimensions.
- Q: What happens to a live job when changes are requested? -> A: Its approved live version remains candidate-visible unless the moderator explicitly hides it; recruiter edits create a separate pending revision for review.
- Q: How do archive and deletion differ? -> A: Archive is reversible normal lifecycle completion; soft deletion is elevated enforcement that preserves evidence and cannot use ordinary restore.
- Q: Can one report map to only one enforcement? -> A: No. Reports and enforcement actions use many-to-many links.
- Q: How are featured conflicts handled? -> A: Bounded placement capacity is checked atomically for overlapping feature intervals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and Inspect a Published Job (Priority: P1)

An authorized Platform Administrator finds a job post after publication and sees the current public version, the responsible recruiter and company, approval facts, publication and deadline dates, lifecycle state, active feature placement, report summary, and complete auditable history without exposing unrelated private information.

**Why this priority**: Administrators cannot safely operate published jobs until they can identify the authoritative live version and the facts that govern it.

**Independent Test**: An administrator can search by job title, company, or recruiter, filter by lifecycle and report conditions, open one result, and verify that its live version, review facts, operational state, report summary, and audit timeline match persisted records.

**Acceptance Scenarios**:

1. **Given** a mix of approved and published jobs, **When** an administrator searches for a title, company, or recruiter and applies lifecycle, date, approval, report, or featured filters, **Then** the list returns only matching jobs with clear state labels and safe operational summary data.
2. **Given** an administrator opens a managed job, **When** it has a live approved version and a pending revision, **Then** the detail view identifies both versions, identifies which version candidates can see, and keeps their content and approval facts distinct.
3. **Given** a job has moderation reports, **When** an administrator opens its detail, **Then** the view shows the report count, distinct reporter count, highest active priority, and links only to reports the administrator is authorized to inspect.

---

### User Story 2 - Control Job Availability Safely (Priority: P1)

An authorized Platform Moderator changes whether a published job is visible to candidates and whether it accepts applications, while preserving the job, public history, version history, and a traceable explanation.

**Why this priority**: A post-publication issue must be contained without destroying recruitment records or conflating visibility with application intake.

**Independent Test**: An authorized moderator can hide and restore a job, and close and reopen applications, with each independent state reflected in candidate-facing availability and the administrative audit timeline.

**Acceptance Scenarios**:

1. **Given** a published, open job, **When** a moderator hides it with a required reason, **Then** candidates cannot discover or open it, its application state remains open in administration, and the action is recorded with actor, reason, time, and prior state.
2. **Given** a visible, open job, **When** a moderator closes applications, **Then** the job remains visible as closed, new applications are rejected, and the visibility state remains published.
3. **Given** a hidden or closed job, **When** a moderator restores visibility or reopens applications as permitted, **Then** only that selected state dimension changes and the previous approved live version remains authoritative.
4. **Given** an expired job, **When** the scheduled lifecycle process archives it, **Then** it is no longer candidate-visible, retains its history, and can be restored only by an authorized action that records its reason.

---

### User Story 3 - Request a Corrected Public Job (Priority: P1)

An authorized Platform Moderator requests corrections to a live job without replacing or corrupting its currently approved public content; the recruiter submits a separate revision that follows the existing review workflow.

**Why this priority**: Moderation corrections need a safe path that retains the live version and prevents unreviewed edits from reaching candidates.

**Independent Test**: A moderator requests changes on a live job, the recruiter creates and submits a revision, and the original live version remains candidate-visible until the revision is approved or the moderator explicitly hides it.

**Acceptance Scenarios**:

1. **Given** a published job, **When** a moderator requests changes without immediate hiding, **Then** the current approved version remains live, the request reason is visible to the authorized recruiter, and a pending revision is required for edits.
2. **Given** a published job with a correction request, **When** the moderator selects immediate hiding, **Then** candidates cannot access the live job until an authorized visibility restoration, while the live version and correction history remain available to administrators.
3. **Given** a submitted pending revision, **When** it is approved through Job Post Reviews, **Then** it becomes the new live version atomically and the prior live version remains in immutable history.
4. **Given** a pending revision is rejected or abandoned, **When** the job detail is viewed, **Then** the previously approved live version remains identifiable and is not replaced by the rejected or abandoned content.

---

### User Story 4 - Feature and Govern Promoted Jobs (Priority: P2)

An authorized content-management administrator promotes an eligible published job for a bounded placement and period, subject to placement capacity, then removes or schedules the promotion with complete audit evidence.

**Why this priority**: Featured placement is a controlled business operation and must not silently alter ordinary job ranking or displace existing promotions.

**Independent Test**: An authorized administrator features one eligible job in a placement with dates and priority, sees it listed as active during the window, and receives a clear rejection when capacity would be exceeded.

**Acceptance Scenarios**:

1. **Given** an eligible published job and a placement below capacity, **When** a content-management administrator schedules a feature interval with a reason and priority, **Then** the feature becomes active only during that interval and is shown in job detail and audit history.
2. **Given** a placement already at active capacity, **When** an administrator attempts to schedule an overlapping feature, **Then** the system refuses the request without changing existing placements and explains the conflict.
3. **Given** an active feature, **When** an authorized administrator removes it, **Then** the job remains otherwise published or hidden according to its independent lifecycle state, and the removal is audited.

---

### User Story 5 - Resolve Reports Through Explicit Enforcement (Priority: P2)

An authorized Platform Moderator investigates reports against a job and records one or more enforcement actions, with reports and actions linked in both directions so duplicate reports and multi-target enforcement remain understandable.

**Why this priority**: Report resolution is meaningful only when the resulting operational action can be traced without exposing reporters or creating duplicate punitive actions.

**Independent Test**: A moderator resolves multiple reports by creating or linking a job enforcement action, then sees each report link to the action and the job detail link back to its contributing reports.

**Acceptance Scenarios**:

1. **Given** multiple active reports against one job, **When** a moderator performs a hide, closure, correction request, or soft-delete enforcement and selects the reports it addresses, **Then** each selected report and the enforcement action are linked bidirectionally with actor, reason, time, and outcome.
2. **Given** one report indicates misconduct across a job and company, **When** a senior moderator performs separate authorized enforcement actions, **Then** the report can link to each action without overwriting its prior evidence.
3. **Given** a moderator dismisses a report, **When** no enforcement is warranted, **Then** no job state changes and the dismissal rationale and outcome notification remain auditable.

---

### Edge Cases

- A stale, duplicate, or retried action MUST not create a second lifecycle transition, feature interval, enforcement action, or notification.
- A job may be hidden and closed at the same time; restoring one dimension MUST NOT automatically change the other.
- A closed job may remain published for historical reference, while an archived job is never candidate-visible.
- A soft-deleted job MUST remain preserved for authorized audit and recovery but cannot be returned to candidate visibility through an ordinary restore operation.
- An ineligible company, revoked recruiter authority, expired deadline, or unavailable live version blocks feature activation and application reopening.
- A job with a pending revision MUST preserve exactly one identifiable live approved version until the new revision is approved; a job with no approved version cannot be made candidate-visible.
- Capacity checks for overlapping featured intervals MUST be atomic so concurrent administrators cannot exceed a placement limit.
- Report counts shown to administrators MUST deduplicate repeated reports from the same reporter against the same target according to the report policy and MUST NOT reveal reporter identity on the job list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an authorized administrator list and detail experience for review-managed job posts after publication, including safe job, recruiter, company, approval, lifecycle, feature, report-summary, and audit data.
- **FR-002**: The list MUST support case-insensitive search by job title, company, and recruiter and bounded filters for visibility, application state, dates, approval, report condition, assignee/approver, and featured state.
- **FR-003**: The system MUST model candidate visibility independently from application intake: visibility is `PUBLISHED`, `HIDDEN`, or `ARCHIVED`; application intake is `OPEN` or `CLOSED`.
- **FR-004**: The system MUST define and server-validate every allowed lifecycle transition, including actor authority, expected version, reason requirements, candidate effect, and recovery rule.
- **FR-005**: The system MUST permit an authorized moderator to hide or restore a job and close or reopen applications without implicitly changing the other state dimension.
- **FR-006**: The system MUST archive expired jobs through an auditable scheduled lifecycle process; an archive represents normal lifecycle completion and remains recoverable by an authorized administrator.
- **FR-007**: The system MUST distinguish administrative soft deletion from archive: soft deletion is an enforcement action, requires an explicit reason and elevated authority, preserves records for audit, and cannot be restored through ordinary restore controls.
- **FR-008**: The system MUST allow an authorized moderator to request changes against a published job, recording an explanation and whether the current live version must be hidden immediately.
- **FR-009**: A correction request MUST preserve the currently approved live version as the only candidate-visible content unless an authorized visibility action hides it.
- **FR-010**: Recruiter changes requested for a published job MUST become a distinct pending revision and MUST use the existing Job Post Review workflow; only approval of that revision can replace the live version.
- **FR-011**: The system MUST show the current live version, any pending revision, prior approved versions, their approval facts, and their candidate-visibility relationship distinctly in administrative detail.
- **FR-012**: The system MUST allow only authorized content-management administrators to create, amend, or remove featured placements for an eligible published job.
- **FR-013**: Every featured placement MUST have a placement identifier, start and end time, priority, reason, creator, lifecycle state, and an enforced maximum active capacity per placement; overlapping capacity conflicts MUST fail atomically.
- **FR-014**: The system MUST not use featured placement to override authorization, visibility, deadline, company-verification, or review-approval gates for ordinary job discovery.
- **FR-015**: The system MUST expose an administrator-safe moderation summary for each job, including active report count, distinct reporter count, highest active priority, and links to authorized report records.
- **FR-016**: The system MUST model enforcement actions separately from moderation reports and MUST support many-to-many links between reports and enforcement actions.
- **FR-017**: An enforcement action MUST record the human actor, action type, affected target or targets, reason, prior and resulting state, timestamp, result, and correlation identity; it MUST be linked to selected reports without relying on a single report field.
- **FR-018**: The system MUST allow report resolution or dismissal only through authorized human actions and MUST preserve existing immutable report history, private investigation notes, and reporter outcome notifications.
- **FR-019**: The system MUST enforce role separation: moderators may perform assigned operational actions; content-management authority is required for featured placement; elevated moderation authority is required for soft delete and company/recruiter enforcement.
- **FR-020**: All critical post-management, feature, report-linking, and enforcement writes MUST be transactional, version-checked, idempotent, auditable, and provide visible stale/conflict recovery to the administrator.
- **FR-021**: The system MUST provide keyboard-operable, readable administrator controls with clear confirmation, loading, success, validation, and error states; color alone MUST NOT communicate lifecycle or enforcement state.
- **FR-022**: The system MUST exclude reporter identities, private moderation notes, private recruiter contacts, applicant data, and unrelated company evidence from job list rows and ordinary operational notifications.
- **FR-023**: The feature MUST provide a verification path for the state transition matrix, feature-capacity conflicts, live/pending version integrity, authorization boundaries, report-to-enforcement links, audit records, and candidate-facing visibility/application behavior.

### Key Entities

- **Job Post Operational State**: The independently maintained visibility and application-intake state of an approved job, with transition history and lifecycle reasons.
- **Job Post Revision Request**: A moderator-initiated correction request associated with a live version, explanation, immediate-hide choice, and its resulting pending revision when submitted.
- **Featured Placement**: A time-bounded, capacity-governed promotion of an eligible job in one named placement, with priority and audit history.
- **Enforcement Action**: A human-authorized operational or disciplinary action against one or more jobs, companies, or recruiter authorities, with immutable evidence of the outcome.
- **Moderation Report Enforcement Link**: A link associating any number of reports with any number of enforcement actions.
- **Job Operational Timeline Entry**: An auditable record of a lifecycle transition, revision request, feature change, or enforcement outcome that can be safely presented to an authorized administrator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized administrator can locate a known post by title, company, or recruiter and reach its complete operational detail in no more than two list interactions.
- **SC-002**: In a representative dataset of at least 10,000 managed jobs, 95% of authorized list filtering, detail loading, and non-enforcement lifecycle commands complete within 2 seconds, excluding deliberate confirmation time.
- **SC-003**: 100% of tested hide, restore, close, reopen, archive, feature, correction-request, and soft-delete commands preserve the required independent state dimensions and a complete audit entry.
- **SC-004**: 100% of tested public revision workflows retain the prior live approved version until approval of the pending revision or an explicit hide command.
- **SC-005**: 100% of tested concurrent feature requests obey configured placement capacity and create no duplicate active intervals.
- **SC-006**: 100% of tested enforcement cases can show all linked reports and all linked enforcement actions without overwriting immutable report history.
- **SC-007**: In keyboard-only verification, administrators can complete the core inspect, hide/restore, close/reopen, correction-request, and feature/unfeature flows with visible status feedback and no color-only state indicators.

## Assumptions

- The existing Job Post Review authority remains the sole approval path for new versions; this feature does not replace or bypass it.
- Only review-managed jobs with an approved live version enter post-publication management in the initial release; unmanaged legacy catalogue jobs remain outside scope.
- The existing administrator grant system can represent moderator, content-management, and elevated moderation authority or will be extended conservatively without granting default access.
- The initial feature placements are a small configured set with per-placement capacity, rather than arbitrary manual search-ranking overrides.
- Scheduled archiving runs on the application’s established reliable background-processing mechanism and is safe to retry.
- The initial release provides audit-ready administrator operations rather than public SEO preservation, billing, promotion payment, or automated punitive decisions.
