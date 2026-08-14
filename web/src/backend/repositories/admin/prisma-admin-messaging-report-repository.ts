import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";
import {
  adminMessagingReportDetailSchema,
  adminMessagingReportListSchema,
} from "@/shared/contracts/admin/messaging-reports";

type ListInput = {
  page: number;
  perPage: number;
  filter: Record<string, unknown>;
};

function listItem(row: {
  id: string;
  reporterUserId: string;
  targetUserId: string;
  targetType: "PARTICIPANT" | "CONVERSATION";
  category:
    | "FRAUD_OR_IMPERSONATION"
    | "MISLEADING_CONTENT"
    | "DISCRIMINATION_OR_HARASSMENT"
    | "ABUSE_OR_THREATS"
    | "SPAM_OR_DUPLICATE"
    | "PRIVACY_OR_DATA_MISUSE"
    | "OTHER";
  state: "PENDING_REVIEW" | "RESOLVED" | "DISMISSED";
  assignedAdminUserId: string | null;
  evidenceMessageId: string | null;
  createdAt: Date;
  version: number;
  reporter: { name: string };
  target: { name: string };
}) {
  return {
    id: row.id,
    reporterAccountId: row.reporterUserId,
    reporterDisplayName: row.reporter.name,
    targetAccountId: row.targetUserId,
    targetDisplayName: row.target.name,
    targetType: row.targetType,
    category: row.category,
    state: row.state,
    assignedAdministratorId: row.assignedAdminUserId,
    evidenceAvailable: Boolean(row.evidenceMessageId),
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

export class PrismaAdminMessagingReportRepository {
  async list(input: ListInput) {
    const now = new Date();
    const minimumAgeHours =
      typeof input.filter.age === "string" ||
      typeof input.filter.age === "number"
        ? Number(input.filter.age)
        : Number.NaN;
    const where: Prisma.MessagingReportWhereInput = {
      ...(typeof input.filter.targetType === "string"
        ? { targetType: input.filter.targetType as never }
        : {}),
      ...(typeof input.filter.category === "string"
        ? { category: input.filter.category as never }
        : {}),
      ...(typeof input.filter.state === "string"
        ? { state: input.filter.state as never }
        : {}),
      ...(typeof input.filter.reporterId === "string"
        ? { reporterUserId: input.filter.reporterId }
        : {}),
      ...(typeof input.filter.targetId === "string"
        ? { targetUserId: input.filter.targetId }
        : {}),
      ...(Number.isFinite(minimumAgeHours) && minimumAgeHours >= 0
        ? {
            createdAt: {
              lte: new Date(now.getTime() - minimumAgeHours * 60 * 60_000),
            },
          }
        : {}),
      ...(input.filter.assigneeId === "UNASSIGNED"
        ? { assignedAdminUserId: null }
        : typeof input.filter.assigneeId === "string" &&
            input.filter.assigneeId !== "ANY"
          ? { assignedAdminUserId: input.filter.assigneeId }
          : {}),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.messagingReport.count({ where }),
      prisma.messagingReport.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        select: {
          id: true,
          reporterUserId: true,
          targetUserId: true,
          targetType: true,
          category: true,
          state: true,
          assignedAdminUserId: true,
          evidenceMessageId: true,
          createdAt: true,
          version: true,
          reporter: { select: { name: true } },
          target: { select: { name: true } },
        },
      }),
    ]);
    return adminMessagingReportListSchema.parse({
      data: rows.map(listItem),
      total,
      ...calculationMetadata(now),
    });
  }

  async detail(id: string) {
    const row = await prisma.messagingReport.findUnique({
      where: { id },
      select: {
        id: true,
        reporterUserId: true,
        targetUserId: true,
        conversationId: true,
        targetType: true,
        category: true,
        normalizedDetail: true,
        state: true,
        assignedAdminUserId: true,
        handledByAdminUserId: true,
        enforcementCorrelationId: true,
        evidenceMessageId: true,
        version: true,
        handledAt: true,
        createdAt: true,
        updatedAt: true,
        reporter: { select: { name: true } },
        target: { select: { name: true } },
        evidenceMessage: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            content: true,
            createdAt: true,
            sender: { select: { name: true } },
          },
        },
        reviewEvents: {
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            actorAdminUserId: true,
            action: true,
            priorState: true,
            resultingState: true,
            resultingVersion: true,
            enforcementCorrelationId: true,
            occurredAt: true,
          },
        },
        privateNotes: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            authorAdminUserId: true,
            normalizedText: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) return null;
    const evidence =
      row.evidenceMessage?.conversationId === row.conversationId
        ? {
            id: row.evidenceMessage.id,
            senderAccountId: row.evidenceMessage.senderId,
            senderDisplayName: row.evidenceMessage.sender.name,
            content: row.evidenceMessage.content,
            sentAt: row.evidenceMessage.createdAt.toISOString(),
          }
        : null;
    return adminMessagingReportDetailSchema.parse({
      ...listItem(row),
      evidenceAvailable: Boolean(evidence),
      detail: row.normalizedDetail,
      evidence,
      history: row.reviewEvents.map((event) => ({
        id: event.id,
        actorAdministratorId: event.actorAdminUserId,
        action: event.action,
        priorState: event.priorState,
        resultingState: event.resultingState,
        resultingVersion: event.resultingVersion,
        enforcementCorrelationId: event.enforcementCorrelationId,
        occurredAt: event.occurredAt.toISOString(),
      })),
      notes: row.privateNotes.map((note) => ({
        id: note.id,
        authorAdministratorId: note.authorAdminUserId,
        text: note.normalizedText,
        createdAt: note.createdAt.toISOString(),
      })),
      updatedAt: row.updatedAt.toISOString(),
      handledAt: row.handledAt?.toISOString() ?? null,
      handledByAdministratorId: row.handledByAdminUserId,
      enforcementCorrelationId: row.enforcementCorrelationId,
    });
  }
}
