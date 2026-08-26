# Feature Specification: Candidate Profile Discovery and Recruiter Review

**Feature Branch**: `027-candidate-profile-discovery`  
**Created**: 2026-08-25  
**Status**: Draft — awaiting product confirmation  
**Input**: Candidate users need to find another candidate by an exact account ID and view only consented profile information. Recruiters need a separate profile review view for candidates who applied to a job they are authorized to manage.

## Clarifications

### Session 2026-08-25

- Q: Should candidate-to-candidate discovery and recruiter-after-application visibility use the same section choices? → A: No. The candidate controls the two audiences independently; contact sharing remains a separate per-application decision.
- Q: Can a candidate withdraw contact consent after submitting an application? → A: Yes. Withdrawal blocks future contact-detail views for that application immediately; it cannot retract details already seen or independently retained by a recruiter.
- Q: What lookup-abuse limits apply to exact-ID discovery? → A: At most 10 attempts per minute and 30 unsuccessful attempts per rolling hour for each account and network origin; exceeding either limit blocks further lookup for 15 minutes and creates an audit event.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a discoverable professional profile (Priority: P1)

A candidate chooses whether other candidates can find their profile by exact account ID and selects which professional sections are visible to that audience. Separately, the candidate selects which professional sections recruiters may view after an application. The candidate can later withdraw either live-profile visibility without changing their application records.

**Why this priority**: Candidate control of personal data is required before any profile discovery can be safely offered.

**Independent Test**: A candidate can set profile visibility, view the saved choice after returning to the profile settings, and change it to hidden; the visible projection changes accordingly.

**Acceptance Scenarios**:

1. **Given** an active candidate, **When** they enable discovery by exact ID and choose visible professional sections, **Then** those choices are saved and only the selected sections may be shown to another candidate.
2. **Given** an active candidate, **When** they choose a different set of sections for recruiters after applying, **Then** that choice does not alter what other candidates can see.
3. **Given** a discoverable candidate, **When** they change discovery to hidden, **Then** future candidate searches and profile visits no longer expose their live profile.
4. **Given** a candidate has not enabled discovery, **When** another candidate knows their ID, **Then** the other candidate cannot obtain a visible profile result.

---

### User Story 2 - Find a professional by exact ID (Priority: P1)

An authenticated candidate enters the exact account ID of another candidate from the Connections page. If that person is discoverable, the search returns one compact professional card and the candidate can open the allowed profile view.

**Why this priority**: This is the primary candidate-to-candidate discovery workflow.

**Independent Test**: With two active candidates and one discoverable profile, the first candidate searches the exact ID, sees one result, and opens a view containing only the selected public sections.

**Acceptance Scenarios**:

1. **Given** a discoverable active candidate and their exact ID, **When** another authenticated candidate searches that ID, **Then** the search returns exactly one professional result with only permitted summary information and a profile-view action.
2. **Given** an unknown, inactive, hidden, malformed, or unauthorized ID, **When** a candidate searches it, **Then** the user receives the same neutral “No visible profile found” outcome.
3. **Given** a candidate enters a name, email address, partial ID, or blank value, **When** they submit the search, **Then** no directory result is returned and the user is asked to enter an exact valid ID.
4. **Given** a candidate opens a discoverable profile, **When** a section was not selected for sharing, **Then** that section and all contact, application, scoring, and messaging information remain absent.

---

### User Story 3 - Review an applicant profile as an authorized recruiter (Priority: P1)

A recruiter who is authorized to manage a job opens a dedicated candidate-profile view from that job’s applicant list. The view combines the candidate’s application snapshot with only live professional information the candidate has permitted recruiters to see after applying.

**Why this priority**: Recruiters need complete, job-relevant information without being granted unrestricted access to candidate accounts.

**Independent Test**: A recruiter with authority for a job opens an applicant’s profile and sees the submitted documents and permitted information; a recruiter without authority cannot access the same view using its link or identifier.

**Acceptance Scenarios**:

