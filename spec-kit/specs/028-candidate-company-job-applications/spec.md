# Feature Specification: Candidate Company and Team Applications

**Feature Branch**: `028-candidate-company-job-applications`
**Created**: 2026-08-26
**Status**: Draft
**Input**: Candidate users need a Company area where they can browse companies, view company details and available jobs, search jobs by keyword and location, and submit a CV to apply for HR Manager or Recruiter opportunities. Owners need a lightweight Team Applications area to review submitted CVs and decide whether to send a company invitation.

## Clarifications

### Session 2026-08-27

- Q: What happens when a public company has no active Owner? -> A: The Company page keeps ordinary public jobs available, but hides the HR Manager/Recruiter team-application actions and the submission API rejects new team applications for that company. Existing application records are preserved for audit and require data repair by an authorized administrator or Owner before they can receive a decision.
- Q: How does an Owner know that a candidate submitted a team application? -> A: A successful submission creates one localized in-app notification for every active company Owner. The notification contains a safe summary and opens Manage Team > Team Applications; it never includes CV contents or private applicant details.
- Q: Which language controls the Company and Team Applications UI? -> A: The selected workspace locale controls Candidate Company, Candidate Team Applications, Owner Team Applications, and related Manage Team navigation in English and Vietnamese. Company names, job content, CV names, and other user-authored data remain unchanged.

### Session 2026-08-26

- Q: Trong trang chi tiết Company, phạm vi job nào được hiển thị và cho phép ứng tuyển? → A: Hiển thị tất cả job đang hoạt động của company; trong feature này chỉ cho phép ứng tuyển vào job có role HR Manager hoặc Recruiter.
- Q: Candidate có thể ứng tuyển theo những luồng nào trên trang Company? → A: Có hai luồng độc lập: nộp CV để trở thành HR Manager hoặc Recruiter của company; hoặc tìm các job khác của company và chuyển sang trang chi tiết job để dùng luồng ứng tuyển job hiện có.
- Q: Team Applications trong Manage Team chứa loại hồ sơ nào? → A: Chỉ chứa hồ sơ ứng tuyển HR Manager hoặc Recruiter; hồ sơ ứng tuyển các job thông thường tiếp tục nằm trong workflow application hiện có.
- Q: Khi Owner từ chối Team Application, candidate có nhận thông báo không? → A: Hệ thống gửi email từ chối; Owner được tùy chọn nhập lý do và lý do sẽ được gửi cho candidate nếu có.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse companies (Priority: P1)

As a candidate, I can open the Company area and browse a list of companies with their logo, name, and short description so that I can discover potential employers.

**Why this priority**: Company discovery is the entry point for candidate applications and provides value even before a candidate opens a specific company.

**Independent Test**: A candidate can open the Company area, see available company cards, and open one company without needing to submit an application.

**Acceptance Scenarios**:

1. **Given** approved companies are available, **When** a candidate opens Company, **Then** the page displays company cards with company name, logo or fallback, and description.
2. **Given** no approved companies match the available data, **When** a candidate opens Company, **Then** the page displays a clear empty state without exposing private or unapproved company information.
3. **Given** a company card is visible, **When** the candidate selects it, **Then** the candidate is taken to that company’s public detail page.
4. **Given** multiple approved companies are available, **When** the candidate enters a company keyword and submits the search, **Then** only matching public company cards are displayed.
5. **Given** more companies exist than fit one page, **When** the candidate changes company pages, **Then** the selected page is loaded without exposing unapproved companies and the search keyword remains applied.

### User Story 2 - View company details and jobs (Priority: P1)

As a candidate, I can view a company’s description, founding year, employee-based company size, industry, location, a way to apply to join its HR Manager or Recruiter team, and its other posted jobs so that I can decide which opportunity fits me.

**Why this priority**: Candidates need enough trustworthy company and job information to make an informed application decision.

**Independent Test**: A candidate can open an approved company detail page and verify company information, job listings, and job filtering independently from the application submission flow.

**Acceptance Scenarios**:

