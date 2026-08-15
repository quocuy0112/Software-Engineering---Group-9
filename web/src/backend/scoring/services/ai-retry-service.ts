import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { aiRetryRequestSchema } from "@/shared/contracts/scoring";
import { PrismaScoringRepository } from "../repositories/prisma-scoring-repository";

export class AiRetryService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly scoring = new PrismaScoringRepository(db),
  ) {}

  async request(input: { userId: string; sessionId: string; applicationId: string; idempotencyKey: string; raw: unknown; now?: Date }) {
    const command = aiRetryRequestSchema.parse(input.raw);
    if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const application = await this.db.jobApplication.findUnique({ where: { id: input.applicationId }, select: { id: true, jobPostingId: true } });
    if (!application || !(await this.authorization.authorizeApplication(input.userId, application.jobPostingId, application.id)).authorized) throw new Error("APPLICATION_UNAVAILABLE");
    const current = await this.scoring.findCurrent(input.applicationId);
    if (!current || current.state === "SCORED" || current.automatic === null) throw new Error("AI_RETRY_NOT_AVAILABLE");
    const now = input.now ?? new Date();
    const activeRetry = await this.db.scoringOperation.findFirst({ where: { jobApplicationId: application.id, kind: "AI_RETRY", state: { in: ["QUEUED", "RUNNING"] } }, orderBy: { requestedAt: "desc" }, select: { id: true } });
    if (activeRetry) {
      const operation = await this.scoring.findOperation(activeRetry.id);
      if (operation) return { operation, reusedAutomaticMatchResultId: current.automatic.resultId, scoring: { kind: "PENDING" as const, label: "Pending" as const, operationId: operation.operationId, automaticMatch: current.automatic } };
    }
    const operation = await this.scoring.createOperation({
      kind: "AI_RETRY",
      jobPostingId: application.jobPostingId,
      jobApplicationId: application.id,
      requestedByUserId: input.userId,
      requestedAt: now,
      idempotencyKey: input.idempotencyKey,
      confirmationIntent: command.confirmed,
      targetJobDescriptionVersionId: current.automatic.jdVersion,
      targetScoringConfigVersionId: current.automatic.configVersion,
      reusedAutomaticMatchResultId: current.automatic.resultId,
    });
    await this.db.scoringWorkItem.upsert({
      where: {
        operationId_jobApplicationId: {
          operationId: operation.operationId,
          jobApplicationId: application.id,
        },
      },
      create: {
        operationId: operation.operationId,
        jobApplicationId: application.id,
      },
      update: {},
    });
    await this.db.jobApplication.update({ where: { id: application.id }, data: { scoringStatus: "PENDING" } });
    await new PrismaAuditRepository(this.db).append({
      occurredAt: now,
      actorType: "user",
      actorUserId: input.userId,
      actorSessionId: input.sessionId,
      action: "AI_RETRY_REQUESTED",
      targetType: "job_application",
      targetId: application.id,
      result: "SUCCESS",
      correlationId: randomUUID(),
      context: { reason: "confirmed-ai-retry", state: "PENDING" },
    }).catch(() => undefined);
    return { operation, reusedAutomaticMatchResultId: current.automatic.resultId, scoring: { kind: "PENDING" as const, label: "Pending" as const, operationId: operation.operationId, automaticMatch: current.automatic } };
  }
}
