# Research: Identity, Authentication, and Account Recovery

**Reviewed**: 2026-07-20. Findings below are tied to the planning pins, not unbounded `latest` installs. Primary sources must be rechecked when a pin changes.

## Version Baseline

| Component                  |                                                            Planning pin | Primary source                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth                |                                                    `better-auth@1.6.11` | [Better Auth releases](https://github.com/better-auth/better-auth/releases)                                                                  |
| Better Auth Prisma adapter |                                    `@better-auth/prisma-adapter@1.6.11` | [Prisma adapter](https://www.better-auth.com/docs/adapters/prisma)                                                                           |
| Next.js                    |                                                           `next@16.2.9` | [Next.js releases](https://github.com/vercel/next.js/releases), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) |
| Prisma CLI/client          |                                  `prisma@7.7.0`, `@prisma/client@7.7.0` | [Prisma releases](https://github.com/prisma/prisma/releases), [release policy](https://www.prisma.io/docs/orm/more/releases)                 |
| Resend Node SDK            |                                                         `resend@6.17.2` | [resend-node releases](https://github.com/resend/resend-node/releases), [send API](https://resend.com/docs/api-reference/emails/send-email)  |
| React Email                | Exact stable package versions are a blocking T002 compatibility outcome | [React Email releases](https://github.com/resend/react-email/releases)                                                                       |

The application manifest belongs at `apps/web/package.json`, registered by the root npm workspace. There must be one root `package-lock.json` and no nested lockfile. T002 must compatibility-test and select exact React Email package versions, then record them in the workspace manifest, root lockfile, and `checklists/dependency-compatibility.md` before any template, adapter, preview, or email integration task proceeds. No unbounded `latest` range is allowed.

## Decision: Local-First Repository and Runtime

**Decision**: Keep Spec Kit under `src/.specify/` and `src/specs/`, while the only modular full-stack application lives under `apps/web/`. Use Node.js `24.18.x` through root `.nvmrc` and `.node-version`, npm workspaces from the repository root, and one root lockfile. Route Handlers, feature UI, server authentication, services, repositories, email adapters, shared UI, Prisma, and tests use the approved `apps/web/` paths from `plan.md`.

**Decision**: Run PostgreSQL 16.12 with root `compose.yaml`, a health check, named-volume persistence, and host port `55432`. Docker Compose is the only required local infrastructure. Host PostgreSQL and `psql` are unnecessary; Prisma commands run from `apps/web/` and provide the application-level connectivity check.

**Decision**: A cross-platform root setup script creates root `.env`, `apps/web/.env.local`, and the local email-capture directory without overwriting files or printing generated PostgreSQL/Better Auth secrets. File capture is the default email driver. Resend is optional and cannot block local setup or startup.

**Alternatives rejected**: a separate frontend/backend pair, moving Spec Kit to the repository root, per-workspace lockfiles, host-installed PostgreSQL/`psql`, and requiring Resend locally all add unsupported structure or machine prerequisites without improving the academic local demonstration.

## Decision: App Router Route Handlers Only

**Verified behavior**: Next.js defines Route Handlers in `route.ts` under `app`; they are the App Router equivalent of Pages Router API Routes, so both mechanisms are unnecessary for this feature.

**Decision**: All identity HTTP endpoints use `apps/web/src/app/api/**/route.ts`, including `apps/web/src/app/api/auth/[...all]/route.ts`. The call chain is Route Handler → Service → Repository/Data Access → PostgreSQL.

**Alternative rejected**: Pages Router API Routes and FastAPI would create an unapproved second backend mechanism.

## Decision: Prisma/PostgreSQL Adapter and Migrations

**Verified behavior**: Better Auth documents `prismaAdapter(prisma, { provider: postgresql })`. Its CLI supports Prisma schema generation but not Prisma migrations; Prisma 7 requires an explicit generated-client output path.

**Decision**: PostgreSQL is the only production database. Generate the Better Auth schema using the pinned Better Auth CLI, review it, and migrate only through pinned Prisma Migrate from `apps/web/`, with schema and migrations under `apps/web/prisma/`. Local compatibility work targets the healthy Compose PostgreSQL service; it does not depend on host `psql`. Do not duplicate Better Auth tables.

**SmartHire extension**: Domain constraints, partial indexes/check constraints that Prisma schema cannot fully express, outbox/audit tables, account-state fields, session policy fields, and safe migration/rollback procedures.

## Decision: One Better Auth Opaque Browser Session

**Verified Better Auth behavior**: With a database configured, Better Auth’s traditional session stores `id`, opaque `token`, `userId`, `expiresAt`, IP address, and user agent in its session table; the token is also the cookie credential. Server session APIs validate the cookie. It supplies configurable expiry/update age, sign-out, active-session listing, selected revocation, other-session revocation, and all-session revocation. Cookie caching/stateless mode are separate options and will be disabled. See [session management](https://www.better-auth.com/docs/concepts/session-management).

**Decision**: Better Auth is the exclusive owner of the only browser authentication cookie and `Session`. Preserve its adapter-compatible `token` field; do not hash/rename it to `tokenDigest`. Do not build a SmartHire JWT/database bridge, custom browser JWT, parallel session table, second browser auth cookie, or Better Auth JWT-plugin replacement.

**Direct support vs extensions**:

| Requirement                                                                                           | Classification                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Database session, server validation, configured expiry, current logout, list, selected/all revocation | Verified Better Auth capability                                                             |
| Independent 30-minute idle timeout                                                                    | SmartHire `lastActivityAt` extension plus validation/touch hook; not claimed native         |
| Independent 7-day absolute timeout                                                                    | Configure Better Auth expiry and enforce `createdAt + 7d` ceiling in SmartHire policy tests |
| Five active sessions                                                                                  | SmartHire serialized session-cap service; not claimed native                                |
| Password-reset revocation                                                                             | SmartHire reset orchestration calls Better Auth all-session revocation                      |
| Suspended/Deleted rejection/revocation                                                                | SmartHire account-state hooks/services plus scheduled cleanup                               |
| Authentication audit events                                                                           | SmartHire append-only audit hooks/services                                                  |

**Future JWT boundary**: JWT may later authorize service-to-service calls with a separate audience and principal. It is not part of this feature and cannot be accepted as a browser session.

## Decision: Better Auth Owns TOTP and Backup Codes

**Verified behavior**: Better Auth’s two-factor plugin owns the `twoFactorEnabled` user field and one `twoFactor` row containing the TOTP secret, serialized backup codes, verification state, failed count, and lock time. It generates backup codes on enablement, deletes/replaces the old codes on regeneration, and removes a used code so it cannot be reused. See [two-factor plugin](https://www.better-auth.com/docs/plugins/2fa).

**Decision**: Better Auth is authoritative for TOTP enrollment/login/disablement and backup-code generation, storage, regeneration, and consumption. SmartHire does not create normalized `BackupCodeSet`/`BackupCode` ownership or a second TOTP implementation. Email OTP and trusted-device options are disabled.

**Unverified/blocking details**: Documentation establishes ownership and nominal single-use behavior, but it does not prove that `1.6.11` encrypts TOTP/backup values at rest to SmartHire’s required standard or that concurrent submission is atomic through the Prisma adapter. Version-locked PostgreSQL tests and source/schema inspection are required. A SmartHire TOTP persistence-encryption extension may be introduced only if the spike proves it necessary, Better Auth integration supports it safely, and an approved ADR documents it. The extension must preserve Better Auth ownership and must not create parallel TOTP or backup-code storage.

### Local QR decision

Exact `qrcode` 1.5.4 and `@types/qrcode` 1.5.6 are approved for the T061–T069 enrollment increment, including gate T180. Local generation avoids disclosure to an external provider, preserves Better Auth ownership, and keeps the implementation replaceable behind the enrollment service. External QR services, remote secret-bearing URLs, client generation, browser storage, and rendered-image persistence were rejected. See `docs/architecture/adr/local-totp-qr-generation.md` for authoritative operational and security rules.

## Decision: Account and Token Ownership

Use unambiguous names:

- `UserAccount`: SmartHire domain user and account state.
- `AuthProviderAccount`: Better Auth credential/provider row; only credential provider is configured.
- `Session`: Better Auth-authoritative browser session.
- `AuthenticationChallenge`: short-lived pre-auth/security challenge that cannot authorize resources.

Better Auth’s `Verification` table may be used only where its semantics meet expiration and one-time use. SmartHire `SecurityToken` owns email-verification and password-reset token lifecycle where custom transactional outbox/state transitions require it; this is a purpose-specific extension, not a duplicate session system.

## Decision: Resend and React Email

**Verified behavior**: Resend’s Node SDK accepts HTML, text, or a React node and supports an `Idempotency-Key` header. Provider idempotency is time-limited, so it does not replace the durable outbox.

**Decision**: `EmailService` selects `resend` only in production. React Email templates produce HTML and text. Local development uses React Email preview and a non-network capture adapter. The transactional outbox supplies durable idempotency, leases, retry classification, and audit-safe provider identifiers.

## Decision: Optional SMTP and asynchronous due-outbox processing

**Verified compatibility evidence**: The root workspace resolves Nodemailer `9.0.3`, `@types/nodemailer` `8.0.1`, and Next.js `16.2.9` under Node.js `24.18.0`. Nodemailer is restricted to server-only adapter code and is not an application-service dependency. The current npm audit reports no Nodemailer finding.

**Decision**: `EMAIL_ADAPTER` is the sole adapter selector. Capture remains the generated local default, SMTP is opt-in for local/team demonstrations, and Resend remains production-oriented. `EMAIL_DRIVER` is removed. All adapters run through `EmailOutbox -> due-outbox processor -> EmailService`; originating HTTP requests stop after the outbox transaction commits.

The long-running worker polls due `PENDING` and `RETRYABLE` rows. It claims bounded batches with PostgreSQL `FOR UPDATE SKIP LOCKED` plus a recoverable lease, commits the claim before network I/O, finalizes only its own lease, uses bounded exponential backoff with jitter, and creates one safe terminal-failure audit event. A cross-platform root development supervisor starts Next.js and the worker together and forwards shutdown signals.

Gmail port 587 uses STARTTLS with `secure=false` and required TLS; optional port 465 uses implicit TLS with `secure=true`. Complete-address username validation, Google App Password support, control-character/header-injection rejection, provider-error redaction, and retryable/terminal classification are mandatory.

**Rationale**: One asynchronous worker path makes capture, SMTP, and Resend behavior consistent, prevents provider latency from extending registration/resend requests, and preserves the provider-independent boundary required by the Constitution.

**Alternatives rejected**: awaiting Nodemailer/Resend in Route Handlers or services couples request success to external networks; one-process fire-and-forget loses work on restart; advisory locks without durable leases can strand jobs; a duplicate `EMAIL_DRIVER` selector permits contradictory configuration.

## Decision: UI and Client State

Tailwind CSS and shadcn/ui are the baseline; React Hook Form and Zod cover forms and validation. Sonner provides supplemental feedback only; inline errors and an accessible summary remain persistent. TanStack Query is added only for a documented server-state benefit. Zustand is optional for non-sensitive shared UI state only. Motion is nonessential and reduced-motion safe. Lenis is not used on authentication pages.

## Decision: Server-First Identity Navigation Shells

Use App Router route groups to separate the public (auth) shell from the protected (workspace) shell without changing public URLs. The protected layout validates the sole Better Auth session on the server and supplies only minimized navigation data plus an ephemeral CSRF proof required by the existing logout route. Active-link and mobile-menu state are presentation-only client state and never authorize access. Ordinary navigation uses Next.js Link; router APIs remain limited to post-action or state-dependent transitions.

The root / becomes a protected foundational identity Dashboard because login already defaults to the protected settings area and the feature has no approved public marketing-page requirement. The Dashboard provides quick links and explicitly labelled future workspace areas without implementing or simulating recruitment-domain data.

**Alternatives rejected**: a client-only session provider duplicates authorization state; every page independently fetching the current session increases coupling and visible loading; merging identity APIs into one endpoint weakens existing transport boundaries; a simulated jobs/recruiter dashboard exceeds this feature scope; full-page internal anchors discard App Router navigation benefits.

## Remaining Research Risks

1. Confirm Better Auth 1.6.11 TOTP-secret and backup-code at-rest format and the exact extension hook for application-managed encryption if required.
2. Prove atomic backup-code single use under concurrent PostgreSQL requests.
3. Prove session hooks can enforce idle/absolute limits and five-session cap without issuing an unvalidated session or racing concurrent logins.
4. Confirm all-session revocation behavior when invoked from the custom password-reset transaction and define compensation/retry if database work cannot share one transaction.
5. T002 must select and compatibility-test exact React Email packages with React/Next.js 16.2.9 and record the result before dependent email tasks begin.
