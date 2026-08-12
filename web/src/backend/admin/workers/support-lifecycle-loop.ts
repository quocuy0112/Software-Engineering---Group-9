import "server-only";
import { PrismaSupportRepository } from "@/backend/repositories/support/prisma-support-repository";
import { supportRealtimePublisher } from "@/backend/support/realtime/support-realtime-hub";

export async function runSupportLifecycleCycle(now = new Date()) {
  const repository = new PrismaSupportRepository();
  const closures = await repository.closeDue(now);
  const assignments = await repository.requeueInvalidAssignments(now);
  const retention = await repository.purgeDueContent(now);
  for (const event of [
    ...closures.events,
    ...assignments.events,
    ...retention.events,
  ]) {
    await supportRealtimePublisher().publish(
      event.invalidation,
      event.requesterUserId,
    );
  }
  return {
    closures: { closed: closures.closed },
    assignments: { requeued: assignments.requeued },
    retention: { purged: retention.purged },
  };
}
