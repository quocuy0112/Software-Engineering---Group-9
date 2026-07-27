# Implementation Plan: Identity, Authentication, and Account Recovery

**Branch**: `001-identity-authentication-account-recovery` | **Date**: 2026-07-20  
**Spec**: `src/specs/001-identity-authentication-account-recovery/spec.md`

## Summary

Transactional email uses one provider-independent path: `EmailOutbox -> due-outbox processor -> EmailService -> capture | SMTP | Resend`. Capture is the generated local default, SMTP is opt-in for local/team demonstrations, and Resend is production-oriented although production deployment is outside this academic project. Registration, verification-resend, normal password reset, full account recovery, and notification requests commit their outbox row and return without awaiting provider network delivery.

Deliver the approved P0 identity scope in one Next.js App Router application. Next.js App Router Route Handlers are the only HTTP backend mechanism and call Service → Repository/Data Access → PostgreSQL. Better Auth is the exclusive browser-session owner and uses its secure opaque cookie plus PostgreSQL `Session` row; SmartHire creates no browser JWT, second authentication cookie, or parallel session table. Prisma/Prisma Migrate own schema access and migrations. Resend, behind an email boundary, sends React Email templates; local development uses preview plus a non-network capture adapter.

## Technical Context

**Runtime**: Node.js `24.18.x`, TypeScript 5.9; root `.nvmrc` and `.node-version` select the same Node line; exact package versions are planning pins and must be locked before implementation

**SMTP dependency decision**: Nodemailer `9.0.3` and `@types/nodemailer` `8.0.1` are exact root-lockfile pins used only by server email integration. Installed-tree evidence confirms Node.js `24.18.0` and Next.js `16.2.11` compatibility. They MUST NOT be imported by client modules, Route Handlers, registration/verification services, or repositories; only the SMTP implementation behind `EmailService` may import Nodemailer. ADR `docs/architecture/adr/transactional-email-adapters-and-worker.md` records the decision.


**TOTP QR dependency decision**: Exact `qrcode` 1.5.4 and `@types/qrcode` 1.5.6 are approved for the T061–T069 enrollment increment, including gate T180, and resolve through the sole root lockfile. The replaceable server-only boundary is `apps/web/src/server/auth/identity/totp-qr-code.ts`. T180 directly blocks T065 and proves only pre-implementation compatibility; the QR ADR defines detailed boundary and security rules.
**Primary dependencies**: Next.js `16.2.11`; Better Auth and `@better-auth/prisma-adapter` `1.6.25`; Prisma and `@prisma/client` `7.9.0`; ESLint `10.8.0` with direct flat-config plugins; Resend `6.17.2`; exact React Email package versions are a blocking T002 compatibility outcome and must be recorded in `apps/web/package.json`, the root lockfile, and dependency-compatibility evidence before email work begins; Tailwind CSS; shadcn/ui; React Hook Form; Zod; Sonner; `@tanstack/react-query` `5.101.4` for sanitized session/resend mutations only; optional Zustand and Motion under the restrictions below
**Storage**: PostgreSQL 16.12 through root Docker Compose locally (host port `55432`, health check, persistent named volume); PostgreSQL remains the only production database; Prisma ORM and Prisma Migrate run from `apps/web/`

**Testing**: unit, OpenAPI contract, PostgreSQL integration, component/accessibility, and browser E2E tests with controlled clock and concurrency cases  
**Performance target**: authentication page load ≤3 seconds and identity interactions ≤2 seconds under the environment and dataset defined in `quickstart.md`  
**Scope**: registration, email verification, password login, Better Auth TOTP and backup codes, password recovery, session management, account-state enforcement, audit, rate limiting, transactional email, and shared identity navigation/workspace/Profile integration only. The workspace addition is limited to authentication-aware shells, a foundational account Dashboard, and directly addressable Profile Overview/Security/Sessions pages; it does not add recruitment-domain behavior. No email OTP, social login, trusted devices, email change, passkeys, SMS, Python/FastAPI backend, or AI.

## Constitution Check

