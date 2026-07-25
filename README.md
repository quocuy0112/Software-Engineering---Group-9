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

## Architecture and Tech Stack

The application is a modular monolith located in `apps/web`:

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

| Area                   | Technology                          |
| ---------------------- | ----------------------------------- |
| Web                    | Next.js 16, React 19, TypeScript    |
| Authentication         | Better Auth 1.6                     |
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

`npm run env:init` creates `.env`, `apps/web/.env.local`, and secure local
secrets. Existing files are preserved and never overwritten.

`npm run dev` starts both:

- Next.js on port `3001`.
- The Email Outbox worker.

Run them separately when debugging:

```bash
npm run dev:web
npm run email:worker
```

## Local Email

Local development uses the capture adapter by default and does not send email
over the Internet. Captured messages are stored in:

```text
apps/web/.local/mail
```

SMTP and Resend are optional. Configure either provider in
`apps/web/.env.local` using
[`apps/web/.env.example`](apps/web/.env.example), then restart the application.

## Common Commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the web app and email worker                   |
| `npm run dev:web`      | Start only Next.js                                   |
| `npm run email:worker` | Start only the email worker                          |
| `npm run db:up`        | Start PostgreSQL                                     |
| `npm run db:down`      | Stop PostgreSQL and retain its data                  |
| `npm run db:status`    | Show PostgreSQL status                               |
| `npm run db:logs`      | Follow PostgreSQL logs                               |
| `npm run db:migrate`   | Apply migrations to the local database               |
| `npm run db:studio`    | Open Prisma Studio                                   |
| `npm run db:verify`    | Verify migrations against a temporary clean database |
| `npm run db:reset`     | Delete the volume and recreate the local database    |

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
```

Run browser end-to-end tests with:

```bash
npm run test:e2e
```

## Project Structure

```text
.
├── apps/
│   └── web/                               # Main Next.js workspace
│       ├── prisma/
│       │   ├── migrations/                 # Ordered PostgreSQL migrations
│       │   └── schema.prisma               # Application data model
│       ├── scripts/                        # Build, performance, and worker scripts
│       ├── src/
│       │   ├── app/                        # Next.js App Router
│       │   │   ├── (auth)/                 # Public identity and recovery pages
│       │   │   ├── (workspace)/            # Session-protected application pages
│       │   │   ├── api/
│       │   │   └── *.tsx / *.css          # Root layout, providers, pages, and styles
│       │   ├── components/
│       │   │   ├── auth/                  # Auth, profile, and session UI
│       │   │   └── ui/                    # Reserved reusable UI primitives
│       │   ├── features/
│       │   │   ├── authentication/        # Authentication feature scaffolding
│       │   │   ├── identity/              # Identity client logic and schemas
│       │   │   └── shared/stores/         # Non-sensitive shared UI state
│       │   ├── generated/prisma/          # Generated Prisma client; do not edit
│       │   ├── lib/                       # Database, environment, security, and utilities
│       │   ├── server/
│       │   │   ├── auth/                  # Server-side authentication integration
│       │   │   ├── email/                 # Email templates, previews, and workers
│       │   │   ├── repositories/          # Data-access implementations
│       │   │   └── services/              # Application business logic
│       │   └── types/                     # Shared application type declarations
│       ├── tests/
│       │   ├── architecture/              # Dependency and layer boundaries
│       │   ├── compatibility/             # Better Auth/library compatibility
│       │   ├── components/                # React UI and accessibility
│       │   ├── contract/                  # OpenAPI and public contracts
│       │   ├── e2e/                       # Playwright browser workflows
│       │   ├── integration/               # PostgreSQL and multi-layer behavior
│       │   └── unit/                      # Isolated business logic
│       ├── .env.example                   # Application environment template
│       └── *.config.*                     # Framework, database, and test configuration
├── docs/                                  # Requirements, design, planning, testing, and project reports
├── scripts/
│   └── .mjs                               # Local setup, validation, and development scripts
├── src/
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

- [Implementation plan](src/specs/001-identity-authentication-account-recovery/plan.md)
- [Feature specification](src/specs/001-identity-authentication-account-recovery/spec.md)
- [OpenAPI contract](src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml)

## Security

Never commit `.env`, `apps/web/.env.local`, files under `apps/web/.local`,
credentials, secrets, captured email, logs, or build artifacts. Committed
`.env.example` files must contain placeholder values only.
