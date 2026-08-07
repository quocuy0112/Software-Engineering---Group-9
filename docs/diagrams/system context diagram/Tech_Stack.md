# SmartHire Software Architecture — Technology Stack Document for PA4

| Document Metadata | Value |
|---|---|
| Author | Nguyễn Gia Quốc Uy (Student ID: 24127261) |
| Reviewers | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi |
| Target Milestone | PA4 — Software Architecture & System Context Diagram |

---

## 1. Architecture Overview

SmartHire is architected as an enterprise-grade, full-stack web application built on Node.js and Next.js App Router. The technology stack guarantees strong type safety, multi-tenant database isolation, containerized background workers, zero-trust file virus scanning, and advisory AI integration.

---

## 2. Layered Technology Breakdown

### 2.1 Presentation Layer (Frontend)
- **Framework & Runtime:** Next.js 16.3 (React 19 Server and Client Components).
- **Language & Type System:** TypeScript 5.9.3 with strict type enforcement.
- **Styling System:** Tailwind CSS v4, PostCSS 8, and Motion (v12.42) animation library.
- **Form & Validation:** React Hook Form (v7.82) with Zod (v4.3) schema validation.
- **State Management & Caching:** TanStack Query (React Query v5) for server state caching.
- **UI Notifications:** Sonner (v2.0) toast framework and `@fontsource/be-vietnam-pro` typography.

### 2.2 Application & API Layer (Backend)
- **API Architecture:** Next.js Route Handlers and Server Actions.
- **Data Sanitization:** Sanitize-HTML (v2.17) for XSS prevention.
- **Document Extractors:** PDF.js (PDF parsing), Mammoth (DOCX extraction), Yauzl (ZIP processing), Fast-XML-Parser.

### 2.3 Data & Storage Layer
- **Relational Database:** PostgreSQL 16.12 running inside Docker container.
- **Object Relational Mapping (ORM):** Prisma ORM v7.9.0 with `@prisma/adapter-pg` driver.
- **File Storage Infrastructure:** AWS S3 SDK (v3.1101) with local bind-mount fallback engine.

### 2.4 Security, Authentication & Isolation
- **Authentication Engine:** Better-Auth v1.6 with custom Prisma adapter.
- **Security Protocols:** Session cookies, TOTP 2FA, password hashing, rate limiting.
- **Malware Protection:** ClamAV Daemon v1.4 integrated via Unix Domain Sockets (`/run/clamav/clamd.sock`).
- **Authorization Model:** Multi-tenant company-scoped Role-Based Access Control (RBAC).

### 2.5 AI Engine & Asynchronous Workers
- **Semantic Evaluation Engine:** OpenAI API (GPT-4o/mini for candidate-job compatibility scoring).
- **Background Processing Workers:** Custom Node/TSX daemons running in Docker containers (`cv-worker`, `email-worker`).
- **Transactional Mail Service:** Resend API & Nodemailer rendered via React Email components.

### 2.6 Infrastructure, DevOps & Testing
- **Container Orchestration:** Docker Compose (`compose.yaml` managing PostgreSQL, ClamAV, and CV Worker).
- **Quality Assurance:** Vitest (Unit/Integration testing), Playwright (E2E automation), Axe-Core (Accessibility testing).

---

## 3. Technology Selection Rationale
- **Next.js 16 + React 19:** Combines Server Components for fast SEO job pages with Client Components for dynamic Kanban pipelines.
- **Prisma + PostgreSQL:** Ensures ACID compliance, schema migration tracking, and relational integrity.
- **ClamAV Integration:** Guarantees zero-trust virus inspection for uploaded candidate CV files before text parsing.
- **Better-Auth:** Provides modular session handling and multi-tenant authorization natively connected to Prisma schemas.

---

## 4. Detailed Component & Technology Analysis

### 4.1 Next.js (v16.3 App Router)
- **Where Used:** Root web application layer (`web/`), routing engine, page layouts, React Server Components (RSC), and API Route Handlers.
- **Responsibility:** Serves as the primary full-stack web framework handling server-side rendering, client-side routing, asset optimization, and backend API routes.
- **Why Suitable for SmartHire:** Provides high SEO performance for candidate job discovery pages via Server Components while allowing rich interactive dashboards (e.g., Kanban boards) for recruiters without needing separate frontend and backend repositories.

### 4.2 React 19 & TypeScript 5.9
- **Where Used:** UI component tree (`web/src/app/`, `web/src/components/`) and end-to-end full-stack codebase.
- **Responsibility:** React manages declarative UI rendering and component state; TypeScript enforces compile-time type safety across API boundaries, database models, and forms.
- **Why Suitable for SmartHire:** Eliminates common runtime type errors when handling complex recruitment data schemas (e.g., application stage history, multi-criteria scoring) and enables reusable component architecture.

### 4.3 Tailwind CSS v4 & Motion
- **Where Used:** Design system, component styling (`web/src/components/ui/`), responsive page layouts, and transition effects.
- **Responsibility:** Tailwind handles utility-first CSS styling and responsive layouts; Motion manages micro-animations, modal transitions, and drag-and-drop feedback.
- **Why Suitable for SmartHire:** Enables rapid development of a modern, visual-first recruitment interface with consistent spacing, dark/light accessibility tokens, and sleek micro-interactions without bloated custom CSS files.

