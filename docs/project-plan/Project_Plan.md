# Project Plan: SmartHire Recruitment System

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

*Planning status: reconciled through the Sprint 5 Weekly Report dated 09-08-2026. Sprint 5 remains in progress.*

## 1. Introduction

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

SmartHire is an AI-assisted applicant tracking system designed to support recruitment workflows for small and medium-sized enterprises in Vietnam. It centralizes candidate profiles and CVs, job postings, applications, recruitment pipelines, notifications, moderation, and candidate screening in a responsive web application.

The platform serves candidates, company members involved in recruitment, and platform administrators. AI-assisted scoring provides decision-support information and explanations, while authorized recruiters remain responsible for all recruitment decisions.

## 2. Project Overview

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

### 2.1. Goals

The project aims to:

- Provide a centralized recruitment workflow for candidates, company members, and platform administrators.
- Reduce fragmented recruitment work performed through disconnected emails and spreadsheets.
- Provide candidates with job discovery, application submission, application tracking, and notifications.
- Provide authorized company members with job-posting, applicant-review, candidate-scoring, and pipeline-management capabilities.
- Provide administrators with employer verification, job moderation, user management, and audit capabilities.
- Preserve human control over all candidate-progression and hiring decisions.
- Maintain traceability among the Vision Document, functional requirements, use cases, implementation tasks, and tests.
- Deliver the required documents, software builds, reports, and evidence within the project schedule.

### 2.2. Scope

At a high level, SmartHire covers the following product areas:

1. Authentication, authorization, and company-scoped access control.
2. Account and candidate-profile management.
3. CV upload, parsing, review, and reuse.
4. Job discovery, filtering, saving, sharing, reporting, and application submission.
5. Candidate-side application tracking.
6. Company-scoped job-posting management.
7. Hybrid candidate screening using deterministic matching and AI-assisted semantic analysis.
8. A recruitment pipeline using the canonical application stages defined in the Vision Document.
9. Email and in-app notifications.
10. Employer verification, company-membership management, job moderation, and user management.
11. Backend audit records for security-sensitive and administrative actions.
12. Recruitment analytics and authorized data export as P1 capabilities.

The current project release does not include:

- AI-generated job descriptions.
- AI resume rewriting or resume enhancement.
- Fully automated candidate rejection, progression, or hiring.
- Semantic AI job recommendations.
- External calendar synchronization.
- Payroll.
- Employee onboarding.
- A complete human-resource management suite.

The Sprint 5 Weekly Report assigns Chat Messaging work, but Chat Messaging is not one of the 12 feature groups in the current Vision Document. It is therefore tracked in this plan as a pending scope clarification, not as an approved addition to the release baseline. It must not displace unfinished P0 work unless the Vision Document and related traceability records are formally updated.

### 2.3. Delivery Form

SmartHire is delivered as a responsive web application supporting candidate, recruiter, and administrator workflows.

### 2.4. Project Constraints

| ID | Constraint | Planning Impact |
|---|---|---|
| CON-01 | The project is completed by a five-member student team under fixed academic deadlines. | Tasks require clear ownership, review responsibility, dates, and acceptance criteria. |
| CON-02 | Project tasks and schedules must be tracked in Notion and remain consistent with this Project Plan. | Assignment or schedule changes must be updated in both locations. |
| CON-03 | Project documents must be written in English and maintained in Markdown and rendered PDF formats. | Documentation tasks include writing, review, conversion, and submission evidence. |
| CON-04 | Source code and project documents must be version-controlled in Git. | Work must preserve commit history and follow the team Git workflow. |
| CON-05 | Required document sections must identify the performer, reviewer, and editor. | A document section is incomplete until its review information is recorded. |
| CON-06 | Recruitment permissions are granted through company-scoped memberships, and company data must remain isolated between tenants. | Backend authorization and testing must verify role, membership, company context, and resource ownership. |
| CON-07 | CVs, contact details, company documents, evaluation notes, and application records are sensitive data. | Secure storage, restricted access, validation, and privacy testing are required. |
| CON-08 | AI scoring is advisory and must not automatically reject, progress, or hire candidates. | Human override and final recruiter control must be preserved. |
| CON-09 | Job matching is rule-based; semantic AI processing is limited to CV-to-job scoring and explanations. | Job-recommendation tasks must not be described as semantic AI recommendations. |
| CON-10 | Supported CV formats are PDF and DOCX, with a maximum file size of 5 MB. | Upload, parsing, scanning, storage, and failure handling must follow these limits. |
| CON-11 | Core operations must continue when the AI service or email service is temporarily unavailable. | Fallback, retry, timeout, logging, and failure handling must be specified and tested. |
| CON-12 | P0 capabilities must be stabilized before P1 analytics and export capabilities. | P1 work may be deferred consistently with the Vision. The deferral must be recorded in the Project Plan, requirements traceability, and demonstration plan; the Vision Document requires revision only if the approved product scope or priority changes. |
| CON-13 | Spec Kit implementation must preserve its specifications, clarifications, implementation plan, task breakdown, analysis or checklist when used, and source code. | These artifacts are required as implementation evidence. |

### 2.5. Assumptions and Dependencies

The plan assumes that:

- Users have internet access and use a supported modern browser.
- Candidates provide CVs in supported PDF or DOCX formats.
- Recruiters provide accurate job information and valid company-verification documents.
- Administrators review company, membership, and job-posting requests.
- Reviewer assignments follow the Reviewer field recorded for each task in Section 4 where confirmed; the new Sprint 5 assignments require reviewer confirmation in Notion.
- Notion is updated whenever project scope, ownership, dates, or task status changes.

The project depends on:

- The team Notion task tracker.
- The Git repository.
- The Spec Kit workflow.
- A relational database.
- Secure file storage.
- An external email-delivery service.
- An external AI service.
- A PDF or DOCX file-parsing service.

The Vision Document is used as the product-scope baseline as instructed, but its metadata still identifies version 1.1 as a **Working Draft**, last updated 10-07-2026, with status **Draft for Team Review**. The later Weekly Reports record the Vision update task as completed but do not record a newer version number or formal approval. Final approval status therefore remains uncertain and should be confirmed rather than inferred.

