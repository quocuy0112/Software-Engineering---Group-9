import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { maskEmail } from "@/backend/admin/accounts/account-list-service";
import type {
  AdminSupportCaseDetail,
  AdminSupportCaseSummary,
  SupportCaseDetail,
  SupportCaseSummary,
  SupportCategory,
  SupportChange,
  SupportInvalidation,
} from "@/shared/contracts/support";
import { SupportError } from "@/backend/support/support-errors";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import { notifyActionableAdministrators } from "@/backend/notifications/admin-notification-fanout";

type SupportDb = typeof prisma | Prisma.TransactionClient;
type SupportState =
  | "OPEN"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_SUPPORT"
  | "RESOLVED"
  | "CLOSED";

const activeStates: SupportState[] = [
  "OPEN",
  "WAITING_FOR_USER",
  "WAITING_FOR_SUPPORT",
  "RESOLVED",
];
const retentionMs = 365 * 24 * 60 * 60_000;
const reopenMs = 7 * 24 * 60 * 60_000;

function requesterSummary(row: {
  id: string;
  category: SupportCategory;
  subject: string;
  state: SupportState;
  version: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contentDeletedAt: Date | null;
  contentDeleteAfter: Date | null;
}): SupportCaseSummary {
  const contentAvailable =
    !row.contentDeletedAt &&
    (!row.contentDeleteAfter || row.contentDeleteAfter.getTime() > Date.now());
  return {
    id: row.id,
    category: row.category,
    subject: contentAvailable ? row.subject : "Content unavailable",
    state: row.state,
    version: row.version,
    correspondent: "SmartHire Support",
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    contentAvailable,
  };
}

function adminSummary(row: {
  id: string;
  requesterUserId: string;
  requester: { name: string; email: string };
  category: SupportCategory;
  subject: string;
  state: SupportState;
  version: number;
  currentAssigneeUserId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contentDeletedAt: Date | null;
  contentDeleteAfter: Date | null;
}): AdminSupportCaseSummary {
  const contentAvailable =
    !row.contentDeletedAt &&
    (!row.contentDeleteAfter || row.contentDeleteAfter.getTime() > Date.now());
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    requesterDisplayName: row.requester.name,
    requesterMaskedEmail: maskEmail(row.requester.email),
    category: row.category,
    subject: contentAvailable ? row.subject : "Content unavailable",
    state: row.state,
    version: row.version,
    currentAssigneeUserId: row.currentAssigneeUserId,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    contentAvailable,
  };
}

export class PrismaSupportRepository {
  constructor(private readonly db: SupportDb = prisma) {}

  runTransaction<T>(work: (repository: PrismaSupportRepository) => Promise<T>) {
    return prisma.$transaction((tx) => work(new PrismaSupportRepository(tx)));
  }

