import "server-only";

import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaExportRequestRepository } from "@/backend/repositories/analytics/prisma-export-request-repository";
import { exportArtifactStorage } from "./storage";

export async function runCandidateExportRetention(
  now = new Date(),
  take = 100,
) {
  const repository = new PrismaExportRequestRepository();
  const storage = exportArtifactStorage();
  const expired = await repository.findExpired(now, take);
  let processed = 0;
  for (const request of expired) {
    if (request.storageLocator) {
      await storage.delete(request.storageLocator).catch(() => undefined);
    }
    await repository.expire(request.id, now);
    await repository.markDeleted(request.id, now);
    await new PrismaAuditRepository().append({
      occurredAt: now,
      actorType: "system",
      actorUserId: null,
      actorSessionId: null,
      action: "analytics.export.expired",
      targetType: "export_request",
      targetId: request.id,
      result: "SUCCESS",
      correlationId: request.id,
      context: { format: request.format },
    }).catch(() => undefined);
    processed += 1;
  }
  return processed;
}
