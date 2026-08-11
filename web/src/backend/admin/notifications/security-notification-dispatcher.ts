import "server-only";
import { PrismaSecurityNotificationRepository } from "@/backend/repositories/admin/prisma-security-notification-repository";
import { randomUUID } from "node:crypto";

export interface SecurityNotificationSender {
  send(work: {
    id: string;
    kind: string;
    targetUserId: string;
    payloadRef: unknown;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
}

export class SecurityNotificationDispatcher {
  constructor(private readonly sender: SecurityNotificationSender) {}

  async dispatchDue(now = new Date()) {
    const leaseOwner = `security-notification:${randomUUID()}`;
    const due = await new PrismaSecurityNotificationRepository().leaseDue(
      now,
      leaseOwner,
    );
    for (const work of due) {
      try {
        const outbox = await this.sender.send(work);
        await new PrismaSecurityNotificationRepository().linkOutbox({
          workId: work.id,
          emailOutboxId: outbox.id,
        });
      } catch {
        await new PrismaSecurityNotificationRepository().releaseEnqueueFailure({
          workId: work.id,
          now,
        });
      }
    }
    const reconciled =
      await new PrismaSecurityNotificationRepository().reconcileLinked();
    return { enqueued: due.length, reconciled };
  }
}