| Gate | Design evidence | Result |
|---|---|---|
| II Security/privacy | Server validation; one HttpOnly/Secure-production/SameSite Better Auth cookie; no auth material in browser stores; generic anti-enumeration responses; secrets redacted. | Pass |
| IV Integrity/audit | PostgreSQL constraints and transactions; one-time token use; append-only audit; outbox idempotency. | Pass |
| V Scope | Only approved identity stories are retained; deferred capabilities remain excluded. | Pass |
| VI Quality/accessibility | Measurable test environment; field errors plus summaries; Sonner is supplemental; keyboard/responsive checks. | Pass |
| VII Architecture | Next.js App Router Route Handlers only; Route Handler → Service → Repository/Data Access → PostgreSQL; one Better Auth opaque PostgreSQL session mechanism; provider boundaries documented. | Pass |

The SMTP decision preserves Principle VII: business services depend on EmailOutbox and `EmailService`, not Nodemailer or provider APIs. Exact library pins and the asynchronous worker are documented here and in the approved ADR; provider failures cannot roll back committed identity state.

The active Constitution is `src/.specify/memory/constitution.md`. It permits the selected opaque database-backed session and technology-specific plan decisions. No waiver or complexity exception is required.

## Architecture and Layer Boundaries

```text
Browser / Server Components
        |
        App Router route-group layouts: (auth) public auth shell | public Home | (workspace) server-authenticated shell
        |
apps/web/src/app/api/**/route.ts (Route Handlers and Better Auth catch-all)
        |
Identity services and policy hooks
        |
Repositories / data access (Prisma) + provider gateways
        |
PostgreSQL            EmailOutbox worker -> EmailService -> capture | SMTP | Resend
```

- Route Handlers translate HTTP inputs, cookies, status codes, and validated contracts; they contain no domain policy or direct Prisma calls.
- Services enforce account state, timeout/cap policy, token consumption, transactions, audit intents, and email outbox creation.
- Repositories encapsulate Prisma and PostgreSQL behavior. Provider gateways encapsulate Better Auth; email adapters encapsulate capture, SMTP/Nodemailer, and Resend behind `EmailService`.
- Better Auth handlers mount with `toNextJsHandler(auth)` at `app/api/auth/[...all]/route.ts`. Pages Router API Routes are prohibited for this feature.
- Server Components may consume a server-validated session but must not introduce alternate credentials or client-side authorization.
- The canonical public Home is `/`; `/home` is a server-side redirect to `/`. The `(workspace)` layout validates the Better Auth session once at the shared server boundary for `/dashboard`, `/profile`, `/profile/security`, and `/profile/sessions`, then passes only a minimized display/navigation projection and ephemeral CSRF proof to the client shell. Legacy `/settings` routes redirect server-side into Profile. The shell never fetches or persists a second session.

### Authenticated Workspace and Profile Integration

- The server-authenticated (workspace) layout is authoritative for Dashboard and all Profile routes. It obtains the ACTIVE Better Auth session once through a request-memoized server helper and derives only a safe display projection: name, email, account-created date, and two-factor enabled state.
- The top-right account control and desktop/mobile navigation use Next.js Link. Pathname state is presentation-only and cannot authorize access.
- Profile uses directly addressable App Router destinations: /profile for Overview, /profile/security for password recovery plus Better Auth-owned 2FA/backup management, and /profile/sessions for sanitized owned-session management. A shared Profile layout owns tabs and headings without one oversized client component.
- Legacy /settings/security and /settings/sessions pages are server redirects to their exact Profile destinations. Query strings are intentionally discarded so obsolete links cannot forward reset, verification, factor, or other secret-bearing parameters.
- A correct current password submitted with a sensitive request is renewed proof when the existing session is older than ten minutes. The session must still be valid and ACTIVE; a wrong password, missing session, inactive account, or throttled request fails generically.
- Better Auth remains the sole TOTP, backup-code, and browser-session owner. Enrollment verification and disablement can rotate its session; gateway calls request response headers and the custom Route Handler forwards only the resulting authoritative Set-Cookie header with no-store response headers.
- Profile Security chooses enrollment or management from authoritative twoFactorEnabled state. It never calls enrollment while 2FA is already enabled, preventing silent secret rotation. Password visibility uses accessible icon buttons and retains browser/password-manager metadata.