### 2.6. Deliverables

The project deliverables and their planning status at the 09-08-2026 reporting cut-off are:

| ID | Deliverable | Related Tasks | Status at 09-08-2026 |
|---|---|---|---|
| DEL-01 | A responsive SmartHire web application and its source code. | S3-05, S4-02A–B, S4-03, S4-08A–B, S5-01–S5-07 | In progress. Authentication and the two PA4 functional-group increments were reported completed; remaining role, feature, integration, and stabilization work continues in Sprint 5. |
| DEL-02 | A revised and continuously maintained Project Plan that addresses previous feedback and remains consistent with the approved Notion task tracker and current assignment requirements. | S3-10, S4-15, S5-04 | Completed through PA4; the Sprint 5 reconciliation was assigned in the latest report. |
| DEL-03 | A revised Vision Document, with a high-level Product Overview and feature descriptions that include business rationale and primary beneficiaries. | S3-04 | The revision task is reported completed and the document is used as the scope baseline; its own metadata still labels it a Working Draft pending team review. |
| DEL-04 | One consolidated `Changes.md` file recording the material document and project changes introduced through PA4. | S3-04, S3-10, S3-12, S4-12 | Completed through PA4. |
| DEL-05 | Spec Kit and specification-driven development artifacts (`constitution.md`, generated Markdown artifacts, specifications, clarifications, implementation plans, task breakdowns, analysis/checklists, source code). | S2-01, S2-10, S3-05, S3-07, S4-02A–B, S4-03, S5-01–S5-03 | In progress; Sprint 5 specification work covers Vision Feature Group 5 and Feature Groups 7–12 as assigned in the latest report. |
| DEL-06 | Mermaid use-case models covering the functional requirements in the revised Vision Document. | S3-01, S3-06, S3-08, S3-09 | Completed during Sprint 3. |
| DEL-07 | Use-case specifications (IDs, actors, descriptions, preconditions, basic/alternative flows, postconditions). | S3-01, S3-06, S3-08, S3-09 | Completed for the Sprint 3 use-case package; further feature specifications continue in Sprint 5. |
| DEL-08 | Prototype evidence for the basic and alternative flows of the documented use cases. | S3-01, S3-06, S3-08, S3-09 | Completed during Sprint 3. |
| DEL-09 | One full-stack Authentication, Authorization, and Access Control functional group implemented through Spec Kit during Sprint 3. | S3-05, S3-07 | Completed and reported as the deployed Sprint 3 functional group. |
| DEL-10 | A final test package containing the Test Plan, reviewed and refined test cases, execution results, test summary, and linked bug reports. | S5-04–S5-07 | Preparation is assigned; the latest report does not yet record completion of the research, execution, or defect-reporting work. |
| DEL-11 | Weekly Reports, Scrum Meeting records, and Notion task-tracker screenshots. | S1-05, S2-05, S2-15, S3-11, S4-06, S5-12 | Completed through the 09-08 Sprint 5 report; final Sprint 5 reporting remains in progress. |
| DEL-12 | Individual AI Usage Reports recorded for the members assigned in each sprint. | S2-11A–E, S3-03A–E, S4-13A–E, S5-10 | Completed through PA4; final reporting remains planned. |
| DEL-13 | User, technical, and project documentation updated to reflect the final implemented system. | S5-04, S5-05, S5-10 | Architecture and project-plan updates are assigned; final synchronization remains planned. |
| DEL-14 | Markdown and PDF versions of the required project documents. | S2-16A–C, S2-17, S3-02, S4-09–S4-12, S4-15, S5-10, S5-11 | Completed for earlier stages; final versions remain planned. |
| DEL-15 | Git commit-history evidence and the final submission package. | S5-10, S5-11 | Planned. |
| DEL-16 | Build 1: full-stack Authentication, Authorization, and Access Control increment. | S3-05, S3-07 | Completed by the Sprint 3 exit and confirmed in the Sprint 4 report. |
| DEL-17 | PA4 system increment and architecture package, including two Spec Kit functional groups, system review and UI/UX improvements, C4 diagrams, technical documentation, change records, the updated Project Plan, AI Usage Reports, and demo evidence. | S4-01, S4-02A–B, S4-03–S4-06, S4-07A–B, S4-08A–B, S4-09–S4-15 | Completed by the start of Sprint 5. |
| DEL-18 | Final Build and demonstration materials. | S5-01–S5-11 | In progress; final stabilization and demonstration remain planned. |
| DEL-19 | A Reflective Report covering team experience, Spec Kit experience, AI-tool usage, SDLC feedback, and individual member reflections. | S5-09 | Planned; assignment after 15-08-2026 is not yet confirmed in the latest report. |

Deliverable ownership, reviewers, dates, and acceptance criteria are managed in the sprint task lists rather than assigned globally in this section. Unconfirmed Sprint 5 fields are explicitly marked as pending rather than inferred.

## 3. Project Organization

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

### 3.1. Team Structure and Roles

| Member | Primary Role | Main Responsibilities |
|---|---|---|
| Nguyễn Gia Quốc Uy | Project Manager and Lead Spec Writer | Planning, Vision consolidation, specification consistency, final document integration, and release coordination. |
| Nguyễn Quốc Thành | AI Integration Lead and Backend Developer | Authentication, AI-assisted scoring, notifications, external-service integration, and backend development. |
| Lưu Chí Hải | Lead UI/UX Designer and Frontend Developer | Candidate and recruiter interfaces, Project Plan maintenance, Weekly Reports, Notion evidence, and frontend integration. |
| Nguyễn Minh Khôi | Quality Assurance and Frontend Developer | Test planning, test execution, administrator interfaces, quality review, and defect tracking. |
| Ngô Quốc Tuấn | Database Architect and Backend Developer | Database schema, migrations, company and job-posting backend functions, data integrity, and backup support. |

The primary roles above remain the team baseline. For the initial Sprint 5 phase, the latest Weekly Report records a temporary work allocation: Uy leads landing-page/UI work and Feature Group 9 specifications; Thành leads messaging and administrator-related work; Tuấn leads recruiter/RBAC/scoring work; and Hải and Khôi prepare testing work and update their assigned architecture documentation. These sprint assignments supplement rather than permanently replace the primary roles.

