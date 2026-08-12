import { z } from "zod";
import {
  cursorSchema,
  eligibleContextSchema,
  messagingPageLimitSchema,
  opaqueIdSchema,
  safeParticipantSchema,
} from "./common";

export const conversationContextInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("APPLICATION"), applicationId: opaqueIdSchema }).strict(),
  z
    .object({
      type: z.literal("PROFESSIONAL_CONNECTION"),
      professionalConnectionId: opaqueIdSchema,
    })
    .strict(),
]);

export const openConversationInputSchema = z
  .object({ targetUserId: opaqueIdSchema, context: conversationContextInputSchema })
  .strict();

export const messagingListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    cursor: cursorSchema.optional(),
    limit: messagingPageLimitSchema,
  })
  .strict();

export const messagePreviewSchema = z
  .object({
    senderId: opaqueIdSchema,
    content: z.string().min(1).max(2_000),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const conversationSummarySchema = z
  .object({
    id: opaqueIdSchema,
    otherParticipant: safeParticipantSchema,
    context: eligibleContextSchema,
    lastMessage: messagePreviewSchema.nullable(),
    unreadCount: z.number().int().nonnegative(),
    blocked: z.boolean(),
    presence: z.enum(["ONLINE", "OFFLINE"]),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const conversationDetailSchema = conversationSummarySchema.extend({
  currentLastSequence: z.number().int().nonnegative(),
  currentUserLastReadSequence: z.number().int().nonnegative(),
});

export const eligibleParticipantSchema = z
  .object({
    participant: safeParticipantSchema,
    contexts: z.array(eligibleContextSchema).min(1),
  })
  .strict();

export const conversationListSchema = z
  .object({
    items: z.array(conversationSummarySchema),
    nextCursor: cursorSchema.nullable(),
  })
  .strict();

export const eligibleParticipantListSchema = z
  .object({
    items: z.array(eligibleParticipantSchema),
    nextCursor: cursorSchema.nullable(),
  })
  .strict();

export type ConversationContextInput = z.infer<typeof conversationContextInputSchema>;
export type OpenConversationInput = z.infer<typeof openConversationInputSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type EligibleParticipant = z.infer<typeof eligibleParticipantSchema>;
