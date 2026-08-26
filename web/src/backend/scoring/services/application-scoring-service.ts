import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import {
  scoreApplicationRequestSchema,
  type ScoringOperation,
} from "@/shared/contracts/scoring";
import { PrismaScoringRepository } from "../repositories/prisma-scoring-repository";

const DEFAULT_SCORING_CONFIG_VERSION = "hybrid-60-40-v1";

/**
 * Queues scoring for exactly one application. The worker and publication
 * fencing remain shared with campaign rescoring, but no other application is
 * added to this operation.
 */
export class ApplicationScoringService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly scoring = new PrismaScoringRepository(db),
  ) {}

  async request(input: {
    userId: string;
    sessionId: string;
    applicationId: string;
    idempotencyKey: string;
    raw: unknown;
    now?: Date;
  }): Promise<ScoringOperation> {
    scoreApplicationRequestSchema.parse(input.raw);
    if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");

    const application = await this.db.jobApplication.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        jobPostingId: true,
        candidateUserId: true,
        aiAnalysisConsent: true,
        documentDeletedAt: true,
        jobPosting: { select: { version: true } },
      },
    });
    if (
      !application ||
      application.documentDeletedAt ||
      !(await this.authorization.authorizeApplication(
        input.userId,
        application.jobPostingId,
        application.id,
      )).authorized
    ) {
      throw new Error("APPLICATION_UNAVAILABLE");
    }
    if (!application.aiAnalysisConsent) {
      throw new Error("AI_ANALYSIS_CONSENT_REQUIRED");
    }

    const active = await this.db.scoringOperation.findFirst({
      where: {
        jobApplicationId: application.id,
        state: { in: ["QUEUED", "RUNNING"] },
        kind: { in: ["INITIAL", "JOB_RESCORE", "AI_RETRY"] },
      },
      orderBy: { requestedAt: "desc" },
      select: { id: true },
    });
    if (active) {
      const operation = await this.scoring.findOperation(active.id);
      if (operation) return operation;
    }

    const current = await this.scoring.findCurrent(application.id);
    const now = input.now ?? new Date();
    const kind = current
      ? current.state === "DETERMINISTIC_ONLY"
        ? "AI_RETRY"
        : "JOB_RESCORE"
      : "INITIAL";
    const operation = await this.scoring.createOperation({
      kind,
      jobPostingId: application.jobPostingId,
      jobApplicationId: application.id,
      requestedByUserId: input.userId,
      requestedAt: now,
      idempotencyKey: input.idempotencyKey,
      confirmationIntent: true,
      targetJobDescriptionVersionId:
        current?.automatic.jdVersion ??
        `job-${application.jobPostingId}-v${application.jobPosting.version}`,
      targetScoringConfigVersionId:
        current?.automatic.configVersion ?? DEFAULT_SCORING_CONFIG_VERSION,
      reusedAutomaticMatchResultId:
        kind === "AI_RETRY" ? current?.automatic.resultId : undefined,
    });

    // An idempotent replay of a completed operation must not enqueue the same
    // application again. New and still-queued operations are repaired here if
    // the request was interrupted after creating the operation.
    if (operation.state !== "QUEUED" && operation.state !== "RUNNING") {
      return operation;
    }
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
    // A completed result remains the candidate-facing source of truth while
    // a rescore is running. The legacy database check requires a non-null
    // aiMatchScore to stay in COMPLETED, so marking an already-scored
    // application as PROCESSING makes the queue request fail after its work
    // item has already been created. Operation state carries the in-flight
    // signal; keep the published status constraint-valid until replacement
    // results are fenced into place by the worker.
    if (kind !== "JOB_RESCORE") {
      await this.db.jobApplication.update({
        where: { id: application.id },
        data: { scoringStatus: kind === "AI_RETRY" ? "PENDING" : "PROCESSING" },
      });
    }
    await new PrismaAuditRepository(this.db)
      .append({
        occurredAt: now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "APPLICATION_SCORING_REQUESTED",
        targetType: "job_application",
        targetId: application.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: {
          kind,
          state: "QUEUED",
          reason: "confirmed-single-application-scoring",
        },
      })
      .catch(() => undefined);

    return (await this.scoring.findOperation(operation.operationId)) ?? operation;
  }
}
