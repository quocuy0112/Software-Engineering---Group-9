# Project Plan: SmartHire Recruitment System

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

> **Planning Baseline:** Sprint 2 and Sprint 3 information is based on the team's internal PA planning files and current task assignments. Exact Sprint 1, Sprint 4, and Sprint 5 dates and detailed assignments are team planning baselines created to address the PA2 feedback. They must remain synchronized with the team's Notion task tracker.

## 1. Introduction

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

SmartHire is an AI-assisted applicant tracking system designed to support recruitment workflows for small and medium-sized enterprises in Vietnam. It centralizes candidate profiles and CVs, job postings, applications, recruitment pipelines, notifications, moderation, and candidate screening in a responsive web application.

The platform serves candidates, company members involved in recruitment, and platform administrators. AI-assisted scoring provides decision-support information and explanations, while authorized recruiters remain responsible for all recruitment decisions.

## 2. Project Overview

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

### 2.1. Goals

The project aims to:

- provide a centralized recruitment workflow for candidates, company members, and platform administrators;
- reduce fragmented recruitment work performed through disconnected emails and spreadsheets;
- provide candidates with job discovery, application submission, application tracking, and notifications;
- provide authorized company members with job-posting, applicant-review, candidate-scoring, and pipeline-management capabilities;
- provide administrators with employer verification, job moderation, user management, and audit capabilities;
- preserve human control over all candidate-progression and hiring decisions;
- maintain traceability among the Vision Document, functional requirements, use cases, implementation tasks, and tests; and
- deliver the required documents, software builds, reports, and evidence within the project schedule.

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

- AI-generated job descriptions;
- AI resume rewriting or resume enhancement;
- fully automated candidate rejection, progression, or hiring;
- semantic AI job recommendations;
- external calendar synchronization;
- payroll;
- employee onboarding; or
- a complete human-resource management suite.

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
| CON-12 | P0 capabilities must be stabilized before P1 analytics and export capabilities. | P1 work may be deferred if P0 acceptance criteria are not satisfied. |
| CON-13 | Spec Kit implementation must preserve its specifications, clarifications, implementation plan, task breakdown, analysis or checklist when used, and source code. | These artifacts are required as implementation evidence. |

### 2.5. Assumptions and Dependencies

The plan assumes that:

- Users have internet access and use a supported modern browser.
- Candidates provide CVs in supported PDF or DOCX formats.
- Recruiters provide accurate job information and valid company-verification documents.
- Administrators review company, membership, and job-posting requests.
- Reviewer assignments follow the Reviewer field recorded for each task in Section 4.
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

### 2.6. Deliverables

The project will produce the following deliverables:

| ID | Deliverable | Related Tasks |
|---|---|---|
| DEL-01 | A responsive SmartHire web application and its source code. | S3-05, S4-01–S4-09, S5-01–S5-03, S5-06, S5-09 |
| DEL-02 | A revised Project Plan that addresses PA2 feedback and remains consistent with Notion. | S3-10 |
| DEL-03 | A revised Vision Document, with a high-level Product Overview and feature descriptions that include business rationale and primary beneficiaries. | S3-04 |
| DEL-04 | One consolidated `changes.md` file containing separate records for Project Plan and Vision Document revisions. | S3-04, S3-10, S3-12 |
| DEL-05 | Spec Kit and specification-driven development artifacts (`constitution.md`, generated Markdown artifacts, specifications, clarifications, implementation plans, task breakdowns, analysis/checklists, source code). | S2-01, S2-10, S3-05, S3-07 |
| DEL-06 | Mermaid use-case models covering the functional requirements in the revised Vision Document. | S3-01, S3-06, S3-08, S3-09 |
| DEL-07 | Use-case specifications (IDs, actors, descriptions, preconditions, basic/alternative flows, postconditions). | S3-01, S3-06, S3-08, S3-09 |
| DEL-08 | Prototype evidence for the basic and alternative flows of the documented use cases. | S3-01, S3-06, S3-08, S3-09 |
| DEL-09 | One full-stack Authentication, Authorization, and Access Control functional group implemented through Spec Kit during Sprint 3. | S3-05, S3-07 |
| DEL-10 | A test plan, test cases, test results, and defect records for the implemented system. | S4-10, S5-04, S5-05, S5-07 |
| DEL-11 | Weekly Reports, Scrum Meeting records, and Notion task-tracker screenshots. | S1-05, S2-05, S2-15, S3-11, S4-12, S5-11 |
| DEL-12 | Individual AI Usage Reports for all team members. | S2-11A–E, S3-03A–E, S4-13A–E, S5-12A–E |
| DEL-13 | User and technical documentation (User Manual, Recruiter User Guide, Administrator Guide, Installation Guide, Deployment Guide, API Documentation, Database Schema Documentation, System Architecture Documentation). | S5-08 |
| DEL-14 | Markdown and PDF versions of the required project documents. | S2-16A–C, S2-17, S3-02, S4-11, S5-10 |
| DEL-15 | Git commit-history evidence and the final submission package. | S5-10 |
| DEL-16 | Build 1: full-stack Authentication, Authorization, and Access Control increment. | S3-05, S3-07 |
| DEL-17 | Build 2: integrated candidate and recruiter recruitment workflows. | S4-01–S4-11 |
| DEL-18 | Final Build and demonstration materials. | S5-01–S5-10 |

