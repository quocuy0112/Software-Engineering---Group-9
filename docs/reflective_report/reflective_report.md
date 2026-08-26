# SmartHire Reflective Report

*Version: 1.1 | Date: 25 August 2026*

## 1. Introduction

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

This report reflects on the development of SmartHire from PA1 through PA5. It does not repeat the product description. Instead, it explains how the team worked, what the team learned from specification-driven development and AI-assisted development, which process problems affected the project, and how each member contributed.

The reflection is based on the weekly reports, Project Plan, Vision and use-case artifacts, Spec Kit feature folders, Git history, current source code, database schema and migrations, and PA5 testing material. We distinguish implemented code from final-environment verification because some workflows require the complete migration state, workers, private service sockets, storage configuration, and environment variables to be available together.

## 2. Team Experience

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

### 2.1 Effective Work Across PA1-PA5

In PA1, the team created a shared GitHub repository, selected Notion for task tracking, and used Messenger and Discord for communication and meetings. The project proposal, team contract, existing-app surveys, and meeting records distributed responsibilities early. This was effective because every member had an initial ownership area while the team still had a shared understanding of the recruitment domain.

In PA2, the team created the first Vision Document and Project Plan, initialized Spec Kit, completed training, and began recording AI-tool usage. This phase was effective because it moved the team from an idea to explicit actors, functional groups, risks, non-functional requirements, and a sprint plan. The early documents were not final, but they made later changes visible and reviewable.

In PA3 and PA4, the team worked in parallel on use-case diagrams, specifications, prototypes, implementation, UI/UX, C4 diagrams, deployment diagrams, and review activities. This division produced more than isolated screens: the current repository contains frontend modules, API routes, Prisma models and migrations, backend services, and background workers. The codebase now covers identity and account security, candidate profiles and CV processing, job discovery and applications, recruiter scoring and pipeline workflows, company and platform administration, notifications, messaging, analytics/export, and administrator backup.

In PA5, the team consolidated testing, documentation, architecture, and release activities. The most useful practice was comparing documentation with the repository instead of treating either document as automatically correct. This helped the team recognize that a feature needs consistent UI, authorization, business logic, persistence, deployment dependencies, and evidence before it can be described as ready for final release.

### 2.2 Challenges, Responses, and Lessons Learned

The largest challenge was scope growth. The early SmartHire proposal had a smaller feature baseline, while the repository later expanded to Spec Kit features 001 through 026. Newer work included company-scoped roles, recruiter scoring, recruitment messaging, company membership management, analytics/export, and administrator backup. The team responded through `Changes.md` files, Project Plan revisions, diagram updates, and source-based review; however, we learned that documentation synchronization must happen continuously rather than near the final deadline.

Another challenge was coordinating cross-feature role and authorization rules. Candidate, Recruiter, HR Manager, Company Owner, and Platform Administrator workflows cannot be developed independently because a change in company membership, application state, or account enforcement may affect several areas. The team learned to treat tenant isolation, server-side authorization, auditability, and read-only versus write permissions as shared system decisions instead of UI-only details.

Reproducible environment setup was also a significant challenge. The project contains workers for CV processing, image search, email, exports, and administration, so some workflows depend on migrations, worker processes, storage, secrets, and private service connections starting together. An unavailable OCR service during one local run is therefore an environment-readiness signal, not proof that the image-search feature was not implemented; the source includes secure image admission, malware scanning, normalization, OCR orchestration, reviewed intent generation, fallback handling, consent, cleanup, and rate limiting.

The audit identified a concrete release-engineering lesson: the Prisma schema validates successfully, but the repository migration-sequence check currently fails because `20260821125940_smarthire` does not follow the project's `NNN_snake_case` migration naming convention. This taught the team that a valid schema is not the same as a reproducible release process. Before the final demo, the team must verify migration naming, clean-database deployment, worker readiness, and service startup together.

## 3. Spec Kit Experience

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The team used the feature folders under `spec-kit/specs/001-identity-authentication-account-recovery` through `026-admin-data-backup` as the development record for major work. The most important files were `spec.md`, `plan.md`, and `tasks.md`; several feature folders also contained contracts, checklists, generated tests, and supporting evidence. This structure supported specification-driven development by giving the team a shared path from requirement to implementation.

The `spec.md` files influenced development decisions by defining user stories, actors, functional requirements, acceptance scenarios, edge cases, assumptions, and success criteria. For example, the specifications for CV import, OCR/image search, candidate scoring, notifications, recruitment messaging, analytics export, and administrator backup made privacy, consent, retries, failure handling, and role boundaries visible before coding. This reduced ambiguity when developers, documentation owners, and reviewers needed to decide what the system should do.

The `plan.md` files were useful because they translated requirements into technical decisions. They recorded expected project structure, persistence approach, integrations, architecture boundaries, and key trade-offs. For example, the backup plan defined a worker-managed workflow, persisted configuration, encrypted server-side artifacts, and a clear scope boundary: restore from the admin browser was excluded.

