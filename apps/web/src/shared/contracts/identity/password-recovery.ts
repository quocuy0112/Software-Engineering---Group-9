import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(12).max(128);

/** Forgot-password input. The email is normalized before account lookup. */
export const forgotPasswordSchema = z.object({ email }).strict();
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

/** Eligibility-aware entry point for the separate loss-of-all-factors workflow. */
export const accountRecoveryRequestSchema = z.object({ email }).strict();
export type AccountRecoveryRequest = z.infer<
  typeof accountRecoveryRequestSchema
>;

const recoveryProof = z.string().trim().min(32).max(512);
export const accountRecoveryCapabilityKindSchema = z.enum([
  "confirmation",
  "cancellation",
  "completion",
]);
export type AccountRecoveryCapabilityKind = z.infer<
  typeof accountRecoveryCapabilityKindSchema
>;

/**
 * A fragment-carried proof may only be presented to the capability exchange.
 * Mutation endpoints accept the resulting HttpOnly cookie instead of a raw
 * proof supplied by browser JavaScript.
 */
export const accountRecoveryCapabilitySchema = z
  .object({
    kind: accountRecoveryCapabilityKindSchema,
    proof: recoveryProof,
  })
  .strict();
export type AccountRecoveryCapability = z.infer<
  typeof accountRecoveryCapabilitySchema
>;

export const accountRecoveryActionSchema = z.object({}).strict();

export const completeAccountRecoveryActionSchema = z
  .object({
    newPassword: password,
    confirmPassword: password,
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type CompleteAccountRecovery = z.infer<
  typeof completeAccountRecoveryActionSchema
>;

export const PASSWORD_RECOVERY_SUCCESS_RESPONSE =
  "Password-reset instructions will be sent to this email.";
export const PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR =
  "No active account was found for this email.";
export const PASSWORD_RECOVERY_INVALID_EMAIL_ERROR =
  "Enter a valid email address.";
export const PASSWORD_RECOVERY_RATE_LIMIT_ERROR =
  "Too many password-reset requests. Please try again later.";
export const PASSWORD_RECOVERY_REQUEST_FAILED_ERROR =
  "The password-reset request could not be completed. Please try again.";
export const PASSWORD_RESET_GENERIC_ERROR =
  "This password-reset link is invalid or has expired.";
export const ACCOUNT_RECOVERY_SUCCESS_RESPONSE =
  "Account-recovery instructions will be sent to this email.";
export const ACCOUNT_RECOVERY_NOT_ELIGIBLE_ERROR =
  "No eligible account was found for this email.";
export const ACCOUNT_RECOVERY_INVALID_EMAIL_ERROR =
  "Enter a valid email address.";
export const ACCOUNT_RECOVERY_RATE_LIMIT_ERROR =
  "Too many account-recovery requests. Please try again later.";
export const ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR =
  "The account-recovery request could not be completed. Please try again.";
export const ACCOUNT_RECOVERY_GENERIC_ERROR =
  "This account-recovery link is invalid, expired, or already used.";
export const ACCOUNT_RECOVERY_LOWER_ASSURANCE_NOTICE =
  "Email-only recovery is lower assurance than using your password and second factor.";
