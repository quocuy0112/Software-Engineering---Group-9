import "server-only";
import { prisma } from "@/backend/database/prisma";
import { emitNotificationOperation } from "@/backend/notifications/notification-operations";
import { PrismaNotificationRepository } from "@/backend/repositories/notifications/prisma-notification-repository";

export async function runNotificationRetentionCycle(
  now = new Date(),
  limit = 500,
) {
  const startedAt = performance.now();
  try {
    const deleted = await new PrismaNotificationRepository(prisma).deleteExpired(
      now,
      Math.min(2_000, Math.max(1, limit)),
    );
    emitNotificationOperation({
      operation: "retention",
      outcome: "success",
      durationMs: performance.now() - startedAt,
      affectedCount: deleted,
    });
    return { deleted };
  } catch (error) {
    emitNotificationOperation({
      operation: "retention",
      outcome: "failure",
      durationMs: performance.now() - startedAt,
      errorCode: "NOTIFICATION_RETENTION_FAILED",
    });
    throw error;
  }
}