1. **Given** an approved company has public profile information, **When** a candidate opens its detail page, **Then** the page displays its name, description, founding year when available, employee-count size range, industry, and public location information.
2. **Given** the company has active approved job posts, **When** the candidate views the detail page, **Then** the jobs section lists all those jobs with title, role, location, and employment information.
3. **Given** the company has no active approved jobs, **When** the candidate opens the jobs section, **Then** the page displays an empty state and does not show closed, rejected, or private job posts.
4. **Given** a company’s employee count changes, **When** the company detail is viewed, **Then** the displayed size is calculated from the company’s current active employee count using the product’s published size ranges.
5. **Given** a company has more active jobs than the configured page size, **When** the candidate opens or changes the jobs page, **Then** only that page of jobs is displayed and the result count/page controls remain visible.

### User Story 3 - Search and filter company jobs (Priority: P1)

As a candidate, I can search jobs within a company by keyword and filter them by location so that I can quickly find relevant HR Manager or Recruiter opportunities.

**Why this priority**: A company may have many jobs, and candidates need the same familiar search behavior available in Find Jobs.

**Independent Test**: A candidate can enter a keyword, choose a location, see matching jobs, clear the filters, and return to the full company job list.

**Acceptance Scenarios**:

1. **Given** a company has active jobs, **When** the candidate searches by a job title, skill, or relevant keyword, **Then** only matching jobs for that company are displayed.
2. **Given** a company has jobs in multiple locations, **When** the candidate selects a location, **Then** only jobs for that company matching the selected location are displayed.
3. **Given** the candidate uses both keyword and location filters, **When** the search is applied, **Then** results satisfy both filters.
4. **Given** no jobs match the search or location, **When** the candidate views the results, **Then** a clear no-results state is displayed with an option to clear filters.
5. **Given** the candidate clears the search and location filters, **When** the reset completes, **Then** all currently active public jobs for that company are shown again.
6. **Given** filtered company jobs span multiple pages, **When** the candidate changes the jobs page, **Then** the keyword and location filters remain applied and only the selected company’s jobs are returned.
7. **Given** a company job is shown, **When** the candidate views its card, **Then** it uses the same card layout and application/status actions as Find Jobs.

### User Story 4 - Apply for an HR Manager or Recruiter team role (Priority: P1)

As a candidate, I can choose to join a company as an HR Manager or Recruiter and submit my CV to the company Owner without entering a recruitment scoring or pipeline process. This team application is separate from applications to the company’s ordinary jobs.

**Why this priority**: The application is the core conversion from company discovery to a possible team invitation.

**Independent Test**: An authenticated candidate can select a supported team role, upload a valid CV, submit once, and receive confirmation that the application was received.

**Acceptance Scenarios**:

1. **Given** a company has an open Team Opportunity for HR Manager or Recruiter, **When** an authenticated candidate selects Apply and submits a valid CV, **Then** a team application is created for that company and role and the candidate sees a confirmation.
2. **Given** the candidate is not authenticated, **When** they select Apply, **Then** the product asks them to sign in or create an account before accepting the application.
3. **Given** the uploaded file is not PDF or DOCX, or exceeds 5,000,000 bytes, **When** the candidate submits it, **Then** the application is rejected with a clear validation message and no application is created.
4. **Given** the candidate has already submitted an active team application for the same company and role, **When** they try to submit another one, **Then** the product prevents a duplicate and shows the existing application status.
5. **Given** an application has been submitted, **When** the candidate views its confirmation or status, **Then** the product does not display a score, ranking, Kanban pipeline, or automatic hiring decision.
6. **Given** a candidate has submitted a Team Application, **When** the candidate opens Applications > Team Applications, **Then** the candidate sees the company, applied role, submission date, current status, and whether the Owner has viewed the CV.
7. **Given** the Owner has opened the Team Application or its CV, **When** the candidate refreshes Team Applications, **Then** the application shows `Viewed` and the first-viewed date without exposing Owner identity, view count, or time spent.

### User Story 5 - Review team applications and invite a candidate (Priority: P1)

As a company Owner, I can view submitted team applications, inspect each CV, and choose whether to invite the candidate as an HR Manager or Recruiter.

**Why this priority**: Owner review is the human decision point that protects company access and fulfills the intended lightweight workflow.

**Independent Test**: An Owner can open Team Applications, view a candidate’s submitted CV and applied role, reject an application, or accept it and send an invitation; a non-Owner cannot access the application.

**Acceptance Scenarios**:

1. **Given** a verified company has submitted team applications, **When** its Owner opens Manage Team > Team Applications, **Then** the Owner sees only HR Manager or Recruiter team applications with the applicant name, email, applied role, submission date, status, and CV action.
2. **Given** an Owner opens an application, **When** the Owner selects View CV, **Then** the submitted CV is available only to that authorized Owner and is not exposed to other companies or candidates.
3. **Given** an application is awaiting a decision, **When** the Owner selects Accept, **Then** the Owner must confirm the invitation role as HR Manager or Recruiter before the system sends an invitation.
4. **Given** an invitation role is confirmed, **When** the acceptance is completed, **Then** the application records the decision, an invitation is created for that company and role, and an email is sent to the candidate’s application email.
5. **Given** an application is awaiting a decision, **When** the Owner selects Reject, **Then** the application is marked rejected and no company access or invitation is created.
6. **Given** an Owner rejects an application, **When** the Owner optionally enters a reason, **Then** the candidate receives a rejection email containing that reason; when no reason is entered, the email contains only a neutral rejection message.
7. **Given** a non-Owner or a user from another company attempts to open a team application, **When** access is evaluated, **Then** the CV, applicant contact details, and application data are not disclosed.

### User Story 6 - Accept an invitation and join the company (Priority: P1)

As an invited candidate, I can open the invitation from my email, review the company and role, and accept it to become a company member.

**Why this priority**: Sending an invitation must not grant company privileges until the candidate explicitly accepts it.

**Independent Test**: An invited candidate can accept a valid invitation and become an active member with the confirmed role; expired, revoked, or already-used invitations cannot grant access.

**Acceptance Scenarios**:

1. **Given** a valid invitation exists, **When** the candidate accepts it, **Then** the candidate becomes an active member of the invited company with the confirmed HR Manager or Recruiter role.
2. **Given** an invitation is expired, revoked, or already accepted, **When** the candidate opens it, **Then** no membership is created and the candidate receives a clear non-sensitive message.
3. **Given** the candidate accepts an invitation while signed in to a different account, **When** the invitation is validated, **Then** the product requires confirmation or sign-in as the invited email account before membership is created.

### Edge Cases