## Repository and Project Structure

```text
./
├── package.json                 # npm workspace root; includes apps/web
├── package-lock.json            # the only lockfile
├── .nvmrc
├── .node-version
├── compose.yaml                 # PostgreSQL 16.12, host 55432, health check, volume
├── .env.example
├── scripts/{setup-local.mjs,check-environment.mjs}
├── apps/web/
│   ├── .env.example
│   ├── prisma/{schema.prisma,migrations/}
│   ├── src/
│   │   ├── app/{(auth),api/{auth/[...all],identity/**}/route.ts}
│   │   ├── features/identity/
│   │   ├── server/{auth,services,repositories,email}/
│   │   └── components/ui/
│   └── tests/{unit,contract,integration,components,e2e}/
└── src/
    ├── .specify/{feature.json,memory/constitution.md}
    └── specs/001-identity-authentication-account-recovery/
```

- The repository remains one modular full-stack Next.js application under `apps/web/`; no separate frontend or backend application is permitted.
- Route Handlers live only in `apps/web/src/app/api/**/route.ts`. Feature UI modules live in `apps/web/src/features/`; server authentication integration in `apps/web/src/server/auth/`; business services in `apps/web/src/server/services/`; repositories in `apps/web/src/server/repositories/`; email adapters in `apps/web/src/server/email/`; shared UI in `apps/web/src/components/ui/`.
- Prisma commands and migrations execute with `apps/web/` as their working directory. Tests live under `apps/web/tests/`.
- Spec Kit stays nested under `src/`; neither `src/.specify/` nor `src/specs/` is moved.

## Local-First Setup and Compatibility Chain

Planning must create, without implementing identity features, the shared setup baseline at the repository root: npm workspace configuration, the single root `package-lock.json`, `.nvmrc`, `.node-version`, `compose.yaml`, `.env.example`, `apps/web/.env.example`, `scripts/setup-local.mjs`, `scripts/check-environment.mjs`, root `.gitignore` rules, and matching onboarding in `README.md` and this feature's `quickstart.md`.

`scripts/setup-local.mjs` must be cross-platform, generate strong local PostgreSQL and Better Auth secrets without printing them, never overwrite an existing environment file, create both root `.env` and `apps/web/.env.local`, and create the gitignored local email-capture directory. Root `.env` configures Compose; `apps/web/.env.local` configures Next.js. Example files contain placeholders only.

T002 must run through the root npm workspace and lock exact compatible versions in the single root lockfile. Its PostgreSQL/Prisma/Better Auth compatibility chain uses `docker compose up -d`, waits for the container health check, and then uses Prisma validation, migration, and connectivity commands from `apps/web/`. Host `psql`, a host PostgreSQL installation, and Resend are not prerequisites. PostgreSQL inspection, when needed, runs inside the Compose container; routine connectivity proof comes from Prisma.

Local infrastructure requires only Docker Desktop or another compatible Docker Compose runtime. PostgreSQL is pinned to 16.12, published only to host port 55432, and persisted in a named Docker volume. Local email defaults to file capture; SMTP is opt-in for local/team demonstrations; Resend remains optional and is not required for setup, startup, or routine validation. Generated environment files set only `EMAIL_ADAPTER=capture`; the obsolete duplicate `EMAIL_DRIVER` selector is removed from implementation, setup, validation, and examples.

## Better Auth Ownership and Capability Matrix

Pin Better Auth `1.6.25` and regenerate its Prisma schema with that exact CLI version. Use the same version for the package and schema generation; review generated SQL and apply only through Prisma Migrate. The provider-native sign-up option is disabled, and the generic `/api/auth/**` Route Handler returns a no-store 404; all public operations must cross the typed `/api/identity/**` SmartHire boundary.

