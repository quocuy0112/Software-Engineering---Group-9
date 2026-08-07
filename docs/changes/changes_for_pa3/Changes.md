# PA3 Changes Log

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

This file records the material changes made to the revised PA3 documents compared with their PA2 versions. Minor wording, grammar, and formatting corrections are grouped under the final general-formatting entry.

## 1. Project Plan Changes

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

- **Previous version:** `Project_Plan_PA2.md`
- **Revised version:** `Project_Plan_PA3.md`

| Change ID | PA2 Version | Change Made in PA3 | Reason | Revised Location |
|---|---|---|---|---|
| PP-01 | The PA2 version recorded Nguyễn Gia Quốc Uy as the editor and did not include document-level responsibility metadata or a Planning Baseline note. | The PA3 version records Lưu Chí Hải as the editor, adds document-level performer, reviewer, and editor metadata, and adds a Planning Baseline note explaining the source and status of sprint dates and assignments. | Accurately record document responsibility and clarify which planning information is confirmed or estimated. | Document header and Planning Baseline |
| PP-02 | The Introduction described SmartHire generally as an enterprise recruitment platform focused mainly on job posting, application tracking, and CV screening. | Rewrote the Introduction to identify SmartHire as an AI-assisted applicant tracking system for Vietnamese small and medium-sized enterprises. Expanded the product context, identified candidates, company recruitment members, and platform administrators, and clarified that recruiters retain responsibility for recruitment decisions. | Improve clarity and align the Project Plan with the revised product direction and human-controlled AI policy. | Section 1 — Introduction |
| PP-03 | The Project Overview contained one general goal statement. | Expanded the goal into specific objectives covering centralized recruitment workflows, candidate services, recruiter services, administrator functions, human decision control, requirements traceability, and delivery of project outputs. | Make the project goals more specific and traceable to the planned work. | Section 2.1 — Goals |
| PP-04 | The scope was represented by a short list of selected functional groups. | Reorganized the scope into 12 high-level product areas and added an explicit out-of-scope list covering removed or deferred capabilities, including AI-generated job descriptions, AI resume rewriting, automated recruitment decisions, semantic AI job recommendations, external calendar integration, payroll, onboarding, and full HR management. | Clarify product boundaries and align the Project Plan with the revised Vision Document. | Section 2.2 — Scope |
| PP-05 | The Project Overview included fixed frontend and backend technology details such as Next.js, TypeScript, Tailwind CSS, Zustand, Shadcn UI, hello-pangea/dnd, Next.js API Routes, and PostgreSQL/MySQL. | Retained the responsive web application delivery form but removed technology-specific implementation details from the high-level Project Overview. Implementation work is now described through sprint tasks, deliverables, constraints, and builds. | Keep the Project Overview focused on the product and move implementation details to the planning sections. | Section 2.3 — Delivery Form and Section 4 — Project Plan |
| PP-06 | No dedicated Project Constraints section was included. | Added 13 constraints covering the five-member team and academic deadlines, Notion synchronization, English and Markdown/PDF documentation, Git version control, responsibility metadata, multi-tenant authorization, sensitive data, advisory AI, rule-based job matching, CV upload limits, external-service failures, P0/P1 priorities, and Spec Kit evidence. | Address the PA2 feedback that the Project Overview lacked constraints and explain the planning impact of each constraint. | Section 2.4 — Project Constraints |
| PP-07 | Assumptions were limited to AI-provider availability and team-member availability. | Separated assumptions from dependencies and expanded them to cover supported browsers, supported CV formats, recruiter information, administrator review, reviewer assignments, Notion updates, Git, Spec Kit, the database, secure file storage, email delivery, AI services, and file parsing. | Provide a clearer and more complete basis for implementation and project delivery. | Section 2.5 — Assumptions and Dependencies |
| PP-08 | Deliverables consisted of three broad bullets describing the frontend, backend, and required documentation. | Replaced the broad list with 18 identified deliverables covering the application, revised documents, `changes.md`, Spec Kit artifacts, use-case models, use-case specifications, prototypes, the Sprint 3 functional group, testing evidence, reports, guides, Markdown/PDF outputs, Git evidence, and three software builds. Added related-task references for every deliverable. | Address the incomplete-deliverables feedback and make each project output traceable to implementation tasks. | Section 2.6 — Deliverables |
| PP-09 | Team roles were shown as a short name-and-role list. | Converted the list into a structured table and added the main responsibilities associated with each role. | Clarify the responsibilities and ownership areas of each team member. | Section 3.1 — Team Structure and Roles |
| PP-10 | No general review or task-responsibility rules were documented. | Added rules covering one accountable owner per task, reviewer approval before completion, Notion tracking, Git workflow, `changes.md` updates, and individual AI-use logging. | Define how work is assigned, reviewed, tracked, and accepted. | Section 3.2 — Review and Responsibility Rules |
| PP-11 | Risk Management contained three general risks: AI API integration, scope creep, and team-member unavailability. Each risk contained only a mitigation statement. | Replaced the list with an 11-entry Risk Register containing risk ID, probability, impact, owner, mitigation, and contingency. Added risks concerning cross-tenant data exposure, personal-data leakage, AI bias, CV parser failure, email delivery failure, database migration or data loss, AI-service downtime, scope instability, Notion inconsistency, integration or regression failure, and document inconsistency. The previous team-member-unavailability item is no longer maintained as a separate risk. | Address the PA2 request for additional risks and provide clear prevention, ownership, and recovery actions. | Section 3.3 — Risk Register |
| PP-12 | The schedule listed Sprint 1 as completed, provided six Sprint 2 assignments with one due date, and described Sprints 3–5 through tentative focus statements without exact sprint date ranges. | Added a schedule summary for all five sprints with exact date ranges, main objectives, and exit deliverables. | Address the missing-date feedback and provide a complete project timeline. | Section 4.1 — Schedule Summary |
| PP-13 | Sprint 1 had no task-level breakdown. | Added a Sprint 1 task table covering task-tracker and repository setup, three existing-application surveys, Scrum meeting minutes, the Team Contract, and the Project Proposal. Added task IDs, owners, reviewers, dates, and acceptance criteria. | Complete the historical project schedule and preserve task traceability across all sprints. | Section 4.2 — Sprint 1 Task List |
| PP-14 | Sprint 2 contained six broad assignments and did not identify reviewers, start dates, or acceptance criteria. | Expanded Sprint 2 into detailed task rows covering Spec Kit initialization and learning logs, Vision Document sections, the Project Plan and meeting minutes, feature briefing and review, translation, `constitution.md`, individual AI Usage Reports, Mermaid workflows, NFRs, the Weekly Report, document conversion, and PA2 PDF verification. Added an owner, reviewer, start date, due date, and acceptance criteria for every task. | Address the PA2 feedback that Sprint 2 lacked reviewers and sufficiently detailed task assignments. | Section 4.3 — Sprint 2 Task List |
| PP-15 | Sprint 3 was a tentative statement focused on finalizing the Project Plan, implementing the database schema, and building Authentication APIs. | Added a complete Sprint 3 task list for revising the Project Plan and Vision Document, producing use-case diagrams, use-case specifications, and prototype evidence, implementing the team-selected Authentication, Authorization, and Access Control functional group through Spec Kit, preparing individual AI Usage Reports, producing the Weekly Report and task-tracker evidence, consolidating outputs, and maintaining `changes.md`. | Update the schedule using current PA3 information and reflect the required revised documents, use-case work, prototype work, Spec Kit implementation, and reports. | Section 4.4 — Sprint 3 Task List |
| PP-16 | Sprint 4 was represented only by a tentative focus on the Kanban interface, Job Board UI, and initial AI semantic scoring. | Added an expected Sprint 4 task list covering the database schema and migrations, candidate profile and CV backend work, candidate and recruiter interfaces, job management, nine-stage pipeline processing, Kanban, hybrid scoring, notifications, Build 2 testing, documentation, Weekly Report evidence, and individual AI Usage Reports. Added owners, reviewers, dates, and acceptance criteria. | Replace a high-level placeholder with an actionable planning baseline and address the feedback that Sprint 4 lacked a task list and specific dates. | Section 4.5 — Expected Sprint 4 Task List |
| PP-17 | Sprint 5 was represented only by a tentative focus on system integration, end-to-end testing, bug fixing, and the final demonstration. | Added an expected Sprint 5 task list covering company verification and membership, administrator functions, authentication hardening, security and failure testing, optional P1 analytics and export, non-functional and end-to-end testing, user and technical documentation, final integration, submission and demonstration consolidation, Weekly Report evidence, and individual AI Usage Reports. Added owners, reviewers, dates, and acceptance criteria. | Replace a high-level placeholder with an actionable planning baseline and address the feedback that Sprint 5 lacked a task list and specific dates. | Section 4.6 — Expected Sprint 5 Task List |
| PP-18 | The Build Plan contained three prose bullets without target dates or measurable exit criteria. | Replaced it with a table containing the PA2 Documentation Baseline, Build 1, Build 2, and Final Build, including target dates, included scope, and exit criteria. Build 1 was updated to include revised documents, use-case artifacts, prototype evidence, and a demonstrable full-stack Authentication increment. | Improve build planning, reflect PA3 outputs, and define completion conditions for each release point. | Section 4.7 — Build Plan |
| PP-19 | No Definition of Done was documented. | Added eight completion conditions covering Notion status, Git commits, acceptance criteria, reviewer approval, required evidence, traceability updates, Markdown/PDF rendering, and `changes.md` updates. | Establish a consistent rule for determining when a task is complete. | Section 4.8 — Definition of Done |
| PP-20 | The Project Plan did not explicitly map revised Vision decisions to project scope or implementation work. | Added a Vision-alignment table covering the SME target, high-level Product Overview, business rationale and beneficiaries, removed AI features, the nine-stage pipeline, membership-based authorization, secure cookies, rule-based job matching, advisory AI, P1 analytics and export, personal-data protection, and service-failure handling. | Address the feedback that the Project Plan did not reflect important Vision Document changes. | Section 5 — Alignment with the Revised Vision |
| PP-21 | No direct traceability from PA2 feedback to revised Project Plan locations was provided. | Added a feedback-traceability table mapping every recorded PA2 issue to the section or task that addresses it. | Make the revisions easy to review and verify. | Section 6 — PA2 Feedback Traceability |
| PP-22 | No Revision History was provided. | Added a dated Revision History covering changes to the Project Overview, reviewer assignments, schedule, sprint task lists, deliverables, risks, Vision alignment, task traceability, and acceptance criteria. | Preserve a concise audit trail of the PA3 revision. | Section 7 — Revision History |
| PP-23 | The PA2 version used mixed bullet structures, broad unnumbered outputs, informal date presentation, and limited cross-references. | Standardized the document in English Markdown using numbered sections, structured tables, consistent date formats, unique IDs for constraints, deliverables, risks, and tasks, and explicit references among deliverables, tasks, Vision decisions, and PA2 feedback. | Improve readability, consistency, reviewability, and submission traceability. | Throughout the Project Plan |

