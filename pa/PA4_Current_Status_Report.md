# PA4 Current Status Report - SmartHire Group 9

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

**Reference assignment:** [PA4-2026.pdf](./PA4-2026.pdf)  
**Reporting date:** 8 August 2026  
**Scope:** Concise status of the implemented system and PA4 submission artifacts.

## 1. Executive Summary

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

SmartHire currently provides an end-to-end candidate-facing recruitment platform covering identity and account security, candidate profile management, deterministic job discovery, application submission and tracking, CV import/review, purpose-specific OCR, and image-assisted job search. The implemented baseline is organized as Features 001-005 and uses a full-stack Next.js application with PostgreSQL and separate email, CV, image-search, malware-scanning, and OCR processes.

The PA4 architecture package has been updated to reflect the current source code and local deployment. Most required artifacts are present. Remaining release work is concentrated in final Feature 005 regression evidence, usability evidence, release sign-off, test-suite cleanup, and submission packaging.

## 2. Implemented System Baseline

*Performed by: Nguyễn Quốc Thành and Ngô Quốc Tuấn | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

| Feature | Current capability | Status |
| --- | --- | --- |
| 001 - Identity, Authentication, and Account Recovery | Registration, email verification, login/logout, opaque sessions, password reset, TOTP 2FA, backup codes, session management, and account recovery | Implemented; post-implementation usability evidence remains open |
| 002 - Candidate Profile and Account Management | Candidate profile, skills, experience, education, social links, avatar, identity updates, preferences, and account security settings | Implemented; final accessibility/usability evidence remains open |
| 003 - Job Board and Advanced Search | Public job browsing, deterministic filters, job details, save/report actions, application submission, applied-job tracking, recommendation settings, and canonical application stages | Implemented; some migration, full regression, accessibility, performance, and usability evidence remains open |
| 004 - CV Upload, Parse, and Review | PDF/DOCX upload, malware scanning, native extraction, optional parsing, review/edit/confirm flow, consent, retention, retry, and Candidate CV reuse during Apply | Implementation task list complete |
| 005 - Purpose-Specific OCR and Image Search | Native-first CV OCR fallback, network-isolated OCR Engine, image upload/scan/normalize/OCR, evidence-bound filter proposals, consent, fallback, and strict artifact deletion | Implemented; 3 final release/usability tasks remain open |

Feature task status at the time of this report is **713 of 724 tasks complete** across Features 001-005. Feature 004 is fully checked in its task list; Feature 005 has 139 of 142 tasks checked.

## 3. Current Architecture and Technology

*Performed by: Nguyễn Minh Khôi and Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

### 3.1 Main Runtime Containers

*Performed by: Nguyễn Minh Khôi | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

- **Next.js Web Application:** Next.js 16.3, React 19, TypeScript 5.9, Tailwind CSS 4, Better Auth, Zod, and Prisma client. It contains both the frontend UI and backend Route Handlers/services.
- **Email Worker:** Separate Node.js process that claims durable email outbox rows and uses local capture, SMTP, or Resend adapters.
- **CV Worker:** Node.js/TypeScript Docker service for scanning, native-first extraction, optional OCR/parsing, cleanup, and reconciliation.
- **Image Search Worker:** Node.js/TypeScript Docker service for scanning, normalization, OCR orchestration, search-intent proposal generation, and cleanup.
- **OCR Engine:** Network-isolated Python 3.12 container using FastAPI, PaddleOCR, and ONNX Runtime over a private Unix socket.
- **Malware Scanner:** ClamAV 1.4 service accessed over a private Unix socket.
- **PostgreSQL:** PostgreSQL 16.12 system of record and durable-work coordination store.
- **Private artifact stores:** Application-encrypted local filesystem by default; optional S3/KMS adapters are implemented but external AWS infrastructure is not provisioned.

### 3.2 External Services

*Performed by: Nguyễn Minh Khôi | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

