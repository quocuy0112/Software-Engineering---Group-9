import "server-only";

import { prisma } from "@/backend/database/prisma";

const AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export async function runApplicationAuditRetentionCycle(now = new Date(), limit = 500) {
  const before = new Date(now.getTime() - AUDIT_RETENTION_MS);
  const rows = await prisma.auditEvent.findMany({
    where: {
      action: { in: ["job.application.submitted", "job.application.submission_failed"] },
      occurredAt: { lt: before },
    },
    select: { id: true },
    take: limit,
  });
  if (rows.length) await prisma.auditEvent.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  return { deleted: rows.length, retentionDays: 365 };
}
