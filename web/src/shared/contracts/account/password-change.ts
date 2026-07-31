import { z } from "zod";
import { idempotencyKeySchema } from "./common";

function unicodeString(min: number, max: number) {
  return z.string().superRefine((value, context) => {
    const length = [...value].length;
    if (length < min || length > max) {
      context.addIssue({
        code: "custom",
        message: `Use between ${min} and ${max} Unicode characters.`,
      });
    }
  });
}

export const passwordChangeRequestSchema = z
  .object({
    currentPassword: unicodeString(1, 128),
    newPassword: unicodeString(12, 128),
    newPasswordConfirmation: unicodeString(12, 128),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.newPasswordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["newPasswordConfirmation"],
        message: "The password confirmation must match.",
      });
    }
  });

export const passwordChangeIdempotencyKeySchema = idempotencyKeySchema;

export const passwordChangeOutcomeSchema = z
  .object({
    status: z.literal("success"),
    message: z.string().min(1).max(240),
  })
  .strict();

export const passwordChangeLockedErrorSchema = z
  .object({
    code: z.literal("PASSWORD_CHANGE_LOCKED"),
    message: z.string().min(1).max(240),
    retryAfterSeconds: z.number().int().min(1).max(900),
  })
  .strict();

export const passwordChangeRetryableErrorSchema = z
  .object({
    code: z.literal("PASSWORD_CHANGE_INCOMPLETE"),
    message: z.string().min(1).max(240),
  })
  .strict();

export function passwordChangeClientBinding(
  value: z.input<typeof passwordChangeRequestSchema>,
): string {
  const parsed = passwordChangeRequestSchema.parse(value);
  // This value never leaves browser memory. It exists only to decide whether a
  // retry may reuse the current opaque Idempotency-Key.
  return JSON.stringify([
    parsed.currentPassword,
    parsed.newPassword,
    parsed.newPasswordConfirmation,
  ]);
}

export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;
export type PasswordChangeOutcome = z.infer<typeof passwordChangeOutcomeSchema>;
