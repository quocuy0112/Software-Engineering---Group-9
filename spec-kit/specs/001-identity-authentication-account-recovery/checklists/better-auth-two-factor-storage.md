# Better Auth two-factor storage checklist (T061)

Scope: verify how pinned Better Auth 1.6.25 persists TOTP secrets and backup codes, confirm
exclusive ownership, and decide whether an encryption extension or ADR stop is required.

## Ownership

- [x] The `twoFactor` plugin is configured in `web/src/backend/auth/cookies/config.ts` with
      `twoFactorTable: "TwoFactor"`, `backupCodeOptions.storeBackupCodes: "encrypted"`, and
      `backupCodeOptions.amount: 10`.
- [x] The Prisma `TwoFactor` model (`prisma/schema.prisma`) holds `secret`, `backupCodes`,
      `userId @unique`, and `verified`. No SmartHire service writes to this table; only the Better
      Auth adapter (`ctx.context.adapter`) creates, updates, and deletes rows
      (`node_modules/better-auth/dist/plugins/two-factor/index.mjs`). No parallel SmartHire TOTP or
      backup-code repository exists.
- [x] `UserAccount.twoFactorEnabled` is the only SmartHire-visible flag and is toggled by Better
      Auth's `internalAdapter.updateUser`, not by application code.

## Protection at rest

- [x] TOTP secret: `enableTwoFactor` calls `symmetricEncrypt({ key: ctx.context.secretConfig,
data: secret })` before persisting (`index.mjs`, enable flow). The stored `secret` column is an
      AES-GCM envelope keyed by `BETTER_AUTH_SECRET`, never the plaintext base32 secret.
- [x] Backup codes: `encodeBackupCodes` serializes the ten codes to JSON and, because
      `storeBackupCodes === "encrypted"`, calls `symmetricEncrypt({ data, key: secret })`
      (`backup-codes/index.mjs`). The stored `backupCodes` column is an encrypted envelope, not
      plaintext codes.
- [x] No approved encryption extension is required: Better Auth's built-in `encrypted` storage
      mode already satisfies plaintext-at-rest resolution. No ADR stop condition is triggered.

## Tamper, rotation, consumption, redaction

- [x] Tamper: decryption uses `symmetricDecrypt`; a mutated envelope fails to decrypt (AES-GCM
      auth tag) and `getBackupCodes`/secret decode returns no usable value, so verification fails
      safely rather than accepting tampered input.
- [x] Rotation: re-enrollment deletes existing rows for the user
      (`adapter.deleteMany({ model: twoFactorTable, where: userId })`) before creating the new row,
      so rotation replaces prior secret and codes rather than appending.
- [x] Consumption: backup-code verification recomputes the remaining set and updates the row via
      the adapter inside Better Auth, keeping consumption single-owner and atomic per request.
- [x] Redaction: SmartHire code never logs the secret, backup codes, otpauth URI, or password.
      The gateway (T064) returns only the minimal setup result and never exposes raw storage rows.

## Verification status

- [x] Storage model confirmed by source inspection of pinned Better Auth 1.6.25, including provider-owned failed-verification and lockout fields.
- [x] Executable proof is provided by the T062 PostgreSQL integration test
      (`web/tests/backend/integration/auth/better-auth-totp-storage.test.ts`); this checklist is not
      marked complete on documentation inspection alone.
