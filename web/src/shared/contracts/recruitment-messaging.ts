import { z } from "zod";
import { opaqueIdSchema } from "./messaging/common";

export const recruitmentMessageContentSchema = z
  .string()
  .normalize("NFKC")
  .trim()
  .min(1)
  .max(2_000);

export const recruitmentMessageInputSchema = z
  .object({
    clientOperationId: z.uuid(),
    content: recruitmentMessageContentSchema,
  })
  .strict();

export const recruitmentAssignmentInputSchema = z
  .object({
    membershipId: opaqueIdSchema,
  })
  .strict();

export const recruitmentReportInputSchema = z
  .object({
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
    detail: z.string().normalize("NFKC").trim().max(500).default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category === "OTHER" && value.detail.length < 10) {
      context.addIssue({ code: "custom", path: ["detail"], message: "DETAIL_REQUIRED" });
    }
  });

export const recruitmentThreadQuerySchema = z
  .object({
    companyId: opaqueIdSchema.optional(),
    jobId: opaqueIdSchema.optional(),
    stage: z.enum(["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"]).optional(),
    assignment: z.enum(["mine", "unassigned", "all"]).default("mine"),
  })
  .strict();

export type RecruitmentMessageInput = z.infer<typeof recruitmentMessageInputSchema>;
export type RecruitmentAssignmentInput = z.infer<typeof recruitmentAssignmentInputSchema>;
export type RecruitmentThreadQuery = z.infer<typeof recruitmentThreadQuerySchema>;
export type RecruitmentReportInput = z.infer<typeof recruitmentReportInputSchema>;
