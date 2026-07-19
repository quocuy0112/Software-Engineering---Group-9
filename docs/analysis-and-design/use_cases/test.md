# SmartHire Functional Requirements and Traceability Matrix

*Performed by: Nguyen Gia Quoc Uy | Reviewed by: Group 9 | Edited by: Nguyen Gia Quoc Uy*

## 1. Requirement Conventions

The following priority scheme is used:

- **P0 - Must:** Required for the core SmartHire workflow.
- **P1 - Should:** Important but may be delivered after the P0 capabilities are stable.

Each requirement uses the following ID format:

```text
FR-[FUNCTIONAL-GROUP]-[NUMBER]
```

Example: `FR-AUTH-01`.

---

# 2. Functional Requirements Catalogue

## 2.1. Authentication, Authorization and Access Control

| ID         | Priority | Functional Requirement                                                                                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-01 | P0       | The system shall allow a visitor to register a standard user account by providing a full name, email address, and password.                             |
| FR-AUTH-02 | P0       | The system shall reject registration when the email address is already associated with an existing account.                                             |
| FR-AUTH-03 | P0       | The system shall send an email-verification link or code after successful registration.                                                                 |
| FR-AUTH-04 | P0       | The system shall activate the account only after the user completes email verification with a valid, unexpired token.                                   |
| FR-AUTH-05 | P0       | The system shall allow a user to request another verification email when the previous verification token has expired or was not received.               |
| FR-AUTH-06 | P0       | The system shall allow a verified user to log in using a valid email address and password.                                                              |
| FR-AUTH-07 | P0       | The system shall create an authenticated session after successful login and attach the user's identity and authorization context to protected requests. |
| FR-AUTH-08 | P0       | The system shall allow an authenticated user to log out and invalidate the corresponding session or refresh token.                                      |
| FR-AUTH-09 | P0       | The system shall allow a user to request a password-reset link using the account email address.                                                         |
| FR-AUTH-10 | P0       | The system shall allow the user to set a new password using a valid, unexpired, single-use password-reset token.                                        |
| FR-AUTH-11 | P0       | The system shall allow an authenticated user to change the current password after confirming the existing password.                                     |
| FR-AUTH-12 | P0       | The system shall enforce platform-level permissions for standard users and Platform Administrators.                                                     |
| FR-AUTH-13 | P0       | The system shall enforce company-scoped permissions using active company memberships with `OWNER`, `HR_MANAGER`, or `RECRUITER` roles.                  |
| FR-AUTH-14 | P0       | The system shall allow one user to hold active memberships in multiple companies and select or resolve an active company context.                       |
| FR-AUTH-15 | P0       | The system shall deny unauthenticated access to protected resources without exposing protected data.                                                    |
| FR-AUTH-16 | P0       | The system shall deny an authenticated user access to resources outside the user's platform role, company scope, or resource ownership.                 |

## 2.2. Account Setup and Management

| ID        | Priority | Functional Requirement                                                                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-ACC-01 | P1       | The system shall allow an authenticated user to view the user's account information.                                                             |
| FR-ACC-02 | P1       | The system shall allow an authenticated user to update non-critical account information such as display name, phone number, and contact details. |
| FR-ACC-03 | P1       | The system shall allow an authenticated user to upload, replace, or remove a profile image.                                                      |
| FR-ACC-04 | P1       | The system shall allow an authenticated user to configure supported account and notification preferences.                                        |
| FR-ACC-05 | P1       | The system shall restrict company information updates to company members with the required company-scoped permission.                            |

## 2.3. Candidate Profile Management

| ID         | Priority | Functional Requirement                                                                                                                               |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-PROF-01 | P0       | The system shall allow a candidate to create a structured professional profile.                                                                      |
| FR-PROF-02 | P0       | The system shall allow a candidate to update personal information and a professional summary.                                                        |
| FR-PROF-03 | P0       | The system shall allow a candidate to add, edit, and remove education, work experience, skills, certifications, and other supported profile entries. |
| FR-PROF-04 | P0       | The system shall allow a candidate to upload a CV in PDF or DOCX format.                                                                             |
| FR-PROF-05 | P0       | The system shall extract supported candidate information and normalized text from an uploaded CV.                                                    |
| FR-PROF-06 | P0       | The system shall allow the candidate to review and correct information extracted from the CV before confirming it.                                   |
| FR-PROF-07 | P0       | The system shall preserve the candidate's confirmed structured profile for reuse in job applications.                                                |
| FR-PROF-08 | P0       | The system shall allow a candidate to replace an existing CV or select an available CV when submitting an application.                               |

## 2.4. Job Board and Advanced Search