The `tasks.md` files made work actionable by separating frontend, backend, database, test, and documentation tasks. Compared with beginning from informal discussion and coding immediately, this helped the team identify dependencies sooner and reduced repeated clarification while implementing. It also gave reviewers a clearer checklist of expected work before a feature was merged.

Spec Kit's main advantage over a conventional workflow was traceability. It connected user stories to technical choices and later to tests. It shortened the time spent turning a broad feature idea into a work breakdown and reduced the need to rediscover edge cases during coding. The team could discuss concrete questions, such as who may access company-scoped data, when AI output must be reviewed by a user, or how an administrator action should be audited.

However, Spec Kit also created real overhead. For a small requirement change, the specification, plan, tasks, contracts, tests, code, diagrams, and related documents could all require updates. A checked task list is not proof that a feature is release-ready, especially when the final environment has not been verified. Generated tests also required review because AI can propose expected results that do not match the intended product behavior, current implementation, or available environment.

Our lesson is that Spec Kit is most valuable as a living source of traceability, not as a one-time document generator. Generated tests should be treated as starting material: the feature owner and tester must understand, refine, and execute them before using them as final evidence. The team should label every feature with an evidence-based status: `Implemented and verified`, `Implemented; environment verification pending`, `In progress`, `Deferred`, or `Out of scope`.

## 4. AI Tools Usage

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

AI tools supported the project in requirements exploration, specification drafting, implementation planning, code generation, test generation, technical writing, and self-learning. They were useful because the team had to work with web development, Mermaid, C4 modeling, migrations, security boundaries, testing, and specification-driven development within one course project.

AI was most effective when it accelerated a clearly defined task. It helped transform broad requirements into initial structures, identify possible edge cases, suggest test coverage, and improve documentation wording. It also helped the team explore alternatives before selecting an approach compatible with the SmartHire architecture and scope.

At the same time, AI output required human review. AI can assume services that are unavailable, invent behavior not present in code, use inconsistent terminology, or generate tests that are too broad or too dependent on source formatting. The team learned to verify AI-assisted requirements, code, diagrams, tests, and conclusions against the repository and intended runtime environment.

AI must not be used to fabricate test or demo evidence. A generated test plan can improve coverage, but Pass/Fail status must come from execution in the agreed environment. In future projects, the team would record the prompt purpose, output used, human review decision, and resulting repository artifact more consistently in each AI Usage Report.

## 5. SDLC Feedback

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The PA sequence was useful: PA1 established collaboration and the proposal; PA2 developed planning, vision, and Spec Kit initialization; PA3 added use cases, prototypes, and implementation; PA4 added architecture and more functional groups; and PA5 emphasized testing, demonstration, reflection, and final synchronization. The following improvements would make the process more practical for future teams.

### 5.1 Scope Growth Between Vision and PA5

**Observed problem:** Feature scope can grow substantially after the PA1 proposal and PA2 Vision Document, while PA5 still requires a coherent and demonstrable final system.  
**Impact on the team:** The team had to update use cases, diagrams, plans, tests, and release claims repeatedly as later features were added. This increased the risk of documentation drift and reduced time for final verification.  
**Suggested change:** Add a mandatory scope-freeze and traceability checkpoint between PA4 and PA5. Every feature should be classified as verified, verification pending, in progress, deferred, or out of scope, then reflected in the Vision, Project Plan, test plan, and demo script.  
**Expected benefit:** Teams can use PA5 for quality and release readiness instead of making late, undocumented scope decisions.

### 5.2 Timing of Generated-Test Review

**Observed problem:** Generated tests are available during Spec Kit work, but teams are formally required to understand and refine them mainly in PA5.  
**Impact on the team:** Test-review effort accumulates in the final sprint, and incorrect expected results or environment dependencies may be discovered too late.  
**Suggested change:** Require a lightweight test-review checkpoint after every implemented functional group in PA3 and PA4, while keeping PA5 for full manual execution and regression review.  
**Expected benefit:** The workload is distributed across the semester, and defects or incorrect test assumptions are found earlier.

### 5.3 Test-Plan and Release Templates

**Observed problem:** Teams must prepare a Test Plan, execution evidence, bug reports, test summary, demo plan, and final package near the end of the project.  
**Impact on the team:** Different members can use inconsistent fields, terminology, severity definitions, and evidence formats before final consolidation.  
**Suggested change:** Provide official templates for a Test Plan, test case, bug report, traceability matrix, and release-readiness checklist at the beginning of PA4.  
**Expected benefit:** Teams can collect compatible evidence continuously and reserve PA5 for verification, fixes, and demo rehearsal.

### 5.4 Documentation Duplication and Review Feedback