- A company becomes unapproved, suspended, or deleted after appearing in the Company list; future public views and new applications must follow the company-state policy and must not expose private information.
- A public company has no active Owner because its membership data is incomplete or all Owners are inactive; ordinary jobs remain visible, team application actions are unavailable, and no new orphan Team Application may be created.
- A candidate selects an ordinary company job instead of joining as HR Manager or Recruiter; the product opens the existing job detail page and keeps that application in the existing ordinary job-application workflow, separate from Team Applications.
- A job closes after a candidate opens its detail page but before submission; the submission must be rejected and the candidate must be told that the job is no longer available.
- A job is edited or its role changes after an application is submitted; the application must retain the applied company, job, role, and submitted CV evidence as an immutable record.
- A candidate withdraws an application before an Owner decision; no invitation may be sent for the withdrawn application.
- An Owner rejects an application without entering a reason; the candidate still receives a neutral rejection email and no internal note or private decision detail is disclosed.
- An email delivery failure occurs after an Owner accepts an application; the decision and invitation must remain consistent, the failure must be visible to the Owner, and the Owner must be able to retry without creating duplicate invitations.
- The candidate’s email is already associated with an active member of the company; the product must prevent an additional duplicate membership and explain the next available action.
- The same candidate applies to HR Manager and Recruiter roles for one company; each role application must be handled independently, while duplicate submissions for the same role are prevented.
- The company has no founding year, industry, location, or employee count; the detail page must show an explicit unavailable value rather than inventing information.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide an authenticated Candidate-facing Company area listing approved and publicly visible companies.
- **FR-002**: Each company card MUST display the company name, logo or fallback, and a short description when available.
- **FR-003**: The system MUST provide a company detail page containing public company name, description, founding year when available, current employee-based size, industry, and public location information.
- **FR-004**: Company employee-based size MUST be derived from the current number of active company employees and displayed using defined size ranges; the system MUST NOT require the Owner to maintain a separate manual size value for this feature.
- **FR-005**: The company detail page MUST list only active, approved, publicly visible job posts belonging to that company and MUST provide a distinct entry point for applying to join the company as HR Manager or Recruiter.
- **FR-006**: The company jobs section MUST support case-insensitive and Vietnamese-diacritic-insensitive keyword search consistent with Find Jobs.
- **FR-007**: The company jobs section MUST support location filtering and combined keyword-plus-location filtering, with visible filter values and a clear reset action.
- **FR-008**: The system MUST display all active, approved, publicly visible jobs for a company; selecting an ordinary job MUST navigate the candidate to that job’s detail page and existing job-application flow.
- **FR-009**: The system MUST provide a separate team-application action for a candidate who wants to join the company as HR Manager or Recruiter.
- **FR-010**: A team application MUST capture the candidate, company, applied team role, application email, submission time, and the submitted CV as immutable application evidence.
- **FR-011**: CV uploads for team applications MUST accept only PDF and DOCX files up to exactly 5,000,000 bytes and MUST validate the file before persistence or processing.
- **FR-012**: The system MUST prevent duplicate active team applications by the same candidate for the same company and role, and MUST provide the existing status when a duplicate is attempted.
- **FR-013**: Submitting a team application MUST NOT automatically create company membership, send an invitation, assign a role, score the candidate, advance a pipeline state, or make a hiring decision.
- **FR-014**: The system MUST provide a Team Applications view under Manage Team for the authorized company Owner, containing only HR Manager and Recruiter team applications and remaining separate from active Team Members, pending Invitations, and ordinary job applications.
- **FR-015**: Team Applications MUST display applicant identity, application email, applied role, submission time, CV access, and a clear current decision/invitation status.
- **FR-016**: Only the company Owner and any explicitly authorized administrative actor permitted by existing company policy MAY view team application records, applicant contact details, and CV documents.
- **FR-017**: The Owner MUST be able to accept a team application only after confirming one invitation role from HR Manager or Recruiter.
- **FR-018**: Accepting a team application MUST create one idempotent invitation tied to the company, candidate email, application, and confirmed role, and MUST send the invitation through the existing email notification capability.
- **FR-019**: The system MUST allow the Owner to reject a team application without creating membership or an invitation.
- **FR-020**: Rejecting a team application MUST send the candidate a rejection email; the Owner MAY include a reason, and the system MUST include that reason in the email only when one was provided.
- **FR-021**: An invitation MUST NOT grant company access until the candidate explicitly accepts it; acceptance MUST create membership only for the confirmed company and role after server-side validation.
- **FR-022**: Invitation acceptance MUST prevent reuse, enforce expiration and revocation, and prevent duplicate active memberships for the same company and account.
- **FR-023**: Application, invitation, membership, and CV access operations MUST enforce server-side authentication, verified-company authorization, tenant isolation, file validation, and least-privilege privacy controls.
- **FR-024**: The system MUST audit team-application submission, CV access, Owner decision, invitation creation/retry/revocation, invitation acceptance, membership creation, and rejection-notification outcome with actor, target, result, and timestamp while excluding unnecessary CV contents and sensitive values.
- **FR-025**: The system MUST prevent duplicate invitations and duplicate critical records when an Owner retries an acceptance action or when email delivery is retried.
- **FR-026**: Candidates MUST be able to view the status of their submitted team applications and invitations, but MUST NOT view Owner-only notes, internal decision details, or other candidates’ applications.
- **FR-027**: Candidates MUST have an `Applications > Team Applications` view separate from ordinary Job Applications, showing company, applied role, submission date, current team-application status, invitation status when applicable, and whether the Owner has viewed the application.
- **FR-028**: Opening a Team Application or its CV for the first time by the authorized Owner MUST record an auditable first-view timestamp and change the candidate-visible status from `SUBMITTED` to `VIEWED`; the candidate MUST NOT see Owner identity, view count, or time spent.
- **FR-029**: Public company and job pages, application forms, Candidate Team Applications status views, Owner review screens, and invitation actions MUST provide keyboard-accessible controls, readable labels, loading feedback, validation feedback, and non-sensitive error states.
- **FR-030**: Company discovery, company detail, company job search, and Candidate Team Applications status views MUST remain usable on supported mobile and desktop screen sizes.
- **FR-031**: The feature MUST NOT add scoring, AI recommendations, recruitment pipeline/Kanban stages, or automatic hiring decisions to Team Applications; ordinary job applications MUST continue using their existing workflow.
- **FR-032**: The Company area MUST provide a keyword search over safe public company discovery fields and deterministic pagination, while preserving the active keyword when the candidate changes pages.
- **FR-033**: The company jobs section MUST use deterministic pagination with a default page size of 20, preserve keyword/location filters across page changes, and expose total results and current page information.
- **FR-034**: Ordinary job cards rendered on the company detail page MUST reuse the existing Find Jobs card/status component and MUST retain ordinary job navigation and application behavior.
- **FR-035**: The system MUST expose HR Manager and Recruiter team-application actions only for an approved public company with at least one active Owner; the submission API MUST enforce the same rule transactionally. Ordinary public jobs MUST remain discoverable when a company has no active Owner.
- **FR-036**: A successful new Team Application MUST create one deduplicated in-app notification for each active company Owner, localized using that Owner's language preference and linked to the Owner Team Applications screen. The notification MUST exclude CV contents, applicant email, and other unnecessary private data.
- **FR-037**: Candidate Company, Candidate Team Applications, Owner Team Applications, and related Manage Team navigation MUST source user-facing labels, statuses, errors, and dates from the English/Vietnamese locale boundary; user-authored company and job content MUST NOT be machine-translated by this feature.