- Email delivery through SMTP or Resend is optional; local capture is the default.
- OpenAI Responses API is optional and consent-gated for structured CV parsing and image-search intent interpretation.
- ClamAV signature updates use the external definition service through `freshclam`.

### 3.3 Architecture Documentation

*Performed by: Lưu Chí Hải and Nguyễn Minh Khôi | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

The PA4 package currently includes:

- Technology Stack document.
- C4 Level 1 System Context Diagram.
- C4 Level 2 Container Diagram.
- C4 Level 3 Frontend logical component view.
- C4 Level 3 Backend and worker component views.
- Deployment Diagram with one logical node per container/process/data store.

All diagrams are maintained as Mermaid inside Markdown and are scoped to the implemented Features 001-005 baseline.

## 4. PA4 Requirement Status

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

| PA4 section | Available evidence | Current assessment |
| --- | --- | --- |
| A - Revised Use-Case Specification | Consolidated use-case model/specification and one PA4 `Changes.md` are present | Available; requires final editorial and traceability review before packaging |
| B - Tech Stack and System Context | Technology Stack and C4 Level 1 Mermaid document are present | Substantially complete and synchronized with Features 001-005 |
| C - Container and Component Diagrams | Level 2 Container plus frontend/backend Level 3 Mermaid documents are present | Substantially complete; component responsibilities and relationships are documented |
| D - Deployment Diagram | Mermaid deployment view and node-description table are present | Complete for the current local deployment; each container is represented as a separate logical node |
| E - Two Functional Groups using Spec Kit | Feature 004 and Feature 005 contain spec, plan, tasks, implementation, and generated tests | Feature 004 complete; Feature 005 requires final evidence and sign-off |
| F - AI Usage and Weekly Report | Five member AI-usage directories and PA4 Weekly Report Markdown/PDF are present | Available; final link, screenshot, and completeness review is still required |

## 5. Verification Snapshot

*Performed by: Development Team | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Nguyễn Gia Quốc Uy*

The latest repository review produced the following results:

| Check | Result |
| --- | --- |
| TypeScript typecheck | Pass |
| Production build | Pass; 57 routes generated |
| ESLint | Pass with 0 errors and 1 image-optimization warning |
| Prisma schema validation | Pass |
| Feature 005 focused suite | 126 of 128 tests passed; 2 source-format-sensitive assertions failed |
| Architecture suite | 37 of 41 tests passed; 4 boundary assertions require source/test reconciliation |
| Full Vitest suite | Did not finish within the 360-second review window; final aggregate result not established |
| Migration verification | Not established during the review because the Docker verification command failed to start |

Passing build and type checks confirm that the application compiles, but the PA4 submission should not claim a fully green release until focused/full tests and migration verification complete successfully.

## 6. Remaining PA4 Actions

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

1. Complete Feature 005 tasks T136, T139, and T142: regression evidence, representative usability evidence, and final release sign-off.
2. Reconcile the remaining architecture and Feature 005 test failures, distinguishing outdated source-format assertions from real boundary defects.
3. Run clean migration verification with Docker available and preserve non-sensitive evidence.
4. Perform a final English/editorial review of all PA4 Markdown documents and regenerate matching PDFs.
5. Verify every section includes performed/reviewed/edited attribution.
6. Confirm the narrated demo video and YouTube link demonstrate Features 004 and 005 end-to-end.
7. Verify AI usage logs, Weekly Report, Jira screenshots, and Git log evidence.
8. Exclude `node_modules`, virtual environments, build output, local artifacts, and secrets from `PA4-Group09.zip`.

## 7. PA4 Readiness Statement

*Performed by: Nguyễn Gia Quốc Uy | Reviewed by: Group 9 | Edited by: Nguyễn Gia Quốc Uy*

The functional and architecture foundations required for PA4 are present. The package is **near submission-ready but not yet release-signed-off** because final Feature 005 evidence, migration verification, failing-test reconciliation, PDF synchronization, and packaging checks remain outstanding.