| ID        | Priority | Functional Requirement                                                                                                                              |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-JOB-01 | P0       | The system shall display only approved and active job postings on the public job board.                                                             |
| FR-JOB-02 | P0       | The system shall allow visitors and candidates to browse available job postings with pagination or incremental loading.                             |
| FR-JOB-03 | P0       | The system shall allow users to search job postings using supported keywords.                                                                       |
| FR-JOB-04 | P0       | The system shall allow users to filter job postings by salary range, experience, location, job type, and supported tags or skills.                  |
| FR-JOB-05 | P0       | The system shall allow users to view the complete details of an approved job posting.                                                               |
| FR-JOB-06 | P0       | The system shall allow an authenticated candidate to save or remove a job from the saved-jobs list.                                                 |
| FR-JOB-07 | P0       | The system shall provide a shareable link for an approved job posting.                                                                              |
| FR-JOB-08 | P0       | The system shall allow an authenticated user to report a suspicious, fraudulent, or policy-violating job posting.                                   |
| FR-JOB-09 | P0       | The system shall prevent users from viewing unpublished, rejected, closed, or company-private postings unless they possess the required permission. |

## 2.5. Job Posting Management

| ID         | Priority | Functional Requirement                                                                                                                                                                                     |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-POST-01 | P0       | The system shall allow an authorized company member to create a job posting draft within the active company context.                                                                                       |
| FR-POST-02 | P0       | The system shall allow the recruiter to define a title, description, required skills, required experience, salary range, location, job type, application deadline, and other required posting information. |
| FR-POST-03 | P0       | The system shall validate required job-posting fields and business rules before allowing submission.                                                                                                       |
| FR-POST-04 | P0       | The system shall allow the recruiter to preview the job posting before submitting it for moderation.                                                                                                       |
| FR-POST-05 | P0       | The system shall allow an authorized company member to edit a draft or a posting that is eligible for revision.                                                                                            |
| FR-POST-06 | P0       | The system shall allow the recruiter to submit a complete job posting to the administration moderation queue.                                                                                              |
| FR-POST-07 | P0       | The system shall publish the job posting on the public job board only after administrative approval.                                                                                                       |
| FR-POST-08 | P0       | The system shall allow an authorized company member to close an active job posting.                                                                                                                        |
| FR-POST-09 | P0       | The system shall allow an authorized company member to extend an eligible job posting by setting a valid new deadline.                                                                                     |
| FR-POST-10 | P0       | The system shall allow authorized company members to view and manage job postings belonging to their active company.                                                                                       |
| FR-POST-11 | P0       | The system shall prevent a company member from viewing or modifying postings belonging to another company.                                                                                                 |

## 2.6. Job Applications and Candidate-Side Tracking

| ID        | Priority | Functional Requirement                                                                                                                                                                                                         |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-APP-01 | P0       | The system shall allow an authenticated candidate to apply to an approved, active, and open job posting.                                                                                                                       |
| FR-APP-02 | P0       | The system shall allow the candidate to select a stored profile or CV and provide supported application information such as a cover letter.                                                                                    |
| FR-APP-03 | P0       | The system shall validate that the candidate satisfies all mandatory application inputs before accepting the application.                                                                                                      |
| FR-APP-04 | P0       | The system shall prevent the same candidate from submitting duplicate active applications for the same job posting.                                                                                                            |
| FR-APP-05 | P0       | The system shall persist an accepted application and display a submission confirmation to the candidate.                                                                                                                       |
| FR-APP-06 | P0       | The system shall allow a candidate to view a list and details of submitted applications.                                                                                                                                       |
| FR-APP-07 | P0       | The system shall display the current recruitment stage of each application using the canonical stages: `Applied`, `Viewed`, `Shortlisted`, `Interviewing`, `Offered`, `Hired`, `Offer Declined`, `Rejected`, and `Waitlisted`. |
| FR-APP-08 | P0       | The system shall display AI-processing progress separately from the recruitment stage using `Pending`, `Processing`, `Completed`, or `Failed`.                                                                                 |
| FR-APP-09 | P0       | The system shall allow candidates to view their saved jobs from a consolidated page.                                                                                                                                           |
| FR-APP-10 | P0       | The system shall provide rule-based recommended jobs based on supported profile, skill, and job-requirement data.                                                                                                              |

## 2.7. Candidate Screening and Hybrid Scoring

