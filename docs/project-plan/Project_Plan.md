# Project Plan: SmartHire Recruitment System

## 1. Introduction
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

SmartHire is an AI-assisted Recruitment Management Platform designed to streamline the hiring workflow enterprises. The platform solves manual, fragmented recruitment workflows by centralizing job posting, candidate application tracking, and applying AI for semantic CV screening. This helps recruiters drastically reduce sifting time while providing candidates with a transparent, feedback-rich application experience.

## 2. Project Overview
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

* **Goals:** To build a centralized, end-to-end recruitment pipeline that utilizes the OpenAI API to automate CV screening and job description generation.
* **Scope:** The system supports three distinct roles: Candidates, Recruiters, and System Admins. It encompasses 10 core functional groups, including: 
- Role-Based Access Control
- AI Resume Builder
- Job Board & Advanced Search
- Kanban Recruitment Pipeline
- Recruitment Analytics 
The application will be delivered as a Responsive Web Application.
* **Deliverables:** 
    * A frontend client built with Next.js, TypeScript, Tailwind CSS, and Zustand, incorporating Shadcn UI for components and hello-pangea/dnd for interactive Kanban boards
    * A backend layer utilizing Next.js API Routes structured with a Layered Architecture (Controllers, Services, Repositories) and a relational database (PostgreSQL/MySQL).
    * Required software engineering documentation (Vision Document, Project Plan, SDD, Weekly Reports, AI Usage Reports).
* **Assumptions:** The project assumes consistent access to the OpenAI API (or sufficient computational resources for a local model) for the AI features. It is also assumed that all team members maintain availability to complete their designated sprint tasks as planned.

## 3. Project Organization
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

### 3.1. Team Structure and Roles
The team operates as Full-Stack AI Developers. The specific roles are distributed as follows:
* **Nguyễn Gia Quốc Uy:** Project Manager & Lead Spec Writer.
* **Nguyễn Quốc Thành:** AI Integration Lead & Backend Developer.
* **Lưu Chí Hải:** Lead UI/UX Designer & Frontend Developer.
* **Nguyễn Minh Khôi:** Quality Assurance (QA) & Frontend Developer.
* **Ngô Quốc Tuấn:** Database Architect & Backend Developer.

### 3.2. Risk Management
* **Integration Risk with AI API:** Unexpected rate limits, costs, or API downtime. *Mitigation:* Ensure a fallback mechanism is in place (e.g., standard keyword matching) or prepare a lightweight local model (only if the team has enough time and everymember willing to do it). Test API endpoints early.
* **Scope Creep:** The complexity of features like the interactive Kanban board and AI generation might exceed the sprint timeframes. *Mitigation:* Strictly adhere to the sprint backlog. Prioritize core functional requirements first and defer 'nice-to-have' UI polish to PA5.
* **Team Member Unavailability:** Unexpected absences could delay sprint deliverables. *Mitigation:* The team allowing members to cross-train and take over critical tasks. Daily scrums will be used to identify blockers immediately.

## 4. Project Plan
*Performed by: Lưu Chí Hải, Reviewed by: Nguyễn Gia Quốc Uy, Edited by: Lưu Chí Hải*

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