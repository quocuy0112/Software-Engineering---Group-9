import { z } from "zod";
import {
  accountErrorSchema,
  idempotencyKeySchema,
  retryMetadataSchema,
} from "./common";

const emailInputSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.normalize("NFKC") : value),
  z.string().trim().max(320).email(),
);

export type NormalizedProposedEmail = {
  displayEmail: string;
  normalizedEmail: string;
};

export function normalizeProposedEmail(input: string): NormalizedProposedEmail {
  const displayEmail = emailInputSchema.parse(input);
  return {
    displayEmail,
    normalizedEmail: displayEmail.toLocaleLowerCase("en-US"),
  };
}

export function emailChangeRequestBinding(input: string): string {
  return normalizeProposedEmail(input).normalizedEmail;
}

export const emailChangeRequestSchema = z
  .object({
    newEmail: emailInputSchema,
    currentPassword: z.string().min(1).max(128),
  })
  .strict();

export const emailChangeQueuedSchema = z
  .object({
    status: z.literal("verification-queued"),
    expiresAt: z.string().datetime({ offset: true }),
    message: z.string().min(1).max(240),
  })
  .strict();

export const emailChangeProofSchema = z
  .object({
    proof: z
      .string()
      .min(32)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/u),
  })
  .strict();

export const emailChangeVerificationOutcomeSchema = z
  .object({
    status: z.literal("success"),
    message: z.string().min(1).max(240),
  })
  .strict();

export const emailChangeIdempotencyKeySchema = idempotencyKeySchema;
export const emailChangeSafeErrorSchema = accountErrorSchema;
export const emailChangeRetryMetadataSchema = retryMetadataSchema;

export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>;
export type EmailChangeQueued = z.infer<typeof emailChangeQueuedSchema>;
export type EmailChangeVerificationOutcome = z.infer<
  typeof emailChangeVerificationOutcomeSchema
>;
