# Project Plan: SmartHire Recruitment System

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

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
| CON-12 | P0 capabilities must be stabilized before P1 analytics and export capabilities. | P1 work may be deferred only if the team formally removes or postpones it from the final approved scope and updates the Vision Document, Project Plan, requirements traceability, and demonstration plan consistently. |
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
| DEL-01 | A responsive SmartHire web application and its source code. | S3-05, S4-02A–B, S4-03, S4-08A–B, S5-01, S5-06 |
| DEL-02 | A revised and continuously maintained Project Plan that addresses previous feedback and remains consistent with the approved Notion task tracker and current assignment requirements. | S3-10, S4-15 |
| DEL-03 | A revised Vision Document, with a high-level Product Overview and feature descriptions that include business rationale and primary beneficiaries. | S3-04 |
| DEL-04 | One consolidated `Changes.md` file recording the material document and project changes introduced through PA4. | S3-04, S3-10, S3-12, S4-12 |
| DEL-05 | Spec Kit and specification-driven development artifacts (`constitution.md`, generated Markdown artifacts, specifications, clarifications, implementation plans, task breakdowns, analysis/checklists, source code). | S2-01, S2-10, S3-05, S3-07, S4-02A–B, S4-03 |
| DEL-06 | Mermaid use-case models covering the functional requirements in the revised Vision Document. | S3-01, S3-06, S3-08, S3-09 |
| DEL-07 | Use-case specifications (IDs, actors, descriptions, preconditions, basic/alternative flows, postconditions). | S3-01, S3-06, S3-08, S3-09 |
| DEL-08 | Prototype evidence for the basic and alternative flows of the documented use cases. | S3-01, S3-06, S3-08, S3-09 |
| DEL-09 | One full-stack Authentication, Authorization, and Access Control functional group implemented through Spec Kit during Sprint 3. | S3-05, S3-07 |
| DEL-10 | A final test package containing the Test Plan, reviewed and refined test cases, execution results, test summary, and linked bug reports. | S5-02–S5-06 |
| DEL-11 | Weekly Reports, Scrum Meeting records, and Notion task-tracker screenshots. | S1-05, S2-05, S2-15, S3-11, S4-06, S5-12 |
| DEL-12 | Individual AI Usage Reports recorded for the members assigned in each sprint. | S2-11A–E, S3-03A–E, S4-13A–E, S5-10 |
| DEL-13 | User, technical, and project documentation updated to reflect the final implemented system. | S5-09 |
| DEL-14 | Markdown and PDF versions of the required project documents. | S2-16A–C, S2-17, S3-02, S4-09–S4-12, S4-15, S5-09, S5-11 |
| DEL-15 | Git commit-history evidence and the final submission package. | S5-10, S5-11 |
| DEL-16 | Build 1: full-stack Authentication, Authorization, and Access Control increment. | S3-05, S3-07 |
| DEL-17 | PA4 system increment and architecture package, including two Spec Kit functional groups, system review and UI/UX improvements, C4 diagrams, technical documentation, change records, the updated Project Plan, AI Usage Reports, and demo evidence. | S4-01, S4-02A–B, S4-03–S4-06, S4-07A–B, S4-08A–B, S4-09–S4-15 |
| DEL-18 | Final Build and demonstration materials. | S5-01, S5-06, S5-07, S5-11 |
| DEL-19 | A Reflective Report covering team experience, Spec Kit experience, AI-tool usage, SDLC feedback, and individual member reflections. | S5-08 |

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
- Scope, requirement, schedule, priority, architecture, or technology changes must be recorded in `Changes.md`.
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
| R-08 | Scope creep or unstable P0 capabilities | High | High | Nguyễn Gia Quốc Uy | Prioritize P0 capabilities and review P1 work against the final approved scope before committing it to a sprint. | Defer or remove P1 work only through an approved scope change, then update the Vision Document, Project Plan, requirements traceability, `Changes.md`, and demonstration plan consistently. |
| R-09 | Notion task-tracker inconsistency | Medium | High | Nguyễn Gia Quốc Uy | Review Notion, the Project Plan, and approved team decisions at the end of each sprint. | Resolve the discrepancy with the team, then update Notion, the Project Plan, and the Weekly Report using the same approved task information. |
| R-10 | Integration or regression failure | Medium | High | Nguyễn Minh Khôi | Require review, automated checks, integration checkpoints, and regression tests. | Revert the breaking change and restore the latest stable build. |
| R-11 | Project Plan or Weekly Report inconsistency | Medium | High | Lưu Chí Hải | Update the Project Plan and Weekly Report whenever approved task information changes and cross-check them against Notion before submission. | Resolve the discrepancy with the Project Manager and update all affected records consistently. |

