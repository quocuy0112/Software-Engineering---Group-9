# SmartHire

SmartHire is a security-focused recruitment platform for Candidates, Recruiters, and Platform Administrators. It combines account and profile management, a job workspace, protected CV processing, purpose-specific OCR, employer verification, platform administration, and one-to-one professional messaging in a single modular Next.js application.

The repository is a private npm workspace. PostgreSQL is the authoritative data store, Better Auth owns the browser session, background work is isolated in dedicated processes, and Socket.IO provides realtime messaging through the same Node.js process as Next.js.

## Table of Contents

- [Overview](#overview)
- [Techstack](#techstack)
- [Command](#command)
- [Run local](#run-local)
- [Run test](#run-test)
- [Document](#document)
- [License](#license)

## Overview

### Architecture

SmartHire is a modular monolith. Presentation, transport, business logic, and persistence remain separate even though they are deployed as one application.

```text
Browser
  |-- HTTP/HTTPS -----------------------------------------------+
  |                                                            |
  |                                                   Next.js App Router
  |                                                            |
  |                                                   Route Handlers
  |                                                            |
  |                                                   Application services
  |                                                            |
  |                                                   Repositories/adapters
  |                                                            |
  |-- WebSocket /chat --> Socket.IO gateway --> typed services-+
                                                               |
                                                        PostgreSQL 16

Background processes
  |-- Email outbox worker
  |-- CV worker ------> ClamAV Unix socket
  |                 `-> OCR Unix socket
  |-- Image-search worker -> OCR Unix socket / approved OpenAI boundary
  `-- Admin worker
```

- Ordinary backend HTTP endpoints use Next.js App Router Route Handlers, which validate input and call application services — business rules do not live in UI components or transport handlers.
- Prisma repositories own PostgreSQL access and transactional writes.
- Shared Zod schemas and TypeScript types define trust-boundary contracts.
- `web/server.ts` is the Node.js entrypoint for both development and production; it delegates HTTP to Next.js and attaches the `/chat` Socket.IO namespace to the same HTTP server.
- PostgreSQL owns durable account, recruitment, messaging, audit, and worker state. Browser caches and Socket.IO rooms are never authoritative.

### Product capabilities

**Identity and account security**

- Account registration, verified email ownership, login, and logout.
- Better Auth opaque, database-backed browser sessions.
- TOTP two-factor authentication, backup codes, session limits, session listing, and revocation.
- Password reset and full account recovery with a security hold.
- Rate limiting, CSRF/origin validation, audit events, and safe error envelopes.

**Candidate profile and account management**

- Professional summary, contact-safe profile fields, avatar, experience, education, skills, and social links.
- Verified email changes and secure password changes.
- Account preferences and persisted workspace state.
- Account-scoped ownership of profile, CV, saved-job, application, and messaging data.

**Job board and candidate workspace**

- Public browsing of approved and currently available jobs.
- Case-insensitive and Vietnamese-diacritic-insensitive search.
- Structured filters, job details, saved jobs, and hidden jobs.
- Candidate applications with canonical application tracking.
- Job reporting and privacy-safe unavailable-job responses.
- Optional image-assisted search that turns an ephemeral image query into visible, editable filters while deterministic retrieval remains authoritative.

**Protected CV import**

- PDF and DOCX input only, capped at 5,000,000 bytes.
- Private encrypted local storage in development; S3/SSE-KMS boundaries in approved production deployments.
- ClamAV malware scanning over a private Unix socket.
- Text extraction with PDF.js and Mammoth, plus purpose-specific OCR.
- Deterministic local parsing or an approved OpenAI parser boundary.
- Candidate review before parsed data is applied to the profile.
- Retry, consent, quota, cleanup, retention, and deletion workflows.

**Platform administration and employer verification**

- Exact-host Platform Administrator console.
- Account suspension/restoration and session deactivation.
- Recruiter business verification and company membership administration.
- Moderation/report workflows and privacy-minimized audit records.
- Background dashboard snapshots, evidence safety checks, verification deadlines, security notifications, and retention reconciliation.

**Realtime professional messaging**

- Eligible one-to-one Candidate/Recruiter conversations, gated by an accepted connection or an application with current company-scoped Recruiter authority.
- Durable plain-text messages, unread counts, monotonic read state, and cursor pagination.
- Socket.IO realtime delivery, reconnect recovery, and approximate presence.
- Bidirectional communication blocking, force-leave enforcement, and reporting.
- No group chat, attachments, typing indicators, calls, message mutation, exact last-seen history, or cross-module realtime feed.

## Techstack

| Area             | Technology                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Runtime          | Node.js 24.18.x, npm 11.16.x                                                              |
| Application      | Next.js 16.x, React 19.2.x, TypeScript 5.9.x                                              |
| Styling/UI       | Tailwind CSS 4, shadcn-style primitives, MUI/React Admin (isolated admin console), Motion |
| Authentication   | Better Auth 1.6.25                                                                        |
| Database         | PostgreSQL 16.12, Prisma 7.9.0, `@prisma/adapter-pg`                                      |
| Validation/forms | Zod 4, React Hook Form                                                                    |
| Realtime         | Socket.IO 4.8.3, single `/chat` namespace                                                 |
| Server state     | TanStack Query                                                                            |
| CV processing    | ClamAV 1.4, PDF.js, Mammoth, Sharp                                                        |
| OCR              | Isolated Python OCR engine using pinned PaddleOCR-derived ONNX models                     |
| AI integration   | OpenAI SDK behind purpose-specific service boundaries                                     |
| Email            | Local capture, SMTP, or Resend through a transactional outbox                             |
| Testing          | Vitest, Testing Library, axe-core, Playwright                                             |

Exact dependency versions are defined in the root `package-lock.json` and `web/package.json`.

### Local service topology

`npm run dev` supervises local Node processes, recovers the core Docker infrastructure, starts restartable workers without waiting for ClamAV health, and then starts the web application.

| Process/service       | Runtime      | Purpose                                             | Lifecycle                   |
| --------------------- | ------------ | --------------------------------------------------- | --------------------------- |
| Web application       | Host Node.js | Next.js HTTP plus Socket.IO                         | Supervised by `npm run dev` |
| Email worker          | Host Node.js | Delivers transactional outbox records               | Supervised by `npm run dev` |
| `postgres`            | Docker       | Authoritative PostgreSQL database                   | `unless-stopped`            |
| `clamav`              | Docker       | Malware scanner and FreshClam updater               | `unless-stopped`            |
| `ocr-engine`          | Docker       | Private Unix-socket OCR service                     | `unless-stopped`            |
| `cv-worker`           | Docker       | Scan/extract/parse/cleanup CV jobs                  | `unless-stopped`            |
| `image-search-worker` | Docker       | Ephemeral image-search processing/cleanup           | `unless-stopped`            |
| `admin-worker`        | Docker       | Admin evidence, notifications, snapshots, retention | `unless-stopped`            |

The Compose services run detached. Stopping the `npm run dev` terminal stops the web and email supervisor processes but intentionally leaves Docker infrastructure running. Use `npm run infra:down` to remove the Compose containers.

## Command

### Prerequisites

- Git
- Node.js `24.18.x`
- npm `11.16.x`
- Docker Desktop or Docker Engine with Docker Compose v2
- A working internet connection for the first dependency/image/model build and ClamAV signature updates
- An OpenAI API key when local image-assisted job search remains enabled

Recommended local resources: 16 GB+ host memory, ~14 GB available to Docker when running the full OCR stack, and sufficient disk space for npm packages, Docker images, OCR models, and local development artifacts.

PostgreSQL, `psql`, Python OCR dependencies, and ClamAV do not need to be installed directly on the host.

### Setup and application

| Command             | Purpose                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm ci`            | Install the exact root lockfile dependency graph                             |
| `npm run env:init`  | Generate/preserve local environment files, secrets, and private directories  |
| `npm run env:check` | Validate runtime, Docker, environment, storage, database, and provider gates |
| `npm run dev`       | Recover Compose services without blocking on ClamAV, then run web and email  |
| `npm run dev:web`   | Start only the custom Next.js/Socket.IO server                               |
| `npm start`         | Start an already-built production-mode custom server                         |
| `npm run build`     | Build the Next.js application                                                |

### Infrastructure and database

| Command                         | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `npm run infra:up`              | Build and start all six Compose services                       |
| `npm run infra:down`            | Remove all Compose containers and retain named volumes         |
| `npm run db:up`                 | Start only PostgreSQL                                          |
| `npm run db:down`               | Stop only PostgreSQL                                           |
| `npm run db:status`             | Show PostgreSQL Compose status                                 |
| `npm run db:logs`               | Follow PostgreSQL logs                                         |
| `npm run db:validate`           | Validate the Prisma schema                                     |
| `npm run db:deploy`             | Apply committed migrations                                     |
| `npm run db:migrate`            | Create/apply a development migration                           |
| `npm run db:migrations:check`   | Validate migration naming and sequence                         |
| `npm run db:verify`             | Verify migrations against a clean temporary database           |
| `npm run db:seed:jobs`          | Seed local demonstration jobs                                  |
| `npm run db:studio`             | Open Prisma Studio                                             |
| `npm run db:reset:empty`        | Recreate an empty local database                               |
| `npm run db:reset`              | Delete the local PostgreSQL volume, reapply migrations, reseed |
| `npm run db:reset:user -- <id>` | Delete one user's activity/profile/CV data, keep auth records  |

> ⚠️ Database reset commands are destructive. Never point them at a shared or production database.

### Worker and administration probes

| Command                             | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `npm run email:worker`              | Run only the email outbox worker on the host                       |
| `npm run cv:worker:probe`           | Probe CV worker configuration/runtime boundaries                   |
| `npm run cv:scanner:check`          | Check the configured scanner boundary                              |
| `npm run ocr:up`                    | Build/start only the OCR engine                                    |
| `npm run ocr:check`                 | Check OCR readiness                                                |
| `npm run image-search:worker:probe` | Probe image-search worker dependencies                             |
| `npm run admin:worker:probe`        | Probe admin worker loops                                           |
| `npm run admin:evidence:check`      | Validate admin evidence readiness                                  |
| `npm run admin:provision -- <args>` | Provision a Platform Administrator through the controlled CLI      |
| `npm run admin:revoke -- <args>`    | Revoke Platform Administrator authority through the controlled CLI |

## Run local

Run all commands from the repository root.

### 1. Clone and enter the repository

```bash
git clone https://github.com/quocuy0112/Software-Engineering---Group-9.git
cd Software-Engineering---Group-9
```

### 2. Install the locked dependencies

```bash
npm ci
```

Use `npm ci`, not a workspace-local install — the repository owns one root lockfile.

### 3. Generate local environment files and private keys

```bash
npm run env:init
```

Creates/updates `.env` (Docker/worker settings), `web/.env.local` (application), private local storage directories under `web/.local/`, and random database/auth/token/encryption/HMAC secrets when missing. Existing secret values are preserved and never printed.

### 4. Configure the required local provider key

Set `OPENAI_API_KEY` to the same non-empty value in `.env` and `web/.env.local` when `IMAGE_SEARCH_WORKER_ENABLED=true`. Never commit either environment file. The CV parser remains deterministic by default.

### 5. Start PostgreSQL and apply migrations

```bash
npm run db:up
npm run db:deploy
npm run db:seed:jobs
```

Use `db:deploy` for committed migrations, and `db:migrate` only when developing a new Prisma migration.

### 6. Validate the environment

```bash
npm run env:check
```

Checks runtime versions, Docker/Compose, environment invariants, storage boundaries, database connectivity, provider gates, and administrative evidence readiness without printing secret values.

### 7. Start the complete development environment

```bash
npm run dev
```

The first run may take several minutes because worker images and OCR assets must be built; subsequent builds use Docker layer caching. Wait for:

```text
SmartHire ready at http://127.0.0.1:3001
```

### 8. Verify health

```bash
curl http://localhost:3001/api/health
docker compose ps
```

On PowerShell:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/health
docker compose ps
```

### Local URLs

| Surface                  | URL                                       | Status                                                                          |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------- |
| Candidate application    | `http://localhost:3001`                   | Active                                                                          |
| Messaging workspace      | `http://localhost:3001/messages`          | Active after authentication                                                     |
| Platform Admin console   | `http://console.admin.localhost:3001`     | Active for authorized administrators                                            |
| Recruiter console origin | `http://console.recruiter.localhost:3001` | Reserved boundary; full Recruiter Manager UI is not part of the current release |
| Health endpoint          | `http://localhost:3001/api/health`        | Public operational health                                                       |

The application validates exact hosts — do not use the admin console through the Candidate hostname.

### Stopping development

- `Ctrl+C` in the `npm run dev` terminal stops the web and email supervisor processes; Docker infrastructure keeps running.
- `npm run infra:down` removes all Compose containers while retaining named volumes.
- `npm run db:down` stops only PostgreSQL.

### Running only selected components

```bash
npm run dev:web
npm run email:worker
npm run infra:up
```

### Production-like run

```bash
npm run build
npm start
```

`npm start` executes `web/server.ts` through the production `tsx` dependency. The application requires a long-lived self-hosted Node.js process because the Socket.IO WebSocket gateway cannot run in a serverless Route Handler or Edge runtime. A reverse proxy must preserve the WebSocket upgrade and route the exact configured hosts to port `3001`.

### Troubleshooting

**Docker Desktop is not running** — start Docker Desktop, wait for `docker desktop status` to report `running`, then re-run `npm run infra:up` or `npm run dev`.

**A worker is stopped and does not restart after `docker stop`** — `restart: unless-stopped` respects an explicit operator stop; recover with `npm run dev` or `npm run infra:up`.

**CV worker reports stale ClamAV definitions** — inspect logs with `docker compose logs --tail 100 clamav` / `cv-worker`. ClamAV remains running but unhealthy, keeps FreshClam active, and retries `clamd` every 60 seconds. Scanner-dependent workers may restart until the socket returns, while web development remains available. Do not bypass the 24-hour freshness gate; restore connectivity and wait for the mirror to update.

**Admin worker repeatedly exits** — check `docker compose logs --tail 100 admin-worker` and `npm run admin:worker:probe`; verify environment initialization completed and container-local storage paths are correct.

**Image-search worker fails configuration validation** — confirm `OPENAI_API_KEY` is present in both env files, confirm CV and image-search keys are all distinct, then run `npm run env:init` and `npm run env:check`.

**PostgreSQL is unavailable** — run `npm run db:status`, `npm run db:logs`, `npm run db:up`. The app connects via `localhost:55432`; Docker workers connect via `postgres:5432`.

**Migration history is inconsistent** — run `npm run db:migrations:check`, then `npm run db:migrations:reconcile-names -- --apply`, then `npm run db:deploy`.

**Port 3001 is already in use** — stop the existing dev/start process first; Docker does not own port 3001.

**Workspace module cannot be resolved** — stop the dev server and run `npm ci` from the repository root (do not install packages independently under `web/`).

**Browser automation cannot launch Chromium** — run `npx playwright install chromium`.

## Run test

### Baseline checks

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run build
```

Some integration and system suites require running PostgreSQL or the full Compose stack — start it with `npm run infra:up` first.

### Focused suites

```bash
npm run test:job-board
npm run test:cv-import
npm run test:ocr-image-search
npm run test:admin-management
npm run test:messaging
```

### Browser end-to-end suites

```bash
npm run test:e2e
npm run test:cv-import:e2e
npm run test:ocr-image-search:e2e
npm run test:admin-management:e2e
npm run test:messaging:e2e
```

Playwright tests may create isolated PostgreSQL fixtures — do not point browser tests at a shared database.

### Performance and operational checks

```bash
npm run perf:profile-account
npm run perf:job-board
npm run perf:image-search
npm run perf:admin-management
npm run perf:messaging
npm run smoke:messaging:server
npm run ocr:supply-chain
```

### Test organization

Tests are separated by concern under `web/tests/`: `backend/unit`, `backend/integration`, `backend/contract`, `frontend/components`, `frontend/accessibility`, `architecture`, `security`, `performance`, `system/e2e`, and `usability`.

## Document

### Project structure

```text
.
|-- compose.yaml                         # Local PostgreSQL/scanner/OCR/workers
|-- Dockerfile.admin-worker
|-- Dockerfile.image-search-worker
|-- Dockerfile.ocr-engine
|-- package.json                         # Root npm workspace commands
|-- package-lock.json                    # Single authoritative lockfile
|-- scripts/                             # Setup, dev supervisor, DB and checks
|-- infra/clamav/                        # clamd/FreshClam configuration
|-- ocr-engine/                          # Isolated Python OCR service and models
|-- deploy/                              # Reviewed deployment policies/evidence
|-- docs/                                # Supporting project documentation
|-- spec-kit/
|   |-- .specify/                        # Spec Kit templates, memory, scripts
|   `-- specs/                           # Feature specs/plans/contracts/tasks
`-- web/
    |-- server.ts                        # Next.js + Socket.IO custom entrypoint
    |-- Dockerfile.cv-worker
    |-- prisma/
    |   |-- schema.prisma
    |   `-- migrations/
    |-- scripts/                         # Worker, seed, probe, perf, smoke tools
    |-- src/
    |   |-- app/                         # Pages and thin Route Handlers
    |   |-- frontend/features/           # Feature UI and client adapters
    |   |-- backend/                     # Services, repositories, providers
    |   `-- shared/                      # Transport-neutral contracts/types
    |-- tests/
    `-- *.config.*                       # Next, Prisma, lint, test, CSS configs
```

### Environment configuration

Templates: `.env.example` (Docker, PostgreSQL, CV, OCR, image-search) and `web/.env.example` (application, auth, origin, email, storage, provider, admin, messaging). Local generated files are `.env` and `web/.env.local` — never commit either. The environment parser fails closed when required fixed values, key separation, storage paths, production approvals, or exact origins are invalid.

### Specification workflow

Feature artifacts live under `spec-kit/specs/<number>-<feature>/` and typically include `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `tasks.md`, and `quickstart.md`. Documented functional groups include identity, candidate profile, job-board/search, CV import, OCR/image search, platform administration, and realtime messaging. `spec-kit/.specify/memory/constitution.md` is authoritative for security, privacy, human control, data integrity, quality, and architecture boundaries.

### Realtime messaging reference

Messaging REST endpoints live under `/api/messaging/**`; Socket.IO uses the single `/chat` namespace attached by `web/server.ts`. The existing HttpOnly Better Auth cookie authenticates both HTTP and socket handshakes. Feature contracts and verification evidence are in `spec-kit/specs/008-realtime-messaging/`.

### Security and privacy notes

- Never commit `.env`, `web/.env.local`, local email capture, private evidence, uploaded CVs, image-search inputs, database dumps, or provider credentials.
- Authentication credentials exist only in server-controlled cookies — no browser JWTs or local/session storage credentials.
- Every company-scoped operation must revalidate current membership and tenant authority on the server.
- Logs and audit events must not contain CV/message/report text, secrets, or unnecessary personal data.
- Production traffic requires HTTPS and an exact-host reverse proxy.
- AI never owns job retrieval, hiring decisions, application state transitions, or profile writes — candidates review CV-derived profile changes, and humans retain recruitment authority.
- Security defects (authentication bypass, tenant leakage, exposed secrets, personal data) should not be reported in a public issue with reproduction data — contact the maintainers privately.

### Contributing

1. Create or select the appropriate feature branch and Spec Kit artifacts.
2. Keep unrelated user changes intact; do not rewrite existing migration history or generated secrets.
3. Preserve Route Handler → service → repository layering.
4. Add contract, authorization, integration, accessibility, and architecture tests in proportion to the change.
5. Run the focused suite plus baseline typecheck/build gates.
6. Update the relevant spec/plan/tasks/quickstart and this README when commands, setup, topology, or user-visible capabilities change.
7. Commit only reviewed source and documentation — never commit local artifacts or environment files.

## License

This repository currently has no root `LICENSE` file and is not licensed for public reuse. Third-party dependencies and referenced examples retain their own licenses. Add an approved root license before publishing or redistributing the project.