  async listRequester(userId: string) {
    const rows = await this.db.supportConversation.findMany({
      where: { requesterUserId: userId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    return rows.map((row) => requesterSummary(row));
  }

  async detailRequester(
    caseId: string,
    userId: string,
  ): Promise<SupportCaseDetail | null> {
    const row = await this.db.supportConversation.findFirst({
      where: { id: caseId, requesterUserId: userId },
      include: { messages: { orderBy: { sequence: "asc" } } },
    });
    if (!row) return null;
    return {
      ...requesterSummary(row),
      messages: !requesterSummary(row).contentAvailable
        ? []
        : row.messages.map((message) => ({
            id: message.id,
            sequence: message.sequence,
            author:
              message.senderKind === "REQUESTER" ? "YOU" : "SMART_HIRE_SUPPORT",
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          })),
    };
  }

  async createRequesterCase(input: {
    userId: string;
    category: SupportCategory;
    subject: string;
    message: string;
    clientOperationId: string;
    now: Date;
  }): Promise<{
    detail: SupportCaseDetail;
    invalidation: SupportInvalidation;
    deduplicated: boolean;
  }> {
    const duplicate = await this.db.supportMessage.findUnique({
      where: {
        senderUserId_clientOperationId: {
          senderUserId: input.userId,
          clientOperationId: input.clientOperationId,
        },
      },
      include: { conversation: true },
    });
    if (duplicate) {
      if (
        duplicate.sequence !== 1 ||
        duplicate.senderKind !== "REQUESTER" ||
        duplicate.content !== input.message ||
        duplicate.conversation.category !== input.category ||
        duplicate.conversation.subject !== input.subject
      ) {
        throw new SupportError("VALIDATION_ERROR", 409);
      }
      const detail = await this.detailRequester(
        duplicate.conversationId,
        input.userId,
      );
      if (!detail) throw new SupportError("CASE_UNAVAILABLE", 404);
      return {
        detail,
        invalidation: {
          caseId: detail.id,
          version: detail.version,
          state: detail.state,
          change: "CREATED",
        },
        deduplicated: true,
      };
    }
    const [activeCount, rollingCount] = await Promise.all([
      this.db.supportConversation.count({
        where: { requesterUserId: input.userId, state: { in: activeStates } },
      }),
      this.db.supportConversation.count({
        where: {
          requesterUserId: input.userId,
          createdAt: { gte: new Date(input.now.getTime() - 24 * 60 * 60_000) },
        },
      }),
    ]);
    if (activeCount >= 3) throw new SupportError("ACTIVE_CASE_LIMIT", 409);
    if (rollingCount >= 5)
      throw new SupportError("RATE_LIMITED", 429, false, 60);
    const row = await this.db.supportConversation.create({
      data: {
        requesterUserId: input.userId,
        category: input.category,
        subject: input.subject,
        state: "WAITING_FOR_SUPPORT",
        version: 1,
        nextMessageSequence: 2,
        lastMessageAt: input.now,
        messages: {
          create: {
            sequence: 1,
            senderKind: "REQUESTER",
            senderUserId: input.userId,
            clientOperationId: input.clientOperationId,
            content: input.message,
            createdAt: input.now,
          },
        },
        history: {
          create: {
            actorUserId: input.userId,
            action: "CREATED",
            priorState: null,
            resultingState: "WAITING_FOR_SUPPORT",
            resultingVersion: 1,
            occurredAt: input.now,
          },
        },
      },
    });
    await this.appendAudit({
      action: "support.case_created",
      actorUserId: input.userId,
      targetId: row.id,
      correlationId: input.clientOperationId,
      state: row.state,
      version: row.version,
      occurredAt: input.now,
    });
    await notifyActionableAdministrators(this.db, {
      kind: "SUPPORT_CASE_RECEIVED",
      eventKey: `${row.id}:created:${row.version}`,
      correlationId: input.clientOperationId,
      occurredAt: input.now,
      contextType: "SUPPORT_CASE",
      contextId: row.id,
      state: row.state,
    });
    const detail = await this.detailRequester(row.id, input.userId);
    if (!detail) throw new SupportError("PERSISTENCE_UNAVAILABLE", 503, true);
    return {
      detail,
      invalidation: {
        caseId: row.id,
        version: row.version,
        state: row.state,
        change: "CREATED",
      },
      deduplicated: false,
    };
  }

  async sendRequesterMessage(input: {
    caseId: string;
    userId: string;
    content: string;
    clientOperationId: string;
    expectedVersion: number;
    now: Date;
  }) {
    const duplicate = await this.db.supportMessage.findUnique({
      where: {
        senderUserId_clientOperationId: {
          senderUserId: input.userId,
          clientOperationId: input.clientOperationId,
        },
      },
    });
    if (duplicate) {
      if (
        duplicate.conversationId !== input.caseId ||
        duplicate.content !== input.content
      ) {
        throw new SupportError("VALIDATION_ERROR", 409);
      }
      const detail = await this.detailRequester(input.caseId, input.userId);
      if (!detail) throw new SupportError("CASE_UNAVAILABLE", 404);
      return {
        detail,
        invalidation: {
          caseId: detail.id,
          version: detail.version,
          state: detail.state,
          change: "MESSAGE_ADDED" as SupportChange,
        },
        deduplicated: true,
      };
    }
    await this.lockCase(input.caseId);
    const row = await this.db.supportConversation.findFirst({
      where: { id: input.caseId, requesterUserId: input.userId },
    });
    if (!row || row.contentDeletedAt)
      throw new SupportError("CASE_UNAVAILABLE", 404);
    if (row.version !== input.expectedVersion)
      throw new SupportError("STALE_CONFLICT", 409);
    if (row.state === "CLOSED") throw new SupportError("INVALID_STATE", 409);
    if (
      row.state === "RESOLVED" &&
      (!row.resolvedAt ||
        input.now.getTime() >= row.resolvedAt.getTime() + reopenMs)
    ) {
      throw new SupportError("INVALID_STATE", 409);
    }
    const version = row.version + 1;
    const sequence = row.nextMessageSequence;
    const reopened = row.state === "RESOLVED";
    const changed = await this.db.supportConversation.updateMany({
      where: { id: row.id, version: row.version, state: row.state },
      data: {
        version,
        nextMessageSequence: { increment: 1 },
        lastMessageAt: input.now,
        state: "WAITING_FOR_SUPPORT",
        resolvedAt: null,
      },
    });
    if (changed.count !== 1) throw new SupportError("STALE_CONFLICT", 409);
    await this.db.supportMessage.create({
      data: {
        conversationId: row.id,
        sequence,
        senderKind: "REQUESTER",
        senderUserId: input.userId,
        clientOperationId: input.clientOperationId,
        content: input.content,
        createdAt: input.now,
      },
    });
    await this.db.supportConversationHistory.create({
      data: {
        conversationId: row.id,
        actorUserId: input.userId,
        action: reopened ? "REOPENED" : "REQUESTER_MESSAGE",
        priorState: row.state,
        resultingState: "WAITING_FOR_SUPPORT",
        resultingVersion: version,
        occurredAt: input.now,
      },
    });
    await this.appendAudit({
      action: reopened ? "support.case_reopened" : "support.message_sent",
      actorUserId: input.userId,
      targetId: row.id,
      correlationId: input.clientOperationId,
      priorState: row.state,
      state: "WAITING_FOR_SUPPORT",
      version,
      occurredAt: input.now,
    });
    await notifyActionableAdministrators(this.db, {
      kind: reopened ? "SUPPORT_CASE_REOPENED" : "SUPPORT_REQUESTER_REPLIED",
      eventKey: `${row.id}:${reopened ? "reopened" : "requester-replied"}:${version}`,
      correlationId: input.clientOperationId,
      occurredAt: input.now,
      contextType: "SUPPORT_CASE",
      contextId: row.id,
      preferredRecipientUserId: row.currentAssigneeUserId,
      state: "WAITING_FOR_SUPPORT",
    });
    const detail = await this.detailRequester(row.id, input.userId);
    if (!detail) throw new SupportError("PERSISTENCE_UNAVAILABLE", 503, true);
    return {
      detail,
      invalidation: {
        caseId: row.id,
        version,
        state: "WAITING_FOR_SUPPORT" as const,
        change: reopened ? ("REOPENED" as const) : ("MESSAGE_ADDED" as const),
      },
      deduplicated: false,
    };
  }

  async listAdmin(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    const state =
      typeof input.filter.state === "string" ? input.filter.state : undefined;
    const category =
      typeof input.filter.category === "string"
        ? input.filter.category
        : undefined;
    const assignee =
      typeof input.filter.assigneeId === "string"
        ? input.filter.assigneeId
        : undefined;
    const minimumAgeHours = Number(input.filter.age ?? NaN);
    const q = typeof input.filter.q === "string" ? input.filter.q.trim() : "";
    const tokens = q.split(/\s+/u).filter(Boolean).slice(0, 8);
    const supportedStates: SupportState[] = [...activeStates, "CLOSED"];
    const supportedCategories: SupportCategory[] = [
      "ACCOUNT_ACCESS",
      "PROFILE",
      "JOBS_APPLICATIONS",
      "RECRUITER",
      "MESSAGING",
      "PRIVACY_SAFETY",
      "OTHER",
    ];
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (supportedStates.includes(state as SupportState)) {
      conditions.push(
        Prisma.sql`c."state" = ${state}::"SupportConversationState"`,
      );
    }
    if (supportedCategories.includes(category as SupportCategory)) {
      conditions.push(
        Prisma.sql`c."category" = ${category}::"SupportConversationCategory"`,
      );
    }
    if (assignee === "UNASSIGNED") {
      conditions.push(Prisma.sql`c."currentAssigneeUserId" IS NULL`);
    } else if (assignee) {
      conditions.push(Prisma.sql`c."currentAssigneeUserId" = ${assignee}`);
    }
    if (Number.isFinite(minimumAgeHours) && minimumAgeHours >= 0) {
      conditions.push(
        Prisma.sql`c."createdAt" <= ${new Date(Date.now() - minimumAgeHours * 60 * 60_000)}`,
      );
    }
    if (q) {
      conditions.push(Prisma.sql`(
        c."id" = ${q}
        OR c."requesterUserId" = ${q}
        OR c."currentAssigneeUserId" = ${q}
        OR EXISTS (
          SELECT 1 FROM "user" u
          WHERE u."id" = c."requesterUserId"
          AND ${Prisma.join(
            tokens.map((token) => Prisma.sql`u."name" ILIKE ${`%${token}%`}`),
            " AND ",
          )}
        )
        OR ${Prisma.join(
          tokens.map((token) => Prisma.sql`c."subject" ILIKE ${`%${token}%`}`),
          " AND ",
        )}
      )`);
    }
    const where = Prisma.join(conditions, " AND ");
    const offset = (input.page - 1) * input.perPage;
    const [countRows, orderedIds] = await Promise.all([
      this.db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "SupportConversation" c
        WHERE ${where}
      `),
      this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT c."id"
        FROM "SupportConversation" c
        WHERE ${where}
        ORDER BY
          CASE c."state"
            WHEN 'WAITING_FOR_SUPPORT' THEN 0
            WHEN 'OPEN' THEN 1
            WHEN 'WAITING_FOR_USER' THEN 2
            WHEN 'RESOLVED' THEN 3
            ELSE 4
          END ASC,
          c."updatedAt" ASC,
          c."id" ASC
        LIMIT ${input.perPage}
        OFFSET ${offset}
      `),
    ]);
    const position = new Map(orderedIds.map((row, index) => [row.id, index]));
    const rows = await this.db.supportConversation.findMany({
      where: { id: { in: orderedIds.map((row) => row.id) } },
      include: { requester: { select: { name: true, email: true } } },
    });
    rows.sort(
      (left, right) =>
        (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0),
    );
    return {
      data: rows.map((row) => adminSummary(row)),
      total: Number(countRows[0]?.total ?? 0),
      calculatedAt: new Date().toISOString(),
    };
  }

  async detailAdmin(caseId: string): Promise<AdminSupportCaseDetail | null> {
    const row = await this.db.supportConversation.findUnique({
      where: { id: caseId },
      include: {
        requester: { select: { name: true, email: true } },
        messages: { orderBy: { sequence: "asc" } },
        internalNotes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
        assignments: { orderBy: { assignedAt: "asc" } },
        history: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!row) return null;
    return {
      ...adminSummary(row),
      messages: !adminSummary(row).contentAvailable
        ? []
        : row.messages.map((message) => ({
            id: message.id,
            sequence: message.sequence,
            senderKind: message.senderKind,
            senderUserId: message.senderUserId,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          })),
      notes: !adminSummary(row).contentAvailable
        ? []
        : row.internalNotes.map((note) => ({
            id: note.id,
            authorAdminUserId: note.authorAdminUserId,
            authorAdminDisplayName: note.author.name,
            normalizedText: note.normalizedText,
            createdAt: note.createdAt.toISOString(),
          })),
      assignments: row.assignments.map((assignment) => ({
        id: assignment.id,
        assigneeAdminUserId: assignment.assigneeAdminUserId,
        assignedByAdminUserId: assignment.assignedByAdminUserId,
        assignedAt: assignment.assignedAt.toISOString(),
        endedAt: assignment.endedAt?.toISOString() ?? null,
        endReason: assignment.endReason,
      })),
      history: row.history.map((entry) => ({
        id: entry.id,
        action: entry.action,
        priorState: entry.priorState,
        resultingState: entry.resultingState,
        resultingVersion: entry.resultingVersion,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    };
  }

  async claim(input: {
    caseId: string;
    adminUserId: string;
    expectedVersion: number;
    now: Date;
  }) {
    await this.lockCase(input.caseId);
    const row = await this.requireAdminCase(
      input.caseId,
      input.expectedVersion,
    );
    if (row.state === "CLOSED" || row.contentDeletedAt)
      throw new SupportError("INVALID_STATE", 409);
    if (row.currentAssigneeUserId)
      throw new SupportError("STALE_CONFLICT", 409);
    const version = row.version + 1;
    await this.db.supportConversation.update({
      where: { id: row.id },
      data: { currentAssigneeUserId: input.adminUserId, version },
    });
    await this.db.supportAssignment.create({
      data: {
        conversationId: row.id,
        assigneeAdminUserId: input.adminUserId,
        assignedByAdminUserId: input.adminUserId,
        assignedAt: input.now,
      },
    });
    await this.history(
      row,
      "CLAIMED",
      version,
      input.adminUserId,
      input.now,
      null,
      input.adminUserId,
    );
    return this.commandResult(row.id, version, row.state, "ASSIGNED");
  }

  async reassign(input: {
    caseId: string;
    adminUserId: string;
    assigneeAdminUserId: string;
    reason: "STAFF_HANDOFF" | "WORKLOAD_BALANCE" | "EXPERTISE_REQUIRED";
    expectedVersion: number;
    now: Date;
  }) {
    await this.lockCase(input.caseId);
    const row = await this.requireAdminCase(
      input.caseId,
      input.expectedVersion,
    );
    if (!row.currentAssigneeUserId)
      throw new SupportError("ASSIGNMENT_REQUIRED", 409);
    await this.requireAssignableAdmin(input.assigneeAdminUserId, input.now);
    const version = row.version + 1;
    await this.db.supportAssignment.updateMany({
      where: { conversationId: row.id, endedAt: null },
      data: { endedAt: input.now, endReason: "REASSIGNED" },
    });
    await this.db.supportAssignment.create({
      data: {
        conversationId: row.id,
        assigneeAdminUserId: input.assigneeAdminUserId,
        assignedByAdminUserId: input.adminUserId,
        assignedAt: input.now,
      },
    });
    await this.db.supportConversation.update({
      where: { id: row.id },
      data: { currentAssigneeUserId: input.assigneeAdminUserId, version },
    });
    await this.history(
      row,
      "REASSIGNED",
      version,
      input.adminUserId,
      input.now,
      input.reason,
      input.assigneeAdminUserId,
    );
    return this.commandResult(row.id, version, row.state, "REASSIGNED");
  }

  async reply(input: {
    caseId: string;
    adminUserId: string;
    content: string;
    clientOperationId: string;
    expectedVersion: number;
    now: Date;
  }) {
    const duplicate = await this.db.supportMessage.findUnique({
      where: {
        senderUserId_clientOperationId: {
          senderUserId: input.adminUserId,
          clientOperationId: input.clientOperationId,
        },
      },
    });
    if (duplicate) {
      if (
        duplicate.conversationId !== input.caseId ||
        duplicate.content !== input.content
      ) {
        throw new SupportError("VALIDATION_ERROR", 409);
      }
      const detail = await this.detailAdmin(duplicate.conversationId);
      if (!detail) throw new SupportError("CASE_UNAVAILABLE", 404);
      return {
        detail,
        invalidation: {
          caseId: detail.id,
          version: detail.version,
          state: detail.state,
          change: "MESSAGE_ADDED" as const,
        },
        deduplicated: true,
      };
    }
    await this.lockCase(input.caseId);
    const row = await this.requireAdminCase(
      input.caseId,
      input.expectedVersion,
      input.adminUserId,
    );
    if (row.state === "CLOSED" || row.contentDeletedAt)
      throw new SupportError("INVALID_STATE", 409);
    const version = row.version + 1;
    const messageId = randomUUID();
    await this.db.supportConversation.update({
      where: { id: row.id },
      data: {
        version,
        nextMessageSequence: { increment: 1 },
        lastMessageAt: input.now,
        state: "WAITING_FOR_USER",
        resolvedAt: null,
      },
    });
    await this.db.supportMessage.create({
      data: {
        id: messageId,
        conversationId: row.id,
        sequence: row.nextMessageSequence,
        senderKind: "ADMINISTRATOR",
        senderUserId: input.adminUserId,
        clientOperationId: input.clientOperationId,
        content: input.content,
        createdAt: input.now,
      },
    });
    await this.enqueueNotification(
      row.id,
      row.requesterUserId,
      "WAITING_FOR_USER",
      input.now,
      `reply:${messageId}`,
    );
    await this.history(
      row,
      "ADMIN_REPLY",
      version,
      input.adminUserId,
      input.now,
    );
    const detail = await this.detailAdmin(row.id);
    if (!detail) throw new SupportError("PERSISTENCE_UNAVAILABLE", 503, true);
    return {
      detail,
      invalidation: {
        caseId: row.id,
        version,
        state: "WAITING_FOR_USER" as const,
        change: "MESSAGE_ADDED" as const,
      },
      deduplicated: false,
    };
  }

  async note(input: {
    caseId: string;
    adminUserId: string;
    note: string;
    expectedVersion: number;
    now: Date;
  }) {
    await this.lockCase(input.caseId);
    const row = await this.requireAdminCase(
      input.caseId,
      input.expectedVersion,
      input.adminUserId,
    );
    if (row.state === "CLOSED" || row.contentDeletedAt)
      throw new SupportError("INVALID_STATE", 409);
    const version = row.version + 1;
    await this.db.supportConversation.update({
      where: { id: row.id },
      data: { version },
    });
    await this.db.supportInternalNote.create({
      data: {
        conversationId: row.id,
        authorAdminUserId: input.adminUserId,
        normalizedText: input.note,
        createdAt: input.now,
      },
    });
    await this.history(row, "NOTED", version, input.adminUserId, input.now);
    return this.commandResult(row.id, version, row.state, "NOTED");
  }

  async transition(input: {
    caseId: string;
    adminUserId: string;
    action: "resolve" | "close";
    expectedVersion: number;
    now: Date;
  }) {
    await this.lockCase(input.caseId);
    const row = await this.requireAdminCase(
      input.caseId,
      input.expectedVersion,
      input.adminUserId,
    );
    if (row.state === "CLOSED") throw new SupportError("INVALID_STATE", 409);
    const version = row.version + 1;
    const state = input.action === "resolve" ? "RESOLVED" : "CLOSED";
    const closedAt = state === "CLOSED" ? input.now : null;
    await this.db.supportConversation.update({
      where: { id: row.id },
      data: {
        version,
        state,
        resolvedAt: state === "RESOLVED" ? input.now : row.resolvedAt,
        closedAt,
        contentDeleteAfter: closedAt
          ? new Date(closedAt.getTime() + retentionMs)
          : null,
        currentAssigneeUserId:
          state === "CLOSED" ? null : row.currentAssigneeUserId,
      },
    });
    if (state === "CLOSED") {
      await this.db.supportAssignment.updateMany({
        where: { conversationId: row.id, endedAt: null },
        data: { endedAt: input.now, endReason: "CASE_CLOSED" },
      });
    } else {
      await this.enqueueNotification(
        row.id,
        row.requesterUserId,
        state,
        input.now,
        `resolved:${version}`,
      );
    }
    await this.history(row, state, version, input.adminUserId, input.now);
    return this.commandResult(
      row.id,
      version,
      state,
      state === "RESOLVED" ? "RESOLVED" : "CLOSED",
    );
  }

  async closeDue(now: Date, limit = 100) {
    const due = await this.db.supportConversation.findMany({
      where: {
        state: "RESOLVED",
        resolvedAt: { lte: new Date(now.getTime() - reopenMs) },
      },
      orderBy: { resolvedAt: "asc" },
      take: limit,
    });
    let closed = 0;
    const events: Array<{
      invalidation: SupportInvalidation;
      requesterUserId: string;
    }> = [];
    for (const row of due) {
      const version = row.version + 1;
      const changed = await this.db.supportConversation.updateMany({
        where: { id: row.id, version: row.version, state: "RESOLVED" },
        data: {
          version,
          state: "CLOSED",
          closedAt: now,
          contentDeleteAfter: new Date(now.getTime() + retentionMs),
          currentAssigneeUserId: null,
        },
      });
      if (!changed.count) continue;
      await this.db.supportAssignment.updateMany({
        where: { conversationId: row.id, endedAt: null },
        data: { endedAt: now, endReason: "CASE_CLOSED" },
      });
      await this.history(row, "AUTO_CLOSED", version, null, now);
      await this.appendAudit({
        action: "support.case_auto_closed",
        actorUserId: null,
        targetId: row.id,
        correlationId: randomUUID(),
        priorState: row.state,
        state: "CLOSED",
        version,
        occurredAt: now,
      });
      closed += 1;
      events.push({
        requesterUserId: row.requesterUserId,
        invalidation: {
          caseId: row.id,
          version,
          state: "CLOSED",
          change: "CLOSED",
        },
      });
    }
    return { closed, events };
  }

  async requeueInvalidAssignments(now: Date, limit = 100) {
    const rows = await this.db.supportConversation.findMany({
      where: { currentAssigneeUserId: { not: null }, state: { not: "CLOSED" } },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    let requeued = 0;
    const events: Array<{
      invalidation: SupportInvalidation;
      requesterUserId: string;
    }> = [];
    for (const row of rows) {
      const assignable = await this.isAssignableAdmin(
        row.currentAssigneeUserId!,
        now,
      );
      if (assignable) continue;
      const version = row.version + 1;
      const changed = await this.db.supportConversation.updateMany({
        where: {
          id: row.id,
          version: row.version,
          currentAssigneeUserId: row.currentAssigneeUserId,
        },
        data: { currentAssigneeUserId: null, version },
      });
      if (!changed.count) continue;
      await this.db.supportAssignment.updateMany({
        where: { conversationId: row.id, endedAt: null },
        data: { endedAt: now, endReason: "AUTHORITY_LOST" },
      });
      await this.history(
        row,
        "AUTHORITY_LOST",
        version,
        null,
        now,
        "AUTHORITY_LOST",
        null,
      );
      await this.db.auditEvent.create({
        data: {
          occurredAt: now,
          actorType: "system",
          action: "support.assignment_requeued",
          targetType: "support_case",
          targetId: row.id,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: {
            resultingState: row.state,
            targetVersion: version,
            reasonCategory: "AUTHORITY_LOST",
          },
        },
      });
      requeued += 1;
      events.push({
        requesterUserId: row.requesterUserId,
        invalidation: {
          caseId: row.id,
          version,
          state: row.state,
          change: "REQUEUED",
        },
      });
    }
    return { requeued, events };
  }

  async purgeDueContent(now: Date, limit = 100) {
    const rows = await this.db.supportConversation.findMany({
      where: { contentDeleteAfter: { lte: now }, contentDeletedAt: null },
      orderBy: { contentDeleteAfter: "asc" },
      take: limit,
    });
    let purged = 0;
    const events: Array<{
      invalidation: SupportInvalidation;
      requesterUserId: string;
    }> = [];
    for (const row of rows) {
      const changed = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "SupportConversation" WHERE "id" = ${row.id} FOR UPDATE`;
        const current = await tx.supportConversation.findUnique({
          where: { id: row.id },
        });
        if (
          !current ||
          current.contentDeletedAt ||
          !current.contentDeleteAfter ||
          current.contentDeleteAfter > now
        ) {
          return false;
        }
        const version = current.version + 1;
        await tx.supportConversation.update({
          where: { id: current.id },
          data: { subject: "Content deleted", contentDeletedAt: now, version },
        });
        await tx.supportMessage.deleteMany({
          where: { conversationId: current.id },
        });
        await tx.supportInternalNote.deleteMany({
          where: { conversationId: current.id },
        });
        await tx.supportConversationHistory.create({
          data: {
            conversationId: current.id,
            actorUserId: null,
            action: "CONTENT_DELETED",
            priorState: current.state,
            resultingState: current.state,
            resultingVersion: version,
            occurredAt: now,
          },
        });
        await tx.auditEvent.create({
          data: {
            occurredAt: now,
            actorType: "system",
            action: "support.content_deleted",
            targetType: "support_case",
            targetId: current.id,
            result: "SUCCESS",
            correlationId: randomUUID(),
            context: { resultingState: current.state, targetVersion: version },
          },
        });
        return true;
      });
      if (changed) {
        purged += 1;
        events.push({
          requesterUserId: row.requesterUserId,
          invalidation: {
            caseId: row.id,
            version: row.version + 1,
            state: row.state,
            change: "CONTENT_DELETED",
          },
        });
      }
    }
    return { purged, events };
  }

  private async lockCase(caseId: string) {
    await this.db
      .$queryRaw`SELECT "id" FROM "SupportConversation" WHERE "id" = ${caseId} FOR UPDATE`;
  }

  private async requireAdminCase(
    caseId: string,
    expectedVersion: number,
    assigneeId?: string,
  ) {
    const row = await this.db.supportConversation.findUnique({
      where: { id: caseId },
    });
    if (!row) throw new SupportError("CASE_UNAVAILABLE", 404);
    if (row.version !== expectedVersion)
      throw new SupportError("STALE_CONFLICT", 409);
    if (assigneeId && row.currentAssigneeUserId !== assigneeId) {
      throw new SupportError("ASSIGNMENT_REQUIRED", 403);
    }
    return row;
  }

  private async isAssignableAdmin(userId: string, now: Date) {
    return Boolean(
      await this.db.platformAdministratorGrant.findFirst({
        where: {
          userId,
          state: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          user: { state: "ACTIVE" },
        },
        select: { id: true },
      }),
    );
  }

  private async requireAssignableAdmin(userId: string, now: Date) {
    if (!(await this.isAssignableAdmin(userId, now))) {
      throw new SupportError("CASE_UNAVAILABLE", 404);
    }
  }

  private async enqueueNotification(
    caseId: string,
    requesterUserId: string,
    state: "WAITING_FOR_USER" | "RESOLVED",
    occurredAt: Date,
    identity: string,
  ) {
    await this.db.emailOutbox.create({
      data: {
        kind: "SUPPORT_CASE_UPDATED",
        userId: requesterUserId,
        supportConversationId: caseId,
        recipientRef: `user:${requesterUserId}`,
        templateVersion: "support-case-v1",
        payloadRef: { caseId, state, occurredAt: occurredAt.toISOString() },
        idempotencyKey: `support:${caseId}:${identity}`,
      },
    });
    await createInAppNotification(this.db, {
      recipientUserId: requesterUserId,
      kind:
        state === "WAITING_FOR_USER"
          ? "SUPPORT_WAITING_FOR_USER"
          : "SUPPORT_RESOLVED",
      deduplicationKey: `support:${caseId}:${identity}`,
      correlationId: caseId,
      occurredAt,
      contextType: "SUPPORT_CASE",
      contextId: caseId,
    });
  }

  private async history(
    row: {
      id: string;
      state: SupportState;
      currentAssigneeUserId: string | null;
    },
    action: string,
    version: number,
    actorUserId: string | null,
    occurredAt: Date,
    assignmentReason?: string | null,
    resultingAssigneeUserId?: string | null,
  ) {
    await this.db.supportConversationHistory.create({
      data: {
        conversationId: row.id,
        actorUserId,
        action,
        priorState: row.state,
        resultingState:
          action === "RESOLVED"
            ? "RESOLVED"
            : action === "CLOSED" || action === "AUTO_CLOSED"
              ? "CLOSED"
              : row.state,
        resultingVersion: version,
        assignmentReason,
        priorAssigneeUserId: row.currentAssigneeUserId,
        resultingAssigneeUserId:
          resultingAssigneeUserId === undefined
            ? row.currentAssigneeUserId
            : resultingAssigneeUserId,
        occurredAt,
      },
    });
  }

  private commandResult(
    caseId: string,
    version: number,
    state: SupportState,
    change: SupportChange,
  ): {
    version: number;
    state: SupportState;
    invalidation: SupportInvalidation;
  } {
    return { version, state, invalidation: { caseId, version, state, change } };
  }

  private async appendAudit(input: {
    action:
      | "support.case_created"
      | "support.message_sent"
      | "support.case_reopened"
      | "support.case_auto_closed";
    actorUserId: string | null;
    targetId: string;
    correlationId: string;
    priorState?: SupportState;
    state: SupportState;
    version: number;
    occurredAt: Date;
  }) {
    await this.db.auditEvent.create({
      data: {
        occurredAt: input.occurredAt,
        actorType: input.actorUserId ? "user" : "system",
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: "support_case",
        targetId: input.targetId,
        result: "SUCCESS",
        correlationId: input.correlationId,
        context: {
          ...(input.priorState ? { priorState: input.priorState } : {}),
          resultingState: input.state,
          targetVersion: input.version,
        },
      },
    });
  }
}
