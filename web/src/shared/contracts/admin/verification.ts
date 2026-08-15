import { z } from "zod";
import {
  membershipRoleSchema,
  normalizedText,
  adminTimestampSchema,
  verificationRejectionCategorySchema,
  verificationStateSchema,
} from "./common";
export type VerificationBusinessFactsProjection = {
  applicantLegalName: string;
  applicantRegisteredAddress: string;
  operatingAddress: string | null;
  companyEmail: string;
  companyEmailVerifiedAt: string;
  companyEmailFreeProvider: boolean;
  companyEmailWebsiteDomainMatch: boolean | null;
  companyPhoneE164: string;
  companyPhoneVerified: boolean;
  websiteOrigin: string | null;
  relationship: string;
  currentJobTitle: string;
  authorityExplanation: string | null;
  legalNameDiffers: boolean;
  registeredAddressDiffers: boolean;
  mismatchExplanation: string | null;
  accuracyDeclaredAt: string;
  documentConsentAt: string;
  policyVersion: string;
  registry: {
    outcome: string;
    providerKey: string;
    checkedAt: string;
    expiresAt: string;
    stale: boolean;
    legalName: string | null;
    registeredAddress: string | null;
    establishedAt: string | null;
    legalStatus: string | null;
    entityType: string | null;
    representativeName: string | null;
  };
};
export const normalizedTaxIdentifierSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(/^\d{10}$/u));
export const businessEvidenceMediaTypeSchema = z.enum([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export function detectBusinessEvidenceMediaType(bytes: Uint8Array) {
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
  )
    return "application/pdf" as const;
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .every(
        (value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index],
      )
  )
    return "image/png" as const;
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  )
    return "image/jpeg" as const;
  return null;
}
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

export const verificationQueueFilterSchema = z
  .object({
    state: verificationStateSchema.default("PENDING_REVIEW"),
    applicantEligibility: z
      .enum(["ACTIVE_ONLY", "SUSPENDED_ONLY", "ANY"])
      .default("ACTIVE_ONLY"),
    company: z.string().trim().max(160).optional(),
    taxCode: z
      .string()
      .trim()
      .regex(/^\d{10}$/u)
      .optional(),
    submittedFrom: z.string().date().optional(),
    submittedTo: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z
      .union([z.literal(25), z.literal(50), z.literal(100)])
      .default(25),
    // Legacy React Admin aliases remain accepted at the adapter boundary while
    // the Feature 009 HTTP projection uses the exact contract names above.
    taxIdentifier: z.string().trim().optional(),
    applicantId: z.string().trim().optional(),
    assignment: z.enum(["UNASSIGNED", "MINE", "ANY"]).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.submittedFrom &&
      value.submittedTo &&
      value.submittedFrom > value.submittedTo
    ) {
      context.addIssue({
        code: "custom",
        path: ["submittedFrom"],
        message: "submittedFrom must be on or before submittedTo",
      });
    }
    if (value.taxIdentifier && !/^\d{10}$/u.test(value.taxIdentifier)) {
      context.addIssue({
        code: "custom",
        path: ["taxIdentifier"],
        message: "taxIdentifier must contain exactly 10 digits",
      });
    }
  });

export const verificationQueueItemSchema = z
  .object({
    id: z.string().min(1),
    applicantId: z.string().min(1),
    companyName: z.string().max(240),
    taxCode: z.string().regex(/^\d{10}$/u),
    state: verificationStateSchema,
    applicantEligibility: z.enum(["ACTIVE", "SUSPENDED"]),
    submittedAt: adminTimestampSchema,
    resubmissionCount: z.number().int().nonnegative(),
    assignedAdminRef: z.string().min(1).nullable(),
    version: z.number().int().positive(),
  })
  .strict();

export const verificationQueuePageSchema = z
  .object({
    data: z.array(verificationQueueItemSchema),
    page: z.number().int().positive(),
    pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
    total: z.number().int().nonnegative(),
    calculatedAt: adminTimestampSchema,
  })
  .strict();

export const verificationDecisionHistoryItemSchema = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
    category: z.string().nullable(),
    applicantComment: z.string().nullable(),
    decidedAt: adminTimestampSchema,
    reviewerRef: z.string().min(1),
  })
  .strict();

export const evidenceMetadataSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    fileName: z.string().min(1).max(240),
    mediaType: businessEvidenceMediaTypeSchema,
    byteSize: z.number().int().positive(),
    safetyState: z.enum(["PENDING", "PASS", "FAIL", "ERROR"]),
    accessibility: z.enum(["AVAILABLE", "INACCESSIBLE", "DELETED"]),
  })
  .strict();

export const verificationReviewDetailSchema = z
  .object({
    request: verificationQueueItemSchema,
    company: z.object({
      name: z.string(),
      taxCode: z.string().regex(/^\d{10}$/u),
      targetKind: z.enum(["NEW_COMPANY", "EXISTING_COMPANY"]),
      prerequisiteState: z.string(),
    }),
    evidence: evidenceMetadataSchema.nullable(),
    versions: z.array(evidenceMetadataSchema),
    decisions: z.array(verificationDecisionHistoryItemSchema),
    notes: z.array(
      z.object({
        id: z.string(),
        reviewerRef: z.string(),
        text: z.string(),
        createdAt: adminTimestampSchema,
      }),
    ),
    applicantComment: z.string().nullable(),
    canDecide: z.boolean(),
    blockReason: z.string().nullable(),
    calculatedAt: adminTimestampSchema,
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
export function validateEvidenceFile(
  file: { size: number; type: string },
  bytes?: Uint8Array,
): z.infer<typeof businessEvidenceMediaTypeSchema> {
  if (file.size < 1 || file.size > 5_000_000)
    throw new Error("FILE_SIZE_INVALID");
  const declared = file.type.trim().toLowerCase();
  const mediaType = businessEvidenceMediaTypeSchema.safeParse(declared);
  if (bytes) {
    const detected = detectBusinessEvidenceMediaType(bytes);
    if (!detected) throw new Error("FILE_TYPE_INVALID");
    if (mediaType.success && mediaType.data !== detected)
      throw new Error("FILE_TYPE_INVALID");
    return detected;
  }
  if (!mediaType.success) throw new Error("FILE_TYPE_INVALID");
  return mediaType.data;
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
