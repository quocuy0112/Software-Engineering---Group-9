import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import type { JobReportInput } from "@/shared/contracts/jobs/actions";

export type JobReportRepositoryPort = {
  submit(input: {
    reporterUserId: string;
    sessionId: string;
    jobId: string;
    reason: JobReportInput["reason"];
    details: string | null;
    unresolvedKey: string;
    occurredAt: Date;
    correlationId: string;
  }): Promise<{ created: boolean }>;
};

export class PrismaJobReportRepository implements JobReportRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async submit(input: Parameters<JobReportRepositoryPort["submit"]>[0]) {
    try {
      await this.db.$transaction(
        async (tx) => {
          const report = await tx.jobReport.create({
            data: {
              reporterUserId: input.reporterUserId,
              jobPostingId: input.jobId,
              reason: input.reason,
              details: input.details,
              status: "PENDING_REVIEW",
              unresolvedKey: input.unresolvedKey,
              createdAt: input.occurredAt,
            },
          });
          await new PrismaAuditRepository(tx).append({
            occurredAt: input.occurredAt,
            actorType: "user",
            actorUserId: input.reporterUserId,
            actorSessionId: input.sessionId,
            action: "job.report.submitted",
            targetType: "job_report",
            targetId: report.id,
            result: "SUCCESS",
            correlationId: input.correlationId,
            context: { status: "PENDING_REVIEW", duplicate: false },
          });
        },
        { isolationLevel: "Serializable" },
      );
      return { created: true };
    } catch (error) {
      const concurrentConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code);
      if (!concurrentConflict) throw error;
      const existing = await this.db.jobReport.findUnique({
        where: { unresolvedKey: input.unresolvedKey },
        select: { id: true },
      });
      if (!existing) throw error;
      await new PrismaAuditRepository(this.db).append({
        occurredAt: input.occurredAt,
        actorType: "user",
        actorUserId: input.reporterUserId,
        actorSessionId: input.sessionId,
        action: "job.report.denied",
        targetType: "job_report",
        targetId: existing.id,
        result: "DENIED",
        correlationId: input.correlationId,
        context: { reason: "unresolved_duplicate", duplicate: true },
      });
      return { created: false };
    }
  }
}
