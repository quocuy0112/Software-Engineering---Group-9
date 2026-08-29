# SmartHire Reflective Report

**Group:** 9

**Course:** CSC13002 - Introduction to Software Engineering

**Project:** SmartHire

**Version:** 2.2

**Date:** 29 August 2026

## 1. Introduction

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

This report reflects on the development of SmartHire from PA1 through PA5. It does not repeat the product description. Instead, it explains how the team worked, what the team learned from specification-driven development and AI-assisted development, which process problems affected the project, and how each member contributed.

The reflection is based on our weekly reports, Notion task tracker, Git history, Vision Document, Project Plan, use-case documents, C4 diagrams, Spec Kit artifacts, source code, and PA5 testing records. We tried to keep the report honest by distinguishing planned work, implemented functionality, and functionality that had been tested successfully in the agreed environment.

SmartHire became much larger than the application we first imagined. By PA5, it had developed into a multi-role recruitment platform involving Candidates, Recruiters, HR Managers, Company Owners, and Platform Administrators. This growth gave us valuable experience, but it also made integration, testing, documentation synchronization, scope control, and team coordination much more difficult.

## 2. Team Experience

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

### 2.1 Effective Work Across PA1-PA5

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

In PA1, the team created a shared GitHub repository, selected Notion for task tracking, and used Messenger and Discord for communication and meetings. The project proposal, team contract, existing-app surveys, and meeting records distributed responsibilities early. This was effective because every member had an initial ownership area while the team still had a shared understanding of the recruitment domain.

In PA2, the team created the first Vision Document and Project Plan, initialized Spec Kit, completed training, and began recording AI-tool usage. This phase was effective because it moved the team from an idea to explicit actors, functional groups, risks, non-functional requirements, and a sprint plan. The early documents were not final, but they made later changes visible and reviewable.

In PA3 and PA4, the team worked in parallel on use-case diagrams, specifications, prototypes, implementation, UI/UX, C4 diagrams, deployment diagrams, and review activities. This division produced more than isolated screens: the current repository contains frontend modules, API routes, Prisma models and migrations, backend services, and background workers. The codebase now covers identity and account security, candidate profiles and CV processing, job discovery and applications, recruiter scoring and pipeline workflows, company and platform administration, notifications, messaging, analytics/export, and administrator backup.

The members' final reflections clarify how this work was divided. Uy coordinated planning, documentation, UI/UX, Spec Kit, integration, and final evidence; Thành focused on the administrator panel, administrative management workflows, user chat, OCR-related technology, and Better Auth/OAuth integration; Tuấn focused on job search, automated CV scoring, and core employer-side flows; Hải created the initial Recruitment Pipeline Kanban, executed PA5 tests for Authentication, Candidate Profile, and Image Search, and maintained several planning and architecture documents; and Khôi reconciled non-functional requirements and scope boundaries, authored DGM-06 and DGM-07, and updated the Container, Backend, and Deployment diagrams.

In PA5, the team consolidated testing, documentation, architecture, and release activities. The most useful practice was comparing documentation with the repository instead of treating either document as automatically correct. This helped the team recognize that a feature needs consistent UI, authorization, business logic, persistence, deployment dependencies, and evidence before it can be described as ready for final release.

Cross-review was most effective when members shared concrete implementation knowledge. For example, Thành reviewed Hải's C4 work so that actors, external systems, frontend components, and system interactions reflected the application, while Tuấn coordinated with backend and UI teammates to connect job-search, scoring, and employer workflows end to end. Khôi also worked with other members to reduce merge conflicts and keep the Vision, use cases, and architecture diagrams consistent.

### 2.2 Uneven Participation and Accountability

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

One of the weaknesses that the team must acknowledge honestly was that the level of effort and responsibility was not always equal among members. Although tasks were assigned through meetings, messages, and Notion, some members did not consistently invest the expected amount of time, actively research unfamiliar topics, or take full ownership of their assigned work. In several situations, progress only occurred after repeated reminders or after another member provided detailed instructions.

