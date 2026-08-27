import { z } from "zod";

export const notificationKinds = [
  "EMAIL_CHANGE_REQUESTED_ALERT",
  "PASSWORD_CHANGED",
  "RECOVERY_PENDING",
  "RECOVERY_CANCELLED",
  "RECOVERY_COMPLETED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_REINSTATED",
  "ALL_SESSIONS_REVOKED",
  "MEMBERSHIP_SUSPENDED",
  "MEMBERSHIP_RESTORED",
  "MEMBERSHIP_REMOVED",
  "COMPANY_BANNED",
  "COMPANY_UNBANNED",
  "COMPANY_INVITATION_RECEIVED",
  "COMPANY_INVITATION_ACCEPTED",
  "COMPANY_INVITATION_DECLINED",
  "APPLICATION_SUBMITTED",
  "APPLICATION_RECEIVED",
  "TEAM_APPLICATION_RECEIVED",
  "APPLICATION_STAGE_CHANGED",
  "VERIFICATION_RECEIVED",
  "VERIFICATION_CHANGES_REQUESTED",
  "VERIFICATION_APPROVED",
  "VERIFICATION_REJECTED",
  "VERIFICATION_CANCELLED",
  "VERIFICATION_DELAYED",
  "VERIFICATION_EXPIRED",
  "SUPPORT_WAITING_FOR_USER",
  "SUPPORT_RESOLVED",
  "SUPPORT_CASE_RECEIVED",
  "SUPPORT_REQUESTER_REPLIED",
  "SUPPORT_CASE_REOPENED",
  "CONNECTION_PROPOSAL_CREATED",
  "CONNECTION_PROPOSAL_UPDATED",
  "CONNECTION_PROPOSAL_INACTIVE",
  "CONNECTION_ACCEPTED",
  "CONNECTION_REVOKED",
  "MESSAGE_RECEIVED",
  "MESSAGE_REPORT_RECEIVED",
  "MESSAGE_REPORT_RESOLVED",
  "MESSAGE_REPORT_DISMISSED",
  "MESSAGE_REPORT_RECEIVED_ADMIN",
  "MODERATION_REPORT_RECEIVED",
  "MODERATION_REPORT_RESOLVED",
  "MODERATION_REPORT_DISMISSED",
  "MODERATION_REPORT_RECEIVED_ADMIN",
  "VERIFICATION_REVIEW_OVERDUE",
  "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
  "JOB_POST_REVIEW_REQUESTED_ADMIN",
  "JOB_POST_APPROVED",
  "JOB_POST_REJECTED",
  "JOB_POST_CHANGES_REQUESTED",
] as const;

export const notificationKindSchema = z.enum(notificationKinds);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationCategories = [
  "SECURITY",
  "ACCOUNT",
  "APPLICATION",
  "VERIFICATION",
  "SUPPORT",
  "CONNECTION",
  "MESSAGING",
  "MODERATION",
  "SYSTEM",
] as const;
export const notificationCategorySchema = z.enum(notificationCategories);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

export const notificationSeverities = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;
export const notificationSeveritySchema = z.enum(notificationSeverities);
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;

export const notificationRecipientRoles = [
  "CANDIDATE",
  "RECRUITER",
  "ADMIN",
] as const;
export const notificationRecipientRoleSchema = z.enum(
  notificationRecipientRoles,
);
export type NotificationRecipientRole = z.infer<
  typeof notificationRecipientRoleSchema
>;

export const notificationContextTypes = [
  "ACCOUNT",
  "MEMBERSHIP",
  "APPLICATION",
  "VERIFICATION_REQUEST",
  "SUPPORT_CASE",
  "CONNECTION_PROPOSAL",
  "CONNECTION",
  "CONVERSATION",
  "MESSAGING_REPORT",
  "MODERATION_REPORT",
  "JOB_POST_REVIEW",
  "COMPANY_INVITATION",
] as const;
export const notificationContextTypeSchema = z.enum(notificationContextTypes);
export type NotificationContextType = z.infer<
  typeof notificationContextTypeSchema
>;

export const notificationItemSchema = z
  .object({
    id: z.string().min(1).max(128),
    kind: notificationKindSchema,
    category: notificationCategorySchema,
    severity: notificationSeveritySchema,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(500),
    href: z.string().max(500).nullable(),
    contextType: notificationContextTypeSchema.nullable(),
    contextId: z.string().max(128).nullable(),
    occurrenceCount: z.number().int().min(1),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    lastOccurredAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationListQuerySchema = z
  .object({
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    state: z.enum(["all", "unread", "read"]).default("all"),
    category: notificationCategorySchema.optional(),
  })
  .strict();

export const notificationPageSchema = z
  .object({
    items: z.array(notificationItemSchema),
    nextCursor: z.string().nullable(),
    unreadCount: z.number().int().min(0),
    observedAt: z.string().datetime(),
  })
  .strict();
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const notificationUnreadCountSchema = z
  .object({
    unreadCount: z.number().int().min(0),
    observedAt: z.string().datetime(),
  })
  .strict();

export const notificationContextReadSchema = z
  .object({
    contextType: notificationContextTypeSchema,
    contextId: z.string().min(1).max(128),
  })
  .strict();

export const notificationReadMutationResultSchema = z
  .object({
    changedCount: z.number().int().min(0),
    unreadCount: z.number().int().min(0),
    observedAt: z.string().datetime(),
  })
  .strict();
export type NotificationReadMutationResult = z.infer<
  typeof notificationReadMutationResultSchema
>;
