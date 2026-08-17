# Feature Specification: Recruitment Analytics & Data Export

**Feature Branch**: `023-recruitment-analytics-export`

**Created**: 2026-08-17

**Status**: Ready for planning

**Input**: User description: "Build a Recruitment Analytics & Data Export feature module for admins and employers with statistical dashboards, job-posting performance, candidate exports, and activity tracking."

## Clarifications

### Session 2026-08-17

- Q: What constitutes a qualifying job-posting view? → A: Count at most one view per visitor, posting, and platform-calendar day; exclude employer previews and identified automated traffic.
- Q: Which candidate contact fields are included in exports? → A: Candidate name, email address, and phone number only.
- Q: How long may a generated candidate export remain downloadable? → A: 24 hours, with authorization rechecked on every download and immediate revocation when access changes.
- Q: How does the selected date range determine the application-success population? → A: Use applications submitted during the selected period as the cohort and evaluate each cohort application's status at the report data cutoff.
- Q: How is the active-job-posting trend measured within each time bucket? → A: Count postings active at the end of each daily, weekly, or monthly bucket.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitor Platform Growth (Priority: P1)

As a Platform Administrator, I want a visual system-statistics dashboard for a selected period so that I can identify platform growth and operational trends.

**Why this priority**: Platform-wide reporting is a core decision-making capability and gives administrators a shared, measurable view of registrations, jobs, and applications.

**Independent Test**: Seed registrations, job postings, candidates, and applications across known dates; sign in as an Administrator; change date presets and a custom range; verify every chart and summary against the seeded records.

**Acceptance Scenarios**:

1. **Given** an authenticated Administrator and reportable records across multiple dates, **When** the Administrator opens the dashboard with a daily, weekly, monthly, or valid custom date range, **Then** the system shows time-series values for new user registrations, currently active job postings, application success rate, and applications per candidate using the same selected period and clearly labeled units; active postings are measured at each bucket end, and application success uses the applications submitted in the period as its cohort and their status at the stated data cutoff.
2. **Given** an Administrator viewing a report, **When** the Administrator changes the date range or grouping, **Then** all dashboard metrics refresh consistently, the selected range remains visible, and no records outside the range contribute to period-based metrics.
3. **Given** a selected period with no qualifying records, **When** the dashboard loads, **Then** it shows zero values and an informative empty state rather than missing, fabricated, or stale data.
4. **Given** a non-Administrator, **When** that user attempts to access the system-statistics dashboard or its data, **Then** access is denied without revealing platform-wide statistics.
5. **Given** records exactly on a date boundary, **When** the Administrator requests a range, **Then** inclusion follows the displayed platform time zone and the start/end boundary convention is stated to the user.
6. **Given** the requested range begins before reliable active-posting lifecycle history is available, **When** the Administrator applies it, **Then** the system rejects the range with the earliest supported analytics date and does not display incomplete historical values as accurate.

---

### User Story 2 - Evaluate Job Posting Performance (Priority: P1)

As an authorized Employer member, I want per-posting traffic, conversion, and recruitment-funnel metrics so that I can evaluate posting attractiveness and candidate drop-off.

**Why this priority**: Employers need evidence to improve postings and recruitment processes, and tenant-isolated reporting is a core module outcome.

**Independent Test**: Create a posting with known view events and applications in each canonical recruitment stage; verify totals, conversion, funnel counts, percentages, date filtering, ownership checks, and empty/zero-view behavior.

**Acceptance Scenarios**:

