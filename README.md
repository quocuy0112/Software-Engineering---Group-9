# SmartHire

SmartHire is a full-stack application for building a secure talent workspace for candidates and hiring teams. The current release focuses on Identity and Access Management; advanced recruitment modules are still under development.

## Table of Contents

- [Current Features](#current-features)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Common Commands](#common-commands)
- [Data Ownership and Database Reset](#data-ownership-and-database-reset)
- [Quality Checks](#quality-checks)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## Current Features

- Account registration, email verification, and email/password login.
- TOTP two-factor authentication, backup codes, session limits, and session revocation.
- Forgot password, password reset, and full account recovery with a 24-hour security hold.
- Candidate Profile editing for professional details, experience, education, skills, social links, avatar, account identity, preferences, and security.
- Candidate job search, filtering, job details, saved jobs, applications, and job reporting.
- Transactional email outbox with local capture, SMTP, and Resend adapters.
- Audit logging, rate limiting, CSRF/origin protection, and server-controlled sessions.
- Private PDF/DOCX CV upload with asynchronous malware scanning, text extraction, deterministic or OpenAI parsing, candidate review, selective Profile confirmation, retry, consent, and retention/deletion workflows.

## Architecture and Tech Stack

The application is a modular monolith located in `web`:

```text
Next.js Page or Client Component
              |
              v
App Router Route Handler
              |
              v
Application Service
              |
              v
Repository or Provider Adapter
              |
              v
PostgreSQL / Private Storage / Email Outbox
```

**Tech stack:**

| Area                      | Technology                                           |
| -------------------------- | ----------------------------------------------------- |
| Web                        | Next.js 16.2.11, React 19.2.3, TypeScript 5.9.3       |
| Authentication              | Better Auth 1.6.25                                    |
| Database                   | PostgreSQL 16.12, Prisma 7.9.0                        |
| Validation and forms       | Zod, React Hook Form                                  |
| UI                         | Tailwind CSS 4, Sonner, Motion, Be Vietnam Pro         |
| CV safety and extraction   | ClamAV 1.4, PDF.js, Mammoth                            |
| CV parsing                 | Local deterministic parser or OpenAI Responses API      |
| Artifact storage            | Encrypted local filesystem or production S3/SSE-KMS    |
| Email                       | Local capture, SMTP, or Resend                          |
| Testing                     | Vitest, Testing Library, axe, Playwright               |

## Prerequisites

- Git
- Node.js `24.18.x`
- npm `11.16.x`
- Docker Desktop or Docker Engine with Docker Compose v2
- At least 4 GiB available to the ClamAV container during signature loading

PostgreSQL, `psql`, and ClamAV do not need to be installed on the host machine.

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

For isolated debugging, run:

```bash
npm run dev:web
npm run email:worker
docker compose up --build postgres clamav cv-worker
docker compose up -d --build postgres clamav ocr-engine cv-worker image-search-worker
```

To evaluate production-like navigation rather than development compilation, stop the development server and run:

```bash
npm run build
npm start
```

## Common Commands

| Command                                                            | Purpose                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                                                       | Supervise web, email worker, Compose CV/admin workers, and ClamAV       |
| `npm run dev:web`                                                    | Start only Next.js on port 3001                                  |
| `npm start`                                                          | Start an already-built production server                        |
| `npm run email:worker`                                                | Start only the email outbox worker                               |
| `npm run env:init`                                                    | Create missing local environment files and secrets               |
| `npm run env:check`                                                   | Validate environment, provider, storage, and worker gates        |
| `npm run db:up`                                                      | Start PostgreSQL                                                  |
| `npm run db:down`                                                     | Stop Compose services and retain their volumes                   |
| `npm run db:status`                                                   | Show PostgreSQL status                                            |
| `npm run db:logs`                                                     | Follow PostgreSQL logs                                             |
| `npm run db:migrate`                                                  | Apply pending migrations and create a local migration when the Prisma schema changes |
| `npm run db:deploy`                                                   | Apply already-created migrations without creating a new one       |
| `npm run db:validate`                                                 | Validate the Prisma schema                                        |
| `npm run db:verify`                                                   | Verify migrations against a temporary clean database              |
| `npm run db:studio`                                                   | Open Prisma Studio                                                 |
| `npm run db:seed:jobs`                                                | Seed the local job-board fixture data                              |
| `npm run db:reset`                                                    | Delete the local PostgreSQL volume, reapply migrations, and reseed demo jobs |
| `npm run db:reset:user -- <userId>`                                   | Delete one user's activity/profile/CV data while preserving account/auth data |
| `npm run cv:worker:probe`                                             | Probe the CV worker configuration/runtime boundary                |
| `docker compose exec cv-worker node scripts/check-cv-scanner.mjs`     | Verify the private ClamAV socket from the worker                  |
| `npm run test:job-board`                                              | Run the focused job-board suite                                    |
| `npm run test:cv-import`                                              | Run Feature 004 unit/integration/contract/UI/architecture tests   |
| `npm run test:cv-import:e2e`                                          | Run Feature 004 Playwright journeys                                 |
| `npm run test:e2e`                                                    | Run the complete Playwright suite                                   |

> **Warning:** `npm run db:reset` permanently deletes all data in the current local PostgreSQL volume.

## Data Ownership and Database Reset

Candidate activity and personal data are account-scoped:

- Saved jobs use `SavedJob.userId`.
- Applied jobs use `JobApplication.candidateUserId`.
- Profile skills use `CandidateProfileSkill` through the user's `CandidateProfile`.
- CV records use the user's `CandidateCv` and `CvUpload` rows.
- Job preferences and hidden jobs use `UserJobWorkspaceState.userId`.
- `Skill` is a shared reference catalog; the user's selected skills are stored in the profile-to-skill relation.

The legacy `web/data/jobs/user-job-state.json` file is not used as an application data source.

`npm run db:reset` recreates the complete local PostgreSQL database. It therefore
removes user accounts, authentication data, saved jobs, applications, profiles,
CVs, skills links, and workspace state. It does not call `db:reset:user`
afterward because there are no users left to reset.

To remove only one user's activity and personal data while keeping that user's
account and authentication records:

```bash
npm run db:reset:user -- <userId>
```

If no ID is supplied, the script auto-selects the only account. When multiple
accounts exist, pass the ID explicitly. If the database has no accounts, the
command completes as a no-op.

The account-scoped workspace state is introduced by the committed migration
`015_user_job_workspace_state`. The preceding `013_application_metadata` and
`014_canonical_application_tracking` migrations remain part of the normal
migration history. All migration folders use one continuous
`NNN_snake_case` sequence and are applied automatically when pending; they are
not re-created on every command. Run `npm run db:migrations:check` to validate
the naming sequence.

## Quality Checks

Run the baseline checks before opening a pull request:

```bash
npm run env:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run focused Feature 004 verification with PostgreSQL, ClamAV, and the CV worker available:

```bash
npm run db:verify
npm run test:cv-import -- --pool=forks --no-file-parallelism --maxWorkers=1
npm run test:cv-import:e2e
```

Run the full browser end-to-end suite with:

```bash
npm run test:e2e
```

## Troubleshooting

### CV worker or scanner exits during `npm run dev`

Inspect infrastructure status without printing CV content:

```bash
docker compose ps
docker compose logs --tail 100 clamav
docker compose logs --tail 100 cv-worker
```

### Workspace package cannot be resolved

If Next.js reports that `@fontsource/be-vietnam-pro` or another workspace package cannot be resolved, stop the server and reinstall from the repository root:

```bash
npm ci
```

## Project Structure

```text
.
├── web/                                  # Main Next.js workspace
│   ├── prisma/                           # Database, PostgreSQL migrations
│   ├── scripts/                          # Build, performance, and worker scripts
│   ├── src/
│   │   ├── app/                          # Thin Next.js App Router boundary
│   │   ├── frontend/
│   │   ├── backend/
│   │   └── shared/                       # Transport-neutral contracts and types
│   ├── tests/
│   ├── .env.example                      # Application environment template
│   └── *.config.*                        # Framework, database, and test configuration
├── docs/                                 # Requirements, design, planning, testing, and project reports
├── scripts/                              # Local setup, validation, and development scripts
├── spec-kit/
│   ├── .specify/
│   └── specs/
│       ├── 001-identity-authentication-account-recovery/
│       ├── 002-candidate-profile-account-management/
│       ├── 003-job-board-and-advanced-search/
│       └── 004-cv-upload-parse-review/
├── .env.example                           # Docker/PostgreSQL environment template
├── compose.yaml                           # Local PostgreSQL 16.12
└── README.md                              # Project entry point
```
