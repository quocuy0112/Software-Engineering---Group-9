import "server-only";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import { enforceMessagingConnectionRevocation } from "@/backend/messaging/realtime/messaging-authority-enforcement";
import type { ConnectionActor } from "../authorization/connection-request-boundary";
import { connectionRealtimePublisher } from "../realtime/connection-realtime-hub";
import { admitConnectionRequest } from "./connection-rate-limit";

export class ConnectionService {
  constructor(private readonly repository = new PrismaConnectionRepository()) {}

  list(
    userId: string,
    input: {
      limit?: number;
      cursor?: string;
      state?: "ACCEPTED" | "REVOKED";
    } = {},
  ) {
    return this.repository.listConnections(
      userId,
      input.limit ?? 20,
      input.cursor,
      input.state,
    );
  }

  async disconnect(
    actor: ConnectionActor,
    connectionId: string,
    input: {
      expectedVersion: number;
      idempotencyKey: string;
    },
  ) {
    await admitConnectionRequest("connectionDisconnect", actor.userId);
    const before = await this.repository.listConnections(actor.userId, 100);
    const current = before.items.find((item) => item.id === connectionId);
    const result = await this.repository.runTransaction((repository) =>
      repository.disconnect({ actor, connectionId, ...input, now: new Date() }),
    );
    const recipients = [actor.userId, current?.otherParticipant.id].filter(
      (value): value is string => Boolean(value),
    );
    if (!result.deduplicated) {
      await Promise.all([
        enforceMessagingConnectionRevocation({
          professionalConnectionId: connectionId,
          affectedUserIds: recipients,
          correlationId: input.idempotencyKey,
        }),
        connectionRealtimePublisher().publish(
          {
            proposalId: null,
            connectionId,
            version: result.data.version,
            state: "REVOKED",
            change: "REVOKED",
          },
          recipients,
        ),
      ]);
    }
    return result;
  }
}
