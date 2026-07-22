# Internal Integration Contracts

Implementation boundaries map to `apps/web/src/server/email/`, `apps/web/src/server/auth/`, `apps/web/src/server/services/`, and `apps/web/src/server/repositories/`. Browser-facing handlers remain in `apps/web/src/app/api/**/route.ts`; these paths are modules of the same Next.js application, not separate services.

## EmailService

Accepts typed intents only: `VerificationEmail`, `PasswordResetEmail`, `PasswordChangedEmail`, and `SecurityAlertEmail`. Each intent contains internal IDs, recipient reference, template version, locale, and an opaque link value held only in the worker's protected memory. It returns a provider message reference or an allowlisted retryable/terminal error. Business callers never import Nodemailer, SMTP, or Resend directly.

The only delivery topology is `EmailOutbox -> due-outbox processor -> EmailService -> capture | SMTP | Resend`. Route Handlers and services commit jobs and return; they do not invoke network adapters. The worker contract accepts a bounded batch size and poll interval, claims due `PENDING`/`RETRYABLE` rows transactionally, records a recoverable lease, and finalizes only leases it owns. Shutdown stops polling, drains within a bounded grace period, and leaves unfinished claims recoverable.

`EMAIL_ADAPTER` is the sole selector. Adapter results expose no raw SMTP/provider error. Retryable results carry a safe code and next-attempt policy input; terminal results create one idempotent audit intent. Credentials are never part of an email intent, job payload, result, audit intent, or client-visible contract.

## AuditSink

Accepts only a discriminated event schema containing actor/reference, action, target/reference, result, timestamp, correlation ID, and allowlisted non-sensitive context. Runtime validation rejects arbitrary request bodies, cookies, headers, URLs containing tokens, passwords, OTPs, backup codes, and secret fields.

## AuthGateway

Wraps pinned Better Auth server APIs. Better Auth exclusively owns the opaque browser session, secure authentication cookie, TOTP configuration, and backup-code behavior. The gateway never issues a SmartHire browser JWT, exposes a raw session token through a SmartHire response, or creates parallel TOTP/backup storage. SmartHire services add account-state, 30-minute idle, seven-day absolute, five-session-cap, password-reset revocation, and audit policy around verified Better Auth operations.

## Identity Navigation Shell Contracts

AuthShell is a public presentation boundary for the approved identity routes. It exposes only static SmartHire branding, safe internal navigation targets, child page content, and generic help text. It receives no account, session, verification, reset, TOTP, backup-code, or challenge state.

WorkspaceShell is rendered only after the (workspace) server layout validates an ACTIVE Better Auth session. Its client-visible input is limited to a display-safe navigation projection and the ephemeral CSRF proof needed by the existing logout Route Handler. It MUST NOT receive a session token, raw session identifier, password, factor material, or protected database row; MUST NOT persist its input in browser storage or caches; and MUST treat pathname-derived active state as presentation only.

The shell owns shared SmartHire branding, Dashboard/Security/Sessions links, responsive menu state, and Sign out presentation. Protected child pages own their existing forms and domain-specific API calls and do not duplicate shell markup or fetch authentication state solely for navigation. Sign out continues to call the existing /api/identity/logout contract and redirects only after an observed successful response.

## Future service-token ADR boundary (documentation only; not an active runtime contract)

May issue short-lived JWTs only to authenticated server workloads in a future feature. Required claims would include `iss`, exact `aud`, service-principal `sub`, narrow `scope`, `iat`, short `exp`, `jti`, and key ID. No browser, browser cookie, Better Auth JWT plugin, endpoint, or receiving service is implemented here.

## Clock and Crypto boundaries

`Clock` supplies UTC time for deterministic expiry tests. `TokenProtector` generates and protects SmartHire-owned opaque one-time values only: email-verification tokens, password-reset tokens, and other explicitly SmartHire-owned challenge tokens. It returns plaintext once, stores keyed digests, and performs constant-time comparison; it does not own or encrypt/decrypt Better Auth TOTP secrets. A TOTP persistence-encryption extension may be introduced only if the pinned Better Auth spike proves it necessary, the integration supports it safely, and an approved ADR documents the extension without transferring ownership from Better Auth. Neither boundary logs inputs or results.
