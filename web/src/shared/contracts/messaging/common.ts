import { z } from "zod";

export const opaqueIdSchema = z.string().trim().min(1).max(128);
export const cursorSchema = z.string().min(1).max(512);
export const messagingPageLimitSchema = z.coerce.number().int().min(1).max(20).default(20);

export const safeParticipantSchema = z
  .object({
    id: opaqueIdSchema,
    name: z.string().trim().min(1).max(120),
    image: z.url().nullable(),
  })
  .strict();

export const eligibleContextSchema = z
  .object({
    type: z.enum(["APPLICATION", "PROFESSIONAL_CONNECTION"]),
    reference: opaqueIdSchema,
    label: z.string().trim().min(1).max(200),
    companyName: z.string().trim().max(200).nullable().optional(),
    jobTitle: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const messagingErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "AUTHORITY_CHANGED",
  "CONVERSATION_UNAVAILABLE",
  "BLOCKED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CONFLICT",
  "PERSISTENCE_UNAVAILABLE",
]);

export const messagingErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: messagingErrorCodeSchema,
        message: z.string().min(1).max(200),
        retryable: z.boolean(),
        retryAfterSeconds: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();

export type SafeParticipant = z.infer<typeof safeParticipantSchema>;
export type EligibleContext = z.infer<typeof eligibleContextSchema>;
export type MessagingErrorEnvelope = z.infer<typeof messagingErrorEnvelopeSchema>;