## 2. Product Overview Changes

**Modify based on feedback PA2:** Nguyễn Quốc Thành<br>
**Student ID:** 24127542 <br>
**Reviewer Name:** Nguyễn Gia Quốc Uy

<i>**Objective:** Revise the Product Overview by removing implementation-specific details and presenting SmartHire at a high level, focusing on its purpose, target users, core capabilities, product scope, and the advisory role of AI in recruitment decisions.</i>

SmartHire is a web-based recruitment platform designed to support Vietnamese small and medium-sized enterprises in managing recruitment activities through a centralized and structured workflow.

The platform connects candidates, recruiters, company representatives, and platform administrators throughout the recruitment lifecycle. Candidates can maintain professional profiles, upload CVs, discover suitable job opportunities, submit applications, and monitor their application progress. Recruiters can manage job postings, review applicants, organize candidates through recruitment stages, and use advisory scoring information to support candidate evaluation. Administrators maintain platform trust through company verification, job-post moderation, account management, and security oversight.

SmartHire aims to reduce the fragmented recruitment processes commonly handled through email, spreadsheets, separate job platforms, and manual communication. By combining job discovery, applicant tracking, recruitment coordination, notifications, and AI-assisted candidate evaluation within one platform, the product helps recruitment teams improve efficiency while providing candidates with a clearer and more transparent application experience.

