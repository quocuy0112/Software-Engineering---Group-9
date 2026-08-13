import { z } from "zod";
import { normalizedText } from "@/shared/contracts/admin/common";

export const connectionReferenceSchema = z.string().min(1).max(128);
export const connectionProposalStateSchema = z.enum([
  "PENDING_BOTH",
  "PARTIALLY_ACCEPTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
]);
export const connectionDecisionSchema = z.enum(["ACCEPTED", "DECLINED"]);
export const professionalConnectionStateSchema = z.enum([
  "ACCEPTED",
  "REVOKED",
]);
export const connectionNotificationKindSchema = z.enum([
  "PROPOSAL_CREATED",
  "PROPOSAL_UPDATED",
  "PROPOSAL_NO_LONGER_ACTIVE",
  "CONNECTION_ACCEPTED",
  "CONNECTION_REVOKED",
]);
export const connectionChangeSchema = z.enum([
  "CREATED",
  "DECIDED",
  "CANCELLED",
  "EXPIRED",
  "ACCEPTED",
  "REVOKED",
  "CONTENT_DELETED",
]);

export const createConnectionProposalInputSchema = z
  .object({
    participantAId: connectionReferenceSchema,
    participantBId: connectionReferenceSchema,
    reason: normalizedText(10, 500),
    expiryDays: z.number().int().min(1).max(30).default(7),
    sourceSupportConversationId: connectionReferenceSchema.optional(),
  })
  .strict()
  .refine((value) => value.participantAId !== value.participantBId, {
    message: "Participants must be distinct",
  });

export const decideConnectionProposalInputSchema = z
  .object({
    decision: connectionDecisionSchema,
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.uuid(),
  })
  .strict();

export const cancelConnectionProposalInputSchema = z
  .object({
    confirmation: z.literal(true),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.uuid(),
  })
  .strict();

export const disconnectConnectionInputSchema =
  cancelConnectionProposalInputSchema;

export const safeConnectionAccountSchema = z
  .object({
    id: connectionReferenceSchema,
    displayName: z.string().min(1).max(200),
    image: z.string().max(2048).nullable(),
  })
  .strict();

export const participantProposalSchema = z
  .object({
    id: connectionReferenceSchema,
    otherParticipant: safeConnectionAccountSchema.nullable(),
    reason: z.string().max(500).nullable(),
    state: connectionProposalStateSchema,
    version: z.number().int().positive(),
    myDecision: connectionDecisionSchema.nullable(),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    terminalAt: z.string().datetime().nullable(),
    detailAvailable: z.boolean(),
  })
  .strict();

export const adminProposalSchema = z
  .object({
    id: connectionReferenceSchema,
    participantLow: safeConnectionAccountSchema.nullable(),
    participantHigh: safeConnectionAccountSchema.nullable(),
    creatorAdminUserId: connectionReferenceSchema.nullable(),
    sourceSupportConversationId: connectionReferenceSchema.nullable(),
    reason: z.string().max(500).nullable(),
    state: connectionProposalStateSchema,
    version: z.number().int().positive(),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    terminalAt: z.string().datetime().nullable(),
    ordinaryDetailAvailable: z.boolean(),
  })
  .strict();

export const professionalConnectionSchema = z
  .object({
    id: connectionReferenceSchema,
    otherParticipant: safeConnectionAccountSchema,
    state: professionalConnectionStateSchema,
    version: z.number().int().positive(),
    acceptedAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })
  .strict();

export const connectionNotificationSchema = z
  .object({
    id: connectionReferenceSchema,
    kind: connectionNotificationKindSchema,
    title: z.string().max(120),
    message: z.string().max(300),
    proposalId: connectionReferenceSchema.nullable(),
    connectionId: connectionReferenceSchema.nullable(),
    createdAt: z.string().datetime(),
    readAt: z.string().datetime().nullable(),
  })
  .strict();

export const connectionInvalidationSchema = z
  .object({
    proposalId: connectionReferenceSchema.nullable(),
    connectionId: connectionReferenceSchema.nullable(),
    version: z.number().int().positive(),
    state: z.string().min(1).max(80),
    change: connectionChangeSchema,
  })
  .strict();

export const participantProposalListSchema = z
  .object({
    items: z.array(participantProposalSchema).max(50),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict();

export const professionalConnectionListSchema = z
  .object({
    items: z.array(professionalConnectionSchema).max(50),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict();

export const connectionNotificationListSchema = z
  .object({
    items: z.array(connectionNotificationSchema).max(50),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict();

export interface ConnectionServerToClientEvents {
  "connection:changed": (event: ConnectionInvalidation) => void;
}
export type ConnectionClientToServerEvents = Record<string, never>;
export type ConnectionInterServerEvents = Record<string, never>;
export type ConnectionSocketData = {
  userId: string;
  sessionId: string;
  role?: "PARTICIPANT" | "ADMINISTRATOR";
};

export type ConnectionProposalState = z.infer<
  typeof connectionProposalStateSchema
>;
export type ConnectionDecision = z.infer<typeof connectionDecisionSchema>;
export type ConnectionNotificationKind = z.infer<
  typeof connectionNotificationKindSchema
>;
export type ParticipantProposal = z.infer<typeof participantProposalSchema>;
export type AdminProposal = z.infer<typeof adminProposalSchema>;
export type ProfessionalConnectionProjection = z.infer<
  typeof professionalConnectionSchema
>;
export type ConnectionNotificationProjection = z.infer<
  typeof connectionNotificationSchema
>;
export type ConnectionInvalidation = z.infer<
  typeof connectionInvalidationSchema
>;