| Requirement | Better Auth 1.6.25 verified behavior | SmartHire work |
|---|---|---|
| One opaque PostgreSQL session | Database mode stores opaque `Session.token`; the cookie carries that token; server `getSession` validates it. Cookie cache/stateless mode remain disabled. | Configure PostgreSQL Prisma adapter; require Better Auth server APIs at every protected entry point. |
| Current-session logout | Native sign-out revokes the current session and clears its cookie. | Wrap with origin/CSRF policy and audit. |
| Session listing / selected revocation | Native `listSessions` and `revokeSession`. | Return sanitized stable references; enforce ownership; never expose raw tokens in SmartHire contracts. |
| Revoke all after password reset | Native all-session revocation exists; password-change supports other-session revocation. | Reset service invokes all-session revocation and verifies failure/retry semantics. |
| 7-day lifetime | Native `session.expiresIn` supports expiry. | Treat creation + 7 days as an independent absolute ceiling; test refresh cannot extend it. |
| 30-minute idle timeout | No verified independent idle-timeout primitive. | Add `lastActivityAt` to the Better Auth session model; validate and touch it with bounded writes in hooks/services. |
| Maximum five active sessions | No verified native cap. | Serialize creation per user; revoke least-recent non-current sessions until count ≤5; audit. |
| Suspended/Deleted rejection | Better Auth does not know SmartHire domain states. | `UserAccount.state` hook/service denies sign-in and protected access and revokes remaining sessions; scheduled cleanup is defense in depth. |
| Authentication audit events | No complete SmartHire append-only audit contract. | Hooks/services append allowlisted events without secrets. |
| TOTP and backup codes | Two-factor plugin owns TOTP configuration, encrypted persistence, serialized backup codes, failed-verification count, lock timestamp, atomic used-code removal, and set replacement. | Disable email OTP/trusted devices; preserve the 1.6.25 `failedVerificationCount` and `lockedUntil` schema fields; retain SmartHire request/challenge rate limits as an independent outer control without duplicate TOTP ownership. |

The Better Auth JWT plugin is not configured for browser authentication. A future service-to-service JWT is only an architectural note and is not implemented by this feature.

## Session and Challenge Design

- Production uses Better Auth’s only browser authentication cookie named `__Host-smarthire.session` with `Secure=true`, `HttpOnly=true`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute. Local HTTP uses the unprefixed `smarthire.session` with `Secure=false`; `Secure=false` is allowed only for unprefixed local HTTP cookies, and an insecure cookie must never retain the `__Host-` prefix.
- `AuthenticationChallenge` is temporary pre-authentication state, never a `Session`. Production uses `__Secure-smarthire.pre-auth` with `Secure=true`, `HttpOnly=true`, `SameSite=Lax`, and `Path=/api/identity/two-factor/complete`. Local HTTP uses unprefixed `smarthire.pre-auth` with `Secure=false` and the same path; `Secure=false` is never used with a prefixed cookie. The challenge cannot authorize protected resources.
- Password login delegates credential and two-factor ownership to Better Auth. A full session exists only after all required factors complete.
- Every protected request performs Better Auth server validation, then SmartHire account-state/idle/absolute policy. Invalid, expired, revoked, Suspended, or Deleted sessions are rejected and revoked where possible.
- Session creation runs the five-active-session service. Scheduled cleanup removes expired/revoked rows and sessions belonging to ineligible states; request-time checks remain authoritative.

## Identity, Recovery, and Two-Factor Sequences