1. **Given** a candidate submitted an application and a recruiter has active authority for that job, **When** the recruiter selects “View candidate profile”, **Then** the recruiter can review the application snapshot and allowed professional profile information.
2. **Given** a recruiter lacks authority for the job, **When** they attempt to open an applicant profile directly, **Then** no application, profile, document, or contact information is disclosed.
3. **Given** a candidate subsequently edits or hides their live profile, **When** an authorized recruiter reopens a prior application, **Then** the submitted application snapshot remains available while withdrawn live-profile sections are not shown.
4. **Given** a candidate has not applied to a job, **When** a recruiter tries to use the candidate’s account ID to view them, **Then** the recruiter cannot obtain a recruiter-profile view.

---

### User Story 4 - Give contact consent for one application (Priority: P2)

When applying, a candidate explicitly chooses whether recruiters authorized for that particular job may see the contact details supplied for that application. The choice applies to that application only.

**Why this priority**: Contact details are sensitive and a candidate may reasonably make a different decision for each employer or role.

**Independent Test**: The same candidate submits two applications with different contact choices; each authorized recruiter sees only the contact information allowed for their own application.

**Acceptance Scenarios**:

1. **Given** a candidate is reviewing an application before submission, **When** they choose to share contact details, **Then** the consent is clearly described and recorded with that application.
2. **Given** a candidate did not share contact details for an application, **When** an authorized recruiter views that applicant, **Then** email address, phone number, and other contact details are not displayed.
3. **Given** a recruiter is authorized for one job but not another, **When** the candidate has applications to both, **Then** the recruiter receives information only from the authorized job’s application.
4. **Given** a candidate previously shared contact details for an application, **When** they withdraw that consent, **Then** subsequent recruiter views no longer show those contact details and the withdrawal is recorded.

### Edge Cases

- A candidate searches their own ID: the product directs them to their own profile settings rather than returning a public-result card.
- A profile becomes hidden between search and open: opening it produces the neutral unavailable result and does not reveal why it became unavailable.
- An account is suspended, deleted, or otherwise inactive: it is not discoverable and existing access follows the platform’s account-state policy without leaking account state.
- A candidate has no headline, summary, avatar, or selected professional sections: the result may show the display name only, with a clear empty-state message in the profile view.
- A recruiter’s company membership or job authority is removed during review: subsequent profile, document, and contact requests are denied.
- A candidate withdraws an application: its retained snapshot remains available only according to the defined retention policy; the candidate’s live visibility choices remain effective immediately.
- A candidate reaches 10 exact-ID lookup attempts in one minute or 30 unsuccessful attempts in one rolling hour: further lookup is blocked for 15 minutes for the relevant account or network origin, recorded, and handled without revealing which IDs exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an active candidate to choose either hidden or discoverable-by-exact-ID status for their professional profile.
- **FR-002**: The system MUST allow a candidate to independently choose visibility for avatar, headline, summary, general location, skills, experience, education, and professional links for each of two audiences: other candidates who find them by exact ID, and recruiters reviewing an application after it is submitted.
- **FR-003**: The system MUST treat email address, phone number, precise address, date of birth, application status, CV source files, cover letters, AI/matching results, recruiter notes, and message history as non-public to other candidates.
- **FR-004**: The Connections page MUST accept only a complete exact account ID for professional discovery and MUST NOT provide name, email, partial-ID, or type-ahead directory search.
- **FR-005**: A successful candidate discovery search MUST return no more than one result and MUST show only the target’s currently permitted compact professional information.
- **FR-006**: Search outcomes for unknown, inactive, hidden, and otherwise inaccessible IDs MUST use one neutral user-visible result that does not disclose the underlying reason.
- **FR-007**: The system MUST allow at most 10 exact-ID lookup attempts per minute and 30 unsuccessful attempts per rolling hour for each signed-in account and each network origin; reaching either threshold MUST block further lookup for 15 minutes, return non-sensitive feedback, and create an audit event.
- **FR-008**: Candidate discovery and profile access decisions MUST be enforced before any protected profile field is returned; client-side controls alone are insufficient.
- **FR-009**: A candidate who changes a profile or section to hidden for either audience MUST have that change take effect for future live-profile views for that audience without changing submitted application snapshots.
- **FR-010**: The system MUST provide a dedicated recruiter candidate-profile action only from an applicant context and MUST identify the target through the application being reviewed, not through a free-form candidate directory lookup.
- **FR-011**: The system MUST permit recruiter profile review only to users with current, verified company membership and authority for the application’s job.
- **FR-012**: The recruiter profile view MUST distinguish the submitted application snapshot from the candidate’s current professional profile where both are shown.
- **FR-013**: An authorized recruiter MUST be able to view the CV, cover letter, and other recruitment evidence submitted with that application, subject to the platform’s existing document-retention policy.
- **FR-014**: A recruiter MUST NOT receive an applicant’s live professional section when the candidate has not permitted that section for the recruiter-after-application audience, even if that section is visible to other candidates.
- **FR-015**: The application flow MUST obtain a clear, separate, per-application decision before sharing contact details with recruiters authorized for that job.
- **FR-016**: A recruiter MUST receive candidate contact details only when the candidate’s current consent permits it for that same application; a candidate MUST be able to withdraw that consent for future recruiter views, with immediate effect and an audit record.
- **FR-017**: The system MUST retain an auditable record of profile-visibility changes, exact-ID lookup throttling events, contact-consent decisions, and recruiter access to application snapshots and contact details, without recording unnecessary profile contents.
- **FR-018**: Application snapshots MUST remain available to authorized recruiters after a candidate changes live-profile visibility or withdraws the application, for 12 months from submission unless a stricter legal hold or retention rule applies.
- **FR-019**: After the applicable application-snapshot retention period, the system MUST remove or redact retained recruitment evidence according to the platform’s retention policy while preserving only the minimum required audit record.
- **FR-020**: All search, profile, consent, authorization, and error states MUST be keyboard accessible, clearly labelled, and provide meaningful non-sensitive feedback.