There were also cases in which a task was considered complete too early, even though its output had not been carefully reviewed, fully understood, or synchronized with the rest of the project. Some members waited for direct guidance instead of independently reading the assignment, examining related source code, asking questions early, or proposing solutions. This reduced the amount of meaningful discussion within the team and increased the dependence on a smaller number of more active members.

As a result, proactive members sometimes had to take on additional work near the deadline. This included reviewing incomplete deliverables, correcting documentation, checking implementation details, resolving integration problems, and preparing materials that were originally assigned to someone else. The issue was not only an unequal workload; it also created schedule risk because one delayed task could block testing, diagrams, documentation, or the final demo.

However, this was also a weakness in our team-management process. We assigned tasks and deadlines, but we did not always define intermediate checkpoints, measurable acceptance criteria, or a clear escalation process when a task stopped progressing. We sometimes waited too long before recognizing that a member needed support or that a task should be reassigned. Therefore, the responsibility belongs not only to individual members but also to the team as a whole.

We intentionally do not identify individual members in this reflection because the purpose is to improve the team's working process rather than publicly blame anyone. Nevertheless, avoiding names does not mean avoiding the problem. A team member should not only receive a task but should also understand it, actively learn what is needed, communicate blockers early, and remain responsible until the result is reviewed and integrated.

### 2.3 Other Challenges We Faced

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The largest challenge was scope growth. The early SmartHire proposal had a smaller feature baseline, while the repository later expanded to Spec Kit features 001 through 026. Newer work included company-scoped roles, recruiter scoring, recruitment messaging, company membership management, analytics/export, and administrator backup. The team responded through `Changes.md` files, Project Plan revisions, diagram updates, and source-based review; however, we learned that documentation synchronization must happen continuously rather than near the final deadline.

Another challenge was coordinating cross-feature role and authorization rules. Candidate, Recruiter, HR Manager, Company Owner, and Platform Administrator workflows cannot be developed independently because a change in company membership, application state, or account enforcement may affect several areas. The team learned to treat tenant isolation, server-side authorization, auditability, and read-only versus write permissions as shared system decisions instead of UI-only details.

Reproducible environment setup was also a significant challenge. The project contains workers for CV processing, image search, email, exports, and administration, so some workflows depend on migrations, worker processes, storage, secrets, and private service connections starting together. An unavailable OCR service during one local run is therefore an environment-readiness signal, not proof that the image-search feature was not implemented; the source includes secure image admission, malware scanning, normalization, OCR orchestration, reviewed intent generation, fallback handling, consent, cleanup, and rate limiting.

Late integration created additional pressure. Changes from different branches could affect the same schema, generated Prisma output, shared UI components, navigation, language content, or styling. We had to resolve conflicts semantically, preserve the intended work from both sides, regenerate derived output when appropriate, and then verify the combined result. This was slower than simply choosing one version, but it prevented one member's work from silently replacing another's.

Documentation synchronization was also more demanding than expected. The same feature could appear in the Vision Document, use-case model, use-case specification, Spec Kit folder, Project Plan, C4 diagrams, test report, change log, and AI Usage Report. When the implementation changed, several documents could become outdated at once. Near PA5, the team had to compare these documents with the actual repository instead of assuming that the newest document was automatically correct.

The team also recognized that some architectural decisions and feature boundaries should have been planned in greater detail earlier. As the project expanded, several areas became less focused and were not yet at the level expected for a real-world release. This reinforced the need to distinguish a coursework implementation from a production-ready product and to avoid describing unfinished verification as release readiness.

### 2.4 Main Team Lessons

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The first lesson was that communication works best when it produces a recorded decision. Chat discussions were useful for quick coordination, but important decisions still needed to appear in Notion, the Project Plan, a specification, or a change log. This reduced uncertainty about ownership and prevented different members from implementing conflicting assumptions.

The second lesson was that assigning a task is not the same as ensuring responsibility. Every task should have an owner, deadline, intermediate checkpoint, acceptance criteria, expected evidence, and reviewer. The owner should be responsible for reporting progress and blockers without waiting to be asked repeatedly.