| ID        | Priority | Functional Requirement                                                                                                                   |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FR-SCR-01 | P0       | The system shall initiate candidate screening after a valid job application is submitted.                                                |
| FR-SCR-02 | P0       | The screening process shall use the normalized candidate CV/profile data and structured requirements of the target job posting.          |
| FR-SCR-03 | P0       | The system shall calculate a deterministic matching score based on supported criteria such as skills and experience.                     |
| FR-SCR-04 | P0       | The system shall request an AI-assisted semantic evaluation of the candidate CV against the job description.                             |
| FR-SCR-05 | P0       | The system shall execute AI-assisted scoring asynchronously without blocking other user activities.                                      |
| FR-SCR-06 | P0       | The system shall calculate the final score using the approved formula: 60% deterministic matching score and 40% AI-assisted score.       |
| FR-SCR-07 | P0       | The system shall classify the final score as High Match, Moderate Match, or Low Match using the approved thresholds.                     |
| FR-SCR-08 | P0       | The system shall generate or store a human-readable explanation describing the candidate's relevant strengths and gaps.                  |
| FR-SCR-09 | P0       | The system shall allow an authorized recruiter to view applicant scores and explanations for a company-owned job posting.                |
| FR-SCR-10 | P0       | The system shall allow an authorized recruiter to rank or sort applicants using the final compatibility score.                           |
| FR-SCR-11 | P0       | The system shall display permitted scoring progress or results to the candidate without exposing confidential recruiter information.     |
| FR-SCR-12 | P0       | The system shall record a failed scoring attempt and support an authorized retry without changing the application's recruitment stage.   |
| FR-SCR-13 | P0       | The system shall treat the score as decision-support information and shall not automatically make hiring or recruitment-stage decisions. |

## 2.8. Recruitment Pipeline Kanban Board

| ID         | Priority | Functional Requirement                                                                                                                                |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-PIPE-01 | P0       | The system shall allow an authorized company member to view a Kanban pipeline for a company-owned job posting.                                        |
| FR-PIPE-02 | P0       | The system shall group application cards by their canonical recruitment stage.                                                                        |
| FR-PIPE-03 | P0       | The system shall allow an authorized company member to move an application to an allowed recruitment stage.                                           |
| FR-PIPE-04 | P0       | The system shall validate the actor's company membership, permission, resource ownership, and requested stage transition before accepting the update. |
| FR-PIPE-05 | P0       | The system shall persist an accepted stage change transactionally.                                                                                    |
| FR-PIPE-06 | P0       | The system shall record the previous stage, new stage, responsible actor, and update time for each accepted stage change.                             |
| FR-PIPE-07 | P0       | The system shall trigger configured candidate notifications after a successful stage change.                                                          |
| FR-PIPE-08 | P0       | The system shall restore or refresh the application card when the server rejects a drag-and-drop update.                                              |

## 2.9. Automated Notifications and In-App Alerts

| ID        | Priority | Functional Requirement                                                                                                             |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FR-NOT-01 | P0       | The system shall create notifications for supported recruitment, verification, moderation, and account events.                     |
| FR-NOT-02 | P0       | The system shall send a candidate an in-app notification and configured email when the candidate's application stage changes.      |
| FR-NOT-03 | P0       | The system shall notify the relevant company user when a company-verification, membership, or job-moderation decision is recorded. |
| FR-NOT-04 | P0       | The system shall allow an authenticated user to view the user's notification list.                                                 |
| FR-NOT-05 | P0       | The system shall display the read or unread status of an in-app notification.                                                      |
| FR-NOT-06 | P0       | The system shall allow a user to mark an in-app notification as read or unread.                                                    |
| FR-NOT-07 | P0       | The system shall prevent duplicate delivery of the same notification event to the same recipient and channel.                      |
| FR-NOT-08 | P0       | The system shall record failed notification delivery attempts and support the configured retry process.                            |

## 2.10. Job Posting Moderation and Quality Assurance

| ID        | Priority | Functional Requirement                                                                                                                                          |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-MOD-01 | P0       | The system shall place newly submitted job postings in an administrative review queue.                                                                          |
| FR-MOD-02 | P0       | The system shall allow a Platform Administrator to filter and inspect pending job postings and relevant employer information.                                   |
| FR-MOD-03 | P0       | The system shall allow a Platform Administrator to approve a compliant job posting.                                                                             |
| FR-MOD-04 | P0       | The system shall allow a Platform Administrator to reject a job posting and record a rejection reason.                                                          |
| FR-MOD-05 | P0       | The system shall allow a Platform Administrator to request revisions and provide the changes required before resubmission.                                      |
| FR-MOD-06 | P0       | The system shall allow an authorized company member to revise and resubmit an eligible rejected or revision-requested posting.                                  |
| FR-MOD-07 | P0       | The system shall allow a Platform Administrator to view reports submitted against job postings.                                                                 |
| FR-MOD-08 | P0       | The system shall allow a Platform Administrator to investigate a report and inspect the related posting, employer, reporter information, and supplied evidence. |
| FR-MOD-09 | P0       | The system shall allow a Platform Administrator to dismiss a report or apply an authorized moderation action such as hiding or removing the posting.            |
| FR-MOD-10 | P0       | The system shall record the administrator, time, reason, and result of each moderation decision.                                                                |

