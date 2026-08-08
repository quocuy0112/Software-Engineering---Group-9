# PA5 Preliminary Plan - SmartHire Group 9

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

**Reference assignment:** [PA5-2026.pdf](./PA5-2026.pdf)  
**Planning horizon:** 2-3 weeks  
**Plan status:** Preliminary; owners and dates must be confirmed during Sprint Planning.

## 1. PA5 Objectives

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

PA5 is the final validation and delivery phase. The team must stabilize every functional group retained in the final project scope, understand and refine generated tests, execute at least 50 documented functional test cases, link failures to reproducible bug reports, deliver a 15-minute live product demo, write a reflective report, and package the final PA1-PA5 documents with the complete source and Spec Kit artifacts.

The recommended team objective is: **reach a feature-complete, reproducible, evidence-backed release candidate before demo rehearsal begins.**

## 2. Entry Baseline and Immediate Gaps

*Performed by: Development Team | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

### Available Baseline

*Performed by: Development Team | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

- Five Spec Kit feature groups (001-005) with specifications, plans, tasks, implementation, and generated tests.
- Candidate-facing identity, profile, job, application, CV import, OCR, and image-assisted search workflows.
- C4 Level 1-3 and Deployment architecture documents synchronized to the current implementation.
- Existing Vitest, Playwright, accessibility, security, architecture, integration, and performance-oriented test suites.
- PA4 AI usage and Weekly Report evidence.

### Gaps to Close Before PA5 Exit

*Performed by: Development Team | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

- Confirm the final approved functional-group scope and complete every retained group.
- Close the remaining Feature 001-003 evidence tasks and Feature 005 release tasks.
- Review all generated tests; remove brittle assumptions and add missing functional/edge coverage.
- Resolve all release-relevant failing tests and complete clean migration verification.
- Produce manual test execution evidence, linked bug reports, final demo script, reflective report, and final synchronized PA1-PA5 package.

## 3. Workstream A - Test Plan and Test Cases (30 Points)

*Performed by: QA Lead and Feature Owners | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Documentation Owner*

### 3.1 Test Plan Contents

*Performed by: QA Lead | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Documentation Owner*

The final Test Plan will include:

1. Test objectives and scope.
2. Features and use cases under test.
3. Test environment, test data, browsers, database state, external-adapter configuration, and tools.
4. Test schedule and named responsibilities.
5. Entry criteria and exit criteria.
6. Test execution procedure and evidence-storage convention.
7. Defect severity/status definitions and bug-report workflow.

### 3.2 Proposed Functional Test Coverage

*Performed by: Feature Owners | Reviewed by: QA Lead | Edited by: Documentation Owner*

Plan for **6 use cases x 10 test cases = 60 functional test cases**, providing a buffer above the required minimum of 50:

| Use-case group | Minimum cases | Important coverage |
| --- | ---: | --- |
| Registration, login, verification, and recovery | 10 | Valid/invalid credentials, unverified account, lockout, reset replay, recovery cancellation |
| Profile, account, preferences, and security | 10 | CRUD validation, revision conflicts, avatar, password change, TOTP, session revocation |
| Job discovery and user actions | 10 | Keyword/filter combinations, pagination, empty results, save/remove, report, deterministic ordering |
| Application submission and tracking | 10 | Required fields, CV selection, duplicate/idempotent submission, canonical stages, applied-job details |
| CV upload, parse, review, and confirmation | 10 | PDF/DOCX, malware rejection, parse failure/retry, consent, review decisions, Candidate CV projection |
| OCR and image-assisted job search | 10 | Valid/invalid images, OCR quality, consent/revocation, fallback, proposal review, deterministic filter application, deletion evidence |

AI-assisted outputs will be tested for functional correctness using controlled inputs, schema/evidence requirements, consent behavior, safe fallback, and deterministic downstream filtering rather than expecting one exact natural-language response.

### 3.3 Required Test-Case Fields

*Performed by: QA Lead | Reviewed by: Feature Owners | Edited by: Documentation Owner*

Each test case will record:

- Test case ID and linked use case/requirement.
- Preconditions and test data.
- Numbered execution steps.
- Expected result.
- Execution date and environment.
- Actual result.
- Pass/Fail status.
- Evidence reference.
- Linked bug ID for every failed case.

### 3.4 Bug Report and Test Summary

*Performed by: QA Lead | Reviewed by: Release Coordinator | Edited by: Documentation Owner*

Each bug report will contain bug ID, description, environment, preconditions, reproduction steps, expected result, actual result, severity, status, owner, related test cases, and fix/retest evidence. The final summary will show total tests, passed/failed counts, and defect counts per feature. Historical bugs found and fixed during PA5 will remain in the report even when the final rerun passes.

## 4. Workstream B - Final Product and Demo (110 Points)

*Performed by: All Team Members | Reviewed by: Demo Coordinator | Edited by: Nguyễn Gia Quốc Uy*

### 4.1 Product Completion Plan

*Performed by: Development Team | Reviewed by: Release Coordinator | Edited by: Nguyễn Gia Quốc Uy*

1. Freeze the final functional-group scope during the first PA5 Sprint Planning meeting.
2. Complete unfinished functionality and release evidence before broad manual execution.
3. Establish one reproducible demo environment and deterministic seed data.
4. Run migration, seed, typecheck, lint, build, focused tests, full tests, and critical E2E smoke tests.
5. Fix release-blocking defects before demo rehearsal; document deferred non-blocking issues honestly.

### 4.2 Proposed 15-Minute Demo Run-of-Show

*Performed by: Demo Coordinator | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

| Segment | Target time | Content |
| --- | ---: | --- |
| Product introduction | 1-2 minutes | Problem, target users, and current product position |
| Workflow 1 | 3 minutes | Register/login, account security, profile setup, and CV import/review |
| Workflow 2 | 4 minutes | Deterministic job discovery, image-assisted search, filter review, job details, and application submission |
| Workflow 3 | 2 minutes | Applied-job tracking, canonical recruitment stages, saved jobs, and recommendation settings |
| Technical overview | 2-3 minutes | Tech stack, C4 diagrams, worker/OCR deployment, privacy controls, and Spec Kit workflow |
| Buffer | 1 minute | Transition, recovery from demo delay, or concise closing |

Every team member must present at least one feature or technical section. No slides are required; architecture diagrams may be referenced briefly during the technical overview.

## 5. Workstream C - Reflective Report (20 Points)

*Performed by: All Team Members | Reviewed by: Documentation Owner | Edited by: Nguyễn Gia Quốc Uy*

The report will use concrete project evidence and cover:

1. Team experience: effective practices, coordination challenges, technical challenges, and outcomes.
2. Spec Kit experience: benefits, limitations, examples of specification/task/test traceability, and lessons learned.
3. AI tool usage: effective uses, incorrect suggestions, verification practices, privacy considerations, and limits.
4. SDLC feedback: actionable recommendations about PA timing, artifacts, reviews, tooling, and workload.
5. Individual contributions: 3-5 specific sentences from every member describing contribution and learning.

Generic reflections should be rejected during review. Every major statement should refer to an actual decision, defect, workflow, or team event.

## 6. Workstream D - Final Submission Package

*Performed by: Release Coordinator | Reviewed by: Group 9 | Edited by: Documentation Owner*

The final `PA5-Group09.zip` should contain:

- Final PA1-PA5 Markdown documents and synchronized PDFs.
- Complete source code without `node_modules`, virtual environments, generated build output, local storage, or secrets.
- All Spec Kit specs, plans, tasks, checklists, and generated/refined tests.
- Test Plan, functional test cases, execution results, test summary, and linked bug reports.
- Final AI Usage Report.
- Reflective Report with individual contributions.
- Git log evidence.
- Demo instructions/link and any required supporting evidence.

Before packaging, run a consistency pass across terminology, feature status, architecture, ports, commands, links, filenames, dates, authorship attribution, and final PDF rendering.

## 7. Preliminary Schedule

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

