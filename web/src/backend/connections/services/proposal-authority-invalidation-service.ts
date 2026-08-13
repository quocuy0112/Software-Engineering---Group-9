import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import { connectionRealtimePublisher } from "../realtime/connection-realtime-hub";

export class ProposalAuthorityInvalidationService {
  constructor(private readonly repository = new PrismaConnectionRepository()) {}

  async pair(userA: string, userB: string, correlationId = randomUUID()) {
    const events = await this.repository.runTransaction((repository) =>
      repository.invalidateActivePair({
        userA,
        userB,
        correlationId,
        now: new Date(),
      }),
    );
    await this.publish(events);
    return events;
  }

  async block(
    blockerUserId: string,
    blockedUserId: string,
    correlationId = randomUUID(),
  ) {
    const events = await this.repository.runTransaction((repository) =>
      repository.createBlockAndInvalidatePair({
        blockerUserId,
        blockedUserId,
        correlationId,
        now: new Date(),
      }),
    );
    await this.publish(events);
    return events;
  }

  async account(userId: string, correlationId = randomUUID()) {
    const events = await this.repository.runTransaction((repository) =>
      repository.invalidateActiveForUser({
        userId,
        correlationId,
        now: new Date(),
      }),
    );
    await this.publish(events);
    return events;
  }

  private async publish(
    events: Awaited<
      ReturnType<PrismaConnectionRepository["invalidateActivePair"]>
    >,
  ) {
    for (const event of events) {
      await connectionRealtimePublisher().publish(
        {
          proposalId: event.proposalId,
          connectionId: null,
          version: event.version,
          state: event.state,
          change: "CANCELLED",
        },
        event.recipientUserIds,
      );
    }
  }
}
