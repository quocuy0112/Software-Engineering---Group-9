import { z } from "zod";
import {
  adminAccountStateSchema,
  adminReferenceSchema,
  adminTimestampSchema,
  calculatedListMetadataSchema,
  membershipRoleSchema,
  membershipStateSchema,
  moderationStateSchema,
  reportCategorySchema,
  verificationStateSchema,
} from "./common";

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
