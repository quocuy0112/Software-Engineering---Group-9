# Implementation Plan: Identity, Authentication, and Account Recovery

**Branch**: `001-identity-authentication-account-recovery` | **Date**: 2026-07-20  
**Spec**: `src/specs/001-identity-authentication-account-recovery/spec.md`

## Summary

Deliver the approved P0 identity scope in one Next.js App Router application. Next.js App Router Route Handlers are the only HTTP backend mechanism and call Service → Repository/Data Access → PostgreSQL. Better Auth is the exclusive browser-session owner and uses its secure opaque cookie plus PostgreSQL `Session` row; SmartHire creates no browser JWT, second authentication cookie, or parallel session table. Prisma/Prisma Migrate own schema access and migrations. Resend, behind an email boundary, sends React Email templates; local development uses preview plus a non-network capture adapter.

## Technical Context

**Runtime**: Node.js 24 LTS, TypeScript 5.9; exact package versions are planning pins and must be locked before implementation  
**Primary dependencies**: Next.js `16.2.9`; Better Auth and `@better-auth/prisma-adapter` `1.6.11`; Prisma and `@prisma/client` `7.7.0`; Resend `6.17.2`; exact React Email package versions are a blocking T002 compatibility outcome and must be recorded in `package.json`, the lockfile, and dependency-compatibility evidence before email work begins; Tailwind CSS; shadcn/ui; React Hook Form; Zod; Sonner; optional TanStack Query, Zustand, and Motion under the restrictions below  
**Storage**: PostgreSQL only in production; Prisma ORM and Prisma Migrate  
**Testing**: unit, OpenAPI contract, PostgreSQL integration, component/accessibility, and browser E2E tests with controlled clock and concurrency cases  
**Performance target**: authentication page load ≤3 seconds and identity interactions ≤2 seconds under the environment and dataset defined in `quickstart.md`  
**Scope**: registration, email verification, password login, Better Auth TOTP and backup codes, password recovery, session management, account-state enforcement, audit, rate limiting, and transactional email only. No email OTP, social login, trusted devices, email change, passkeys, SMS, Python/FastAPI backend, or AI.

## Constitution Check

| Gate | Design evidence | Result |
|---|---|---|
| II Security/privacy | Server validation; one HttpOnly/Secure-production/SameSite Better Auth cookie; no auth material in browser stores; generic anti-enumeration responses; secrets redacted. | Pass |
| IV Integrity/audit | PostgreSQL constraints and transactions; one-time token use; append-only audit; outbox idempotency. | Pass |
| V Scope | Only approved identity stories are retained; deferred capabilities remain excluded. | Pass |
| VI Quality/accessibility | Measurable test environment; field errors plus summaries; Sonner is supplemental; keyboard/responsive checks. | Pass |
| VII Architecture | Next.js App Router Route Handlers only; Route Handler → Service → Repository/Data Access → PostgreSQL; one Better Auth opaque PostgreSQL session mechanism; provider boundaries documented. | Pass |

The active Constitution is `src/.specify/memory/constitution.md`. It permits the selected opaque database-backed session and technology-specific plan decisions. No waiver or complexity exception is required.

## Architecture and Layer Boundaries

```text
Browser / Server Components
        |
app/api/**/route.ts (Route Handlers and Better Auth catch-all)
        |
Identity services and policy hooks
        |
Repositories / data access (Prisma) + provider gateways
        |
PostgreSQL                         Resend
```

- Route Handlers translate HTTP inputs, cookies, status codes, and validated contracts; they contain no domain policy or direct Prisma calls.
- Services enforce account state, timeout/cap policy, token consumption, transactions, audit intents, and email outbox creation.
- Repositories encapsulate Prisma and PostgreSQL behavior. Provider gateways encapsulate Better Auth and Resend.
- Better Auth handlers mount with `toNextJsHandler(auth)` at `app/api/auth/[...all]/route.ts`. Pages Router API Routes are prohibited for this feature.
- Server Components may consume a server-validated session but must not introduce alternate credentials or client-side authorization.

## Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   └── api/
│       ├── auth/[...all]/route.ts
│       └── identity/**/route.ts
├── features/identity/{services,repositories,schemas,integrations}/
├── lib/{auth,db,email,audit,security}/
├── emails/
└── generated/prisma/
prisma/{schema.prisma,migrations/}
tests/{unit,contract,integration,components,e2e}/
```

## Better Auth Ownership and Capability Matrix

Pin Better Auth `1.6.11` and regenerate its Prisma schema with that exact CLI version. Use the same version for the package and schema generation; review generated SQL and apply only through Prisma Migrate.

| Requirement | Better Auth 1.6.11 verified behavior | SmartHire work |
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
| TOTP and backup codes | Two-factor plugin owns TOTP configuration, persistence, and serialized backup codes; used codes are removed and regeneration replaces the old set. | Disable email OTP/trusted devices; verify encryption-at-rest and atomic concurrent single-use against 1.6.11. A SmartHire TOTP persistence-encryption extension is permitted only when the spike proves it necessary, Better Auth integration supports it safely, and an approved ADR documents it; it must not create duplicate ownership. |

The Better Auth JWT plugin is not configured for browser authentication. A future service-to-service JWT is only an architectural note and is not implemented by this feature.

## Session and Challenge Design

- Production uses Better Auth’s only browser authentication cookie named `__Host-smarthire.session` with `Secure=true`, `HttpOnly=true`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute. Development without HTTPS uses the unprefixed `smarthire.session` with `Secure=false`; an insecure cookie must never retain the `__Host-` prefix.
- `AuthenticationChallenge` is temporary pre-authentication state, never a `Session`. Production uses `__Secure-smarthire.pre-auth` with `Secure=true`, `HttpOnly=true`, `SameSite=Lax`, and `Path=/api/identity/two-factor/complete`. Development without HTTPS uses unprefixed `smarthire.pre-auth` with `Secure=false` and the same path. The challenge cannot authorize protected resources.
- Password login delegates credential and two-factor ownership to Better Auth. A full session exists only after all required factors complete.
- Every protected request performs Better Auth server validation, then SmartHire account-state/idle/absolute policy. Invalid, expired, revoked, Suspended, or Deleted sessions are rejected and revoked where possible.
- Session creation runs the five-active-session service. Scheduled cleanup removes expired/revoked rows and sessions belonging to ineligible states; request-time checks remain authoritative.

## Identity, Recovery, and Two-Factor Sequences

1. Registration normalizes email, relies on a unique database constraint, and transactionally creates `UserAccount`, Better Auth `AuthProviderAccount`, base Candidate identity, one-time verification token, audit event, and outbox row.
2. Verification atomically consumes its token and changes Pending Verification → Active. Resends remain generic and supersede older active tokens.
3. TOTP enrollment/verification, backup-code generation/regeneration/use, and disablement delegate authoritative behavior to the pinned Better Auth plugin through a service boundary. Disablement requires one object containing `currentPassword` and `code`.
4. Forgot-password always returns the same accepted response. Reset atomically consumes its token, updates the Better Auth credential, revokes all Better Auth sessions and outstanding challenges/reset tokens, emits audit, and queues notification.
5. This group enforces account states during authentication. Administrator suspension, reinstatement, and deletion commands belong to the future User Management group.

## Data, Email, and UI Decisions

- `data-model.md` defines Better Auth-owned tables once and documents only necessary SmartHire extensions/relations.
- Resend is production-only behind `EmailService`; React Email renders HTML and text. Local development uses React Email preview and a non-network capture adapter. An idempotent transactional outbox isolates provider failures.
- Tailwind CSS and shadcn/ui form the UI baseline. React Hook Form and Zod handle forms and trust-boundary validation. Sonner supplements persistent inline/summary errors and is never the sole error channel.
- TanStack Query is used only for documented value. Zustand may hold only non-sensitive shared UI state. Motion is limited to nonessential reduced-motion-safe transitions. Lenis is prohibited on authentication pages.

## Security and Operations

- Keep Better Auth trusted-origin/CSRF protections enabled; custom writes validate origin/fetch metadata and the applicable Better Auth CSRF mechanism.
- Verification/reset tokens are high-entropy opaque values stored only as keyed digests, expire, and are consumed once. TOTP and backup-code storage remain Better Auth-owned.
- Persistent rate-limit buckets cover registration, login, resend, reset, and two-factor attempts where multi-instance consistency is needed.
- Audit events are append-only and allowlisted; never record passwords, cookies, session tokens, token URLs, TOTP material, backup codes, raw IPs, or request bodies.
- Generate the pinned Better Auth schema, compare it with the committed schema, create reviewed Prisma Migrate SQL, test on a production-like copy, deploy expand/contract, and retain forward-fix/restore procedures. Never edit an applied migration.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL runtime and migration connections |
| `APP_BASE_URL`, `BETTER_AUTH_URL` | One canonical origin |
| `BETTER_AUTH_SECRET` | Better Auth server secret |
| `AUTH_COOKIE_ENV` | Selects production prefixed/Secure cookies or development unprefixed/non-Secure cookies; production mode requires HTTPS |
| `RESEND_API_KEY`, `EMAIL_FROM` | Production email adapter |
| `EMAIL_ADAPTER` | `capture` locally, `resend` in production |
| `TOKEN_HMAC_KEY` | Verification/reset token digest key |

No browser-session JWT issuer, audience, or signing variables exist.

## Verification Strategy

- Contract tests validate OpenAPI, generic anti-enumeration responses, cookie attributes, one session mechanism, and no browser JWT schemas.
- PostgreSQL integration tests cover normalized-email races, one-time tokens, outbox idempotency, concurrent backup-code use, session cap, idle/absolute expiry, reset revocation, and Suspended/Deleted denial.
- Version-compatibility tests exercise Better Auth 1.6.11 schema, Prisma adapter, TOTP storage, backup-code regeneration/single-use, list/revoke/logout, and cookie issuance before implementation is accepted.
- Accessibility tests require keyboard access, focus management, labels, readable inline errors/summaries, reduced motion, responsive layouts, and no color-only status.
- Performance evidence records environment, PostgreSQL dataset, cold/warm state, percentile, and Resend/capture conditions.

## Post-Design Constitution Re-check

All gates pass. The design has one browser-session owner/mechanism, one production database, one server-routing mechanism, explicit provider boundaries, server-side account-state enforcement, and no custom browser JWT. No approved functional scope or user story changed.
