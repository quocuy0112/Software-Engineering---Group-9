# SmartHire

SmartHire is a full-stack application for building a secure talent workspace
for candidates and hiring teams. The current release focuses on Identity and
Access Management; advanced recruitment modules are still under development.

## Table of Contents

- [Current Features](#current-features)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Local Email](#local-email)
- [CV Import Runtime and Security](#cv-import-runtime-and-security)
- [Common Commands](#common-commands)
- [Quality Checks](#quality-checks)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Security](#security)

## Current Features

- Account registration, email verification, and email/password login.
- TOTP two-factor authentication and backup codes.
- Session management, session limits, and revocation.
- Forgot password, password reset, and full account recovery with a 24-hour
  security hold.
- Audit logging, rate limiting, and a transactional email outbox.
- Foundation pages for Home, Dashboard, and Profile.
- Private PDF/DOCX CV upload, asynchronous malware scan/extraction/parsing,
  candidate review, selective Profile confirmation, consent, retry, and
  retention/deletion workflows.

## Architecture and Tech Stack

The application is a modular monolith located in `web`:

```text
Next.js Page/Component
        ↓
Route Handler
        ↓
Service
        ↓
Repository / Better Auth Gateway
        ↓
PostgreSQL / Email Outbox
```

The application directory is organized by responsibility:

```text
web/src/
├── app/                         # thin Next.js routes, layouts, and API handlers
├── frontend/
│   ├── features/               # authentication, home, dashboard, profile
│   ├── providers/
│   ├── styles/
│   └── stores/
├── backend/
│   ├── auth/
│   ├── services/
│   ├── repositories/
│   ├── database/
│   ├── email/
│   └── generated/prisma/
└── shared/
    ├── contracts/
    └── types/
```

`src/app` remains at this location because Next.js discovers App Router
conventions there. Route files should compose backend data with frontend
features rather than contain database access, client state, or large UI trees.

| Area                   | Technology                          |
| ---------------------- | ----------------------------------- |
| Web                    | Next.js 16, React 19, TypeScript    |
| Authentication         | Better Auth 1.6.25                  |
| Database               | PostgreSQL 16, Prisma 7             |
| Validation and forms   | Zod, React Hook Form                |
| UI feedback and motion | Sonner, Motion                      |
| Email                  | Local capture, SMTP, or Resend      |
| Testing                | Vitest, Testing Library, Playwright |

## Prerequisites

- Git
- Node.js `24.18.x`
- npm `11.16.x`
- Docker and Docker Compose

PostgreSQL and `psql` do not need to be installed on the host machine.

## Local Setup

```bash
git clone <repository-url>
cd Software-Engineering---Group-9

npm ci
npm run env:init
npm run db:up
npm run db:migrate
npm run env:check
npm run dev
```

Open the application at:

```text
http://localhost:3001
```

Local PostgreSQL is available at `127.0.0.1:55432`. The only host ports in the
local topology are web `3001` and loopback-only PostgreSQL `55432`; ClamAV and
both workers publish no port.

`npm run env:init` creates `.env`, `web/.env.local`, and secure local
secrets. Existing files are preserved and never overwritten.

`npm run dev` supervises:

- Next.js on port `3001`.
- the Email Outbox worker; and
- the Compose-backed CV worker and its co-located ClamAV service.

One `Ctrl+C` is forwarded to the child processes and stops the CV worker and
ClamAV while retaining durable PostgreSQL and scanner-signature volumes.

Run them separately when debugging:

```bash
npm run dev:web
npm run email:worker
docker compose up --build postgres clamav cv-worker
```

Development mode compiles a route the first time it is opened, so its first
request is intentionally slower. To evaluate production-like navigation, stop
the development server and run:

```bash
npm run build
npm start
```

Run `npm run email:worker` in another terminal when testing email flows against
the production server. Run the CV worker through Compose rather than as a host
process so it receives the Linux storage mount and private scanner socket.

## Local Email

Local development uses the capture adapter by default and does not send email
over the Internet. Captured messages are stored in:

```text
web/.local/mail
```

SMTP and Resend are optional. Configure either provider in
`web/.env.local` using
[`web/.env.example`](web/.env.example), then restart the application.

## CV Import Runtime and Security

The web process reserves and streams private artifacts; a durable CV worker
claims scan, extraction, parse, cleanup, and reconciliation work from
PostgreSQL. Locally, ClamAV and that worker share only
`/run/clamav/clamd.sock` with group-only mode `0660`. Production must use the
same-host or same-pod topology. Never expose a scanner TCP port or mount the
socket into the web/email processes.

Candidate-visible bounded retries are the recovery mechanism. P0 has no hidden
admin dead-letter queue or admin-only resume step: after caps are exhausted the
candidate can replace/delete the import or continue through manual Profile
entry. Cleanup and reconciliation must keep running when new upload or parser
dispatch is disabled. Use only the committed synthetic/curated fixtures for
debugging; never dump a candidate document, extracted text, storage locator, or
provider payload into logs.

P0 deliberately has no original-CV preview, retrieval, or download endpoint.
Production also inherits the trusted-ingress HTTPS gate: TLS termination,
HTTP-to-HTTPS redirect, approved HSTS, secure-cookie/origin preservation, and
the fixed allowlisted HTTPS OpenAI endpoint must all be verified. Custom or
non-HTTPS provider endpoints are rejected. S3 and external OpenAI dispatch stay
disabled until every provider/privacy gate documented in the
[Feature 004 quickstart](spec-kit/specs/004-cv-upload-parse-review/quickstart.md)
is approved.

Feature 004 UI uses existing Tailwind/shadcn primitives first. Custom styling is
optional and, when needed, belongs in an adjacent same-basename CSS Module
(`component.tsx` + `component.module.css`). Feature-level catch-all styles,
`:global`, cross-component CSS Module imports, and leakage into global/shared
stylesheets are prohibited and architecture-tested.

## Common Commands

| Command                                                  | Purpose                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                                            | Supervise web, email worker, Compose CV worker, and ClamAV     |
| `npm run dev:web`                                        | Start only Next.js                                             |
| `npm start`                                              | Start an already-built production server                       |
| `npm run email:worker`                                   | Start only the email worker                                    |
| `docker compose exec cv-worker npm run cv:scanner:check` | Verify the private scanner socket/readiness from the CV worker |
| `npm run test:cv-import`                                 | Run Feature 004 Vitest/architecture checks                     |
| `npm run test:cv-import:e2e`                             | Run serial Feature 004 browser journeys                        |
| `npm run db:up`                                          | Start PostgreSQL                                               |
| `npm run db:down`                                        | Stop Compose services and retain their data                    |
| `npm run db:status`                                      | Show PostgreSQL status                                         |
| `npm run db:logs`                                        | Follow PostgreSQL logs                                         |
| `npm run db:migrate`                                     | Apply migrations to the local database                         |
| `npm run db:studio`                                      | Open Prisma Studio                                             |
| `npm run db:verify`                                      | Verify migrations against a temporary clean database           |
| `npm run db:reset`                                       | Delete the volume and recreate the local database              |

> **Warning:** `npm run db:reset` permanently deletes all data in the current
> local PostgreSQL volume.

## Quality Checks

Run these commands before opening a pull request:

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run test:cv-import -- --pool=forks --no-file-parallelism --maxWorkers=1
npm run test:cv-import:e2e
npm run build
```

Run browser end-to-end tests with:

```bash
npm run test:e2e
```

## Project Structure

```text
.
├── web/                                  # Main Next.js workspace
│   ├── prisma/
│   │   ├── migrations/                   # Ordered PostgreSQL migrations
│   │   └── schema.prisma                 # Application data model
│   ├── scripts/                          # Build, performance, and worker scripts
│   ├── src/
│   │   ├── app/                          # Thin Next.js App Router boundary
│   │   │   ├── (auth)/                   # Public identity and recovery routes
│   │   │   ├── (workspace)/              # Session-protected routes
│   │   │   └── api/                      # Browser-facing Route Handlers
│   │   ├── frontend/
│   │   │   ├── features/                 # Authentication, Home, Dashboard, Profile
│   │   │   ├── providers/                # Application-level client providers
│   │   │   ├── styles/                   # Tokens and feature stylesheets
│   │   │   └── stores/                   # Non-sensitive UI state
│   │   ├── backend/
│   │   │   ├── auth/                     # Better Auth integration and policy
│   │   │   ├── services/                 # Application orchestration
│   │   │   ├── repositories/             # Data-access implementations
│   │   │   ├── database/                 # Prisma client boundary
│   │   │   ├── email/                    # Templates, adapters, and workers
│   │   │   └── generated/prisma/         # Generated Prisma client; do not edit
│   │   └── shared/                       # Transport-neutral contracts and types
│   ├── tests/
│   │   ├── architecture/                 # Cross-layer boundaries
│   │   ├── backend/                      # Unit, integration, contract, compatibility
│   │   ├── frontend/                     # Components and browser-safe architecture
│   │   ├── shared/                       # Shared contract tests
│   │   └── system/e2e/                   # Playwright browser workflows
│   ├── .env.example                      # Application environment template
│   └── *.config.*                        # Framework, database, and test configuration
├── docs/                                  # Requirements, design, planning, testing, and project reports
├── scripts/
│   └── .mjs                               # Local setup, validation, and development scripts
├── spec-kit/
│   └── specs/
│       └── 001-identity-authentication-account-recovery/
│           ├── checklists/                # Requirement verification records
│           ├── contracts/                 # OpenAPI and internal contracts
│           └── *.md                       # Speckit cycle definitions
├── .env.example                           # Docker/PostgreSQL environment template
├── compose.yaml                           # Local PostgreSQL 16.12
└── README.md                              # Project entry point
```

## Documentation

- [Implementation plan](spec-kit/specs/001-identity-authentication-account-recovery/plan.md)
- [Feature specification](spec-kit/specs/001-identity-authentication-account-recovery/spec.md)
- [OpenAPI contract](spec-kit/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml)
- [Feature 004 implementation plan](spec-kit/specs/004-cv-upload-parse-review/plan.md)
- [Feature 004 verification quickstart](spec-kit/specs/004-cv-upload-parse-review/quickstart.md)

## Security

Never commit `.env`, `web/.env.local`, files under `web/.local`,
credentials, secrets, captured email, logs, or build artifacts. Committed
`.env.example` files must contain placeholder values only.