### 3.2. Review and Responsibility Rules

- Every task has one accountable owner.
- Reviewers verify the expected output and acceptance criteria before a task is marked `Done`.
- Every project task must be created and tracked in Notion before work begins.
- Source code and document changes must follow the team Git workflow.
- Scope, requirement, schedule, priority, architecture, or technology changes must be recorded in `Changes.md`.
- Each member must record AI use on the date it occurs.
- The latest Sprint 5 report does not name reviewers for its newly assigned work. Reviewers and any task-level dates after 15-08-2026 remain to be confirmed in Notion before those tasks can satisfy the Definition of Done.

### 3.3. Risk Register

| ID | Risk | Probability | Impact | Owner | Mitigation | Contingency |
|---|---|---|---|---|---|---|
| R-01 | Cross-tenant data exposure | Medium | Critical | Nguyễn Quốc Thành | Verify authentication, platform role, active company membership, company context, and resource ownership on every protected backend request. Add negative authorization tests. | Block the affected release, disable the vulnerable path, inspect audit records, fix authorization, and repeat tenant-isolation tests. |
| R-02 | CV or personal-data leakage | Medium | Critical | Ngô Quốc Tuấn | Use HTTPS, secure file storage, restricted document access, sanitized file names, malware scanning, and privacy tests. | Revoke exposed access, remove affected test data, rotate credentials when necessary, and conduct a privacy review. |
| R-03 | AI bias or misleading score | Medium | High | Nguyễn Quốc Thành | Keep AI output advisory, display human-readable explanations, prevent automatic rejection, and allow recruiter override. | Disable the unreliable AI result and continue with deterministic matching and human review. |
| R-04 | CV parser failure | Medium | High | Ngô Quốc Tuấn | Preserve the original CV, expose parser status, validate format and size, support retry and timeout handling, and require candidate confirmation of parsed data. | Allow manual profile completion and retry parsing without deleting the original file. |
| R-05 | Email delivery failure | Medium | Medium | Nguyễn Quốc Thành | Separate recruitment transactions from email delivery, record failures, prevent duplicate delivery, and retry failed delivery at least three times with backoff. | Preserve in-app notifications and expose failed-delivery records for administrator troubleshooting. |
| R-06 | Database migration or data loss | Low–Medium | Critical | Ngô Quốc Tuấn | Use ACID transactions, referential integrity, regular backups, documented migrations, a tested rollback procedure, RTO ≤ 60 minutes, and RPO ≤ 24 hours. | Stop deployment, roll back the migration, restore the latest verified backup, and investigate before retrying. |
| R-07 | AI-service downtime or rate limits | Medium | High | Nguyễn Quốc Thành | Use asynchronous processing, visible scoring status, provider isolation, and rule-based fallback. | Temporarily disable semantic scoring while unrelated recruitment functions continue. |
| R-08 | Scope creep or unstable P0 capabilities | High | High | Nguyễn Gia Quốc Uy | Prioritize P0 capabilities and review P1 or newly proposed work against the final approved scope before committing it to a sprint. Chat Messaging requires this review because it appears in the Sprint 5 report but not in the Vision feature baseline. | Record any P1 schedule deferral in the Project Plan, requirements traceability, and demonstration plan. Reject an unapproved addition or formalize a true scope/priority change, updating the Vision Document and `Changes.md` when the approved baseline changes. |
| R-09 | Notion task-tracker inconsistency | Medium | High | Nguyễn Gia Quốc Uy | Review Notion, the Project Plan, and approved team decisions at the end of each sprint. | Resolve the discrepancy with the team, then update Notion, the Project Plan, and the Weekly Report using the same approved task information. |
| R-10 | Integration or regression failure | Medium | High | Nguyễn Minh Khôi | Require review, automated checks, integration checkpoints, and regression tests. | Revert the breaking change and restore the latest stable build. |
| R-11 | Project Plan or Weekly Report inconsistency | Medium | High | Lưu Chí Hải | Update the Project Plan and Weekly Report whenever approved task information changes and cross-check them against Notion before submission. | Resolve the discrepancy with the Project Manager and update all affected records consistently. |

## 4. Project Plan

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

The project follows Scrum and is divided into five sprints. Sprint dates, tasks, owners, reviewers, and acceptance criteria must be maintained consistently in this document and in Notion. The status below is based on the latest available Weekly Report, dated 09-08-2026; later Notion changes are not assumed.

### 4.1. Schedule Summary

| Sprint | Date Range | Main Objective | Exit Deliverable | Current Status |
|---|---|---|---|---|
| Sprint 1 — PA1 | 25-05-2026 to 07-06-2026 | Establish the team, tools, contract, proposal, and competitor survey. | PA1 project baseline | Completed; the 11-06 Sprint 2 report records the Sprint 1 outputs as completed. |
| Sprint 2 — PA2 | 09-06-2026 to 12-07-2026 | Create the Project Plan, Vision Document, Spec Kit initialization, and required reports. | PA2 documentation baseline | Completed; the 19-07 Sprint 3 report records the PA2 work as completed. |
| Sprint 3 — PA3 | 17-07-2026 to 26-07-2026 | Revise PA2 documents, define use cases and prototypes, and implement Authentication through Spec Kit. | Build 1 and PA3 package | Completed; the 29-07 Sprint 4 report records the assigned Sprint 3 outputs as completed. |
| Sprint 4 — PA4 | 27-07-2026 to 09-08-2026 | Implement two functional groups through Spec Kit, review and improve the system, and produce the required C4 architecture and PA4 submission artifacts. | PA4 system increment and architecture package | Completed; the 09-08 Sprint 5 report states that the remaining previous-stage tasks were completed. |
| Sprint 5 — PA5 | Began by 09-08-2026; final target 23-08-2026 | Complete remaining approved feature work, prepare and execute final testing, resolve defects, update documentation, rehearse the final product demo, write the Reflective Report, and consolidate the final submission package. | Tested final product, final demo, Reflective Report, and final submission package | In progress. Initial assignments are documented through 15-08; detailed assignments after that date remain unconfirmed. |

