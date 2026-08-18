import { z } from "zod";
import {
  adminAccountStateSchema,
  adminReferenceSchema,
  adminTimestampSchema,
  calculatedListMetadataSchema,
  membershipRoleSchema,
  membershipStateSchema,
  moderationStateSchema,
  privilegedReasonCategorySchema,
  reportCategorySchema,
  verificationStateSchema,
} from "./common";
import { evidenceMetadataSchema } from "./verification";

export const accountListItemSchema = z
  .object({
    id: adminReferenceSchema,
    displayName: z.string().max(200),
    maskedEmail: z.string().max(320),
    state: adminAccountStateSchema,
    createdAt: adminTimestampSchema,
    hasCandidateIdentity: z.boolean(),
    activeMembershipCount: z.number().int().nonnegative(),
    hasActiveAdministratorGrant: z.boolean(),
  })
  .strict();

export const accountDirectoryFilterSchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    type: z.enum(["ALL", "CANDIDATE", "RECRUITER"]).default("ALL"),
    status: z.enum(["ALL", "ACTIVE", "SUSPENDED"]).default("ALL"),
    registeredFrom: z.string().date().optional(),
    registeredTo: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
      .default(25),
  })
  .superRefine((value, context) => {
    if (
      value.registeredFrom &&
      value.registeredTo &&
      value.registeredFrom > value.registeredTo
    ) {
      context.addIssue({
        code: "custom",
        path: ["registeredFrom"],
        message: "registeredFrom must be on or before registeredTo",
      });
    }
  });

const unavailableAggregateSchema = z
  .object({
    kind: z.enum(["CANDIDATE", "RECRUITER"]),
    unavailable: z.literal(true),
  })
  .strict();

export const candidateActivityCountsSchema = z.union([
  z
    .object({
      kind: z.literal("CANDIDATE"),
      cvCount: z.number().int().nonnegative(),
      applicationCount: z.number().int().nonnegative(),
    })
    .strict(),
  unavailableAggregateSchema.extend({ kind: z.literal("CANDIDATE") }),
]);

export const recruiterActivityCountsSchema = z.union([
  z
    .object({
      kind: z.literal("RECRUITER"),
      active: z.number().int().nonnegative(),
      pendingReview: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      draft: z.number().int().nonnegative(),
      closed: z.number().int().nonnegative(),
    })
    .strict(),
  unavailableAggregateSchema.extend({ kind: z.literal("RECRUITER") }),
]);

export const accountDirectoryItemSchema = z
  .object({
    id: adminReferenceSchema,
    accountReference: adminReferenceSchema,
    displayName: z.string().max(200),
    maskedEmail: z.string().max(320),
    registeredAt: adminTimestampSchema,
    type: z.enum(["CANDIDATE", "RECRUITER"]),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    version: z.number().int().min(0),
    hasCandidateIdentity: z.boolean(),
    activeMembershipCount: z.number().int().nonnegative(),
    hasActiveAdministratorGrant: z.boolean(),
    counts: z.union([
      candidateActivityCountsSchema,
      recruiterActivityCountsSchema,
    ]),
  })
  .strict();

export const companyAuthoritySchema = z
  .object({
    companyId: adminReferenceSchema,
    companyName: z.string().max(240),
    membershipRole: membershipRoleSchema,
    membershipState: membershipStateSchema,
    verificationState: z.enum(["ACTIVE", "INACTIVE", "UNVERIFIED"]),
  })
  .strict();

export const moderationEligibilitySchema = z
  .object({
    canSuspend: z.boolean(),
    canRestore: z.boolean(),
    protectedAdministrator: z.boolean(),
    reasonCode: z.string().nullable(),
  })
  .strict();

export const moderationHistoryItemSchema = z
  .object({
    id: adminReferenceSchema,
    action: z.enum(["SUSPEND", "RESTORE"]),
    actorRef: z.string().max(160),
    priorState: z.enum(["ACTIVE", "SUSPENDED"]),
    resultingState: z.enum(["ACTIVE", "SUSPENDED"]),
    category: privilegedReasonCategorySchema,
    result: z.enum(["SUCCEEDED", "DENIED", "FAILED"]),
    occurredAt: adminTimestampSchema,
    correlationId: adminReferenceSchema,
  })
  .strict();

