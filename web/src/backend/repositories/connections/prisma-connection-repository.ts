import "server-only";
import { createHash, createHmac } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { canonicalParticipantPair } from "@/backend/messaging/ports/messaging-repository";
import { ConnectionError } from "@/backend/connections/connection-errors";
import type {
  AdminProposal,
  ConnectionDecision,
  ConnectionNotificationKind,
  ParticipantProposal,
  ProfessionalConnectionProjection,
} from "@/shared/contracts/connections";

type ConnectionDb = typeof prisma | Prisma.TransactionClient;
type ProposalState =
  | "PENDING_BOTH"
  | "PARTIALLY_ACCEPTED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";
type AuditInput = { userId: string; sessionId?: string };
type ProposalRow = Prisma.ProfessionalConnectionProposalGetPayload<{
  include: {
    participantLow: { select: { id: true; name: true; image: true } };
    participantHigh: { select: { id: true; name: true; image: true } };
    decisions: true;
  };
}>;

const activeProposalStates: ProposalState[] = [
  "PENDING_BOTH",
  "PARTIALLY_ACCEPTED",
];
const notificationRetentionMs = 90 * 24 * 60 * 60_000;
const ordinaryRetentionMs = 90 * 24 * 60 * 60_000;
const protectedRetentionMs = 365 * 24 * 60 * 60_000;