**Observed problem:** The same feature information is repeated across Markdown files, PDFs, Vision requirements, use cases, diagrams, Project Plan tables, Changes files, and AI Usage Reports.  
**Impact on the team:** Updating one decision can require many edits, and inconsistent versions can remain unnoticed until final review.  
**Suggested change:** Provide a standard traceability matrix and a short review checklist after each PA, including guidance on which documents must change when scope, roles, or architecture changes.  
**Expected benefit:** Teams would preserve documentation quality while reducing unnecessary repetition and late inconsistency.

### 5.5 Demo and Submission Planning

**Observed problem:** The final demo requires a stable environment, seeded data, working migrations, and speaking roles for all members, but final scheduling and environment expectations may be clarified late.  
**Impact on the team:** Teams may focus on feature work without enough time for a clean-environment rehearsal and recovery planning.  
**Suggested change:** Announce the expected demo window and final submission checklist early in PA4, and require one short pre-demo readiness review in PA5.  
**Expected benefit:** Teams can prepare stable data, migration checks, service startup steps, and realistic presentation roles before the deadline.

## 6. Individual Contributions and Learning

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

### Nguyễn Gia Quốc Uy

Nguyễn Gia Quốc Uy contributed to repository setup, Spec Kit initialization, scope consolidation, documentation review, UI support, and final integration activities. In later phases, Uy contributed to technology-stack documentation, diagram review, Changes tracking, landing-page and UI work, and notification-related specification work. He coordinated with feature owners to consolidate work from separate branches and documents into a consistent project baseline. Uy learned that final quality control is an active engineering responsibility, and would introduce a feature-status matrix earlier in a future project.

### Nguyễn Quốc Thành

Nguyễn Quốc Thành contributed to the LinkedIn survey, stakeholder and user-description work, implementation activities, testing, and UI/UX improvement. His later responsibilities included administrator-related workflows, recruiter approval-related work, recruiter job-posting and Admin review flows, and backup-related work. He coordinated with the recruiter, architecture, and documentation workstreams because these features required consistent role and authorization rules. Thành learned that administration features need explicit server-side authorization and operational constraints, and would schedule deployment verification earlier in a future project.

### Ngô Quốc Tuấn

Ngô Quốc Tuấn contributed to the TopCV survey, product-positioning work, use-case modeling, implementation, frontend/backend coordination, testing, UI/UX improvement, and demo-video preparation. His later work focused on Recruiter functionality, RBAC, candidate scoring, and recruiter job-posting workflows. He coordinated with the Admin and candidate workstreams because role changes and application data affected several user journeys. Tuấn learned that recruiter workflows must protect tenant isolation and data integrity as carefully as they support usability, and would define shared role contracts before building related screens in a future project.

### Lưu Chí Hải

Lưu Chí Hải contributed to meeting documentation, weekly reports, Project Plan updates, use-case modeling, and architecture documentation. In PA5, Hải coordinated the Test Plan, manual test-case documentation, test execution records, bug reports, and test summary, as well as continued documentation synchronization work. He coordinated with feature owners and test executors to link planned behavior with observable results and environment conditions. Hải learned that a useful test report records actual evidence instead of treating a plan or generated test as proof of correctness, and would establish the test-evidence structure earlier in a future project.

### Nguyễn Minh Khôi

Nguyễn Minh Khôi contributed to the VietnamWorks survey, Product Overview and non-functional requirements, use-case modeling, architecture research, and the PA4 Container, Backend, and Deployment diagrams. In PA5, Khôi supported testing research, reviewed testing requirements, updated architecture-related diagrams, assisted with notification-email review, and executed job-discovery and application test activities. He coordinated with implementation owners so that containers and deployment dependencies were described from the actual source structure rather than from an idealized design. Khôi learned that architecture documentation remains valuable only when it is synchronized with implementation and deployment configuration, and would add deployment preflight checks earlier in a future project.

## 7. Conclusion

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

SmartHire gave the team practical experience in developing a multi-role web application through planning, requirements engineering, Spec Kit, implementation, architecture design, testing, and release preparation. The strongest lessons were continuous traceability, realistic scope control, reproducible environments, honest evidence, and human review of AI-assisted work.

The project demonstrated that software quality is not measured only by the number of features or specifications. A feature is credible when its intended behavior, role authorization, persistence, source code, deployment dependencies, tests, diagrams, and final documentation remain consistent. The team will apply these lessons by freezing scope earlier, reviewing tests continuously, verifying clean migrations and workers before demos, and using AI tools as reviewed assistants rather than substitutes for engineering responsibility.

## 8. Revision History

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

| Version | Date | Change | Reason |
| --- | --- | --- | --- |
| 1.0 | 25 August 2026 | Created the initial PA5 reflective report from PA1-PA5 evidence, current source-code audit, Spec Kit artifacts, planning documents, and testing material. | Provide a concrete and evidence-based reflection for the final submission. |
| 1.1 | 25 August 2026 | Reworked Team Experience, Spec Kit Experience, SDLC Feedback, and individual reflections to state concrete artifacts, observed challenges, responses, and future improvements. | Align the report with the required reflection framework and avoid generic claims. |
