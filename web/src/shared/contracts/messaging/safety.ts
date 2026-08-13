import { z } from "zod";
import { opaqueIdSchema } from "./common";

export const blockProjectionSchema = z
  .object({ targetUserId: opaqueIdSchema, blocked: z.boolean() })
  .strict();

export const messagingReportInputSchema = z
  .object({
    conversationId: opaqueIdSchema,
    targetUserId: opaqueIdSchema,
    targetType: z.enum(["PARTICIPANT", "CONVERSATION"]),
    evidenceMessageId: opaqueIdSchema.nullable().optional(),
    category: z.enum([
      "FRAUD_OR_IMPERSONATION",
      "MISLEADING_CONTENT",
      "DISCRIMINATION_OR_HARASSMENT",
      "ABUSE_OR_THREATS",
      "SPAM_OR_DUPLICATE",
      "PRIVACY_OR_DATA_MISUSE",
      "OTHER",
    ]),
    detail: z.string().normalize("NFKC").trim().max(500).optional().default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category === "OTHER" && value.detail.length < 10) {
      context.addIssue({ code: "custom", path: ["detail"], message: "DETAIL_REQUIRED" });
    }
  });

export const reportReceiptSchema = z
  .object({ receipt: z.literal("REPORT_RECEIVED") })
  .strict();

export type MessagingReportInput = z.infer<typeof messagingReportInputSchema>;
