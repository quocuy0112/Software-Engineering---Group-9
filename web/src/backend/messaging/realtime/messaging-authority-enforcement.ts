import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import type { MessagingAccessRevocationCause } from "@/backend/messaging/ports/realtime-publisher";
import { revokeMessagingConversationAccess } from "./messaging-realtime-hub";

async function conversationIdsForUser(userId: string) {
  const rows = await prisma.messagingConversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  return rows.map((row) => row.conversationId);
}

export async function enforceMessagingUserRevocation(input: {
  userId: string;
  cause: Extract<MessagingAccessRevocationCause, "SESSION" | "ACCOUNT" | "MODERATION">;
  sessionIds?: string[];
  correlationId?: string;
}) {
  const conversationIds = await conversationIdsForUser(input.userId);
  await revokeMessagingConversationAccess({
    affectedUserIds: input.sessionIds ? [] : [input.userId],
    affectedSessionIds: input.sessionIds,
    affectedConversationIds: conversationIds,
    cause: input.cause,
    correlationId: input.correlationId ?? randomUUID(),
  });
}

export async function enforceMessagingMembershipRevocation(input: {
  userId: string;
  companyId: string;
  correlationId?: string;
}) {
  const rows = await prisma.messagingConversation.findMany({
    where: {
      companyId: input.companyId,
      participants: { some: { userId: input.userId } },
    },
    select: { id: true },
  });
  await revokeMessagingConversationAccess({
    affectedUserIds: [input.userId],
    affectedConversationIds: rows.map((row) => row.id),
    cause: "MEMBERSHIP",
    correlationId: input.correlationId ?? randomUUID(),
  });
}

export async function enforceMessagingConnectionRevocation(input: {
  professionalConnectionId: string;
  affectedUserIds: string[];
  correlationId?: string;
}) {
  const rows = await prisma.messagingConversation.findMany({
    where: { professionalConnectionId: input.professionalConnectionId },
    select: { id: true },
  });
  await revokeMessagingConversationAccess({
    affectedUserIds: input.affectedUserIds,
    affectedConversationIds: rows.map((row) => row.id),
    cause: "CONNECTION",
    correlationId: input.correlationId ?? randomUUID(),
  });
}
