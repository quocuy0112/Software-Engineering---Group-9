import { z } from "zod";
import {
  membershipRoleSchema,
  normalizedText,
  privilegedReasonCategorySchema,
  reportCategorySchema,
  verificationRejectionCategorySchema,
} from "./common";

export const commandEnvelopeSchema = z.object({
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  confirmation: z.literal(true),
});

export const privilegedCommandSchema = commandEnvelopeSchema.extend({
  reasonCategory: privilegedReasonCategorySchema,
  explanation: normalizedText(10, 500),
});

export const verificationRequestChangesCommandSchema =
  commandEnvelopeSchema.extend({
    guidance: normalizedText(10, 500),
    privateNote: normalizedText(0, 2_000).optional(),
  });

export const verificationRejectCommandSchema = commandEnvelopeSchema.extend({
  category: verificationRejectionCategorySchema,
  reason: normalizedText(10, 500),
  privateNote: normalizedText(0, 2_000).optional(),
});

export const verificationApproveCommandSchema = commandEnvelopeSchema.extend({
  role: membershipRoleSchema,
  privateNote: normalizedText(0, 2_000).optional(),
});

export const moderationNoteCommandSchema = commandEnvelopeSchema.extend({
  note: normalizedText(1, 2_000),
});

export const reportSubmissionSchema = z
  .object({
    category: reportCategorySchema,
    detail: z.string().max(20_000).optional().default(""),
  })
  .transform((value) => ({
    ...value,
    detail: normalizedText(0, 2_000).parse(value.detail),
  }))
  .superRefine((value, context) => {
    if (value.category === "OTHER" && value.detail.length < 10) {
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "OTHER requires at least 10 characters",
      });
    }
  });

export type PrivilegedCommand = z.infer<typeof privilegedCommandSchema>;