The third lesson was that raw activity does not equal contribution quality. Commit counts can provide supporting evidence, but they do not fairly represent the difficulty of architecture research, testing, documentation, integration, or a large functional workflow. Grouping related commits into meaningful work packages gave us a more realistic picture than counting every merge, formatting change, or small fix as an independent contribution.

The fourth lesson was that asking for help is not a weakness, but waiting silently until the deadline is a serious risk. When a member lacks technical knowledge, that member should research the topic, ask focused questions, and communicate the blocker early. The rest of the team can then provide guidance or adjust the task before it affects other deliverables.

The final lesson was that integration and verification need their own time. Completing separate features near the deadline does not guarantee that the complete system will start reliably, preserve its data, or support a smooth demonstration. In a future project, we would freeze the main scope earlier, test scoring and other high-risk edge cases during implementation, synchronize documentation within each feature review, and reserve a dedicated stabilization period for migration checks, worker readiness, regression testing, and demo rehearsal.

## 3. Spec Kit Experience

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The team used the feature folders under `spec-kit/specs/001-identity-authentication-account-recovery` through `026-admin-data-backup` as the development record for major work. The most important files were `spec.md`, `plan.md`, and `tasks.md`; several feature folders also contained contracts, checklists, generated tests, and supporting evidence. This structure supported specification-driven development by giving the team a shared path from requirement to implementation.

The `spec.md` files influenced development decisions by defining user stories, actors, functional requirements, acceptance scenarios, edge cases, assumptions, and success criteria. For example, the specifications for CV import, OCR/image search, candidate scoring, notifications, recruitment messaging, analytics export, and administrator backup made privacy, consent, retries, failure handling, and role boundaries visible before coding. This reduced ambiguity when developers, documentation owners, and reviewers needed to decide what the system should do.

The `plan.md` files were useful because they translated requirements into technical decisions. They recorded expected project structure, persistence approach, integrations, architecture boundaries, and key trade-offs. For example, the backup plan defined a worker-managed workflow, persisted configuration, encrypted server-side artifacts, and a clear scope boundary: restore from the admin browser was excluded.

The `tasks.md` files made work actionable by separating frontend, backend, database, test, and documentation tasks. Compared with beginning from informal discussion and coding immediately, this helped the team identify dependencies sooner and reduced repeated clarification while implementing. It also gave reviewers a clearer checklist of expected work before a feature was merged.

Spec Kit's main advantage over a conventional workflow was traceability. It connected user stories to technical choices and later to tests. It shortened the time spent turning a broad feature idea into a work breakdown and reduced the need to rediscover edge cases during coding. The team could discuss concrete questions, such as who may access company-scoped data, when AI output must be reviewed by a user, or how an administrator action should be audited.

However, Spec Kit also created real overhead. For a small requirement change, the specification, plan, tasks, contracts, tests, code, diagrams, and related documents could all require updates. A checked task list is not proof that a feature is release-ready, especially when the final environment has not been verified. Generated tests also required review because AI can propose expected results that do not match the intended product behavior, current implementation, or available environment.

Spec Kit also cannot compensate for a lack of ownership. Even when a task list clearly describes what must be done, the assigned member still needs to read it, understand the feature, inspect related artifacts, and verify the result. If a member treats the generated tasks as instructions to follow mechanically without understanding their purpose, the output may appear complete while remaining inconsistent with the actual product.

Our lesson is that Spec Kit is most valuable as a living source of traceability, not as a one-time document generator. Generated tests should be treated as starting material: the feature owner and tester must understand, refine, and execute them before using them as final evidence. The team should label every feature with an evidence-based status: `Implemented and verified`, `Implemented; environment verification pending`, `In progress`, `Deferred`, or `Out of scope`.

## 4. AI Tools Usage

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

AI tools supported the project in requirements exploration, specification drafting, implementation planning, code generation, test generation, technical writing, and self-learning. They were useful because the team had to work with web development, Mermaid, C4 modeling, migrations, security boundaries, testing, and specification-driven development within one course project.

The tools used by members included OpenAI Codex, ChatGPT, Claude, Gemini, and GitHub Copilot. They supported requirement explanation, planning, code exploration, implementation assistance, diagram preparation, test design, UI refinement, debugging, and technical writing.