### 4.2. Sprint 1 Task List

**Status:** Completed. Completion is established by the Sprint 2 report dated 11-06-2026; the table retains the historical task baseline.

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S1-01 | Create the task tracker and GitHub project structure. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 30-05-2026 | 31-05-2026 | The task tracker is available to all members, and the GitHub repository structure is ready for project work. |
| S1-02 | Complete the Existing App Survey for LinkedIn. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The LinkedIn survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-03 | Complete the Existing App Survey for TopCV. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The TopCV survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-04 | Complete the Existing App Survey for VietnamWorks. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The VietnamWorks survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-05 | Write the Scrum meeting minutes. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The Scrum meeting minutes are completed using the required format and accurately record decisions, progress, and action items. |
| S1-06 | Complete the Team Contract and Project Proposal. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 01-06-2026 | 06-06-2026 | The Team Contract defines the team rules and responsibilities, and the Project Proposal clearly presents the product idea, users, scope, and objectives. |

### 4.3. Sprint 2 Task List

**Status:** Completed. Completion is established by the Sprint 3 report dated 19-07-2026; the table retains the historical task baseline.

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S2-01 | Set up and initialize Spec Kit. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 11-06-2026 | 17-06-2026 | The Spec Kit structure is initialized correctly and is ready for the team to create and manage specifications. |
| S2-02 | Complete the Vision Document: Introduction and Positioning. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The Introduction and Positioning sections clearly describe the product context, problem, target market, and product position. |
| S2-03 | Complete the Vision Document: Stakeholder and User Description. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The stakeholder and user descriptions identify the relevant groups, their needs, responsibilities, and expected benefits. |
| S2-04 | Complete the Vision Document: Product Overview. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The Product Overview summarizes the product perspective, capabilities, assumptions, dependencies, and operating environment. |
| S2-05 | Prepare the first PA2 meeting minutes and Project Plan. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The first PA2 meeting minutes and the Project Plan are completed using the required structure and contain the agreed scope, schedule, and responsibilities. |
| S2-06A | Study Spec Kit and maintain a learning log. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 11-06-2026 | 17-06-2026 | The learning log records the Spec Kit topics studied, examples practiced, findings, and remaining questions. |
| S2-06B | Study Spec Kit and maintain a learning log. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The learning log records the Spec Kit topics studied, examples practiced, findings, and remaining questions. |
| S2-06C | Study Spec Kit and maintain a learning log. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The learning log records the Spec Kit topics studied, examples practiced, findings, and remaining questions. |
| S2-06D | Study Spec Kit and maintain a learning log. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The learning log records the Spec Kit topics studied, examples practiced, findings, and remaining questions. |
| S2-06E | Study Spec Kit and maintain a learning log. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 11-06-2026 | 17-06-2026 | The learning log records the Spec Kit topics studied, examples practiced, findings, and remaining questions. |
| S2-07 | Refine the detailed briefs for the feature groups. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 18-06-2026 | 24-06-2026 | Each feature group has a clear brief describing its purpose, users, main functions, inputs, outputs, and expected value. |
| S2-08A | Review, comment on, and provide feedback for the feature groups. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 21-06-2026 | 23-06-2026 | Review comments are documented, conflicts or gaps are identified, and actionable improvements are proposed for each assigned feature group. |
| S2-08B | Review, comment on, and provide feedback for the feature groups. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 21-06-2026 | 23-06-2026 | Review comments are documented, conflicts or gaps are identified, and actionable improvements are proposed for each assigned feature group. |
| S2-08C | Review, comment on, and provide feedback for the feature groups. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 21-06-2026 | 23-06-2026 | Review comments are documented, conflicts or gaps are identified, and actionable improvements are proposed for each assigned feature group. |
| S2-09 | Translate the 12 Product Feature groups into English. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 25-06-2026 | 30-06-2026 | All 12 Product Feature group names and descriptions are translated accurately and use consistent English terminology. |
| S2-10 | Complete `constitution.md` and move it to the correct Spec Kit location. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 10-07-2026 | 11-07-2026 | The constitution is complete, reflects the team rules, and is stored in the correct Spec Kit directory. |
| S2-11A | Prepare the AI Usage Report according to the required format. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 25-06-2026 | 30-06-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S2-11B | Prepare the AI Usage Report according to the required format. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S2-11C | Prepare the AI Usage Report according to the required format. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S2-11D | Prepare the AI Usage Report according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S2-11E | Prepare the AI Usage Report according to the required format. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S2-12 | Create one Mermaid diagram describing an important workflow. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The Mermaid diagram correctly represents one important end-to-end workflow and is readable in the Markdown document. |
| S2-13 | Create one Mermaid diagram describing an important workflow. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The Mermaid diagram correctly represents one important end-to-end workflow and is readable in the Markdown document. |
| S2-14 | Complete the Vision Document: Non-Functional Requirements. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The Non-Functional Requirements are measurable and cover the required quality attributes, constraints, and operational expectations. |
| S2-15 | Complete the Weekly Report and meeting minutes according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The Weekly Report and meeting minutes contain the required planning, progress, issues, decisions, actions, and review information. |
| S2-16A | Convert the owner's assigned Spec Kit training or learning document to PDF. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The training document is converted to a readable PDF with correct headings, diagrams, formatting, and no missing content. |
| S2-16B | Convert the owner's assigned Spec Kit training or learning document to PDF. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The training document is converted to a readable PDF with correct headings, diagrams, formatting, and no missing content. |
| S2-16C | Convert the owner's assigned Spec Kit training or learning document to PDF. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 25-06-2026 | 30-06-2026 | The training document is converted to a readable PDF with correct headings, diagrams, formatting, and no missing content. |
| S2-17 | Convert and verify all required PA2 Markdown documents in PDF format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 30-06-2026 | 30-06-2026 | The Project Plan, Vision Document, Weekly Report, AI Usage Reports, and required Spec Kit documents are available as readable Markdown and rendered PDF files. |

### 4.4. Sprint 3 Task List