1. Registration normalizes email, relies on a unique database constraint, and transactionally creates `UserAccount`, Better Auth `AuthProviderAccount`, base Candidate identity, one-time verification token, audit event, and outbox row.
2. Verification atomically consumes its token and changes Pending Verification → Active. Resends remain generic and supersede older active tokens.
3. TOTP enrollment/verification, backup-code generation/regeneration/use, and disablement delegate authoritative behavior to the pinned Better Auth plugin through a service boundary. Disablement requires one object containing `currentPassword` and `code`.
4. Forgot-password returns a queued-success response only when the normalized email identifies an active account; malformed and unknown/ineligible emails receive distinct errors and create no reset token or outbox item. Normal reset is an idempotent fail-closed saga, not a claimed cross-provider transaction. Its durable `PasswordResetOperation` claims the HMAC-digested token and records an audit intent; the service then updates the Better Auth credential while preserving Better Auth-owned TOTP and unused backup codes, revokes all Better Auth sessions, invalidates outstanding authentication challenges and superseded reset proofs, enqueues one notification by stable idempotency key, emits the final audit event, and finalizes the operation. A retry resumes the same operation; one concurrent claimant wins; a provider result that is ambiguous is safe to converge on the same submitted password; and login remains blocked while any mandatory cleanup, notification enqueue, audit finalization, or operation finalization is incomplete.
5. Full account recovery is a separate workflow for users who lost the password, TOTP access, and backup codes. Its eligibility-aware request returns distinct validation, not-eligible, and queued-success outcomes; only an eligible active, verified, 2FA-enabled account receives a verified-email confirmation proof. Consuming that HMAC-digested single-use proof creates one durable `FullAccountRecoveryOperation`, revokes sessions and challenges, issues one completion proof and one cancellation proof, and starts a 24-hour security hold. Password and second-factor login are blocked while the operation is pending. A one-time cancellation proof cancels the operation before completion and notifies the user. Only after the hold has elapsed does completion change the Better Auth password and disable the old TOTP/backup-code state as part of the full-recovery completion step; it then revokes sessions/challenges again, writes durable audit and notification records, and requires a new login without automatic authentication. The UI and notification explicitly disclose that email-only recovery is lower assurance.
6. This group enforces account states during authentication. Administrator suspension, reinstatement, and deletion commands belong to the future User Management group.

## Data, Email, and UI Decisions

- `data-model.md` defines Better Auth-owned tables once and documents only necessary SmartHire extensions/relations.
- Transactional email follows `EmailOutbox -> due-outbox processor -> EmailService -> capture | SMTP | Resend`. Capture is the generated local default, SMTP is opt-in local/team demonstration, and Resend is production-oriented. React Email renders the unchanged HTML/text templates. Registration and resend commit the outbox row and return without invoking an adapter.
- The due-outbox processor is a long-running server-only process started by `npm run email:worker`. It polls due `PENDING` and `RETRYABLE` rows, transactionally claims a bounded batch using PostgreSQL `FOR UPDATE SKIP LOCKED` or an equivalently proven atomic claim, changes each claim to `PROCESSING` with a lease owner/expiry, and commits before network delivery.
- A successful attempt records `SENT`, increments attempts once, and stores only the provider message reference. Retryable timeout/connection/temporary-provider failures record `RETRYABLE`, a safe error code, bounded exponential backoff with jitter, and `nextAttemptAt`. Permanent authentication/configuration/policy/recipient failures, exhausted attempts, or non-retryable template failures record `DEAD` and one idempotent terminal-failure audit event.
- Expired `PROCESSING` leases become due again after the documented recovery interval so worker restarts do not strand mail. Claim ownership is checked when finalizing; concurrent workers cannot finalize another worker's lease. Provider idempotency keys are defense in depth and do not replace PostgreSQL claim/idempotency controls.
- The worker handles SIGINT/SIGTERM by stopping new polls, allowing a bounded in-flight grace period, releasing or expiring unfinished leases safely, disconnecting from PostgreSQL, and exiting nonzero only for operational startup/fatal-loop failures.
- Root `npm run dev` should start both Next.js and the email worker with one cross-platform supervisor and forward shutdown signals to both. Separate `npm run dev:web` and `npm run email:worker` commands remain available for debugging. Capture uses the same worker path as SMTP and Resend for consistent request semantics.
- Tailwind CSS and shadcn/ui form the UI baseline. React Hook Form and Zod handle forms and trust-boundary validation. Sonner supplements persistent inline/summary errors and is never the sole error channel.
- TanStack Query is used only for documented value. Zustand may hold only non-sensitive shared UI state. Motion is limited to nonessential reduced-motion-safe transitions. Lenis is prohibited on authentication pages.
- Public identity pages share the (auth) layout and AuthShell, with route-specific cross-links implemented using Next.js Link. Protected Dashboard and Profile pages share the (workspace) layout and WorkspaceShell, with active navigation derived from the current pathname for presentation only. Profile Overview, Security, and Sessions use nested App Router pages and a shared Profile navigation layout.
- The foundational Dashboard contains identity-workspace orientation, quick links, and explicitly labelled future placeholders only. It performs no recruitment-domain queries and displays no fabricated Candidate, Recruiter, job, application, notification, or analytics data.

