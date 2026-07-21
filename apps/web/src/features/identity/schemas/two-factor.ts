import { z } from "zod";

/** Current-password re-proof for sensitive two-factor actions. Never logged or placed in a URL. */
export const passwordProofSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password.").max(128) })
  .strict();
export type PasswordProof = z.infer<typeof passwordProofSchema>;

/** Six-digit TOTP verification code. Never logged or placed in a URL. */
export const totpCodeSchema = z
  .object({ code: z.string().regex(/^[0-9]{6}$/, "Enter the 6-digit code.") })
  .strict();
export type TotpCode = z.infer<typeof totpCodeSchema>;
