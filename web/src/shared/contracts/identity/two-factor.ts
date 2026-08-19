import { z } from "zod";

/** Current-password re-proof for sensitive two-factor actions. Never logged or placed in a URL. */
export const passwordProofSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
  })
  .strict();
export type PasswordProof = z.infer<typeof passwordProofSchema>;

/** Six-digit TOTP verification code. Never logged or placed in a URL. */
const normalizedTotpCodeSchema = z
  .string()
  // Authenticator apps commonly display or copy the six digits as `123 456`.
  // Separators are presentation-only and must not change the code that is
  // verified by the provider.
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/, "Enter the 6-digit code."));

export const totpCodeSchema = z
  .object({ code: normalizedTotpCodeSchema })
  .strict();
export type TotpCode = z.infer<typeof totpCodeSchema>;

export const backupCodeSchema = z
  .object({ code: z.string().trim().min(8).max(128) })
  .strict();
export type BackupCode = z.infer<typeof backupCodeSchema>;

export const completeTwoFactorSchema = z.discriminatedUnion("factor", [
  z
    .object({
      factor: z.literal("totp"),
      code: normalizedTotpCodeSchema,
    })
    .strict(),
  z
    .object({
      factor: z.literal("backup-code"),
      code: z.string().trim().min(8).max(128),
    })
    .strict(),
]);
export type CompleteTwoFactor = z.infer<typeof completeTwoFactorSchema>;
export const twoFactorManagementSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type TwoFactorManagement = z.infer<typeof twoFactorManagementSchema>;
export const TWO_FACTOR_GENERIC_ERROR =
  "Verification could not be completed. Sign in and try again.";