## Security and Operations

- The server-only `totp-qr-code.ts` utility accepts only the Better Auth-generated `otpauth` URI and safe rendering options, exposes a minimal typed interface, rejects malformed or unexpected input, generates locally without network access, and never persists or logs secret-bearing input or output.
- Keep Better Auth trusted-origin/CSRF protections enabled; custom writes validate origin/fetch metadata and the applicable Better Auth CSRF mechanism.
- Verification/reset tokens are high-entropy opaque values stored only as keyed digests, expire, and are consumed once. TOTP and backup-code storage remain Better Auth-owned.
- `PasswordResetOperation` and `FullAccountRecoveryOperation` are SmartHire orchestration records, not alternate credential stores. They contain only digests, state/milestone flags, timestamps, idempotency identities, allowlisted failure codes, and audit/outbox references. Their unresolved mandatory-cleanup state is an authoritative login gate.
- Persistent rate-limit buckets cover registration, login, resend, reset, and two-factor attempts where multi-instance consistency is needed.
- Audit events are append-only and allowlisted; never record passwords, cookies, session tokens, token URLs, TOTP material, backup codes, raw IPs, or request bodies.
- SMTP configuration is server-only. `SMTP_USERNAME` is a complete email address; `SMTP_FROM` rejects CR, LF, and control characters before mailbox parsing; Gmail port 587 requires STARTTLS with `SMTP_SECURE=false` and `SMTP_USE_TLS=true`; optional port 465 requires implicit TLS with `SMTP_SECURE=true`. Google App Passwords are supported but never generated, printed, persisted, audited, or exposed to client bundles.
- SMTP errors map to allowlisted internal codes. Authentication/configuration/policy/recipient rejection is terminal; connection, timeout, and temporary 4xx provider failure is retryable unless the bounded attempt policy is exhausted. Raw provider errors and credentials never enter EmailOutbox or AuditEvent.
- Generate the pinned Better Auth schema, compare it with the committed schema, create reviewed Prisma Migrate SQL, test on a production-like copy, deploy expand/contract, and retain forward-fix/restore procedures. Never edit an applied migration.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL runtime and migration connections |
| `APP_BASE_URL`, `BETTER_AUTH_URL` | One canonical origin |
| `BETTER_AUTH_SECRET` | Better Auth server secret |
| `AUTH_COOKIE_ENV` | Selects production prefixed/Secure cookies or development unprefixed/non-Secure cookies; production mode requires HTTPS |
| `RESEND_API_KEY`, `EMAIL_FROM` | Production email adapter |
| `EMAIL_ADAPTER` | Sole selector: `capture` by default locally, `smtp` by explicit local/team opt-in, `resend` for production-oriented configuration |
| `SMTP_HOST`, `SMTP_PORT` | Server-only SMTP endpoint |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Server-only SMTP credentials; Gmail uses a complete address and Google App Password |
| `SMTP_FROM` | Validated server-only mailbox; rejects CR/LF/control characters |
| `SMTP_SECURE`, `SMTP_USE_TLS` | Server-only implicit-TLS/STARTTLS mode |
| `TOKEN_HMAC_KEY` | Verification/reset token digest key |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Root Compose database configuration; local port is `55432` |
| `EMAIL_CAPTURE_DIR` | Gitignored local file-capture directory |

No browser-session JWT issuer, audience, or signing variables exist.

`EMAIL_DRIVER` is obsolete and MUST be removed from runtime parsing, setup scripts, checks, examples, and developer environment documentation. No SMTP variable may use a `NEXT_PUBLIC_` prefix.

## Verification Strategy