export const approvedVerificationEvidenceSchema = evidenceMetadataSchema
  .omit({ id: true })
  .extend({
    requestId: adminReferenceSchema,
    evidenceId: adminReferenceSchema,
    companyName: z.string().max(240),
    taxIdentifier: z.string().regex(/^\d{10}$/u),
    submittedAt: adminTimestampSchema,
    approvedAt: adminTimestampSchema.nullable(),
  })
  .strict();

export const accountDetailSchema = z
  .object({
    account: accountDirectoryItemSchema,
    candidateActivity: candidateActivityCountsSchema.nullable(),
    recruiterActivity: recruiterActivityCountsSchema.nullable(),
    authorities: z.array(companyAuthoritySchema),
    approvedVerificationEvidence: z.array(approvedVerificationEvidenceSchema),
    moderation: moderationEligibilitySchema,
    history: z.array(moderationHistoryItemSchema),
    calculatedAt: adminTimestampSchema,
  })
  .strict();

export const loginSessionProjectionSchema = z
  .object({
    reference: adminReferenceSchema,
    deviceDescription: z.string().max(160),
    approximateLocation: z.string().max(160).nullable(),
    createdAt: adminTimestampSchema,
    lastActivityAt: adminTimestampSchema,
    expiresAt: adminTimestampSchema,
  })
  .strict();

export const companyReferenceSchema = z
  .object({
    id: adminReferenceSchema,
    legalName: z.string().max(240),
    verificationState: z.enum(["ACTIVE", "INACTIVE", "UNVERIFIED"]),
  })
  .strict();

export const companyMembershipSchema = z
  .object({
    id: adminReferenceSchema,
    company: companyReferenceSchema,
    accountId: adminReferenceSchema,
    role: membershipRoleSchema,
    state: membershipStateSchema,
    priorApprovedRole: membershipRoleSchema,
    version: z.number().int().min(0),
    createdAt: adminTimestampSchema,
    updatedAt: adminTimestampSchema,
  })
  .strict();

export const verificationListItemSchema = z
  .object({
    id: adminReferenceSchema,
    applicantAccountId: adminReferenceSchema,
    companyName: z.string().max(240),
    normalizedTaxIdentifier: z.string().regex(/^\d{10}$/u),
    state: verificationStateSchema,
    submissionVersion: z.number().int().positive(),
    assignedAdministratorId: adminReferenceSchema.nullable(),
    createdAt: adminTimestampSchema,
    version: z.number().int().min(0),
  })
  .strict();

export const moderationListItemSchema = z
  .object({
    id: adminReferenceSchema,
    reporterAccountId: adminReferenceSchema,
    targetType: z.enum(["JOB", "COMPANY", "MEMBERSHIP", "CANDIDATE"]),
    targetReference: adminReferenceSchema,
    category: reportCategorySchema,
    state: moderationStateSchema,
    priority: z.enum(["NORMAL", "HIGH", "CRITICAL"]),
    createdAt: adminTimestampSchema,
    version: z.number().int().min(0),
  })
  .strict();

export const listEnvelope = <T extends z.ZodType>(item: T) =>
  calculatedListMetadataSchema.extend({
    data: z.array(item),
    total: z.number().int().nonnegative(),
  });

export const dashboardSnapshotSchema = z
  .object({
    id: adminReferenceSchema,
    calculatedAt: adminTimestampSchema,
    expiresAt: adminTimestampSchema,
    stateDefinitionVersion: z.string().min(1),
    metrics: z.record(
      z.string(),
      z.object({
        value: z.number().int().nonnegative(),
        unit: z.enum([
          "PEOPLE",
          "ACCOUNTS",
          "COMPANIES",
          "MEMBERSHIPS",
          "REQUESTS",
          "REPORTS",
          "NOTIFICATIONS",
        ]),
      }),
    ),
  })
  .strict();

export type AccountListItem = z.infer<typeof accountListItemSchema>;
export type CompanyMembershipResource = z.infer<typeof companyMembershipSchema>;
export type AccountDirectoryFilter = z.infer<
  typeof accountDirectoryFilterSchema
>;
export type AccountDirectoryItem = z.infer<typeof accountDirectoryItemSchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
