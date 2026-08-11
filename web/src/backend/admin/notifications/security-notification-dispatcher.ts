import "server-only";
import { prisma } from "@/backend/database/prisma";
import { PrismaSecurityNotificationRepository } from "@/backend/repositories/admin/prisma-security-notification-repository";
import { randomUUID } from "node:crypto";

const RETRY_DELAYS = [
  0,
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
] as const;
const permanent = new Set([
  "DESTINATION_REJECTED",
  "DESTINATION_DISABLED",
  "CONTENT_INVALID",
  "POLICY_REFUSED",
]);

export interface SecurityNotificationSender {
  send(work: {
    id: string;
    kind: string;
    targetUserId: string;
    payloadRef: unknown;
  }): Promise<void>;
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
      const attempt = work.attemptCount + 1;
      try {
        await this.sender.send(work);
        await prisma.securityNotificationWork.update({
          where: { id: work.id },
          data: {
            status: "DELIVERED",
            attemptCount: attempt,
            lastAttemptAt: now,
            nextAttemptAt: null,
            failureCategory: null,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      } catch (error) {
        const category =
          error instanceof Error && permanent.has(error.message)
            ? error.message
            : "TEMPORARY_UNAVAILABLE";
        const exhausted =
          permanent.has(category) ||
          attempt >= 5 ||
          now >= work.deliveryDeadline;
        await prisma.securityNotificationWork.update({
          where: { id: work.id },
          data: {
            status: exhausted ? "MANUAL_INTERVENTION_REQUIRED" : "RETRYING",
            attemptCount: attempt,
            lastAttemptAt: now,
            nextAttemptAt: exhausted
              ? null
              : new Date(now.getTime() + RETRY_DELAYS[attempt]),
            failureCategory: exhausted
              ? permanent.has(category)
                ? (category as never)
                : "ATTEMPTS_EXHAUSTED"
              : "TEMPORARY_UNAVAILABLE",
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      }
    }
    return due.length;
  }
}