## 2.11. User Management and Employer Verification

| ID         | Priority | Functional Requirement                                                                                                                                         |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ORG-01  | P0       | The system shall retain candidate capabilities for a standard user even when the user receives one or more company memberships.                                |
| FR-ORG-02  | P0       | The system shall allow an authenticated user to create a company-verification request for a new company.                                                       |
| FR-ORG-03  | P0       | The system shall collect required company information, tax identification information, and supporting verification documents.                                  |
| FR-ORG-04  | P0       | The system shall allow a user to request membership in an existing company only through a valid invitation or required owner-approval process.                 |
| FR-ORG-05  | P0       | The system shall use a tax-ID match only to identify an existing company and shall not grant membership automatically.                                         |
| FR-ORG-06  | P0       | The system shall place company-verification and membership requests in the administrative review queue.                                                        |
| FR-ORG-07  | P0       | The system shall allow a Platform Administrator to inspect company information, submitted documents, membership evidence, and review history.                  |
| FR-ORG-08  | P0       | The system shall allow a Platform Administrator to approve an eligible company-verification or membership request.                                             |
| FR-ORG-09  | P0       | The system shall allow a Platform Administrator to reject a company-verification or membership request and record a reason.                                    |
| FR-ORG-10  | P0       | The system shall assign approved company permissions using the `OWNER`, `HR_MANAGER`, or `RECRUITER` membership role.                                          |
| FR-ORG-11  | P0       | The system shall allow an authorized `OWNER` to view and manage company memberships.                                                                           |
| FR-ORG-12  | P0       | The system shall allow an authorized `OWNER` to invite a user, approve an eligible join request, change an eligible membership role, or revoke company access. |
| FR-ORG-13  | P0       | The system shall allow an eligible company member to leave the company while preserving required ownership constraints.                                        |
| FR-ORG-14  | P0       | The system shall require a valid ownership-transfer process before the final `OWNER` can leave an active company.                                              |
| FR-ORG-15  | P0       | The system shall remove or suspend company-scoped access when the company or membership becomes inactive.                                                      |
| FR-USER-01 | P0       | The system shall allow a Platform Administrator to search and filter user accounts.                                                                            |
| FR-USER-02 | P0       | The system shall allow a Platform Administrator to view account, role, company-membership, and relevant enforcement information.                               |
| FR-USER-03 | P0       | The system shall allow a Platform Administrator to suspend or reactivate an eligible account with a recorded reason.                                           |
| FR-USER-04 | P0       | The system shall record the administrator, time, reason, and result of each account-management or enforcement action.                                          |

## 2.12. Recruitment Analytics and Data Export

| ID        | Priority | Functional Requirement                                                                                                                                      |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ANL-01 | P1       | The system shall allow an authorized company member to view analytics limited to the active company context.                                                |
| FR-ANL-02 | P1       | Company analytics shall include supported metrics such as posting views, application counts, recruitment-stage conversion, and successful hires.            |
| FR-ANL-03 | P1       | The system shall allow a Platform Administrator to view platform-level aggregate analytics.                                                                 |
| FR-ANL-04 | P1       | The system shall allow authorized users to filter supported analytics by time period and other permitted dimensions.                                        |
| FR-ANL-05 | P1       | The system shall allow an authorized user to export permitted recruitment data in CSV format.                                                               |
| FR-ANL-06 | P1       | The system shall allow an authorized user to export permitted recruitment data in Excel format.                                                             |
| FR-ANL-07 | P1       | The system shall restrict analytics and exported records according to platform role, active company context, membership permission, and resource ownership. |

---

# 3. Use-Case Catalogue