Deliverable ownership, reviewers, dates, and acceptance criteria are managed in the sprint task lists rather than assigned globally in this section.

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

### 3.2. Review and Responsibility Rules

- Every task has one accountable owner.
- Reviewers verify the expected output and acceptance criteria before a task is marked `Done`.
- Every project task must be created and tracked in Notion before work begins.
- Source code and document changes must follow the team Git workflow.
- Scope, requirement, schedule, priority, architecture, or technology changes must be recorded in `changes.md`.
- Each member must record AI use on the date it occurs.

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
| R-08 | Scope creep or unstable P0 capabilities | High | High | Nguyễn Gia Quốc Uy | Prioritize P0 capabilities and defer P1 analytics and export until the core workflow is stable. | Remove P1 work from the active sprint and record the decision in `changes.md`. |
| R-09 | Notion task-tracker inconsistency | Medium | High | Nguyễn Gia Quốc Uy | Review Notion, the Project Plan, and approved team decisions at the end of each sprint. | Resolve the discrepancy with the team, then update Notion, the Project Plan, and the Weekly Report using the same approved task information. |
| R-10 | Integration or regression failure | Medium | High | Nguyễn Minh Khôi | Require review, automated checks, integration checkpoints, and regression tests. | Revert the breaking change and restore the latest stable build. |
| R-11 | Project Plan or Weekly Report inconsistency | Medium | High | Lưu Chí Hải | Update the Project Plan and Weekly Report whenever approved task information changes and cross-check them against Notion before submission. | Resolve the discrepancy with the Project Manager and update all affected records consistently. |

## 4. Project Plan

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

The project follows Scrum and is divided into five sprints. Sprint dates, tasks, owners, reviewers, and statuses must be maintained consistently in this document and in Notion.

### 4.1. Schedule Summary

| Sprint | Date Range | Main Objective | Exit Deliverable |
|---|---|---|---|
| Sprint 1 — PA1 | 25-05-2026 to 07-06-2026 | Establish the team, tools, contract, proposal, and competitor survey. | PA1 project baseline |
| Sprint 2 — PA2 | 09-06-2026 to 12-07-2026 | Create the Project Plan, Vision Document, Spec Kit initialization, and required reports. | PA2 documentation baseline |
| Sprint 3 — PA3 | 17-07-2026 to 26-07-2026 | Revise PA2 documents, define use cases and prototypes, and implement Authentication through Spec Kit. | Build 1 and PA3 package |
| Sprint 4 — PA4 | 27-07-2026 to 09-08-2026 | Implement and integrate the main candidate and recruiter recruitment workflows. | Build 2 |
| Sprint 5 — PA5 | 10-08-2026 to 23-08-2026 | Complete administration, hardening, testing, documentation, final integration, and demonstration. | Final Build |

