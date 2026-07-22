import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(12).max(128);

/** Enumeration-safe forgot-password input. The email is write-only at the API boundary. */
export const forgotPasswordSchema = z
  .object({ email })
  .strict();
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;

/** Reset input. The opaque token is accepted only as request input and is never serialized in responses. */
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    newPassword: password,
    confirmPassword: password,
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type ResetPassword = z.infer<typeof resetPasswordSchema>;

export const PASSWORD_RECOVERY_GENERIC_RESPONSE =
  "If the account is eligible, password-reset instructions will be sent.";
export const PASSWORD_RESET_GENERIC_ERROR =
  "This password-reset link is invalid or has expired.";