## 4. Project Plan

*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

The project follows Scrum and is divided into five sprints. Sprint dates, tasks, owners, reviewers, and acceptance criteria must be maintained consistently in this document and in Notion. Current task statuses are maintained in the Notion task tracker and summarized in the corresponding Weekly Report.

### 4.1. Schedule Summary

| Sprint | Date Range | Main Objective | Exit Deliverable |
|---|---|---|---|
| Sprint 1 — PA1 | 25-05-2026 to 07-06-2026 | Establish the team, tools, contract, proposal, and competitor survey. | PA1 project baseline |
| Sprint 2 — PA2 | 09-06-2026 to 12-07-2026 | Create the Project Plan, Vision Document, Spec Kit initialization, and required reports. | PA2 documentation baseline |
| Sprint 3 — PA3 | 17-07-2026 to 26-07-2026 | Revise PA2 documents, define use cases and prototypes, and implement Authentication through Spec Kit. | Build 1 and PA3 package |
| Sprint 4 — PA4 | 27-07-2026 to 09-08-2026 | Prepare Sprint 4 planning, implement two functional groups through Spec Kit, review and improve the existing system, and produce the required C4 architecture and PA4 submission artifacts. | PA4 system increment and architecture package |
| Sprint 5 — PA5 | 10-08-2026 to 23-08-2026 | Complete all remaining functional groups, prepare and execute the final test plan, resolve defects, rehearse the final product demo, write the Reflective Report, update all PA documents, and consolidate the final submission package. | Tested final product, final demo, Reflective Report, and final submission package |

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
| S3-11 | Write the Weekly Report and capture screenshots of the Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 19-07-2026 | 24-07-2026 | The Weekly Report summarizes work completed during Sprint 2 and records the tasks currently in progress or planned for Sprint 3, including attendance, individual status reports, issues, decisions, action items, and the meeting summary; the screenshots clearly show the relevant Sprint 3 tasks, owners, dates, and statuses. |
| S3-12 | Update and consolidate `Changes.md` for the Project Plan and Vision Document. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 24-07-2026 | 25-07-2026 | A single `Changes.md` file contains separate Project Plan and Vision Document sections. Each material revision identifies the changed section, revision objective, change summary, reason, responsible owner, reviewer or reviewers, revision date, and revised location. |

### 4.5. Sprint 4 Task List

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

### 4.6. Expected Sprint 5 Task List

