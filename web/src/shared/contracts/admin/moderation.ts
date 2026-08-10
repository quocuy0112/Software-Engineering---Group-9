import { z } from "zod";
import { normalizedText, reportCategorySchema } from "./common";
export const moderationTargetSchema = z
  .object({
    type: z.enum(["JOB", "COMPANY", "MEMBERSHIP", "CANDIDATE"]),
    reference: z.string().min(1).max(128),
    companyReference: z.string().min(1).max(128).optional(),
    jobReference: z.string().min(1).max(128).optional(),
    applicationReference: z.string().min(1).max(128).optional(),
  })
  .strict();
export const moderationSubmissionSchema = z
  .object({
    target: moderationTargetSchema,
    category: reportCategorySchema,
    detail: z.string().max(20_000).optional().default(""),
  })
  .transform((value) => ({
    ...value,
    detail: normalizedText(0, 2_000).parse(value.detail) || undefined,
  }))
  .superRefine((value, context) => {
    if (value.category === "OTHER" && (value.detail?.length ?? 0) < 10)
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "OTHER requires 10-2,000 characters",
      });
  });
export const moderationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), confirmation: z.literal(true) }),
  z.object({
    action: z.literal("note"),
    confirmation: z.literal(true),
    note: normalizedText(1, 2_000),
  }),
  z.object({ action: z.literal("resolve"), confirmation: z.literal(true) }),
  z.object({ action: z.literal("dismiss"), confirmation: z.literal(true) }),
  z.object({
    action: z.literal("link-enforcement"),
    confirmation: z.literal(true),
    enforcementCorrelationId: z.string().min(8).max(128),
  }),
]);
export function moderationPriority(
  category: z.infer<typeof reportCategorySchema>,
) {
  return (
    ["ABUSE_OR_THREATS", "PRIVACY_OR_DATA_MISUSE"].includes(category)
      ? "CRITICAL"
      : ["FRAUD_OR_IMPERSONATION", "DISCRIMINATION_OR_HARASSMENT"].includes(
            category,
          )
        ? "HIGH"
        : "NORMAL"
  ) as "CRITICAL" | "HIGH" | "NORMAL";
}