### Key Entities

- **Candidate profile visibility**: The candidate’s discoverability status and independently selected professional sections for the candidate-discovery and recruiter-after-application audiences.
- **Professional profile projection**: The minimal set of profile information that a particular viewer is permitted to see at a particular time.
- **Application profile snapshot**: The candidate information and documents submitted for a specific job application, preserved independently of later live-profile edits.
- **Application contact consent**: A candidate’s explicit, revocable decision about whether authorized recruiters for one application may view application contact details; it records both granting and withdrawal times.
- **Recruiter review authority**: The current company-membership and job-management authority required to view an application and its retained evidence.
- **Profile-access audit event**: A minimal record of a privacy-relevant lookup, visibility change, consent action, or recruiter review.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In representative normal-load testing, 95% of valid exact-ID discovery searches show a result or neutral unavailable outcome within 2 seconds.
- **SC-002**: In usability testing, at least 90% of candidates can set discoverability and successfully find an eligible professional by exact ID on their first attempt without assistance.
- **SC-003**: In authorization testing, 100% of attempts by unauthorized recruiters and non-eligible candidate viewers disclose no protected applicant, contact, document, or hidden-profile data.
- **SC-004**: In permission-change testing, 100% of hidden-profile updates prevent subsequent live-profile disclosure while preserving only the policy-authorized application snapshot.
- **SC-005**: In application-consent testing, 100% of recruiter contact views match the candidate’s current recorded consent for that specific application, including after withdrawal.
- **SC-006**: In accessibility review, all primary search, visibility, profile-review, and contact-consent actions are completable using keyboard-only navigation and expose descriptive labels and status feedback.

## Assumptions

- Every normal account has a base Candidate identity; only active candidate accounts may opt into exact-ID discovery.
- Exact account IDs are identifiers rather than secrets. Consent and authorization, not ID entropy, protect profile data.
- Discoverability is off by default for existing and newly created candidate profiles until the candidate opts in.
- Candidate-to-candidate visibility and recruiter-after-application visibility are independent; a section selected for one audience is not selected for the other by default.
- Recruiter access is granted through verified company membership and current authority for the relevant job, including eligible teammates where existing job-management rules allow them.
- Candidate contact sharing is off by default, is requested separately for every submitted application, and may be withdrawn for future views after submission.
- A withdrawn application does not erase its authorized recruitment snapshot before the 12-month retention period; a legal hold or stricter applicable rule takes precedence.
- This feature does not add a public people directory, name/email search, candidate-to-candidate messaging, recruiter search for non-applicants, or changes to AI scoring and hiring decisions.