**Status:** Completed. The Sprint 4 report dated 29-07-2026 records the members' assigned Sprint 3 outputs as completed.

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S3-01 | Create Diagrams 1 and 2, complete the use-case specifications, and prepare draft prototypes for all use cases assigned to Diagrams 1 and 2. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 20-07-2026 | 23-07-2026 | The diagrams cover all assigned functional requirements; every use case has its ID, actors, preconditions, basic flow, alternative flows, postconditions, and prototype evidence. |
| S3-02 | Finalize the consolidation and standardize the project data. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 24-07-2026 | 25-07-2026 | Project documents and data are consolidated, duplicated or conflicting content is resolved, terminology is consistent, and all required PA3 documents are available in both Markdown and rendered PDF formats. |
| S3-03A | Prepare the AI Usage Report according to the required format. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 20-07-2026 | 25-07-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S3-03B | Prepare the AI Usage Report according to the required format. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 20-07-2026 | 25-07-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S3-03C | Prepare the AI Usage Report according to the required format. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 20-07-2026 | 25-07-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S3-03D | Prepare the AI Usage Report according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 20-07-2026 | 25-07-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S3-03E | Prepare the AI Usage Report according to the required format. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 20-07-2026 | 25-07-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S3-04 | Revise the Vision Document. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 20-07-2026 | 25-07-2026 | The Vision Document incorporates the PA2 feedback: the Product Overview is rewritten at a high level without implementation-specific details; all 12 feature entries include a business rationale and primary beneficiaries; and the feature table remains consistent with the approved scope and detailed feature descriptions. |
| S3-05 | Implement the Authentication, Authorization, and Access Control functional group using Spec Kit. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 20-07-2026 | 24-07-2026 | Registration, email verification, login, logout and session invalidation, password recovery and reset, JWT storage in HttpOnly, Secure, SameSite cookies, database persistence, UI, API and business logic, and the required Spec Kit artifacts are implemented and traceable to the approved requirements and tasks. |
| S3-06 | Create Diagram 3, complete the use-case specifications, and prepare draft prototypes for all use cases assigned to Diagram 3. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 20-07-2026 | 23-07-2026 | The diagram covers all assigned functional requirements; every use case has its ID, actors, preconditions, basic flow, alternative flows, postconditions, and prototype evidence. |
| S3-07 | Provide backup support for the Spec Kit task. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 20-07-2026 | 24-07-2026 | Assigned Spec Kit blockers are supported, resolved, or documented with clear follow-up actions before the due date. |
| S3-08 | Create Diagram 4, complete the use-case specifications, and prepare draft prototypes for all use cases assigned to Diagram 4. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 20-07-2026 | 23-07-2026 | The diagram covers all assigned functional requirements; every use case has its ID, actors, preconditions, basic flow, alternative flows, postconditions, and prototype evidence. |
| S3-09 | Create Diagram 5, complete the use-case specifications, and prepare draft prototypes for all use cases assigned to Diagram 5. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 20-07-2026 | 23-07-2026 | The diagram covers all assigned functional requirements; every use case has its ID, actors, preconditions, basic flow, alternative flows, postconditions, and prototype evidence. |
| S3-10 | Revise the Project Plan. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 20-07-2026 | 24-07-2026 | The Project Plan addresses all PA2 feedback and includes updated constraints, deliverables, risk management, reviewer assignments, specific dates, detailed Sprint 2–5 task lists, Vision alignment, and deliverable-to-task traceability. |
| S3-11 | Write the Weekly Report and capture screenshots of the Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 19-07-2026 | 24-07-2026 | The Weekly Report summarizes work completed during Sprint 2 and records the tasks currently in progress or planned for Sprint 3, including attendance, individual status reports, issues, decisions, action items, and the meeting summary; the screenshots clearly show the relevant Sprint 3 tasks, owners, dates, and statuses. |
| S3-12 | Update and consolidate `Changes.md` for the Project Plan and Vision Document. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 24-07-2026 | 25-07-2026 | A single `Changes.md` file contains separate Project Plan and Vision Document sections. Each material revision identifies the changed section, revision objective, change summary, reason, responsible owner, reviewer or reviewers, revision date, and revised location. |

### 4.5. Sprint 4 Task List

