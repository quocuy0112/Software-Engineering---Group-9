import "server-only";
import { prisma } from "@/backend/database/prisma";

export class ProtectedProposalAuditService {
  async detail(proposalId: string, now = new Date()) {
    const row = await prisma.professionalConnectionProposal.findFirst({
      where: {
        id: proposalId,
        protectedDeletedAt: null,
        OR: [
          { protectedDeleteAfter: null },
          { protectedDeleteAfter: { gt: now } },
        ],
      },
      select: {
        id: true,
        participantLowId: true,
        participantHighId: true,
        createdByAdminUserId: true,
        sourceSupportConversationId: true,
        reason: true,
        state: true,
        createdAt: true,
        expiresAt: true,
        terminalAt: true,
        protectedDeleteAfter: true,
        decisions: {
          select: { participantUserId: true, decision: true, decidedAt: true },
          orderBy: { participantUserId: "asc" },
        },
        history: {
          select: {
            action: true,
            priorState: true,
            resultingState: true,
            resultingVersion: true,
            actorUserId: true,
            decisionKind: true,
            occurredAt: true,
            correlationId: true,
          },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!row) return null;
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      terminalAt: row.terminalAt?.toISOString() ?? null,
      protectedDeleteAfter: row.protectedDeleteAfter?.toISOString() ?? null,
      decisions: row.decisions.map((decision) => ({
        ...decision,
        decidedAt: decision.decidedAt.toISOString(),
      })),
      history: row.history.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
}
