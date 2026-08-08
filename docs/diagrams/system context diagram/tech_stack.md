# SmartHire Software Architecture — Technology Stack

| Document Metadata | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Author            | Nguyễn Gia Quốc Uy (Student ID: 24127261)                          |
| Reviewers         | Nguyễn Quốc Thành, Ngô Quốc Tuấn, Lưu Chí Hải, Nguyễn Minh Khôi    |
| Target Milestone  | PA4 — Software Architecture, covering implemented Features 001–005 |

## 1. Architecture Overview

SmartHire is a full-stack web application built around one deployable Next.js Web Application container, separate asynchronous workers, PostgreSQL, private artifact stores, a malware scanner, and a network-isolated OCR Engine. The frontend and backend component diagrams are logical views of the same Next.js container rather than separately deployed applications.

The current local deployment runs the Next.js Web Application and Email Worker as Node.js host processes. PostgreSQL, ClamAV, CV Worker, Image Search Worker, and OCR Engine run as separate Docker Compose services.

## 2. Frontend Technologies

### Next.js 16.3, React 19, and TypeScript 5.9

- **Where used:** `web/src/app/` for App Router pages/layouts and `web/src/frontend/` for reusable UI, feature components, client hooks, providers, and styles.
- **Responsibility:** Render public job pages and authenticated candidate workspaces using React Server Components and Client Components; provide typed interactive forms and client-side workflows.
- **Why used:** The App Router supports server rendering and route-level data loading while React Client Components handle interactive flows such as CV import, application submission, account security, and image-assisted search.

### Tailwind CSS 4 and Project CSS Tokens

- **Where used:** `web/src/app/globals.css` imports Tailwind and the project styles under `web/src/frontend/styles/`.
- **Responsibility:** Provide utility classes, design tokens, responsive layouts, and shared visual styling.

### React Hook Form 7 and Zod 4

- **Where used:** Interactive forms and shared schemas under `web/src/shared/contracts/`.
- **Responsibility:** Manage form state and validate request/response data at browser, transport, service, and worker boundaries.

### TanStack Query 5

- **Where used:** Client data provider and feature hooks under `web/src/frontend/`.
- **Responsibility:** Cache and synchronize client-side server state for interactive workflows that require polling, mutation, or invalidation.

### Sonner and Be Vietnam Pro

- **Where used:** UI notifications and application typography.
- **Responsibility:** Display transient user feedback and provide the main Vietnamese-compatible typeface.

## 3. Backend and API Technologies

### Next.js App Router Route Handlers

- **Where used:** `web/src/app/api/`.
- **Responsibility:** Expose HTTP endpoints, parse requests, apply session/origin/capability checks, validate contracts, delegate use cases to backend services, and map results to HTTP responses.
- **Communication:** HTTPS/HTTP with browser clients; in-process TypeScript calls to services inside the same Next.js container.
- **Implementation note:** The repository currently uses Route Handlers and React Server Components; it does not define Next.js Server Actions.

### TypeScript Services, Repositories, and Shared Contracts

- **Where used:** `web/src/backend/services/`, `web/src/backend/repositories/`, and `web/src/shared/contracts/`.
- **Responsibility:** Implement application workflows, persistence operations, transactions, durable work, and validation contracts.

### Better Auth 1.6.25

- **Where used:** `web/src/backend/auth/better-auth/`, session/security services, and `/api/auth/[...all]`.
- **Responsibility:** Provide opaque cookie-backed sessions and authentication operations. SmartHire application services add account-state enforcement, email verification, password recovery, TOTP 2FA, session management, request security, and authorization policies.
- **Communication:** In-process calls from identity/account services; PostgreSQL access through the Better Auth Prisma adapter.

### sanitize-html 2.17

- **Where used:** Server-side plain-text normalization and sanitization under `web/src/backend/security/`.
- **Responsibility:** Remove unwanted markup before normalized user-controlled text is stored or processed.

## 4. Database and Durable Work

### PostgreSQL 16.12

- **Where used:** `postgres:16.12` Docker Compose service.
- **Responsibility:** Store authentication data, candidate profiles, jobs, applications, recruitment-stage history, audit events, email outbox rows, CV-import state, image-search state, consent, leases, and deletion evidence.
- **Communication:** PostgreSQL wire protocol from the Web Application and workers.

### Prisma ORM 7.9 with `@prisma/adapter-pg`

- **Where used:** `web/prisma/schema.prisma`, migrations under `web/prisma/migrations/`, generated client under `web/src/backend/generated/prisma/`, and connection setup in `web/src/backend/database/prisma.ts`.
- **Responsibility:** Provide generated typed database access, schema migrations, transactions, query composition, and PostgreSQL driver integration.
- **Security note:** Parameterized Prisma operations reduce injection risk; authorization, validation, tenant scoping, and careful review of raw SQL remain application responsibilities.

PostgreSQL also acts as the coordination point for durable asynchronous work. Workers claim rows using leases, update stage outcomes, and record audit or deletion evidence.

## 5. File Processing, OCR, Storage, and AI

### CV and Image Search Workers