**Status:** Completed. The Sprint 5 report dated 09-08-2026 records the previous project-stage work as completed. The two implemented functional groups are not named in the weekly reports, so this plan does not infer their identities.

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S4-01 | Prepare Sprint Planning for PA4. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 28-07-2026 | 29-07-2026 | The Sprint 4 scope, assigned work, dates, and expected outputs are recorded and communicated to the team. |
| S4-02A | Lead the implementation of two functional groups using Spec Kit. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | The owner's assigned implementation work for the two functional groups follows the Spec Kit workflow, and the working code and corresponding Spec Kit artifacts are committed. |
| S4-02B | Lead the implementation of two functional groups using Spec Kit. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | The owner's assigned implementation work for the two functional groups follows the Spec Kit workflow, and the working code and corresponding Spec Kit artifacts are committed. |
| S4-03 | Support the development team for the two Spec Kit functional groups as UI Designer. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 30-07-2026 | 03-08-2026 | UI design and integration support is provided for both functional groups, and unresolved UI issues are documented for follow-up. |
| S4-04 | Set up and run the existing system and study its current architecture. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | The existing system runs in the local environment, setup steps are recorded, and the current architecture is summarized. |
| S4-05 | Divide frontend and backend responsibilities for the project. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 30-07-2026 | 30-07-2026 | Frontend and backend responsibilities are documented and communicated to the development team. |
| S4-06 | Set up and run the existing system, study its architecture, and write the Weekly Report. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | The existing system is run successfully, architecture notes are recorded, and the Weekly Report summarizes work completed during Sprint 3 and records the tasks currently in progress or planned for Sprint 4, including issues, decisions, action items, and current Notion evidence. |
| S4-07A | Research the C4 Model and the diagrams required for PA4. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | C4 Model conventions and the required PA4 diagram scope are documented, with the owner's diagram responsibilities identified. |
| S4-07B | Research the C4 Model and the diagrams required for PA4. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | C4 Model conventions and the required PA4 diagram scope are documented, with the owner's diagram responsibilities identified. |
| S4-08A | Check the system, fix bugs, and improve the UI/UX. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 04-08-2026 | 06-08-2026 | Assigned defects are fixed or documented, and the resulting UI/UX improvements are verified against the current build. |
| S4-08B | Check the system, fix bugs, and improve the UI/UX. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 04-08-2026 | 06-08-2026 | Assigned defects are fixed or documented, and the resulting UI/UX improvements are verified against the current build. |
| S4-09 | Complete the assigned Container, Backend, and Deployment diagrams. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 04-08-2026 | 06-08-2026 | The Container, Backend, and Deployment diagrams are completed, internally consistent, and render correctly. |
| S4-10 | Complete the assigned System Context and Frontend diagrams. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 04-08-2026 | 06-08-2026 | The System Context and Frontend diagrams are completed, internally consistent, and render correctly. |
| S4-11 | Write the Technology Stack section and review the five diagrams. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 04-08-2026 | 07-08-2026 | The Technology Stack section is complete, review comments for all five diagrams are recorded, and identified inconsistencies are resolved or assigned for correction. |
| S4-12 | Write `Changes.md` and review the complete PA4 submission. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 04-08-2026 | 07-08-2026 | `Changes.md` records the material PA4 changes, and the submission package is reviewed for completeness and internal consistency. |
| S4-13A | Prepare the AI Usage Report according to the required format. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 30-07-2026 | 07-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13B | Prepare the AI Usage Report according to the required format. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 30-07-2026 | 07-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13C | Prepare the AI Usage Report according to the required format. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 30-07-2026 | 07-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13D | Prepare the AI Usage Report according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 30-07-2026 | 07-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13E | Prepare the AI Usage Report according to the required format. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 30-07-2026 | 07-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-14 | Record and edit the PA4 demonstration video. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 04-08-2026 | 07-08-2026 | The edited video clearly demonstrates the implemented work and is ready to be included in the PA4 submission package. |
| S4-15 | Update the Project Plan. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 30-07-2026 | 03-08-2026 | The Project Plan is synchronized with the latest approved Sprint 4 task tracker, including task IDs, owners, dates, and acceptance criteria; the current task statuses are verified through Notion and the Weekly Report; the expected Sprint 5 plan is revised to align with the official PA5 requirements and is clearly identified as provisional until the team confirms its assignments; all affected deliverable references, schedule and build mappings, and Revision History entries are updated; and the required Markdown and rendered PDF versions are complete, readable, and internally consistent. |

### 4.6. Sprint 5 Task List

Sprint 5 is in progress. The Weekly Report dated 09-08-2026 confirms the current assignments through 15-08-2026 and states that later detailed assignments have not yet been finalized. Consequently, unconfirmed owners, reviewers, and task-level dates are recorded as `TBD` rather than inferred.

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
| -- | ------------------------ | ----- | -------- | ----- | --- | ------------------- |
| S5-01 | Build the landing home page, prepare Sprint 5 planning, improve and apply the UI design, and generate Spec Kit specifications for Feature Group 9, **Automated Notifications & In-App Alerts**. | Nguyễn Gia Quốc Uy | TBD | TBD | TBD | The landing page and planned UI improvements are implemented and verified; the Sprint 5 plan is documented; and the Feature Group 9 specification and required Spec Kit artifacts are complete and consistent with the Vision's P0 notification scope. |
| S5-02 | Build Chat Messaging; establish the base platform-administrator functionality; implement administrator review of recruiter/company access; and generate specifications for Feature Groups 10 and 11. | Nguyễn Quốc Thành | TBD | TBD | TBD | Base administrator functionality and the recruiter/company-access review workflow are implemented and verified, and the specifications for Feature Groups 10 and 11 are complete and consistent with the Vision. Chat Messaging is included only if its scope and traceability are formally approved; otherwise, it is explicitly deferred without displacing P0 work. |
| S5-03 | Establish recruiter/company-member functionality; enforce RBAC boundaries between company-scoped recruiter permissions and the separate platform-administrator role; build advisory scoring for recruiter and candidate views; and generate specifications for Feature Groups 5, 7, 8, and 12. | Ngô Quốc Tuấn | TBD | TBD | TBD | Recruiter/company-member functions enforce active membership, company scope, resource ownership, and the separate administrator boundary; scoring remains advisory and demonstrable for the intended views; and the assigned feature specifications and Spec Kit artifacts are complete. Feature Group 12 work does not delay unstable P0 capabilities. |
| S5-04 | Research the system Test Plan and test cases; write the Sprint 5 Weekly Report; update the Project Plan, System Context diagram, and Frontend Component diagram. | Lưu Chí Hải | TBD | TBD | TBD | Test-planning research documents the required objectives, scope, environment, tools, coverage, and test-case approach; the Weekly Report contains the required meeting and task-tracker evidence; and the Project Plan and assigned diagrams are complete and consistent with the implemented system. |
| S5-05 | Research the system Test Plan and test cases, review the testing requirements for completed features, and update the Container, Backend, and Deployment diagrams. | Nguyễn Minh Khôi | TBD | TBD | TBD | The test research and review identify the required coverage and acceptance needs for completed features, and the Container, Backend, and Deployment diagrams are updated, internally consistent, and aligned with the final architecture. |
| S5-06 | Complete the final Test Plan and reviewed functional test cases; execute the tests; record results; and prepare the Bug Report and test summary. | TBD | TBD | 10-08-2026 | 20-08-2026 | At least five use cases are covered by at least ten test cases each (at least 50 total); each execution records its date and result; failed cases link to reproducible bug reports; and the summary reports passed and failed totals by feature. Relevant coverage includes authorization, tenant isolation, personal-data protection, advisory AI, parsing, notification/email failure, timeout, retry, and external-service failure. |
| S5-07 | Assign and fix critical defects, rerun affected tests, integrate the remaining approved features, and stabilize the final build. | TBD | TBD | 17-08-2026 | 22-08-2026 | Release-blocking defects are resolved, affected tests are rerun, remaining known issues are documented, and every retained feature is integrated and demonstrable in a stable build. |
| S5-08 | Prepare and rehearse the final product demonstration. | TBD | TBD | 18-08-2026 | 23-08-2026 | The approximately 15-minute demonstration presents the product, two or three complete workflows, the technology stack, C4 diagrams, and Spec Kit, with a speaking role for every member. |
| S5-09 | Write the Reflective Report. | TBD | TBD | 17-08-2026 | 22-08-2026 | The report covers team and Spec Kit experience, AI-tool use, constructive SDLC feedback, and a three-to-five-sentence reflection from every member. |
| S5-10 | Synchronize PA1–PA5 and technical documentation with the final product; complete individual AI Usage Reports; and prepare Git commit-history evidence. | TBD | TBD | 10-08-2026 | 22-08-2026 | Terminology, scope, architecture, traceability, and implementation status agree across the final documents; required Markdown and PDF outputs render correctly; every member's AI use is recorded; and Git evidence is readable. |
| S5-11 | Consolidate and verify the final submission package. | TBD | TBD | 21-08-2026 | 23-08-2026 | The package contains the approved source code and Spec Kit artifacts, final test package, Reflective Report, AI Usage Reports, updated documents, Git evidence, and demonstration materials, using the required `PA5-Group09.zip` name. |
| S5-12 | Maintain the Sprint 5 Weekly Report and current Notion task-tracker evidence throughout the sprint. | Lưu Chí Hải | TBD | 10-08-2026 | 23-08-2026 | The report summarizes completed Sprint 4 work and Sprint 5 work, attendance, individual updates, issues, decisions, and action items; current Notion evidence is included; and later changes are recorded chronologically. |