1. **Given** an authorized Employer member viewing a posting belonging to an approved company membership, **When** the performance report opens, **Then** the system displays that posting's view count, submitted-application count, and view-to-application conversion rate for the selected period.
2. **Given** a posting with 200 qualifying views and 20 submitted applications, **When** the report is calculated, **Then** the conversion rate is displayed as 10% and the underlying counts remain visible.
3. **Given** a posting with zero qualifying views, **When** the report is calculated, **Then** the conversion rate is shown as not applicable rather than as an invalid number, while application count remains accurate.
4. **Given** applications distributed across canonical states, **When** the Employer views the hiring funnel, **Then** the Kanban-style board shows a count and percentage for Applied, Viewed, Shortlisted, Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted, with percentages based on all applications in the selected report population.
5. **Given** candidates have moved between stages during the selected period, **When** the current funnel is viewed, **Then** each application appears in exactly one current canonical stage and the board does not imply that historical transitions are current candidates.
6. **Given** an Employer member who lacks membership in the posting's company, **When** that user attempts to view its report, **Then** access is denied and no counts, candidate information, or posting performance data are disclosed.
7. **Given** a valid date range, **When** it is applied to the report, **Then** period-based view and application counts use only qualifying events in that range, while any current-state funnel is explicitly labeled as a current snapshot and timestamped.

---

### User Story 3 - Export a Posting's Candidate List (Priority: P1)

As an authorized Employer member, I want to export the candidates for one company job posting as CSV or Excel so that I can archive and analyze the recruitment data offline.

**Why this priority**: Portable, structured reporting is a must-have business outcome and involves sensitive candidate data requiring precise access and consistency rules.

**Independent Test**: Export a posting with known candidates and screening outcomes in both formats; compare every row and header with the on-screen authorized dataset; test tenant isolation, empty results, special characters, unavailable scores, and the 10,000-row performance boundary.

**Acceptance Scenarios**:

1. **Given** an authorized Employer member and a posting belonging to that member's approved company, **When** the member requests CSV or Excel export, **Then** the downloaded file contains one row per included application and headers for the candidate name, email address, and phone number captured for that application at submission, plus application status and CV screening score.
2. **Given** a candidate has no completed screening score, **When** the export is generated, **Then** the score cell is blank or explicitly marked unavailable according to the documented export legend and no score is fabricated.
3. **Given** names or contact values contain Vietnamese diacritics, commas, quotes, line breaks, or spreadsheet-like formula prefixes, **When** either format is opened in a compatible spreadsheet tool, **Then** values remain intact, occupy the intended cells, and are not executed as formulas.
4. **Given** an export request and a stable report population, **When** generation completes, **Then** file row count, values, status labels, score values, selected filters, and generation timestamp match the authoritative data snapshot used for that export.
5. **Given** no applications match the posting and filters, **When** export is requested, **Then** the file still contains the documented headers and zero data rows.
6. **Given** a user without authorized company membership, **When** the user requests an export for another company's posting, **Then** the request is denied, no file is produced, and the attempt is auditable.
7. **Given** a permitted export completes or fails, **When** the outcome is recorded, **Then** the audit record identifies actor, company scope, posting, format, result, record count when known, and timestamp without copying exported candidate details into the activity log.
8. **Given** a generated export is less than 24 hours old and the requester remains authorized, **When** the requester downloads it, **Then** the complete file is provided; **Given** the file is 24 hours old or access has been revoked, **When** download is attempted, **Then** no file is disclosed and the user receives a safe unavailable message.

---

### User Story 4 - Review Activity and Operational Trends (Priority: P2)

As a Platform Administrator, I want filterable activity history and aggregate creation/application trends so that I can investigate platform operations and usage patterns.

**Why this priority**: Activity visibility supports operations and auditability, but the user-facing history may be reduced or deferred after P1 capabilities; mandatory underlying audit events remain required by project governance.

**Independent Test**: Seed login, logout, posting-created, posting-deleted, and application-submitted events for different roles and dates; verify event details, filters, aggregates, trend groupings, authorization, and retained-data boundaries.

**Acceptance Scenarios**:

1. **Given** an authenticated Administrator, **When** the activity history is opened, **Then** login/logout entries show timestamp, user identity, role, action, and result, and posting-deletion entries show actor, posting identity, company context, and timestamp.
2. **Given** activity across multiple dates, roles, and actions, **When** the Administrator filters by date range, user role, and one or more supported action types, **Then** only matching records appear and active filters remain visible.
3. **Given** posting-created and application-submitted events in a period, **When** aggregate activity statistics are viewed, **Then** totals and time trends for both event types match the filtered event population.
4. **Given** an activity event references a deleted or anonymized account or posting, **When** history is viewed, **Then** the event remains understandable through a non-sensitive historical identifier or label without restoring deleted personal content.
5. **Given** a non-Administrator, **When** the user attempts to access activity history or platform aggregates, **Then** access is denied without revealing event existence or aggregate values.
6. **Given** P2 user-interface scope is deferred, **When** P1 features are released, **Then** authentication events, posting deletion, posting creation, application submission, pipeline changes, and exports required for auditability continue to be captured for authorized later review.

### Edge Cases

- Repeated page loads from the same visitor for the same posting on one platform-calendar day count as one qualifying view; employer previews and identified automated traffic do not qualify. The rule must be applied consistently across dashboard and report contexts.
- Applications deleted, withdrawn, or anonymized after submission must follow one documented inclusion rule for historical period totals; current-state funnels must never double-count them.
- A posting changing from active to closed during a selected period must be counted according to whether the metric is explicitly a current snapshot or a historical trend at each time bucket.
- Invalid ranges (end before start), unsupported ranges, and ranges exceeding allowed report limits must be rejected with actionable feedback and must not show stale results.
- A range beginning before the published analytics-availability baseline must be rejected with the earliest supported date; the system must not infer historical active-posting states that cannot be reconstructed authoritatively.
- Concurrent application-stage changes during export must not create duplicate or internally contradictory rows; the file must identify the snapshot generation time.
- Rounding must not make funnel percentages misleading; displayed values must use a consistent precision and may include a disclosed rounding difference from exactly 100%.
- Failed, timed-out, or cancelled exports must not produce a partial file presented as complete and must be safe to retry without duplicate audit outcomes being mistaken for distinct successful exports.
- Suspended accounts and revoked company memberships must lose access immediately, including access to previously initiated but not yet delivered exports.

## Requirements *(mandatory)*

### Functional Requirements

#### Roles, Scope, and Permissions

- **FR-001**: The system MUST permit only authenticated Platform Administrators to view, filter, and, where offered, export platform-wide statistics and activity information.
- **FR-002**: The system MUST permit an Employer member to view reports and request candidate exports only for job postings belonging to a company for which that user has a current, approved membership with the required recruitment permission.
- **FR-003**: Authorization MUST be revalidated when a report is viewed, filtered, refreshed, generated, and downloaded; possessing a report or export identifier MUST NOT grant access.
- **FR-004**: The system MUST prevent cross-company disclosure of posting metrics, applications, candidate identities, contact details, scores, and export artifacts, including for users who belong to multiple companies.
- **FR-005**: Candidate name, email address, phone number, and CV screening score MUST appear only in employer candidate exports authorized for the corresponding application and posting; platform aggregates and activity logs MUST not expose these values or other unnecessary candidate personal data.

#### System Statistics Dashboard

- **FR-006**: The Administrator dashboard MUST show time-series metrics for new user registrations, currently active job postings, application success rate, and applications per candidate. The active-posting value for each daily, weekly, or monthly time bucket MUST equal the number of postings in an active lifecycle state at the end of that bucket in the displayed platform time zone.
- **FR-007**: Application success rate MUST use applications submitted within the selected date range as a cohort and equal cohort applications in Hired status at the report data cutoff divided by all validly submitted cohort applications, multiplied by 100. Withdrawn cohort applications remain in the denominator.
- **FR-008**: Applications per candidate MUST equal submitted applications in the selected report population divided by distinct Candidates who submitted at least one included application; Candidates with no included applications MUST NOT contribute to the denominator.
- **FR-009**: The dashboard MUST support daily, weekly, monthly, and custom date ranges and MUST show the active range, grouping, time zone, last data refresh time, and earliest supported analytics date. A range beginning before that date MUST be rejected rather than returning incomplete active-posting history.
- **FR-010**: Metric labels MUST distinguish current snapshots from events accumulated within the selected period and MUST disclose the business definition of each metric.
- **FR-011**: All metrics shown together for one report request MUST be derived from a consistent data cutoff so that cross-metric comparisons are meaningful.