### 4.2. Sprint 1 Task List

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S1-01 | Create the task tracker and GitHub project structure. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 30-05-2026 | 31-05-2026 | The task tracker is available to all members, and the GitHub repository structure is ready for project work. |
| S1-02 | Complete the Existing App Survey for LinkedIn. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The LinkedIn survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-03 | Complete the Existing App Survey for TopCV. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The TopCV survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-04 | Complete the Existing App Survey for VietnamWorks. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The VietnamWorks survey documents key features, interface patterns, strengths, weaknesses, and reusable ideas. |
| S1-05 | Write the Scrum meeting minutes. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 01-06-2026 | 03-06-2026 | The Scrum meeting minutes are completed using the required format and accurately record decisions, progress, and action items. |
| S1-06 | Complete the Team Contract and Project Proposal. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 01-06-2026 | 06-06-2026 | The Team Contract defines the team rules and responsibilities, and the Project Proposal clearly presents the product idea, users, scope, and objectives. |

### 4.3. Sprint 2 Task List

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
| S3-11 | Write the Weekly Report and capture screenshots of the Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 20-07-2026 | 24-07-2026 | The Weekly Report records the Scrum Meeting attendance, individual status reports, completed and remaining tasks, issues, decisions, action items, and meeting summary; the screenshots clearly show the relevant Sprint 3 tasks, owners, dates, and statuses. |
| S3-12 | Update and consolidate `changes.md` for the Project Plan and Vision Document. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 24-07-2026 | 25-07-2026 | A single `changes.md` file contains separate Project Plan and Vision Document sections. Each material revision identifies the changed section, revision objective, change summary, reason, responsible owner, reviewer or reviewers, revision date, and revised location. |
### 4.5. Expected Sprint 4 Task List

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S4-01 | Finalize the relational database schema and migrations. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 27-07-2026 | 31-07-2026 | Schema and migrations support users, companies, memberships, jobs, applications, stages, files, notifications, scores, and audit records. |
| S4-02 | Implement candidate profile, CV upload, parser status, and parsed-data confirmation backend functions. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 29-07-2026 | 03-08-2026 | Supported files are validated, stored securely, preserved on failure, and available for candidate confirmation. |
| S4-03 | Implement the candidate portal. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 27-07-2026 | 04-08-2026 | Candidates can manage profiles and CVs, discover jobs, apply, and track applications. |
| S4-04 | Implement company-scoped job-posting management backend functions. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 31-07-2026 | 05-08-2026 | Authorized company members can manage only their company's postings. |
| S4-05 | Implement recruiter job-posting and applicant-review interfaces. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 01-08-2026 | 07-08-2026 | Recruiters can manage postings and review permitted applicant data. |
| S4-06 | Implement backend pipeline transitions and stage history using the nine canonical stages. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 02-08-2026 | 07-08-2026 | Transitions are transactional, audited, and restricted to the active company context. |
| S4-07 | Implement the recruitment pipeline Kanban interface. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 03-08-2026 | 08-08-2026 | Authorized users can view and update stages with clear success and failure states. |
| S4-08 | Implement hybrid candidate scoring and rule-based fallback. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 28-07-2026 | 07-08-2026 | Scoring status is separate from pipeline status, explanations are displayed, and AI never changes recruitment decisions automatically. |
| S4-09 | Implement email and in-app notifications. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 01-08-2026 | 08-08-2026 | Recruitment actions complete independently of email delivery; failures are logged and retried. |
| S4-10 | Execute Build 2 functional, integration, authorization, and regression tests. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 03-08-2026 | 09-08-2026 | The test plan and test cases are documented before execution; test results and identified defects are recorded; and the core candidate and recruiter workflows pass with no unresolved critical security or data-integrity defect. |
| S4-11 | Consolidate Build 2 documentation and conduct the Sprint Review. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 08-08-2026 | 09-08-2026 | Scope, evidence, known defects, deferred work, and Sprint Review decisions are recorded consistently, and all required Sprint 4 documents are available in both Markdown and rendered PDF formats. |
| S4-12 | Write the Weekly Report and capture screenshots of the Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 27-07-2026 | 09-08-2026 | The Weekly Report includes Sprint Planning, Scrum Meeting evidence, Sprint Review evidence, progress, issues, decisions, and action items; the screenshots clearly show the relevant Sprint 4 tasks, owners, dates, and statuses. |
| S4-13A | Prepare the AI Usage Report according to the required format. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 27-07-2026 | 09-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13B | Prepare the AI Usage Report according to the required format. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 27-07-2026 | 09-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13C | Prepare the AI Usage Report according to the required format. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 27-07-2026 | 09-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13D | Prepare the AI Usage Report according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 27-07-2026 | 09-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S4-13E | Prepare the AI Usage Report according to the required format. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 27-07-2026 | 09-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |

### 4.6. Expected Sprint 5 Task List

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S5-01 | Implement company verification, membership approval, role management, and membership lifecycle backend functions. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 10-08-2026 | 15-08-2026 | Company access requires the approved membership workflow and all changes are audited. |
| S5-02 | Implement administrator verification, moderation, user-management, and enforcement interfaces. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 10-08-2026 | 16-08-2026 | Administrators can perform permitted actions with recorded decisions and reasons. |
| S5-03 | Harden authentication sessions, secure-cookie handling, and company-scoped authorization. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 10-08-2026 | 16-08-2026 | Protected requests verify authentication, platform role, membership, company scope, and ownership. |
| S5-04 | Execute cross-tenant, CV-access, privacy, authentication, and authorization tests. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 14-08-2026 | 19-08-2026 | Negative tests confirm that unauthorized requests do not expose protected data. |
| S5-05 | Execute AI, parser, email, database, retry, timeout, and recovery tests. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 15-08-2026 | 20-08-2026 | Core operations remain usable and stored data remains consistent during failures. |
| S5-06 | Implement P1 recruitment analytics and authorized export after P0 readiness approval. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 16-08-2026 | 20-08-2026 | The feature is delivered only if P0 is stable and exported data respects authorization. |
| S5-07 | Execute performance, compatibility, accessibility, usability, regression, and end-to-end tests. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 17-08-2026 | 22-08-2026 | Test evidence covers measurable Vision targets and all P0 workflows. |
| S5-08 | Prepare user and technical documentation. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 12-08-2026 | 22-08-2026 | Manuals, guides, API, database, deployment, and architecture documents match the released system. |
| S5-09 | Integrate final frontend and backend changes and resolve release-blocking defects. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 18-08-2026 | 22-08-2026 | The final build is reproducible and contains no unresolved critical defect. |
| S5-10 | Consolidate the final submission and demonstration package. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 21-08-2026 | 23-08-2026 | Source code, documents, PDFs, tests, reports, Git evidence, `changes.md`, and demo materials are complete. |
| S5-11 | Write the Weekly Report and capture screenshots of the Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The Weekly Report includes Sprint Planning, Scrum Meeting evidence, Sprint Review and retrospective evidence, progress, issues, decisions, and action items; the screenshots clearly show the relevant Sprint 5 tasks, owners, dates, and statuses. |
| S5-12A | Prepare the AI Usage Report according to the required format. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 10-08-2026 | 23-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S5-12B | Prepare the AI Usage Report according to the required format. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S5-12C | Prepare the AI Usage Report according to the required format. | Ngô Quốc Tuấn | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S5-12D | Prepare the AI Usage Report according to the required format. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |
| S5-12E | Prepare the AI Usage Report according to the required format. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The report records the AI tool, version, usage date, prompts, purpose, generated content, verification, and individual contribution. |

### 4.7. Build Plan

| Build | Target Date | Included Scope | Exit Criteria |
|---|---|---|---|
| PA2 Documentation Baseline | 12-07-2026 | Project Plan, Vision Document, Spec Kit initialization, workflows, NFRs, Weekly Report, and AI Usage Reports. | Required documents and evidence are complete and consistent with Notion. |
| Build 1 | 26-07-2026 | Revised Vision and Project Plan, use-case models, specifications, prototypes, and full-stack Authentication implementation. | PA3 deliverables are reviewed and Authentication is demonstrable. |
| Build 2 | 09-08-2026 | Candidate portal, recruiter job management, CV handling, application tracking, nine-stage pipeline, hybrid scoring, and notifications. | Main candidate and recruiter workflows are integrated with no critical access-control or data-integrity defect. |
| Final Build | 23-08-2026 | Administration, company membership, moderation, security hardening, failure handling, approved P1 scope, testing, documentation, and demo package. | All P0 acceptance tests pass, release-blocking defects are resolved, and submission materials are complete. |

### 4.8. Definition of Done

A task is considered complete only when:

1. It is recorded and updated in Notion.
2. Its expected output is committed to the agreed Git repository structure.
3. Its acceptance criteria are satisfied.
4. The assigned reviewer or reviewers approve it.
5. Required test, prototype, meeting, or report evidence is recorded.
6. Related documents and traceability references are updated.
7. Required Markdown and PDF outputs render correctly.
8. Material scope, schedule, requirement, priority, or technology changes are recorded in `changes.md`.

## 5. Alignment with the Revised Vision

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

| Revised Vision Decision | Project Plan Response |
|---|---|
| SmartHire targets Vietnamese SMEs. | The Introduction and project goals use the same target-product context. |
| Product Overview must remain high-level. | S3-04 revises the Vision Document Product Overview to remove implementation-specific details and retain only the product purpose, target users, high-level capabilities, product boundaries, assumptions, and dependencies. |
| Every feature must include business rationale and beneficiaries. | S3-04 requires all 12 feature entries to include a business rationale and primary beneficiaries and to remain consistent with the detailed feature descriptions and approved scope. |
| AI-generated job descriptions are removed. | No sprint task or build includes AI job-description generation. |
| AI resume rewriting is removed. | CV work is limited to upload, parsing, confirmation, reuse, and scoring input. |
| The recruitment pipeline uses nine canonical stages. | Pipeline backend, Kanban, application tracking, specifications, and tests use the same stages. |
| A base user retains candidate identity and receives company-scoped permissions through memberships. | Authentication and authorization tasks use the membership model rather than a separate recruiter account. |
| Authentication tokens use HttpOnly, Secure, SameSite cookies. | Sprint 3 Authentication and Sprint 5 hardening tasks require secure-cookie handling. |
| Job matching is rule-based. | Semantic AI work is limited to CV scoring and explanations. |
| AI scoring is advisory. | Constraints, risks, scoring tasks, and tests preserve recruiter override and prevent automated decisions. |
| Analytics and export are P1. | Sprint 5 schedules them only after P0 readiness approval and permits deferral. |
| Personal data and CVs require protection. | Constraints, risk mitigations, file-handling tasks, and security tests address protection. |
| AI, email, parser, and database failures must be handled. | Sprint 4 and Sprint 5 include fallback, retry, timeout, logging, and recovery work. |

## 6. PA2 Feedback Traceability

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

| PA2 Feedback | Location Addressed |
|---|---|
| Sprint 2 lacked reviewers. | Section 4.3 records an explicit reviewer for every Sprint 2 task. |
| Sprint 2 task assignments were not detailed enough. | Section 4.3 includes expected outputs, owners, reviewers, dates, and acceptance criteria. |
| Sprints 3–5 lacked task lists. | Sections 4.4, 4.5, and 4.6 provide complete task lists. |
| The schedule lacked specific dates. | Section 4.1 provides sprint ranges and the task tables provide start and due dates. |
| Project Overview lacked constraints. | Section 2.4 defines project, review, authorization, data, AI, file, service, priority, and Spec Kit constraints. |
| Deliverables were incomplete. | Section 2.6 includes software, documents, specifications, prototypes, tests, reports, guides, evidence, builds, and demo materials. |
| The risk register needed six additional risks. | Section 3.3 includes all six requested risks with mitigations and contingencies. |
| The Project Plan did not reflect important Vision changes. | Section 5 maps Vision decisions to project scope, constraints, tasks, risks, and tests. |
| Feature descriptions needed business rationale and beneficiaries. | S3-04 requires all 12 feature entries to include a business rationale and primary beneficiaries, with consistency checked against the detailed feature descriptions and approved scope. |
| Product Overview was too detailed. | S3-04 requires the Vision Document Product Overview to be rewritten at a high level and removes implementation-specific details. |

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
| 25-07-2026 | Deliverable Traceability | Corrected task references for `changes.md`, AI Usage Reports, Markdown/PDF outputs, and software builds. | Keep deliverable mappings consistent with the revised task IDs. |
| 25-07-2026 | Acceptance Criteria | Corrected the criteria for the Vision revision, Spec Kit implementation, document consolidation, and Sprint 3–5 reporting evidence. | Remove inconsistencies introduced by recent task updates. |
| 25-07-2026 | Vision Feedback Traceability | Corrected the mapping of the Vision Product Overview and feature-description feedback to S3-04. | Ensure each PA2 Vision comment points to the actual Vision-revision task. |