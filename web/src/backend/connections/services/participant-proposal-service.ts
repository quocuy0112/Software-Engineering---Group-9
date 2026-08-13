import "server-only";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import type { ConnectionActor } from "../authorization/connection-request-boundary";
import type { ConnectionDecision } from "@/shared/contracts/connections";
import { connectionRealtimePublisher } from "../realtime/connection-realtime-hub";
import { admitConnectionRequest } from "./connection-rate-limit";

export class ParticipantProposalService {
  constructor(private readonly repository = new PrismaConnectionRepository()) {}

  list(
    userId: string,
    input: {
      limit?: number;
      cursor?: string;
      state?: Parameters<
        PrismaConnectionRepository["listParticipant"]
      >[1]["state"];
    } = {},
  ) {
    return this.repository.listParticipant(userId, {
      limit: input.limit ?? 20,
      cursor: input.cursor,
      state: input.state,
      now: new Date(),
    });
  }

  detail(proposalId: string, userId: string) {
    return this.repository.detailParticipant(proposalId, userId);
  }

  async decide(
    actor: ConnectionActor,
    proposalId: string,
    input: {
      decision: ConnectionDecision;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ) {
    await admitConnectionRequest("connectionProposalDecision", actor.userId);
    const before = await this.repository.detailParticipant(
      proposalId,
      actor.userId,
    );
    const result = await this.repository.runTransaction((repository) =>
      repository.decideProposal({
        actor,
        proposalId,
        ...input,
        now: new Date(),
      }),
    );
    if (!result.deduplicated) {
      const recipients = [actor.userId, before?.otherParticipant?.id].filter(
        (value): value is string => Boolean(value),
      );
      await connectionRealtimePublisher().publish(
        {
          proposalId,
          connectionId: result.connectionId,
          version: result.data.version,
          state: result.data.state,
          change:
            result.data.state === "ACCEPTED"
              ? "ACCEPTED"
              : result.data.state === "EXPIRED"
                ? "EXPIRED"
                : "DECIDED",
        },
        recipients,
      );
    }
    return result;
  }
}