#### Job Posting Performance and Funnel

- **FR-012**: The Employer report MUST show, for each authorized posting, qualifying view count, submitted-application count, and conversion rate for the selected period.
- **FR-013**: Conversion rate MUST equal submitted applications divided by qualifying views multiplied by 100; when qualifying views are zero, it MUST be reported as not applicable.
- **FR-014**: The system MUST count at most one qualifying view per visitor, posting, and platform-calendar day. It MUST exclude posting previews by authorized members of the owning company and traffic identified as automated. Authenticated and unauthenticated visitors MAY qualify, provided repeated views can be deduplicated using privacy-safe context.
- **FR-015**: The hiring funnel MUST use the constitution's canonical application states: Applied, Viewed, Shortlisted, Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted.
- **FR-016**: For the current funnel snapshot, every included application MUST contribute to exactly one stage; each stage MUST show its count and its percentage of all included applications.
- **FR-017**: The funnel MUST clearly distinguish current stage distribution from historical transitions and MUST not treat CV screening scores as decisions or automatically move, reject, offer, or hire candidates.
- **FR-018**: Date filtering MUST apply consistently to period-based views and applications; if the funnel remains a current snapshot, that difference MUST be clearly labeled with an as-of timestamp.

#### Candidate Export

- **FR-019**: An authorized Employer member MUST be able to request a candidate-list export for exactly one job posting in CSV or Excel format.
- **FR-020**: Each export MUST contain stable, human-readable headers and one row per included application, with candidate name, email address, and phone number from the immutable application contact snapshot captured at submission, plus application status and CV screening score. Later profile edits MUST NOT change these exported contact values. Postal address and other candidate-profile fields MUST NOT be included. Optional administrative columns MAY include posting identity, application date, score availability, and export timestamp if documented in the file legend.
- **FR-021**: CSV exports MUST preserve Unicode text, use a consistent delimiter and quoting convention, and contain a single header row; Excel exports MUST provide a clearly named data sheet with the same required fields and an optional metadata/legend sheet.
- **FR-022**: CSV and Excel exports generated from the same posting, filters, and data cutoff MUST contain equivalent record populations and field values.
- **FR-023**: Exported screening scores MUST retain their stored display scale and availability state, MUST not be recalculated solely for export, and MUST be presented as AI-assisted estimates rather than hiring decisions where a legend is included.
- **FR-024**: Export generation MUST neutralize values that spreadsheet software could interpret as executable formulas while preserving the visible candidate data.
- **FR-025**: The system MUST produce either a complete, internally consistent export or a clear failure; it MUST NOT present a partial file as complete.
- **FR-026**: Every export request and outcome MUST be auditable with actor, action, company, target posting, format, result, timestamp, and record count where available, without duplicating candidate details in the audit entry.
- **FR-026A**: A completed export artifact MUST remain downloadable for no more than 24 hours after completion. Authorization MUST be revalidated on every download, and suspension, revoked company membership, or loss of the required permission MUST make the artifact immediately unavailable even before expiry.
- **FR-026B**: When the 24-hour availability period ends, the export artifact MUST become inaccessible and MUST be deleted from active export storage; the audit record MAY remain for its separately defined retention period without retaining exported candidate content.

#### Activity Tracking and Aggregates