| ID | Task and Expected Output | Owner | Reviewer | Start | Due | Acceptance Criteria |
|---|---|---|---|---|---|---|
| S5-01 | Review the implementation status of all functional groups and complete the remaining required features using the Spec Kit workflow. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 10-08-2026 | 16-08-2026 | Every functional group retained in the final approved project scope is fully implemented, integrated, and demonstrable; the corresponding source code and required Spec Kit artifacts are complete and committed; and any feature removed from the final scope is formally reflected in the Vision Document, Project Plan, and related traceability records. |
| S5-02 | Prepare the final Test Plan. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 10-08-2026 | 13-08-2026 | The Test Plan defines objectives, scope, features, environment, tools, schedule, responsibilities, and entry and exit criteria. |
| S5-03 | Review and refine Spec Kit-generated test cases and complete the final functional test-case document. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 11-08-2026 | 16-08-2026 | At least five use cases are covered by at least ten test cases each, for a total of at least 50 functional test cases; incorrect expected results are corrected, missing edge cases are added, and descriptions are clear. Where applicable, the final test set includes negative authorization, company-isolation, personal-data protection, advisory-AI, parser, email-delivery, timeout, retry, and service-failure scenarios. |
| S5-04 | Execute all final test cases and record the results. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 15-08-2026 | 19-08-2026 | Every test case records its ID, execution date, Pass or Fail status, and actual result when required. |
| S5-05 | Prepare the Bug Report and test summary. | Nguyễn Minh Khôi | Nguyễn Gia Quốc Uy | 16-08-2026 | 20-08-2026 | Every failed test case is linked to at least one bug report; each bug report includes its bug ID, description, steps to reproduce, expected and actual results, severity, and status. A Bug Report section is included even if all final test cases pass, documenting defects discovered and fixed during testing. The test summary reports the number of features tested, total test cases, and passed and failed test cases for each feature. |
| S5-06 | Coordinate defect fixing, rerun failed tests, and stabilize the final build with support from the assigned frontend and backend developers. | Nguyễn Quốc Thành | Nguyễn Gia Quốc Uy | 17-08-2026 | 22-08-2026 | Critical and release-blocking defects are assigned to the appropriate developers and resolved; affected test cases are rerun; the final build is stable; and remaining known issues are documented. |
| S5-07 | Prepare and rehearse the final product demonstration. | Nguyễn Gia Quốc Uy | All other members | 18-08-2026 | 23-08-2026 | The approximately 15-minute demo includes a brief product introduction, two or three complete user workflows, a technical overview referencing the technology stack, C4 diagrams, and Spec Kit, and a speaking role for every team member. |
| S5-08 | Write the Reflective Report. | Nguyễn Gia Quốc Uy | All other members | 17-08-2026 | 22-08-2026 | The report covers team experience, Spec Kit experience, AI-tool usage, constructive SDLC feedback, and a three-to-five-sentence reflection from every member. |
| S5-09 | Review and update all PA1–PA5 documents and required technical documentation to reflect the final product. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 18-08-2026 | 22-08-2026 | All PA1–PA5 documents and required technical documents are consistent with the final implementation, use consistent terminology and traceability references, and are available in the required Markdown and rendered PDF formats. |
| S5-10 | Coordinate the final AI Usage Reports and prepare Git commit-history evidence. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 10-08-2026 | 22-08-2026 | Every member completes the required individual AI Usage Report, and the repository commit history is exported or captured with readable author, date, and commit information. |
| S5-11 | Consolidate and verify the final submission package. | Nguyễn Gia Quốc Uy | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi | 21-08-2026 | 23-08-2026 | The package contains updated PA1–PA5 documents, complete source code without dependency or generated build folders, all Spec Kit artifacts, the final test package, Reflective Report, AI Usage Reports, Markdown and PDF outputs, Git commit-history evidence, and all required demonstration materials; the package uses the required `PA5-Group09.zip` name. |
| S5-12 | Write the Sprint 5 Weekly Report and capture the current Notion task tracker. | Lưu Chí Hải | Nguyễn Gia Quốc Uy | 10-08-2026 | 23-08-2026 | The report summarizes work completed during Sprint 4 and records work in progress or planned for Sprint 5, including attendance, status reports, issues, decisions, action items, and current task-tracker evidence. |

### 4.7. Build Plan