| Use-Case ID | Use-Case Name                        | Primary Actor                |
| ----------- | ------------------------------------ | ---------------------------- |
| UC-AUTH-01  | Register Account                     | Visitor                      |
| UC-AUTH-02  | Verify Email Address                 | Registered User              |
| UC-AUTH-03  | Log In                               | Verified User                |
| UC-AUTH-04  | Log Out and End Session              | Authenticated User           |
| UC-AUTH-05  | Recover Password                     | User                         |
| UC-AUTH-06  | Change Password                      | Authenticated User           |
| UC-AUTH-07  | Access a Protected Function          | Authenticated User           |
| UC-ACC-01   | Manage Account Information           | Authenticated User           |
| UC-ACC-02   | Manage Account Preferences           | Authenticated User           |
| UC-PROF-01  | Manage Candidate Profile             | Candidate                    |
| UC-PROF-02  | Upload and Parse CV                  | Candidate                    |
| UC-PROF-03  | Review and Confirm Parsed CV         | Candidate                    |
| UC-JOB-01   | Browse, Search and Filter Jobs       | Visitor, Candidate           |
| UC-JOB-02   | View Job Details                     | Visitor, Candidate           |
| UC-JOB-03   | Save or Remove Job                   | Candidate                    |
| UC-JOB-04   | Share Job                            | Visitor, Candidate           |
| UC-JOB-05   | Report Job Posting                   | Authenticated User           |
| UC-POST-01  | Create or Edit Job Draft             | Authorized Company Member    |
| UC-POST-02  | Preview and Submit Job Posting       | Authorized Company Member    |
| UC-POST-03  | Manage Job-Posting Lifecycle         | Authorized Company Member    |
| UC-POST-04  | View Company Job Postings            | Authorized Company Member    |
| UC-APP-01   | Apply for Job                        | Candidate                    |
| UC-APP-02   | Track Job Applications               | Candidate                    |
| UC-APP-03   | View Saved Jobs                      | Candidate                    |
| UC-APP-04   | View Recommended Jobs                | Candidate                    |
| UC-SCR-01   | Execute Hybrid Candidate Screening   | System                       |
| UC-SCR-02   | View Candidate Score and Explanation | Recruiter, Candidate         |
| UC-SCR-03   | Rank Applicants                      | Authorized Recruiter         |
| UC-SCR-04   | Retry Failed Scoring                 | Authorized Recruiter, System |
| UC-PIPE-01  | View Recruitment Kanban Board        | Authorized Company Member    |
| UC-PIPE-02  | Update Candidate Recruitment Stage   | Authorized Company Member    |
| UC-PIPE-03  | View Recruitment-Stage History       | Authorized Company Member    |
| UC-NOT-01   | Receive Event Notification           | Candidate, Company Member    |
| UC-NOT-02   | Manage In-App Notifications          | Authenticated User           |
| UC-NOT-03   | Retry Failed Notification Delivery   | System                       |
| UC-MOD-01   | Review Submitted Job Posting         | Platform Administrator       |
| UC-MOD-02   | Approve, Reject or Request Revision  | Platform Administrator       |
| UC-MOD-03   | Investigate Job Report               | Platform Administrator       |
| UC-ORG-01   | Submit Company Verification Request  | Authenticated User           |
| UC-ORG-02   | Request to Join Existing Company     | Authenticated User           |
| UC-ORG-03   | Review Company or Membership Request | Platform Administrator       |
| UC-ORG-04   | Manage Company Memberships and Roles | Company Owner                |
| UC-ORG-05   | Manage Membership Lifecycle          | Company Member, Owner        |
| UC-USER-01  | Search and View User Accounts        | Platform Administrator       |
| UC-USER-02  | Apply Account Enforcement Action     | Platform Administrator       |
| UC-ANL-01   | View Company Recruitment Analytics   | Authorized Company Member    |
| UC-ANL-02   | View Platform Analytics              | Platform Administrator       |
| UC-ANL-03   | Export Authorized Data               | Authorized User              |

---

# 4. Traceability Matrix

## 4.1. Diagram Definitions

| Diagram ID | Diagram Name                                      |
| ---------- | ------------------------------------------------- |
| DGM-01     | Identity, Access and Candidate Profile            |
| DGM-02     | Candidate Job Discovery and Application           |
| DGM-03     | Recruiter Job and Pipeline Operations             |
| DGM-04     | Administration, Moderation and Company Management |
| DGM-05     | Screening, Notifications and Analytics            |

## 4.2. Requirement-to-Use-Case Traceability