- **FR-027**: The system MUST record auditable login, logout, job-post creation, job-post deletion, application submission, pipeline transition, and export events with actor, action, target or context, result, role, and timestamp where applicable.
- **FR-028**: The Administrator activity view SHOULD support filtering by date range, user role, and action type and MUST make all active filters visible.
- **FR-029**: Posting-deletion events MUST preserve enough non-sensitive posting identity and company context to identify what was deleted without restoring deleted posting content.
- **FR-030**: Administrator aggregates SHOULD show total postings created, total applications submitted, and time trends for both over the selected period, using the same filtering and time-boundary conventions as the activity view.
- **FR-031**: Activity and audit records MUST remain available for 24 months from occurrence. An authorized legal hold MAY preserve specified records beyond 24 months for the duration of the hold; held records MUST remain purpose-limited and unavailable for unrelated ordinary use.
- **FR-032**: Deferral of the P2 activity user interface MUST NOT defer the mandatory capture of critical audit events required by project governance.

#### Accuracy, Feedback, and Accessibility

- **FR-033**: Dashboard values, reports, and exports MUST use documented definitions, time-zone rules, boundary inclusion, rounding precision, and data-cutoff timestamps.
- **FR-034**: The system MUST provide clear loading, empty, success, validation, and failure states and MUST allow safe retry of failed report or export requests.
- **FR-035**: Charts and funnel boards MUST provide textual values, descriptive labels, keyboard-accessible controls, sufficient contrast, and meaning that does not rely on color alone.
- **FR-036**: The system MUST log report/export failures without writing candidate contact details, exported content, or other unnecessary personal data into ordinary operational logs.
- **FR-037**: Reports and exports MUST reflect authoritative recruitment state and MUST not silently substitute cached or estimated values when fresher authoritative data is required by the displayed cutoff.

### Key Entities *(include if feature involves data)*

- **User**: A platform identity; essential attributes include stable identity, display identity, base role, account status, registration timestamp, and approved company memberships used for authorization.
- **CompanyMembership**: The relationship granting Employer authority within one company; essential attributes include company, user, membership status, recruitment permissions, and validity period.
- **JobPosting**: A company's recruitment posting; essential attributes include stable identity, company ownership, title/reference, lifecycle status, creator, creation/publish/close/delete timestamps, and deletion actor where applicable.
- **JobViewEvent**: A qualifying or excluded observation of a posting; essential attributes include posting, occurrence time, platform-calendar day, exclusion classification, and privacy-safe visitor context sufficient to enforce at most one qualifying view per visitor/posting/day without retaining unnecessary identity data.
- **Application**: A candidate's submitted application to a posting; essential attributes include stable identity, posting, candidate, submitted timestamp, current canonical status, status timestamps/history, and withdrawal/deletion/anonymization state relevant to reporting.
- **CandidateProfile**: Candidate information used to populate the application contact snapshot at submission; essential attributes include stable identity, name, email address, phone number, and privacy/account state. Later profile values are not read directly into an existing application's export row.
- **ApplicationContactSnapshot**: Immutable candidate contact values captured with the submitted application; essential attributes are candidate name, email address, and phone number. This is the authoritative contact source for candidate exports.
- **ScreeningResult**: The AI-assisted CV screening outcome associated with an application; essential attributes include availability/status, score, scale, calculation timestamp, and enough provenance to distinguish completed, pending, failed, and limited results.
- **AuditEvent / ActivityLog Projection**: An immutable audit event is the authoritative record; the Administrator activity log is its privacy-safe projection. Essential attributes include actor or historical actor reference, effective role, action type, target/context, company scope, result, timestamp, and privacy-safe metadata.
- **ExportRequest**: A request to generate a point-in-time candidate file; essential attributes include requester, company, posting, selected format, filters, requested/data-cutoff/completed/expiry timestamps, status, record count, failure category, authorization state, and audit reference.
- **ReportFilter**: The user-selected reporting scope; essential attributes include start/end boundaries, time zone, grouping granularity, company/posting scope where permitted, roles, and action types.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of Administrator dashboard and Employer report requests display complete results within 3 seconds for a documented representative dataset and test window; dashboard navigation interactions complete within 2 seconds at the 95th percentile.
- **SC-002**: At least 95% of exports containing up to 10,000 candidate rows become available within 10 seconds under documented representative conditions, with a generation error rate below 1% excluding invalid or unauthorized requests.
- **SC-003**: For controlled validation datasets, 100% of dashboard totals, rates, funnel counts, funnel membership, and exported row populations match independently calculated authoritative results at the stated data cutoff.
- **SC-004**: For identical posting, filter, and cutoff inputs, CSV and Excel exports have 100% agreement on required headers, row counts, application identities, statuses, and screening-score values.
- **SC-005**: In authorization tests, 100% of cross-company, revoked-membership, suspended-account, and non-Administrator attempts are denied without disclosure of protected metrics, candidates, activity events, or export files.
- **SC-006**: In supported spreadsheet compatibility tests, 100% of sampled Vietnamese text and delimiter/quote/line-break cases remain readable in the intended cells, and 100% of formula-like values are rendered inert.
- **SC-007**: In moderated task testing, at least 90% of Administrators and Employers can apply a date filter, interpret the relevant metric definitions, and obtain the intended report or export on their first attempt without assistance.
- **SC-008**: Every successful or failed export and every required critical activity type produces exactly one understandable audit outcome per business action in idempotency and retry tests.
- **SC-009**: Charts and funnel reports pass all defined keyboard navigation, descriptive-label, contrast, and non-color communication checks for the supported Administrator and Employer desktop workflows.