type ConnectionCursor = { at: string; id: string };
function encodeCursor(value: ConnectionCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function decodeCursor(value?: string | null): ConnectionCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as ConnectionCursor;
    return typeof decoded.at === "string" &&
      typeof decoded.id === "string" &&
      !Number.isNaN(Date.parse(decoded.at))
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function operationDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function pairDigest(low: string, high: string) {
  return createHmac("sha256", serverEnvironment.TOKEN_SECRET)
    .update(`professional-connection-pair:v1:${low}:${high}`)
    .digest("hex");
}

function safeAccount(value: {
  id: string;
  name: string;
  image: string | null;
}) {
  return { id: value.id, displayName: value.name, image: value.image };
}

function effectiveState(
  row: { state: ProposalState; expiresAt: Date },
  now: Date,
): ProposalState {
  return activeProposalStates.includes(row.state) && row.expiresAt <= now
    ? "EXPIRED"
    : row.state;
}

function ordinaryDetailAvailable(
  row: { protectedDeletedAt: Date | null; ordinaryDetailHiddenAt: Date | null },
  now: Date,
) {
  return (
    !row.protectedDeletedAt &&
    (!row.ordinaryDetailHiddenAt || row.ordinaryDetailHiddenAt > now)
  );
}

function adminProjection(row: ProposalRow, now: Date): AdminProposal {
  const detailAvailable = ordinaryDetailAvailable(row, now);
  return {
    id: row.id,
    participantLow: row.participantLow ? safeAccount(row.participantLow) : null,
    participantHigh: row.participantHigh
      ? safeAccount(row.participantHigh)
      : null,
    creatorAdminUserId: row.createdByAdminUserId,
    sourceSupportConversationId: row.sourceSupportConversationId,
    reason: detailAvailable ? row.reason : null,
    state: effectiveState(row, now),
    version: row.version,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    terminalAt: row.terminalAt?.toISOString() ?? null,
    ordinaryDetailAvailable: detailAvailable,
  };
}

function participantProjection(
  row: ProposalRow,
  userId: string,
  now: Date,
): ParticipantProposal {
  const detailAvailable = ordinaryDetailAvailable(row, now);
  const other =
    row.participantLowId === userId ? row.participantHigh : row.participantLow;
  const own = row.decisions.find(
    (decision) => decision.participantUserId === userId,
  );
  return {
    id: row.id,
    otherParticipant: other ? safeAccount(other) : null,
    reason: detailAvailable ? row.reason : null,
    state: effectiveState(row, now),
    version: row.version,
    myDecision: own?.decision ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    terminalAt: row.terminalAt?.toISOString() ?? null,
    detailAvailable,
  };
}

function connectionProjection(
  row: Prisma.ProfessionalConnectionGetPayload<{
    include: {
      participantLow: { select: { id: true; name: true; image: true } };
      participantHigh: { select: { id: true; name: true; image: true } };
    };
  }>,
  userId: string,
): ProfessionalConnectionProjection {
  const other =
    row.participantLowId === userId ? row.participantHigh : row.participantLow;
  return {
    id: row.id,
    otherParticipant: safeAccount(other),
    state: row.state,
    version: row.version,
    acceptedAt: row.acceptedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export class PrismaConnectionRepository {
  constructor(private readonly db: ConnectionDb = prisma) {}

  runTransaction<T>(
    work: (repository: PrismaConnectionRepository) => Promise<T>,
  ) {
    return prisma.$transaction(
      (tx) => work(new PrismaConnectionRepository(tx)),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  private async lockPair(low: string, high: string) {
    await this.db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`connection-pair:${low}:${high}`}, 0))`,
    );
  }

  private async lockUsers(userIds: string[]) {
    const ordered = [...new Set(userIds)].sort();
    await this.db.$queryRaw(
      Prisma.sql`SELECT "id" FROM "user" WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE`,
    );
  }

  private async lockProposal(id: string) {
    await this.db.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ProfessionalConnectionProposal" WHERE "id" = ${id} FOR UPDATE`,
    );
  }

  private async lockConnection(id: string) {
    await this.db.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ProfessionalConnection" WHERE "id" = ${id} FOR UPDATE`,
    );
  }

  private proposalInclude() {
    return {
      participantLow: { select: { id: true, name: true, image: true } },
      participantHigh: { select: { id: true, name: true, image: true } },
      decisions: true,
    } as const;
  }

  private async receipt(input: {
    actorUserId: string;
    idempotencyKey: string;
    commandKind: string;
    payload: unknown;
  }) {
    const existing =
      await this.db.professionalConnectionCommandReceipt.findUnique({
        where: {
          actorUserId_idempotencyKey: {
            actorUserId: input.actorUserId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
    if (!existing) return null;
    if (
      existing.commandKind !== input.commandKind ||
      existing.payloadDigest !== operationDigest(input.payload)
    ) {
      throw new ConnectionError("VALIDATION_ERROR", 409);
    }
    return existing;
  }

  private recordReceipt(input: {
    actorUserId: string;
    idempotencyKey: string;
    commandKind: string;
    targetReference?: string;
    payload: unknown;
    resultReference?: string;
    resultState?: string;
    resultVersion?: number;
  }) {
    return this.db.professionalConnectionCommandReceipt.create({
      data: {
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
        commandKind: input.commandKind,
        targetReference: input.targetReference,
        payloadDigest: operationDigest(input.payload),
        resultReference: input.resultReference,
        resultState: input.resultState,
        resultVersion: input.resultVersion,
      },
    });
  }

  private async addNotifications(input: {
    recipientUserIds: string[];
    kind: ConnectionNotificationKind;
    proposalId?: string;
    connectionId?: string;
    eventKey: string;
    now: Date;
  }) {
    const deleteAfter = new Date(input.now.getTime() + notificationRetentionMs);
    for (const recipientUserId of input.recipientUserIds) {
      await this.db.professionalConnectionNotification.create({
        data: {
          recipientUserId,
          proposalId: input.proposalId,
          connectionId: input.connectionId,
          kind: input.kind,
          deduplicationKey: `${input.eventKey}:${recipientUserId}`,
          deleteAfter,
          createdAt: input.now,
        },
      });
      await this.db.emailOutbox.create({
        data: {
          kind: "PROFESSIONAL_CONNECTION_UPDATED",
          userId: recipientUserId,
          professionalConnectionProposalId: input.proposalId,
          professionalConnectionId: input.connectionId,
          recipientRef: recipientUserId,
          templateVersion: "professional-connection-v1",
          payloadRef: {
            eventKind: input.kind,
            proposalId: input.proposalId,
            connectionId: input.connectionId,
            occurredAt: input.now.toISOString(),
          },
          idempotencyKey: `connection-email:${input.eventKey}:${recipientUserId}`,
          createdAt: input.now,
        },
      });
    }
  }

  private async audit(
    actor: AuditInput | null,
    input: {
      action:
        | "admin.connection_proposal_created"
        | "admin.connection_proposal_cancelled"
        | "connection.proposal_accepted"
        | "connection.proposal_declined"
        | "connection.proposal_expired"
        | "connection.proposal_cancelled"
        | "connection.created"
        | "connection.revoked"
        | "connection.notification_read"
        | "connection.content_deleted";
      targetType:
        | "connection_proposal"
        | "professional_connection"
        | "connection_notification";
      targetId: string;
      correlationId: string;
      state?: string;
      version?: number;
      result?: "SUCCESS" | "FAILURE" | "DENIED";
      now: Date;
    },
  ) {
    if (!("$transaction" in this.db)) {
      await new AuditWriter(this.db as Prisma.TransactionClient).append({
        occurredAt: input.now,
        actorType: actor ? "user" : "system",
        actorUserId: actor?.userId ?? null,
        actorSessionId: actor?.sessionId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        result: input.result ?? "SUCCESS",
        correlationId: input.correlationId,
        context: {
          ...(input.state ? { resultingState: input.state } : {}),
          ...(input.version ? { targetVersion: input.version } : {}),
        },
      });
    }
  }

  async createProposal(input: {
    admin: AuditInput;
    participantAId: string;
    participantBId: string;
    reason: string;
    expiryDays: number;
    sourceSupportConversationId?: string;
    idempotencyKey: string;
    now: Date;
  }) {
    const pair = canonicalParticipantPair(
      input.participantAId,
      input.participantBId,
    );
    const payload = {
      ...pair,
      reason: input.reason,
      expiryDays: input.expiryDays,
      sourceSupportConversationId: input.sourceSupportConversationId ?? null,
    };
    const duplicate = await this.receipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.create",
      payload,
    });
    if (duplicate?.resultReference) {
      const row = await this.detailAdmin(duplicate.resultReference, input.now);
      if (row) return { data: row, deduplicated: true };
    }
    await this.lockPair(pair.participantLowId, pair.participantHighId);
    const lockedDuplicate = await this.receipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.create",
      payload,
    });
    if (lockedDuplicate?.resultReference) {
      const data = await this.detailAdmin(
        lockedDuplicate.resultReference,
        input.now,
      );
      if (data) return { data, deduplicated: true };
    }
    await this.lockUsers([
      pair.participantLowId,
      pair.participantHighId,
      input.admin.userId,
    ]);
    const expiredPairRows =
      await this.db.professionalConnectionProposal.findMany({
        where: {
          ...pair,
          state: { in: activeProposalStates },
          expiresAt: { lte: input.now },
        },
        include: this.proposalInclude(),
        orderBy: { id: "asc" },
      });
    for (const expired of expiredPairRows) {
      await this.lockProposal(expired.id);
      const updated = await this.terminalProposal({
        row: expired,
        state: "EXPIRED",
        actor: null,
        correlationId: `proposal-expire-on-create:${expired.id}:v${expired.version + 1}`,
        action: "EXPIRED",
        now: input.now,
      });
      await this.audit(null, {
        action: "connection.proposal_expired",
        targetType: "connection_proposal",
        targetId: updated.id,
        correlationId: `proposal-expire-on-create:${updated.id}:v${updated.version}`,
        state: updated.state,
        version: updated.version,
        now: input.now,
      });
    }
    const accounts = await this.db.userAccount.findMany({
      where: {
        id: { in: [pair.participantLowId, pair.participantHighId] },
        state: "ACTIVE",
      },
      select: { id: true },
    });
    if (accounts.length !== 2)
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    if (input.sourceSupportConversationId) {
      const support = await this.db.supportConversation.findUnique({
        where: { id: input.sourceSupportConversationId },
        select: { id: true },
      });
      if (!support) throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    const [
      blocked,
      accepted,
      active,
      adminCount,
      lowActive,
      highActive,
      lowReceived,
      highReceived,
    ] = await Promise.all([
      this.db.userMessagingBlock.count({
        where: {
          OR: [
            {
              blockerUserId: pair.participantLowId,
              blockedUserId: pair.participantHighId,
            },
            {
              blockerUserId: pair.participantHighId,
              blockedUserId: pair.participantLowId,
            },
          ],
        },
      }),
      this.db.professionalConnection.count({
        where: { ...pair, state: "ACCEPTED" },
      }),
      this.db.professionalConnectionProposal.count({
        where: { ...pair, state: { in: activeProposalStates } },
      }),
      this.db.professionalConnectionProposal.count({
        where: {
          createdByAdminUserId: input.admin.userId,
          createdAt: { gte: new Date(input.now.getTime() - 24 * 60 * 60_000) },
        },
      }),
      this.activeParticipationCount(pair.participantLowId, input.now),
      this.activeParticipationCount(pair.participantHighId, input.now),
      this.receivedCount(pair.participantLowId, input.now),
      this.receivedCount(pair.participantHighId, input.now),
    ]);
    if (blocked) throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    if (accepted || active) throw new ConnectionError("STATE_CONFLICT", 409);
    if (
      adminCount >= 20 ||
      lowActive >= 3 ||
      highActive >= 3 ||
      lowReceived >= 5 ||
      highReceived >= 5
    ) {
      throw new ConnectionError("QUOTA_REACHED", 429, 24 * 60 * 60);
    }
    const latest = await this.db.professionalConnectionProposal.findFirst({
      where: { ...pair, state: { in: ["DECLINED", "EXPIRED", "CANCELLED"] } },
      orderBy: [{ terminalAt: "desc" }, { id: "desc" }],
      select: { state: true, terminalAt: true },
    });
    if (latest?.terminalAt) {
      const cooldown =
        latest.state === "DECLINED"
          ? 30 * 24 * 60 * 60_000
          : 7 * 24 * 60 * 60_000;
      const availableAt = latest.terminalAt.getTime() + cooldown;
      if (availableAt > input.now.getTime()) {
        throw new ConnectionError(
          "COOLDOWN_ACTIVE",
          409,
          Math.ceil((availableAt - input.now.getTime()) / 1000),
        );
      }
    }
    const row = await this.db.professionalConnectionProposal.create({
      data: {
        ...pair,
        participantPairDigest: pairDigest(
          pair.participantLowId,
          pair.participantHighId,
        ),
        createdByAdminUserId: input.admin.userId,
        sourceSupportConversationId: input.sourceSupportConversationId,
        reason: input.reason,
        expiresAt: new Date(
          input.now.getTime() + input.expiryDays * 24 * 60 * 60_000,
        ),
        createdAt: input.now,
        history: {
          create: {
            actorUserId: input.admin.userId,
            action: "CREATED",
            resultingState: "PENDING_BOTH",
            resultingVersion: 1,
            correlationId: input.idempotencyKey,
            occurredAt: input.now,
          },
        },
      },
      include: this.proposalInclude(),
    });
    await this.addNotifications({
      recipientUserIds: [pair.participantLowId, pair.participantHighId],
      kind: "PROPOSAL_CREATED",
      proposalId: row.id,
      eventKey: `proposal-created:${row.id}:v1`,
      now: input.now,
    });
    await this.recordReceipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.create",
      payload,
      resultReference: row.id,
      resultState: row.state,
      resultVersion: row.version,
    });
    await this.audit(input.admin, {
      action: "admin.connection_proposal_created",
      targetType: "connection_proposal",
      targetId: row.id,
      correlationId: input.idempotencyKey,
      state: row.state,
      version: row.version,
      now: input.now,
    });
    return { data: adminProjection(row, input.now), deduplicated: false };
  }

  private activeParticipationCount(userId: string, now: Date) {
    return this.db.professionalConnectionProposal.count({
      where: {
        state: { in: activeProposalStates },
        expiresAt: { gt: now },
        OR: [{ participantLowId: userId }, { participantHighId: userId }],
      },
    });
  }

  private receivedCount(userId: string, now: Date) {
    return this.db.professionalConnectionProposal.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60_000) },
        OR: [{ participantLowId: userId }, { participantHighId: userId }],
      },
    });
  }

  async listAdmin(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
    now: Date;
  }) {
    const state =
      typeof input.filter.state === "string" ? input.filter.state : undefined;
    const participantId =
      typeof input.filter.participantId === "string"
        ? input.filter.participantId
        : undefined;
    const creator =
      typeof input.filter.creatorAdminUserId === "string"
        ? input.filter.creatorAdminUserId
        : undefined;
    const where: Prisma.ProfessionalConnectionProposalWhereInput = {
      protectedDeletedAt: null,
      ...(state &&
      [
        "PENDING_BOTH",
        "PARTIALLY_ACCEPTED",
        "ACCEPTED",
        "DECLINED",
        "EXPIRED",
        "CANCELLED",
      ].includes(state)
        ? { state: state as ProposalState }
        : {}),
      ...(participantId
        ? {
            OR: [
              { participantLowId: participantId },
              { participantHighId: participantId },
            ],
          }
        : {}),
      ...(creator ? { createdByAdminUserId: creator } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.professionalConnectionProposal.findMany({
        where,
        include: this.proposalInclude(),
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.db.professionalConnectionProposal.count({ where }),
    ]);
    return {
      data: rows.map((row) => adminProjection(row, input.now)),
      total,
      calculatedAt: input.now.toISOString(),
    };
  }

  async detailAdmin(id: string, now = new Date()) {
    const row = await this.db.professionalConnectionProposal.findFirst({
      where: { id, protectedDeletedAt: null },
      include: this.proposalInclude(),
    });
    return row ? adminProjection(row, now) : null;
  }

  async listParticipant(
    userId: string,
    input: { limit: number; now: Date; cursor?: string; state?: ProposalState },
  ) {
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor)
      throw new ConnectionError("VALIDATION_ERROR", 400);
    const rows = await this.db.professionalConnectionProposal.findMany({
      where: {
        protectedDeletedAt: null,
        ...(input.state ? { state: input.state } : {}),
        AND: [
          { OR: [{ participantLowId: userId }, { participantHighId: userId }] },
          ...(cursor
            ? [
                {
                  OR: [
                    { updatedAt: { lt: new Date(cursor.at) } },
                    { updatedAt: new Date(cursor.at), id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: this.proposalInclude(),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => participantProjection(row, userId, input.now)),
      nextCursor:
        rows.length > input.limit && last
          ? encodeCursor({ at: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async detailParticipant(id: string, userId: string, now = new Date()) {
    const row = await this.db.professionalConnectionProposal.findFirst({
      where: {
        id,
        protectedDeletedAt: null,
        OR: [{ participantLowId: userId }, { participantHighId: userId }],
      },
      include: this.proposalInclude(),
    });
    return row ? participantProjection(row, userId, now) : null;
  }

  private async terminalProposal(input: {
    row: ProposalRow;
    state: "DECLINED" | "EXPIRED" | "CANCELLED";
    actor: AuditInput | null;
    correlationId: string;
    action: string;
    now: Date;
  }) {
    const version = input.row.version + 1;
    const updated = await this.db.professionalConnectionProposal.update({
      where: { id: input.row.id },
      data: {
        state: input.state,
        version,
        terminalAt: input.now,
        ordinaryDetailHiddenAt: new Date(
          input.now.getTime() + ordinaryRetentionMs,
        ),
        protectedDeleteAfter: new Date(
          input.now.getTime() + protectedRetentionMs,
        ),
        history: {
          create: {
            actorUserId: input.actor?.userId,
            action: input.action,
            priorState: input.row.state,
            resultingState: input.state,
            resultingVersion: version,
            correlationId: input.correlationId,
            occurredAt: input.now,
          },
        },
      },
      include: this.proposalInclude(),
    });
    if (updated.participantLowId && updated.participantHighId) {
      await this.addNotifications({
        recipientUserIds: [updated.participantLowId, updated.participantHighId],
        kind: "PROPOSAL_NO_LONGER_ACTIVE",
        proposalId: updated.id,
        eventKey: `proposal-terminal:${updated.id}:v${version}`,
        now: input.now,
      });
    }
    return updated;
  }

  async decideProposal(input: {
    actor: AuditInput;
    proposalId: string;
    decision: ConnectionDecision;
    expectedVersion: number;
    idempotencyKey: string;
    now: Date;
  }) {
    const payload = {
      proposalId: input.proposalId,
      decision: input.decision,
      expectedVersion: input.expectedVersion,
    };
    const duplicate = await this.receipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.decision",
      payload,
    });
    if (duplicate?.resultReference) {
      const data = await this.detailParticipant(
        duplicate.resultReference,
        input.actor.userId,
        input.now,
      );
      if (data) return { data, deduplicated: true, connectionId: null };
    }
    const initial = await this.db.professionalConnectionProposal.findUnique({
      where: { id: input.proposalId },
      select: { participantLowId: true, participantHighId: true },
    });
    if (!initial?.participantLowId || !initial.participantHighId) {
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    await this.lockPair(initial.participantLowId, initial.participantHighId);
    await this.lockUsers([initial.participantLowId, initial.participantHighId]);
    await this.lockProposal(input.proposalId);
    const lockedDuplicate = await this.receipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.decision",
      payload,
    });
    if (lockedDuplicate?.resultReference) {
      const data = await this.detailParticipant(
        lockedDuplicate.resultReference,
        input.actor.userId,
        input.now,
      );
      if (data) return { data, deduplicated: true, connectionId: null };
    }
    let row = await this.db.professionalConnectionProposal.findUnique({
      where: { id: input.proposalId },
      include: this.proposalInclude(),
    });
    if (
      !row ||
      (row.participantLowId !== input.actor.userId &&
        row.participantHighId !== input.actor.userId)
    ) {
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    if (row.version !== input.expectedVersion) {
      throw new ConnectionError(
        "VERSION_CONFLICT",
        409,
        undefined,
        row.version,
      );
    }
    if (!activeProposalStates.includes(row.state)) {
      throw new ConnectionError("STATE_CONFLICT", 409, undefined, row.version);
    }
    if (row.expiresAt <= input.now) {
      row = await this.terminalProposal({
        row,
        state: "EXPIRED",
        actor: null,
        correlationId: input.idempotencyKey,
        action: "EXPIRED",
        now: input.now,
      });
      await this.recordReceipt({
        actorUserId: input.actor.userId,
        idempotencyKey: input.idempotencyKey,
        commandKind: "proposal.decision",
        targetReference: row.id,
        payload,
        resultReference: row.id,
        resultState: row.state,
        resultVersion: row.version,
      });
      await this.audit(null, {
        action: "connection.proposal_expired",
        targetType: "connection_proposal",
        targetId: row.id,
        correlationId: input.idempotencyKey,
        state: row.state,
        version: row.version,
        now: input.now,
      });
      return {
        data: participantProjection(row, input.actor.userId, input.now),
        deduplicated: false,
        connectionId: null,
      };
    }
    const [activeAccounts, blocked] = await Promise.all([
      this.db.userAccount.count({
        where: {
          id: { in: [initial.participantLowId, initial.participantHighId] },
          state: "ACTIVE",
        },
      }),
      this.db.userMessagingBlock.count({
        where: {
          OR: [
            {
              blockerUserId: initial.participantLowId,
              blockedUserId: initial.participantHighId,
            },
            {
              blockerUserId: initial.participantHighId,
              blockedUserId: initial.participantLowId,
            },
          ],
        },
      }),
    ]);
    if (activeAccounts !== 2 || blocked) {
      row = await this.terminalProposal({
        row,
        state: "CANCELLED",
        actor: null,
        correlationId: input.idempotencyKey,
        action: "SAFETY_CANCELLED",
        now: input.now,
      });
      await this.recordReceipt({
        actorUserId: input.actor.userId,
        idempotencyKey: input.idempotencyKey,
        commandKind: "proposal.decision",
        targetReference: row.id,
        payload,
        resultReference: row.id,
        resultState: row.state,
        resultVersion: row.version,
      });
      await this.audit(null, {
        action: "connection.proposal_cancelled",
        targetType: "connection_proposal",
        targetId: row.id,
        correlationId: input.idempotencyKey,
        state: row.state,
        version: row.version,
        now: input.now,
      });
      return {
        data: participantProjection(row, input.actor.userId, input.now),
        deduplicated: false,
        connectionId: null,
      };
    }
    const existing = row.decisions.find(
      (decision) => decision.participantUserId === input.actor.userId,
    );
    if (existing?.decision === "DECLINED") {
      throw new ConnectionError("STATE_CONFLICT", 409, undefined, row.version);
    }
    if (existing?.decision === input.decision) {
      await this.recordReceipt({
        actorUserId: input.actor.userId,
        idempotencyKey: input.idempotencyKey,
        commandKind: "proposal.decision",
        targetReference: row.id,
        payload,
        resultReference: row.id,
        resultState: row.state,
        resultVersion: row.version,
      });
      return {
        data: participantProjection(row, input.actor.userId, input.now),
        deduplicated: true,
        connectionId: null,
      };
    }
    await this.db.professionalConnectionDecision.upsert({
      where: {
        proposalId_participantUserId: {
          proposalId: row.id,
          participantUserId: input.actor.userId,
        },
      },
      create: {
        proposalId: row.id,
        participantUserId: input.actor.userId,
        decision: input.decision,
        decidedAt: input.now,
      },
      update: {
        decision: input.decision,
        version: { increment: 1 },
        decidedAt: input.now,
      },
    });
    const version = row.version + 1;
    let connectionId: string | null = null;
    let resultingState: ProposalState;
    if (input.decision === "DECLINED") {
      resultingState = "DECLINED";
    } else {
      const acceptedCount = await this.db.professionalConnectionDecision.count({
        where: { proposalId: row.id, decision: "ACCEPTED" },
      });
      resultingState = acceptedCount === 2 ? "ACCEPTED" : "PARTIALLY_ACCEPTED";
    }
    const terminal = ["ACCEPTED", "DECLINED"].includes(resultingState);
    const updated = await this.db.professionalConnectionProposal.update({
      where: { id: row.id },
      data: {
        state: resultingState,
        version,
        ...(terminal
          ? {
              terminalAt: input.now,
              ordinaryDetailHiddenAt: new Date(
                input.now.getTime() + ordinaryRetentionMs,
              ),
              protectedDeleteAfter: new Date(
                input.now.getTime() + protectedRetentionMs,
              ),
            }
          : {}),
        history: {
          create: {
            actorUserId: input.actor.userId,
            action: input.decision,
            priorState: row.state,
            resultingState,
            resultingVersion: version,
            decisionKind: input.decision,
            correlationId: input.idempotencyKey,
            occurredAt: input.now,
          },
        },
      },
      include: this.proposalInclude(),
    });
    if (resultingState === "ACCEPTED") {
      const connection = await this.db.professionalConnection.create({
        data: {
          participantLowId: initial.participantLowId,
          participantHighId: initial.participantHighId,
          sourceProposalId: row.id,
          acceptedAt: input.now,
        },
      });
      connectionId = connection.id;
      await this.addNotifications({
        recipientUserIds: [initial.participantLowId, initial.participantHighId],
        kind: "CONNECTION_ACCEPTED",
        proposalId: row.id,
        connectionId,
        eventKey: `connection-accepted:${connectionId}:v1`,
        now: input.now,
      });
      await this.audit(input.actor, {
        action: "connection.created",
        targetType: "professional_connection",
        targetId: connectionId,
        correlationId: input.idempotencyKey,
        state: "ACCEPTED",
        version: 1,
        now: input.now,
      });
    } else {
      await this.addNotifications({
        recipientUserIds: [initial.participantLowId, initial.participantHighId],
        kind:
          resultingState === "DECLINED"
            ? "PROPOSAL_NO_LONGER_ACTIVE"
            : "PROPOSAL_UPDATED",
        proposalId: row.id,
        eventKey: `proposal-decision:${row.id}:v${version}`,
        now: input.now,
      });
    }
    await this.recordReceipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.decision",
      targetReference: row.id,
      payload,
      resultReference: row.id,
      resultState: resultingState,
      resultVersion: version,
    });
    await this.audit(input.actor, {
      action:
        input.decision === "DECLINED"
          ? "connection.proposal_declined"
          : "connection.proposal_accepted",
      targetType: "connection_proposal",
      targetId: row.id,
      correlationId: input.idempotencyKey,
      state: resultingState,
      version,
      now: input.now,
    });
    return {
      data: participantProjection(updated, input.actor.userId, input.now),
      deduplicated: false,
      connectionId,
    };
  }

  async cancelProposal(input: {
    admin: AuditInput;
    proposalId: string;
    expectedVersion: number;
    idempotencyKey: string;
    now: Date;
  }) {
    const payload = {
      proposalId: input.proposalId,
      expectedVersion: input.expectedVersion,
    };
    const duplicate = await this.receipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.cancel",
      payload,
    });
    if (duplicate?.resultReference) {
      const data = await this.detailAdmin(duplicate.resultReference, input.now);
      if (data) return { data, deduplicated: true };
    }
    const initial = await this.db.professionalConnectionProposal.findUnique({
      where: { id: input.proposalId },
      select: { participantLowId: true, participantHighId: true },
    });
    if (!initial?.participantLowId || !initial.participantHighId) {
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    await this.lockPair(initial.participantLowId, initial.participantHighId);
    await this.lockProposal(input.proposalId);
    const lockedDuplicate = await this.receipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.cancel",
      payload,
    });
    if (lockedDuplicate?.resultReference) {
      const data = await this.detailAdmin(
        lockedDuplicate.resultReference,
        input.now,
      );
      if (data) return { data, deduplicated: true };
    }
    const row = await this.db.professionalConnectionProposal.findUnique({
      where: { id: input.proposalId },
      include: this.proposalInclude(),
    });
    if (!row || !activeProposalStates.includes(row.state)) {
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    if (row.version !== input.expectedVersion) {
      throw new ConnectionError(
        "VERSION_CONFLICT",
        409,
        undefined,
        row.version,
      );
    }
    const updated = await this.terminalProposal({
      row,
      state: row.expiresAt <= input.now ? "EXPIRED" : "CANCELLED",
      actor: input.admin,
      correlationId: input.idempotencyKey,
      action: row.expiresAt <= input.now ? "EXPIRED" : "ADMIN_CANCELLED",
      now: input.now,
    });
    await this.recordReceipt({
      actorUserId: input.admin.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "proposal.cancel",
      targetReference: row.id,
      payload,
      resultReference: row.id,
      resultState: updated.state,
      resultVersion: updated.version,
    });
    await this.audit(input.admin, {
      action: "admin.connection_proposal_cancelled",
      targetType: "connection_proposal",
      targetId: row.id,
      correlationId: input.idempotencyKey,
      state: updated.state,
      version: updated.version,
      now: input.now,
    });
    return { data: adminProjection(updated, input.now), deduplicated: false };
  }

  async listConnections(
    userId: string,
    limit: number,
    cursorValue?: string,
    state?: "ACCEPTED" | "REVOKED",
  ) {
    const cursor = decodeCursor(cursorValue);
    if (cursorValue && !cursor)
      throw new ConnectionError("VALIDATION_ERROR", 400);
    const rows = await this.db.professionalConnection.findMany({
      where: {
        ...(state ? { state } : {}),
        AND: [
          { OR: [{ participantLowId: userId }, { participantHighId: userId }] },
          ...(cursor
            ? [
                {
                  OR: [
                    { updatedAt: { lt: new Date(cursor.at) } },
                    { updatedAt: new Date(cursor.at), id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        participantLow: { select: { id: true, name: true, image: true } },
        participantHigh: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => connectionProjection(row, userId)),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ at: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async disconnect(input: {
    actor: AuditInput;
    connectionId: string;
    expectedVersion: number;
    idempotencyKey: string;
    now: Date;
  }) {
    const payload = {
      connectionId: input.connectionId,
      expectedVersion: input.expectedVersion,
    };
    const duplicate = await this.receipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "connection.disconnect",
      payload,
    });
    if (duplicate?.resultReference) {
      const rows = await this.listConnections(input.actor.userId, 100);
      const data = rows.items.find(
        (item) => item.id === duplicate.resultReference,
      );
      if (data) return { data, deduplicated: true, conversationIds: [] };
    }
    await this.lockConnection(input.connectionId);
    const lockedDuplicate = await this.receipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "connection.disconnect",
      payload,
    });
    if (lockedDuplicate?.resultReference) {
      const rows = await this.listConnections(input.actor.userId, 100);
      const data = rows.items.find(
        (item) => item.id === lockedDuplicate.resultReference,
      );
      if (data) return { data, deduplicated: true, conversationIds: [] };
    }
    const row = await this.db.professionalConnection.findUnique({
      where: { id: input.connectionId },
      include: {
        participantLow: { select: { id: true, name: true, image: true } },
        participantHigh: { select: { id: true, name: true, image: true } },
        conversations: { select: { id: true } },
      },
    });
    if (
      !row ||
      row.state !== "ACCEPTED" ||
      (row.participantLowId !== input.actor.userId &&
        row.participantHighId !== input.actor.userId)
    ) {
      throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    }
    if (row.version !== input.expectedVersion) {
      throw new ConnectionError(
        "VERSION_CONFLICT",
        409,
        undefined,
        row.version,
      );
    }
    const version = row.version + 1;
    await this.db.messagingConversation.updateMany({
      where: { professionalConnectionId: row.id, archivedAt: null },
      data: {
        archivedAt: input.now,
        archiveReason: "PROFESSIONAL_CONNECTION_REVOKED",
      },
    });
    const updated = await this.db.professionalConnection.update({
      where: { id: row.id },
      data: {
        state: "REVOKED",
        version,
        revokedAt: input.now,
        revokedByUserId: input.actor.userId,
      },
      include: {
        participantLow: { select: { id: true, name: true, image: true } },
        participantHigh: { select: { id: true, name: true, image: true } },
      },
    });
    await this.addNotifications({
      recipientUserIds: [row.participantLowId, row.participantHighId],
      kind: "CONNECTION_REVOKED",
      connectionId: row.id,
      eventKey: `connection-revoked:${row.id}:v${version}`,
      now: input.now,
    });
    await this.recordReceipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "connection.disconnect",
      targetReference: row.id,
      payload,
      resultReference: row.id,
      resultState: "REVOKED",
      resultVersion: version,
    });
    await this.audit(input.actor, {
      action: "connection.revoked",
      targetType: "professional_connection",
      targetId: row.id,
      correlationId: input.idempotencyKey,
      state: "REVOKED",
      version,
      now: input.now,
    });
    return {
      data: connectionProjection(updated, input.actor.userId),
      deduplicated: false,
      conversationIds: row.conversations.map((conversation) => conversation.id),
    };
  }

  async listNotifications(
    userId: string,
    limit: number,
    now = new Date(),
    cursorValue?: string,
  ) {
    const cursor = decodeCursor(cursorValue);
    if (cursorValue && !cursor)
      throw new ConnectionError("VALIDATION_ERROR", 400);
    const rows = await this.db.professionalConnectionNotification.findMany({
      where: {
        recipientUserId: userId,
        deleteAfter: { gt: now },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => {
        const copy = notificationCopy(row.kind);
        return {
          id: row.id,
          kind: row.kind,
          ...copy,
          proposalId: row.proposalId,
          connectionId: row.connectionId,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString() ?? null,
        };
      }),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async markNotificationRead(input: {
    actor: AuditInput;
    notificationId: string;
    idempotencyKey: string;
    now: Date;
  }) {
    const row = await this.db.professionalConnectionNotification.findFirst({
      where: {
        id: input.notificationId,
        recipientUserId: input.actor.userId,
        deleteAfter: { gt: input.now },
      },
    });
    if (!row) throw new ConnectionError("RESOURCE_UNAVAILABLE", 404);
    const duplicate = await this.receipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "notification.read",
      payload: { notificationId: input.notificationId },
    });
    if (duplicate) return { deduplicated: true };
    await this.db.professionalConnectionNotification.update({
      where: { id: row.id },
      data: { readAt: row.readAt ?? input.now },
    });
    await this.recordReceipt({
      actorUserId: input.actor.userId,
      idempotencyKey: input.idempotencyKey,
      commandKind: "notification.read",
      targetReference: row.id,
      payload: { notificationId: row.id },
      resultReference: row.id,
      resultState: "READ",
    });
    await this.audit(input.actor, {
      action: "connection.notification_read",
      targetType: "connection_notification",
      targetId: row.id,
      correlationId: input.idempotencyKey,
      state: "READ",
      now: input.now,
    });
    return { deduplicated: false };
  }

  async invalidateActivePair(input: {
    userA: string;
    userB: string;
    correlationId: string;
    now: Date;
  }) {
    const pair = canonicalParticipantPair(input.userA, input.userB);
    await this.lockPair(pair.participantLowId, pair.participantHighId);
    const rows = await this.db.professionalConnectionProposal.findMany({
      where: { ...pair, state: { in: activeProposalStates } },
      include: this.proposalInclude(),
      orderBy: { id: "asc" },
    });
    const events = [];
    for (const row of rows) {
      await this.lockProposal(row.id);
      const updated = await this.terminalProposal({
        row,
        state: "CANCELLED",
        actor: null,
        correlationId: input.correlationId,
        action: "SAFETY_CANCELLED",
        now: input.now,
      });
      await this.audit(null, {
        action: "connection.proposal_cancelled",
        targetType: "connection_proposal",
        targetId: updated.id,
        correlationId: input.correlationId,
        state: updated.state,
        version: updated.version,
        now: input.now,
      });
      events.push({
        proposalId: updated.id,
        version: updated.version,
        state: updated.state,
        recipientUserIds: [pair.participantLowId, pair.participantHighId],
      });
    }
    return events;
  }

  async createBlockAndInvalidatePair(input: {
    blockerUserId: string;
    blockedUserId: string;
    correlationId: string;
    now: Date;
  }) {
    const pair = canonicalParticipantPair(
      input.blockerUserId,
      input.blockedUserId,
    );
    await this.lockPair(pair.participantLowId, pair.participantHighId);
    await this.db.userMessagingBlock.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: input.blockerUserId,
          blockedUserId: input.blockedUserId,
        },
      },
      create: {
        blockerUserId: input.blockerUserId,
        blockedUserId: input.blockedUserId,
        createdAt: input.now,
      },
      update: {},
    });
    const rows = await this.db.professionalConnectionProposal.findMany({
      where: { ...pair, state: { in: activeProposalStates } },
      include: this.proposalInclude(),
      orderBy: { id: "asc" },
    });
    const events = [];
    for (const row of rows) {
      await this.lockProposal(row.id);
      const updated = await this.terminalProposal({
        row,
        state: "CANCELLED",
        actor: null,
        correlationId: input.correlationId,
        action: "BLOCK_CANCELLED",
        now: input.now,
      });
      await this.audit(null, {
        action: "connection.proposal_cancelled",
        targetType: "connection_proposal",
        targetId: updated.id,
        correlationId: input.correlationId,
        state: updated.state,
        version: updated.version,
        now: input.now,
      });
      events.push({
        proposalId: updated.id,
        version: updated.version,
        state: updated.state,
        recipientUserIds: [pair.participantLowId, pair.participantHighId],
      });
    }
    return events;
  }

  async invalidateActiveForUser(input: {
    userId: string;
    correlationId: string;
    now: Date;
  }) {
    const rows = await this.db.professionalConnectionProposal.findMany({
      where: {
        state: { in: activeProposalStates },
        OR: [
          { participantLowId: input.userId },
          { participantHighId: input.userId },
        ],
      },
      select: { participantLowId: true, participantHighId: true },
      orderBy: [{ participantLowId: "asc" }, { participantHighId: "asc" }],
    });
    const events = [];
    for (const row of rows) {
      if (!row.participantLowId || !row.participantHighId) continue;
      events.push(
        ...(await this.invalidateActivePair({
          userA: row.participantLowId,
          userB: row.participantHighId,
          correlationId: input.correlationId,
          now: input.now,
        })),
      );
    }
    return events;
  }

  async reconcileInvalidActive(now: Date, limit = 100) {
    const invalidRows = await this.db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT proposal."id"
        FROM "ProfessionalConnectionProposal" proposal
        LEFT JOIN "user" participant_low ON participant_low."id" = proposal."participantLowId"
        LEFT JOIN "user" participant_high ON participant_high."id" = proposal."participantHighId"
        WHERE proposal."state" IN ('PENDING_BOTH', 'PARTIALLY_ACCEPTED')
          AND (
            participant_low."state" IS DISTINCT FROM 'ACTIVE'
            OR participant_high."state" IS DISTINCT FROM 'ACTIVE'
            OR EXISTS (
              SELECT 1
              FROM "UserMessagingBlock" block
              WHERE (block."blockerUserId" = proposal."participantLowId" AND block."blockedUserId" = proposal."participantHighId")
                 OR (block."blockerUserId" = proposal."participantHighId" AND block."blockedUserId" = proposal."participantLowId")
            )
          )
        ORDER BY proposal."updatedAt" ASC, proposal."id" ASC
        LIMIT ${limit}
      `,
    );
    const candidates = await this.db.professionalConnectionProposal.findMany({
      where: { id: { in: invalidRows.map((row) => row.id) } },
      include: this.proposalInclude(),
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    });
    const events = [];
    for (const candidate of candidates) {
      if (!candidate.participantLowId || !candidate.participantHighId) continue;
      await this.lockPair(
        candidate.participantLowId,
        candidate.participantHighId,
      );
      await this.lockUsers([
        candidate.participantLowId,
        candidate.participantHighId,
      ]);
      await this.lockProposal(candidate.id);
      const current = await this.db.professionalConnectionProposal.findUnique({
        where: { id: candidate.id },
        include: this.proposalInclude(),
      });
      if (!current || !activeProposalStates.includes(current.state)) continue;
      const [activeAccounts, blocked] = await Promise.all([
        this.db.userAccount.count({
          where: {
            id: {
              in: [candidate.participantLowId, candidate.participantHighId],
            },
            state: "ACTIVE",
          },
        }),
        this.db.userMessagingBlock.count({
          where: {
            OR: [
              {
                blockerUserId: candidate.participantLowId,
                blockedUserId: candidate.participantHighId,
              },
              {
                blockerUserId: candidate.participantHighId,
                blockedUserId: candidate.participantLowId,
              },
            ],
          },
        }),
      ]);
      if (activeAccounts === 2 && !blocked) continue;
      const updated = await this.terminalProposal({
        row: current,
        state: "CANCELLED",
        actor: null,
        correlationId: `proposal-reconcile:${current.id}:v${current.version + 1}`,
        action: "AUTHORITY_RECONCILED",
        now,
      });
      await this.audit(null, {
        action: "connection.proposal_cancelled",
        targetType: "connection_proposal",
        targetId: updated.id,
        correlationId: `proposal-reconcile:${updated.id}:v${updated.version}`,
        state: updated.state,
        version: updated.version,
        now,
      });
      events.push({
        proposalId: updated.id,
        version: updated.version,
        state: updated.state,
        recipientUserIds: [
          candidate.participantLowId,
          candidate.participantHighId,
        ],
      });
    }
    return events;
  }

  async expireDue(now: Date, limit = 100) {
    const due = await this.db.professionalConnectionProposal.findMany({
      where: { state: { in: activeProposalStates }, expiresAt: { lte: now } },
      include: this.proposalInclude(),
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    const events = [];
    for (const row of due) {
      await this.lockProposal(row.id);
      const current = await this.db.professionalConnectionProposal.findUnique({
        where: { id: row.id },
        include: this.proposalInclude(),
      });
      if (
        !current ||
        !activeProposalStates.includes(current.state) ||
        current.expiresAt > now
      )
        continue;
      const updated = await this.terminalProposal({
        row: current,
        state: "EXPIRED",
        actor: null,
        correlationId: `proposal-expire:${current.id}:v${current.version + 1}`,
        action: "EXPIRED",
        now,
      });
      await this.audit(null, {
        action: "connection.proposal_expired",
        targetType: "connection_proposal",
        targetId: updated.id,
        correlationId: `proposal-expire:${updated.id}:v${updated.version}`,
        state: updated.state,
        version: updated.version,
        now,
      });
      events.push({
        proposalId: updated.id,
        version: updated.version,
        state: updated.state,
      });
    }
    return events;
  }

  async purgeDue(now: Date, limit = 100) {
    const notificationRows =
      await this.db.professionalConnectionNotification.findMany({
        where: { deleteAfter: { lte: now } },
        orderBy: [{ deleteAfter: "asc" }, { id: "asc" }],
        take: limit,
        select: { id: true },
      });
    const notifications = notificationRows.length
      ? await this.db.professionalConnectionNotification.deleteMany({
          where: { id: { in: notificationRows.map((row) => row.id) } },
        })
      : { count: 0 };
    const proposals = await this.db.professionalConnectionProposal.findMany({
      where: { protectedDeleteAfter: { lte: now }, protectedDeletedAt: null },
      orderBy: [{ protectedDeleteAfter: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true },
    });
    for (const proposal of proposals) {
      await this.lockProposal(proposal.id);
      await this.db.professionalConnectionDecision.deleteMany({
        where: { proposalId: proposal.id },
      });
      await this.db.professionalConnectionProposalHistory.updateMany({
        where: { proposalId: proposal.id },
        data: { actorUserId: null, decisionKind: null },
      });
      await this.db.professionalConnectionProposal.update({
        where: { id: proposal.id },
        data: {
          participantLowId: null,
          participantHighId: null,
          createdByAdminUserId: null,
          sourceSupportConversationId: null,
          reason: null,
          protectedDeletedAt: now,
        },
      });
      await this.audit(null, {
        action: "connection.content_deleted",
        targetType: "connection_proposal",
        targetId: proposal.id,
        correlationId: `connection-content-delete:${proposal.id}`,
        state: "CONTENT_DELETED",
        now,
      });
    }
    return {
      notificationCount: notifications.count,
      proposalCount: proposals.length,
    };
  }
}

function notificationCopy(kind: ConnectionNotificationKind) {
  if (kind === "PROPOSAL_CREATED") {
    return {
      title: "Professional connection proposal",
      message:
        "SmartHire sent you a professional connection proposal. Sign in to review it.",
    };
  }
  if (kind === "CONNECTION_ACCEPTED") {
    return {
      title: "Professional connection active",
      message: "Both participants accepted. Messaging is now available.",
    };
  }
  if (kind === "CONNECTION_REVOKED") {
    return {
      title: "Professional connection ended",
      message:
        "This professional connection is no longer active. Retained chat history is read-only.",
    };
  }
  if (kind === "PROPOSAL_UPDATED") {
    return {
      title: "Professional connection proposal updated",
      message:
        "The proposal has new aggregate progress. Sign in to review its current state.",
    };
  }
  return {
    title: "Professional connection proposal closed",
    message: "This proposal is no longer active.",
  };
}

export { notificationCopy };
