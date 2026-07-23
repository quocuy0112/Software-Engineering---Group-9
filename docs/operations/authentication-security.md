# Authentication security operations

This runbook covers the Better Auth session secret, SmartHire token-digest key, TOTP/backup ownership, and incident revocation. Never copy secret values, opaque session tokens, token URLs, TOTP material, backup codes, cookies, or raw request bodies into logs, tickets, audits, or command output.

## Better Auth secret rotation

`BETTER_AUTH_SECRET` protects the sole Better Auth browser-session mechanism. Plan rotation as a session-invalidating security change unless the pinned Better Auth release and deployment configuration have separately proven a multi-key transition.

1. Announce the maintenance/security window and confirm rollback ownership.
2. Generate the replacement in the deployment secret manager.
3. Stop new authentication traffic or drain instances, update every instance, and restart them consistently.
4. Revoke existing sessions in PostgreSQL through the approved Better Auth/service boundary and expire outstanding pre-authentication challenges.
5. Verify old cookies fail, a new sign-in issues only the approved environment-specific cookie, and protected pages accept the new session.
6. Record only operator, time, reason, affected environment, and counts in the incident record.

If a secret may have leaked, do not restore it. Keep the replacement, revoke all sessions, review authentication audit events, and require users to sign in again.

## Verification/reset token key rotation

`TOKEN_HMAC_KEY` digests verification and password-reset tokens. Rotating it invalidates outstanding links because only digests are stored.

During routine rotation, expire current verification/reset tokens, install the replacement on all instances, then allow users to request fresh generic emails. During suspected compromise, rotate immediately, invalidate all outstanding security tokens and pre-authentication challenges, revoke affected sessions, and review rate-limit/audit evidence. Never attempt to recover or log a raw token.

## TOTP and backup codes

Better Auth 1.6.11 exclusively owns TOTP secrets and serialized backup codes. SmartHire must not add a second TOTP store, export secrets for operations, or regenerate codes on behalf of a user without the existing proof gate. Recovery uses supported user flows; database editing is prohibited.

If TOTP storage protection is suspected compromised, suspend affected authentication access through the authorized account-management process, revoke sessions and pre-authentication challenges, preserve secret-safe evidence, and require password proof plus fresh TOTP enrollment. Regeneration replaces the entire backup-code set; old codes must fail.

## Session and account incidents

- Revoke the current session for logout, a selected owned session for device loss, or all sessions for password-reset/credential compromise.
- Server-side account-state checks remain authoritative. Suspended or Deleted accounts must fail protected access even if cleanup has not yet removed every row.
- Expired, revoked, idle-timeout, absolute-timeout, or ineligible-account sessions are rejected on the next protected request.
- Do not inspect or share raw `Session.token`; user-facing lists use sanitized stable references only.
- Preserve append-only audit evidence. Record allowlisted action/result/context, never credential or authentication material.

After containment, verify one-cookie ownership, production/development cookie attributes, selected/all-session revocation, five-session enforcement, 30-minute idle and seven-day absolute ceilings, TOTP/backup single use, and reset-triggered all-session revocation with the compatibility and integration suites.
