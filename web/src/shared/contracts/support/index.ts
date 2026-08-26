import { z } from "zod";
import { normalizedText } from "@/shared/contracts/admin/common";

export const supportReferenceSchema = z.string().min(1).max(128);
export const supportCategorySchema = z.enum([
  "ACCOUNT_ACCESS",
  "PROFILE",
  "JOBS_APPLICATIONS",
  "RECRUITER",
  "MESSAGING",
  "PRIVACY_SAFETY",
  "OTHER",
]);
export const supportStateSchema = z.enum([
  "OPEN",
  "WAITING_FOR_USER",
  "WAITING_FOR_SUPPORT",
  "RESOLVED",
  "CLOSED",
]);
export const supportChangeSchema = z.enum([
  "CREATED",
  "MESSAGE_ADDED",
  "ASSIGNED",
  "REASSIGNED",
  "NOTED",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "REQUEUED",
  "CONTENT_DELETED",
]);
export const supportAssignmentReasonSchema = z.enum([
  "STAFF_HANDOFF",
  "WORKLOAD_BALANCE",
  "EXPERTISE_REQUIRED",
  "AUTHORITY_LOST",
]);

export const createSupportCaseInputSchema = z
  .object({
    category: supportCategorySchema,
    subject: normalizedText(5, 120),
    message: normalizedText(1, 4_000),
    clientOperationId: z.uuid(),
  })
  .strict();

export const sendSupportMessageInputSchema = z
  .object({
    content: normalizedText(1, 4_000),
    clientOperationId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const supportNoteInputSchema = z
  .object({ note: normalizedText(1, 2_000) })
  .strict();

export const supportReassignInputSchema = z
  .object({
    assigneeAdminUserId: supportReferenceSchema,
    reason: supportAssignmentReasonSchema.exclude(["AUTHORITY_LOST"]),
  })
  .strict();

export const supportCaseCommandInputSchema = z
  .object({ confirmation: z.literal(true) })
  .strict();

export const supportMessageSchema = z
  .object({
    id: supportReferenceSchema,
    sequence: z.number().int().positive(),
    author: z.enum(["YOU", "SMART_HIRE_SUPPORT"]),
    content: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const supportCaseSummarySchema = z
  .object({
    id: supportReferenceSchema,
    category: supportCategorySchema,
    subject: z.string().max(120),
    state: supportStateSchema,
    version: z.number().int().positive(),
    correspondent: z.literal("SmartHire Support"),
    lastMessageAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    contentAvailable: z.boolean(),
  })
  .strict();

export const supportCaseDetailSchema = supportCaseSummarySchema
  .extend({ messages: z.array(supportMessageSchema) })
  .strict();

export const supportCaseListSchema = z
  .object({
    data: z.array(supportCaseSummarySchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const adminSupportCaseSummarySchema = z
  .object({
    id: supportReferenceSchema,
    requesterUserId: supportReferenceSchema,
    requesterDisplayName: z.string().min(1).max(200),
    requesterMaskedEmail: z.string().min(1).max(320),
    category: supportCategorySchema,
    subject: z.string().max(120),
    state: supportStateSchema,
    version: z.number().int().positive(),
    currentAssigneeUserId: supportReferenceSchema.nullable(),
    lastMessageAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    contentAvailable: z.boolean(),
  })
  .strict();

export const adminSupportMessageSchema = z
  .object({
    id: supportReferenceSchema,
    sequence: z.number().int().positive(),
    senderKind: z.enum(["REQUESTER", "ADMINISTRATOR"]),
    senderUserId: supportReferenceSchema,
    content: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const adminSupportCaseDetailSchema = adminSupportCaseSummarySchema
  .extend({
    messages: z.array(adminSupportMessageSchema),
    notes: z.array(
      z.object({
        id: supportReferenceSchema,
        authorAdminUserId: supportReferenceSchema,
        authorAdminDisplayName: z.string().min(1).max(255),
        normalizedText: z.string(),
        createdAt: z.string().datetime(),
      }),
    ),
    assignments: z.array(
      z.object({
        id: supportReferenceSchema,
        assigneeAdminUserId: supportReferenceSchema,
        assignedByAdminUserId: supportReferenceSchema,
        assignedAt: z.string().datetime(),
        endedAt: z.string().datetime().nullable(),
        endReason: z
          .enum(["REASSIGNED", "AUTHORITY_LOST", "CASE_CLOSED"])
          .nullable(),
      }),
    ),
    history: z.array(
      z.object({
        id: supportReferenceSchema,
        action: z.string().min(1).max(80),
        priorState: supportStateSchema.nullable(),
        resultingState: supportStateSchema,
        resultingVersion: z.number().int().positive(),
        occurredAt: z.string().datetime(),
      }),
    ),
  })
  .strict();

export const supportInvalidationSchema = z
  .object({
    caseId: supportReferenceSchema,
    version: z.number().int().positive(),
    state: supportStateSchema,
    change: supportChangeSchema,
  })
  .strict();

export type SupportCategory = z.infer<typeof supportCategorySchema>;
export type SupportState = z.infer<typeof supportStateSchema>;
export type SupportChange = z.infer<typeof supportChangeSchema>;
export type SupportInvalidation = z.infer<typeof supportInvalidationSchema>;
export type SupportCaseSummary = z.infer<typeof supportCaseSummarySchema>;
export type SupportCaseDetail = z.infer<typeof supportCaseDetailSchema>;
export type AdminSupportCaseSummary = z.infer<
  typeof adminSupportCaseSummarySchema
>;
export type AdminSupportCaseDetail = z.infer<
  typeof adminSupportCaseDetailSchema
>;

export interface SupportServerToClientEvents {
  "support:case:changed": (event: SupportInvalidation) => void;
}

export type SupportClientToServerEvents = Record<string, never>;
export type SupportInterServerEvents = Record<string, never>;
export type SupportSocketData = {
  userId: string;
  sessionId: string;
  role: "REQUESTER" | "ADMINISTRATOR";
};