| Build | Target Date | Included Scope | Exit Criteria |
|---|---|---|---|
| PA2 Documentation Baseline | 12-07-2026 | Project Plan, Vision Document, Spec Kit initialization, workflows, NFRs, Weekly Report, and AI Usage Reports. | Required documents and evidence are complete and consistent with Notion. |
| Build 1 | 26-07-2026 | Revised Vision and Project Plan, use-case models, specifications, prototypes, and full-stack Authentication implementation. | PA3 deliverables are reviewed and Authentication is demonstrable. |
| Build 2 | 09-08-2026 | Two functional groups implemented through Spec Kit, system setup and architecture review, frontend/backend work allocation, bug fixing and UI/UX improvements, five C4 diagrams, Technology Stack documentation, `Changes.md`, the updated Project Plan, AI Usage Reports, and a demonstration video. | The assigned functional-group work is demonstrable; the required diagrams, Project Plan, and supporting documents are complete and internally consistent; unresolved issues are documented; and the PA4 demo and submission evidence are ready. |
| Final Build | 23-08-2026 | All remaining functional groups, final Test Plan, at least 50 reviewed functional test cases covering at least five use cases, test execution results, linked bug reports, defect resolution, final product demonstration, Reflective Report, updated PA1–PA5 documents, AI Usage Reports, Git evidence, and the final submission package. | All functional groups retained in the final approved scope are implemented; all test cases have documented results; failed cases are linked to bug reports; release-blocking defects are resolved; the final demo is ready with participation from every member; and all required submission materials are complete. |

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
| Product Overview must remain high-level. | S3-04 revises the Vision Document Product Overview to remove implementation-specific details and retain only the product purpose, target users, high-level capabilities, product boundaries, assumptions, and dependencies. |
| Every feature must include business rationale and beneficiaries. | S3-04 requires all 12 feature entries to include a business rationale and primary beneficiaries and to remain consistent with the detailed feature descriptions and approved scope. |
| AI-generated job descriptions are removed. | No sprint task or build includes AI job-description generation. |
| AI resume rewriting is removed. | CV work is limited to upload, parsing, confirmation, reuse, and scoring input. |
| The recruitment pipeline uses nine canonical stages. | Pipeline backend, Kanban, application tracking, specifications, and tests use the same stages. |
| A base user retains candidate identity and receives company-scoped permissions through memberships. | Authentication and authorization tasks use the membership model rather than a separate recruiter account. |
| Authentication tokens use HttpOnly, Secure, SameSite cookies. | Sprint 3 implements secure-cookie authentication, while S5-01 and S5-06 require completion, defect correction, and stabilization of the final authentication implementation. |
| Job matching is rule-based. | Semantic AI work is limited to CV scoring and explanations. |
| AI scoring is advisory. | Constraints, risks, scoring tasks, and tests preserve recruiter override and prevent automated decisions. |
| Analytics and export are P1. | S5-01 reviews the implementation status of every functional group retained in the final approved Vision. Because PA5 requires all defined functional groups to be implemented, analytics and export must be completed if they remain part of the final project scope; otherwise, the Vision Document and Project Plan must be formally revised before the final demo. |
| Personal data and CVs require protection. | Constraints and risk mitigations define the protection requirements, while S5-03–S5-06 require security-related test coverage, execution, defect reporting, correction, and regression verification. |
| AI, email, parser, and database failures must be handled. | S5-03 includes relevant edge and failure test cases; S5-04 executes them; S5-05 records resulting defects; and S5-06 fixes failures and reruns the affected tests. |

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
| 25-07-2026 | Deliverable Traceability | Corrected task references for `Changes.md`, AI Usage Reports, Markdown/PDF outputs, and software builds. | Keep deliverable mappings consistent with the revised task IDs. |
| 25-07-2026 | Acceptance Criteria | Corrected the criteria for the Vision revision, Spec Kit implementation, document consolidation, and Sprint 3–5 reporting evidence. | Remove inconsistencies introduced by recent task updates. |
| 25-07-2026 | Vision Feedback Traceability | Corrected the mapping of the Vision Product Overview and feature-description feedback to S3-04. | Ensure each PA2 Vision comment points to the actual Vision-revision task. |
| 02-08-2026 | Sprint 4 Planning | Replaced the previous expected Sprint 4 feature backlog with the current Notion-assigned tasks, owners, dates, and statuses, and updated the related deliverable and Build 2 mappings. | Synchronize the Project Plan with the actual PA4 task tracker. |
| 03-08-2026 | Project Plan Maintenance | Added S4-15 for updating the Project Plan, synchronized the Sprint 4 planning information with the latest approved task tracker, revised the provisional Sprint 5 baseline using the official PA5 requirements, and updated the related deliverable and Build Plan references. | Keep the Project Plan current, traceable, and consistent with the PA4 task tracker and official PA5 assignment. |
| 03-08-2026 | Sprint 5 Planning | Replaced the previous provisional Sprint 5 implementation and testing backlog with a planning baseline aligned to the official PA5 requirements; added explicit Test Plan, test-case refinement, test execution, Bug Report, final demo, Reflective Report, document-update, AI-report, Weekly Report, and final-package tasks; and updated all related deliverable, schedule, Build Plan, and Vision-alignment references. | Align the Project Plan with the official PA5 assignment and preserve task traceability. |