AI was most effective when it accelerated a clearly defined task. It helped transform broad requirements into initial structures, identify possible edge cases, suggest test coverage, and improve documentation wording. It also helped the team explore alternatives before selecting an approach compatible with the SmartHire architecture and scope.

At the same time, AI output required human review. AI can assume services that are unavailable, invent behavior not present in code, use inconsistent terminology, or generate tests that are too broad or too dependent on source formatting. The team learned to verify AI-assisted requirements, code, diagrams, tests, and conclusions against the repository and intended runtime environment.

AI assistance also created a risk of reduced personal initiative. When used incorrectly, a member could depend on AI to produce a complete answer without first understanding the requirement, repository, or expected result. We learned that using AI effectively still requires the member to research the problem, prepare meaningful context, question the output, and remain responsible for the final work.

AI must not be used to fabricate test or demo evidence. A generated test plan can improve coverage, but Pass/Fail status must come from execution in the agreed environment. Our team therefore treated AI as an assistant rather than an authority or a replacement for member responsibility. In future projects, the team would record the prompt purpose, output used, human review decision, and resulting repository artifact more consistently in each AI Usage Report.

## 5. SDLC Feedback

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

The PA sequence was useful: PA1 established collaboration and the proposal; PA2 developed planning, vision, and Spec Kit initialization; PA3 added use cases, prototypes, and implementation; PA4 added architecture and more functional groups; and PA5 emphasized testing, demonstration, reflection, and final synchronization. The following improvements would make the process more practical for future teams.

### 5.1 Scope Growth Between Vision and PA5

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** Feature scope can grow substantially after the PA1 proposal and PA2 Vision Document, while PA5 still requires a coherent and demonstrable final system.  
**Impact on the team:** The team had to update use cases, diagrams, plans, tests, and release claims repeatedly as later features were added. This increased the risk of documentation drift and reduced time for final verification.  
**Suggested change:** Add a mandatory scope-freeze and traceability checkpoint between PA4 and PA5. Every feature should be classified as verified, verification pending, in progress, deferred, or out of scope, then reflected in the Vision, Project Plan, test plan, and demo script.  
**Expected benefit:** Teams can use PA5 for quality and release readiness instead of making late, undocumented scope decisions.

### 5.2 Timing of Generated-Test Review

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** Generated tests are available during Spec Kit work, but teams are formally required to understand and refine them mainly in PA5.

**Impact on the team:** Test-review effort accumulates in the final sprint, and incorrect expected results, scoring edge cases, or environment dependencies may be discovered too late.

**Suggested change:** Require a lightweight test-review checkpoint after every implemented functional group in PA3 and PA4, including representative edge cases for high-risk workflows such as CV scoring, authentication, OCR, and role authorization, while keeping PA5 for full manual execution and regression review.

**Expected benefit:** The workload is distributed across the semester, and defects or incorrect test assumptions are found earlier.

### 5.3 Test-Plan and Release Templates

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** Teams must prepare a Test Plan, execution evidence, bug reports, test summary, demo plan, and final package near the end of the project.  
**Impact on the team:** Different members can use inconsistent fields, terminology, severity definitions, and evidence formats before final consolidation.  
**Suggested change:** Provide official templates for a Test Plan, test case, bug report, traceability matrix, and release-readiness checklist at the beginning of PA4.  
**Expected benefit:** Teams can collect compatible evidence continuously and reserve PA5 for verification, fixes, and demo rehearsal.

### 5.4 Documentation Duplication and Review Feedback

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** The same feature information is repeated across Markdown files, PDFs, Vision requirements, use cases, diagrams, Project Plan tables, Changes files, and AI Usage Reports.

**Impact on the team:** Updating one decision can require many edits, and inconsistent versions can remain unnoticed until final review.

**Suggested change:** Provide a standard traceability matrix and a short review checklist after each PA, including guidance on which documents must change when scope, roles, or architecture changes. Teams should also include documentation synchronization in the feature pull-request lifecycle and, where practical, add automated CI checks for links, generated diagrams, and Markdown/PDF parity.

**Expected benefit:** Teams would preserve documentation quality while reducing unnecessary repetition and late inconsistency.