### 4.7. Build Plan

| Build | Target Date | Included Scope | Exit Criteria | Status at 09-08-2026 |
|---|---|---|---|---|
| PA2 Documentation Baseline | 12-07-2026 | Project Plan, Vision Document, Spec Kit initialization, workflows, NFRs, Weekly Report, and AI Usage Reports. | Required documents and evidence are complete and consistent with Notion. | Completed; confirmed by the Sprint 3 report. |
| Build 1 | 26-07-2026 | Revised Vision and Project Plan, use-case models, specifications, prototypes, and full-stack Authentication implementation. | PA3 deliverables are reviewed and Authentication is demonstrable. | Completed; confirmed by the Sprint 4 report. |
| Build 2 | 09-08-2026 | Two functional groups implemented through Spec Kit, system setup and architecture review, frontend/backend work allocation, bug fixing and UI/UX improvements, five C4 diagrams, Technology Stack documentation, `Changes.md`, the updated Project Plan, AI Usage Reports, and a demonstration video. | The assigned functional-group work is demonstrable; the required diagrams, Project Plan, and supporting documents are complete and internally consistent; unresolved issues are documented; and the PA4 demo and submission evidence are ready. | Completed; the Sprint 5 report records the previous-stage work as complete. The reports do not identify the two functional groups by name. |
| Final Build | 23-08-2026 | Remaining approved functional groups, final Test Plan, at least 50 reviewed functional test cases covering at least five use cases, test execution results, linked bug reports, defect resolution, final product demonstration, Reflective Report, updated PA1–PA5 documents, AI Usage Reports, Git evidence, and the final submission package. | All P0 functional groups retained in the approved scope are implemented and stable; any delivered P1 work has not displaced P0 completion; all test cases have documented results; failed cases are linked to bug reports; release-blocking defects are resolved; the final demo includes every member; and all required submission materials are complete. | In progress. Current assignments are defined through 15-08; final-stage ownership remains to be confirmed. |

### 4.8. Definition of Done

A task is considered complete only when:

1. It is recorded and updated in Notion.
2. Its expected output is committed to the agreed Git repository structure.
3. Its acceptance criteria are satisfied.
4. The assigned reviewer or reviewers approve it.
5. Required test, prototype, meeting, or report evidence is recorded.
6. Related documents and traceability references are updated.
7. Required Markdown and PDF outputs render correctly.
8. Material scope, schedule, requirement, priority, or technology changes are recorded in `Changes.md`.

## 5. Alignment with the Revised Vision

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

| Revised Vision Decision | Project Plan Response |
|---|---|
| SmartHire targets Vietnamese SMEs. | The Introduction and project goals use the same target-product context. |
| Product Overview must remain high-level. | S3-04 revised the Vision Document Product Overview to retain the product purpose, target users, high-level capabilities, product boundaries, assumptions, and dependencies. |
| Every feature must include business rationale and beneficiaries. | S3-04 added a business rationale and primary beneficiaries to all 12 feature entries and aligned them with the detailed feature descriptions. |
| AI-generated job descriptions are removed. | No sprint task or build includes AI job-description generation. |
| AI resume rewriting is removed. | CV work is limited to upload, parsing, confirmation, reuse, and scoring input. |
| The recruitment pipeline uses nine canonical stages. | Pipeline backend, Kanban, application tracking, specifications, and tests use the same stages. |
| A base user retains candidate identity and receives company-scoped permissions through memberships. | Authentication and authorization tasks use the membership model rather than a separate recruiter account. |
| Authentication tokens use HttpOnly, Secure, SameSite cookies. | Sprint 3 delivered the Authentication functional group; S5-06 and S5-07 retain security testing and stabilization in the final work. |
| Recruiter access is company-scoped while platform administrators hold a separate role. | S5-02 and S5-03 implement the administrator and recruiter foundations under this boundary. The Weekly Report phrase “RBAC mechanism from Recruiter to Admin” is treated as role-boundary enforcement, not recruiter-to-administrator promotion. |
| Job matching is rule-based. | Semantic AI work is limited to CV scoring and explanations. |
| AI scoring is advisory. | Constraints, risks, scoring tasks, and tests preserve recruiter override and prevent automated decisions. |
| Analytics and export are P1. | Feature Group 12 specification work is assigned in S5-03, but implementation remains subordinate to stabilizing P0 capabilities and may be deferred consistently with the Vision. |
| Notifications and in-app alerts are P0. | S5-01 assigns Feature Group 9 specification and UI-related work; implementation, integration, and testing remain Sprint 5 work and are not marked complete. |
| Chat Messaging is not in the Vision feature baseline. | S5-02 records the Weekly Report assignment but treats it as pending scope clarification. It is not added to the approved release scope without corresponding Vision and traceability updates. |
| Personal data and CVs require protection. | Constraints and risk mitigations define the protection requirements, while S5-06 and S5-07 retain security-related test coverage, execution, defect reporting, correction, and regression verification. |
| AI, email, parser, and database failures must be handled. | S5-06 includes relevant failure test cases, execution, and defect records; S5-07 fixes release-blocking failures and reruns the affected tests. |

