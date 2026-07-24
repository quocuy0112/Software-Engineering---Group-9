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

WorkspaceShell is rendered only after the (workspace) server layout validates an ACTIVE Better Auth session. Its client-visible input is limited to a display-safe account/navigation projection and the ephemeral CSRF proof needed by the existing logout Route Handler. The projection may contain name, email, account-created date, and two-factor enabled state for presentation, but it MUST NOT receive a session token, raw session identifier, password, factor material, backup codes, or protected database row; MUST NOT persist its input in browser storage or caches; and MUST treat pathname-derived active state as presentation only.

The shell owns shared SmartHire branding, Dashboard/Profile links, the top-right Profile account control, responsive menu state, and Sign out presentation. ProfileNavigation owns Overview/Security/Sessions links for /profile, /profile/security, and /profile/sessions. Protected child pages own their existing forms and domain-specific API calls and do not duplicate shell markup or fetch authentication state solely for navigation. Sign out continues to call the existing /api/identity/logout contract and redirects only after an observed successful response.

The legacy /settings/security and /settings/sessions Server Components return redirects to /profile/security and /profile/sessions and intentionally discard query strings. Profile Security renders either enrollment or management from authoritative account state. Enrollment verification and disablement gateway results include at most a success flag and one replacement Better Auth Set-Cookie string for immediate transport forwarding; services and client responses never expose the raw session value in JSON.

The public navigation contract treats `/` as the canonical SmartHire Home.
`/home` is a server-side redirect to `/`. `/dashboard`, `/profile`,
`/profile/security`, and `/profile/sessions` are protected; authenticated
users may see Dashboard/Profile controls on `/`. A provisional
AuthenticationChallenge never satisfies the protected workspace boundary.

## PasswordResetSaga

The normal reset service owns one durable `PasswordResetOperation` per claimed
reset proof. Its state machine is `CLAIMED -> PASSWORD_UPDATED ->
SESSIONS_REVOKED -> CHALLENGES_INVALIDATED -> NOTIFICATION_ENQUEUED ->
FINALIZED`, with `FAILED_RETRYABLE` as a fail-closed resumable state. The
claim transaction stores only the HMAC token digest, operation owner,
idempotency identity, audit intent, and milestone timestamps. The submitted
password is passed to Better Auth and is never persisted by SmartHire.
`operationKey` is only a keyed digest binding the proof to that submission so
an unrelated replay cannot replace it; it is not reusable credential material.

Each retry reloads the same operation and resumes the first incomplete
milestone. SmartHire repository effects use compare-and-set/idempotency keys;
the Better Auth password update may be safely re-invoked after an ambiguous
provider result only to converge on the same submitted password. The gateway
never changes the Better Auth TOTP secret or unused backup codes. A single
operation owner wins concurrent claims. Until all mandatory milestones,
notification enqueue, final audit emission, and finalization are durable,
login, second-factor completion, and protected access return generic
fail-closed outcomes. No cross-provider database transaction is claimed.

## FullAccountRecovery

The separate full-recovery boundary accepts an enumeration-safe request and,
for an eligible account only, sends a verified-email confirmation proof. The
proof, completion proof, and one-time cancellation proof are HMAC-digested and
single-use. Consuming confirmation creates one durable
`FullAccountRecoveryOperation`, revokes sessions/challenges, begins a
24-hour hold, and blocks password and second-factor login while pending.
Cancellation is accepted once before completion. After the hold, completion
changes the Better Auth password and disables old TOTP/backup codes only in the
full-recovery completion step, then records durable audit/notification state,
revokes sessions/challenges, and requires a new login without automatic
authentication. The user-facing contract must state that email-only recovery
is lower assurance. The browser receives proof links through URL fragments
only; Route Handlers consume the proof in a POST body and return no proof
values.

## Future service-token ADR boundary (documentation only; not an active runtime contract)

May issue short-lived JWTs only to authenticated server workloads in a future feature. Required claims would include `iss`, exact `aud`, service-principal `sub`, narrow `scope`, `iat`, short `exp`, `jti`, and key ID. No browser, browser cookie, Better Auth JWT plugin, endpoint, or receiving service is implemented here.

## Clock and Crypto boundaries

`Clock` supplies UTC time for deterministic expiry tests. `TokenProtector` generates and protects SmartHire-owned opaque one-time values only: email-verification tokens, password-reset tokens, and other explicitly SmartHire-owned challenge tokens. It returns plaintext once, stores keyed digests, and performs constant-time comparison; it does not own or encrypt/decrypt Better Auth TOTP secrets. A TOTP persistence-encryption extension may be introduced only if the pinned Better Auth spike proves it necessary, the integration supports it safely, and an approved ADR documents the extension without transferring ownership from Better Auth. Neither boundary logs inputs or results.