AI-generated scores and explanations are used only as decision-support information. They do not automatically reject, progress, or hire candidates. Final recruitment decisions remain under the control of authorized recruiters and hiring representatives.

### 2.1. Product Perspective

SmartHire operates as a standalone, responsive recruitment platform that serves three primary user groups:

* **Candidates**, who create professional profiles, manage CVs, search for approved job opportunities, submit applications, and track recruitment progress.
* **Recruiters and company representatives**, who manage company job postings, review applications, evaluate candidates, and coordinate recruitment pipelines.
* **Platform administrators**, who verify companies and recruiter access, moderate job postings, manage accounts, and oversee platform security and reliability.

The product provides a shared recruitment environment in which candidate information, job postings, applications, evaluation results, and recruitment-stage updates are managed consistently. Access to company recruitment data is restricted to authorized members of the relevant company.

SmartHire also relies on external services for email delivery and AI-assisted candidate analysis. Temporary failure of an external service should not prevent users from accessing unaffected core recruitment functions.

### 2.2. High-Level Product Capabilities

SmartHire provides the following high-level capabilities:

#### Candidate Experience

Candidates can create and maintain reusable professional profiles, upload supported CV files, search for approved jobs, submit applications, and monitor application statuses from a single account.

#### Recruiter and Company Management