### 5.5 Individual Accountability Checkpoints

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** Task assignment alone did not guarantee equal effort, sufficient initiative, or full ownership. Some work progressed only after repeated reminders or substantial guidance from other members.

**Impact on the team:** More proactive members had to absorb additional review, correction, and integration work near the deadline, while delayed tasks created dependencies for testing and documentation.

**Suggested change:** Require each member to demonstrate the assigned output, explain what was learned, identify blockers, and provide evidence at one or two intermediate sprint checkpoints before the task can be marked complete.

**Expected benefit:** Passive participation and hidden delays would be identified earlier, support could be provided sooner, and individual contribution evidence would become more meaningful than raw commit counts.

### 5.6 Demo and Submission Planning

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

**Observed problem:** The final demo requires a stable environment, seeded data, working migrations, and speaking roles for all members, but final scheduling and environment expectations may be clarified late.  
**Impact on the team:** Teams may focus on feature work without enough time for a clean-environment rehearsal and recovery planning.  
**Suggested change:** Announce the expected demo window and final submission checklist early in PA4, and require one short pre-demo readiness review in PA5.  
**Expected benefit:** Teams can prepare stable data, migration checks, service startup steps, and realistic presentation roles before the deadline.

## 6. Individual Contributions and Learning

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

### Nguyễn Gia Quốc Uy

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Quốc Thành*

As the project coordinator, I established the repository and task-tracking structure, prepared the team proposal and contract, planned work allocation, and helped consolidate the Vision Document, Project Plan, Spec Kit workflow, and PA1-PA5 submission requirements. I produced DGM-01 and DGM-02 with their specifications and prototype evidence, reviewed use cases, C4 and technology-stack documentation, maintained change and contribution evidence, and coordinated final integration across separate workstreams. On the product side, I built or refined the landing and home experience, workspace and profile UI, job-board search and filters, theme and language consistency, accessibility details, and later OCR/image-search UI improvements while also handling merge and repository-review issues. The most difficult part was balancing broad scope and uneven progress while ensuring that AI-assisted plans, UI changes, documents, and reported evidence remained consistent with the real repository and runtime limitations. I learned that coordination is an engineering responsibility, and in a future project I would freeze scope earlier and introduce a feature-status matrix, intermediate acceptance checkpoints, and integration and retest gates from the first sprint.

### Nguyễn Quốc Thành

*Performed by: Nguyễn Quốc Thành | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Group 9*

For the SmartHire project, I mainly built the administrator panel and its various management workflows, as well as the chat mechanism between users. I selected and implemented technologies supporting OCR and Better Auth/OAuth integration to meet the feature requirements. Because my work was relatively self-contained and had few direct dependencies on other members' tasks, my level of team interaction during implementation was comparatively low. Through this project, I learned the Spec Kit development workflow, including planning, writing tests, implementing features, and retesting them. If I worked on a similar project again, I would choose teammates more carefully and plan the architecture in greater detail from the beginning, because some current features remain unfocused and have not yet reached a real-world release standard.

### Ngô Quốc Tuấn

*Performed by: Ngô Quốc Tuấn | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

In this job-finding project, I was responsible for the job-search features, automated CV scoring, and the core flows on the employer-side pages. I addressed key challenges in optimizing the CV-scoring logic to produce more accurate and relevant matching results. I collaborated closely with backend and UI teammates to ensure that the workflows connected smoothly from end to end. Through this work, I strengthened my skills in designing complex user flows and developed a deeper understanding of candidate-employer matching systems. If I worked on the project again, I would prioritize edge-case testing for the CV-scoring pipeline much earlier in the process.

### Lưu Chí Hải

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

I mainly worked on the initial implementation of the Recruitment Pipeline Kanban, which was later further developed and refined by Thành and Tuấn; PA5 testing for Authentication, Candidate Profile, and Image Search; and project documents such as the weekly Scrum meeting reports, the Project Plan, and several C4 diagrams. When creating my assigned C4 diagrams, I collaborated with Thành, one of the main developers of the web application, who reviewed my work and helped ensure that the actors, external systems, frontend components, and system interactions aligned with the actual implementation. One difficulty I faced was keeping the specifications, test results, and documents consistent as the project changed rapidly, so I regularly reviewed and synchronized them with the latest implementation. From this project, I learned about Spec Kit, functional testing, system architecture, and teamwork in a real software-development process. If I worked on a similar project again, I would focus on keeping requirements, implementation, testing, and documentation consistent with one another from the beginning.

