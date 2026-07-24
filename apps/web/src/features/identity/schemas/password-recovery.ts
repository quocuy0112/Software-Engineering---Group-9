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

/** Enumeration-safe entry point for the separate loss-of-all-factors workflow. */
export const accountRecoveryRequestSchema = z.object({ email }).strict();
export type AccountRecoveryRequest = z.infer<
  typeof accountRecoveryRequestSchema
>;

const recoveryProof = z.string().trim().min(32).max(512);

/** A fragment-carried proof is copied into a POST body and is never returned. */
export const accountRecoveryProofSchema = z
  .object({ proof: recoveryProof })
  .strict();
export type AccountRecoveryProof = z.infer<
  typeof accountRecoveryProofSchema
>;

export const completeAccountRecoverySchema = z
  .object({
    completionProof: recoveryProof,
    newPassword: password,
    confirmPassword: password,
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type CompleteAccountRecovery = z.infer<
  typeof completeAccountRecoverySchema
>;

export const PASSWORD_RECOVERY_GENERIC_RESPONSE =
  "If the account is eligible, password-reset instructions will be sent.";
export const PASSWORD_RESET_GENERIC_ERROR =
  "This password-reset link is invalid or has expired.";
export const ACCOUNT_RECOVERY_GENERIC_RESPONSE =
  "If the account is eligible, account-recovery instructions will be sent.";
export const ACCOUNT_RECOVERY_GENERIC_ERROR =
  "This account-recovery link is invalid, expired, or already used.";
export const ACCOUNT_RECOVERY_LOWER_ASSURANCE_NOTICE =
  "Email-only recovery is lower assurance than using your password and second factor.";