| Requirement IDs                                  | Use Case                                       | Diagram | Required Prototype Evidence                                                              | PA3 Implementation Evidence                                            |
| ------------------------------------------------ | ---------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| FR-AUTH-01, FR-AUTH-02                           | UC-AUTH-01 Register Account                    | DGM-01  | Registration form; validation errors; duplicate-email error; registration-success screen | Registration UI, API, database record and automated/manual tests       |
| FR-AUTH-03, FR-AUTH-04, FR-AUTH-05               | UC-AUTH-02 Verify Email Address                | DGM-01  | Verification-pending, verification-success, invalid/expired-token and resend screens     | Verification token persistence, email flow, verification API and tests |
| FR-AUTH-06, FR-AUTH-07                           | UC-AUTH-03 Log In                              | DGM-01  | Login form; invalid-credentials error; unverified-account message; successful redirect   | Login API, authenticated cookie/session and tests                      |
| FR-AUTH-08                                       | UC-AUTH-04 Log Out and End Session             | DGM-01  | Authenticated navigation and post-logout screen                                          | Logout API, session/token invalidation and protected-route test        |
| FR-AUTH-09, FR-AUTH-10                           | UC-AUTH-05 Recover Password                    | DGM-01  | Forgot-password form; neutral confirmation; invalid/expired-token; reset-success screens | Reset-token persistence, reset APIs and tests                          |
| FR-AUTH-11                                       | UC-AUTH-06 Change Password                     | DGM-01  | Change-password form; incorrect-current-password; success screen                         | Change-password API and session invalidation test                      |
| FR-AUTH-12 to FR-AUTH-16                         | UC-AUTH-07 Access a Protected Function         | DGM-01  | Protected page; login-required state; permission-denied state; company-context selector  | Auth middleware, platform role and company-scope checks, 401/403 tests |
| FR-ACC-01 to FR-ACC-03                           | UC-ACC-01 Manage Account Information           | DGM-01  | Account-detail form; avatar state; validation and success states                         | Documentation and prototype in PA3; implementation deferred            |
| FR-ACC-04, FR-ACC-05                             | UC-ACC-02 Manage Account Preferences           | DGM-01  | Preferences form and unauthorized-company-edit state                                     | Documentation and prototype in PA3; implementation deferred            |
| FR-PROF-01 to FR-PROF-03, FR-PROF-07             | UC-PROF-01 Manage Candidate Profile            | DGM-01  | Candidate-profile form; add/edit/remove profile-entry screens                            | Documentation and prototype in PA3; implementation deferred            |
| FR-PROF-04, FR-PROF-05                           | UC-PROF-02 Upload and Parse CV                 | DGM-01  | CV-upload, upload-progress, invalid-file and parse-failure screens                       | Documentation and prototype in PA3; implementation deferred            |
| FR-PROF-06, FR-PROF-08                           | UC-PROF-03 Review and Confirm Parsed CV        | DGM-01  | Parsed-data review, correction and CV-selection screens                                  | Documentation and prototype in PA3; implementation deferred            |
| FR-JOB-01 to FR-JOB-04                           | UC-JOB-01 Browse, Search and Filter Jobs       | DGM-02  | Job-board, filters, loading, empty-results and pagination states                         | Documentation and prototype in PA3; implementation deferred            |
| FR-JOB-05, FR-JOB-09                             | UC-JOB-02 View Job Details                     | DGM-02  | Job-detail, unavailable-job and access-denied states                                     | Documentation and prototype in PA3; implementation deferred            |
| FR-JOB-06                                        | UC-JOB-03 Save or Remove Job                   | DGM-02  | Save/unsave control; login-required state                                                | Documentation and prototype in PA3; implementation deferred            |
| FR-JOB-07                                        | UC-JOB-04 Share Job                            | DGM-02  | Share dialog and link-copied state                                                       | Documentation and prototype in PA3; implementation deferred            |
| FR-JOB-08                                        | UC-JOB-05 Report Job Posting                   | DGM-02  | Report form, validation, confirmation and duplicate-report state                         | Documentation and prototype in PA3; implementation deferred            |
| FR-POST-01 to FR-POST-03, FR-POST-05             | UC-POST-01 Create or Edit Job Draft            | DGM-03  | Job-editor form, validation, saved-draft and permission-denied states                    | Documentation and prototype in PA3; implementation deferred            |
| FR-POST-04, FR-POST-06                           | UC-POST-02 Preview and Submit Job Posting      | DGM-03  | Preview, submit-confirmation and incomplete-posting states                               | Documentation and prototype in PA3; implementation deferred            |
| FR-POST-07 to FR-POST-09                         | UC-POST-03 Manage Job-Posting Lifecycle        | DGM-03  | Posting-status, close-job, extend-deadline and invalid-transition states                 | Documentation and prototype in PA3; implementation deferred            |
| FR-POST-10, FR-POST-11                           | UC-POST-04 View Company Job Postings           | DGM-03  | Company-posting list, empty state and cross-company denial                               | Documentation and prototype in PA3; implementation deferred            |
| FR-APP-01 to FR-APP-05, FR-PROF-08               | UC-APP-01 Apply for Job                        | DGM-02  | Application form, CV selection, validation, duplicate-application and success screens    | Documentation and prototype in PA3; implementation deferred            |
| FR-APP-06 to FR-APP-08                           | UC-APP-02 Track Job Applications               | DGM-02  | Application list/detail, recruitment stage and scoring-status states                     | Documentation and prototype in PA3; implementation deferred            |
| FR-APP-09, FR-JOB-06                             | UC-APP-03 View Saved Jobs                      | DGM-02  | Saved-job list and empty state                                                           | Documentation and prototype in PA3; implementation deferred            |
| FR-APP-10                                        | UC-APP-04 View Recommended Jobs                | DGM-02  | Recommended-job list, explanation and empty state                                        | Documentation and prototype in PA3; implementation deferred            |
| FR-SCR-01 to FR-SCR-08                           | UC-SCR-01 Execute Hybrid Candidate Screening   | DGM-05  | Processing, completed and failed-scoring states                                          | Documentation and prototype in PA3; implementation deferred            |
| FR-SCR-08, FR-SCR-09, FR-SCR-11, FR-SCR-13       | UC-SCR-02 View Candidate Score and Explanation | DGM-05  | Score detail, explanation, processing and restricted-information states                  | Documentation and prototype in PA3; implementation deferred            |
| FR-SCR-09, FR-SCR-10, FR-SCR-13                  | UC-SCR-03 Rank Applicants                      | DGM-03  | Ranked-applicant list, sorting and no-score states                                       | Documentation and prototype in PA3; implementation deferred            |
| FR-SCR-12                                        | UC-SCR-04 Retry Failed Scoring                 | DGM-05  | Failed-scoring detail, retry confirmation and retry-progress states                      | Documentation and prototype in PA3; implementation deferred            |
| FR-PIPE-01, FR-PIPE-02                           | UC-PIPE-01 View Recruitment Kanban Board       | DGM-03  | Kanban board, loading, empty-board and permission-denied states                          | Documentation and prototype in PA3; implementation deferred            |
| FR-PIPE-03 to FR-PIPE-05, FR-PIPE-07, FR-PIPE-08 | UC-PIPE-02 Update Candidate Recruitment Stage  | DGM-03  | Drag/drop success, invalid transition, rejected update and rollback states               | Documentation and prototype in PA3; implementation deferred            |
| FR-PIPE-06                                       | UC-PIPE-03 View Recruitment-Stage History      | DGM-03  | Application history/timeline screen                                                      | Documentation and prototype in PA3; implementation deferred            |
| FR-NOT-01 to FR-NOT-03                           | UC-NOT-01 Receive Event Notification           | DGM-05  | In-app alert and representative email notification                                       | Documentation and prototype in PA3; implementation deferred            |
| FR-NOT-04 to FR-NOT-06                           | UC-NOT-02 Manage In-App Notifications          | DGM-05  | Notification list, unread/read and empty states                                          | Documentation and prototype in PA3; implementation deferred            |
| FR-NOT-07, FR-NOT-08                             | UC-NOT-03 Retry Failed Notification Delivery   | DGM-05  | Delivery status or administrative failure evidence where applicable                      | Documentation and prototype in PA3; implementation deferred            |
| FR-MOD-01, FR-MOD-02                             | UC-MOD-01 Review Submitted Job Posting         | DGM-04  | Moderation queue, filters, posting detail and empty state                                | Documentation and prototype in PA3; implementation deferred            |
| FR-MOD-03 to FR-MOD-06, FR-MOD-10                | UC-MOD-02 Approve, Reject or Request Revision  | DGM-04  | Approve confirmation, rejection reason, revision request and resubmission states         | Documentation and prototype in PA3; implementation deferred            |
| FR-MOD-07 to FR-MOD-10, FR-JOB-08                | UC-MOD-03 Investigate Job Report               | DGM-04  | Report queue, investigation detail, dismiss and enforcement-action states                | Documentation and prototype in PA3; implementation deferred            |
| FR-ORG-02, FR-ORG-03, FR-ORG-06                  | UC-ORG-01 Submit Company Verification Request  | DGM-04  | Company form, document upload, validation and submission-confirmation states             | Documentation and prototype in PA3; implementation deferred            |
| FR-ORG-04 to FR-ORG-06                           | UC-ORG-02 Request to Join Existing Company     | DGM-04  | Company lookup, invitation/approval requirement and request-submitted states             | Documentation and prototype in PA3; implementation deferred            |
| FR-ORG-07 to FR-ORG-10                           | UC-ORG-03 Review Company or Membership Request | DGM-04  | Admin queue, document review, approval and rejection states                              | Documentation and prototype in PA3; implementation deferred            |
| FR-ORG-01, FR-ORG-10 to FR-ORG-12                | UC-ORG-04 Manage Company Memberships and Roles | DGM-04  | Member list, invitation, role-change, revoke-access and permission-denied states         | Documentation and prototype in PA3; implementation deferred            |
| FR-ORG-13 to FR-ORG-15                           | UC-ORG-05 Manage Membership Lifecycle          | DGM-04  | Leave-company, transfer-ownership and inactive-company states                            | Documentation and prototype in PA3; implementation deferred            |
| FR-USER-01, FR-USER-02                           | UC-USER-01 Search and View User Accounts       | DGM-04  | User search, filters, details and empty-results states                                   | Documentation and prototype in PA3; implementation deferred            |
| FR-USER-03, FR-USER-04                           | UC-USER-02 Apply Account Enforcement Action    | DGM-04  | Suspend/reactivate confirmation, reason form and protected-account error                 | Documentation and prototype in PA3; implementation deferred            |
| FR-ANL-01, FR-ANL-02, FR-ANL-04, FR-ANL-07       | UC-ANL-01 View Company Recruitment Analytics   | DGM-05  | Company dashboard, date filters, empty data and permission-denied states                 | Documentation and prototype in PA3; P1 implementation deferred         |
| FR-ANL-03, FR-ANL-04, FR-ANL-07                  | UC-ANL-02 View Platform Analytics              | DGM-05  | Platform dashboard, filters and empty-data states                                        | Documentation and prototype in PA3; P1 implementation deferred         |
| FR-ANL-05 to FR-ANL-07                           | UC-ANL-03 Export Authorized Data               | DGM-05  | Export dialog, format selection, progress, success and permission-denied states          | Documentation and prototype in PA3; P1 implementation deferred         |