- T180 directly blocks T065. Its executable real-library test verifies exact pins and runtime compatibility, local generation plus content verification, zero network requests, npm audit evidence, and server-only/no-client imports before enrollment implementation begins.
- Compatibility evidence asserts exact Nodemailer `9.0.3` and `@types/nodemailer` `8.0.1` root-lockfile resolution under Node.js `24.18.0`, TypeScript 5.9, and Next.js `16.2.11`; tests must prove the SMTP module stays server-only.
- Environment/unit tests cover Gmail 587 STARTTLS, optional 465 implicit TLS, missing or malformed complete-address usernames, CR/LF/control-character and header-injection attempts in `SMTP_FROM`, missing credentials, contradictory secure/TLS settings, redacted validation errors, and absence of `EMAIL_DRIVER`.
- Adapter tests use mocked transports for successful delivery, authentication failure, timeout/connection failure, retryable temporary response, terminal rejection, safe error mapping, and zero credential logging.
- PostgreSQL integration tests cover polling due `PENDING` and `RETRYABLE` jobs, transactional concurrent claims, lease expiry/worker restart, bounded backoff, attempt accounting, duplicate-delivery prevention, `DEAD` transition, and exactly one terminal-failure audit event.
- Regression tests run capture and Resend through the same worker boundary and prove registration/resend responses return after outbox commit without awaiting network delivery.
- Contract tests validate OpenAPI, generic anti-enumeration responses, cookie attributes, one session mechanism, and no browser JWT schemas.
- PostgreSQL integration tests cover normalized-email races, one-time tokens, outbox idempotency, concurrent backup-code use, session cap, idle/absolute expiry, reset revocation, and Suspended/Deleted denial.
- Reset/recovery integration tests must cover token claim and operation idempotency, Better Auth factor preservation, durable audit intent/finalization, failure injection at every saga milestone, concurrent reset submission, recovery-operation persistence, verified-email confirmation, 24-hour hold enforcement, one-time cancellation, login blocking, post-hold completion, and disabling old 2FA only during full recovery.
- Environment checks verify Node `24.18.x`, npm workspace/one-lockfile invariants, Docker Compose availability, container health, port `55432`, required local files, and capture-directory writability without printing secrets.
- Version-compatibility tests exercise Better Auth 1.6.25 schema, Prisma adapter, TOTP storage and lockout fields, backup-code regeneration/single-use, list/revoke/logout, and cookie issuance against the Compose PostgreSQL service before implementation is accepted.
- Accessibility tests require keyboard access, focus management, labels, readable inline errors/summaries, reduced motion, responsive layouts, and no color-only status.
- Navigation component tests cover semantic landmarks, labelled/expanded mobile controls, active-page state, internal Link destinations, sign-out busy/error behavior, reduced motion, and 320px overflow. Serial Playwright flows prove Visitor cross-links and Authenticated User Dashboard -> Security -> Sessions -> Sign out transitions using response, URL, and destination landmarks.
- Browser E2E tests must prove public `/` and `/home` compatibility, protected Dashboard/Profile routes, normal-reset 2FA preservation and re-login, and the full-recovery request/confirmation/hold/cancellation/completion policy using isolated fixtures and controlled time. A current PASS may be recorded only from a reproducible validation run.
- Performance evidence records environment, PostgreSQL dataset, cold/warm state, percentile, and Resend/capture conditions.

## Dependency Security Assessment

`npm audit --json` was rerun on 2026-07-27 without `--force`: 0 critical,
0 high, 0 moderate, 0 low. The repair pins Better Auth and its adapter to
1.6.25, keeps Next.js 16.2.11 and Prisma 7.9.0, overrides Prisma development
transitives to `find-my-way` 9.7.0 and `valibot` 1.4.2, and replaces the legacy
Next ESLint preset chain with ESLint 10.8.0 plus direct flat-config plugins so
only `brace-expansion` 5.0.8 resolves. The forced npm proposal was rejected
because it attempted incompatible Prisma/ESLint/Next-config changes and still
left findings. Real PostgreSQL compatibility, migration, Vitest, lint,
typecheck, production-build, and audit gates are required after the repair.

## Post-Design Constitution Re-check

All gates pass. The design has one browser-session owner/mechanism, one production database, one server-routing mechanism, explicit provider boundaries, server-side account-state enforcement, and no custom browser JWT. No approved functional scope or user story changed.
