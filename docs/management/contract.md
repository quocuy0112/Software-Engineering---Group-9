# Team Contract: SmartHire Recruitment Platform
`Author: Nguyen Gia Quoc Uy, Reviewer: Nguyen Quoc Thanh`


## Document Control
| Version | Date | Description | Author | Reviewer |
| :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-06-04 | Initial version using Jira for tracking | Nguyen Gia Quoc Uy | Nguyen Quoc Thanh |
| 1.1.0 | 2026-06-04 | Updated tracking tool from Jira to Notion Workspace | Nguyen Gia Quoc Uy | Nguyen Quoc Thanh |
| 1.2.0 | 2026-06-06 | Updated team members information | Nguyen Gia Quoc Uy | Nguyen Quoc Thanh |

---

## 1. General Team Information & Account Mapping

* **Group Name:** Group 9
* **Project Name:** SmartHire - AI-assisted Recruitment Management Platform
* **Project Links & Resources:**
  * **GitHub Repository:** https://github.com/quocuy0112/Software-Engineering---Group-9
  * **Notion Workspace:** https://app.notion.com/p/44845e0594b0825aa36c01dd55110f82?v=23745e0594b083f5aaeb88da62ff2ef8&source=copy_link
  * **Primary Chat Channel:** https://discord.gg/pB6meF3w

### Member Account Directory
| No. | Full Name | Student ID | Email | GitHub Username | Notion Account / Username | Primary Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Nguyen Gia Quoc Uy | 24127261 | ngquy2413@clc.fitus.edu.vn (quocuy0112@gmail.com) | @Uynguyen12 (@quocuy0112) | @Nguyễn Gia Quốc Uy | Project Manager / Developer |
| 2 | Nguyen Quoc Thanh | 24127542 | nqthanh2435@clc.fitus.edu.vn | @daksdlkasd (@JK Dev) | @Nguyễn Thành | Lead Developer |
| 3 | Luu Chi Hai | 24127030 | lchai2429@clc.fitus.edu.vn | @ChuHaiLi (@Chu Hai Li) | @Chí Hải Lưu | UI/UX Designer / Developer |
| 4 | Nguyen Minh Khoi | 24127066 | nmkhoi2414@clc.fitus.edu.vn | @KhoiNM (@ProDev-cpu) | @NguyenMinhKhoi | QA Engineer / Developer |
| 5 | Ngo Quoc Tuan | 24127581 | nqtuan2422@clc.fitus.edu.vn | @phucrom105 | @Tuấn | Full-stack Developer |

---

## 2. Roles & Responsibilities in the AI-First & "Vibe Coding" Era

In the era of AI-assisted development and "Vibe Coding", the team operates as Full-Stack AI Pilots. Rather than writing syntax manually, members focus on designing technical specifications, orchestrating AI generation, and verifying the outputs. The workload is divided into specialized roles to ensure high integration quality:
* **Project Manager & Lead Spec Writer (Nguyen Gia Quoc Uy):**
  * Coordinates project milestones, sprint backlogs, and updates the Notion Task Tracker.
  * Responsible for writing the primary **Spec Kit** files (system blueprints, API contracts, and user flow requirements).
  * Manages the team's system prompts, context files, and acts as the primary contact for TAs.
* **AI Integration Lead & Backend Pilot (Nguyen Quoc Thanh):**
  * Focuses on prompt engineering for the Open AI API (optimizing prompts for CV parsing and sifting).
  * Primarily pilots AI tools (Cursor/Copilot) to generate backend API routes, services, and AI controller logic based on the Spec Kit documents.
* **Database Architect & Backend Pilot (Ngo Quoc Tuan):**
  * Designs the relational database schema (PostgreSQL/MySQL), table structures, and data relations.
  * Coordinates database migration scripts and assists the AI Integration Lead in generating backend database query code.
* **Lead UI/UX Designer & Frontend Pilot (Luu Chi Hai):**
  * Designs the visual concept, wireframes, and component design tokens in Figma.
  * Primarily pilots AI tools to generate Next.js page layouts, interactive components, and styles using Tailwind CSS and Shadcn UI.
* **Quality Assurance (QA) & Frontend Pilot (Nguyen Minh Khoi):**
  * Conducts the final "vibe check" (User Acceptance Testing) to ensure the system flows seamlessly.
  * Writes test specifications and coordinates manual and automated testing.
  * Assists the Lead UI/UX Designer in piloting AI tools to build frontend dashboards and client state management (Zustand).

---

## 3. Communication & Meeting Protocols