### Key Entities

- **Company public profile**: Approved company information shown to candidates, including name, description, founding year, employee-derived size, industry, and public location.
- **Company job post**: An active public ordinary job owned by a company, including searchable title, role, location, and availability; selecting it leads to the existing job detail and application flow.
- **Team opportunity**: The company’s invitation pathway for candidates who want to join as HR Manager or Recruiter, separate from ordinary job posts.
- **Team application**: A candidate’s submission for a company HR Manager or Recruiter team opportunity, including applied role, application email, immutable submitted evidence, decision status, and audit timestamps.
- **Candidate Team Applications view**: A Candidate-only view separate from ordinary Job Applications that shows each submitted team application, status, invitation state, and whether the Owner has viewed it.
- **Team invitation**: A time-limited, revocable offer created from an accepted team application and bound to one company, candidate email, and confirmed role.
- **Company membership**: The active access relationship created only after invitation acceptance, with the confirmed HR Manager or Recruiter role.
- **Application access audit event**: A minimal record of submission, CV access, decision, invitation, and membership events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 90% of test candidates can open Company, identify a company, and reach its detail page within 2 minutes without assistance.
- **SC-002**: In representative normal-load testing, 95% of company detail pages and company job searches return visible results or an empty state within 2 seconds after the request is made.
- **SC-003**: At least 90% of usability-test candidates can find a job using keyword and location filters and submit a valid CV on their first attempt.
- **SC-004**: 100% of tested invalid CV types, oversized CVs, closed jobs, and duplicate applications are rejected without creating an invalid application record.
- **SC-005**: 100% of tested unauthorized users are prevented from viewing team applications, applicant contact details, or CV documents belonging to another company.
- **SC-006**: 100% of accepted applications produce at most one invitation and never create active company membership before invitation acceptance.
- **SC-007**: At least 95% of valid invitations are visible to the candidate through the intended email flow or are clearly marked for retry when delivery fails.
- **SC-008**: In accessibility review, all primary Company browsing, filtering, application, CV review, decision, and invitation actions can be completed using keyboard navigation with descriptive labels and visible status feedback.

## Assumptions

- The existing authenticated Candidate identity, company verification, company membership, job-post approval, CV storage, and email notification capabilities will be reused.
- Company pages show only approved companies and approved public job posts; private company administration data remains unavailable to Candidates.
- The initial supported team roles are exactly HR Manager and Recruiter. Owner is the company creator/owner role and is not an application target.
- The Company area is a lightweight discovery and team-application experience. It does not replace Find Jobs, the existing recruitment pipeline, or the existing job application workflow for ordinary candidates; ordinary jobs remain discoverable on the company page but open in their existing job detail flow.
- An Owner chooses the final invitation role from the two supported roles, even if the candidate selected a different preferred role when applying.
- The application email is the candidate’s account email by default and is the address used for invitation delivery after appropriate account validation.
- A team application may be withdrawn by its candidate before Owner acceptance; the retention and deletion policy for submitted CV evidence applies.
- Founding year, industry, location, description, and logo may be unavailable; the UI will show an explicit unavailable state instead of fabricated values.
- Standard platform CV retention, privacy, consent, and Vietnamese personal-data requirements apply to submitted team applications and CV documents.
- A Team Application can be received and reviewed only while the target company has at least one active Owner; Owner notification language follows the recipient's saved workspace preference.
