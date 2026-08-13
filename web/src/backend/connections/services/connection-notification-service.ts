import "server-only";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import type { ConnectionActor } from "../authorization/connection-request-boundary";

export class ConnectionNotificationService {
  constructor(private readonly repository = new PrismaConnectionRepository()) {}

  list(userId: string, input: { limit?: number; cursor?: string } = {}) {
    return this.repository.listNotifications(
      userId,
      input.limit ?? 20,
      new Date(),
      input.cursor,
    );
  }

  markRead(
    actor: ConnectionActor,
    notificationId: string,
    idempotencyKey: string,
  ) {
    return this.repository.runTransaction((repository) =>
      repository.markNotificationRead({
        actor,
        notificationId,
        idempotencyKey,
        now: new Date(),
      }),
    );
  }
}