---

# 5. Coverage Summary

| Functional Group                          | Requirement Range                                | Use Cases                                        | Diagram        |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | -------------- |
| Authentication and Access Control         | FR-AUTH-01 to FR-AUTH-16                         | UC-AUTH-01 to UC-AUTH-07                         | DGM-01         |
| Account Management                        | FR-ACC-01 to FR-ACC-05                           | UC-ACC-01 to UC-ACC-02                           | DGM-01         |
| Candidate Profile Management              | FR-PROF-01 to FR-PROF-08                         | UC-PROF-01 to UC-PROF-03                         | DGM-01         |
| Job Board and Search                      | FR-JOB-01 to FR-JOB-09                           | UC-JOB-01 to UC-JOB-05                           | DGM-02         |
| Job Posting Management                    | FR-POST-01 to FR-POST-11                         | UC-POST-01 to UC-POST-04                         | DGM-03         |
| Application Tracking                      | FR-APP-01 to FR-APP-10                           | UC-APP-01 to UC-APP-04                           | DGM -02         |
| Hybrid Screening                          | FR-SCR-01 to FR-SCR-13                           | UC-SCR-01 to UC-SCR-04                           | DGM-03, DGM-05 |
| Recruitment Pipeline                      | FR-PIPE-01 to FR-PIPE-08                         | UC-PIPE-01 to UC-PIPE-03                         | DGM-03         |
| Notifications                             | FR-NOT-01 to FR-NOT-08                           | UC-NOT-01 to UC-NOT-03                           | DGM-05         |
| Job Moderation                            | FR-MOD-01 to FR-MOD-10                           | UC-MOD-01 to UC-MOD-03                           | DGM-04         |
| Employer Verification and User Management | FR-ORG-01 to FR-ORG-15; FR-USER-01 to FR-USER-04 | UC-ORG-01 to UC-ORG-05; UC-USER-01 to UC-USER-02 | DGM-04         |
| Analytics and Export                      | FR-ANL-01 to FR-ANL-07                           | UC-ANL-01 to UC-ANL-03                           | DGM-05         |

**Total functional requirements: 124**

**Total use cases: 48**

**PA3 implemented functional group:** Authentication, Authorization and Access Control.

**PA3 implementation scope:** FR-AUTH-01 to FR-AUTH-16, implemented through UC-AUTH-01 to UC-AUTH-07.

---

# 6. Traceability Validation Rules

The traceability matrix is considered complete only when:

1. Every functional requirement appears in at least one traceability row.
2. Every use case is represented in at least one Mermaid diagram.
3. Every use case has a complete use-case specification.
4. Every basic flow has corresponding prototype evidence.
5. Every significant alternative or exception flow has a prototype state or clearly justified non-UI system response.
6. Every implemented authentication requirement is linked to source code and at least one acceptance test.
7. No use case introduces functionality that contradicts the Vision Document.
8. Changes to functional requirements are recorded in `Changes.md`.
