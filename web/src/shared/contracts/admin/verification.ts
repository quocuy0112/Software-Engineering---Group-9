import { z } from "zod";
import {
  membershipRoleSchema,
  normalizedText,
  verificationRejectionCategorySchema,
  verificationStateSchema,
} from "./common";
export const normalizedTaxIdentifierSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(/^\d{10}$/u));
export const businessEvidenceMediaTypeSchema = z.enum([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
export const verificationSubmissionSchema = z
  .object({
    companyName: normalizedText(1, 240),
    taxIdentifier: normalizedTaxIdentifierSchema,
    requestedRole: z.literal("RECRUITER"),
    targetCompanyId: z.string().min(1).optional(),
    prerequisiteId: z.string().min(1).optional(),
  })
  .strict();
export const verificationListFilterSchema = z
  .object({
    state: verificationStateSchema.optional(),
    company: z.string().max(240).optional(),
    taxIdentifier: normalizedTaxIdentifierSchema.optional(),
    applicantId: z.string().optional(),
    assignment: z.enum(["UNASSIGNED", "MINE", "ANY"]).optional(),
  })
  .strict();
export const verificationDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request-changes"),
    confirmation: z.literal(true),
    guidance: normalizedText(10, 500),
    privateNote: normalizedText(0, 2000).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    confirmation: z.literal(true),
    category: verificationRejectionCategorySchema,
    reason: normalizedText(10, 500),
    privateNote: normalizedText(0, 2000).optional(),
  }),
  z.object({
    action: z.literal("approve"),
    confirmation: z.literal(true),
    role: membershipRoleSchema,
    privateNote: normalizedText(0, 2000).optional(),
  }),
]);
export function validateEvidenceFile(file: { size: number; type: string }) {
  if (file.size < 1 || file.size > 5_000_000)
    throw new Error("FILE_SIZE_INVALID");
  return businessEvidenceMediaTypeSchema.parse(file.type);
}
export const verificationTransitions: Record<string, readonly string[]> = {
  PENDING_CHECKS: ["PENDING_REVIEW", "CANCELLED", "EXPIRED"],
  PENDING_REVIEW: [
    "CHANGES_REQUESTED",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "EXPIRED",
  ],
  CHANGES_REQUESTED: ["RESUBMITTED", "CANCELLED", "EXPIRED"],
  RESUBMITTED: ["PENDING_CHECKS"],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};
export function assertVerificationTransition(from: string, to: string) {
  if (!verificationTransitions[from]?.includes(to))
    throw new Error("INVALID_STATE");
}
