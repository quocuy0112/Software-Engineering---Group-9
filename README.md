# SmartHire

SmartHire is a full-stack application for building a secure talent workspace
for candidates and hiring teams. The current release includes Identity and
Access Management, professional profiles, and a public job board with
candidate-controlled recruitment actions.

## Table of Contents

- [Current Features](#current-features)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Local Email](#local-email)
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
- Professional profile and account-preference management.
- Public job browse, Vietnamese-diacritic-insensitive search, filters, sorting,
  stable pagination, and approved job details.
- Authenticated save/remove, private job reporting, and transactional job
  applications with confirmed CVs, consent, immutable snapshots, audit, and
  provider-neutral notification work.

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

Local PostgreSQL is available at `localhost:55432`.

`npm run env:init` creates `.env`, `web/.env.local`, and secure local
secrets. Existing files are preserved and never overwritten.

`npm run dev` starts both:

- Next.js on port `3001`.
- The Email Outbox worker.

Run them separately when debugging:

```bash
npm run dev:web
npm run email:worker
```

Development mode compiles a route the first time it is opened, so its first
request is intentionally slower. To evaluate production-like navigation, stop
the development server and run:

```bash
npm run build
npm start
```

Run `npm run email:worker` in another terminal when testing email flows against
the production server.

## Local Email

Local development uses the capture adapter by default and does not send email
over the Internet. Captured messages are stored in:

```text
web/.local/mail
```

SMTP and Resend are optional. Configure either provider in
`web/.env.local` using
[`web/.env.example`](web/.env.example), then restart the application.

## Common Commands

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm run dev`            | Start the web app and email worker                   |
| `npm run dev:web`        | Start only Next.js                                   |
| `npm start`              | Start an already-built production server             |
| `npm run email:worker`   | Start only the email worker                          |
| `npm run test:job-board` | Run focused Job Board tests                          |
| `npm run perf:job-board` | Run the 100-sample Job Board performance harness     |
| `npm run db:up`          | Start PostgreSQL                                     |
| `npm run db:down`        | Stop PostgreSQL and retain its data                  |
| `npm run db:status`      | Show PostgreSQL status                               |
| `npm run db:logs`        | Follow PostgreSQL logs                               |
| `npm run db:migrate`     | Apply migrations to the local database               |
| `npm run db:studio`      | Open Prisma Studio                                   |
| `npm run db:verify`      | Verify migrations against a temporary clean database |
| `npm run db:reset`       | Delete the volume and recreate the local database    |

> **Warning:** `npm run db:reset` permanently deletes all data in the current
> local PostgreSQL volume.

## Quality Checks

Run these commands before opening a pull request:

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:job-board
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
- [Job Board feature specification](spec-kit/specs/003-job-board-and-advanced-search/spec.md)
- [Job Board implementation plan](spec-kit/specs/003-job-board-and-advanced-search/plan.md)
- [Job Board OpenAPI contract](spec-kit/specs/003-job-board-and-advanced-search/contracts/openapi.yaml)
- [Job Board data lifecycle](docs/operations/job-board-data-lifecycle.md)

## Security

Never commit `.env`, `web/.env.local`, files under `web/.local`,
credentials, secrets, captured email, logs, or build artifacts. Committed
`.env.example` files must contain placeholder values only.
