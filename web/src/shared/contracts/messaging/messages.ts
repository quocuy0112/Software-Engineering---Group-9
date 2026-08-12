import { z } from "zod";
import { cursorSchema, messagingPageLimitSchema, opaqueIdSchema } from "./common";
import { conversationDetailSchema } from "./conversations";

export const messageContentSchema = z.string().normalize("NFKC").trim().min(1).max(2_000);

export const messageSchema = z
  .object({
    id: opaqueIdSchema,
    conversationId: opaqueIdSchema,
    sequence: z.number().int().positive(),
    senderId: opaqueIdSchema,
    content: messageContentSchema,
    createdAt: z.iso.datetime(),
    delivery: z.enum(["SENT", "READ"]),
  })
  .strict();

export const sendMessageInputSchema = z
  .object({
    conversationId: opaqueIdSchema,
    clientOperationId: z.uuid(),
    content: messageContentSchema,
  })
  .strict();

export const messageHistoryQuerySchema = z
  .object({ cursor: cursorSchema.optional(), limit: messagingPageLimitSchema })
  .strict();

export const messageHistorySchema = z
  .object({
    conversation: conversationDetailSchema,
    items: z.array(messageSchema).max(20),
    nextCursor: cursorSchema.nullable(),
  })
  .strict();

export const markReadInputSchema = z
  .object({ lastReadSequence: z.number().int().nonnegative() })
  .strict();

export const readBoundarySchema = z
  .object({
    conversationId: opaqueIdSchema,
    readerId: opaqueIdSchema,
    lastReadSequence: z.number().int().nonnegative(),
    readAt: z.iso.datetime(),
  })
  .strict();

export type MessagingMessage = z.infer<typeof messageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type ReadBoundary = z.infer<typeof readBoundarySchema>;
