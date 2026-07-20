# Internal Integration Contracts

Implementation boundaries map to `apps/web/src/server/email/`, `apps/web/src/server/auth/`, `apps/web/src/server/services/`, and `apps/web/src/server/repositories/`. Browser-facing handlers remain in `apps/web/src/app/api/**/route.ts`; these paths are modules of the same Next.js application, not separate services.

## EmailService

Accepts typed intents only: `VerificationEmail`, `PasswordResetEmail`, `PasswordChangedEmail`, and `SecurityAlertEmail`. Each intent contains internal IDs, recipient reference, template version, locale, and an opaque link value held only in the worker's protected memory. It returns provider message ID or a classified retryable/permanent error. Callers never import Resend directly.

## AuditSink

Accepts only a discriminated event schema containing actor/reference, action, target/reference, result, timestamp, correlation ID, and allowlisted non-sensitive context. Runtime validation rejects arbitrary request bodies, cookies, headers, URLs containing tokens, passwords, OTPs, backup codes, and secret fields.

## AuthGateway

Wraps pinned Better Auth server APIs. Better Auth exclusively owns the opaque browser session, secure authentication cookie, TOTP configuration, and backup-code behavior. The gateway never issues a SmartHire browser JWT, exposes a raw session token through a SmartHire response, or creates parallel TOTP/backup storage. SmartHire services add account-state, 30-minute idle, seven-day absolute, five-session-cap, password-reset revocation, and audit policy around verified Better Auth operations.

## Future service-token ADR boundary (documentation only; not an active runtime contract)

May issue short-lived JWTs only to authenticated server workloads in a future feature. Required claims would include `iss`, exact `aud`, service-principal `sub`, narrow `scope`, `iat`, short `exp`, `jti`, and key ID. No browser, browser cookie, Better Auth JWT plugin, endpoint, or receiving service is implemented here.

## Clock and Crypto boundaries

`Clock` supplies UTC time for deterministic expiry tests. `TokenProtector` generates and protects SmartHire-owned opaque one-time values only: email-verification tokens, password-reset tokens, and other explicitly SmartHire-owned challenge tokens. It returns plaintext once, stores keyed digests, and performs constant-time comparison; it does not own or encrypt/decrypt Better Auth TOTP secrets. A TOTP persistence-encryption extension may be introduced only if the pinned Better Auth spike proves it necessary, the integration supports it safely, and an approved ADR documents the extension without transferring ownership from Better Auth. Neither boundary logs inputs or results.
