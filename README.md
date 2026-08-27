# SmartHire

**Human-controlled, AI-assisted recruitment for candidates, recruiters, and platform administrators.**

SmartHire is a full-stack recruitment platform that combines account security, candidate profiles, job discovery and applications, recruiter workflows, platform administration, protected document processing, OCR-assisted image search, hybrid CV scoring, analytics, notifications, support, and realtime messaging.

The application is implemented as a modular Next.js monolith with explicit service and repository boundaries. PostgreSQL is the authoritative data store, Better Auth owns browser sessions, Socket.IO provides realtime communication, and long-running or sensitive work is isolated in supervised host processes and Docker workers.

> SmartHire assists recruitment work; it does not make autonomous hiring decisions. Recruiters and administrators retain authority over review, stage changes, rejection, interview, offer, and hiring actions.

## Table of contents

- [Overview](#overview)
- [User roles](#user-roles)
- [Key capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Local service topology](#local-service-topology)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment configuration](#environment-configuration)
- [Local URLs](#local-urls)
- [Command reference](#command-reference)
- [Testing](#testing)
- [Documentation map](#documentation-map)
- [Security privacy and AI boundaries](#security-privacy-and-ai-boundaries)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

SmartHire supports the recruitment lifecycle from candidate identity and profile creation through job discovery, application intake, recruiter review, communication, pipeline management, and reporting.

The current implementation includes:

- Three exact-host application surfaces for candidates, recruiters, and platform administrators.
- Server-side authorization for account-, application-, company-, and administrator-scoped operations.
- Public job discovery plus saved jobs, applications, reporting, application tracking, and private CV matching.
- Protected PDF/DOCX CV import with malware scanning, extraction, OCR fallback, candidate review, retention, and deletion.
- Ephemeral PNG/JPEG image-assisted job search with OCR and AI-assisted query interpretation while database retrieval remains deterministic.
- Recruiter job-posting review, candidate review, hybrid scoring, recruitment pipeline, application messaging, company membership, and analytics workflows.
- Administrator account, employer verification, company, job, moderation, support, messaging-report, audit, and backup workflows.
- Durable in-app notifications, transactional email, professional connections, support cases, and Socket.IO messaging.

Feature specifications and plans live under [`spec-kit/specs/`](spec-kit/specs/). They document intended behavior; current source code, database migrations, and tests remain the implementation evidence.

## User roles

| Role                   | Primary responsibilities                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate              | Maintain a professional profile, import CVs, discover and save jobs, apply, track applications, control profile visibility, connect with professionals, and communicate with authorized recruiters.            |
| Recruiter              | Operate under a current company membership, create and submit job posts, review applicants, request consented scoring, manage pipeline stages, communicate with applicants, and inspect recruitment analytics. |
| Platform Administrator | Use the isolated admin host to manage accounts and companies, review employer evidence and job posts, handle reports and support cases, inspect audit evidence, and control platform backups.                  |

The same authenticated account may receive different capabilities only when the relevant server-side role, company membership, verification state, and resource authority are valid.

## Key capabilities

### Candidate experience

- Registration, email verification, login, logout, password reset, account recovery, TOTP two-factor authentication, backup codes, and session management.
- Professional profile sections for personal details, summary, skills, experience, education, social links, avatar, preferences, account data, security, and active sessions.
- Privacy-scoped candidate profile discovery, field-level visibility projection, contact-consent controls, rate limiting, and audit events.
- Public job browsing with keyword search, Vietnamese text normalization, structured filters, sorting, pagination, saved jobs, hidden jobs, reports, and privacy-safe unavailable states.
- Job applications with drafts, CV selection or upload, cover letters, review, asynchronous intake, canonical status tracking, withdrawal, offer response, notification preferences, and application-scoped messaging.
- Private CV-to-job matching with deterministic retrieval, optional AI analysis, retry handling, and candidate-visible explanations.
- Professional connection proposals, decisions, disconnects, notifications, and eligible one-to-one messaging.
- In-app notifications and support cases with realtime updates where the relevant feature boundary permits them.

### CV import and OCR-assisted job search

**Protected CV import**

- Accepts PDF and DOCX files up to exactly 5,000,000 bytes.
- Stores encrypted private artifacts locally in development or behind approved S3/SSE-KMS boundaries in production.
- Scans files through ClamAV before extraction or parsing.
- Extracts text with PDF.js and Mammoth, with purpose-specific OCR for supported embedded content and scanned documents.
- Supports deterministic parsing or a separately gated OpenAI parser.
- Requires candidate review before parsed profile data is applied.
- Enforces upload quotas, consent, retries, cleanup, retention, deletion, and audit boundaries.

**Image-assisted job search**

- Accepts standalone PNG/JPEG query images up to 5,000,000 bytes and 20,000,000 decoded pixels.
- Uses private temporary storage, malware scanning, image decoding, OCR, and bounded query interpretation.
- Presents derived criteria as a search proposal that the user can review or edit.
- Keeps job retrieval deterministic: AI may interpret the image query but does not choose job IDs or alter job visibility rules.
- Uses a 10-second OCR/search processing deadline and a configurable 15-minute default artifact retention window.
- Keeps the adaptive tiling strategy behind `OCR_SEARCH_ADAPTIVE_TILING_ENABLED`; it is disabled by default in the checked-in environment templates.

### Recruiter workspace

- Recruiter entitlement and header status derived from current company membership and verification state.
- Company setup, business-email verification, evidence preparation, invitations, member management, and role-aware company settings.
- Job-post creation and editing, submission for administrator review, withdrawal, review outcomes, publication, expiry, and reactivation.
- Application-scoped candidate lists, profile projection, document preview/download, viewed-state tracking, priority, shortlist, and human decisions.
- Consent-gated hybrid CV scoring, deterministic-only fallback, retry/rescore workflows, explanations, and ranked candidate views.
- Kanban-style recruitment pipeline with authorized stage transitions, withdrawn handling, and explicit decision actions.
- Application-scoped recruitment threads and recruiter message oversight.
- Job performance metrics, recruitment funnel reporting, time-series analytics, and asynchronous exports.

### Platform administration

- Exact-host administrator console with administrator authentication, TOTP, recent-auth/step-up controls, and auditable sessions.
- Account search, account detail, suspension, restoration, session revocation, and security-state management.
- Employer verification with immutable business facts, private evidence access, provider failure handling, claims, deadlines, and explicit human approval or rejection.
- Company and membership administration with tenant-aware authorization.
- Job-post review, approval/rejection/change requests, publication projection, lifecycle enforcement, feature controls, and platform job management.
- Moderation reports, messaging-report review, professional-connection oversight, support-case handling, rationales, and privacy-minimized audit trails.
- Dashboard snapshots, security and lifecycle notifications, retention loops, evidence safety checks, and encrypted PostgreSQL backup runs.

### Shared platform services

- Transactional email through an outbox with local capture, SMTP, or Resend adapters.
- Durable in-app notifications with unread counts, deep links, read-all operations, and recipient policies.
- Socket.IO realtime messaging and support updates over the authenticated browser session.
- Shared Zod contracts, structured error envelopes, rate limiting, idempotency, audit events, and retention workers.

## Architecture

SmartHire uses a modular-monolith architecture. UI, transport, application logic, persistence, and external providers remain separate even though the primary application is deployed as one long-lived Node.js process.

```text
Candidate host       Recruiter host       Administrator host
      \                    |                     /
       +---------- HTTPS / exact-host routing --+
                              |
                     web/server.ts
                  Next.js + Socket.IO
                              |
          +-------------------+-------------------+
          |                                       |
  App Router pages and                    /chat gateway
  thin Route Handlers                    typed realtime hubs
          |                                       |
          +----------- application services ------+
                              |
                  repositories and adapters
                              |
                       PostgreSQL 16

Asynchronous boundaries
  Host: email outbox, application intake, candidate private match
  In-process: application scoring and candidate data export runtimes
  Docker: CV worker, OCR engine, image-search worker, admin worker
  Providers: ClamAV, OpenAI, email adapters, S3/KMS, Google Drive backup
```

### Request and data boundaries

- `web/server.ts` is the custom development and production entrypoint. It serves Next.js, attaches the authenticated Socket.IO gateway, and owns graceful shutdown.
- `web/src/app/` contains App Router pages and thin Route Handlers.
- `web/src/backend/` contains application services, authorization policies, repositories, workers, and provider adapters.
- `web/src/shared/` contains transport-neutral schemas, contracts, and types.
- Prisma repositories own PostgreSQL access and transactional writes.
- PostgreSQL is authoritative for account, recruitment, notification, messaging, audit, and worker state. Browser caches and socket rooms are projections only.
- Sensitive providers are purpose-specific: CV parsing, image-query interpretation, email, object storage, malware scanning, OCR, and backup each have separate configuration and policy boundaries.

## Technology stack

| Area                      | Technology                                                                    |
| ------------------------- | ----------------------------------------------------------------------------- |
| Runtime and workspace     | Node.js 24.18.x, npm 11.16.x, npm workspaces                                  |
| Web application           | Next.js 16.3, React 19.2, TypeScript 5.9                                      |
| Styling and UI            | Tailwind CSS 4, CSS modules, Material UI, React Admin, Lucide icons, Recharts |
| Authentication            | Better Auth 1.6                                                               |
| Database                  | PostgreSQL 16.12, Prisma 7.9, `@prisma/adapter-pg`                            |
| Validation and forms      | Zod 4, React Hook Form                                                        |
| Server state and realtime | TanStack Query, Socket.IO 4.8                                                 |
| CV processing             | ClamAV 1.4, PDF.js, Mammoth, Sharp                                            |
| OCR                       | Isolated Python 3.12 service with pinned PaddleOCR-derived ONNX models        |
| AI integration            | OpenAI SDK behind consent, configuration, and privacy gates                   |
| Email                     | Local capture, SMTP, or Resend through a transactional outbox                 |
| Testing                   | Vitest, Testing Library, axe-core, Playwright                                 |

Exact dependency versions are recorded in [`package-lock.json`](package-lock.json) and [`web/package.json`](web/package.json).

## Local service topology

`npm run dev` coordinates both host processes and Docker services:

1. It checks whether the OCR, CV, image-search, and admin worker images are missing or changed and builds them in the background.
2. It starts or recovers PostgreSQL and ClamAV without making web startup wait for ClamAV health.
3. It starts the web server, email worker, application-intake watcher, and candidate-match watcher on the host.
4. When worker images are ready, it starts the OCR, CV, image-search, and admin services without recreating their dependencies.

| Process or service        | Runtime      | Responsibility                                                                             | Development lifecycle       |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------ | --------------------------- |
| Web application           | Host Node.js | Next.js HTTP, exact-host shells, Socket.IO, scoring runtime, candidate data export runtime | Supervised by `npm run dev` |
| Email worker              | Host Node.js | Transactional outbox delivery                                                              | Supervised by `npm run dev` |
| Application intake worker | Host Node.js | Submitted-document verification and intake progression                                     | Supervised in watch mode    |
| Candidate match worker    | Host Node.js | Private CV-match attempts and retries                                                      | Supervised in watch mode    |
| `postgres`                | Docker       | Authoritative PostgreSQL database                                                          | Compose                     |
| `clamav`                  | Docker       | Malware scanning and signature updates                                                     | Compose                     |
| `ocr-engine`              | Docker       | Private Unix-socket OCR inference                                                          | Compose                     |
| `cv-worker`               | Docker       | CV scan, extraction, parsing, and cleanup                                                  | Compose                     |
| `image-search-worker`     | Docker       | Ephemeral image-query processing and cleanup                                               | Compose                     |
| `admin-worker`            | Docker       | Verification, support, notification, retention, snapshot, and backup loops                 | Compose                     |

The Compose stack contains six services. `Ctrl+C` stops the supervised host processes, but detached Compose services intentionally remain running. Use `npm run infra:down` when you want to stop and remove the containers while retaining named volumes.

## Repository structure

```text
.
|-- AGENTS.md                         # Repository instructions for coding agents
|-- compose.yaml                      # PostgreSQL, ClamAV, OCR and worker topology
|-- Dockerfile.*                      # Admin, image-search and OCR worker images
|-- package.json                      # Root workspace commands
|-- package-lock.json                 # Single authoritative dependency lockfile
|-- scripts/                          # Local setup, supervisor and database tools
|-- infra/clamav/                     # clamd and FreshClam configuration
|-- ocr-engine/                       # Isolated Python OCR service and model manifest
|-- deploy/                           # Deployment policies and evidence
|-- docs/                             # Architecture, operations and testing documents
|-- spec-kit/
|   |-- .specify/memory/constitution.md
|   `-- specs/                       # Feature specs, plans, contracts and tasks
`-- web/
    |-- server.ts                     # Custom Next.js and Socket.IO entrypoint
    |-- prisma/
    |   |-- schema.prisma
    |   `-- migrations/              # Numbered Prisma migration history
    |-- scripts/                      # Worker, migration, seed, probe and test tools
    |-- src/
    |   |-- app/                      # Pages and thin Route Handlers
    |   |-- frontend/features/        # Feature UI and browser adapters
    |   |-- backend/                  # Services, repositories, workers and providers
    |   `-- shared/                  # Schemas, contracts and shared types
    `-- tests/                       # Unit through system-level test suites
```

Generated Prisma output is written to `web/src/backend/generated/prisma/`. Do not hand-edit generated files; update the schema/migrations and regenerate instead.

## Prerequisites

- Git.
- Node.js `24.18.x` (the repository pins `24.18.0` in [`.nvmrc`](.nvmrc)).
- npm `11.16.x`.
- Docker Desktop or Docker Engine with Docker Compose v2.
- Internet access for the initial npm install, Docker images, OCR model build, ClamAV signatures, and enabled external providers.
- A valid `OPENAI_API_KEY` for the fresh local configuration generated by `npm run env:init`, which enables the OpenAI CV parser and image-query interpreter.

PostgreSQL, `psql`, Python OCR packages, and ClamAV do not need to be installed directly on the host.

## Quick start

Run every command from the repository root.

### 1. Clone the repository

```bash
git clone https://github.com/quocuy0112/Software-Engineering---Group-9.git
cd Software-Engineering---Group-9
```

### 2. Install locked dependencies

```bash
npm ci
```

Use the root install. The repository owns one lockfile for the `web` workspace.

### 3. Create local configuration and private directories

```bash
npm run env:init
```

This command creates or extends:

- `.env` for Compose and worker settings.
- `web/.env.local` for the application runtime.
- Private local artifact, mail, and evidence directories under `web/.local/`.
- Random database, authentication, encryption, capability, and HMAC secrets when missing.

Existing secret values are preserved and are not printed.

### 4. Configure the local provider key

Set the same non-empty `OPENAI_API_KEY` in `.env` and `web/.env.local`. Never commit either file.

The generated local setup selects the OpenAI CV parser and OpenAI image-search interpreter. A deterministic CV parser is supported, but changing that mode requires all related CV flags to remain consistent; image search still requires its configured interpreter and provider gate.

### 5. Start PostgreSQL and prepare the schema

```bash
npm run db:up
npm run db:deploy
npm run db:seed:jobs
```

`db:seed:jobs` is optional when the database already contains a suitable local catalogue.

Use `db:deploy` to apply committed migrations. Use `db:migrate` only while authoring a new development migration and only against a disposable local database.

### 6. Validate the environment

```bash
npm run env:check
```

The check validates Node and Docker availability, required environment values, key separation, exact origins, storage/provider gates, database connectivity, and worker prerequisites without printing secret values.

### 7. Start the complete development environment

```bash
npm run dev
```

The first run may take several minutes while Docker builds worker images and downloads OCR assets. Later runs reuse Docker layer caches.

The server binds to `127.0.0.1:3001` by default, but the product surfaces should be opened with the exact `localhost` hostnames listed below.

### 8. Verify health

```bash
curl http://localhost:3001/api/health
docker compose ps
```

PowerShell:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/health
docker compose ps
```

## Environment configuration

Start from [`.env.example`](.env.example) and [`web/.env.example`](web/.env.example), or let `npm run env:init` generate the local files. The important groups are:

| Group                      | Representative settings                                            | Purpose                                                           |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Application and database   | `APP_ENV`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DIRECT_URL`     | Runtime mode, public origin, pooled/direct database access        |
| Authentication and origins | `BETTER_AUTH_URL`, auth secrets, candidate/admin/recruiter origins | Session signing, cookies, CSRF and exact-host enforcement         |
| Email                      | `EMAIL_DRIVER`, SMTP/Resend settings, local capture directory      | Transactional outbox delivery                                     |
| CV import                  | `CV_STORAGE_*`, `CV_PARSER_ADAPTER`, `CV_OPENAI_*`, `CV_CLAMD_*`   | Private storage, scanning, parsing, quotas and retention          |
| OCR                        | `OCR_ENGINE_*`, `OCR_SEARCH_*`                                     | Unix-socket engine, model identity, deadlines and optional tiling |
| Image search               | `IMAGE_SEARCH_*`                                                   | Storage, capability keys, provider, limits, consent and retention |
| Recruitment                | job catalogue, application, scoring and analytics settings         | Workflow policy, workers, exports and retention                   |
| Administration             | admin origin, evidence, notifications and worker settings          | Isolated console and administrative background loops              |
| Backup                     | `BACKUP_ENCRYPTION_KEY`, `GOOGLE_DRIVE_BACKUP_*`                   | Encrypted PostgreSQL backup destination and credentials           |

Additional rules:

- Do not commit `.env`, `web/.env.local`, credentials, local artifacts, or database dumps.
- Candidate, recruiter, and administrator origins must be exact; production origins must use HTTPS.
- Development filesystem storage is not a production substitute. Production CV/image storage requires the configured S3, encryption, role-credential, and privacy gates.
- OpenAI production use is fail-closed until the relevant DPA, cross-border, privacy, and zero-data-retention approvals are explicitly configured.
- The business-registry adapter is independently configurable and never auto-approves an employer.

## Local URLs

| Surface                        | URL                                       | Access                                              |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| Candidate application          | `http://localhost:3001`                   | Public pages plus authenticated candidate workspace |
| Candidate messages             | `http://localhost:3001/messages`          | Authenticated and eligibility-gated                 |
| Recruiter workspace            | `http://console.recruiter.localhost:3001` | Current recruiter entitlement required              |
| Platform Administrator console | `http://console.admin.localhost:3001`     | Authorized administrator session required           |
| Health endpoint                | `http://localhost:3001/api/health`        | Operational health                                  |

Do not open recruiter or administrator routes through the candidate hostname. The proxy deliberately rejects unknown hosts and direct access to internal host-shell paths.

## Command reference

### Daily development

| Command                                     | Purpose                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| `npm ci`                                    | Install the exact lockfile dependency graph                    |
| `npm run env:init`                          | Generate or extend local configuration and private directories |
| `npm run env:check`                         | Validate environment and runtime boundaries                    |
| `npm run dev`                               | Start the complete supervised local environment                |
| `npm run dev:web`                           | Start only the custom Next.js/Socket.IO server                 |
| `npm run build`                             | Build the production Next.js application                       |
| `npm start`                                 | Start an already-built production-mode custom server           |
| `npm run lint`                              | Run ESLint for the web workspace                               |
| `npm run typecheck`                         | Run TypeScript without emitting output                         |
| `npm test`                                  | Run the complete Vitest suite                                  |
| `npm run format --workspace @smarthire/web` | Check formatting with Prettier                                 |

### Infrastructure and database

| Command                                       | Purpose                                                              |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `npm run infra:up`                            | Build and start all six Compose services                             |
| `npm run infra:down`                          | Remove Compose containers and retain named volumes                   |
| `npm run db:up`                               | Start and wait for PostgreSQL                                        |
| `npm run db:down`                             | Stop PostgreSQL without deleting its volume                          |
| `npm run db:status`                           | Show PostgreSQL Compose status                                       |
| `npm run db:logs`                             | Follow PostgreSQL logs                                               |
| `npm run db:validate`                         | Validate the Prisma schema                                           |
| `npm run db:migrations:check`                 | Validate `NNN_snake_case` migration names and sequence               |
| `npm run db:deploy`                           | Apply committed migrations                                           |
| `npm run db:migrate`                          | Reconcile names and run Prisma development migration authoring       |
| `npm run db:verify`                           | Rebuild and verify the full migration history in temporary databases |
| `npm run db:seed:jobs`                        | Load or update the local demonstration job catalogue                 |
| `npm run db:studio`                           | Open Prisma Studio                                                   |
| `npm run db:reset:user -- <email-or-user-id>` | Remove one local user's owned data under the reset policy            |
| `npm run db:reset:empty`                      | Recreate an empty local database                                     |

The current checkout contains 75 numbered migration directories, from `001_identity_foundation` through `075_persist_employer_requested_role`.

> Reset and migration-reconciliation commands mutate data or migration metadata. Never run them against a shared or production database without an approved backup, an inspected database state, and a documented recovery plan.

### Workers and operational probes

| Command                                  | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm run email:worker`                   | Run the email outbox worker                                        |
| `npm run applications:intake`            | Drain currently queued application-intake work                     |
| `npm run applications:intake:watch`      | Watch continuously for application-intake work                     |
| `npm run candidate-match:worker`         | Drain candidate private-match work once                            |
| `npm run candidate-match:worker:probe`   | Probe candidate-match prerequisites                                |
| `npm run cv:worker:probe`                | Probe CV worker configuration and dependencies                     |
| `npm run cv:scanner:check`               | Check the ClamAV boundary                                          |
| `npm run ocr:up`                         | Build and start only the OCR engine                                |
| `npm run ocr:check`                      | Check OCR readiness                                                |
| `npm run image-search:worker:probe`      | Probe image-search worker dependencies                             |
| `npm run admin:worker:probe`             | Probe administrator worker loops                                   |
| `npm run image-search:storage:preflight` | Validate production image-storage evidence                         |
| `npm run admin:evidence:check`           | Validate administrator evidence readiness                          |
| `npm run admin:provision -- <email>`     | Grant Platform Administrator authority through the controlled CLI  |
| `npm run admin:revoke -- <email>`        | Revoke Platform Administrator authority through the controlled CLI |

## Testing

Tests are organized by concern under `web/tests/`:

- `backend/unit`, `backend/integration`, `backend/contract`, and `backend/compatibility`.
- `frontend/unit`, `frontend/components`, and `frontend/accessibility`.
- `shared`, `architecture`, `security`, `performance`, `usability`, and `system/e2e`.

### Baseline quality gates

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run build
```

Some integration and system suites require PostgreSQL or the complete Compose stack. Use `npm run db:up` or `npm run infra:up` as required, and never point destructive or fixture-heavy tests at a shared database.

### Focused root suites

```bash
npm run test:job-board
npm run test:cv-import
npm run test:ocr-image-search
npm run test:candidate-application-private-match
npm run test:business-verification
npm run test:admin-management
npm run test:messaging
npm run test:notifications
```

### Additional workspace suites

These scripts exist in the `@smarthire/web` workspace and can be run from the repository root:

```bash
npm run test:applications --workspace @smarthire/web
npm run test:scoring --workspace @smarthire/web
npm run test:job-post-reviews --workspace @smarthire/web
npm run test:job-post-management --workspace @smarthire/web
npm run test:recruitment-analytics --workspace @smarthire/web
npm run test:recruiter-header --workspace @smarthire/web
npm run test:profile-discovery --workspace @smarthire/web
npm run test:connections --workspace @smarthire/web
npm run test:support --workspace @smarthire/web
```

### Browser end-to-end suites

```bash
npm run test:e2e
npm run test:cv-import:e2e
npm run test:ocr-image-search:e2e
npm run test:admin-management:e2e
npm run test:messaging:e2e
npm run test:connections:e2e --workspace @smarthire/web
npm run test:recruiter-header:e2e --workspace @smarthire/web
```

Install Chromium with `npx playwright install chromium` if the local Playwright browser is missing.

### Migration and operational verification

```bash
npm run db:migrations:check
npm run db:verify
npm run ocr:supply-chain
npm run perf:image-search:self-test
npm run smoke:messaging:server
```

Feature-specific migration verifiers are available for business verification, candidate matching, notifications, job review/management, applications, profile discovery, professional connections, and recruitment analytics. Inspect `package.json` and `web/package.json` for the complete current command list.

## Documentation map

### Governing architecture and feature design

- [Project constitution](spec-kit/.specify/memory/constitution.md) — human authority, privacy, data integrity, AI, performance, and architecture rules.
- [Feature specifications](spec-kit/specs/) — numbered feature specs, plans, contracts, tasks, and quickstarts.
- [AI project overview and OCR roadmap](docs/architecture/AI_PROJECT_OVERVIEW_AND_OCR_ROADMAP.md).
- [System context diagram](<docs/diagrams/system context diagram/System_Context.md>).
- [Container diagram](<docs/diagrams/container component diagrams/container_diagram.md>).
- [Frontend component diagram](<docs/diagrams/container component diagrams/Frontend_Component.md>).
- [Backend component diagram](<docs/diagrams/container component diagrams/backend_component_diagram.md>).
- [Deployment diagram](<docs/diagrams/deployment diagram/deployment_diagram.md>).

### Operations and security

- [Authentication security](docs/operations/authentication-security.md).
- [Profile and account security](docs/operations/profile-account-security.md).
- [Profile and account data lifecycle](docs/operations/profile-account-data-lifecycle.md).
- [Job-board data lifecycle](docs/operations/job-board-data-lifecycle.md).
- [Database migration operations](docs/operations/database-migrations.md).
- [Transactional email operations](docs/operations/transactional-email.md).
- [Platform Administrator grants runbook](docs/runbooks/platform-administrator-grants.md).

### Testing and review

- [PA5 test plan](docs/testing/PA5_Testing.md).
- [OCR image-search inspector guide](docs/testing/feature-005-image-search-inspector.md).
- [OCR image-search usability guide](docs/testing/feature-005-image-search-usability.md).
- [Recruiter workspace UI regression guide](docs/testing/recruiter-workspace-ui-regression.md).
- [Business verification plan](spec-kit/specs/014-business-verification-enrichment/plan.md).
- [Candidate profile discovery plan](spec-kit/specs/027-candidate-profile-discovery/plan.md).

Operational documents may preserve historical version snapshots. Before executing a command, confirm the current script and dependency versions in the root and web package files.

## Security privacy and AI boundaries

### Authentication and authorization

- Browser authentication uses server-controlled, database-backed Better Auth sessions; credentials are not stored in browser local or session storage.
- State-changing routes enforce authentication, authorization, origin/CSRF validation, input schemas, and rate limits appropriate to their trust boundary.
- Recruiter operations revalidate current company membership and resource authority on the server.
- Candidate document and profile access is application-scoped or visibility-projected; knowing an identifier does not grant access.
- Administrator access is isolated by exact host and strengthened by TOTP, recent-auth/step-up, session, rationale, and audit controls where required.

### Personal and sensitive data

- Never log or commit CV content, image-search input, messages, reports, evidence, secrets, provider payloads, local mail, or database dumps.
- Local CV and image-search artifacts use purpose-separated encryption keys and private directories.
- Production artifact storage requires approved private S3/KMS configuration and role credentials.
- Image-search source artifacts are ephemeral and default to a 15-minute retention window.
- Backup runs create encrypted PostgreSQL dumps before upload to the configured Google Drive destination.
- Retention, deletion, legal-hold, and audit behavior must remain aligned with the project constitution and applicable personal-data obligations.

### AI and recruitment authority

- SmartHire is AI-assisted, not autonomous.
- The approved hybrid score is 40% deterministic matching and 60% AI analysis, with human-readable explanations and deterministic-only fallback.
- AI analysis requires the relevant candidate consent and approved provider configuration.
- AI must not automatically reject, hire, advance, or irreversibly disadvantage a candidate.
- Recruiters retain control of pipeline transitions and recruitment decisions.
- Candidates review CV-derived profile changes before they are saved.
- Image-query AI proposes search criteria only; deterministic job discovery applies visibility, availability, filtering, sorting, and pagination.
- Provider failures must fail closed or degrade to an explicitly supported deterministic state, never silently bypass privacy or authorization controls.

Report suspected authentication bypass, tenant leakage, exposed credentials, or personal-data disclosure privately to the maintainers. Do not place sensitive reproduction data in a public issue.

## Troubleshooting

### `NEXT_OUTPUT_IN_USE` or `web/.next` is locked

Another SmartHire development server owns the Next.js output directory. Use the PID reported in the error:

```powershell
Get-Process -Id <PID>
Stop-Process -Id <PID>
npm run dev
```

If that process no longer exists, verify no Node process is using this checkout before removing the stale `web/.local/next-output.lock` file. Do not delete the lock while a valid server is running.

### Port 3001 is already in use

Stop the existing SmartHire `dev` or `start` process. Docker does not own port `3001`.

### Docker or a worker is unavailable

```bash
docker compose ps
npm run infra:up
```

If an explicitly stopped worker does not restart, `restart: unless-stopped` is respecting the operator stop; recover it with `npm run dev` or `npm run infra:up`.

### ClamAV is unhealthy or signatures are stale

```bash
docker compose logs --tail 100 clamav
docker compose logs --tail 100 cv-worker
npm run cv:scanner:check
```

Restore network access and allow FreshClam to update. Do not bypass the signature-freshness gate.

### Environment validation reports a provider error

- Confirm `OPENAI_API_KEY` is non-empty in both `.env` and `web/.env.local`.
- Keep CV, image-search encryption, rate, and capability keys distinct.
- Run `npm run env:init`, then `npm run env:check`.
- For production, satisfy the explicit storage and privacy approvals rather than copying local-development values.

### PostgreSQL is unavailable

```bash
npm run db:status
npm run db:logs
npm run db:up
```

The host application uses `localhost:55432`; Docker workers use `postgres:5432`.

### A migration name or sequence is rejected

Migration directories must follow `NNN_snake_case` and form the checked sequence:

```bash
npm run db:migrations:check
npm run db:migrations:reconcile-names
```

Review reconciliation output before applying it. Use `npm run db:migrations:reconcile-names -- --apply` only when the database history is known and backed up.

### Prisma reports `P3018`, `P3009`, or an existing relation

Do not reset the database, delete migration folders, edit an applied migration, or blindly mark it applied. First inspect:

```bash
npm run db:migrations:check
npm run db:status
npm run db:verify
```

Compare `_prisma_migrations`, the actual schema object, and the migration SQL. Use `prisma migrate resolve` only after determining whether the failed migration was rolled back or manually completed. See [Database migration operations](docs/operations/database-migrations.md).

### An exact-host surface does not open

Use `localhost`, not an arbitrary loopback alias:

- Candidate: `http://localhost:3001`.
- Recruiter: `http://console.recruiter.localhost:3001`.
- Administrator: `http://console.admin.localhost:3001`.

Check origin variables if a reverse proxy or non-default environment is involved.

### A workspace module cannot be resolved

Stop the development server and run `npm ci` from the repository root. Do not create an independent lockfile or dependency installation under `web/`.

## Contributing

1. Read the root [`AGENTS.md`](AGENTS.md), the applicable nested instructions, the project constitution, and the current feature plan before editing.
2. Preserve unrelated working-tree changes and keep each change scoped to its stated feature.
3. Maintain the Route Handler → application service → repository/provider layering.
4. Enforce authorization and tenant boundaries on the server, not only in UI visibility.
5. Treat generated Prisma output as generated; change the schema or migrations and regenerate it.
6. Never rewrite an applied migration. Add a forward migration and verify the complete sequence.
7. Add contract, unit, integration, security, accessibility, architecture, performance, and E2E coverage in proportion to the risk.
8. Run the focused suite plus `lint`, `typecheck`, and `build` before opening a pull request.
9. Update specs, operational documentation, and this README when commands, topology, environment requirements, or user-visible behavior changes.
10. Never commit environment files, local artifacts, credentials, personal data, captured email, or database dumps.

## License

This repository currently has no root `LICENSE` file and is not licensed for public reuse. Third-party dependencies and referenced materials retain their own licenses. Add an approved root license before publishing, redistributing, or inviting external reuse.
