import { z } from "zod";
import {
  adminReferenceSchema,
  adminTimestampSchema,
  calculatedListMetadataSchema,
  moderationStateSchema,
  normalizedText,
  reportCategorySchema,
} from "./common";

export const adminMessagingReportTargetTypeSchema = z.enum([
  "PARTICIPANT",
  "CONVERSATION",
]);

export const adminMessagingReportFilterSchema = z
  .object({
    targetType: adminMessagingReportTargetTypeSchema.optional(),
    category: reportCategorySchema.optional(),
    state: moderationStateSchema.optional(),
    reporterId: adminReferenceSchema.optional(),
    targetId: adminReferenceSchema.optional(),
    age: z.coerce.number().finite().nonnegative().optional(),
    assigneeId: z
      .union([adminReferenceSchema, z.literal("UNASSIGNED"), z.literal("ANY")])
      .optional(),
  })
  .strict();

export const adminMessagingReportListQuerySchema = z
  .object({
    page: z.number().int().min(1),
    perPage: z.number().int().min(1).max(100),
    filter: adminMessagingReportFilterSchema,
  })
  .strict();

export const adminMessagingReportListItemSchema = z
  .object({
    id: adminReferenceSchema,
    reporterAccountId: adminReferenceSchema,
    reporterDisplayName: z.string().min(1).max(200),
    targetAccountId: adminReferenceSchema,
    targetDisplayName: z.string().min(1).max(200),
    targetType: adminMessagingReportTargetTypeSchema,
    category: reportCategorySchema,
    state: moderationStateSchema,
    assignedAdministratorId: adminReferenceSchema.nullable(),
    evidenceAvailable: z.boolean(),
    createdAt: adminTimestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const adminMessagingReportListSchema = z
  .object({
    data: z.array(adminMessagingReportListItemSchema),
    total: z.number().int().nonnegative(),
  })
  .extend(calculatedListMetadataSchema.shape)
  .strict();

export const adminMessagingEvidenceSchema = z
  .object({
    id: adminReferenceSchema,
    senderAccountId: adminReferenceSchema,
    senderDisplayName: z.string().min(1).max(200),
    content: z.string().min(1).max(4000),
    sentAt: adminTimestampSchema,
  })
  .strict();

export const adminMessagingReportReviewEventSchema = z
  .object({
    id: adminReferenceSchema,
    actorAdministratorId: adminReferenceSchema,
    action: z.enum([
      "assign",
      "note",
      "resolve",
      "dismiss",
      "link-enforcement",
    ]),
    priorState: moderationStateSchema,
    resultingState: moderationStateSchema,
    resultingVersion: z.number().int().positive(),
    enforcementCorrelationId: adminReferenceSchema.nullable(),
    occurredAt: adminTimestampSchema,
  })
  .strict();

export const adminMessagingReportPrivateNoteSchema = z
  .object({
    id: adminReferenceSchema,
    authorAdministratorId: adminReferenceSchema,
    text: z.string().min(1).max(2000),
    createdAt: adminTimestampSchema,
  })
  .strict();

export const adminMessagingReportDetailSchema =
  adminMessagingReportListItemSchema.extend({
    detail: z.string().max(500).nullable(),
    evidence: adminMessagingEvidenceSchema.nullable(),
    history: z.array(adminMessagingReportReviewEventSchema),
    notes: z.array(adminMessagingReportPrivateNoteSchema),
    updatedAt: adminTimestampSchema,
    handledAt: adminTimestampSchema.nullable(),
    handledByAdministratorId: adminReferenceSchema.nullable(),
    enforcementCorrelationId: adminReferenceSchema.nullable(),
  });

export const adminMessagingReportConfirmedCommandSchema = z
  .object({ confirmation: z.literal(true) })
  .strict();

export const adminMessagingReportNoteCommandSchema = z
  .object({
    confirmation: z.literal(true),
    note: normalizedText(1, 2000),
  })
  .strict();

export const adminMessagingReportEnforcementCommandSchema = z
  .object({
    confirmation: z.literal(true),
    enforcementCorrelationId: z.string().min(8).max(128),
  })
  .strict();

export type AdminMessagingReportListItem = z.infer<
  typeof adminMessagingReportListItemSchema
>;
export type AdminMessagingReportDetail = z.infer<
  typeof adminMessagingReportDetailSchema
>;
