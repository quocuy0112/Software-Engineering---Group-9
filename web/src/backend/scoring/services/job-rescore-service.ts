import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { rescoreRequestSchema, type ScoringOperation } from "@/shared/contracts/scoring";
import { PrismaScoringRepository } from "../repositories/prisma-scoring-repository";

export class JobRescoreService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly scoring = new PrismaScoringRepository(db),
  ) {}

  async request(input: { userId: string; sessionId: string; jobId: string; idempotencyKey: string; raw: unknown; now?: Date }): Promise<ScoringOperation> {
    const command = rescoreRequestSchema.parse(input.raw);
    if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const authorized = await this.authorization.authorizeJob(input.userId, input.jobId);
    if (!authorized.authorized) throw new Error("APPLICATION_UNAVAILABLE");
    const now = input.now ?? new Date();
    const operation = await this.scoring.createOperation({
      kind: "JOB_RESCORE",
      jobPostingId: input.jobId,
      requestedByUserId: input.userId,
      requestedAt: now,
      idempotencyKey: input.idempotencyKey,
      confirmationIntent: command.confirmed,
      targetJobDescriptionVersionId: command.jdVersion,
      targetScoringConfigVersionId: command.scoringConfigVersion,
    });
    if (operation.state === "QUEUED" && operation.totalCount === 0) {
      await this.db.$transaction(async (tx) => {
        const applications = await tx.jobApplication.findMany({ where: { jobPostingId: input.jobId, documentDeletedAt: null }, select: { id: true } });
        await tx.scoringOperation.update({ where: { id: operation.operationId }, data: { totalCount: applications.length, state: applications.length ? "QUEUED" : "COMPLETED", completedAt: applications.length ? null : now } });
        if (applications.length) {
          await tx.scoringWorkItem.createMany({ data: applications.map((application) => ({ operationId: operation.operationId, jobApplicationId: application.id })) , skipDuplicates: true });
          await tx.jobApplication.updateMany({ where: { id: { in: applications.map((application) => application.id) }, currentScoringResultId: null }, data: { scoringStatus: "PROCESSING" } });
        }
      });
      await new PrismaAuditRepository(this.db).append({
        occurredAt: now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "SCORING_RESCORE_REQUESTED",
        targetType: "job_posting",
        targetId: input.jobId,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { count: operation.totalCount, state: operation.totalCount === 0 ? "COMPLETED" : "QUEUED", reason: "confirmed-background-rescore" },
      }).catch(() => undefined);
    }
    return (await this.scoring.findOperation(operation.operationId)) ?? operation;
  }

  async status(input: { userId: string; jobId: string; operationId: string }) {
    const authorized = await this.authorization.authorizeJob(input.userId, input.jobId);
    if (!authorized.authorized) throw new Error("APPLICATION_UNAVAILABLE");
    const operation = await this.scoring.findOperation(input.operationId);
    if (!operation) throw new Error("APPLICATION_UNAVAILABLE");
    return operation;
  }
}
