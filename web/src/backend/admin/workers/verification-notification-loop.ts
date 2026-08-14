import "server-only";
import { prisma } from "@/backend/database/prisma";

function emailStatus(status: string) {
  if (status === "SENT") return "DELIVERED" as const;
  if (status === "DEAD") return "FAILED" as const;
  return "QUEUED" as const;
}

/**
 * Reconciles the two delivery channels of one committed verification outcome.
 * The deterministic in-app reference is the durable work item; claiming it is
 * idempotent and never changes the already-committed request decision.
 */
export async function runVerificationNotificationCycle(
  now = new Date(),
  limit = 100,
) {
  const events = await prisma.verificationNotificationEvent.findMany({
    where: {
      OR: [
        { emailStatus: "QUEUED" },
        { inAppStatus: "QUEUED" },
      ],
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit,
    include: { emailOutbox: { select: { status: true } } },
  });
  let reconciled = 0;
  for (const event of events) {
    const nextEmail = event.emailOutbox
      ? emailStatus(event.emailOutbox.status)
      : "FAILED";
    const updated = await prisma.verificationNotificationEvent.updateMany({
      where: { id: event.id },
      data: {
        emailStatus: nextEmail,
        // The reference is inserted in the decision transaction. There is no
        // second notification authority to fan out or duplicate here.
        inAppStatus: "DELIVERED",
        updatedAt: now,
      },
    });
    reconciled += updated.count;
  }
  return { scanned: events.length, reconciled };
}
