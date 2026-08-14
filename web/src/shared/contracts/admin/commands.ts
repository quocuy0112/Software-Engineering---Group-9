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

export const moderationCommandSchema = z
  .object({
    category: privilegedReasonCategorySchema,
    reason: normalizedText(10, 500),
  })
  .strict();

export const verificationRejectCommandSchema = commandEnvelopeSchema.extend({
  category: verificationRejectionCategorySchema,
  applicantComment: normalizedText(10, 500),
  protectedNote: normalizedText(0, 2_000).optional(),
});

export const verificationApproveCommandSchema = commandEnvelopeSchema.extend({
  role: membershipRoleSchema.optional(),
  protectedNote: normalizedText(0, 2_000).optional(),
});

export const verificationNotificationStatusSchema = z.enum([
  "QUEUED",
  "DELIVERED",
  "FAILED",
]);

export const verificationDecisionResultSchema = z
  .object({
    requestId: z.string().min(1),
    state: z.enum(["APPROVED", "REJECTED"]),
    version: z.number().int().positive(),
    companyId: z.string().nullable().optional(),
    correlationId: z.string().min(1),
    notification: z.object({
      email: verificationNotificationStatusSchema,
      inApp: verificationNotificationStatusSchema,
    }),
  })
  .strict();

export const moderationCommandResultSchema = z
  .object({
    accountId: z.string().min(1),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    version: z.number().int().positive(),
    correlationId: z.string().min(1),
    emailStatus: z.literal("QUEUED"),
  })
  .strict();

export const removedAdminRoutes = [
  {
    path: "/api/admin/accounts/{accountId}/reinstate",
    method: "POST",
    replacement: "/api/admin/accounts/{accountId}/restore",
  },
  {
    path: "/api/admin/verification-requests/{requestId}/request-changes",
    method: "POST",
    replacement: null,
  },
] as const;

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
export type VerificationDecisionResult = z.infer<
  typeof verificationDecisionResultSchema
>;