### 4.4 React Hook Form & Zod
- **Where Used:** Auth pages (`web/src/app/(auth)`), candidate profile setup, job creation forms, and backend API validation (`web/src/shared/contracts`).
- **Responsibility:** Manages form state, handles client-side input validation, and enforces strict data schemas on both frontend inputs and backend API payloads.
- **Why Suitable for SmartHire:** Prevents unnecessary component re-renders during complex multi-step form entry (such as detailed job creation) and guarantees that invalid user data is caught before hitting backend APIs.

### 4.5 TanStack Query (React Query v5)
- **Where Used:** Client-side data fetching hooks (`web/src/hooks`), applicant list tables, and the recruitment Kanban board.
- **Responsibility:** Handles asynchronous server state fetching, background data synchronization, automatic caching, optimistic UI updates, and cache invalidation.
- **Why Suitable for SmartHire:** Keeps candidate status updates instantaneous on recruiter Kanban boards during drag-and-drop stage changes, eliminating full page reloads and reducing database load through smart caching.

### 4.6 PostgreSQL 16.12 (Docker Container)
- **Where Used:** Core relational database service managed via Docker Compose (`compose.yaml`).
- **Responsibility:** Provides persistent, relational storage for user accounts, candidate profiles, company structures, job postings, job applications, recruitment stage logs, and audit trails.
- **Why Suitable for SmartHire:** Ensures strict ACID transactional guarantees, relational data integrity, robust indexing for fast job searches, and reliable multi-tenant company data isolation.

### 4.7 Prisma ORM v7.9
- **Where Used:** Backend data layer (`web/prisma/schema.prisma`, `web/src/backend/db/`).
- **Responsibility:** Manages database schema migrations, auto-generates type-safe TypeScript query clients, manages connection pooling, and executes database queries.
- **Why Suitable for SmartHire:** Completely prevents raw SQL injection vulnerabilities, ensures database queries match TypeScript types automatically, and simplifies complex relational queries (such as candidate application histories).

### 4.8 Better-Auth v1.6
- **Where Used:** API authentication endpoints (`web/src/app/api/auth/`), auth middleware, session checkers, and multi-tenant authorization guards.
- **Responsibility:** Handles user registration, login, secure HTTP-only cookie session management, email verification tokens, TOTP two-factor authentication (2FA), and company role-based access control (RBAC).
- **Why Suitable for SmartHire:** Provides a battle-tested, security-compliant authentication framework natively integrated with Prisma, removing the risk of building custom session and security logic from scratch.

### 4.9 OpenAI API (GPT-4o / GPT-4o-mini)
- **Where Used:** AI candidate evaluation module (`web/src/backend/ai/`) and background CV analysis scripts.
- **Responsibility:** Evaluates candidate CV content against specific job requirements semantically, calculates hybrid matching scores, and generates human-readable score rationale summaries.
- **Why Suitable for SmartHire:** Overcomes the rigid limitations of basic keyword matching by understanding semantic context, while strictly providing advisory information to keep recruiters in full control of hiring decisions.

### 4.10 ClamAV Antivirus Daemon (Docker Container)
- **Where Used:** Security scanning layer (`infra/clamav/`) connected via Docker volume socket (`/run/clamav/clamd.sock`).
- **Responsibility:** Performs mandatory zero-trust malware and virus scanning on all candidate-uploaded CV files (PDF/DOCX) prior to text extraction.
- **Why Suitable for SmartHire:** Protects the enterprise application server and recruiter workstation devices from malicious file payloads uploaded by untrusted candidates.

### 4.11 AWS S3 SDK & Local Storage Engine
- **Where Used:** Document storage abstraction layer (`web/src/backend/storage/`).
- **Responsibility:** Manages secure file upload streams, presigned download URLs, and file deletion for candidate resumes and company verification documents.
- **Why Suitable for SmartHire:** Offers enterprise-grade cloud storage scalability for production environments (AWS S3) while maintaining zero-cost, offline local directory fallback for development.

### 4.12 PDF.js, Mammoth & Document Extractors
- **Where Used:** Background CV processing worker (`scripts/run-cv-worker.mjs`, `web/src/backend/cv-parser/`).
- **Responsibility:** Extracts structured text, sections, work history, and skills from uploaded PDF and Microsoft Word (.docx) resume files.
- **Why Suitable for SmartHire:** Runs locally on the server without relying on expensive, privacy-risking third-party SaaS resume parsing APIs, keeping candidate personal data private and compliant.

### 4.13 Resend / Nodemailer & React Email
- **Where Used:** Transactional email worker (`web/src/backend/email/`, `scripts/run-email-worker.mjs`).
- **Responsibility:** Renders type-safe HTML email templates using React and dispatches transactional emails for account verification, password resets, and candidate application notifications.
- **Why Suitable for SmartHire:** React Email allows designing email templates using existing React component skills, while Resend/Nodemailer guarantees high email deliverability.

### 4.14 Docker & Docker Compose
- **Where Used:** Root repository infrastructure orchestration (`compose.yaml`, `infra/`).
- **Responsibility:** Containerizes and manages PostgreSQL, the ClamAV daemon, and asynchronous background workers (`cv-worker`).
- **Why Suitable for SmartHire:** Guarantees 100% environment parity between local developer machines and production deployment, avoiding "works on my machine" operational failures.

### 4.15 Vitest, Playwright & Axe-Core
- **Where Used:** Automated test suites (`web/tests/`).
- **Responsibility:** Vitest handles unit and API contract tests; Playwright automates end-to-end browser workflows; Axe-Core verifies accessibility compliance.
- **Why Suitable for SmartHire:** Vitest provides near-instant test execution speed; Playwright ensures critical applicant tracking flows work flawlessly across browsers; Axe-Core maintains WCAG accessibility standards.