## 6. PA2 Feedback Traceability

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

| PA2 Feedback | Location Addressed |
|---|---|
| Sprint 2 lacked reviewers. | Section 4.3 records an explicit reviewer for every Sprint 2 task. |
| Sprint 2 task assignments were not detailed enough. | Section 4.3 includes expected outputs, owners, reviewers, dates, and acceptance criteria. |
| Sprints 3–5 lacked task lists. | Sections 4.4 and 4.5 retain the completed task baselines; Section 4.6 consolidates confirmed and remaining Sprint 5 work in one standard task table, with unsupported fields marked `TBD`. |
| The schedule lacked specific dates. | Section 4.1 provides sprint ranges and milestone targets. Sections 4.2–4.5 retain historical task dates, while Section 4.6 explicitly marks unsupported Sprint 5 task-level dates as pending. |
| Project Overview lacked constraints. | Section 2.4 defines project, review, authorization, data, AI, file, service, priority, and Spec Kit constraints. |
| Deliverables were incomplete. | Section 2.6 includes software, documents, specifications, prototypes, tests, reports, guides, evidence, builds, and demo materials. |
| The risk register needed six additional risks. | Section 3.3 includes all six requested risks with mitigations and contingencies. |
| The Project Plan did not reflect important Vision changes. | Section 5 maps Vision decisions to project scope, constraints, tasks, risks, and tests. |
| Feature descriptions needed business rationale and beneficiaries. | S3-04 added a business rationale and primary beneficiaries to all 12 feature entries and checked them against the detailed descriptions and approved scope. |
| Product Overview was too detailed. | S3-04 rewrote the Vision Document Product Overview at a high level and removed implementation-specific detail. |

## 7. Revision History

| Date | Section | Change Introduced | Reason |
|---|---|---|---|
| 25-07-2026 | Project Overview | Added complete constraints, scope boundaries, assumptions, dependencies, and deliverables. | Address PA2 feedback and align with the revised Vision. |
| 25-07-2026 | Reviewer Assignments | Added explicit reviewer assignments to Sprint 2 and Sprint 3 tasks. | Address the PA2 feedback that Sprint 2 tasks lacked reviewers. |
| 25-07-2026 | Schedule | Added planning date ranges for all five sprints and task-level dates. | Address the missing-date feedback. |
| 25-07-2026 | Sprint Task Lists | Added detailed Sprint 2–5 tasks with outputs and acceptance criteria. | Address incomplete Sprint 2 tasks and missing Sprint 3–5 lists. |
| 25-07-2026 | Deliverables | Expanded software, documentation, testing, evidence, build, and guide deliverables. | Address incomplete deliverables. |
| 25-07-2026 | Risk Register | Added the requested risks with mitigations and contingencies. | Address the PA2 risk feedback. |
| 25-07-2026 | Vision Alignment | Added scope, authorization, AI, pipeline, security, and priority mappings. | Reflect confirmed changes in the revised Vision Document. |
| 25-07-2026 | Deliverable Traceability | Corrected task references for `Changes.md`, AI Usage Reports, Markdown/PDF outputs, and software builds. | Keep deliverable mappings consistent with the revised task IDs. |
| 25-07-2026 | Acceptance Criteria | Corrected the criteria for the Vision revision, Spec Kit implementation, document consolidation, and Sprint 3–5 reporting evidence. | Remove inconsistencies introduced by recent task updates. |
| 25-07-2026 | Vision Feedback Traceability | Corrected the mapping of the Vision Product Overview and feature-description feedback to S3-04. | Ensure each PA2 Vision comment points to the actual Vision-revision task. |
| 02-08-2026 | Sprint 4 Planning | Replaced the previous expected Sprint 4 feature backlog with the current Notion-assigned tasks, owners, dates, and statuses, and updated the related deliverable and Build 2 mappings. | Synchronize the Project Plan with the actual PA4 task tracker. |
| 03-08-2026 | Project Plan Maintenance | Added S4-15 for updating the Project Plan, synchronized the Sprint 4 planning information with the latest approved task tracker, revised the provisional Sprint 5 baseline using the official PA5 requirements, and updated the related deliverable and Build Plan references. | Keep the Project Plan current, traceable, and consistent with the PA4 task tracker and official PA5 assignment. |
| 03-08-2026 | Sprint 5 Planning | Replaced the previous provisional Sprint 5 implementation and testing backlog with a planning baseline aligned to the official PA5 requirements; added explicit Test Plan, test-case refinement, test execution, Bug Report, final demo, Reflective Report, document-update, AI-report, Weekly Report, and final-package tasks; and updated all related deliverable, schedule, Build Plan, and Vision-alignment references. | Align the Project Plan with the official PA5 assignment and preserve task traceability. |
| 14-08-2026 | Progress and Milestone Status | Marked Sprints 1–4 and their builds as completed based on the next chronological Weekly Report, and marked Sprint 5 and the Final Build as in progress. | Distinguish completed work from current and future work using the latest documented status. |
| 14-08-2026 | Sprint 5 Planning | Replaced unsupported provisional owner assignments with the actual 09-08 work allocation, consolidated all S5-01–S5-12 work in the standard sprint task table, marked unconfirmed fields `TBD`, and retained the 23-08 final milestone. | Reconcile the plan with the latest Weekly Report, which states that detailed assignments after 15-08 were not yet finalized, while keeping the task format consistent across all sprints. |
| 14-08-2026 | Scope and Authorization Alignment | Flagged Chat Messaging as pending scope confirmation; clarified the Sprint 5 RBAC boundary; aligned P1 deferral rules with the Vision; and recorded the Vision file's unresolved draft metadata. | Prevent unsupported scope, role, priority, or document-approval assumptions from silently changing the planning baseline. |
