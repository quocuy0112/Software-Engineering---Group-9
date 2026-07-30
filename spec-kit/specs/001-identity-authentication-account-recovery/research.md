# Research: Identity, Authentication, and Account Recovery

**Reviewed**: 2026-07-27. Findings below are tied to the planning pins, not unbounded `latest` installs. Primary sources must be rechecked when a pin changes.

## Version Baseline

| Component                  |                                                            Planning pin | Primary source                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth                |                                                    `better-auth@1.6.25` | [Better Auth releases](https://github.com/better-auth/better-auth/releases)                                                                  |
| Better Auth Prisma adapter |                                    `@better-auth/prisma-adapter@1.6.25` | [Prisma adapter](https://www.better-auth.com/docs/adapters/prisma)                                                                           |
| Next.js                    |                                                           `next@16.2.11` | [Next.js releases](https://github.com/vercel/next.js/releases), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) |
| Prisma CLI/client          |                                  `prisma@7.9.0`, `@prisma/client@7.9.0` | [Prisma releases](https://github.com/prisma/prisma/releases), [release policy](https://www.prisma.io/docs/orm/more/releases)                 |
| Resend Node SDK            |                                                         `resend@6.17.2` | [resend-node releases](https://github.com/resend/resend-node/releases), [send API](https://resend.com/docs/api-reference/emails/send-email)  |
| React Email                | Exact stable package versions are a blocking T002 compatibility outcome | [React Email releases](https://github.com/resend/react-email/releases)                                                                       |

The application manifest belongs at `web/package.json`, registered by the root npm workspace. There must be one root `package-lock.json` and no nested lockfile. T002 must compatibility-test and select exact React Email package versions, then record them in the workspace manifest, root lockfile, and `checklists/dependency-compatibility.md` before any template, adapter, preview, or email integration task proceeds. No unbounded `latest` range is allowed.

## Decision: 2026-07-27 npm Advisory Remediation

**Verified findings**: Better Auth versions before 1.6.22 are affected by
[GHSA-qq9h-g4jm-xgf3](https://github.com/advisories/GHSA-qq9h-g4jm-xgf3);
`brace-expansion` through 5.0.7 is affected by
[GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg);
`find-my-way` through 9.6.0 is affected by
[GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h);
and `valibot` through 1.4.1 is affected by
[GHSA-5qjj-4xww-7phc](https://github.com/advisories/GHSA-5qjj-4xww-7phc).

**Decision**: Pin Better Auth/core/adapter 1.6.25, `better-call` 1.3.7 and
Better Auth utils 0.4.2; retain Prisma 7.9.0 while root-overriding only its
development transitives to `find-my-way` 9.7.0 and `valibot` 1.4.2; migrate
from the legacy `eslint-config-next` dependency chain to ESLint 10.8.0,
`@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`, and
`eslint-plugin-react-hooks` flat configs. The resulting tree resolves only
`minimatch` 10.2.5 and `brace-expansion` 5.0.8.

**Rejected**: `npm audit fix --force` attempted to downgrade Prisma, install an
obsolete 0.x Next ESLint preset, and still reported vulnerabilities. Forcing
`brace-expansion` 5 into consumers designed for its legacy CommonJS callable
API was also rejected; the vulnerable consumers were removed instead.

## Decision: Local-First Repository and Runtime

**Decision**: Keep Spec Kit under `spec-kit/.specify/` and `spec-kit/specs/`, while the only modular full-stack application lives under `web/`. Use Node.js `24.18.x` through root `.nvmrc` and `.node-version`, npm workspaces from the repository root, and one root lockfile. Route Handlers, feature UI, server authentication, services, repositories, email adapters, shared UI, Prisma, and tests use the approved `web/` paths from `plan.md`.

**Decision**: Run PostgreSQL 16.12 with root `compose.yaml`, a health check, named-volume persistence, and host port `55432`. Docker Compose is the only required local infrastructure. Host PostgreSQL and `psql` are unnecessary; Prisma commands run from `web/` and provide the application-level connectivity check.

**Decision**: A cross-platform root setup script creates root `.env`, `web/.env.local`, and the local email-capture directory without overwriting files or printing generated PostgreSQL/Better Auth secrets. File capture is the default email driver. Resend is optional and cannot block local setup or startup.

**Alternatives rejected**: a separate frontend/backend pair, moving Spec Kit to the repository root, per-workspace lockfiles, host-installed PostgreSQL/`psql`, and requiring Resend locally all add unsupported structure or machine prerequisites without improving the academic local demonstration.

## Decision: App Router Route Handlers Only

**Verified behavior**: Next.js defines Route Handlers in `route.ts` under `app`; they are the App Router equivalent of Pages Router API Routes, so both mechanisms are unnecessary for this feature.

**Decision**: All SmartHire identity HTTP endpoints use `web/src/app/api/**/route.ts`. `web/src/app/api/auth/[...all]/route.ts` is retained only as a no-store 404 boundary: Better Auth's generic provider routes are not public. The call chain is SmartHire Route Handler → Service → provider gateway or Repository/Data Access → PostgreSQL.

**Alternative rejected**: Pages Router API Routes and FastAPI would create an unapproved second backend mechanism.

## Decision: Prisma/PostgreSQL Adapter and Migrations

**Verified behavior**: Better Auth documents `prismaAdapter(prisma, { provider: postgresql })`. Its CLI supports Prisma schema generation but not Prisma migrations; Prisma 7 requires an explicit generated-client output path.

**Decision**: PostgreSQL is the only production database. Generate the Better Auth schema using the pinned Better Auth CLI, review it, and migrate only through pinned Prisma Migrate from `web/`, with schema and migrations under `web/prisma/`. Local compatibility work targets the healthy Compose PostgreSQL service; it does not depend on host `psql`. Do not duplicate Better Auth tables.

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

**Verified compatibility details**: Better Auth 1.6.25 encrypts TOTP and backup-code values with the configured encrypted-storage option, consumes a backup code through optimistic compare-and-swap, and adds provider-owned `failedVerificationCount` plus `lockedUntil` fields. Version-locked PostgreSQL tests prove one concurrent backup-code winner, replacement invalidation, and successful account-lockout persistence without a parallel SmartHire TOTP store.

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

**Verified compatibility evidence**: The root workspace resolves Nodemailer `9.0.3`, `@types/nodemailer` `8.0.1`, and Next.js `16.2.11` under Node.js `24.18.0`. Nodemailer is restricted to server-only adapter code and is not an application-service dependency. The current npm audit reports no Nodemailer finding.

**Decision**: `EMAIL_ADAPTER` is the sole adapter selector. Capture remains the generated local default, SMTP is opt-in for local/team demonstrations, and Resend remains production-oriented. `EMAIL_DRIVER` is removed. All adapters run through `EmailOutbox -> due-outbox processor -> EmailService`; originating HTTP requests stop after the outbox transaction commits.

The long-running worker polls due `PENDING` and `RETRYABLE` rows. It claims bounded batches with PostgreSQL `FOR UPDATE SKIP LOCKED` plus a recoverable lease, commits the claim before network I/O, finalizes only its own lease, uses bounded exponential backoff with jitter, and creates one safe terminal-failure audit event. A cross-platform root development supervisor starts Next.js and the worker together and forwards shutdown signals.

Gmail port 587 uses STARTTLS with `secure=false` and required TLS; optional port 465 uses implicit TLS with `secure=true`. Complete-address username validation, Google App Password support, control-character/header-injection rejection, provider-error redaction, and retryable/terminal classification are mandatory.

**Rationale**: One asynchronous worker path makes capture, SMTP, and Resend behavior consistent, prevents provider latency from extending registration/resend requests, and preserves the provider-independent boundary required by the Constitution.

**Alternatives rejected**: awaiting Nodemailer/Resend in Route Handlers or services couples request success to external networks; one-process fire-and-forget loses work on restart; advisory locks without durable leases can strand jobs; a duplicate `EMAIL_DRIVER` selector permits contradictory configuration.

## Decision: UI and Client State

Tailwind CSS and shadcn/ui are the baseline; React Hook Form and Zod cover forms and validation. Sonner provides supplemental feedback only; inline errors and an accessible summary remain persistent. TanStack Query is limited to the documented server-state benefit of sanitized session-list/revoke and verification-resend mutations. The exact approved package is `@tanstack/react-query` `5.101.4`; query keys, cached values, and mutation payloads exclude passwords, tokens, TOTP codes, backup codes, and secret-bearing responses. Zustand is optional for non-sensitive shared UI state only. Motion is nonessential and reduced-motion safe. Lenis is not used on authentication pages.

## Decision: Server-First Identity Navigation Shells

Use App Router route groups to separate the public (auth) shell from the protected (workspace) shell without changing public URLs. The protected layout validates the sole Better Auth session on the server and supplies only minimized navigation data plus an ephemeral CSRF proof required by the existing logout route. Active-link and mobile-menu state are presentation-only client state and never authorize access. Ordinary navigation uses Next.js Link; router APIs remain limited to post-action or state-dependent transitions.

The root `/` is the canonical public SmartHire Home. `/home` is a
server-side compatibility redirect to `/`. Authenticated security and session
management live under the protected Profile area, and `/dashboard` is the
protected foundational identity Dashboard. Authenticated users may see
Dashboard/Profile controls on `/`; unauthenticated visitors are not redirected
from Home. The Dashboard provides quick links and explicitly labelled future
workspace areas without implementing or simulating recruitment-domain data.

**Alternatives rejected**: a client-only session provider duplicates authorization state; every page independently fetching the current session increases coupling and visible loading; merging identity APIs into one endpoint weakens existing transport boundaries; a simulated jobs/recruiter dashboard exceeds this feature scope; full-page internal anchors discard App Router navigation benefits.

## Decision: Unified Protected Profile and Better Auth Session Rotation

**Decision**: Replace top-level Security and Sessions navigation with one
Profile destination and directly addressable nested pages: /profile,
/profile/security, and /profile/sessions. A shared Profile layout supplies
Overview/Security/Sessions navigation while distinct server/client components
keep account projection, 2FA management, and sanitized session queries
separate. Legacy settings destinations redirect server-side to the exact
Profile page and discard incoming query strings.

**Decision**: The workspace layout passes only a display-safe account
projection after ACTIVE-session validation. Name and email may render in the
account control, but raw Better Auth session identifiers/tokens, TOTP material,
backup codes, passwords, and CSRF values other than the existing ephemeral
logout proof never enter the projection or persistent client state.

**Verified behavior**: Better Auth 1.6.25 can rotate its authoritative session
during initial TOTP verification and TOTP disablement. Server API calls support
returnHeaders so a provider gateway can capture the new Set-Cookie value. The
custom SmartHire handlers must forward that cookie; otherwise the browser keeps
an invalidated prior session even when the security operation succeeds.

**Decision**: Current-password verification is the renewed proof required after
the ten-minute recent-auth interval. The caller still needs a valid ACTIVE
session and the request remains rate-limited and audited. Rejecting an old
session before verifying the submitted current password was rejected because
it made renewal impossible and conflicted with the renewed-proof requirement.

**Decision**: Profile Security reads authoritative twoFactorEnabled state and
renders exactly one of enrollment or management. Showing both was rejected
because starting Better Auth enrollment for an already enabled account can
replace the active authenticator secret before the user completes the new QR
flow. Hash-only single-page navigation was also rejected in favor of App Router
pages because direct URLs, browser history, active state, and focused E2E tests
are clearer.

## Decision: Normal Password-Reset Saga

Normal password reset is a fail-closed saga across SmartHire persistence and
Better Auth; it is not represented as one transaction spanning both providers.
The durable `PasswordResetOperation` has one token-claim owner, an audit-intent
reference, ordered milestone flags, a stable notification idempotency key,
allowlisted failure state, and finalization state. The milestones are:

1. claim the HMAC-digested reset token and create the operation;
2. update the Better Auth password while leaving its TOTP and unused
   backup-code state untouched;
3. revoke every Better Auth session;
4. invalidate authentication challenges and superseded reset proofs;
5. enqueue one password-change notification; and
6. append the final audit event and finalize the operation.

Retries load the same operation and resume the first incomplete milestone.
SmartHire-side effects are idempotent. Because a provider response can be
ambiguous, a retry of the same submitted password is allowed to converge on
the same credential state, but it never creates a session or changes 2FA.
Concurrent submissions cannot create a second operation owner, terminal audit
event, or notification. A claimed or partially completed operation blocks
password login, second-factor completion, and protected access until mandatory
cleanup, notification enqueue, audit finalization, and operation finalization
are durable. This explicitly documents the compensation boundary instead of
claiming a cross-provider database transaction.

## Decision: Full Account-Recovery Policy (Deferred Runtime Workflow)

Full account recovery is separate from normal password reset and is only for
loss of the password, TOTP access, and backup codes. Its MVP policy is:

- distinguish malformed, unknown or ineligible, and eligible request outcomes;
- send a verified-email confirmation proof only for an eligible account;
- store only HMAC digests of single-use confirmation, completion, and
  cancellation proofs;
- on confirmation, create one `FullAccountRecoveryOperation`, revoke sessions
  and authentication challenges, issue one completion proof and one
  cancellation proof, and begin a 24-hour security hold;
- block password login and second-factor completion while recovery is pending;
- accept the one-time cancellation proof before completion, persist
  cancellation, and notify the user;
- after the hold, accept the completion proof and policy-compliant password,
  change the Better Auth password, and disable the old TOTP/backup-code state
  only as part of the full-recovery completion step;
- revoke sessions/challenges again, write durable audit and notification
  records, require a new login, and never log the user in automatically; and
- state in the UI and notifications that email-only recovery is lower
  assurance than possession of the original password and second factor.

The operation record remains an orchestration record and never becomes a
second credential, session, TOTP, or backup-code owner. Browser links carry
proofs in URL fragments only; the API consumes them in POST bodies and returns
no proof values.

## Remaining Research Risks

1. Reconfirm Better Auth 1.6.25 TOTP-secret, backup-code, failed-attempt, and lockout persistence whenever the pin changes; the current PostgreSQL gate passes without application-managed encryption.
2. Re-run atomic backup-code single-use tests under concurrent PostgreSQL requests whenever the Better Auth or Prisma pin changes; the current 1.6.25/7.9.0 gate passes.
3. Prove session hooks can enforce idle/absolute limits and five-session cap without issuing an unvalidated session or racing concurrent logins.
4. Confirm all-session revocation behavior when invoked from the reset saga
   and define compensation/retry when SmartHire persistence and Better Auth
   cannot share one transaction; the saga must remain fail-closed and
   idempotent.
5. T002 must select and compatibility-test exact React Email packages with React/Next.js 16.2.11 and record the result before dependent email tasks begin.