- **CV Worker:** Node.js/TypeScript Docker service built from `web/Dockerfile.cv-worker`. It scans CVs, performs native-first extraction, requests OCR when needed, parses content using deterministic or optional OpenAI adapters, and runs cleanup/reconciliation.
- **Image Search Worker:** Node.js/TypeScript Docker service built from `Dockerfile.image-search-worker`. It scans and normalizes uploaded images, requests OCR, interprets OCR text into filter suggestions, and deletes content artifacts within the configured retention deadline.
- **Communication:** PostgreSQL wire protocol through Prisma, Filesystem API or optional AWS S3 API, private Unix sockets to ClamAV/OCR, and optional HTTPS to OpenAI.

### OCR Engine

- **Where used:** Python source and pinned dependencies under `ocr-engine/`; container image built from `Dockerfile.ocr-engine`.
- **Technology:** Python 3.12, FastAPI 0.139, Uvicorn 0.51, PaddleOCR 3.7, ONNX Runtime 1.27, Pillow, NumPy, and Pydantic.
- **Responsibility:** Recognize text, geometry, and confidence from normalized PNG input for purpose-specific CV OCR and image-assisted job search.
- **Isolation:** Runs with `network_mode: none`, a read-only root filesystem, and a private Unix socket. Model files are verified through a SHA-256 manifest and are not downloaded at runtime.

### Native Document and Image Processing

- **Libraries:** PDF.js 6.2, Mammoth 1.12, Yauzl 3.4, Fast XML Parser 5.10, Sharp 0.35, and `@napi-rs/canvas` 1.0.
- **Where used:** `web/src/backend/cv/extraction/`, image normalization, and worker stages.
- **Responsibility:** Extract native PDF/DOCX content first, identify OCR-eligible units, decode images safely, normalize search images to PNG, and preserve extraction evidence/warnings.

### ClamAV 1.4

- **Where used:** `clamav/clamav:1.4_base` Docker Compose service.
- **Responsibility:** Fail-closed malware scanning of CV files and image-search uploads before extraction or decoding.
- **Communication:** ClamD protocol over a private Unix socket; HTTPS through `freshclam` to retrieve signature updates.

### Private Filesystem and Optional AWS S3/KMS

- **Where used:** CV adapters under `web/src/backend/cv/storage/` and image-search adapters under `web/src/backend/image-search/storage/`.
- **Responsibility:** Store, retrieve, and delete encrypted CV and image-search artifacts through a common storage contract.
- **Default deployment:** Gitignored local directories under `web/.local/` using application-level encryption and integrity metadata.
- **Optional deployment:** AWS SDK clients for S3, KMS, and IAM with SSE-KMS/preflight checks. The adapter exists, but this repository does not provision external AWS infrastructure and does not use presigned download URLs as the primary artifact-access mechanism.

### OpenAI Responses API

- **SDK and model:** OpenAI Node SDK 7.3 with approved model `gpt-5.4-mini-2026-03-17`.
- **Where used:** `web/src/backend/cv/parsing/openai.ts` and `web/src/backend/image-search/interpretation/openai.ts`.
- **Responsibility:** Optionally convert extracted CV text into a structured review draft and convert image-search OCR text into evidence-bound search-filter suggestions.
- **Control:** Calls require matching configuration, privacy gates, and user consent. Deterministic CV parsing remains the local default, and ordinary job search remains deterministic and authoritative.

## 6. Email Delivery

### Email Worker, React Email, Nodemailer, and Resend

- **Where used:** `web/src/backend/email/`; Email Worker starts as a separate Node.js host process in the local development runner.
- **Responsibility:** Claim `EmailOutbox` rows, render transactional templates, deliver or capture messages, retry failures, and record delivery outcomes.
- **Adapters:** Local filesystem capture by default; optional SMTP through Nodemailer or HTTPS through Resend.

## 7. Infrastructure and Quality Assurance

### Docker Compose

- **Where used:** Root `compose.yaml`.
- **Managed services:** PostgreSQL, ClamAV, CV Worker, OCR Engine, and Image Search Worker.
- **Responsibility:** Provide repeatable local service topology, health checks, private volumes/sockets, worker isolation, and service dependencies. Containers improve reproducibility but do not by themselves guarantee production parity.

### Testing and Static Quality Tools

- **Vitest 4.1:** Unit, contract, integration, architecture, security, accessibility, and performance-oriented tests under `web/tests/`.
- **Playwright 1.57:** Browser end-to-end tests.
- **Axe Core 4.12:** Automated accessibility checks.
- **TypeScript, ESLint, and Prettier:** Type checking, linting, and formatting validation.

## 8. Technology-to-Container Mapping

| Container               | Primary technologies                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Next.js Web Application | Node.js 24, Next.js 16.3, React 19, TypeScript 5.9, Tailwind CSS 4, Better Auth, Zod, Prisma client |
| Email Worker            | Node.js 24, TypeScript, Prisma, React Email, Nodemailer, Resend                                     |
| CV Worker               | Node.js 24, TypeScript, Prisma, PDF.js, Mammoth, Yauzl, Sharp, ClamAV/OCR/OpenAI adapters           |
| Image Search Worker     | Node.js 24, TypeScript, Prisma, Sharp, ClamAV/OCR/OpenAI adapters                                   |
| OCR Engine              | Python 3.12, FastAPI, Uvicorn, PaddleOCR, ONNX Runtime CPU                                          |
| Malware Scanner         | ClamAV 1.4 and `freshclam`                                                                          |
| PostgreSQL              | PostgreSQL 16.12                                                                                    |
| Local artifact stores   | Private application-encrypted filesystem                                                            |