To maintain collaboration and keep tasks moving forward, the team agrees to the following communication guidelines:
* **Primary Channels:** **Discord** is used for official meetings, screen-sharing, and task-related messages. **Zalo** and **Messenger** are reserved for urgent alerts and general announcements.
* **Scrum Meeting Schedule:**
  * **Sprint Planning & Review:** Occurs at the start and end of each Sprint (corresponds to each Project Assignment).
  * **Daily Scrum:** 2 meetings per sprint (conducted online via Discord, capped at 15 minutes to review: What did you do? What will you do? Are there any blockers?).
* **Response Time SLA:**
  * **General Discord Messages:** Must be answered within **3 hours** during working hours (8:00 AM - 10:00 PM).
  * **Urgent Zalo/Direct Call Alerts:** Must be addressed within **30 minutes**.

---

## 4. Work Schedule, Deadlines & Contingency Plans

* **Project Milestones:** The team follows the deadline schedule defined by the course syllabus (PA1 to PA5).
* **Strict Deadline Rule:** Individual task deliverables must be committed and pushed to GitHub at least **24 hours prior to the official assignment deadline** to allow for integration, checking, and final PDF generation.
* **Contingency Protocol:** If a member encounters an emergency or expects a delay, they must notify the PM via group chat in Messenger immediately. The PM will reallocate tasks or assign another team member to support.

---

## 5. Code & Documentation Standards

* **Coding Conventions:** Strictly write in TypeScript. Frontend components must follow Next.js (React) structure and utilize utility styles from Tailwind CSS. Prettier and ESLint are enforced before code is committed.
* **Git Branching Workflow:**
  * No member is permitted to push code directly to the `main` branch.
  * Every task must be developed on a dedicated branch named: `type/brief-feature-name` (e.g., `feat/auth-login`, `docs/team-contract`).
  * Merging to `main` requires a Pull Request (PR) with at least **one approval** from a peer reviewer.
* **Commit Message Format:** Must adhere to the **Conventional Commits** standard (e.g., `feat(auth): add register validation`, `docs(survey): add topcv screenshots`).
* **Document Formatting:** Written in Markdown (`.md`) format. Diagrams must be drawn using **Mermaid syntax**. Converted PDFs must be generated using Times New Roman (font size 13 - optional).

---

## 6. Performance Evaluation & Accountability

* **Contribution Criteria:**
  * Completing assigned Notion tasks on time.
  * Attending and participating in all scheduled Scrum meetings.
  * Writing clean, spec-compliant code and documentation.
* **Escalation Process for Underperformance:**
  * **1st Occurrence:** Verbal warning during the next Scrum meeting and logging on the meeting notes.
  * **2nd Occurrence:** Written warning issued on the team channel; the member must submit a catch-up plan within 24 hours.
  * **3rd Occurrence:** Lowering the member's contribution percentage in the final report (below 50%) and reporting the situation directly to the course TA/Instructor.

---

## 7. Decision-Making & Conflict Resolution Process

* **Decision-Making:** Decisions regarding architecture, UI design, and features are decided through team consensus. If a vote is tied, the **Project Manager (Nguyen Gia Quoc Uy)** has the final deciding vote to ensure the project timeline is maintained.
* **Conflict Resolution Workflow:**
  * **Step 1 (Internal Dialogue):** The disputing parties will hold a private meeting moderated by the PM to find a technical compromise.
  * **Step 2 (Team Voting):** If unresolved, the issue is presented to the entire group for a majority vote.
  * **Step 3 (TA Escalation):** If a conflict severely affects team progress and cannot be resolved internally, the PM will escalate it to the TA or instructor for academic arbitration.

---

## 8. Review and Update Process

* This contract is a living document and will be reviewed at the end of each Sprint (Project Assignment).
* Amendments to the contract, role allocations, or communication protocols must be proposed during a Sprint Planning session and approved by a unanimous vote of all 5 members.

---

## 9. Agreement & Signatures

*By adding our names below, we confirm that we have read, understood, and agreed to all terms, rules, and expectations outlined in this Team Contract:*

* **Nguyen Gia Quoc Uy** (Project Manager) – *Confirmed at 10:30 PM, June 4, 2026*
* **Nguyen Quoc Thanh** (Lead Developer) – *Confirmed at 11:02 PM June 6*
* **Luu Chi Hai** (UI/UX Designer) – *Confirmed at 11:06 PM June 6*
* **Nguyen Minh Khoi** (QA Engineer) – *Confirmed at 11:15 PM June 6*
* **Ngo Quoc Tuan** (Full-stack Developer) – *Confirmed at 11:30 PM June 6*