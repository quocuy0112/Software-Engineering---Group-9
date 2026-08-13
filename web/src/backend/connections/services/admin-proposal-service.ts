import "server-only";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import type { z } from "zod";
import type { createConnectionProposalInputSchema } from "@/shared/contracts/connections";
import { connectionRealtimePublisher } from "../realtime/connection-realtime-hub";
import { admitConnectionRequest } from "./connection-rate-limit";
import { prisma } from "@/backend/database/prisma";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";
import { ConnectionError } from "../connection-errors";

type CreateInput = z.infer<typeof createConnectionProposalInputSchema> & {
  idempotencyKey: string;
};

export class AdminProposalService {
  constructor(private readonly repository = new PrismaConnectionRepository()) {}

  list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    return this.repository.listAdmin({ ...input, now: new Date() });
  }

  detail(proposalId: string) {
    return this.repository.detailAdmin(proposalId);
  }

  async create(authority: AdminAuthority, input: CreateInput) {
    const now = new Date();
    let result;
    try {
      await admitConnectionRequest(
        "connectionProposalCreate",
        authority.userId,
      );
      result = await this.repository.runTransaction((repository) =>
        repository.createProposal({
          admin: authority,
          participantAId: input.participantAId,
          participantBId: input.participantBId,
          reason: input.reason,
          expiryDays: input.expiryDays,
          sourceSupportConversationId: input.sourceSupportConversationId,
          idempotencyKey: input.idempotencyKey,
          now,
        }),
      );
    } catch (error) {
      await recordRejectedAdminProposalCommand(authority, {
        action: "admin.connection_proposal_created",
        targetId: null,
        correlationId: input.idempotencyKey,
        error,
        now,
      });
      throw error;
    }
    if (!result.deduplicated) {
      await connectionRealtimePublisher().publish(
        {
          proposalId: result.data.id,
          connectionId: null,
          version: result.data.version,
          state: result.data.state,
          change: "CREATED",
        },
        [input.participantAId, input.participantBId],
      );
    }
    return result;
  }

  async cancel(
    authority: AdminAuthority,
    proposalId: string,
    input: {
      expectedVersion: number;
      idempotencyKey: string;
    },
  ) {
    const before = await this.repository.detailAdmin(proposalId);
    const recipients = [
      before?.participantLow?.id,
      before?.participantHigh?.id,
    ].filter((value): value is string => Boolean(value));
    const now = new Date();
    let result;
    try {
      result = await this.repository.runTransaction((repository) =>
        repository.cancelProposal({
          admin: authority,
          proposalId,
          ...input,
          now,
        }),
      );
    } catch (error) {
      await recordRejectedAdminProposalCommand(authority, {
        action: "admin.connection_proposal_cancelled",
        targetId: proposalId,
        correlationId: input.idempotencyKey,
        error,
        now,
      });
      throw error;
    }
    if (!result.deduplicated) {
      await connectionRealtimePublisher().publish(
        {
          proposalId,
          connectionId: null,
          version: result.data.version,
          state: result.data.state,
          change: result.data.state === "EXPIRED" ? "EXPIRED" : "CANCELLED",
        },
        recipients,
      );
    }
    return result;
  }
}

async function recordRejectedAdminProposalCommand(
  authority: AdminAuthority,
  input: {
    action:
      | "admin.connection_proposal_created"
      | "admin.connection_proposal_cancelled";
    targetId: string | null;
    correlationId: string;
    error: unknown;
    now: Date;
  },
) {
  const failureCode =
    input.error instanceof ConnectionError
      ? input.error.code
      : "TEMPORARILY_UNAVAILABLE";
  await prisma
    .$transaction((tx) =>
      new AuditWriter(tx).append({
        occurredAt: input.now,
        actorType: "user",
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        action: input.action,
        targetType: "connection_proposal",
        targetId: input.targetId,
        result: "FAILURE",
        correlationId: input.correlationId,
        context: { failureCode },
      }),
    )
    .catch(() => undefined);
}