### Nguyễn Minh Khôi

*Performed by: Nguyễn Minh Khôi | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

I was responsible for reconciling the Non-Functional Requirements and scope boundaries in the Vision Document, authoring the new DGM-06 (Analytics and Export) and DGM-07 (Administrator Backup) use cases and specifications, and updating the C4 Level 2 Container, Level 3 Backend, and Deployment architecture diagrams. To avoid merge conflicts and maintain consistency, I collaborated closely with other members throughout the project. This work strengthened my skills in multi-tier C4 modeling and traceability and reinforced the crucial lesson that technical documentation must reflect verified codebase truth rather than aspirational plans. In future projects, I will integrate documentation synchronization continuously into the feature pull-request lifecycle and CI/CD pipelines instead of deferring full alignment to a final consolidation phase.

## 7. Conclusion

*Performed by: Group 9 | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

SmartHire gave our team practical experience across the complete software-development lifecycle: teamwork, planning, requirements engineering, specification-driven development, UI/UX, full-stack implementation, architecture, testing, integration, and release preparation. The project also showed us that building many features is not the same as delivering a reliable product.

Our most important lesson is that a feature becomes credible only when its requirement, implementation, permissions, data behavior, environment dependencies, tests, and documentation tell the same story. In the same way, a team becomes effective only when members do more than accept assigned tasks: they must understand their responsibilities, work proactively, communicate blockers, and remain accountable for the result.

We recognize that our level of participation and responsibility was not always balanced. Some members carried additional review, correction, and integration work when other tasks progressed slowly or lacked sufficient ownership. Rather than treating this only as an individual problem, we understand that the group needed clearer expectations, earlier checkpoints, and a more decisive response to missed commitments.

If we developed SmartHire again, we would keep the main product scope smaller, plan the architecture and feature boundaries in greater detail, establish measurable ownership for every task, test high-risk scoring and integration edge cases earlier, synchronize documents within each feature review, and reserve more time for stabilization and demo rehearsal. We would continue using Spec Kit and AI tools, but we would ensure that every member understands and verifies the work produced with those tools.

Despite the difficulties, the project helped each member understand that software engineering is not simply writing code. It is the process of making shared decisions, coordinating different responsibilities, handling failures, supporting teammates, verifying outcomes, and delivering something that other people can use and trust.

## 8. Revision History

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Quốc Thành*

| Version | Date | Change | Reason |
| --- | --- | --- | --- |
| 1.0 | 25 August 2026 | Created the initial PA5 reflective report from PA1-PA5 evidence, current source-code audit, Spec Kit artifacts, planning documents, and testing material. | Provide a concrete and evidence-based reflection for the final submission. |
| 1.1 | 25 August 2026 | Reworked Team Experience, Spec Kit Experience, SDLC Feedback, and individual reflections to state concrete artifacts, observed challenges, responses, and future improvements. | Align the report with the required reflection framework and avoid generic claims. |
| 2.0 | 28 August 2026 | Rewritten using the official PA5 requirements, testing results, weekly reports, contribution evidence, and implementation lessons. | Produce a complete and practical final reflection aligned with the PA5 rubric. |
| 2.1 | 28 August 2026 | Added an honest reflection on uneven participation, limited initiative, task accountability, its effects on active members, and practical improvements for future teamwork. | Acknowledge a real team weakness constructively without blaming individual members. |
| 2.2 | 29 August 2026 | Replaced the five individual reflections with member-authored accounts, prepared Uy's evidence-based reflection from PA1-PA5 work history, and synchronized the team, testing, architecture, and SDLC lessons with those accounts. | Preserve each member's genuine perspective while keeping the report consistent, specific, and aligned with the PA5 requirement of three to five sentences per member. |
