import "server-only";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import { connectionRealtimePublisher } from "../realtime/connection-realtime-hub";

export async function runProposalLifecycleCycle(now = new Date()) {
  const repository = new PrismaConnectionRepository();
  const expirations = await repository.runTransaction((transaction) =>
    transaction.expireDue(now, 100),
  );
  const reconciliations = await repository.runTransaction((transaction) =>
    transaction.reconcileInvalidActive(now, 100),
  );
  for (const event of expirations) {
    const detail = await repository.detailAdmin(event.proposalId, now);
    const recipients = [
      detail?.participantLow?.id,
      detail?.participantHigh?.id,
    ].filter((value): value is string => Boolean(value));
    await connectionRealtimePublisher().publish(
      {
        proposalId: event.proposalId,
        connectionId: null,
        version: event.version,
        state: event.state,
        change: "EXPIRED",
      },
      recipients,
    );
  }
  for (const event of reconciliations) {
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
  return {
    expired: expirations.length,
    authorityCancelled: reconciliations.length,
  };
}