Authorized company members can create and manage job postings, review applicants, compare candidate information, and organize applications through a structured recruitment pipeline.

#### Candidate Evaluation Support

The platform provides deterministic matching and AI-assisted analysis to generate advisory candidate-job compatibility scores and understandable explanations. These results support recruiter review but do not replace human judgment.

#### Communication and Transparency

Email and in-app notifications inform users about important events such as account verification, application submission, recruitment-stage changes, moderation decisions, and system actions.

#### Administration and Platform Trust

Administrators can verify companies and recruiter access, moderate job postings, manage user accounts, investigate violations, and review important audit records.

#### Reporting and Analytics

Recruitment analytics and permitted data-export capabilities are planned as secondary capabilities after the core candidate, recruiter, and administrative workflows are stable.

### 2.3. Product Boundaries

The current SmartHire release focuses on the core recruitment workflow from candidate profile creation and job publication to application review and hiring-stage management.

The current release does not include:

* Fully automated candidate rejection or hiring decisions.
* AI-generated job descriptions.
* AI-based CV rewriting or qualification enhancement.
* Payroll, employee onboarding, or complete human-resource management.
* External calendar synchronization.
* Semantic AI job recommendations.

Job recommendations are based on structured information such as skills, preferences, tags, job type, and location. Recruitment analytics and data export may be deferred if the required core workflow has not reached sufficient stability.

### 2.4. Assumptions and Dependencies

The product is based on the following high-level assumptions:

* Users have access to an internet-connected device and a modern web browser.
* Candidates provide accurate profile information and upload CVs in supported formats.
* Recruiters provide legitimate company documents and accurate job-posting information.
* Administrators perform verification and moderation activities within a reasonable operational period.
* AI-generated results are treated as advisory information rather than final recruitment decisions.

The product depends on:

* An email-delivery service for verification, password recovery, and recruitment notifications.
* An AI service for semantic candidate-job analysis and score explanations.
* Secure document storage for CVs and company-verification files.
* Reliable application hosting and persistent data storage.
* Applicable Vietnamese personal-data protection requirements.

External-service interruptions may temporarily affect related features. However, failure of email delivery or AI processing should not corrupt recruitment data or block unrelated platform operations.

## 3. Product Features Changes

**Modify based on feedback PA2:** Nguyễn Quốc Thành<br>
**Student ID:** 24127542 <br>
**Reviewer Name:** Nguyễn Gia Quốc Uy

