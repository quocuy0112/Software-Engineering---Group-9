# Project Plan: SmartHire Recruitment System

## 1. Introduction
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Nguyễn Gia Quốc Uy*

SmartHire is an AI-assisted recruitment management platform designed to streamline enterprise hiring workflows. It addresses fragmented, manual recruitment processes by centralizing job posting, candidate application tracking, and hybrid CV screening. This helps recruiters reduce screening time while providing candidates with a transparent application experience.

## 2. Project Overview
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Nguyễn Gia Quốc Uy*

* **Goals:** To build a centralized, end-to-end recruitment pipeline that combines rule-based matching with AI-assisted CV screening and human-readable score explanations.
* **Scope:** The system supports Candidates, company-scoped Recruiters/HR Managers, and System Administrators. It encompasses 12 core functional groups, including:
  - Authentication, authorization, and multi-tenant access control
  - Candidate profile and CV management
  - Job Board & Advanced Search
  - Job Posting Management
  - Hybrid Candidate Screening
  - Kanban Recruitment Pipeline
  - Notifications, employer verification, moderation, and recruitment analytics
* **Delivery Form:** Responsive Web Application.
* **Deliverables:**
    * A frontend client built with Next.js, TypeScript, Tailwind CSS, and Zustand, incorporating Shadcn UI for components and hello-pangea/dnd for interactive Kanban boards
    * A backend layer utilizing Next.js API Routes structured with a Layered Architecture (Controllers, Services, Repositories) and a relational database (PostgreSQL/MySQL).
    * Required software engineering documentation (Vision Document, Project Plan, SDD, Weekly Reports, AI Usage Reports).
* **Assumptions:** The project assumes consistent access to a supported AI provider (or sufficient computational resources for a local model) for semantic CV analysis and score explanations. It is also assumed that all team members maintain availability to complete their designated sprint tasks as planned.

## 3. Project Organization
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Nguyễn Gia Quốc Uy*

### 3.1. Team Structure and Roles
The team operates as Full-Stack AI Developers. The specific roles are distributed as follows:
* **Nguyễn Gia Quốc Uy:** Project Manager & Lead Spec Writer.
* **Nguyễn Quốc Thành:** AI Integration Lead & Backend Developer.
* **Lưu Chí Hải:** Lead UI/UX Designer & Frontend Developer.
* **Nguyễn Minh Khôi:** Quality Assurance (QA) & Frontend Developer.
* **Ngô Quốc Tuấn:** Database Architect & Backend Developer.

### 3.2. Risk Management
* **Integration Risk with AI API:** Unexpected rate limits, costs, or API downtime. *Mitigation:* Maintain a deterministic matching fallback, test provider endpoints early, and evaluate a lightweight local model only if sufficient time and team capacity remain.
* **Scope Creep:** The complexity of features such as the interactive Kanban board and AI-assisted scoring might exceed the sprint timeframes. *Mitigation:* Strictly adhere to the sprint backlog. Prioritize core functional requirements first and defer 'nice-to-have' UI polish to PA5.
* **Team Member Unavailability:** Unexpected absences could delay sprint deliverables. *Mitigation:* The team will cross-train members for critical tasks and use daily scrums to identify blockers promptly.

## 4. Project Plan
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Nguyễn Gia Quốc Uy*

The project applies the Scrum process and is organized into 5 Sprints, each corresponding to one Project Assignment (PA) and lasting 2-3 weeks. Work tasks and tracking are maintained consistently via the team's Notion Workspace.

### 4.1. Schedule
* **Sprint 1 (PA1):** Completed.
* **Sprint 2 (PA2):**
    - Setup & Initialize Spec Kit: Assigned to Nguyễn Gia Quốc Uy (Due: 06/16/2026).
    - Vision Doc (Introduction & Positioning): Assigned to Ngô Quốc Tuấn (Due: 06/16/2026).
    - Vision Doc (Stakeholder & User Description): Assigned to Nguyễn Quốc Thành (Due: 06/16/2026).
    - Vision Doc (Product Overview): Assigned to Nguyễn Minh Khôi (Due: 06/16/2026).
    - 1st Meeting Minutes for PA2 & Project Plan: Assigned to Lưu Chí Hải (Due: 06/16/2026).
    - Learn Spec Kit & Log Study Diary: Assigned to All members (Nguyễn Gia Quốc Uy, Lưu Chí Hải, Nguyễn Quốc Thành, Ngô Quốc Tuấn, Nguyễn Minh Khôi) (Due: 06/16/2026).
* **Sprint 3 (PA3) to Sprint 5 (PA5):**     
*Note: The schedule and tasks from Sprint 3 (PA3) to Sprint 5 (PA5) are tentative and might be changed in the future.*
    - **Sprint 3 (PA3):** Focus on finalizing the Project Plan, implementing the database schema, and building core Authentication (JWT) APIs.
    - **Sprint 4 (PA4):** Focus on integrating the frontend Kanban Recruitment Pipeline, Job Board UI, and initial AI semantic scoring module.
    - **Sprint 5 (PA5):** Focus on full system integration, end-to-end testing, bug fixing, and preparation for the final project demo.

### 4.2. Build Plan
The team plans to release three primary builds across the remaining sprints:
* **Build 1 (End of Sprint 3):** Core infrastructure setup, including database schemas and functional user authentication.
* **Build 2 (End of Sprint 4):** Major feature integration, including the Kanban board, Job Feed, and core AI screening functions.
* **Final Build (End of Sprint 5):** A fully integrated, polished, and tested application ready for the final project demo.