## Assumptions

- “Employer” means a Recruiter/HR Manager acting through a current approved company membership; it is not an unrestricted global user role.
- “Currently active job postings” is a point-in-time snapshot at the end of each displayed daily, weekly, or monthly bucket, while registrations and submitted applications are events occurring within each bucket.
- Daily, weekly, and monthly are both quick-select report groupings; custom ranges use the platform's displayed business time zone and an inclusive-start/exclusive-end convention.
- The canonical application stages in the constitution supersede the illustrative funnel names in the request. “Screening” is represented by Viewed and Shortlisted; “Interview” by Interviewing; and “Offer” by Offered, with Offer Declined and Waitlisted retained as distinct states.
- Funnel percentages use all applications included in the current posting population as the denominator and display consistent rounding precision.
- Application success rate uses applications submitted within the selected period as a cohort and evaluates Hired status at the report data cutoff; applications per candidate includes only Candidates with at least one included submission.
- Activity and audit records are retained for 24 months unless an authorized, purpose-limited legal hold requires longer preservation.
- View counting permits at most one qualifying view per visitor, posting, and platform-calendar day, excluding owning-company previews and identified automated traffic; the specification does not prescribe tracking technology.
- Candidate exports are scoped to one posting per file and include the applications visible to the authorized Employer at the export data cutoff.
- Candidate name, email address, and phone number are exported from the immutable application contact snapshot, not the Candidate's later live profile.
- Historical active-posting trends are available only from the published analytics baseline established when authoritative lifecycle recording begins; earlier ranges are rejected instead of estimated.
- Completed export artifacts remain downloadable for at most 24 hours, subject to authorization on every download and immediate revocation when access changes; audit metadata follows the separate 24-month activity-retention rule.
- P2 activity screens and aggregates may be deferred, but constitutional critical-event capture and export auditing are not optional.
- The existing authentication, company-membership, application-stage, screening-score, and job-lifecycle sources remain authoritative dependencies.

## Out of Scope

- Automated hiring decisions, automatic stage movement, candidate ranking changes, or changes to the approved screening formula and score bands.
- Editing recruitment records from a dashboard, report, funnel summary, or exported file.
- Cross-company benchmarking that discloses another company's posting, candidate, or performance data.
- Scheduled email delivery, third-party business-intelligence integrations, and arbitrary user-designed report builders unless separately specified.
- Importing modifications from CSV/Excel back into recruitment records.