<i>**Objective:** Enhance the Feature Descriptions by adding a clear business rationale and identifying the primary beneficiaries for each existing feature, while keeping the original short descriptions and priorities unchanged.
</i>
### 3.2. Detailed Feature List

| No. | Group Feature                                      | Short Description                                                                                                                                              | Business Rationale                                                                                                                        | Primary Beneficiaries                                       | Priority    |
| --: | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------- |
|   1 | **Authentication, Authorization & Access Control** | Allows users to register and log in securely, supports email verification and password recovery, and enforces platform-level and company-scoped authorization. | Protects personal and recruitment data while preventing unauthorized access and cross-company data exposure.                              | All users                                                   | P0 (Must)   |
|   2 | **Account Setup & Management**                     | Allows users to update non-critical account information, profile images, and preferences. Password changes remain part of P0 authentication security.          | Enables users to maintain accurate account information and communication preferences without requiring administrative support.            | Candidates and recruiters                                   | P1 (Should) |
|   3 | **Candidate Profile Management**                   | Allows candidates to build a professional profile through a form or CV upload, with a CV parser that standardizes data for applications and scoring.           | Reduces repetitive data entry and provides structured candidate information for more consistent application and evaluation processes.     | Candidates and recruiters                                   | P0 (Must)   |
|   4 | **Job Board & Advanced Search**                    | Allows candidates to search, filter, view, save, share, report, and apply to approved job postings.                                                            | Helps candidates discover more relevant opportunities and allows companies to receive applications from more suitable candidates.         | Candidates and hiring companies                             | P0 (Must)   |
|   5 | **Job Posting Management**                         | Allows company-authorized recruiters to create, preview, edit, and manage the lifecycle of job postings.                                                       | Centralizes vacancy management and provides structured job information for searching, matching, and candidate screening.                  | Recruiters and hiring companies                             | P0 (Must)   |
|   6 | **Application Tracking (Candidate Side)**          | Allows candidates to track saved jobs, submitted applications, scoring progress, and recommended jobs.                                                         | Improves application transparency and reduces uncertainty and manual follow-up for candidates.                                            | Candidates                                                  | P0 (Must)   |
|   7 | **Candidate Screening & Hybrid Scoring System**    | Combines deterministic skills/experience matching with AI-assisted semantic analysis to score and rank applicants for a job posting.                           | Helps recruiters prioritize applications and apply more consistent initial screening criteria while retaining human decision-making.      | Recruiters and hiring managers                              | P0 (Must)   |
|   8 | **Recruitment Pipeline Kanban Board**              | Provides a drag-and-drop interface for authorized company members to track and update application stages.                                                      | Replaces fragmented spreadsheet tracking and improves recruitment coordination, visibility, and collaboration.                            | Recruiters and hiring managers                              | P0 (Must)   |
|   9 | **Automated Notifications & In-App Alerts**        | Sends email and in-app notifications when relevant application or moderation events occur.                                                                     | Reduces repetitive communication work and ensures users receive timely information about important events.                                | Candidates, recruiters, and administrators                  | P0 (Must)   |
|  10 | **Job Posting Moderation & Quality Assurance**     | Allows administrators to approve or reject job postings and handle spam or violation reports.                                                                  | Reduces fraudulent, misleading, and low-quality job content and improves trust in the platform.                                           | Candidates, administrators, and legitimate hiring companies | P0 (Must)   |
|  11 | **User Management & Employer Verification**        | Allows administrators to find user accounts, verify company documents, approve memberships, and handle violations.                                             | Prevents fake recruiter accounts, company impersonation, unauthorized company access, and recruitment fraud.                              | Candidates, administrators, and hiring companies            | P0 (Must)   |
|  12 | **Recruitment Analytics & Data Export**            | Provides dashboards, recruitment statistics, and CSV/Excel exports for authorized users.                                                                       | Helps organizations evaluate recruitment performance, identify pipeline bottlenecks, and make decisions using structured historical data. | Recruiters, company owners, and administrators              | P1 (Should) |


<!-- Add the Vision Document change log in this section before the final PA3 submission. -->
