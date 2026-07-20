# Better Auth 1.6.11 compatibility evidence

**Environment**: Node.js 24.18.0, npm 11.16.0, PostgreSQL 16.12 in Docker Compose, Prisma/client/adapter-pg 7.7.0, Better Auth and Prisma adapter 1.6.11.

**Executable command**: `npm run test:compatibility --workspace @smarthire/web`

- [x] Prisma adapter resolves `UserAccount`, `AuthProviderAccount`, `Session`, `Verification`, and `TwoFactor` against PostgreSQL.
- [x] Email/password signup creates one credential account owned by Better Auth.
- [x] Better Auth stores a non-plaintext password hash and verifies valid/invalid passwords.
- [x] Session creation persists one opaque unique `Session.token`; the signed cookie carries that opaque token.
- [x] The final response before second-factor completion clears the session cookie and leaves no persisted session.
- [x] Session list, selected revoke, current sign-out, and all-session revoke execute against PostgreSQL.
- [x] Tampered signed session cookies fail validation.
- [x] TOTP enrollment persists a Better Auth-encrypted secret and verification enables TOTP.
- [x] Sign-in produces a restricted pre-auth challenge and no effective browser session before factor completion.
- [x] Backup codes are generated and stored using Better Auth's encrypted storage option.
- [x] Two concurrent uses of one backup code result in exactly one success through optimistic compare-and-swap.
- [x] Backup-code regeneration replaces the encrypted set and old codes fail.
- [x] Pending Verification, Suspended, and Deleted sessions are rejected by the SmartHire server guard.
- [x] Local session/pre-auth names are unprefixed and insecure; production policy requires `__Host-`/`__Secure-`, Secure, HttpOnly, SameSite=Lax, Path=/, and no Domain.
- [x] Email OTP, social providers, cookie-cache/stateless sessions, and the JWT browser plugin are not configured.

## Verified behavior and required SmartHire extensions

Better Auth 1.6.11 encrypts TOTP secrets. Backup codes are encrypted when `storeBackupCodes: "encrypted"` is configured. Backup-code consumption uses a conditional update that includes the prior serialized value, and the PostgreSQL concurrency test proves one winner. Better Auth briefly creates then clears a session cookie during its internal two-factor sign-in orchestration; the final response clears it and the database retains no session before factor completion.

The pinned plugin has no switch that removes the `trustDevice` request field, so SmartHire sets its trusted-device lifetime to zero and does not expose that option through the typed gateway or future UI. The pinned `TwoFactor` schema does not contain failed-attempt or lock timestamp columns; SmartHire's separate non-authenticating `AuthenticationChallenge` and persistent rate limiter must enforce those policies without taking ownership of TOTP or backup-code storage. Independent idle timeout, absolute ceiling, five-session cap, account-state enforcement, audit, and password-reset orchestration remain SmartHire service-layer responsibilities.

## Security advisory assessment

Better Auth 1.6.11 is affected by GHSA-86j7-9j95-vpqj in OIDC-provider/MCP redirect handling. Neither affected plugin is configured or exposed. The pin remains for this mandatory compatibility run; upgrading requires a separately approved pin change and repeating this checklist.