| Period | Primary outcomes |
| --- | --- |
| Days 1-2 | Sprint Planning; confirm final scope, owners, environments, document templates, test IDs, and evidence locations |
| Days 3-6 | Complete remaining features/evidence; review generated tests; design/refine 60 functional test cases; prepare deterministic test data |
| Days 7-10 | Execute test cases; log bugs; fix high/critical defects; rerun failed cases; update architecture and prior PA documents |
| Days 11-13 | Complete regression, migration, accessibility, performance, and release gates; finalize test summary and bug report |
| Days 14-16 | Rehearse the 15-minute live demo; finalize reflective and AI usage reports; synchronize Markdown/PDF artifacts |
| Days 17-18 | Independent package audit, Git evidence capture, clean-environment rehearsal, final ZIP creation, and submission buffer |

## 8. Tentative Responsibility Matrix

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

Assignments are preliminary and must be confirmed by the team.

| Member | Tentative PA5 responsibility |
| --- | --- |
| Nguyễn Gia Quốc Uy | Sprint/release coordination, integration review, final scope, package audit, and demo coordination |
| Nguyễn Quốc Thành | Identity/profile/CV functional test ownership, defect fixes, and demo workflow 1 |
| Ngô Quốc Tuấn | Job/application/image-search functional tests, defect triage, and demo workflow 2/3 |
| Lưu Chí Hải | Test Plan/Test Case document coordination, execution summary, Weekly/Reflective documentation, and evidence tracking |
| Nguyễn Minh Khôi | Architecture/deployment verification, OCR/worker testing, migration/environment checks, and technical demo overview |

Every feature owner remains responsible for reviewing generated tests, explaining expected behavior, fixing defects, and providing retest evidence for that feature.

## 9. Entry and Exit Criteria

*Performed by: QA Lead | Reviewed by: Release Coordinator | Edited by: Documentation Owner*

### Entry Criteria for Formal Test Execution

*Performed by: QA Lead | Reviewed by: Release Coordinator | Edited by: Documentation Owner*

- Final feature scope is approved and traceable to Spec Kit artifacts.
- Required migrations apply successfully to a clean database.
- Deterministic seed/test data is available.
- Critical workflows are deployable in the agreed test environment.
- Test cases have been peer-reviewed and expected results are understood.

### Exit Criteria for Final Submission

*Performed by: Release Coordinator | Reviewed by: Group 9 | Edited by: Documentation Owner*

- Every retained functional group is implemented and demonstrable.
- At least 50 functional test cases have recorded execution results; the target is 60.
- Every failed test links to at least one complete bug report and has a documented disposition.
- No unresolved critical or high-severity release blocker remains.
- Typecheck, lint, production build, migration verification, critical focused suites, and demo smoke tests pass.
- Final demo completes within 15 minutes and every member participates.
- Reflective Report, AI Usage Report, Git evidence, and all PA1-PA5 Markdown/PDF files pass final review.
- `PA5-Group09.zip` is opened and checked after creation.

## 10. Key Risks and Mitigations

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

| Risk | Mitigation |
| --- | --- |
| Final scope is larger than the available time | Freeze scope immediately; classify must-demo versus deferred work only through an approved document change |
| Generated tests are brittle or misunderstood | Require feature-owner review, behavior-based assertions, and peer approval before counting tests as final evidence |
| Docker/OCR/external adapters make the demo unstable | Use a clean rehearsal environment, preflight checks, deterministic adapters where permitted, and documented fallback behavior |
| Manual execution evidence becomes inconsistent | Use one template, stable test IDs, named executors, controlled test data, and one evidence index |
| Documentation diverges from implementation | Run a final source-to-document architecture and command audit after feature freeze |
| Demo exceeds 15 minutes | Time every segment, use seeded accounts/data, assign transitions, and preserve a one-minute recovery buffer |

## 11. Definition of PA5 Success

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

PA5 succeeds when SmartHire is feature-complete for the approved scope, reproducibly deployable, validated by understood and executed tests, free of unresolved release-blocking defects, demonstrable through realistic end-to-end workflows, and delivered with consistent final documentation and evidence.
